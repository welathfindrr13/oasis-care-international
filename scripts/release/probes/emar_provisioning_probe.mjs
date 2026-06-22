import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { getLiveProbeAccount, getLiveProbeBaseUrl } from './live-probe-env.mjs';

const BASE_URL = getLiveProbeBaseUrl();
const OUT_DIR = 'output/playwright/e2e-live';
const TS = Date.now();
const RESULT_PREFIX = 'PROBE_RESULT_JSON:';
const REQUIRED_CHECKS = ['clientLookup', 'createMedication', 'createPrescription', 'readBack'];

const ACCOUNT = getLiveProbeAccount('admin');

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function screenshot(page, label) {
  const file = path.join(OUT_DIR, `${TS}_admin_${label}.png`);
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

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });

  await page.locator('button:has-text("Sign in securely")').first().click({ timeout: 20000 });
  await page.waitForURL(/amazoncognito\.com/, { timeout: 60000 });

  const userInput = page.locator('input[name="username"], input#username, input[type="email"]').first();
  await userInput.waitFor({ state: 'visible', timeout: 30000 });
  await userInput.fill(ACCOUNT.email);

  await page.getByRole('button', { name: /next|continue|sign in|log in/i }).first().click({ timeout: 15000 });

  const passInput = page.locator('input[name="password"], input#password, input[type="password"]').first();
  await passInput.waitFor({ state: 'visible', timeout: 30000 });
  await passInput.fill(ACCOUNT.password);

  await page.getByRole('button', { name: /continue|sign in|log in|login/i }).first().click({ timeout: 15000 });
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

function hasErrors(res) {
  return Array.isArray(res?.body?.errors) && res.body.errors.length > 0;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const report = {
    generatedAt: nowIso(),
    baseUrl: BASE_URL,
    role: 'admin',
    checks: {},
    verdict: 'FAIL',
  };

  try {
    await login(page);
    await page.goto(`${BASE_URL}/emar`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    report.emarPageScreenshot = await screenshot(page, 'emar_page');

    const clientsRes = await gql(page, `
      query ClientsForProbe {
        clients(skip: 0, take: 1) {
          items { id fullName }
        }
      }
    `);
    const client = clientsRes?.body?.data?.clients?.items?.[0] || null;

    report.checks.clientLookup = {
      pass: clientsRes.status === 200 && !hasErrors(clientsRes) && Boolean(client?.id),
      actual: { status: clientsRes.status, errors: clientsRes?.body?.errors || null, client: client || null },
    };

    if (!client?.id) {
      throw new Error('No client available for eMAR probe');
    }

    const medicationName = `E2E_MED_${TS}`;
    const createMedicationRes = await gql(page, `
      mutation CreateMedication($input: CreateMedicationInput!) {
        createMedication(input: $input) { id name dosage unit }
      }
    `, {
      input: {
        name: medicationName,
        dosage: '10',
        unit: 'mg',
        instructions: 'Probe created medication',
      },
    });

    const medicationId = createMedicationRes?.body?.data?.createMedication?.id || null;
    report.checks.createMedication = {
      pass: createMedicationRes.status === 200 && !hasErrors(createMedicationRes) && Boolean(medicationId),
      actual: { status: createMedicationRes.status, errors: createMedicationRes?.body?.errors || null, medicationId },
    };

    if (!medicationId) {
      throw new Error('Medication creation failed');
    }

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);

    const createPrescriptionRes = await gql(page, `
      mutation CreatePrescription($input: CreatePrescriptionInput!) {
        createPrescription(input: $input) {
          id
          clientId
          medicationId
          administrationTimes
        }
      }
    `, {
      input: {
        clientId: client.id,
        medicationId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        frequencyPerDay: 1,
        administrationTimes: ['08:00'],
        specialInstructions: 'Probe prescription',
        isActive: true,
      },
    });

    const prescriptionId = createPrescriptionRes?.body?.data?.createPrescription?.id || null;
    report.checks.createPrescription = {
      pass:
        createPrescriptionRes.status === 200 &&
        !hasErrors(createPrescriptionRes) &&
        Boolean(prescriptionId),
      actual: { status: createPrescriptionRes.status, errors: createPrescriptionRes?.body?.errors || null, prescriptionId },
    };

    const dueMedsRes = await gql(page, `
      query TodaysMeds($date: String!) {
        getTodaysMedicationsByClient(date: $date) {
          id
          status
          scheduledTime
          prescription {
            client { id fullName }
            medication { id name }
          }
        }
      }
    `, { date: todayIsoDate() });

    const meds = dueMedsRes?.body?.data?.getTodaysMedicationsByClient || [];
    const found = meds.find(
      (row) => row?.prescription?.medication?.id === medicationId && row?.prescription?.client?.id === client.id,
    );
    report.checks.readBack = {
      pass: dueMedsRes.status === 200 && !hasErrors(dueMedsRes) && Boolean(found),
      actual: {
        status: dueMedsRes.status,
        errors: dueMedsRes?.body?.errors || null,
        total: meds.length,
        found: found || null,
      },
    };
    report.finalScreenshot = await screenshot(page, 'emar_probe_final');
  } catch (err) {
    report.fatal = err && err.stack ? err.stack : String(err);
    try {
      report.fatalScreenshot = await screenshot(page, 'emar_probe_fatal');
    } catch {}
  } finally {
    await context.close();
    await browser.close();
  }

  const checks = Object.values(report.checks || {});
  const missingChecks = REQUIRED_CHECKS.filter((name) => !report.checks?.[name]);
  const passed = checks.filter((c) => c?.pass).length;
  const failed = checks.filter((c) => !c?.pass).length;
  const gateChecks = [
    { name: 'noFatal', pass: !report.fatal, actual: report.fatal || null },
    {
      name: 'expectedCheckCount',
      pass: checks.length === REQUIRED_CHECKS.length,
      actual: { observed: checks.length, expected: REQUIRED_CHECKS.length },
    },
    { name: 'noMissingChecks', pass: missingChecks.length === 0, actual: { missingChecks } },
  ];
  const combinedChecks = [...checks, ...gateChecks];
  report.summary = { total: checks.length, passed, failed };
  report.gateChecks = gateChecks;
  report.totalChecks = combinedChecks.length;
  report.passedChecks = combinedChecks.filter((c) => c?.pass).length;
  report.failedChecks = combinedChecks.filter((c) => !c?.pass).length;
  report.expectedChecks = REQUIRED_CHECKS;
  report.missingChecks = missingChecks;
  report.verdict = report.failedChecks === 0 ? 'PASS' : 'FAIL';

  const outJson = path.join(OUT_DIR, `${TS}_emar_provisioning_probe.json`);
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
  console.error('EMAR_PROVISIONING_PROBE_FAILED', err && err.stack ? err.stack : err);
  process.exit(1);
});
