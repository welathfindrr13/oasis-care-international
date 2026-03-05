import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.oasis-care.co';
const OUT_DIR = path.resolve('output/playwright/e2e-live');
const TS = Date.now();

const ACCOUNT = {
  email: process.env.PLAYWRIGHT_ADMIN_EMAIL || 'boss@yourdomain.com',
  password: process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'SecurePassword123!1',
};

const routes = ['/activity', '/visits', '/clients', '/clients/new', '/emar'];

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('button:has-text("Sign in securely")').first().click({ timeout: 20000 });
  await page.waitForURL(/amazoncognito\.com/, { timeout: 60000 });

  await page.locator('input[name="username"], input#username, input[type="email"]').first().fill(ACCOUNT.email);
  await page.getByRole('button', { name: /next|continue|sign in|log in/i }).first().click({ timeout: 15000 });
  await page.locator('input[name="password"], input#password, input[type="password"]').first().fill(ACCOUNT.password);
  await page.getByRole('button', { name: /continue|sign in|log in|login/i }).first().click({ timeout: 15000 });
  await page.waitForURL((url) => url.toString().startsWith(BASE_URL) && !url.toString().includes('/login'), {
    timeout: 90000,
  });
}

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
    await login(page);

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
