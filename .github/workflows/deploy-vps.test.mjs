import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./deploy-vps.yml', import.meta.url), 'utf8');

test('VPS deploy workflow is manually triggered and uses GitHub secrets for SSH', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /OASIS_VPS_SSH_KEY/);
  assert.match(workflow, /OASIS_VPS_HOST/);
  assert.match(workflow, /OASIS_VPS_USER/);
});

test('VPS deploy workflow deploys with the Deployment V2 env file without printing it', () => {
  assert.match(workflow, /docker compose --env-file deploy\/v2\/\.env/);
  assert.doesNotMatch(workflow, /cat deploy\/v2\/\.env/);
  assert.doesNotMatch(workflow, /printenv/);
});

test('VPS deploy workflow runs env preflight against the real env file before compose up', () => {
  const preflightIndex = workflow.indexOf('node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env');
  const composeUpIndex = workflow.indexOf('docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up');

  assert.notEqual(preflightIndex, -1);
  assert.notEqual(composeUpIndex, -1);
  assert(preflightIndex < composeUpIndex, 'preflight must run before compose up');
});

test('VPS deploy workflow waits for compose health before public probes', () => {
  assert.match(workflow, /up -d --build --wait --wait-timeout \d+/);
});

test('VPS deploy workflow retries public HTTPS probes during startup', () => {
  assert.match(workflow, /probe_public_endpoint\(\)/);
  assert.match(workflow, /for attempt in \{1\.\.30\}/);
  assert.match(workflow, /sleep 5/);
});
