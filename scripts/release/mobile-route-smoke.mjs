import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { getLiveProbeAccount, getLiveProbeBaseUrl } from './probes/live-probe-env.mjs';
import { loginLiveProbeAccount } from './probes/live-probe-login.mjs';

const BASE_URL = getLiveProbeBaseUrl();
const OUT_DIR = path.resolve('output/playwright/e2e-live');
const TS = Date.now();

const ACCOUNT = getLiveProbeAccount('admin');

const routes = ['/activity', '/visits', '/clients', '/clients/new'];
const excludedMedicationRoutes = ['/emar', '/medication'];

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewport: { width: 390, height: 844 },
    results: [],
    verdict: 'PASS',
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await loginLiveProbeAccount(page, {
      baseUrl: BASE_URL,
      account: ACCOUNT,
      localRole: 'admin',
    });

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

      const currentUrl = page.url();
      const pass = currentUrl.includes(route);
      if (!pass) report.verdict = 'FAIL';

      const shot = path.join(OUT_DIR, `${TS}_mobile_smoke_${route.replace(/[^a-z0-9]+/gi, '_')}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      report.results.push({ route, pass, currentUrl, screenshot: shot });
    }

    for (const route of excludedMedicationRoutes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForURL(/\/access\/feature-not-enabled$/, { timeout: 30000 });
      const currentUrl = page.url();
      const pass = new URL(currentUrl).pathname === '/access/feature-not-enabled';
      if (!pass) report.verdict = 'FAIL';
      const shot = path.join(OUT_DIR, `${TS}_mobile_smoke_${route.slice(1)}_excluded.png`);
      await page.screenshot({ path: shot, fullPage: true });
      report.results.push({ route, expected: '/access/feature-not-enabled', pass, currentUrl, screenshot: shot });
    }
  } catch (error) {
    report.verdict = 'FAIL';
    report.fatal = error && error.stack ? error.stack : String(error);
  } finally {
    await context.close();
    await browser.close();
  }

  const outJson = path.join(OUT_DIR, `${TS}_mobile_route_smoke.json`);
  await fs.writeFile(outJson, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.verdict === 'PASS', outJson, verdict: report.verdict }, null, 2));
  if (report.verdict !== 'PASS') process.exit(1);
}

main().catch((error) => {
  console.error('MOBILE_ROUTE_SMOKE_FAILED', error && error.stack ? error.stack : String(error));
  process.exit(1);
});
