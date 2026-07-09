import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./deploy-vps.yml', import.meta.url), 'utf8');

test('VPS deploy workflow shares the staging mutation concurrency group', () => {
  assert.match(workflow, /concurrency:\s*\n\s*group: staging-vps-mutation\s*\n\s*cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /group: deploy-vps/);
});

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

test('VPS deploy workflow proves staging target before git sync and compose', () => {
  const markerIndex = workflow.indexOf('/etc/oasis/deploy-target-class');
  const stagingIndex = workflow.indexOf('DEPLOY_TARGET_STAGING');
  const gitFetchIndex = workflow.indexOf('git fetch origin main');
  const composeUpIndex = workflow.indexOf('docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up');

  assert.notEqual(markerIndex, -1);
  assert.notEqual(stagingIndex, -1);
  assert.notEqual(gitFetchIndex, -1);
  assert.notEqual(composeUpIndex, -1);
  assert(markerIndex < gitFetchIndex, 'target marker must be checked before git fetch');
  assert(stagingIndex < gitFetchIndex, 'staging target proof must happen before git fetch');
  assert(markerIndex < composeUpIndex, 'target marker must be checked before compose up');
});

test('VPS deploy workflow fails closed unless target marker is staging', () => {
  assert.match(workflow, /target_class="\$\(tr -d '\\r\\n' < \/etc\/oasis\/deploy-target-class 2>\/dev\/null \|\| true\)"/);
  assert.match(workflow, /if \[ "\$target_class" = "staging" \]; then/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_STAGING\\n'/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_UNKNOWN\\n' >&2/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_NOT_STAGING\\n' >&2/);
  assert.match(workflow, /exit 1/);
  assert.doesNotMatch(workflow, /printf .*target_class|echo .*target_class|cat \/etc\/oasis\/deploy-target-class/);
});

test('VPS deploy workflow requires no-migration preflight before compose up', () => {
  const preflightIndex = workflow.indexOf('node deploy/v2/scripts/preflight-env.mjs deploy/v2/.env');
  const composeUpIndex = workflow.indexOf('docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up');

  assert.notEqual(preflightIndex, -1);
  assert.notEqual(composeUpIndex, -1);
  assert(preflightIndex < composeUpIndex, 'no-migration preflight must run before compose up');
  assert.match(workflow, /preflight-env\.mjs deploy\/v2\/\.env/);
  assert.doesNotMatch(workflow, /prisma migrate|migrate deploy|run-migration|backfill/i);
});

test('VPS deploy workflow exports safe live revision proof before compose up', () => {
  const commitIndex = workflow.indexOf('APP_COMMIT_SHA="$(git rev-parse HEAD)"');
  const versionIndex = workflow.indexOf('APP_VERSION="$(git rev-parse --short HEAD)"');
  const exportIndex = workflow.indexOf('export APP_COMMIT_SHA APP_VERSION');
  const composeUpIndex = workflow.indexOf('docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml up');

  assert.notEqual(commitIndex, -1);
  assert.notEqual(versionIndex, -1);
  assert.notEqual(exportIndex, -1);
  assert.notEqual(composeUpIndex, -1);
  assert(commitIndex < exportIndex);
  assert(versionIndex < exportIndex);
  assert(exportIndex < composeUpIndex);
  assert.doesNotMatch(workflow, /APP_COMMIT_SHA=.*DATABASE_URL|APP_VERSION=.*DATABASE_URL/);
});

test('VPS deploy workflow forces compose migrations disabled for the deploy command', () => {
  assert.match(
    workflow,
    /RUN_MIGRATIONS=false docker compose --env-file deploy\/v2\/\.env -f deploy\/v2\/docker-compose\.yml up -d --build --wait --wait-timeout \d+/,
  );
  assert.doesNotMatch(
    workflow,
    /(?<!RUN_MIGRATIONS=false )docker compose --env-file deploy\/v2\/\.env -f deploy\/v2\/docker-compose\.yml up -d --build --wait/,
  );
});

test('VPS deploy workflow does not trigger tenant dry-run or print env contents', () => {
  assert.doesNotMatch(workflow, /tenant-nullability-dry-run\.yml|gh workflow run|workflow_dispatch.*Tenant Nullability/is);
  assert.doesNotMatch(workflow, /cat deploy\/v2\/\.env|grep .*DATABASE_URL|printenv|env \|/);
});

test('VPS deploy workflow waits for compose health before public probes', () => {
  assert.match(workflow, /up -d --build --wait --wait-timeout \d+/);
});

test('VPS deploy workflow retries public HTTPS probes during startup', () => {
  assert.match(workflow, /probe_public_endpoint\(\)/);
  assert.match(workflow, /for attempt in \{1\.\.30\}/);
  assert.match(workflow, /sleep 5/);
});
