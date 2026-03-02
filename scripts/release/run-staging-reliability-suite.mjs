import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const OUT_DIR = path.resolve('output/playwright/e2e-live');
const PROBES_DIR = path.resolve('scripts/release/probes');

const probes = [
  { name: 'strict_post_deploy_matrix', script: path.join(PROBES_DIR, 'strict_post_deploy_matrix.mjs') },
  { name: 'care_log_probe', script: path.join(PROBES_DIR, 'care_log_probe.mjs') },
  { name: 'ai_summary_probe', script: path.join(PROBES_DIR, 'ai_summary_probe.mjs') },
  { name: 'emar_provisioning_probe', script: path.join(PROBES_DIR, 'emar_provisioning_probe.mjs') },
];

function parseJsonFromStdout(stdout) {
  const trimmed = (stdout || '').trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const candidate = trimmed.slice(first, last + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
    return null;
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
        json: parseJsonFromStdout(stdout),
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
    const parsed = result.json || {};
    const hasStructuredVerdict = typeof parsed?.verdict === 'string';
    const verdict = hasStructuredVerdict ? parsed.verdict : 'FAIL';

    summary.probes.push({
      name: probe.name,
      script: probe.script,
      exitCode: result.exitCode,
      verdict,
      outJson: parsed.outJson || null,
      passed: parsed.passed ?? null,
      failed: parsed.failed ?? null,
      ok: result.exitCode === 0 && hasStructuredVerdict,
    });

    if (result.exitCode !== 0 || verdict !== 'PASS' || !hasStructuredVerdict) {
      summary.verdict = 'FAIL';
    }
  }

  const outPath = path.join(OUT_DIR, `${Date.now()}_reliability_suite.json`);
  await fs.writeFile(outPath, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({ ok: summary.verdict === 'PASS', outJson: outPath, verdict: summary.verdict }, null, 2));

  if (summary.verdict !== 'PASS') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('RELIABILITY_SUITE_FAILED', error && error.stack ? error.stack : String(error));
  process.exit(1);
});
