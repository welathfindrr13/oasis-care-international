import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  STATES as LEGACY_STATES,
  prepareState as prepareLegacyState,
  transitionState as transitionLegacyState,
} from '../../deploy/v2/scripts/legacy-bootstrap-state.mjs';
import {
  EXPECTED_LEGACY_STATE,
  FORWARD_STATES,
  FORWARD_TARGET_SHA,
  prepareForwardState,
  readForwardState,
  readLegacyBinding,
  transitionForwardState,
  verifyLegacyStateUnchanged,
} from '../../deploy/v2/scripts/forward-deploy-state.mjs';
import {
  REVISION_AWARE_EXACT,
  REVISION_UNSAFE,
  verifyRevision,
} from './revision-proof.mjs';
import {
  parseEnvFile,
  validate as validateEnvironment,
} from '../../deploy/v2/scripts/preflight-env.mjs';

const workflow = fs.readFileSync(new URL('./forward-deploy-vps.yml', import.meta.url), 'utf8');
const forwardHelper = fs.readFileSync(
  new URL('../../deploy/v2/scripts/forward-deploy-state.mjs', import.meta.url),
  'utf8',
);
const docs = fs.readFileSync(new URL('../../docs/deployment-v2/README.md', import.meta.url), 'utf8');
const legacyHelperPath = fileURLToPath(
  new URL('../../deploy/v2/scripts/legacy-bootstrap-state.mjs', import.meta.url),
);
const workflowSha = 'f'.repeat(40);
const forwardAttemptId = 'e'.repeat(32);
const legacyAttemptId = 'd'.repeat(32);
const imageIds = {
  api: `sha256:${'a'.repeat(64)}`,
  web: `sha256:${'b'.repeat(64)}`,
  caddy: `sha256:${'c'.repeat(64)}`,
};

function errorCode(error) {
  return error?.code;
}

function isForwardError(error) {
  return typeof errorCode(error) === 'string';
}

function makeFixture(t, { completedOnce = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-state-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const legacyStateDir = path.join(root, 'legacy-state');
  const forwardRoot = path.join(root, 'forward-state');
  prepareLegacyState({
    stateDir: legacyStateDir,
    targetSha: '7'.repeat(40),
    attemptId: legacyAttemptId,
    imageIds,
  });
  transitionLegacyState({
    stateDir: legacyStateDir,
    targetSha: '7'.repeat(40),
    nextState: LEGACY_STATES.MUTATION_STARTED,
  });
  if (completedOnce) {
    transitionLegacyState({
      stateDir: legacyStateDir,
      targetSha: '7'.repeat(40),
      nextState: LEGACY_STATES.REVISION_AWARE_COMPLETE,
    });
  }
  transitionLegacyState({
    stateDir: legacyStateDir,
    targetSha: '7'.repeat(40),
    nextState: LEGACY_STATES.ROLLBACK_REQUIRED,
  });
  transitionLegacyState({
    stateDir: legacyStateDir,
    targetSha: '7'.repeat(40),
    nextState: LEGACY_STATES.LEGACY_ROLLED_BACK,
  });
  return { root, legacyStateDir, forwardRoot };
}

async function prepareForward(fixture, overrides = {}) {
  const binding = await readLegacyBinding({
    legacyStateDir: fixture.legacyStateDir,
    legacyStateHelper: legacyHelperPath,
  });
  return prepareForwardState({
    rootDir: fixture.forwardRoot,
    targetSha: FORWARD_TARGET_SHA,
    workflowSha,
    originMainSha: workflowSha,
    repository: 'welathfindrr13/oasis-care-international',
    attemptId: forwardAttemptId,
    legacyStateDir: fixture.legacyStateDir,
    legacyStateHelper: legacyHelperPath,
    expectedLegacyDigest: binding.digest,
    runningImageIds: imageIds,
    ...overrides,
  });
}

function snapshotTree(root) {
  const snapshot = [];
  function visit(target, relative) {
    const stat = fs.lstatSync(target);
    const item = {
      path: relative,
      mode: stat.mode & 0o777,
      type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
    };
    if (stat.isFile()) item.contents = fs.readFileSync(target).toString('hex');
    snapshot.push(item);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target).sort()) {
        visit(path.join(target, entry), path.join(relative, entry));
      }
    }
  }
  visit(root, '.');
  return snapshot;
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

