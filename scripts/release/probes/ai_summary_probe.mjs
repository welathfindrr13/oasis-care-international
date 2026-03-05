import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.oasis-care.co';
const OUT_DIR = 'output/playwright/e2e-live';
const TS = Date.now();
const RESULT_PREFIX = 'PROBE_RESULT_JSON:';
const REQUIRED_ADMIN_CHECKS = ['noFatal', 'currentWeekBefore', 'currentWeekAfter', 'generateSummary', 'approveSummary'];
const REQUIRED_CARER_CHECKS = ['noFatal', 'currentWeekBefore', 'currentWeekAfter', 'approveForbiddenForCarer'];

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

function boundsThisWeek() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

function boundsFreshGenerationWindow() {
  // Use a unique period each run to force real generation instead of cached period reuse.
  const now = new Date();
  const periodEnd = new Date(now.getTime() - 60 * 1000);
  const periodStart = new Date(periodEnd.getTime() - 6 * 60 * 60 * 1000);
  return { periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
}

async function safeVisible(locator, timeout = 2500) {
  try {
    return await locator.first().isVisible({ timeout });
  } catch {
    return false;
  }
}

async function screenshot(page, role, label) {
  const file = path.join(OUT_DIR, `${TS}_${role}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
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

    return { status: res.status, ok: res.ok, body };
  }, { query, variables });
}

function hasGraphQLErrors(op) {
  return Array.isArray(op?.errors) && op.errors.length > 0;
}

function isForbidden(op) {
  if (!op) return false;
  if (op.status === 403) return true;
  if (!hasGraphQLErrors(op)) return false;
  return op.errors.some((err) => {
    const code = String(err?.extensions?.code || '').toLowerCase();
    const msg = String(err?.message || '').toLowerCase();
    return code.includes('forbidden') || msg.includes('forbidden') || msg.includes('unauthorized');
  });
}

function hasErrorCode(op, code) {
  if (!hasGraphQLErrors(op)) return false;
  const target = String(code || '').toLowerCase();
  return op.errors.some((err) =>
    String(err?.extensions?.code || '').toLowerCase() === target
  );
}

function hasErrorMessage(op, fragment) {
  if (!hasGraphQLErrors(op)) return false;
  const target = String(fragment || '').toLowerCase();
  return op.errors.some((err) =>
    String(err?.message || '').toLowerCase().includes(target)
  );
}

async function getFirstClient(page) {
  const query = `query Clients($take: Int, $skip: Int, $search: String) {
    clients(take: $take, skip: $skip, search: $search) {
      items { id fullName }
      total
    }
  }`;
  const res = await gql(page, query, { take: 1, skip: 0, search: '' });
  const first = res?.body?.data?.clients?.items?.[0] || null;
  return { res, first };
}

async function createClient(page) {
  const suffix = `${Date.now()}`;
  const mutation = `mutation CreateClient($input: CreateClientInput!) {
    createClient(input: $input) {
      id fullName
    }
  }`;
  const vars = {
    input: {
      fullName: `UX_AI_${suffix}`,
      addressLine1: '1 UX Test Street',
      addressLine2: null,
      city: 'London',
      postcode: 'E1 1AA',
    },
  };
  const res = await gql(page, mutation, vars);
  return { res, created: res?.body?.data?.createClient || null };
}

async function probeSummaryOps(page, role, clientId, forcedSummaryId = null) {
  const out = {};

  await page.goto(`${BASE_URL}/clients/${clientId}/summary`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  out.ui = {
    url: page.url(),
    hasHeading: await safeVisible(page.locator('h1:has-text("AI Health Summary")')),
    hasGenerateButton: await safeVisible(page.locator('button:has-text("Generate Summary")')),
    hasLoadError: await safeVisible(page.getByText('Failed to load health summary', { exact: false })),
    screenshot: await screenshot(page, role, 'ai_summary_page'),
  };

  const currentQuery = `query CurrentWeekSummary($clientId: ID!) {
    currentWeekSummary(clientId: $clientId) { id status generatedAt expiresAt clientId }
  }`;
  const before = await gql(page, currentQuery, { clientId });
  out.currentWeekBefore = {
    status: before.status,
    errors: before?.body?.errors || null,
    summary: before?.body?.data?.currentWeekSummary || null,
  };

  const { periodStart, periodEnd } = boundsFreshGenerationWindow();
  const generateMutation = `mutation GenerateSummary($input: GenerateSummaryInput!) {
    generateSummary(input: $input) { id status generatedAt expiresAt clientId }
  }`;
  const generated = await gql(page, generateMutation, { input: { clientId, periodStart, periodEnd } });
  out.generate = {
    status: generated.status,
    errors: generated?.body?.errors || null,
    summary: generated?.body?.data?.generateSummary || null,
  };

  const after = await gql(page, currentQuery, { clientId });
  out.currentWeekAfter = {
    status: after.status,
    errors: after?.body?.errors || null,
    summary: after?.body?.data?.currentWeekSummary || null,
  };

  let summaryId = null;
  let summaryIdSource = null;
  if (forcedSummaryId) {
    summaryId = forcedSummaryId;
    summaryIdSource = 'forced';
  } else if (generated?.body?.data?.generateSummary?.id) {
    summaryId = generated.body.data.generateSummary.id;
    summaryIdSource = 'generate';
  } else if (after?.body?.data?.currentWeekSummary?.id) {
    summaryId = after.body.data.currentWeekSummary.id;
    summaryIdSource = 'currentWeekAfter';
  } else if (before?.body?.data?.currentWeekSummary?.id) {
    summaryId = before.body.data.currentWeekSummary.id;
    summaryIdSource = 'currentWeekBefore';
  }
  out.summaryId = summaryId;
  out.summaryIdSource = summaryIdSource;

  const approveMutation = `mutation ApproveSummary($input: ApproveSummaryInput!) {
    approveSummary(input: $input) { id status approvedBy approvedAt feedback }
  }`;
  if (summaryId) {
    const approval = await gql(page, approveMutation, { input: { summaryId, feedback: 'approved' } });
    out.approve = {
      status: approval.status,
      errors: approval?.body?.errors || null,
      summary: approval?.body?.data?.approveSummary || null,
    };
  } else {
    out.approve = { skipped: true, reason: 'No summary id available' };
  }

  out.finalScreenshot = await screenshot(page, role, 'ai_summary_final');
  return out;
}

function evaluateRoleResult(result) {
  const checks = [];
  const role = String(result?.role || '').toLowerCase();

  checks.push({
    name: 'noFatal',
    pass: !result?.fatal,
    actual: result?.fatal || null,
  });

  checks.push({
    name: 'currentWeekBefore',
    pass:
      result?.currentWeekBefore?.status === 200 &&
      !hasGraphQLErrors(result?.currentWeekBefore),
    actual: result?.currentWeekBefore || null,
  });

  checks.push({
    name: 'currentWeekAfter',
    pass:
      result?.currentWeekAfter?.status === 200 &&
      !hasGraphQLErrors(result?.currentWeekAfter),
    actual: result?.currentWeekAfter || null,
  });

  if (role === 'admin') {
    const beforeSummaryId = result?.currentWeekBefore?.summary?.id || null;
    const latestStatus =
      result?.currentWeekAfter?.summary?.status ||
      result?.generate?.summary?.status ||
      result?.currentWeekBefore?.summary?.status ||
      null;
    const generatedSummaryId = result?.generate?.summary?.id || null;
    const reusedExistingSummary = Boolean(
      generatedSummaryId && beforeSummaryId && generatedSummaryId === beforeSummaryId,
    );
    const approveSucceeded =
      result?.approve?.status === 200 &&
      !hasGraphQLErrors(result?.approve) &&
      Boolean(result?.approve?.summary?.id);
    const alreadyProcessedRuleHit =
      latestStatus === 'APPROVED' &&
      (hasErrorCode(result?.approve, 'SUMMARY_ALREADY_PROCESSED') ||
        hasErrorMessage(result?.approve, 'already been processed'));

    checks.push({
      name: 'generateSummary',
      pass:
        result?.generate?.status === 200 &&
        !hasGraphQLErrors(result?.generate) &&
        Boolean(generatedSummaryId) &&
        result?.summaryIdSource === 'generate',
      actual: {
        ...(result?.generate || {}),
        generatedSummaryId,
        beforeSummaryId,
        reusedExistingSummary,
        summaryIdSource: result?.summaryIdSource || null,
      },
    });

    checks.push({
      name: 'approveSummary',
      pass: approveSucceeded || alreadyProcessedRuleHit,
      actual: result?.approve || null,
    });
  } else {
    checks.push({
      name: 'approveForbiddenForCarer',
      pass: isForbidden(result?.approve),
      actual: result?.approve || null,
    });
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;

  return {
    checks,
    summary: { total: checks.length, passed, failed },
    verdict: failed === 0 ? 'PASS' : 'FAIL',
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, createdClientId: null, results: {} };

  // Admin first
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const out = { role: 'admin', startedAt: new Date().toISOString() };
    try {
      await login(page, 'admin');
      const clients = await getFirstClient(page);
      out.clientsQuery = { status: clients.res.status, errors: clients.res?.body?.errors || null, firstClient: clients.first };

      let clientId = clients.first?.id || null;
      if (!clientId) {
        const created = await createClient(page);
        out.clientCreate = { status: created.res.status, errors: created.res?.body?.errors || null, created: created.created };
        clientId = created.created?.id || null;
      }

      out.clientId = clientId;
      report.createdClientId = clientId;

      if (clientId) {
        Object.assign(out, await probeSummaryOps(page, 'admin', clientId));
      } else {
        out.fatal = 'Unable to resolve clientId for admin summary probe';
        out.fatalScreenshot = await screenshot(page, 'admin', 'ai_summary_no_client_even_after_create');
      }
    } catch (err) {
      out.fatal = err && err.stack ? err.stack : String(err);
      try { out.fatalScreenshot = await screenshot(page, 'admin', 'ai_summary_fatal'); } catch {}
    } finally {
      out.finishedAt = new Date().toISOString();
      await context.close();
    }
    report.results.admin = out;
  }

  // Carer second, using admin client id when possible
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const out = { role: 'carer', startedAt: new Date().toISOString() };
    try {
      await login(page, 'carer');
      const clients = await getFirstClient(page);
      out.clientsQuery = { status: clients.res.status, errors: clients.res?.body?.errors || null, firstClient: clients.first };

      const clientId = report.createdClientId || clients.first?.id || null;
      out.clientId = clientId;

      const adminSummaryId = report?.results?.admin?.summaryId || null;

      if (clientId) {
        Object.assign(out, await probeSummaryOps(page, 'carer', clientId, adminSummaryId));
      } else {
        out.fatal = 'Unable to resolve clientId for carer summary probe';
        out.fatalScreenshot = await screenshot(page, 'carer', 'ai_summary_no_client');
      }
    } catch (err) {
      out.fatal = err && err.stack ? err.stack : String(err);
      try { out.fatalScreenshot = await screenshot(page, 'carer', 'ai_summary_fatal'); } catch {}
    } finally {
      out.finishedAt = new Date().toISOString();
      await context.close();
    }
    report.results.carer = out;
  }

  await browser.close();

  report.results.adminEvaluation = evaluateRoleResult(report.results.admin);
  report.results.carerEvaluation = evaluateRoleResult(report.results.carer);

  const allChecks = [
    ...report.results.adminEvaluation.checks,
    ...report.results.carerEvaluation.checks,
  ];
  const adminMissingChecks = REQUIRED_ADMIN_CHECKS.filter(
    (name) => !report.results.adminEvaluation.checks.some((c) => c.name === name),
  );
  const carerMissingChecks = REQUIRED_CARER_CHECKS.filter(
    (name) => !report.results.carerEvaluation.checks.some((c) => c.name === name),
  );
  const expectedTotalChecks = REQUIRED_ADMIN_CHECKS.length + REQUIRED_CARER_CHECKS.length;
  const observedRoleChecks = allChecks.length;
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
  const combinedChecks = [...allChecks, ...gateChecks];

  report.gateChecks = gateChecks;
  report.totalChecks = combinedChecks.length;
  report.passedChecks = combinedChecks.filter((c) => c.pass).length;
  report.failedChecks = combinedChecks.filter((c) => !c.pass).length;
  report.expectedChecks = {
    admin: REQUIRED_ADMIN_CHECKS,
    carer: REQUIRED_CARER_CHECKS,
    total: expectedTotalChecks,
  };
  report.completeness = {
    roleFatalCount,
    adminMissingChecks,
    carerMissingChecks,
  };
  report.verdict = report.failedChecks === 0 ? 'PASS' : 'FAIL';

  const outJson = path.join(OUT_DIR, `${TS}_ai_summary_probe.json`);
  await fs.writeFile(outJson, JSON.stringify(report, null, 2));
  const result = {
    ok: report.verdict === 'PASS',
    outJson,
    createdClientId: report.createdClientId,
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
  console.error('AI_SUMMARY_PROBE_FAILED', err && err.stack ? err.stack : err);
  process.exit(1);
});
