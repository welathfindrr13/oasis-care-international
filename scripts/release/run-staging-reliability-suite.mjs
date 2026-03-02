import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const OUT_DIR = path.resolve('output/playwright/e2e-live');
const PROBES_DIR = path.resolve('scripts/release/probes');
const RESULT_PREFIX = 'PROBE_RESULT_JSON:';

const probes = [
  { name: 'strict_post_deploy_matrix', script: path.join(PROBES_DIR, 'strict_post_deploy_matrix.mjs') },
  { name: 'care_log_probe', script: path.join(PROBES_DIR, 'care_log_probe.mjs') },
  { name: 'ai_summary_probe', script: path.join(PROBES_DIR, 'ai_summary_probe.mjs') },
  { name: 'emar_provisioning_probe', script: path.join(PROBES_DIR, 'emar_provisioning_probe.mjs') },
];

function parseProbeResult(stdout) {
  const lines = String(stdout || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith(RESULT_PREFIX)) continue;
    const jsonPart = line.slice(RESULT_PREFIX.length).trim();
    try {
      return JSON.parse(jsonPart);
    } catch {
      return null;
    }
  }
  return null;
}

function validateProbeSummaryShape(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'Missing probe summary JSON' };
  if (typeof parsed.verdict !== 'string') return { ok: false, reason: 'Probe summary missing verdict' };
  if (!parsed.outJson || typeof parsed.outJson !== 'string') return { ok: false, reason: 'Probe summary missing outJson path' };
  if (typeof parsed.passed !== 'number' || typeof parsed.failed !== 'number') {
    return { ok: false, reason: 'Probe summary missing numeric passed/failed' };
  }
  if (typeof parsed.total !== 'number') return { ok: false, reason: 'Probe summary missing numeric total' };
  if (parsed.total !== parsed.passed + parsed.failed) {
    return { ok: false, reason: 'Probe summary total does not match passed+failed' };
  }
  return { ok: true };
}

async function validateProbeArtifact(parsed) {
  try {
    const raw = await fs.readFile(path.resolve(parsed.outJson), 'utf8');
    const artifact = JSON.parse(raw);
    if (artifact?.verdict !== parsed.verdict) {
      return { ok: false, reason: 'Artifact verdict mismatch with stdout verdict' };
    }
    if (typeof artifact?.totalChecks !== 'number') {
      return { ok: false, reason: 'Artifact missing totalChecks' };
    }
    if (typeof artifact?.passedChecks !== 'number' || typeof artifact?.failedChecks !== 'number') {
      return { ok: false, reason: 'Artifact missing passedChecks/failedChecks' };
    }
    if (artifact.totalChecks !== artifact.passedChecks + artifact.failedChecks) {
      return { ok: false, reason: 'Artifact check totals are inconsistent' };
    }
    if (artifact.totalChecks <= 0) {
      return { ok: false, reason: 'Artifact has zero totalChecks' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Artifact unreadable or invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function runNodeScript(scriptPath) {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        json: parseProbeResult(stdout),
      });
    });
  });
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const probe of probes) {
    await fs.access(probe.script);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    probes: [],
    verdict: 'PASS',
  };

  for (const probe of probes) {
    const result = await runNodeScript(path.resolve(probe.script));
    const parsed = result.json || null;
    const shape = validateProbeSummaryShape(parsed);
    const verdict = shape.ok ? parsed.verdict : 'FAIL';
    const artifact = shape.ok ? await validateProbeArtifact(parsed) : { ok: false, reason: 'Skipped artifact validation (invalid summary)' };
    const failureReasons = [];
    if (result.exitCode !== 0) failureReasons.push(`Probe exited with code ${result.exitCode}`);
    if (!shape.ok) failureReasons.push(shape.reason);
    if (verdict !== 'PASS') failureReasons.push(`Probe verdict is ${verdict}`);
    if (!artifact.ok) failureReasons.push(artifact.reason);

    summary.probes.push({
      name: probe.name,
      script: probe.script,
      exitCode: result.exitCode,
      verdict,
      outJson: parsed?.outJson || null,
      total: parsed?.total ?? null,
      passed: parsed?.passed ?? null,
      failed: parsed?.failed ?? null,
      ok: failureReasons.length === 0,
      failureReasons,
    });

    if (failureReasons.length > 0) {
      summary.verdict = 'FAIL';
    }
  }

  const outPath = path.join(OUT_DIR, `${Date.now()}_reliability_suite.json`);
  await fs.writeFile(outPath, JSON.stringify(summary, null, 2));

  console.log(`${RESULT_PREFIX}${JSON.stringify({ ok: summary.verdict === 'PASS', outJson: outPath, verdict: summary.verdict })}`);

  if (summary.verdict !== 'PASS') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('RELIABILITY_SUITE_FAILED', error && error.stack ? error.stack : String(error));
  process.exit(1);
});
