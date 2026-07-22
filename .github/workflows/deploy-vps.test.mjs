import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_UNKNOWN,
  REVISION_AWARE_EXACT,
  REVISION_UNSAFE,
  classifyRevisionPayloads,
  isCanonicalSha,
  normalizeBaseUrl,
  readyPayloadMatches,
  verifyRevision,
} from './revision-proof.mjs';
import {
  STATES,
  canTransition,
  prepareState,
  readState,
  transitionState,
  validateManifest,
  writeExportFile,
} from '../../deploy/v2/scripts/legacy-bootstrap-state.mjs';

const workflow = fs.readFileSync(new URL('./deploy-vps.yml', import.meta.url), 'utf8');
const stateScript = fileURLToPath(
  new URL('../../deploy/v2/scripts/legacy-bootstrap-state.mjs', import.meta.url),
);
const revisionScript = fileURLToPath(new URL('./revision-proof.mjs', import.meta.url));
const docs = fs.readFileSync(
  new URL('../../docs/deployment-v2/README.md', import.meta.url),
  'utf8',
);
const targetSha = 'a'.repeat(40);
const imageIds = {
  api: `sha256:${'a'.repeat(64)}`,
  web: `sha256:${'b'.repeat(64)}`,
  caddy: `sha256:${'c'.repeat(64)}`,
};
const attemptId = 'd'.repeat(32);

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { 'content-type': init.contentType ?? 'application/json' },
  });
}

function fetchFor({ api, web, ready }) {
  return async (url) => {
    if (url.pathname === '/health') return api;
    if (url.pathname === '/api/health') return web;
    if (url.pathname === '/ready') return ready;
    throw new Error('unexpected path');
  };
}

function legacyHealth() {
  return { status: 'ok', commitSha: 'unknown' };
}

function exactHealth(sha = targetSha) {
  return { status: 'ok', commitSha: sha };
}

function readyHealth(commitSha) {
  return { status: 'ready', commitSha, checks: { api: 'ok', database: 'ok' } };
}

function createState() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-legacy-state-'));
  const stateDir = path.join(root, 'state');
  prepareState({ stateDir, targetSha, attemptId, imageIds });
  return { root, stateDir };
}

