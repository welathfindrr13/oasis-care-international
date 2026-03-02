import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const BASE_URL = 'https://app.oasis-care.co';
const OUT_DIR = 'output/playwright/e2e-live';
const TS = Date.now();
const RESULT_PREFIX = 'PROBE_RESULT_JSON:';
const REQUIRED_ROLE_CHECKS = ['pageRender', 'createCareLog', 'readBack', 'monthlySummary'];

const ACCOUNTS = {
  admin: { email: 'boss@yourdomain.com', password: 'SecurePassword123!1' },
  carer: { email: 'carer-demo@yourdomain.com', password: 'SecurePassword123!2' },
};

function nowIso() {
  return new Date().toISOString();
}

function monthBoundsUtc(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth() + 1,
    from: start.toISOString(),
    to: new Date(end.getTime() - 1).toISOString(),
  };
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
  for (let i = 0; i < 80; i += 1) {
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
  return page.evaluate(async ({ query, variables }) => {
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

async function getClients(page, take = 10) {
  const query = `query Clients($take: Int, $skip: Int) {
    clients(take: $take, skip: $skip) {
      items { id fullName }
      total
    }
  }`;
  return gql(page, query, { take, skip: 0 });
}

async function resolveCarerIdByEmail(page, email) {
  const query = `query Carers { carers { id email } }`;
  const res = await gql(page, query, {});
  const carers = res?.body?.data?.carers || [];
  const match = carers.find((c) => String(c.email || '').toLowerCase() === String(email).toLowerCase());
  return {
    status: res.status,
    errors: res?.body?.errors || null,
    carerId: match?.id || null,
    total: carers.length,
  };
}

async function createVisitAssignment(page, clientId, carerId) {
  const mutation = `mutation CreateVisit($input: CreateVisitInput!) {
    createVisit(input: $input) {
      id
      clientId
      carerId
      scheduledStart
      scheduledEnd
      status
    }
  }`;

  const attempts = [];
  for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + dayOffset);
    start.setUTCHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const variables = {
      input: {
        clientId,
        carerId,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        notes: `E2E care log assignment ${Date.now()}`,
      },
    };

    const res = await gql(page, mutation, variables);
    const errors = res?.body?.errors || null;
    const created = res?.body?.data?.createVisit || null;
    attempts.push({ dayOffset, status: res.status, errors, created });

    if (created?.id && !errors?.length && res.status === 200) {
      return { ok: true, created, attempts };
    }
  }

  return { ok: false, created: null, attempts };
}

async function ensureCarerAssignment(browser, clientId) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const out = { ok: false, clientId, carerEmail: ACCOUNTS.carer.email };

  try {
    await login(page, 'admin');
    const carerLookup = await resolveCarerIdByEmail(page, ACCOUNTS.carer.email);
    out.carerLookup = carerLookup;

    if (!carerLookup.carerId) {
      return out;
    }

    const assignment = await createVisitAssignment(page, clientId, carerLookup.carerId);
    out.assignment = assignment;
    out.ok = assignment.ok;
    return out;
  } finally {
    await context.close();
  }
}

async function createCareLog(page, clientId, role) {
  const marker = `E2E_CARE_LOG_${role}_${Date.now()}`;
  const occurredAt = new Date(Date.now() - 60_000).toISOString();

  const mutation = `mutation CreateCareLog($input: CreateCareLogInput!) {
    createCareLog(input: $input) {
      id
      clientId
      category
      occurredAt
      notes
    }
  }`;

  const variables = {
    input: {
      clientId,
      occurredAt,
      category: 'MOOD',
      notes: marker,
      moodLevel: 'GOOD',
      agitation: false,
      confusion: false,
      escalated: false,
      source: 'playwright-care-log-probe',
    },
  };

  const res = await gql(page, mutation, variables);
  return {
    marker,
    res,
    created: res?.body?.data?.createCareLog || null,
    errors: res?.body?.errors || null,
  };
}

async function verifyCareLogs(page, clientId, marker, bounds) {
  const query = `query CareLogs($clientId: ID, $occurredFrom: String, $occurredTo: String, $skip: Int, $take: Int) {
    careLogs(clientId: $clientId, occurredFrom: $occurredFrom, occurredTo: $occurredTo, skip: $skip, take: $take) {
      total
      items { id category occurredAt notes }
    }
  }`;

  const res = await gql(page, query, {
    clientId,
    occurredFrom: bounds.from,
    occurredTo: bounds.to,
    skip: 0,
    take: 100,
  });

  const items = res?.body?.data?.careLogs?.items || [];
  const match = items.find((i) => String(i?.notes || '').includes(marker));

  return {
    res,
    total: res?.body?.data?.careLogs?.total ?? null,
    foundMarker: Boolean(match),
    foundItem: match || null,
  };
}

