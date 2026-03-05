import {promises as fs} from 'fs';
import path from 'path';

type RouteEntry = {
  path: string;
  file: string;
  fileType: string; // page|layout|route|loading|error|not-found|head|sitemap
  dynamic: boolean;
};
type RouteSummary = {
  path: string;
  hasPage: boolean;
  hasLayout: boolean;
  hasLoading: boolean;
  hasError: boolean;
  hasRouteHandlers: boolean;
  hasNotFound: boolean;
  hasHead: boolean;
  hasSitemap: boolean;
  segments: string[];
  dynamic: boolean;
};

async function exists(p: string){ try{ await fs.access(p); return true;} catch{ return false; } }

async function detectWebRoot(): Promise<string> {
  const candidates = ['apps/web', 'app', 'web', 'frontend', 'packages/web', 'apps/site'];
  for (const c of candidates){
    const appDir = path.join(c, 'app');
    const pkg = path.join(c, 'package.json');
    if (await exists(appDir) && await exists(pkg)) return c;
  }
  // fallback: scan apps/* for app dir
  const appsDir = 'apps';
  if (await exists(appsDir)) {
    const ents = await fs.readdir(appsDir, {withFileTypes:true});
    for (const e of ents){
      if (e.isDirectory()){
        const appDir = path.join(appsDir, e.name, 'app');
        const pkg = path.join(appsDir, e.name, 'package.json');
        if (await exists(appDir) && await exists(pkg)) return path.join(appsDir, e.name);
      }
    }
  }
  return 'apps/web'; // best effort
}