test('valid durable legacy rollback prepares a separate immutable forward attempt', async (t) => {
  const fixture = makeFixture(t);
  const manifest = await prepareForward(fixture);
  assert.equal(manifest.targetSha, FORWARD_TARGET_SHA);
  assert.equal(manifest.workflowSha, workflowSha);
  assert.equal(manifest.originMainSha, workflowSha);
  assert.equal(manifest.attemptId, forwardAttemptId);
  assert.equal(manifest.expectedStartState, EXPECTED_LEGACY_STATE);
  assert.deepEqual(manifest.rollbackImages, {
    api: { id: imageIds.api, alias: `oasis-legacy-bootstrap-api:${legacyAttemptId}` },
    web: { id: imageIds.web, alias: `oasis-legacy-bootstrap-web:${legacyAttemptId}` },
    caddy: { id: imageIds.caddy, alias: `oasis-legacy-bootstrap-caddy:${legacyAttemptId}` },
  });
  assert.equal(readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId }).state, FORWARD_STATES.PREPARED);
});

test('preparation binds exact target, workflow, current main, repository, attempt, and start state', async (t) => {
  const cases = [
    { targetSha: 'a'.repeat(40) },
    { workflowSha: 'b'.repeat(40), originMainSha: workflowSha },
    { originMainSha: 'b'.repeat(40) },
    { repository: '../unsafe' },
    { attemptId: 'a'.repeat(31) },
    { expectedLegacyDigest: '0'.repeat(64) },
  ];
  for (const overrides of cases) {
    const fixture = makeFixture(t);
    await assert.rejects(
      prepareForward(fixture, overrides),
      isForwardError,
      `unsafe binding unexpectedly accepted: ${JSON.stringify(overrides)}`,
    );
  }
});

test('the permanent forward reservation rejects replay and every second attempt', async (t) => {
  const fixture = makeFixture(t);
  await prepareForward(fixture);
  await assert.rejects(prepareForward(fixture), (error) => errorCode(error) === 'FORWARD_STATE_ALREADY_CONSUMED');
  await assert.rejects(
    prepareForward(fixture, { attemptId: '1'.repeat(32) }),
    (error) => errorCode(error) === 'FORWARD_STATE_ALREADY_CONSUMED',
  );
});

test('legacy reservation, manifest, completion marker, and rollback aliases remain byte-for-byte unchanged', async (t) => {
  for (const completedOnce of [false, true]) {
    const fixture = makeFixture(t, { completedOnce });
    const before = snapshotTree(fixture.legacyStateDir);
    await prepareForward(fixture);
    transitionForwardState({
      rootDir: fixture.forwardRoot,
      attemptId: forwardAttemptId,
      nextState: FORWARD_STATES.MUTATION_STARTED,
    });
    await verifyLegacyStateUnchanged({
      rootDir: fixture.forwardRoot,
      attemptId: forwardAttemptId,
      legacyStateDir: fixture.legacyStateDir,
      legacyStateHelper: legacyHelperPath,
    });
    assert.deepEqual(snapshotTree(fixture.legacyStateDir), before);
  }
});