async function verifyMonthlySummary(page, clientId, bounds, markerPresent) {
  const query = `query MonthlyCareSummary($clientId: ID!, $year: Int!, $month: Int!) {
    monthlyCareSummary(clientId: $clientId, year: $year, month: $month) {
      monthStart
      monthEnd
      totalCareLogs
      byCategory { category count }
      medication { total scheduled administered missed refused cancelled }
      highlights
    }
  }`;

  const res = await gql(page, query, {
    clientId,
    year: bounds.year,
    month: bounds.month,
  });

  const summary = res?.body?.data?.monthlyCareSummary || null;
  const moodCount = summary?.byCategory?.find((x) => x.category === 'MOOD')?.count ?? 0;

  return {
    res,
    summary,
    moodCount,
    markerConsistent: markerPresent ? moodCount > 0 : true,
  };
}

async function probeRole(browser, role, preferredClientId = null) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const bounds = monthBoundsUtc();

  const out = {
    role,
    startedAt: nowIso(),
    checks: {},
    verdict: 'FAIL',
  };

  try {
    await login(page, role);

    const clientsRes = await getClients(page, role === 'admin' ? 10 : 25);
    const clients = clientsRes?.body?.data?.clients?.items || [];
    const orderedClients = preferredClientId
      ? [
        ...clients.filter((c) => c.id === preferredClientId),
        ...clients.filter((c) => c.id !== preferredClientId),
      ]
      : clients;
    out.clients = {
      status: clientsRes.status,
      errors: clientsRes?.body?.errors || null,
      count: clients.length,
      firstFive: clients.slice(0, 5),
    };

    let chosenClientId = null;
    let chosenClientName = null;
    let createAttempt = null;

    for (const client of orderedClients) {
      const attempt = await createCareLog(page, client.id, role);
      createAttempt = { ...attempt, clientId: client.id, clientName: client.fullName };

      if (attempt.created?.id && !attempt.errors?.length && attempt.res.status === 200) {
        chosenClientId = client.id;
        chosenClientName = client.fullName;
        break;
      }
    }

    out.createCareLog = createAttempt;

    if (!chosenClientId) {
      out.checks.createCareLog = {
        pass: false,
        expected: 'At least one accessible client allows createCareLog',
        actual: {
          clientsTried: orderedClients.length,
          lastStatus: createAttempt?.res?.status ?? null,
          lastErrors: createAttempt?.errors || null,
        },
      };

      out.careLogsPage = {
        skipped: true,
        reason: 'No successful createCareLog target client',
      };

      out.finalScreenshot = await screenshot(page, role, 'care_log_probe_no_accessible_client');
      return out;
    }

    out.targetClient = { id: chosenClientId, fullName: chosenClientName };

    await page.goto(`${BASE_URL}/clients/${chosenClientId}/care-logs`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const hasHeading = await safeVisible(page.locator('h1:has-text("Care Logs")'));
    const hasAddSection = await safeVisible(page.locator('h2:has-text("Add Care Log Entry")'));
    const hasMonthlyCard = await safeVisible(page.getByText('Care logs this month', { exact: false }));

    out.careLogsPage = {
      url: page.url(),
      hasHeading,
      hasAddSection,
      hasMonthlyCard,
      screenshot: await screenshot(page, role, 'care_logs_page'),
    };

    const marker = createAttempt.marker;
    const logsCheck = await verifyCareLogs(page, chosenClientId, marker, bounds);
    const monthlyCheck = await verifyMonthlySummary(page, chosenClientId, bounds, logsCheck.foundMarker);

    out.careLogsQuery = {
      status: logsCheck.res.status,
      errors: logsCheck.res?.body?.errors || null,
      total: logsCheck.total,
      foundMarker: logsCheck.foundMarker,
      foundItem: logsCheck.foundItem,
    };

    out.monthlySummary = {
      status: monthlyCheck.res.status,
      errors: monthlyCheck.res?.body?.errors || null,
      totalCareLogs: monthlyCheck.summary?.totalCareLogs ?? null,
      moodCount: monthlyCheck.moodCount,
      monthStart: monthlyCheck.summary?.monthStart ?? null,
      monthEnd: monthlyCheck.summary?.monthEnd ?? null,
      medication: monthlyCheck.summary?.medication ?? null,
      highlights: monthlyCheck.summary?.highlights ?? null,
    };

    out.checks.pageRender = {
      pass: hasHeading && (hasMonthlyCard || hasAddSection),
      expected: 'Care Logs page renders summary content',
      actual: { hasHeading, hasMonthlyCard, hasAddSection },
    };

    out.checks.createCareLog = {
      pass: Boolean(createAttempt.created?.id) && createAttempt.res.status === 200 && !(createAttempt.errors?.length),
      expected: 'createCareLog mutation succeeds',
      actual: {
        status: createAttempt.res.status,
        id: createAttempt.created?.id ?? null,
        errors: createAttempt.errors || null,
      },
    };

    out.checks.readBack = {
      pass: logsCheck.res.status === 200 && !(logsCheck.res?.body?.errors?.length) && logsCheck.foundMarker,
      expected: 'careLogs query includes the newly created entry',
      actual: {
        status: logsCheck.res.status,
        errors: logsCheck.res?.body?.errors || null,
        foundMarker: logsCheck.foundMarker,
        total: logsCheck.total,
      },
    };

    out.checks.monthlySummary = {
      pass:
        monthlyCheck.res.status === 200 &&
        !(monthlyCheck.res?.body?.errors?.length) &&
        monthlyCheck.summary &&
        Number.isInteger(monthlyCheck.summary.totalCareLogs) &&
        monthlyCheck.markerConsistent,
      expected: 'monthlyCareSummary returns valid rollup aligned with created mood log',
      actual: {
        status: monthlyCheck.res.status,
        errors: monthlyCheck.res?.body?.errors || null,
        totalCareLogs: monthlyCheck.summary?.totalCareLogs ?? null,
        moodCount: monthlyCheck.moodCount,
      },
    };

    out.finalScreenshot = await screenshot(page, role, 'care_log_probe_final');
  } catch (err) {
    out.fatal = err && err.stack ? err.stack : String(err);
    try {
      out.fatalScreenshot = await screenshot(page, role, 'care_log_probe_fatal');
    } catch {}
  } finally {
    const checks = Object.values(out.checks || {});
    const missingChecks = REQUIRED_ROLE_CHECKS.filter((name) => !out.checks?.[name]);
    const passed = checks.filter((c) => c?.pass).length;
    const failed = checks.filter((c) => !c?.pass).length;
    out.summary = { total: checks.length, passed, failed };
    out.expectedCheckCount = REQUIRED_ROLE_CHECKS.length;
    out.missingChecks = missingChecks;
    out.verdict =
      failed === 0 &&
      !out.fatal &&
      checks.length === REQUIRED_ROLE_CHECKS.length &&
      missingChecks.length === 0
        ? 'PASS'
        : 'FAIL';
    out.finishedAt = nowIso();
    await context.close();
  }

  return out;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const report = {
    generatedAt: nowIso(),
    baseUrl: BASE_URL,
    month: monthBoundsUtc(),
    results: {},
    verdict: 'PENDING',
  };

  const browser = await chromium.launch({ headless: true });
  try {
    report.results.admin = await probeRole(browser, 'admin');
    const adminClientId = report.results.admin?.targetClient?.id || null;
    report.assignmentSetup = adminClientId ? await ensureCarerAssignment(browser, adminClientId) : { ok: false, reason: 'No admin target client id' };
    report.results.carer = await probeRole(browser, 'carer', adminClientId);
  } finally {
    await browser.close();
  }

  const allChecks = [
    ...Object.values(report.results.admin?.checks || {}),
    ...Object.values(report.results.carer?.checks || {}),
  ];
  const expectedChecksPerRole = REQUIRED_ROLE_CHECKS.length;
  const expectedTotalChecks = expectedChecksPerRole * 2;
  const observedRoleChecks = allChecks.length;
  const roleFatalCount = [report.results.admin, report.results.carer].filter((r) => Boolean(r?.fatal)).length;
  const adminMissingChecks = REQUIRED_ROLE_CHECKS.filter((name) => !report.results.admin?.checks?.[name]);
  const carerMissingChecks = REQUIRED_ROLE_CHECKS.filter((name) => !report.results.carer?.checks?.[name]);
  const assignmentPassed = Boolean(report.assignmentSetup?.ok);
  const carerWriteValidated = Boolean(report.results.carer?.checks?.createCareLog?.pass);
  const assignmentGatePass = assignmentPassed || carerWriteValidated;

  const gateChecks = [
    { name: 'noRoleFatal', pass: roleFatalCount === 0, actual: { roleFatalCount } },
    {
      name: 'expectedCheckCount',
      pass: observedRoleChecks === expectedTotalChecks,
      actual: { observed: observedRoleChecks, expected: expectedTotalChecks },
    },
    { name: 'adminNoMissingChecks', pass: adminMissingChecks.length === 0, actual: { adminMissingChecks } },
    { name: 'carerNoMissingChecks', pass: carerMissingChecks.length === 0, actual: { carerMissingChecks } },
    {
      name: 'assignmentSetup',
      pass: assignmentGatePass,
      actual: {
        assignmentPassed,
        carerWriteValidated,
        assignmentSetup: report.assignmentSetup || null,
      },
    },
  ];

  const combinedChecks = [...allChecks, ...gateChecks];
  report.gateChecks = gateChecks;
  report.totalChecks = combinedChecks.length;
  report.passedChecks = combinedChecks.filter((c) => c?.pass).length;
  report.failedChecks = combinedChecks.filter((c) => !c?.pass).length;
  report.expectedChecks = {
    perRole: expectedChecksPerRole,
    total: expectedTotalChecks,
  };
  report.completeness = {
    roleFatalCount,
    adminMissingChecks,
    carerMissingChecks,
    assignmentPassed,
    carerWriteValidated,
    assignmentGatePass,
  };
  report.verdict = report.failedChecks === 0 ? 'PASS' : 'FAIL';

  const outJson = path.join(OUT_DIR, `${TS}_care_log_probe.json`);
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
  console.error('CARE_LOG_PROBE_FAILED', err && err.stack ? err.stack : err);
  process.exit(1);
});
