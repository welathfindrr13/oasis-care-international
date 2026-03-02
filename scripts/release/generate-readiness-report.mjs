import fs from 'fs/promises';
import path from 'path';

const SOURCE_DIR = path.resolve('output/playwright/e2e-live');
const DEST_DIR = path.resolve('_reports');
const DAYS = Number(process.env.READINESS_WINDOW_DAYS || '7');
const WINDOW_MS = DAYS * 24 * 60 * 60 * 1000;

async function getJsonFiles() {
  try {
    const names = await fs.readdir(SOURCE_DIR);
    return names
      .filter((name) => name.endsWith('.json'))
      .map((name) => path.join(SOURCE_DIR, name));
  } catch {
    return [];
  }
}

function parseTsFromName(filePath) {
  const base = path.basename(filePath);
  const match = base.match(/^(\d+)_/);
  return match ? Number(match[1]) : 0;
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function statusIcon(pass) {
  return pass ? 'PASS' : 'FAIL';
}

function isValidProbeArtifact(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.verdict !== 'string') return false;
  if (typeof data.totalChecks !== 'number') return false;
  if (typeof data.passedChecks !== 'number') return false;
  if (typeof data.failedChecks !== 'number') return false;
  if (data.totalChecks <= 0) return false;
  return data.totalChecks === data.passedChecks + data.failedChecks;
}

async function findLatestBySuffix(files, suffix) {
  const now = Date.now();
  const candidates = files
    .filter((file) => file.endsWith(suffix))
    .map((file) => ({ file, ts: parseTsFromName(file) }))
    .filter((entry) => entry.ts > 0 && now - entry.ts <= WINDOW_MS)
    .sort((a, b) => b.ts - a.ts);

  if (candidates.length === 0) return null;
  return candidates[0].file;
}

async function main() {
  await fs.mkdir(DEST_DIR, { recursive: true });
  const files = await getJsonFiles();

  const latestStrict = await findLatestBySuffix(files, '_strict_post_deploy_matrix.json');
  const latestCare = await findLatestBySuffix(files, '_care_log_probe.json');
  const latestAi = await findLatestBySuffix(files, '_ai_summary_probe.json');
  const latestEmar = await findLatestBySuffix(files, '_emar_provisioning_probe.json');
  const latestSuite = await findLatestBySuffix(files, '_reliability_suite.json');

  const strictData = latestStrict ? await loadJson(latestStrict) : null;
  const careData = latestCare ? await loadJson(latestCare) : null;
  const aiData = latestAi ? await loadJson(latestAi) : null;
  const emarData = latestEmar ? await loadJson(latestEmar) : null;
  const suiteData = latestSuite ? await loadJson(latestSuite) : null;

  const strictPass = isValidProbeArtifact(strictData) && strictData?.verdict === 'PASS';
  const carePass = isValidProbeArtifact(careData) && careData?.verdict === 'PASS';
  const aiPass = isValidProbeArtifact(aiData) && aiData?.verdict === 'PASS';
  const emarPass = isValidProbeArtifact(emarData) && emarData?.verdict === 'PASS';
  const suitePass = suiteData?.verdict === 'PASS';

  const finalPass = strictPass && carePass && aiPass && emarPass && suitePass;
  const generatedAt = new Date().toISOString();
  const outPath = path.join(DEST_DIR, `${Date.now()}_production_readiness.md`);

  const lines = [
    '# Oasis Care Production Readiness Report',
    '',
    `Generated at: ${generatedAt}`,
    `Window: last ${DAYS} day(s)`,
    '',
    '## Latest Evidence',
    '',
    `- Strict matrix: ${statusIcon(strictPass)} (${latestStrict || 'missing'})`,
    `- Care log probe: ${statusIcon(carePass)} (${latestCare || 'missing'})`,
    `- AI summary probe: ${statusIcon(aiPass)} (${latestAi || 'missing'})`,
    aiData ? `  - checks: ${aiData.passedChecks ?? 0}/${aiData.totalChecks ?? 0}` : '',
    `- eMAR provisioning probe: ${statusIcon(emarPass)} (${latestEmar || 'missing'})`,
    `- Reliability suite: ${statusIcon(suitePass)} (${latestSuite || 'missing'})`,
    '',
    '## Gate Decision',
    '',
    `- Go/No-Go: ${finalPass ? 'GO (quality gate passed for latest evidence set)' : 'NO-GO (at least one gate failed or missing)'}`,
    '',
    '## Notes',
    '',
    '- This report does not replace the 7-day soak policy; it summarizes latest evidence within the selected window.',
    '- Confirm no open P1/P2 and uptime SLO from monitoring before production release.',
    '',
  ];

  await fs.writeFile(outPath, lines.join('\n'));
  console.log(JSON.stringify({ ok: finalPass, outPath, finalPass }, null, 2));

  if (!finalPass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('READINESS_REPORT_FAILED', error && error.stack ? error.stack : String(error));
  process.exit(1);
});