function toWebPath(fromRoot: string, full: string): string {
  const rel = path.relative(fromRoot, full).replaceAll(path.sep, '/');
  // Convert app router folder path to URL path
  // Remove "app/" prefix, strip route filenames
  let p = rel.replace(/^app\//, '');
  p = p.replace(/\/?(page|layout|route|loading|error|not-found|head|sitemap)\.(tsx|ts|js|jsx)$/, '');
  // strip (group) segments from URL
  p = p.split('/').filter(seg => !/^\(.*\)$/.test(seg)).join('/');
  if (!p.startsWith('/')) p = '/' + p;
  if (p === '/app' || p === '/') return '/';
  return p.replace(/\/index$/, '') || '/';
}

function dynamicFromPath(urlPath: string): boolean {
  return urlPath.split('/').some(seg => /^\[.*\]$/.test(seg));
}

async function walk(dir: string): Promise<string[]> {
  const res: string[] = [];
  async function rec(d: string){
    const ents = await fs.readdir(d, {withFileTypes:true});
    for (const e of ents){
      const p = path.join(d, e.name);
      if (e.isDirectory()) await rec(p);
      else res.push(p);
    }
  }
  await rec(dir);
  return res;
}

async function scan(){
  const webRoot = await detectWebRoot();
  const appDir = path.join(webRoot, 'app');
  const compDir = path.join(webRoot, 'components');

  const files = (await exists(appDir)) ? await walk(appDir) : [];
  const interesting = files.filter(f => /\.(tsx|ts|js|jsx)$/.test(f) && /(page|layout|route|loading|error|not-found|head|sitemap)\./.test(f));

  const entries: RouteEntry[] = interesting.map(f => {
    const fileType = (f.match(/(page|layout|route|loading|error|not-found|head|sitemap)\.(tsx|ts|js|jsx)$/)?.[1]) || 'page';
    const urlPath = toWebPath(webRoot, f);
    return {
      path: urlPath,
      file: path.relative('.', f).replaceAll(path.sep,'/'),
      fileType,
      dynamic: dynamicFromPath(urlPath)
    };
  });

  // Summarize by path
  const byPath = new Map<string, RouteSummary>();
  for (const e of entries){
    const s = byPath.get(e.path) || {
      path: e.path,
      hasPage:false, hasLayout:false, hasLoading:false, hasError:false,
      hasRouteHandlers:false, hasNotFound:false, hasHead:false, hasSitemap:false,
      segments: e.path.split('/').filter(Boolean), dynamic: e.dynamic
    };
    if (e.fileType==='page') s.hasPage = true;
    if (e.fileType==='layout') s.hasLayout = true;
    if (e.fileType==='loading') s.hasLoading = true;
    if (e.fileType==='error') s.hasError = true;
    if (e.fileType==='route') s.hasRouteHandlers = true;
    if (e.fileType==='not-found') s.hasNotFound = true;
    if (e.fileType==='head') s.hasHead = true;
    if (e.fileType==='sitemap') s.hasSitemap = true;
    byPath.set(e.path, s);
  }

  // Components
  let components: {name:string; path:string; kind:'ui'|'domain'|'feature'|'unknown'}[] = [];
  if (await exists(compDir)){
    const compFiles = (await walk(compDir)).filter(f => /\.(tsx|ts|jsx|js)$/.test(f));
    components = compFiles.map(f => {
      const rel = path.relative('.', f).replaceAll(path.sep,'/');
      const base = path.basename(f).replace(/\.(tsx|ts|jsx|js)$/,'');
      const name = base.charAt(0).toUpperCase()+base.slice(1);
      const segs = rel.split('/');
      const idx = segs.findIndex(s => s === 'components');
      const sub = segs.slice(idx+1, idx+2)[0] || '';
      const kind = sub === 'ui' ? 'ui' : sub === 'oasis' ? 'domain' : (sub && sub !== base ? 'feature':'unknown');
      return {name, path: rel, kind: kind as any};
    });
  }

  // Data flow hints (cheap grep)
  const dfHints = { counts: {} as Record<string, number>, samples: {} as Record<string, string[]> };
  const dfWords = ['graphql','@apollo/client','urql','react-query','swr','use server','export async function GET','export async function POST','fetch(','next/headers'];
  const allWebFiles = (await exists(webRoot)) ? await walk(webRoot) : [];
  const codeFiles = allWebFiles.filter(f => /\.(tsx|ts|js|jsx)$/.test(f));
  for (const w of dfWords){
    let count = 0; const sample: string[] = [];
    for (const f of codeFiles){
      const txt = await fs.readFile(f,'utf8').catch(()=> '');
      if (txt && txt.includes(w)){ count++; if (sample.length<5) sample.push(path.relative('.',f).replaceAll(path.sep,'/')); }
    }
    dfHints.counts[w] = count; dfHints.samples[w] = sample;
  }

  // Tailwind config
  async function readTailwindConfig(){
    const candidates = ['tailwind.config.ts','tailwind.config.js','tailwind.config.cjs','tailwind.config.mjs'].map(n=>path.join(webRoot,n));
    for (const c of candidates){
      if (await exists(c)){
        const raw = await fs.readFile(c,'utf8');
        // naive parse: pick extend.*, plugins strings
        const out:any = { file: path.relative('.', c).replaceAll(path.sep,'/') };
        out.extend = {};
        const mColors = raw.match(/extend\s*:\s*{[\s\S]*?}/);
        if (mColors) out.extendBlock = mColors[0].slice(0, 2000);
        const pluginNames = [...raw.matchAll(/plugins\s*:\s*\[([\s\S]*?)\]/g)].map(m=>m[1].slice(0,500));
        out.pluginsBlock = pluginNames[0] || '';
        return out;
      }
    }
    return null;
  }
  const tailwind = await readTailwindConfig();

  // Tokens file
  async function findTokens(){
    const candidates = [
      'design/tokens.json', 'apps/web/design/tokens.json',
      'design/tokens.ts', 'apps/web/design/tokens.ts'
    ];
    for (const c of candidates){ if (await exists(c)) return c; }
    return null;
  }
  const tokensPath = await findTokens();

  // Auth detection
  async function detectAuth(){
    const nextAuthCandidates = [
      path.join(webRoot,'app/api/auth/[...nextauth]/route.ts'),
      path.join(webRoot,'app/api/auth/[...nextauth]/route.js')
    ];
    const hasNextAuth = (await Promise.all(nextAuthCandidates.map(exists))).some(Boolean);
    const middlewarePath = 'middleware.ts';
    const hasMiddleware = await exists(middlewarePath);
    let middlewareText = '';
    if (hasMiddleware) middlewareText = await fs.readFile(middlewarePath,'utf8').catch(()=> '');
    return { hasNextAuth, hasMiddleware, middlewareContainsMatcher: /matcher\s*:\s*\[/.test(middlewareText) };
  }
  const auth = await detectAuth();

  await fs.writeFile('_generated/frontend_routes.json', JSON.stringify({
    entries,
    summary: [...byPath.values()].sort((a,b)=> a.path.localeCompare(b.path))
  }, null, 2));
  await fs.writeFile('_generated/frontend_components.json', JSON.stringify({ components }, null, 2));
  await fs.writeFile('_generated/frontend_data_flow.json', JSON.stringify(dfHints, null, 2));
  await fs.writeFile('_generated/tailwind_config.json', JSON.stringify(tailwind, null, 2));
  await fs.writeFile('_generated/frontend_auth.json', JSON.stringify(auth, null, 2));
}
scan().catch(async (e)=>{ console.error(e); process.exit(0); });
