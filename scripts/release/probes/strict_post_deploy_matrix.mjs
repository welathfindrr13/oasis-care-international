import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.oasis-care.co';
const OUT_DIR = 'output/playwright/e2e-live';
const TS = Date.now();
const RESULT_PREFIX = 'PROBE_RESULT_JSON:';
const REQUIRED_CHECKS = ['activity', 'adminMetrics', 'clientsNew', 'visitsNew'];

const ACCOUNTS = {
  admin: {
    email: process.env.PLAYWRIGHT_ADMIN_EMAIL || 'boss@yourdomain.com',
    password: process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'SecurePassword123!1',
  },
  carer: {
    email: process.env.PLAYWRIGHT_CARER_EMAIL || 'carer-demo@yourdomain.com',
    password: process.env.PLAYWRIGHT_CARER_PASSWORD || 'SecurePassword123!2',
  },
};

function stamp() {
  return new Date().toISOString();
}

async function safeVisible(locator, timeout = 3000) {
  try {
    return await locator.first().isVisible({ timeout });
  } catch {
    return false;
  }
}

async function screenshot(page, role, label) {
  const p = path.join(OUT_DIR, `${TS}_${role}_${label}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function waitForPostLogin(page) {
  await page.waitForLoadState('domcontentloaded');
  for (let i = 0; i < 80; i++) {
    const u = page.url();
    if (u.startsWith(BASE_URL) && !u.includes('/login')) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for login redirect. URL=${page.url()}`);
}

async function login(page, role) {
  const { email, password } = ACCOUNTS[role];
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });

  await page.locator('button:has-text("Sign in securely")').first().click({ timeout: 20000 });
  await page.waitForURL(/amazoncognito\.com/, { timeout: 60000 });

  const userInput = page.locator('input[name="username"], input#username, input[type="email"]').first();
  await userInput.waitFor({ state: 'visible', timeout: 30000 });
  await userInput.fill(email);

  const nextBtn = page.getByRole('button', { name: /next|continue|sign in|log in/i }).first();
  await nextBtn.click({ timeout: 15000 });

  const passInput = page.locator('input[name="password"], input#password, input[type="password"]').first();
  await passInput.waitFor({ state: 'visible', timeout: 30000 });
  await passInput.fill(password);

  const submitBtn = page.getByRole('button', { name: /continue|sign in|log in|login/i }).first();
  await submitBtn.click({ timeout: 15000 });

  await waitForPostLogin(page);
  await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {});
}

async function gql(page, query, variables = {}) {
  return await page.evaluate(async ({ query, variables }) => {
    const res = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      credentials: 'include',
    });

    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }

    return {
      status: res.status,
      ok: res.ok,
      body,
    };
  }, { query, variables });
}

function noGraphQLErrors(payload) {
  return !(Array.isArray(payload?.body?.errors) && payload.body.errors.length > 0);
}

async function checkActivity(page, role) {
  await page.goto(`${BASE_URL}/activity`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(9000);

  const url = page.url();
  const hasHeading = await safeVisible(page.locator('h1:has-text("Today\'s Activity")'));
  const hasLoading = await safeVisible(page.getByText('Loading...', { exact: false }));
  const hasBookedCard = await safeVisible(page.getByText('Visits booked today', { exact: false }));
  const hasFinishedCard = await safeVisible(page.getByText('Visits finished today', { exact: false }));
  const hasErrorCard =
    (await safeVisible(page.getByText('Error loading activity stats', { exact: false }))) ||
    (await safeVisible(page.getByText('Sign in required', { exact: false }))) ||
    (await safeVisible(page.getByText('Sign in again', { exact: false })));
  const hasForbiddenCard = await safeVisible(
    page.getByText('You do not have access to this activity view', { exact: false }),
  );

  const pass =
    role === 'admin'
      ? hasHeading && hasBookedCard && hasFinishedCard && !hasErrorCard && !hasLoading
      : hasHeading && !hasLoading && (hasBookedCard || hasFinishedCard || hasForbiddenCard);
  return {
    pass,
    expected:
      role === 'admin'
        ? 'Activity renders booked/finished cards without upstream errors'
        : 'Activity route is reachable and returns cards or explicit access denial',
    actual: { url, hasHeading, hasLoading, hasBookedCard, hasFinishedCard, hasErrorCard, hasForbiddenCard },
    screenshot: await screenshot(page, role, 'activity'),
  };
}

async function checkRoute(page, role, route, mode, contentCheck) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const finalUrl = page.url();
  let pass = false;

  if (mode === 'allow') {
    pass = finalUrl.includes(route);
  } else {
    pass = !finalUrl.includes(route) && (finalUrl.includes('/activity') || finalUrl.includes('/login'));
  }

  let content = null;
  if (contentCheck) {
    content = await contentCheck(page);
    pass = pass && content.pass;
  }

  return {
    pass,
    expected: mode === 'allow' ? `${route} accessible` : `${route} blocked/redirected`,
    actual: { finalUrl, ...(content ? content.actual : {}) },
    screenshot: await screenshot(page, role, route.replace(/[^a-z0-9]+/gi, '_')),
  };
}