test('workflow exposes only bootstrap deploy and explicit legacy rollback', () => {
  assert.match(workflow, /operation:[\s\S]*type: choice[\s\S]*- bootstrap_deploy[\s\S]*- legacy_rollback/);
  assert.doesNotMatch(workflow, /\n\s*- deploy\s*$/m);
  assert.doesNotMatch(workflow, /\n\s*- rollback\s*$/m);
  assert.match(workflow, /environment:\s*\n\s*name: production/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
});

test('workflow requires canonical SHA, main dispatch, exact approvals, and current main proof', () => {
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_HOST" =~ \^\[A-Za-z0-9\]/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_USER" =~ \^\[A-Za-z_\]/);
  assert.match(workflow, /GITHUB_SHA" = "\$TARGET_SHA"/);
  assert.match(workflow, /APPROVE_ONE_TIME_LEGACY_BOOTSTRAP_\$\{TARGET_SHA\}/);
  assert.match(workflow, /APPROVE_EXPLICIT_LEGACY_ROLLBACK_\$\{TARGET_SHA\}/);
  assert.match(workflow, /origin_main" = "\$TARGET_SHA"/);
  assert.match(workflow, /remote_main" = "\$TARGET_SHA"/);
  assert.match(workflow, /git merge-base --is-ancestor "\$TARGET_SHA" origin\/main/);

  const approvalValidation = workflow.indexOf('[ "$PRODUCTION_CODE_APPROVAL" = "$required_approval" ]');
  const legacyPreflight = workflow.indexOf('name: Preflight legacy revision before transport');
  const transportSetup = workflow.indexOf('name: Configure production transport');
  const markerProof = workflow.indexOf('marker_capture="$(mktemp)"');
  const remoteTemp = workflow.indexOf('mktemp -d /tmp/oasis-legacy-bootstrap.XXXXXXXX');
  const firstScp = workflow.indexOf('scp -q', remoteTemp);
  assert(approvalValidation < legacyPreflight);
  assert(legacyPreflight < transportSetup);
  assert(transportSetup < markerProof);
  assert(markerProof < remoteTemp);
  assert(remoteTemp < firstScp);
});

test('workflow shares production mutation concurrency and references only production-scoped transport names', () => {
  assert.match(workflow, /concurrency:\s*\n\s*group: production-vps-mutation\s*\n\s*cancel-in-progress: false/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_HOST/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_USER/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_SSH_KEY/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_KNOWN_HOSTS/);
  assert.doesNotMatch(workflow, /\bOASIS_VPS_HOST\b/);
  assert.doesNotMatch(workflow, /\bOASIS_VPS_USER\b/);
  assert.doesNotMatch(workflow, /\bOASIS_VPS_SSH_KEY\b/);
  assert.doesNotMatch(workflow, /ssh-keyscan/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(workflow, /staging-vps-mutation|DEPLOY_TARGET_STAGING|DEPLOY_TARGET_NOT_STAGING/);
});

test('workflow preserves all legacy images and durable state before Git, build, or runtime mutation', () => {
  const remoteStart = workflow.indexOf("if [ \"$OPERATION\" = \"bootstrap_deploy\" ]; then", workflow.indexOf("<<'REMOTE'"));
  const imageTag = workflow.indexOf('docker image tag', remoteStart);
  const statePrepare = workflow.indexOf('node "$state_helper" prepare', imageTag);
  const remoteFetch = workflow.indexOf('git fetch --no-tags origin main', statePrepare);
  const mutationState = workflow.indexOf('NEXT_STATE=MUTATION_STARTED', remoteFetch);
  const build = workflow.indexOf('"${compose[@]}" build web api', mutationState);
  const composeUp = workflow.indexOf('up -d --no-deps --no-build --pull never', build);

  for (const index of [remoteStart, imageTag, statePrepare, remoteFetch, build, mutationState, composeUp]) {
    assert.notEqual(index, -1);
  }
  assert(remoteStart < imageTag);
  assert(imageTag < statePrepare);
  assert(statePrepare < remoteFetch);
  assert(remoteFetch < mutationState);
  assert(mutationState < build);
  assert(build < composeUp);
  assert.match(workflow, /for service in caddy web api/);
  assert.match(workflow, /STATE_ALREADY_CONSUMED/);
  const remoteLock = workflow.indexOf('flock -n 9', remoteStart);
  const lockedMarker = workflow.indexOf('locked_target_class=', remoteLock);
  const lockedLegacyProof = workflow.indexOf('node "$revision_helper" bootstrap_legacy', lockedMarker);
  assert(remoteLock < lockedMarker);
  assert(lockedMarker < lockedLegacyProof);
  assert(lockedLegacyProof < imageTag);
});

test('workflow forces no-migration service-only mutation and contains no destructive data command', () => {
  assert.match(workflow, /RUN_MIGRATIONS=false APP_COMMIT_SHA="\$TARGET_SHA"/);
  assert.match(workflow, /RUN_MIGRATIONS=false APP_COMMIT_SHA=unknown APP_VERSION=unknown/);
  assert.match(workflow, /up -d --no-deps --no-build --pull never --wait --wait-timeout 180 api web caddy/);
  assert.doesNotMatch(workflow, /git pull|git reset/);
  assert.doesNotMatch(workflow, /RUN_MIGRATIONS=true/i);
  assert.doesNotMatch(workflow, /prisma\s+migrate|migrate\s+deploy|backfill|pg_restore|pg_dump|restore-postgres/i);
  assert.doesNotMatch(workflow, /up[^\n]*(?:^|\s)postgres(?:\s|$)/m);
  assert.doesNotMatch(workflow, /docker compose[^\n]*exec/);
});

test('workflow requires exact public target and readiness proof before permanent completion', () => {
  const composeUp = workflow.indexOf('up -d --no-deps --no-build --pull never');
  const exactProof = workflow.indexOf('node "$revision_helper" target_exact', composeUp);
  const complete = workflow.indexOf('NEXT_STATE=REVISION_AWARE_COMPLETE', exactProof);
  assert(composeUp < exactProof);
  assert(exactProof < complete);
  assert.match(workflow, /node "\$revision_helper" bootstrap_legacy/);
  assert.match(workflow, /node "\$revision_helper" rollback_legacy/);
  assert.match(workflow, /\[ ! -e "\$state_dir\/reservation" \]/);
});

test('rollback is explicit, image-based, unknown-revision, and never automatic', () => {
  assert.match(workflow, /legacy_rollback/);
  assert.match(workflow, /STATE_EXPORT_READY/);
  assert.match(workflow, /docker image inspect --format '\{\{\.Id\}\}'/);
  assert.match(workflow, /APP_COMMIT_SHA=unknown APP_VERSION=unknown/);
  assert.match(workflow, /NEXT_STATE=LEGACY_ROLLED_BACK/);
  assert.doesNotMatch(workflow, /operation.*=.*legacy_rollback/);
  assert.doesNotMatch(workflow, /automatic.?rollback/i);
  const failureHandler = workflow.match(/mark_rollback_required\(\) \{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(failureHandler);
  assert.doesNotMatch(failureHandler, /compose| up |legacy_rollback|LEGACY_ROLLED_BACK/);
  assert.match(failureHandler, /NEXT_STATE=ROLLBACK_REQUIRED/);
});

test('workflow suppresses raw diagnostics and only emits allowlisted remote lines', () => {
  assert.match(workflow, /remote_output="\$\(mktemp\)"/);
  assert.match(workflow, /unsafe_output=0/);
  assert.match(workflow, /REMOTE_OUTPUT_UNSAFE/);
  assert.doesNotMatch(workflow, /set -x|printenv|env \||toJson|curl\s+-[^\n]*[vViI]|tee\s|cat\s+deploy\/v2\/\.env/);
  assert.doesNotMatch(workflow, /printf[^\n]*(?:IMAGE_ID|image_id|origin_url|APP_URL|VPS_HOST)/);
  for (const match of workflow.matchAll(/\b(?:"\$\{compose\[@\]\}"|docker compose) ps([^\n]*)/g)) {
    assert.match(match[1], /-q/);
  }
});

test('canonical SHA validation rejects uppercase, short, and malformed values', () => {
  assert.equal(isCanonicalSha(targetSha), true);
  assert.equal(isCanonicalSha(targetSha.toUpperCase()), false);
  assert.equal(isCanonicalSha('a'.repeat(39)), false);
  assert.equal(isCanonicalSha('g'.repeat(40)), false);
});

test('base URL validation accepts one HTTPS origin and rejects ambiguous URLs', () => {
  assert.equal(normalizeBaseUrl('https://example.invalid').origin, 'https://example.invalid');
  for (const value of [
    'http://example.invalid',
    'https://user@example.invalid',
    'https://example.invalid/path',
    'https://example.invalid?query=1',
    'https://example.invalid/#fragment',
    "https://example'.invalid",
    'https://example.invalid:444',
    'https://EXAMPLE.invalid',
  ]) {
    assert.throws(() => normalizeBaseUrl(value));
  }
});

test('revision payload classification permits legacy only when both sides are unknown', () => {
  assert.deepEqual(classifyRevisionPayloads(legacyHealth(), legacyHealth()), {
    classification: LEGACY_UNKNOWN,
  });
  assert.deepEqual(classifyRevisionPayloads(exactHealth(), exactHealth()), {
    classification: REVISION_AWARE_EXACT,
    sha: targetSha,
  });
  assert.equal(
    classifyRevisionPayloads(legacyHealth(), exactHealth()).classification,
    REVISION_UNSAFE,
  );
  assert.equal(
    classifyRevisionPayloads(exactHealth(), exactHealth('b'.repeat(40))).classification,
    REVISION_UNSAFE,
  );
  assert.equal(
    classifyRevisionPayloads(exactHealth(targetSha.toUpperCase()), exactHealth(targetSha.toUpperCase())).classification,
    REVISION_UNSAFE,
  );
  for (const commitSha of [undefined, null, '', '   ', 'UNKNOWN']) {
    assert.equal(
      classifyRevisionPayloads(
        { status: 'ok', commitSha },
        { status: 'ok', commitSha },
      ).classification,
      LEGACY_UNKNOWN,
    );
  }
});

test('ready proof requires ready status, database ok, and the expected revision', () => {
  assert.equal(readyPayloadMatches(readyHealth(targetSha), targetSha), true);
  assert.equal(readyPayloadMatches(readyHealth('unknown'), LEGACY_UNKNOWN), true);
  assert.equal(readyPayloadMatches({ ...readyHealth(targetSha), status: 'degraded' }, targetSha), false);
  assert.equal(
    readyPayloadMatches({ ...readyHealth(targetSha), checks: { database: 'error' } }, targetSha),
    false,
  );
});

test('network verifier proves exact target and legacy rollback without exposing payloads', async () => {
  const exact = await verifyRevision({
    mode: 'target_exact',
    baseUrl: 'https://example.invalid',
    targetSha,
    fetchImpl: fetchFor({
      api: jsonResponse(exactHealth()),
      web: jsonResponse(exactHealth()),
      ready: jsonResponse(readyHealth(targetSha)),
    }),
  });
  assert.equal(exact, REVISION_AWARE_EXACT);

  const legacy = await verifyRevision({
    mode: 'rollback_legacy',
    baseUrl: 'https://example.invalid',
    targetSha,
    fetchImpl: fetchFor({
      api: jsonResponse(legacyHealth()),
      web: jsonResponse(legacyHealth()),
      ready: jsonResponse(readyHealth('unknown')),
    }),
  });
  assert.equal(legacy, LEGACY_UNKNOWN);

  const exactLegacy = await verifyRevision({
    mode: 'rollback_legacy',
    baseUrl: 'https://example.invalid',
    targetSha,
    fetchImpl: fetchFor({
      api: jsonResponse(exactHealth(targetSha)),
      web: jsonResponse(exactHealth(targetSha)),
      ready: jsonResponse(readyHealth(targetSha)),
    }),
  });
  assert.equal(exactLegacy, REVISION_AWARE_EXACT);
});

test('manifest-bound rollback rejects wrong, mixed, missing, and arbitrary exact revisions', async () => {
  const wrongSha = 'b'.repeat(40);
  const cases = [
    {
      api: exactHealth(wrongSha),
      web: exactHealth(wrongSha),
      ready: readyHealth(wrongSha),
    },
    {
      api: exactHealth(targetSha),
      web: exactHealth(wrongSha),
      ready: readyHealth(targetSha),
    },
    {
      api: exactHealth(targetSha),
      web: exactHealth(targetSha),
      ready: readyHealth(wrongSha),
    },
    {
      api: { status: 'ok' },
      web: exactHealth(targetSha),
      ready: readyHealth(targetSha),
    },
  ];
  for (const payloads of cases) {
    const result = await verifyRevision({
      mode: 'rollback_legacy',
      baseUrl: 'https://example.invalid',
      targetSha,
      fetchImpl: fetchFor({
        api: jsonResponse(payloads.api),
        web: jsonResponse(payloads.web),
        ready: jsonResponse(payloads.ready),
      }),
    });
    assert.equal(result, REVISION_UNSAFE);
  }
  const invalidBinding = await verifyRevision({
    mode: 'rollback_legacy',
    baseUrl: 'https://example.invalid',
    targetSha: 'arbitrary',
    fetchImpl: fetchFor({
      api: jsonResponse(legacyHealth()),
      web: jsonResponse(legacyHealth()),
      ready: jsonResponse(readyHealth('unknown')),
    }),
  });
  assert.equal(invalidBinding, REVISION_UNSAFE);
});

test('network verifier fails closed for redirects, invalid content, oversized bodies, and hostile errors', async () => {
  const unsafeResponses = [
    jsonResponse(exactHealth(), { status: 302 }),
    jsonResponse(exactHealth(), { contentType: 'text/html' }),
    new Response('x'.repeat(64 * 1024 + 1), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ];
  for (const api of unsafeResponses) {
    const result = await verifyRevision({
      mode: 'target_exact',
      baseUrl: 'https://example.invalid',
      targetSha,
      fetchImpl: fetchFor({
        api,
        web: jsonResponse(exactHealth()),
        ready: jsonResponse(readyHealth(targetSha)),
      }),
    });
    assert.equal(result, REVISION_UNSAFE);
  }

  const hostile = await verifyRevision({
    mode: 'target_exact',
    baseUrl: 'https://example.invalid',
    targetSha,
    fetchImpl: async () => {
      throw new Error('SENSITIVE_SENTINEL');
    },
  });
  assert.equal(hostile, REVISION_UNSAFE);
});

test('state manifest is exact, tenant-free, and records only LEGACY_UNKNOWN', () => {
  const manifest = validateManifest({
    schemaVersion: 1,
    kind: 'oasis-legacy-bootstrap',
    attemptId,
    legacyRevision: LEGACY_UNKNOWN,
    targetSha,
    status: STATES.PREPARED,
    completedOnce: false,
    images: {
      api: { id: imageIds.api, alias: `oasis-legacy-bootstrap-api:${attemptId}` },
      web: { id: imageIds.web, alias: `oasis-legacy-bootstrap-web:${attemptId}` },
      caddy: { id: imageIds.caddy, alias: `oasis-legacy-bootstrap-caddy:${attemptId}` },
    },
  });
  assert.equal(manifest.legacyRevision, LEGACY_UNKNOWN);
  assert.equal('rollbackSha' in manifest, false);
  assert.equal('repositoryHead' in manifest, false);
  assert.throws(() => validateManifest({ ...manifest, extra: true }));
  assert.throws(() => validateManifest({ ...manifest, legacyRevision: targetSha }));
});

test('durable state permits only the reviewed transitions and keeps completion permanent', () => {
  assert.equal(canTransition(STATES.PREPARED, STATES.MUTATION_STARTED), true);
  assert.equal(canTransition(STATES.MUTATION_STARTED, STATES.REVISION_AWARE_COMPLETE), true);
  assert.equal(canTransition(STATES.MUTATION_STARTED, STATES.ROLLBACK_REQUIRED), true);
  assert.equal(canTransition(STATES.REVISION_AWARE_COMPLETE, STATES.ROLLBACK_REQUIRED), true);
  assert.equal(canTransition(STATES.ROLLBACK_REQUIRED, STATES.LEGACY_ROLLED_BACK), true);
  assert.equal(canTransition(STATES.PREPARED, STATES.REVISION_AWARE_COMPLETE), false);
  assert.equal(canTransition(STATES.LEGACY_ROLLED_BACK, STATES.PREPARED), false);

  const { root, stateDir } = createState();
  try {
    transitionState({ stateDir, targetSha, nextState: STATES.MUTATION_STARTED });
    transitionState({ stateDir, targetSha, nextState: STATES.REVISION_AWARE_COMPLETE });
    assert.equal(fs.existsSync(path.join(stateDir, 'reservation')), true);
    assert.equal(fs.existsSync(path.join(stateDir, 'completion')), true);
    transitionState({ stateDir, targetSha, nextState: STATES.ROLLBACK_REQUIRED });
    transitionState({ stateDir, targetSha, nextState: STATES.LEGACY_ROLLED_BACK });
    assert.equal(fs.existsSync(path.join(stateDir, 'completion')), true);
    assert.equal(readState({ stateDir }).status, STATES.LEGACY_ROLLED_BACK);
    assert.equal(readState({ stateDir }).completedOnce, true);
    assert.throws(() => prepareState({ stateDir, targetSha, attemptId, imageIds }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('completed manifest remains rollback-readable if completion marker write is interrupted', () => {
  const { root, stateDir } = createState();
  try {
    transitionState({ stateDir, targetSha, nextState: STATES.MUTATION_STARTED });
    transitionState({ stateDir, targetSha, nextState: STATES.REVISION_AWARE_COMPLETE });
    fs.unlinkSync(path.join(stateDir, 'completion'));
    const completed = readState({ stateDir });
    assert.equal(completed.status, STATES.REVISION_AWARE_COMPLETE);
    assert.equal(completed.completedOnce, true);
    transitionState({ stateDir, targetSha, nextState: STATES.ROLLBACK_REQUIRED });
    assert.equal(readState({ stateDir }).status, STATES.ROLLBACK_REQUIRED);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('state fails closed on incomplete reservation, active lock, and forbidden transition', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-legacy-crash-'));
  const stateDir = path.join(root, 'state');
  fs.mkdirSync(path.join(stateDir, 'reservation'), { recursive: true, mode: 0o700 });
  fs.chmodSync(stateDir, 0o700);
  assert.throws(() => readState({ stateDir }));
  fs.rmSync(root, { recursive: true, force: true });

  const created = createState();
  try {
    fs.mkdirSync(path.join(created.stateDir, 'transition.lock'), { mode: 0o700 });
    assert.throws(() => readState({ stateDir: created.stateDir }));
    fs.rmdirSync(path.join(created.stateDir, 'transition.lock'));
    assert.throws(() =>
      transitionState({
        stateDir: created.stateDir,
        targetSha,
        nextState: STATES.REVISION_AWARE_COMPLETE,
      }),
    );
    assert.equal(readState({ stateDir: created.stateDir }).status, STATES.PREPARED);
  } finally {
    fs.rmSync(created.root, { recursive: true, force: true });
  }
});

test('state export is private, exact, and contains no rollback SHA field', () => {
  const { root, stateDir } = createState();
  const destination = path.join(stateDir, '.export-test');
  try {
    writeExportFile({ stateDir, targetSha, destination });
    const contents = fs.readFileSync(destination, 'utf8');
    assert.match(contents, new RegExp(`^TARGET_SHA=${targetSha}$`, 'm'));
    assert.match(contents, new RegExp(`^ATTEMPT_ID=${attemptId}$`, 'm'));
    assert.match(contents, /^STATUS=PREPARED$/m);
    assert.match(contents, /^API_IMAGE_ID=sha256:[0-9a-f]{64}$/m);
    assert.match(contents, /^WEB_IMAGE_ALIAS=oasis-legacy-bootstrap-web:[0-9a-f]{32}$/m);
    assert.doesNotMatch(contents, /ROLLBACK_SHA|repository|LEGACY_UNKNOWN/);
    assert.equal(fs.statSync(destination).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('state CLI never prints supplied values or diagnostics on failure', () => {
  const sentinel = 'SENSITIVE_SENTINEL_IMAGE_ID';
  const result = spawnSync(process.execPath, [stateScript, 'prepare'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LEGACY_STATE_DIR: path.join(os.tmpdir(), 'oasis-invalid-state'),
      TARGET_SHA: targetSha,
      ATTEMPT_ID: attemptId,
      API_IMAGE_ID: sentinel,
      WEB_IMAGE_ID: sentinel,
      CADDY_IMAGE_ID: sentinel,
    },
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, 'STATE_INVALID\n');
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout + result.stderr, /SENSITIVE_SENTINEL/);
});

test('revision CLI emits only the unsafe classification on invalid configuration', () => {
  const result = spawnSync(process.execPath, [revisionScript, 'target_exact'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      OASIS_PRODUCTION_APP_URL: 'SENSITIVE_SENTINEL_INVALID_URL',
      TARGET_SHA: targetSha,
    },
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, 'REVISION_UNSAFE\n');
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout + result.stderr, /SENSITIVE_SENTINEL/);
});

test('runbook keeps execution blockers and deploy approval explicitly unresolved', () => {
  assert.match(docs, /one-time legacy bootstrap/i);
  assert.match(docs, /protected production environment/i);
  assert.match(docs, /repository-scoped deploy credentials/i);
  assert.match(docs, /No deploy SHA is approved/i);
  assert.match(docs, /backup.*restore/i);
  assert.match(docs, /migration status/i);
  assert.match(docs, /UX/i);
  assert.match(docs, /staffing/i);
  assert.match(docs, /fake-data/i);
});
