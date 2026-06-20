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