async function runForRole(browser, role) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const result = {
    role,
    startedAt: stamp(),
    checks: {},
    passed: 0,
    failed: 0,
  };

  try {
    await login(page, role);

    result.checks.activity = await checkActivity(page, role);

    if (role === 'admin') {
      result.checks.adminMetrics = await checkRoute(page, role, '/admin/metrics', 'allow', async (p) => {
        const hasTitle = await safeVisible(p.locator('h1:has-text("System Metrics")'));
        return { pass: hasTitle, actual: { hasTitle } };
      });
      result.checks.clientsNew = await checkRoute(page, role, '/clients/new', 'allow', async (p) => {
        const hasTitle = await safeVisible(p.locator('h1:has-text("Add New Client")'));
        return { pass: hasTitle, actual: { hasTitle } };
      });
      result.checks.visitsNew = await checkRoute(page, role, '/visits/new', 'allow', async (p) => {
        const hasTitle = await safeVisible(p.locator('h1:has-text("Schedule New Visit")'));
        const hasClientSelect = await safeVisible(p.locator('select#client'));
        const hasCarerSelect = await safeVisible(p.locator('select#carer'));
        return { pass: hasTitle && hasClientSelect && hasCarerSelect, actual: { hasTitle, hasClientSelect, hasCarerSelect } };
      });
    } else {
      result.checks.adminMetrics = await checkRoute(page, role, '/admin/metrics', 'deny');
      result.checks.clientsNew = await checkRoute(page, role, '/clients/new', 'deny');
      result.checks.visitsNew = await checkRoute(page, role, '/visits/new', 'deny');
    }
  } catch (error) {
    result.fatal = error instanceof Error ? error.stack : String(error);
    await screenshot(page, role, 'fatal').catch(() => {});
  } finally {
    for (const check of Object.values(result.checks)) {
      if (check?.pass) result.passed += 1;
      else result.failed += 1;
    }
    result.finishedAt = stamp();
    await context.close();
  }

  return result;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const report = {
    generatedAt: stamp(),
    baseUrl: BASE_URL,
    matrix: REQUIRED_CHECKS,
    results: {},
    verdict: 'PENDING',
  };

  const browser = await chromium.launch({ headless: true });
  try {
    report.results.admin = await runForRole(browser, 'admin');
    report.results.carer = await runForRole(browser, 'carer');
  } finally {
    await browser.close();
  }

  const checks = [
    ...Object.values(report.results.admin?.checks || {}),
    ...Object.values(report.results.carer?.checks || {}),
  ];
  const expectedChecksPerRole = report.matrix.length;
  const expectedTotalChecks = expectedChecksPerRole * 2;
  const observedRoleChecks = checks.length;
  const adminMissingChecks = report.matrix.filter((name) => !report.results.admin?.checks?.[name]);
  const carerMissingChecks = report.matrix.filter((name) => !report.results.carer?.checks?.[name]);
  const roleFatalCount = [report.results.admin, report.results.carer].filter((r) => Boolean(r?.fatal)).length;
  const gateChecks = [
    { name: 'noRoleFatal', pass: roleFatalCount === 0, actual: { roleFatalCount } },
    {
      name: 'expectedCheckCount',
      pass: observedRoleChecks === expectedTotalChecks,
      actual: { observed: observedRoleChecks, expected: expectedTotalChecks },
    },
    { name: 'adminNoMissingChecks', pass: adminMissingChecks.length === 0, actual: { adminMissingChecks } },
    { name: 'carerNoMissingChecks', pass: carerMissingChecks.length === 0, actual: { carerMissingChecks } },
  ];
  const combinedChecks = [...checks, ...gateChecks];

  report.gateChecks = gateChecks;
  report.totalChecks = combinedChecks.length;
  report.passedChecks = combinedChecks.filter((c) => c?.pass).length;
  report.failedChecks = combinedChecks.filter((c) => !c?.pass).length;
  report.expectedChecks = {
    perRole: expectedChecksPerRole,
    total: expectedTotalChecks,
  };
  report.completeness = {
    adminMissingChecks,
    carerMissingChecks,
    roleFatalCount,
  };
  report.verdict = report.failedChecks === 0 ? 'PASS' : 'FAIL';

  const outJson = path.join(OUT_DIR, `${TS}_strict_post_deploy_matrix.json`);
  await fs.writeFile(outJson, JSON.stringify(report, null, 2));

  const result = {
    ok: report.verdict === 'PASS',
    outJson,
    verdict: report.verdict,
    total: report.totalChecks,
    passed: report.passedChecks,
    failed: report.failedChecks,
  };
  console.log(`${RESULT_PREFIX}${JSON.stringify(result)}`);

  if (report.verdict !== 'PASS') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('STRICT_MATRIX_FAILED', err && err.stack ? err.stack : err);
  process.exit(1);
});
