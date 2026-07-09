import fs from 'node:fs';
import path from 'node:path';

const apiRoot = __dirname;
const repoRoot = path.resolve(apiRoot, '../../..');

describe('demo production safety', () => {
  it('does not load the demo module in the API runtime', () => {
    const appModule = fs.readFileSync(path.join(apiRoot, 'app.module.ts'), 'utf8');

    expect(appModule).not.toMatch(/DemoModule/);
    expect(appModule).not.toMatch(/\.\/demo\/demo\.module/);
  });

  it('does not ship demo seed controllers or demo auth bypass guards', () => {
    const demoDir = path.join(apiRoot, 'demo');

    expect(fs.existsSync(demoDir)).toBe(false);
  });

  it('does not expose package seed scripts for staging or demo data', () => {
    const rootPackageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(rootPackageJson.scripts ?? {}).not.toHaveProperty('seed:staging');
    expect(JSON.stringify(rootPackageJson.scripts ?? {})).not.toMatch(/demo|staging\.seed/i);
    expect(fs.existsSync(path.join(repoRoot, 'scripts/seed/staging.seed.ts'))).toBe(false);
  });
});