test('preparation rejects mismatched running images and any non-rolled-back legacy state', async (t) => {
  const mismatched = makeFixture(t);
  await assert.rejects(
    prepareForward(mismatched, { runningImageIds: { ...imageIds, web: `sha256:${'9'.repeat(64)}` } }),
    (error) => errorCode(error) === 'FORWARD_RUNNING_IMAGES_UNSAFE',
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-prepared-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const legacyStateDir = path.join(root, 'legacy-state');
  prepareLegacyState({
    stateDir: legacyStateDir,
    targetSha: '7'.repeat(40),
    attemptId: legacyAttemptId,
    imageIds,
  });
  await assert.rejects(
    readLegacyBinding({ legacyStateDir, legacyStateHelper: legacyHelperPath }),
    (error) => errorCode(error) === 'FORWARD_LEGACY_STATE_UNSAFE',
  );
});

test('locks, unsafe permissions, symlinks, partial writes, and uncertain I/O fail closed', async (t) => {
  const partialRoot = makeFixture(t);
  fs.mkdirSync(partialRoot.forwardRoot, { mode: 0o700 });
  await assert.rejects(
    prepareForward(partialRoot),
    (error) => errorCode(error) === 'FORWARD_STATE_ALREADY_CONSUMED',
  );

  const preparing = makeFixture(t);
  fs.mkdirSync(preparing.forwardRoot, { mode: 0o700 });
  fs.mkdirSync(path.join(preparing.forwardRoot, 'preparation.lock'), { mode: 0o700 });
  await assert.rejects(
    prepareForward(preparing),
    (error) => errorCode(error) === 'FORWARD_STATE_LOCKED',
  );

  const malformedLegacy = makeFixture(t);
  fs.writeFileSync(path.join(malformedLegacy.legacyStateDir, 'unexpected'), 'unsafe', { mode: 0o600 });
  await assert.rejects(
    readLegacyBinding({
      legacyStateDir: malformedLegacy.legacyStateDir,
      legacyStateHelper: legacyHelperPath,
    }),
    isForwardError,
  );

  const locked = makeFixture(t);
  await prepareForward(locked);
  const lockedAttempt = path.join(locked.forwardRoot, 'attempts', forwardAttemptId);
  fs.mkdirSync(path.join(lockedAttempt, 'transition.lock'), { mode: 0o700 });
  assert.throws(
    () => readForwardState({ rootDir: locked.forwardRoot, attemptId: forwardAttemptId }),
    (error) => errorCode(error) === 'FORWARD_STATE_LOCKED',
  );

  const wrongMode = makeFixture(t);
  await prepareForward(wrongMode);
  const wrongManifest = path.join(wrongMode.forwardRoot, 'attempts', forwardAttemptId, 'manifest.json');
  fs.chmodSync(wrongManifest, 0o644);
  assert.throws(() => readForwardState({ rootDir: wrongMode.forwardRoot, attemptId: forwardAttemptId }), isForwardError);

  const symlinked = makeFixture(t);
  await prepareForward(symlinked);
  const symlinkManifest = path.join(symlinked.forwardRoot, 'attempts', forwardAttemptId, 'manifest.json');
  const savedManifest = path.join(symlinked.root, 'saved-forward-manifest');
  fs.renameSync(symlinkManifest, savedManifest);
  fs.symlinkSync(savedManifest, symlinkManifest);
  assert.throws(() => readForwardState({ rootDir: symlinked.forwardRoot, attemptId: forwardAttemptId }), isForwardError);

  const partial = makeFixture(t);
  await prepareForward(partial);
  fs.writeFileSync(path.join(partial.forwardRoot, 'attempts', forwardAttemptId, '.tmp-interrupted'), 'partial', { mode: 0o600 });
  assert.throws(() => readForwardState({ rootDir: partial.forwardRoot, attemptId: forwardAttemptId }), isForwardError);

  const intermediateSymlink = makeFixture(t);
  await prepareForward(intermediateSymlink);
  const attemptsPath = path.join(intermediateSymlink.forwardRoot, 'attempts');
  const externalAttempts = path.join(intermediateSymlink.root, 'external-attempts');
  fs.renameSync(attemptsPath, externalAttempts);
  fs.symlinkSync(externalAttempts, attemptsPath);
  assert.throws(
    () => transitionForwardState({
      rootDir: intermediateSymlink.forwardRoot,
      attemptId: forwardAttemptId,
      nextState: FORWARD_STATES.MUTATION_STARTED,
    }),
    isForwardError,
  );
  assert.equal(
    fs.existsSync(path.join(externalAttempts, forwardAttemptId, 'transition.lock')),
    false,
    'unsafe intermediate symlink must be rejected before any lock write',
  );

  const uncertain = makeFixture(t);
  await prepareForward(uncertain);
  const uncertainAttempt = path.join(uncertain.forwardRoot, 'attempts', forwardAttemptId);
  const originalRename = fs.renameSync;
  fs.renameSync = () => {
    const error = new Error('injected rename failure');
    error.code = 'EIO';
    throw error;
  };
  try {
    assert.throws(
      () => transitionForwardState({
        rootDir: uncertain.forwardRoot,
        attemptId: forwardAttemptId,
        nextState: FORWARD_STATES.MUTATION_STARTED,
      }),
      (error) => errorCode(error) === 'FORWARD_STATE_IO_UNCERTAIN',
    );
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(
    fs.readdirSync(uncertainAttempt).some((entry) => entry.startsWith('.tmp-')),
    true,
    'uncertain write must leave fail-closed partial state evidence',
  );
  assert.throws(
    () => readForwardState({ rootDir: uncertain.forwardRoot, attemptId: forwardAttemptId }),
    isForwardError,
  );
});

test('post-mutation failures are explicit, terminal, and never become completion', async (t) => {
  const fixture = makeFixture(t);
  await prepareForward(fixture);
  transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.MUTATION_STARTED,
  });
  const failed = transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.RECOVERABLE_FAILURE,
    failureClass: 'REVISION_PROOF_FAILED',
  });
  assert.equal(failed.state, FORWARD_STATES.RECOVERABLE_FAILURE);
  assert.equal(failed.failureClass, 'REVISION_PROOF_FAILED');
  assert.throws(
    () => transitionForwardState({
      rootDir: fixture.forwardRoot,
      attemptId: forwardAttemptId,
      nextState: FORWARD_STATES.COMPLETE,
    }),
    isForwardError,
  );
});

