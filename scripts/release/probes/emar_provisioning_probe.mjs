import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';
import { getLiveProbeAccount, getLiveProbeBaseUrl } from './live-probe-env.mjs';
import { loginLiveProbeAccount } from './live-probe-login.mjs';

const BASE_URL = getLiveProbeBaseUrl();
const OUT_DIR = 'output/playwright/e2e-live';
const TS = Date.now();
const RESULT_PREFIX = 'PROBE_RESULT_JSON:';
const REQUIRED_CHECKS = ['emarRouteExcluded', 'medicationRouteExcluded', 'createMedicationExcluded', 'createPrescriptionExcluded', 'readExcluded'];

const ACCOUNT = getLiveProbeAccount('admin');

function nowIso() {
  return new Date().toISOString();
}

async function screenshot(page, label) {
  const file = path.join(OUT_DIR, `${TS}_admin_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
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

function isFeatureNotEnabled(res, field) {
  return res?.status === 200 &&
    res?.body?.data?.[field] === null &&
    res?.body?.errors?.[0]?.extensions?.code === 'FEATURE_NOT_ENABLED';
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
    await loginLiveProbeAccount(page, {
      baseUrl: BASE_URL,
      account: ACCOUNT,
      localRole: 'admin',
    });
    await page.goto(`${BASE_URL}/emar`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForURL(/\/access\/feature-not-enabled$/, { timeout: 30000 });
    report.emarPageScreenshot = await screenshot(page, 'emar_page');
    report.checks.emarRouteExcluded = {
      pass: new URL(page.url()).pathname === '/access/feature-not-enabled',
      actual: { currentUrl: page.url() },
    };

    await page.goto(`${BASE_URL}/medication`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForURL(/\/access\/feature-not-enabled$/, { timeout: 30000 });
    report.checks.medicationRouteExcluded = {
      pass: new URL(page.url()).pathname === '/access/feature-not-enabled',
      actual: { currentUrl: page.url() },
    };

    const createMedicationRes = await gql(page, `
      mutation CreateMedication($input: CreateMedicationInput!) {
        createMedication(input: $input) { id name dosage unit }
      }
    `, {
      input: {
        name: '',
        dosage: '',
        unit: '',
      },
    });

    const medicationId = createMedicationRes?.body?.data?.createMedication?.id || null;
    report.checks.createMedicationExcluded = {
      pass: isFeatureNotEnabled(createMedicationRes, 'createMedication') && medicationId === null,
      actual: { status: createMedicationRes.status, errors: createMedicationRes?.body?.errors || null, medicationId },
    };

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
        clientId: '00000000-0000-4000-8000-000000000001',
        medicationId: '00000000-0000-4000-8000-000000000002',
        startDate: 'not-a-date',
        endDate: 'not-a-date',
        frequencyPerDay: 0,
        administrationTimes: [],
        isActive: true,
      },
    });

    const prescriptionId = createPrescriptionRes?.body?.data?.createPrescription?.id || null;
    report.checks.createPrescriptionExcluded = {
      pass: isFeatureNotEnabled(createPrescriptionRes, 'createPrescription') && prescriptionId === null,
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
    `, { date: 'not-a-date' });

    report.checks.readExcluded = {
      pass: isFeatureNotEnabled(dueMedsRes, 'getTodaysMedicationsByClient'),
      actual: {
        status: dueMedsRes.status,
        errors: dueMedsRes?.body?.errors || null,
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

  const outJson = path.join(OUT_DIR, `${TS}_medication_exclusion_probe.json`);
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
  console.error('MEDICATION_EXCLUSION_PROBE_FAILED', err && err.stack ? err.stack : err);
  process.exit(1);
});