test('success, controlled failure, unexpected exit, and TERM all clean staged helpers', (t) => {
  function extractFunction(name) {
    const match = workflow.match(new RegExp(`${name}\\(\\) \\{([\\s\\S]*?)\\n\\s*\\}`));
    assert.ok(match, `${name} must remain extractable`);
    return `${name}() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  }
  const cleanupSource = extractFunction('cleanup_remote');
  const exitSource = extractFunction('handle_remote_exit');
  const controlledSource = extractFunction('record_recoverable_failure');
  const cases = [
    { name: 'success', armed: 0, action: 'exit 0', status: 0, output: '' },
    {
      name: 'controlled',
      armed: 1,
      action: 'record_recoverable_failure BUILD_FAILED',
      status: 1,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_RECOVERY_REQUIRED\n',
    },
    {
      name: 'unexpected',
      armed: 1,
      action: 'false',
      status: 1,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_RECOVERY_REQUIRED\n',
    },
    {
      name: 'term',
      armed: 1,
      action: 'kill -TERM $$',
      status: 1,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_RECOVERY_REQUIRED\n',
    },
    {
      name: 'mutation-transition-term',
      armed: 1,
      action: 'node "$forward_helper" transition',
      nodeSource: `
        node_calls=0
        node() {
          node_calls=$((node_calls + 1))
          if [ "$node_calls" -eq 1 ]; then
            kill -TERM $$
          fi
          return 0
        }
      `,
      status: 1,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_RECOVERY_REQUIRED\n',
    },
  ];

  for (const testCase of cases) {
    const helperDir = fs.mkdtempSync(path.join(os.tmpdir(), `oasis-forward-cleanup-${testCase.name}-`));
    t.after(() => fs.rmSync(helperDir, { recursive: true, force: true }));
    const names = [
      'diagnostic',
      'legacy-binding',
      'caddy-override.yml',
      'forward-deploy-state.mjs',
      'legacy-bootstrap-state.mjs',
      'revision-proof.mjs',
      'preflight-env.mjs',
    ];
    for (const name of names) fs.writeFileSync(path.join(helperDir, name), 'sentinel', { mode: 0o600 });
    const script = `
      set -euo pipefail
      HELPER_DIR="$TEST_HELPER_DIR"
      diagnostic_file="$HELPER_DIR/diagnostic"
      binding_export="$HELPER_DIR/legacy-binding"
      caddy_override="$HELPER_DIR/caddy-override.yml"
      forward_helper="$HELPER_DIR/forward-deploy-state.mjs"
      legacy_helper="$HELPER_DIR/legacy-bootstrap-state.mjs"
      revision_helper="$HELPER_DIR/revision-proof.mjs"
      preflight_helper="$HELPER_DIR/preflight-env.mjs"
      forward_state_root=/synthetic
      ATTEMPT_ID=${forwardAttemptId}
      ${testCase.nodeSource ?? 'node() { return 0; }'}
      failure_armed=${testCase.armed}
      ${cleanupSource}
      ${exitSource}
      ${controlledSource}
      trap 'handle_remote_exit' EXIT
      trap 'exit 1' HUP INT TERM
      ${testCase.action}
    `;
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { ...process.env, TEST_HELPER_DIR: helperDir },
    });
    assert.equal(result.status, testCase.status, testCase.name);
    assert.equal(result.stdout, testCase.output, testCase.name);
    assert.equal(result.stderr, '', testCase.name);
    assert.equal(fs.existsSync(helperDir), false, `${testCase.name} must remove helper directory`);
  }
});

test('omitted and quoted false medication flags remain disabled without consuming the attempt', (t) => {
  for (const line of [
    '',
    'MEDICATION_EMAR_ENABLED=false',
    'MEDICATION_EMAR_ENABLED="false"',
    "MEDICATION_EMAR_ENABLED='false'",
  ]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-medication-env-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const envFile = path.join(directory, '.env');
    fs.writeFileSync(envFile, `NODE_ENV=production\n${line}\n`, { mode: 0o600 });
    const medicationErrors = validateEnvironment(parseEnvFile(envFile)).errors.filter((error) =>
      error.includes('MEDICATION_EMAR_ENABLED'),
    );
    assert.deepEqual(medicationErrors, [], line || 'omitted');
  }

  const preMutationPreflight = workflow.indexOf('node "$preflight_helper" deploy/v2/.env');
  const prepare = workflow.indexOf('node "$forward_helper" prepare', preMutationPreflight);
  const armed = workflow.indexOf('failure_armed=1', prepare);
  assert(preMutationPreflight < prepare && prepare < armed);
  assert.doesNotMatch(workflow, /read_env_value MEDICATION_EMAR_ENABLED/);
  assert.match(
    workflow,
    /RUN_MIGRATIONS=false MEDICATION_EMAR_ENABLED=false APP_COMMIT_SHA="\$TARGET_SHA"/g,
  );
});

test('exact completion proof requires API, readiness, and web to report the target SHA', async () => {
  const healthy = await verifyRevision({
    mode: 'target_exact',
    baseUrl: 'https://example.invalid',
    targetSha: FORWARD_TARGET_SHA,
    fetchImpl: async (url) => {
      if (url.pathname === '/ready') {
        return jsonResponse({ status: 'ready', commitSha: FORWARD_TARGET_SHA, checks: { api: 'ok', database: 'ok' } });
      }
      return jsonResponse({ status: 'ok', commitSha: FORWARD_TARGET_SHA });
    },
  });
  assert.equal(healthy, REVISION_AWARE_EXACT);

  for (const stalePath of ['/health', '/ready', '/api/health']) {
    const result = await verifyRevision({
      mode: 'target_exact',
      baseUrl: 'https://example.invalid',
      targetSha: FORWARD_TARGET_SHA,
      fetchImpl: async (url) => {
        const sha = url.pathname === stalePath ? '0'.repeat(40) : FORWARD_TARGET_SHA;
        if (url.pathname === '/ready') {
          return jsonResponse({ status: 'ready', commitSha: sha, checks: { api: 'ok', database: 'ok' } });
        }
        return jsonResponse({ status: 'ok', commitSha: sha });
      },
    });
    assert.equal(result, REVISION_UNSAFE);
  }
});

test('workflow is a new one-shot lane bound to the exact application and reviewed workflow SHAs', () => {
  assert.match(workflow, /EXPECTED_TARGET_SHA: 18aacd8458a3f96a38bf470d9a4c837ad563fa5c/);
  assert.match(workflow, /TARGET_SHA" = "\$EXPECTED_TARGET_SHA/);
  assert.match(workflow, /GITHUB_SHA" = "\$WORKFLOW_SHA/);
  assert.match(workflow, /origin_main" = "\$WORKFLOW_SHA/);
  assert.match(workflow, /remote_main" = "\$WORKFLOW_SHA/);
  assert.match(workflow, /APPROVE_FORWARD_DEPLOY_\$\{TARGET_SHA\}_WITH_\$\{WORKFLOW_SHA\}_ATTEMPT_\$\{ATTEMPT_ID\}_FROM_LEGACY_ROLLED_BACK/);
  assert.match(workflow, /forward-deployment-v1/);
  assert.match(workflow, /environment:\s*\n\s*name: production/);
  assert.match(workflow, /group: production-vps-mutation/);
  assert.match(workflow, /flock -n 9/);
  assert.doesNotMatch(workflow, /bootstrap_deploy|APPROVE_ONE_TIME_LEGACY_BOOTSTRAP|APPROVE_EXPLICIT_LEGACY_ROLLBACK/);
});

test('workflow preserves legacy state and aliases before checkout, build, runtime replacement, and completion', () => {
  const inspect = workflow.indexOf('node "$forward_helper" inspect-legacy');
  const running = workflow.indexOf('running_image=', inspect);
  const prepare = workflow.indexOf('node "$forward_helper" prepare', running);
  const mutation = workflow.indexOf('NEXT_STATE=MUTATION_STARTED', prepare);
  const checkout = workflow.indexOf('git checkout --detach "$TARGET_SHA"', mutation);
  const build = workflow.indexOf('"${compose[@]}" build web api', checkout);
  const up = workflow.indexOf('up -d --no-deps --no-build --pull never', build);
  const exactProof = workflow.indexOf('node "$revision_helper" target_exact', up);
  const legacyProof = workflow.indexOf('node "$forward_helper" verify-legacy', exactProof);
  const complete = workflow.indexOf('NEXT_STATE=COMPLETE', legacyProof);
  for (const index of [inspect, running, prepare, mutation, checkout, build, up, exactProof, legacyProof, complete]) {
    assert.notEqual(index, -1);
  }
  assert(inspect < running && running < prepare && prepare < mutation && mutation < checkout);
  assert(checkout < build && build < up && up < exactProof && exactProof < legacyProof && legacyProof < complete);
  assert.match(workflow, /verify_rollback_aliases/g);
  assert.match(workflow, /image: %s.*CADDY_IMAGE_ALIAS/);
  assert.match(workflow, /running_image" = "\$\{legacy_values\[CADDY_IMAGE_ID\]\}"/);
  assert.doesNotMatch(workflow, /docker image (?:tag|rm|prune)|docker rmi/);
  assert.doesNotMatch(workflow, /node "\$legacy_helper" (?:prepare|transition|export)/);
  assert.match(forwardHelper, /typeof helper\.readState !== 'function'/);
  assert.doesNotMatch(forwardHelper, /helper\.(?:prepareState|transitionState|writeExportFile)/);
});

test('workflow forces excluded medication, no migrations, service-only replacement, and sanitized output', () => {
  assert.match(workflow, /RUN_MIGRATIONS=false MEDICATION_EMAR_ENABLED=false APP_COMMIT_SHA="\$TARGET_SHA"/g);
  assert.match(workflow, /read_env_value RUN_MIGRATIONS/);
  assert.doesNotMatch(workflow, /read_env_value MEDICATION_EMAR_ENABLED/);
  assert.match(workflow, /build web api/);
  assert.match(workflow, /up -d --no-deps --no-build --pull never --wait --wait-timeout 180 api web caddy/);
  assert.doesNotMatch(workflow, /RUN_MIGRATIONS=true|MEDICATION_EMAR_ENABLED=true/i);
  assert.doesNotMatch(workflow, /prisma\s+migrate|migrate\s+deploy|pg_dump|pg_restore|backfill|docker compose[^\n]*exec/i);
  assert.doesNotMatch(workflow, /up[^\n]*(?:^|\s)postgres(?:\s|$)/m);
  assert.match(workflow, /unsafe_output=0/);
  assert.match(workflow, /REMOTE_OUTPUT_UNSAFE/);
  assert.doesNotMatch(workflow, /set -x|printenv|toJson|tee\s|cat\s+deploy\/v2\/\.env|curl\s+-[^\n]*[vViI]/);
});

test('failure handler records recoverable failure and contains no automatic rollback', () => {
  const failureHandler = workflow.match(/record_recoverable_failure\(\) \{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(failureHandler);
  assert.match(failureHandler, /NEXT_STATE=RECOVERABLE_FAILURE/);
  assert.match(failureHandler, /FORWARD_RECOVERY_REQUIRED/);
  assert.doesNotMatch(failureHandler, /compose| up |rollback|LEGACY_ROLLED_BACK/);
  assert.match(workflow, /FAILURE_CLASS=UNEXPECTED_FAILURE/);
  assert.match(workflow, /cleanup_remote/);
  const prepare = workflow.indexOf('node "$forward_helper" prepare');
  const armed = workflow.indexOf('failure_armed=1', prepare);
  const mutation = workflow.indexOf('NEXT_STATE=MUTATION_STARTED', armed);
  const exitTrap = workflow.indexOf("trap 'handle_remote_exit' EXIT");
  const complete = workflow.indexOf('NEXT_STATE=COMPLETE', exitTrap);
  const disarmed = workflow.indexOf('failure_armed=0', complete);
  assert(exitTrap < armed && armed < mutation && mutation < complete && complete < disarmed);
  assert.match(docs, /Forward Deployment From Durable Legacy Rollback/);
  assert.match(docs, /does not authorize or execute\s+production deployment/);
});

test('the reviewed remote shell is syntactically valid', () => {
  const match = workflow.match(/<<'REMOTE'\n([\s\S]*?)\n\s*REMOTE\n/);
  assert.ok(match, 'remote heredoc must remain extractable');
  const syntax = spawnSync('bash', ['-n'], {
    input: match[1].replace(/^ {10}/gm, ''),
    encoding: 'utf8',
  });
  assert.equal(syntax.status, 0, 'remote shell must pass bash -n');
  assert.equal(syntax.stderr, '');
});
