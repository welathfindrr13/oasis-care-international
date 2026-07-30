import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  STATES as LEGACY_STATES,
  prepareState as prepareLegacyState,
  transitionState as transitionLegacyState,
} from '../../deploy/v2/scripts/legacy-bootstrap-state.mjs';
import {
  EXPECTED_LEGACY_STATE,
  FETCH_DIAGNOSTIC_CATEGORIES,
  FORWARD_STATES,
  FORWARD_TARGET_SHA,
  adjudicateForwardStateUnderMutationLock,
  classifyGitFetchFailure,
  recordFetchDiagnostic,
  recordFailureEvidence,
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
const recoveryHelperPath = fileURLToPath(
  new URL('../../deploy/v2/scripts/forward-deploy-recovery.sh', import.meta.url),
);
const recoveryHelper = fs.readFileSync(recoveryHelperPath, 'utf8');
const forwardHelperPath = fileURLToPath(
  new URL('../../deploy/v2/scripts/forward-deploy-state.mjs', import.meta.url),
);
const revisionHelperPath = fileURLToPath(new URL('./revision-proof.mjs', import.meta.url));
const workflowSha = 'f'.repeat(40);
const forwardAttemptId = 'e'.repeat(32);
const legacyAttemptId = 'd'.repeat(32);
const reviewedTargetSha = 'fb10bdeb88b2be4924b4ee5cd0d22f88f872a7d6';
const staleTargetSha = '5c194b259f5a9d21c58d9f68c3f8b196843a894d';
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

function waitForPath(target, timeoutMs = 5000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(target)) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error(`timed out waiting for ${target}`));
      setTimeout(poll, 20);
    };
    poll();
  });
}

function waitForChild(child, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('child process timed out'));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

async function makeExecutableRecoveryFixture(t, { state = FORWARD_STATES.MUTATION_STARTED } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-recovery-exec-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, 'repository');
  const gitCommon = path.join(repositoryRoot, '.git');
  const oasisDeploy = path.join(gitCommon, 'oasis-deploy');
  const legacyStateDir = path.join(oasisDeploy, 'legacy-bootstrap-v1', 'state');
  const forwardRoot = path.join(oasisDeploy, 'forward-deployment-v1');
  fs.mkdirSync(oasisDeploy, { recursive: true, mode: 0o700 });
  fs.chmodSync(gitCommon, 0o700);
  fs.chmodSync(oasisDeploy, 0o700);
  prepareLegacyState({
    stateDir: legacyStateDir,
    targetSha: '7'.repeat(40),
    attemptId: legacyAttemptId,
    imageIds,
  });
  transitionLegacyState({ stateDir: legacyStateDir, targetSha: '7'.repeat(40), nextState: LEGACY_STATES.MUTATION_STARTED });
  transitionLegacyState({ stateDir: legacyStateDir, targetSha: '7'.repeat(40), nextState: LEGACY_STATES.ROLLBACK_REQUIRED });
  transitionLegacyState({ stateDir: legacyStateDir, targetSha: '7'.repeat(40), nextState: LEGACY_STATES.LEGACY_ROLLED_BACK });
  const binding = await readLegacyBinding({ legacyStateDir, legacyStateHelper: legacyHelperPath });
  await prepareForwardState({
    rootDir: forwardRoot,
    targetSha: FORWARD_TARGET_SHA,
    workflowSha,
    originMainSha: workflowSha,
    repository: 'welathfindrr13/oasis-care-international',
    attemptId: forwardAttemptId,
    legacyStateDir,
    legacyStateHelper: legacyHelperPath,
    expectedLegacyDigest: binding.digest,
    runningImageIds: imageIds,
  });
  if (state !== FORWARD_STATES.PREPARED) {
    transitionForwardState({ rootDir: forwardRoot, attemptId: forwardAttemptId, nextState: FORWARD_STATES.MUTATION_STARTED });
  }
  if (state === FORWARD_STATES.COMPLETE) {
    transitionForwardState({ rootDir: forwardRoot, attemptId: forwardAttemptId, nextState: FORWARD_STATES.COMPLETE });
  } else if (state === FORWARD_STATES.RECOVERABLE_FAILURE) {
    transitionForwardState({
      rootDir: forwardRoot,
      attemptId: forwardAttemptId,
      nextState: FORWARD_STATES.RECOVERABLE_FAILURE,
      failureClass: 'RUNTIME_REPLACEMENT_FAILED',
    });
  }

  const helperDir = fs.mkdtempSync('/tmp/oasis-forward-recovery-test.');
  t.after(() => fs.rmSync(helperDir, { recursive: true, force: true }));
  for (const [source, name, mode] of [
    [forwardHelperPath, 'forward-deploy-state.mjs', 0o600],
    [legacyHelperPath, 'legacy-bootstrap-state.mjs', 0o600],
    [revisionHelperPath, 'revision-proof.mjs', 0o600],
    [recoveryHelperPath, 'forward-deploy-recovery.sh', 0o700],
  ]) {
    fs.copyFileSync(source, path.join(helperDir, name));
    fs.chmodSync(path.join(helperDir, name), mode);
  }

  const toolsDir = path.join(root, 'tools');
  fs.mkdirSync(toolsDir, { mode: 0o700 });
  const commandLog = path.join(root, 'commands');
  const runtimeMode = path.join(root, 'runtime-mode');
  fs.writeFileSync(runtimeMode, 'target\n', { mode: 0o600 });
  const fakeGit = `#!/usr/bin/env bash
set -euo pipefail
[ "$1" = rev-parse ] && [ "$2" = --git-common-dir ]
printf '%s\n' "$TEST_GIT_COMMON"
`;
  const fakeNode = `#!/usr/bin/env bash
set -euo pipefail
script="$1"
shift
case "$(basename "$script")" in
  revision-proof.mjs)
    if [ "\${1:-}" = target_exact ] && [ "\${TARGET_PROOF:-success}" != success ]; then
      exit 1
    fi
    exit 0
    ;;
  *) exec "$REAL_NODE" "$script" "$@" ;;
esac
`;
  const fakeTimeout = `#!/usr/bin/env bash
set -euo pipefail
while [[ "$1" == --* ]]; do shift; done
shift
exec "$@"
`;
  const fakeDocker = `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = image ] && [ "$2" = inspect ]; then
  alias="\${5:-}"
  case "$alias" in
    oasis-legacy-bootstrap-api:*) printf '%s\n' '${imageIds.api}' ;;
    oasis-legacy-bootstrap-web:*) printf '%s\n' '${imageIds.web}' ;;
    oasis-legacy-bootstrap-caddy:*) printf '%s\n' '${imageIds.caddy}' ;;
    *) exit 1 ;;
  esac
  exit 0
fi
if [ "$1" = compose ]; then
  shift
  while [ "$1" != up ] && [ "$1" != ps ]; do shift; done
  operation="$1"
  shift
  if [ "$operation" = up ]; then
    printf '%s\n' "$*" >> "$COMMAND_LOG"
    grep 'image:' "$HELPER_DIR/recovery-rollback-override.yml" >> "$COMMAND_LOG"
    printf 'legacy\n' > "$RUNTIME_MODE"
    exit 0
  fi
  [ "$1" = -q ]
  case "$2" in
    api) printf '%s\n' '${'1'.repeat(64)}' ;;
    web) printf '%s\n' '${'2'.repeat(64)}' ;;
    caddy) printf '%s\n' '${'3'.repeat(64)}' ;;
    postgres) printf '%s\n' '${'4'.repeat(64)}' ;;
    *) exit 1 ;;
  esac
  exit 0
fi
if [ "$1" = inspect ]; then
  format="$3"
  container="$4"
  if [[ "$format" == *'.Image'* ]]; then
    mode="$(tr -d '\\r\\n' < "$RUNTIME_MODE")"
    case "$container" in
      ${'1'.repeat(64)}) [ "$mode" = legacy ] && printf '%s\n' '${imageIds.api}' || printf '%s\n' 'sha256:${'9'.repeat(64)}' ;;
      ${'2'.repeat(64)}) [ "$mode" = legacy ] && printf '%s\n' '${imageIds.web}' || printf '%s\n' 'sha256:${'8'.repeat(64)}' ;;
      ${'3'.repeat(64)}) printf '%s\n' '${imageIds.caddy}' ;;
      *) exit 1 ;;
    esac
  elif [[ "$format" == *'.State.ExitCode'* ]]; then
    printf 'running|healthy|0|false\n'
  else
    printf 'healthy\n'
  fi
  exit 0
fi
exit 1
`;
  for (const [name, contents] of [['git', fakeGit], ['node', fakeNode], ['timeout', fakeTimeout], ['docker', fakeDocker]]) {
    fs.writeFileSync(path.join(toolsDir, name), contents, { mode: 0o755 });
  }
  const env = {
    ...process.env,
    PATH: `${toolsDir}:${process.env.PATH}`,
    REAL_NODE: process.execPath,
    TEST_GIT_COMMON: gitCommon,
    COMMAND_LOG: commandLog,
    RUNTIME_MODE: runtimeMode,
    TARGET_SHA: FORWARD_TARGET_SHA,
    ATTEMPT_ID: forwardAttemptId,
    APP_URL: 'https://example.invalid',
    HELPER_DIR: helperDir,
    DIAGNOSTIC_TIMEOUT_SECONDS: '10',
    REVISION_PROOF_TIMEOUT_SECONDS: '30',
    STATE_OPERATION_TIMEOUT_SECONDS: '15',
    ROLLBACK_TIMEOUT_SECONDS: '300',
    SHORT_KILL_GRACE_SECONDS: '2',
    PHASE_KILL_GRACE_SECONDS: '15',
    RECOVERY_LOCK_WAIT_SECONDS: '5',
    OASIS_FORWARD_RECOVERY_TEST_MODE: '1',
    OASIS_FORWARD_REPOSITORY_ROOT: repositoryRoot,
  };
  return {
    root,
    repositoryRoot,
    gitCommon,
    legacyStateDir,
    forwardRoot,
    helperDir,
    stagedRecoveryHelper: path.join(helperDir, 'forward-deploy-recovery.sh'),
    commandLog,
    runtimeMode,
    env,
  };
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

test('state preparation accepts only the reviewed application target', async (t) => {
  assert.equal(FORWARD_TARGET_SHA, reviewedTargetSha);

  const reviewedFixture = makeFixture(t);
  const manifest = await prepareForward(reviewedFixture, { targetSha: reviewedTargetSha });
  assert.equal(manifest.targetSha, reviewedTargetSha);

  const staleFixture = makeFixture(t);
  await assert.rejects(
    prepareForward(staleFixture, { targetSha: staleTargetSha }),
    isForwardError,
  );
  assert.equal(fs.existsSync(staleFixture.forwardRoot), false);
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

test('completion adjudication fails closed before the marker and authenticates a marker written before an uncertain return', async (t) => {
  const beforeMarker = makeFixture(t);
  await prepareForward(beforeMarker);
  transitionForwardState({
    rootDir: beforeMarker.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.MUTATION_STARTED,
  });
  const beforeResult = adjudicateForwardStateUnderMutationLock({
    rootDir: beforeMarker.forwardRoot,
    attemptId: forwardAttemptId,
  });
  assert.equal(beforeResult.state, FORWARD_STATES.MUTATION_STARTED);
  const uncertain = transitionForwardState({
    rootDir: beforeMarker.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.COMPLETION_UNCERTAIN,
    failureClass: 'COMPLETION_STATE_UNCERTAIN',
  });
  assert.equal(uncertain.state, FORWARD_STATES.COMPLETION_UNCERTAIN);
  assert.throws(() => transitionForwardState({
    rootDir: beforeMarker.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.COMPLETE,
  }), isForwardError);

  const afterMarker = makeFixture(t);
  await prepareForward(afterMarker);
  transitionForwardState({
    rootDir: afterMarker.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.MUTATION_STARTED,
  });
  transitionForwardState({
    rootDir: afterMarker.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.COMPLETE,
  });
  const transitionLock = path.join(
    afterMarker.forwardRoot,
    'attempts',
    forwardAttemptId,
    'transition.lock',
  );
  fs.mkdirSync(transitionLock, { mode: 0o700 });
  const afterResult = adjudicateForwardStateUnderMutationLock({
    rootDir: afterMarker.forwardRoot,
    attemptId: forwardAttemptId,
  });
  assert.equal(afterResult.state, FORWARD_STATES.COMPLETE);
  assert.equal(fs.existsSync(transitionLock), false);
});

test('sanitized failure evidence is immutable, fixed-category, and bound to the initiating failure', async (t) => {
  const fixture = makeFixture(t);
  await prepareForward(fixture);
  transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.MUTATION_STARTED,
  });
  transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.RECOVERABLE_FAILURE,
    failureClass: 'RUNTIME_REPLACEMENT_FAILED',
  });
  const evidence = recordFailureEvidence({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    failureClass: 'RUNTIME_REPLACEMENT_FAILED',
    phase: 'RUNTIME_REPLACEMENT',
    serviceStates: {
      api: 'RUNNING_UNHEALTHY',
      web: 'MISSING',
      caddy: 'RUNNING_HEALTHY',
    },
    logCategories: {
      api: 'READINESS_FAILURE',
      web: 'READINESS_FAILURE',
      caddy: 'NO_MATCH',
    },
  });
  assert.equal(evidence.failureClass, 'RUNTIME_REPLACEMENT_FAILED');
  assert.equal(evidence.serviceStates.api, 'RUNNING_UNHEALTHY');
  assert.equal(evidence.serviceStates.web, 'MISSING');
  const state = readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId });
  assert.deepEqual(state.failureEvidence, evidence);
  assert.equal(state.failureClass, 'RUNTIME_REPLACEMENT_FAILED');
  assert.throws(() => recordFailureEvidence({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    failureClass: 'BUILD_FAILED',
    phase: 'BUILD',
    serviceStates: { api: 'OTHER', web: 'OTHER', caddy: 'OTHER' },
    logCategories: { api: 'NO_MATCH', web: 'NO_MATCH', caddy: 'NO_MATCH' },
  }), isForwardError);
  const evidencePath = path.join(
    fixture.forwardRoot,
    'attempts',
    forwardAttemptId,
    'failure-evidence.json',
  );
  assert.equal(fs.statSync(evidencePath).mode & 0o777, 0o600);
  assert.doesNotMatch(fs.readFileSync(evidencePath, 'utf8'), /password|secret|token/i);
});

test('fetch diagnostics preserve exact statuses and reduce stderr to credential-safe fixed categories', () => {
  const cases = [
    [23, 'fatal: index-pack failed', 'FETCH_PACK_FINALIZATION'],
    [42, 'fatal: an unclassified git failure', 'FETCH_UNKNOWN'],
    [124, 'secret=do-not-retain', 'FETCH_TIMEOUT'],
    [137, 'token=do-not-retain', 'FETCH_TERMINATED'],
    [143, 'Authorization: Bearer do-not-retain', 'FETCH_TERMINATED'],
    [1, 'fatal: Authentication failed for https://user:password@example.invalid/repo.git', 'FETCH_AUTHENTICATION'],
    [1, 'fatal: unable to access: Could not resolve host: example.invalid', 'FETCH_DNS'],
    [1, 'fatal: SSL certificate problem: certificate verify failed', 'FETCH_TLS'],
    [1, 'fatal: unable to connect: Network is unreachable', 'FETCH_NETWORK'],
    [1, "fatal: couldn't find remote ref main", 'FETCH_REMOTE_REF'],
    [1, 'error: RPC failed; curl 18 transfer closed with outstanding data', 'FETCH_PACK_TRANSFER'],
    [1, 'fatal: corrupt object detected', 'FETCH_OBJECT_CORRUPTION'],
    [1, "error: cannot lock ref 'refs/remotes/origin/main'", 'FETCH_REF_LOCK'],
    [1, 'fatal: No space left on device', 'FETCH_DISK'],
    [1, 'fatal: inode allocation exhausted', 'FETCH_INODE'],
  ];
  assert.deepEqual(new Set(cases.map(([, , category]) => category)), new Set(FETCH_DIAGNOSTIC_CATEGORIES));
  for (const [exitStatus, stderr, category] of cases) {
    assert.deepEqual(classifyGitFetchFailure({ exitStatus, stderr }), { exitStatus, category });
  }
  assert.deepEqual(
    classifyGitFetchFailure({
      exitStatus: 1,
      stderr: 'fatal: index-pack failed: No space left on device',
    }),
    { exitStatus: 1, category: 'FETCH_DISK' },
  );
});

test('fetch diagnostic state is immutable, exact-status, private, and survives the failure transition', async (t) => {
  const fixture = makeFixture(t);
  await prepareForward(fixture);
  transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.MUTATION_STARTED,
  });
  const recorded = recordFetchDiagnostic({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    exitStatus: 23,
    category: 'FETCH_PACK_FINALIZATION',
  });
  assert.deepEqual(recorded, { exitStatus: 23, category: 'FETCH_PACK_FINALIZATION' });
  assert.throws(() => recordFetchDiagnostic({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    exitStatus: 24,
    category: 'FETCH_UNKNOWN',
  }), isForwardError);
  assert.throws(() => transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.COMPLETE,
  }), isForwardError);
  assert.throws(() => transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.RECOVERABLE_FAILURE,
    failureClass: 'BUILD_FAILED',
  }), isForwardError);
  transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.RECOVERABLE_FAILURE,
    failureClass: 'CHECKOUT_FAILED',
  });
  const state = readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId });
  assert.deepEqual(state.fetchDiagnostic, recorded);
  const diagnosticPath = path.join(
    fixture.forwardRoot,
    'attempts',
    forwardAttemptId,
    'fetch-diagnostic.json',
  );
  assert.equal(fs.statSync(diagnosticPath).mode & 0o777, 0o600);
  const persisted = fs.readFileSync(diagnosticPath, 'utf8');
  assert.doesNotMatch(persisted, /password|secret|token|authorization/i);
});

test('success, controlled failure, unexpected exit, and TERM remove raw diagnostics but preserve recovery helpers', (t) => {
  function extractFunction(name) {
    const match = workflow.match(new RegExp(`^ {10}${name}\\(\\) \\{([\\s\\S]*?)^ {10}\\}$`, 'm'));
    assert.ok(match, `${name} must remain extractable`);
    return `${name}() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  }
  const cleanupSource = extractFunction('cleanup_remote');
  const safeStatusSource = extractFunction('safe_status');
  const exitSource = extractFunction('handle_remote_exit');
  const controlledSource = extractFunction('record_recoverable_failure');
  const recoverySource = extractFunction('recover_from_failure');
  const cases = [
    { name: 'success', armed: 0, action: 'exit 0', status: 0, output: '', evidence: null },
    {
      name: 'controlled',
      armed: 1,
      action: 'record_recoverable_failure BUILD_FAILED BUILD',
      status: 1,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_FAILURE_EVIDENCE_RECORDED\nFORWARD_ROLLBACK_COMPLETE\nFORWARD_RECOVERY_REQUIRED\n',
      evidence: 'BUILD_FAILED:BUILD',
    },
    {
      name: 'unexpected',
      armed: 1,
      action: 'false',
      status: 1,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_FAILURE_EVIDENCE_RECORDED\nFORWARD_ROLLBACK_COMPLETE\nFORWARD_RECOVERY_REQUIRED\n',
      evidence: 'UNEXPECTED_FAILURE:UNEXPECTED_EXIT',
    },
    {
      name: 'term',
      armed: 1,
      action: 'kill -TERM $$',
      status: 1,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_FAILURE_EVIDENCE_RECORDED\nFORWARD_ROLLBACK_COMPLETE\nFORWARD_RECOVERY_REQUIRED\n',
      evidence: 'UNEXPECTED_FAILURE:UNEXPECTED_EXIT',
    },
    {
      name: 'interrupted-fetch',
      armed: 1,
      action: 'false',
      status: 1,
      fetchPersisted: true,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_FAILURE_EVIDENCE_RECORDED\nFORWARD_ROLLBACK_COMPLETE\nFORWARD_RECOVERY_REQUIRED\n',
      evidence: 'CHECKOUT_FAILED:CHECKOUT',
    },
    {
      name: 'rollback-failure',
      armed: 1,
      action: 'record_recoverable_failure CONTAINER_HEALTH_FAILED CONTAINER_HEALTH',
      status: 1,
      rollbackFailure: true,
      output: 'FORWARD_STATE_RECOVERABLE_FAILURE\nFORWARD_FAILURE_EVIDENCE_RECORDED\nFORWARD_ROLLBACK_FAILED\nFORWARD_RECOVERY_REQUIRED\n',
      evidence: 'CONTAINER_HEALTH_FAILED:CONTAINER_HEALTH',
    },
  ];

  for (const testCase of cases) {
    const helperDir = fs.mkdtempSync(path.join(os.tmpdir(), `oasis-forward-cleanup-${testCase.name}-`));
    t.after(() => fs.rmSync(helperDir, { recursive: true, force: true }));
    const evidencePath = path.join(os.tmpdir(), `oasis-forward-evidence-${testCase.name}-${process.pid}`);
    t.after(() => fs.rmSync(evidencePath, { force: true }));
    const names = [
      'diagnostic',
      'legacy-binding',
      'caddy-override.yml',
      'rollback-override.yml',
      'forward-deploy-state.mjs',
      'forward-deploy-recovery.sh',
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
      rollback_override="$HELPER_DIR/rollback-override.yml"
      forward_helper="$HELPER_DIR/forward-deploy-state.mjs"
      legacy_helper="$HELPER_DIR/legacy-bootstrap-state.mjs"
      revision_helper="$HELPER_DIR/revision-proof.mjs"
      preflight_helper="$HELPER_DIR/preflight-env.mjs"
      forward_state_root=/synthetic
      ATTEMPT_ID=${forwardAttemptId}
      STATE_OPERATION_TIMEOUT_SECONDS=15
      DIAGNOSTIC_TIMEOUT_SECONDS=10
      SHORT_KILL_GRACE_SECONDS=2
      timeout() {
        while [[ "$1" == --* ]]; do shift; done
        shift
        if [ "$1" = env ]; then
          shift
          while [[ "$1" == *=* ]]; do export "$1"; shift; done
        fi
        "$@"
      }
      node() { return 0; }
      capture_sanitized_diagnostics() {
        api_state_category=RUNNING_UNHEALTHY
        web_state_category=MISSING
        caddy_state_category=RUNNING_HEALTHY
        api_log_category=READINESS_FAILURE
        web_log_category=READINESS_FAILURE
        caddy_log_category=NO_MATCH
      }
      fetch_diagnostic_is_persisted() {
        ${testCase.fetchPersisted ? 'return 0' : 'return 1'}
      }
      persist_failure_evidence() {
        printf '%s:%s' "$1" "$2" > "$TEST_EVIDENCE"
        printf 'FORWARD_FAILURE_EVIDENCE_RECORDED\n'
      }
      rollback_legacy_runtime() {
        ${testCase.rollbackFailure ? 'return 1' : "printf 'FORWARD_ROLLBACK_COMPLETE\\n'"}
      }
      failure_armed=${testCase.armed}
      ${cleanupSource}
      ${safeStatusSource}
      ${recoverySource}
      ${exitSource}
      ${controlledSource}
      trap 'handle_remote_exit' EXIT
      trap 'exit 1' HUP INT TERM
      ${testCase.action}
    `;
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: { ...process.env, TEST_HELPER_DIR: helperDir, TEST_EVIDENCE: evidencePath },
    });
    assert.equal(result.status, testCase.status, testCase.name);
    assert.equal(result.stdout, testCase.output, testCase.name);
    assert.equal(result.stderr, '', testCase.name);
    for (const name of ['diagnostic', 'legacy-binding', 'caddy-override.yml', 'rollback-override.yml']) {
      assert.equal(fs.existsSync(path.join(helperDir, name)), false, `${testCase.name} must remove ${name}`);
    }
    for (const name of ['forward-deploy-state.mjs', 'forward-deploy-recovery.sh', 'legacy-bootstrap-state.mjs', 'revision-proof.mjs']) {
      assert.equal(fs.existsSync(path.join(helperDir, name)), true, `${testCase.name} must preserve ${name}`);
    }
    assert.equal(
      fs.existsSync(evidencePath) ? fs.readFileSync(evidencePath, 'utf8') : null,
      testCase.evidence,
      `${testCase.name} must preserve the initiating category`,
    );
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
  const workflowTargetSha = workflow.match(/EXPECTED_TARGET_SHA:\s*([0-9a-f]{40})/)?.[1];
  assert.equal(workflowTargetSha, reviewedTargetSha);
  assert.equal(FORWARD_TARGET_SHA, workflowTargetSha);
  assert.match(
    recoveryHelper,
    new RegExp(`\\[ "\\$TARGET_SHA" = "${reviewedTargetSha}" \\] \\|\\| exit 1`),
  );
  assert.match(workflow, /EXPECTED_TARGET_SHA: fb10bdeb88b2be4924b4ee5cd0d22f88f872a7d6/);
  assert.match(
    workflow,
    /\[ "\$TARGET_SHA" = "fb10bdeb88b2be4924b4ee5cd0d22f88f872a7d6" \] \|\| fail_remote FORWARD_INPUTS_INVALID/,
  );
  assert.match(
    docs,
    /single-use recovery lane for one reviewed application target:\s*`fb10bdeb88b2be4924b4ee5cd0d22f88f872a7d6`/,
  );
  assert.doesNotMatch(
    docs,
    /single-use recovery lane for one reviewed application target:\s*`5c194b259f5a9d21c58d9f68c3f8b196843a894d`/,
  );
  assert.doesNotMatch(workflow, /5c194b259f5a9d21c58d9f68c3f8b196843a894d/);
  assert.doesNotMatch(forwardHelper, /5c194b259f5a9d21c58d9f68c3f8b196843a894d/);
  assert.doesNotMatch(recoveryHelper, /5c194b259f5a9d21c58d9f68c3f8b196843a894d/);
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
  const authenticatedLegacyProof = workflow.indexOf('node "$revision_helper" rollback_legacy', inspect);
  const running = workflow.indexOf('running_image=', inspect);
  const prepare = workflow.indexOf('node "$forward_helper" prepare', running);
  const mutation = workflow.indexOf('NEXT_STATE=MUTATION_STARTED', prepare);
  const checkout = workflow.indexOf('git checkout --detach "$2"', mutation);
  const build = workflow.indexOf('"${compose[@]}" build web api', checkout);
  const up = workflow.indexOf('up -d --no-deps --no-build --pull never', build);
  const exactProof = workflow.indexOf('node "$revision_helper" target_exact', up);
  const legacyProof = workflow.indexOf('node "$forward_helper" verify-legacy', exactProof);
  const complete = workflow.indexOf('NEXT_STATE=COMPLETE', legacyProof);
  for (const index of [inspect, authenticatedLegacyProof, running, prepare, mutation, checkout, build, up, exactProof, legacyProof, complete]) {
    assert.notEqual(index, -1);
  }
  assert(inspect < authenticatedLegacyProof && authenticatedLegacyProof < prepare);
  assert(inspect < running && running < prepare && prepare < mutation && mutation < checkout);
  assert(checkout < build && build < up && up < exactProof && exactProof < legacyProof && legacyProof < complete);
  assert.match(workflow, /verify_rollback_aliases/g);
  assert.match(workflow, /caddy_override[\s\S]*legacy_values\[CADDY_IMAGE_ALIAS\]/);
  assert.match(workflow, /running_image" = "\$\{legacy_values\[CADDY_IMAGE_ID\]\}"/);
  assert.doesNotMatch(workflow, /docker image (?:tag|rm|prune)|docker rmi/);
  assert.doesNotMatch(workflow, /node "\$legacy_helper" (?:prepare|transition|export)/);
  assert.match(forwardHelper, /typeof helper\.readState !== 'function'/);
  assert.doesNotMatch(forwardHelper, /helper\.(?:prepareState|transitionState|writeExportFile)/);
});

test('workflow forces excluded medication, no migrations, service-only replacement, and sanitized output', () => {
  assert.match(workflow, /RUN_MIGRATIONS=false MEDICATION_EMAR_ENABLED=false APP_COMMIT_SHA="\$TARGET_SHA"/g);
  assert.match(workflow, /run_migrations=.*awk[\s\S]*RUN_MIGRATIONS/);
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

test('effective deploy identity is enforced before helper staging, state preparation, and mutation', () => {
  assert.match(workflow, /OASIS_PRODUCTION_VPS_USER" = "deploy"/);
  assert.match(workflow, /effective_user="\$\(id -un 2>\/dev\/null\)" \|\| fail_target_probe DEPLOY_TARGET_IDENTITY_FAILED/);
  assert.match(workflow, /\[ "\$effective_user" = deploy \] \|\| fail_target_probe DEPLOY_TARGET_IDENTITY_FAILED/);
  assert.match(workflow, /\[ "\$\(id -un 2>\/dev\/null\)" = "deploy" \] \|\| fail_remote FORWARD_REMOTE_IDENTITY_INVALID/);
  const probe = workflow.indexOf("<<'FORWARD_REMOTE_TARGET_PROBE'");
  const helperDirectory = workflow.indexOf('mktemp -d /var/tmp/oasis-forward-deploy.', probe);
  const helperTransfer = workflow.indexOf('scp -q', helperDirectory);
  const remoteIdentity = workflow.indexOf('fail_remote FORWARD_REMOTE_IDENTITY_INVALID');
  const prepare = workflow.indexOf('node "$forward_helper" prepare');
  const mutation = workflow.indexOf('NEXT_STATE=MUTATION_STARTED', prepare);
  assert(probe !== -1 && probe < helperDirectory && helperDirectory < helperTransfer);
  assert(remoteIdentity < prepare && prepare < mutation);
  assert.doesNotMatch(workflow, /\[ "\$\(id -un[^\n]*" = "root"/);
});

test('remote target probe executes in Bash and gates helper creation and transfer', (t) => {
  const match = workflow.match(/<<'FORWARD_REMOTE_TARGET_PROBE'\n([\s\S]*?)\n {10}FORWARD_REMOTE_TARGET_PROBE/);
  assert.ok(match, 'remote target probe heredoc must remain extractable');
  const productionProbe = match[1].replace(/^ {10}/gm, '');
  const markerAssignment = 'target_class_file=/etc/oasis/production-deploy-target-class';
  assert.equal(productionProbe.split(markerAssignment).length - 1, 1);
  assert.match(productionProbe, /\[ -r "\$target_class_file" \] \|\|\n  fail_target_probe DEPLOY_TARGET_READABILITY_FAILED/);

  const stageStart = workflow.indexOf('      - name: Stage reviewed forward helpers');
  const stageEnd = workflow.indexOf('      - name: Run approved forward deployment', stageStart);
  const stage = workflow.slice(stageStart, stageEnd);
  const reducerMatch = stage.match(
    /          marker_status=\$\?\n([\s\S]*?)\n          printf 'FORWARD_REMOTE_IDENTITY_VALID\\n'\n          printf 'DEPLOY_TARGET_PRODUCTION\\n'/,
  );
  assert.ok(reducerMatch, 'target-probe reducer must remain extractable');
  const reducer = [
    'marker_status=$?',
    reducerMatch[1].replace(/^ {10}/gm, ''),
    "printf 'FORWARD_REMOTE_IDENTITY_VALID\\n'",
    "printf 'DEPLOY_TARGET_PRODUCTION\\n'",
  ].join('\n');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-target-probe-'));
  const toolsDir = path.join(root, 'tools');
  const etcDir = path.join(root, 'etc');
  const oasisDir = path.join(etcDir, 'oasis');
  const marker = path.join(oasisDir, 'production-deploy-target-class');
  const helperDirectory = path.join(root, 'remote-helper-directory');
  const transferMarker = path.join(root, 'helper-transfer');
  fs.mkdirSync(toolsDir, { mode: 0o700 });
  fs.writeFileSync(
    path.join(toolsDir, 'id'),
    '#!/usr/bin/env bash\nset -euo pipefail\nprintf \'%s\\n\' "$TEST_EFFECTIVE_USER"\n',
    { mode: 0o700 },
  );
  t.after(() => {
    if (fs.existsSync(marker)) fs.chmodSync(marker, 0o600);
    fs.rmSync(root, { recursive: true, force: true });
  });

  const executableProbe = productionProbe
    .replace(markerAssignment, 'target_class_file="$TEST_TARGET_CLASS_FILE"')
    .replace(
      'for target_class_parent in / /etc /etc/oasis; do',
      'for target_class_parent in "$TEST_ROOT" "$TEST_ETC_DIR" "$TEST_OASIS_DIR"; do',
    )
    .replace(
      '[ -r "$target_class_file" ] ||\n  fail_target_probe DEPLOY_TARGET_READABILITY_FAILED',
      '[ "${TEST_FORCE_UNREADABLE:-0}" != 1 ] && [ -r "$target_class_file" ] ||\n'
        + '  fail_target_probe DEPLOY_TARGET_READABILITY_FAILED',
    );
  const stageHarness = `
    set -euo pipefail
    marker_capture="$(mktemp)"
    marker_stderr="$(mktemp)"
    trap 'rm -f "$marker_capture" "$marker_stderr"' EXIT
    set +e
    case "$TEST_SSH_MODE" in
      remote)
        bash -se >"$marker_capture" 2>"$marker_stderr" <<'FORWARD_REMOTE_TARGET_PROBE'
${executableProbe}
FORWARD_REMOTE_TARGET_PROBE
        ;;
      status)
        : > "$marker_capture"
        printf 'raw transport detail must remain private\\n' > "$marker_stderr"
        false
        ;;
      mismatch)
        printf 'UNEXPECTED_REMOTE_OUTPUT\\n' > "$marker_capture"
        printf 'raw remote detail must remain private\\n' > "$marker_stderr"
        true
        ;;
      unknown-failure)
        printf 'UNEXPECTED_REMOTE_OUTPUT\\n' > "$marker_capture"
        printf 'raw remote detail must remain private\\n' > "$marker_stderr"
        false
        ;;
    esac
${reducer}
    mkdir "$TEST_HELPER_DIRECTORY"
    : > "$TEST_TRANSFER_MARKER"
  `;

  const runProbe = ({
    effectiveUser = 'deploy',
    markerContents,
    markerMode = 0o600,
    markerType = 'file',
    sshMode = 'remote',
    traversalFailure = false,
    forceUnreadable = false,
  } = {}) => {
    if (fs.existsSync(marker) && !fs.lstatSync(marker).isSymbolicLink()) fs.chmodSync(marker, 0o600);
    fs.rmSync(etcDir, { recursive: true, force: true });
    fs.rmSync(helperDirectory, { recursive: true, force: true });
    fs.rmSync(transferMarker, { force: true });
    fs.mkdirSync(etcDir, { mode: 0o700 });
    if (traversalFailure) {
      fs.writeFileSync(oasisDir, 'not a directory', { mode: 0o600 });
    } else {
      fs.mkdirSync(oasisDir, { mode: 0o700 });
    }
    if (!traversalFailure && markerType === 'file' && markerContents !== undefined) {
      fs.writeFileSync(marker, markerContents, { mode: markerMode });
      fs.chmodSync(marker, markerMode);
    } else if (!traversalFailure && markerType === 'symlink') {
      fs.symlinkSync(path.join(root, 'outside-marker'), marker);
    }
    const result = spawnSync('bash', ['-c', stageHarness], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${toolsDir}:${process.env.PATH}`,
        TEST_EFFECTIVE_USER: effectiveUser,
        TEST_TARGET_CLASS_FILE: marker,
        TEST_ROOT: root,
        TEST_ETC_DIR: etcDir,
        TEST_OASIS_DIR: oasisDir,
        TEST_FORCE_UNREADABLE: forceUnreadable ? '1' : '0',
        TEST_SSH_MODE: sshMode,
        TEST_HELPER_DIRECTORY: helperDirectory,
        TEST_TRANSFER_MARKER: transferMarker,
      },
    });
    if (fs.existsSync(marker) && !fs.lstatSync(marker).isSymbolicLink()) fs.chmodSync(marker, 0o600);
    return result;
  };

  const success = runProbe({ markerContents: 'production\n' });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(success.stdout, 'FORWARD_REMOTE_IDENTITY_VALID\nDEPLOY_TARGET_PRODUCTION\n');
  assert.equal(fs.existsSync(helperDirectory), true);
  assert.equal(fs.existsSync(transferMarker), true);

  for (const failure of [
    {
      name: 'SSH status',
      sshMode: 'status',
      category: 'DEPLOY_TARGET_SSH_STATUS_FAILED',
    },
    {
      name: 'wrong user',
      effectiveUser: 'root',
      markerContents: 'production\n',
      category: 'DEPLOY_TARGET_IDENTITY_FAILED',
    },
    {
      name: 'traversal',
      traversalFailure: true,
      category: 'DEPLOY_TARGET_TRAVERSAL_FAILED',
    },
    {
      name: 'missing proof',
      category: 'DEPLOY_TARGET_FILE_TYPE_FAILED',
    },
    {
      name: 'symlink proof',
      markerType: 'symlink',
      category: 'DEPLOY_TARGET_FILE_TYPE_FAILED',
    },
    {
      name: 'unreadable proof',
      markerContents: 'production\n',
      markerMode: 0o000,
      forceUnreadable: true,
      category: 'DEPLOY_TARGET_READABILITY_FAILED',
    },
    {
      name: 'incorrect proof',
      markerContents: 'staging\n',
      category: 'DEPLOY_TARGET_VALUE_COMPARISON_FAILED',
    },
    {
      name: 'successful SSH with unexpected output',
      sshMode: 'mismatch',
      category: 'DEPLOY_TARGET_OUTPUT_MISMATCH',
    },
    {
      name: 'failed SSH with unexpected output',
      sshMode: 'unknown-failure',
      category: 'DEPLOY_TARGET_OUTPUT_MISMATCH',
    },
  ]) {
    const result = runProbe(failure);
    assert.notEqual(result.status, 0, failure.name);
    assert.equal(result.stdout, '', failure.name);
    assert.equal(result.stderr, `${failure.category}\n`, failure.name);
    assert.doesNotMatch(result.stderr, /raw .* detail/, failure.name);
    assert.equal(fs.existsSync(helperDirectory), false, `${failure.name}: helper directory`);
    assert.equal(fs.existsSync(transferMarker), false, `${failure.name}: helper transfer`);
  }
});

test('the executable timing invariant bounds every post-mutation phase and reserves recovery margin', () => {
  const jobMinutes = Number(workflow.match(/timeout-minutes: (\d+)/)?.[1]);
  const stateSeconds = Number(workflow.match(/STATE_OPERATION_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const fetchSeconds = Number(workflow.match(/FETCH_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const checkoutSeconds = Number(workflow.match(/CHECKOUT_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const preflightSeconds = Number(workflow.match(/PREFLIGHT_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const buildSeconds = Number(workflow.match(/BUILD_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const diagnosticSeconds = Number(workflow.match(/DIAGNOSTIC_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const replacementSeconds = Number(workflow.match(/REPLACEMENT_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const rollbackSeconds = Number(workflow.match(/ROLLBACK_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const shortGrace = Number(workflow.match(/SHORT_KILL_GRACE_SECONDS: "(\d+)"/)?.[1]);
  const phaseGrace = Number(workflow.match(/PHASE_KILL_GRACE_SECONDS: "(\d+)"/)?.[1]);
  const verificationSeconds = Number(workflow.match(/TARGET_VERIFICATION_BUDGET_SECONDS: "(\d+)"/)?.[1]);
  const completionSeconds = Number(workflow.match(/COMPLETION_BUDGET_SECONDS: "(\d+)"/)?.[1]);
  const failureSeconds = Number(workflow.match(/FAILURE_DIAGNOSTIC_BUDGET_SECONDS: "(\d+)"/)?.[1]);
  const aliasGuardSeconds = Number(workflow.match(/LEGACY_ALIAS_GUARD_BUDGET_SECONDS: "(\d+)"/)?.[1]);
  const inlineRollbackSeconds = Number(workflow.match(/INLINE_ROLLBACK_BUDGET_SECONDS: "(\d+)"/)?.[1]);
  const cleanupSeconds = Number(workflow.match(/CLEANUP_BUDGET_SECONDS: "(\d+)"/)?.[1]);
  const postMutationSeconds = Number(workflow.match(/POST_MUTATION_MAX_SECONDS: "(\d+)"/)?.[1]);
  const recoveryWaitSeconds = Number(workflow.match(/RECOVERY_LOCK_WAIT_SECONDS: "(\d+)"/)?.[1]);
  const recoveryMarginSeconds = Number(workflow.match(/RECOVERY_LOCK_SAFETY_MARGIN_SECONDS: "(\d+)"/)?.[1]);
  const transportSeconds = Number(workflow.match(/TRANSPORT_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  const transportKillGraceSeconds = Number(workflow.match(/TRANSPORT_KILL_GRACE_SECONDS: "(\d+)"/)?.[1]);
  const reconnectSeconds = Number(workflow.match(/RECOVERY_RECONNECT_TIMEOUT_SECONDS: "(\d+)"/)?.[1]);
  assert.equal(jobMinutes, 45);
  assert.equal(diagnosticSeconds, 10);
  const computed = stateSeconds + shortGrace
    + fetchSeconds + shortGrace
    + checkoutSeconds + shortGrace
    + preflightSeconds + shortGrace
    + buildSeconds + phaseGrace
    + aliasGuardSeconds
    + replacementSeconds + phaseGrace
    + verificationSeconds + completionSeconds + failureSeconds + inlineRollbackSeconds + cleanupSeconds;
  assert.equal(computed, postMutationSeconds);
  assert.equal(recoveryWaitSeconds, postMutationSeconds + recoveryMarginSeconds);
  assert.equal(recoveryMarginSeconds, 50);
  assert(recoveryWaitSeconds > postMutationSeconds);
  assert(transportKillGraceSeconds > inlineRollbackSeconds);
  assert.equal(rollbackSeconds, 300);
  assert(transportSeconds + transportKillGraceSeconds + reconnectSeconds + 135 <= jobMinutes * 60);
  assert.match(workflow, /computed_post_mutation_max=/);
  assert.match(workflow, /POST_MUTATION_MAX_SECONDS \+ RECOVERY_LOCK_SAFETY_MARGIN_SECONDS/);
  assert.match(workflow, /timeout --foreground --signal=TERM --kill-after="\$\{PHASE_KILL_GRACE_SECONDS\}s" "\$\{BUILD_TIMEOUT_SECONDS\}s"/);
  assert.match(workflow, /timeout --foreground --signal=TERM --kill-after="\$\{PHASE_KILL_GRACE_SECONDS\}s" "\$\{REPLACEMENT_TIMEOUT_SECONDS\}s"/);
  assert.match(workflow, /timeout --foreground --signal=TERM --kill-after="\$\{PHASE_KILL_GRACE_SECONDS\}s" "\$\{ROLLBACK_TIMEOUT_SECONDS\}s"/);
  assert.match(workflow, /timeout --foreground --signal=TERM --kill-after="\$\{TRANSPORT_KILL_GRACE_SECONDS\}s" "\$\{TRANSPORT_TIMEOUT_SECONDS\}s"/);
  assert.match(workflow, /RECOVERY_RECONNECT_TIMEOUT_SECONDS/);
  assert.match(workflow, /ServerAliveInterval=15/);
  assert.match(workflow, /ServerAliveCountMax=3/);
  assert.match(workflow, /124\|137\|143[\s\S]*FORWARD_TRANSPORT_TIMEOUT/);
});

test('post-mutation git fetch is bounded and a real timeout is reduced to a fixed category', (t) => {
  if (process.platform === 'darwin') {
    t.skip('GNU timeout semantics are exercised on GitHub Linux CI');
    return;
  }
  const extractFunction = (name) => {
    const match = workflow.match(new RegExp(`^ {10}${name}\\(\\) \\{([\\s\\S]*?)^ {10}\\}$`, 'm'));
    assert.ok(match, `${name} must remain extractable`);
    return `${name}() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-fetch-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fakeGit = path.join(root, 'git');
  const commandLog = path.join(root, 'command');
  fs.writeFileSync(fakeGit, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" > "$COMMAND_LOG"\nsleep 30\n`, { mode: 0o755 });
  const script = `
    set -euo pipefail
    diagnostic_file="$TEST_ROOT/diagnostic"
    HELPER_DIR="$TEST_ROOT"
    fetch_diagnostic_file="$HELPER_DIR/fetch-diagnostic.raw"
    FETCH_TIMEOUT_SECONDS=1
    SHORT_KILL_GRACE_SECONDS=1
    ${extractFunction('safe_status')}
    ${extractFunction('bounded_git_fetch')}
    ${extractFunction('classify_fetch_status')}
    set +e
    bounded_git_fetch
    status=$?
    set -e
    classify_fetch_status "$status"
    printf 'STATUS=%s\\n' "$status"
  `;
  const started = Date.now();
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${root}:${process.env.PATH}`, TEST_ROOT: root, COMMAND_LOG: commandLog },
    timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^FORWARD_FETCH_TIMEOUT\nSTATUS=124\n$/);
  assert(Date.now() - started < 5000);
  assert.equal(fs.readFileSync(commandLog, 'utf8').trim(), 'fetch --no-tags origin main');
});

test('executable fetch wrapper persists safe evidence before deleting raw stderr and fails closed on persistence errors', async (t) => {
  if (process.platform === 'darwin') {
    t.skip('GNU timeout semantics are exercised on GitHub Linux CI');
    return;
  }
  const extractFunction = (name) => {
    const match = workflow.match(new RegExp(`^ {10}${name}\\(\\) \\{([\\s\\S]*?)^ {10}\\}$`, 'm'));
    assert.ok(match, `${name} must remain extractable`);
    return `${name}() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-fetch-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fakeGit = path.join(root, 'git');
  fs.writeFileSync(fakeGit, `#!/usr/bin/env bash
printf '%s' "$FAKE_GIT_STDERR" >&2
exit "$FAKE_GIT_STATUS"
`, { mode: 0o755 });

  async function readyState() {
    const fixture = makeFixture(t);
    await prepareForward(fixture);
    transitionForwardState({
      rootDir: fixture.forwardRoot,
      attemptId: forwardAttemptId,
      nextState: FORWARD_STATES.MUTATION_STARTED,
    });
    return fixture;
  }

  function execute({ fixture, status, stderr, failPersistence = false }) {
    const helperDir = fs.mkdtempSync(path.join(root, 'helper-'));
    const script = `
      set -euo pipefail
      diagnostic_file="$HELPER_DIR/general-diagnostic"
      fetch_diagnostic_file="$HELPER_DIR/fetch-diagnostic.raw"
      forward_helper="$FORWARD_HELPER"
      forward_state_root="$FORWARD_ROOT"
      ATTEMPT_ID="$FORWARD_ATTEMPT_ID"
      FETCH_TIMEOUT_SECONDS=5
      STATE_OPERATION_TIMEOUT_SECONDS=5
      SHORT_KILL_GRACE_SECONDS=1
      ${extractFunction('safe_status')}
      ${extractFunction('bounded_git_fetch')}
      ${extractFunction('persist_fetch_diagnostic')}
      set +e
      bounded_git_fetch
      status=$?
      set -e
      if [ "$status" -eq 0 ]; then
        rm -f -- "$fetch_diagnostic_file"
        printf 'FETCH_SUCCEEDED\\n'
        exit 0
      fi
      if persist_fetch_diagnostic "$status"; then
        printf 'FETCH_PERSISTED_STATUS=%s\\n' "$status"
      else
        printf 'FORWARD_FETCH_DIAGNOSTIC_PERSISTENCE_FAILED\\n'
        exit 9
      fi
    `;
    const result = spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        HELPER_DIR: helperDir,
        FORWARD_HELPER: forwardHelperPath,
        FORWARD_ROOT: failPersistence ? path.join(root, 'missing-state') : fixture.forwardRoot,
        FORWARD_ATTEMPT_ID: forwardAttemptId,
        FAKE_GIT_STATUS: String(status),
        FAKE_GIT_STDERR: stderr,
      },
    });
    return { result, helperDir };
  }

  const packFixture = await readyState();
  const pack = execute({
    fixture: packFixture,
    status: 23,
    stderr: 'fatal: index-pack failed https://user:password@example.invalid/repo.git?token=top-secret',
  });
  assert.equal(pack.result.status, 0, pack.result.stderr);
  assert.match(pack.result.stdout, /FORWARD_FETCH_DIAGNOSTIC_RECORDED/);
  assert.match(pack.result.stdout, /FORWARD_FETCH_CATEGORY_FETCH_PACK_FINALIZATION/);
  assert.match(pack.result.stdout, /FETCH_PERSISTED_STATUS=23/);
  assert.doesNotMatch(pack.result.stdout + pack.result.stderr, /password|top-secret|user:/i);
  assert.equal(fs.existsSync(path.join(pack.helperDir, 'fetch-diagnostic.raw')), false);
  assert.deepEqual(
    readForwardState({ rootDir: packFixture.forwardRoot, attemptId: forwardAttemptId }).fetchDiagnostic,
    { exitStatus: 23, category: 'FETCH_PACK_FINALIZATION' },
  );

  const unknownFixture = await readyState();
  const unknown = execute({
    fixture: unknownFixture,
    status: 42,
    stderr: 'fatal: something new Authorization: Bearer private-value',
  });
  assert.equal(unknown.result.status, 0, unknown.result.stderr);
  assert.match(unknown.result.stdout, /FORWARD_FETCH_CATEGORY_FETCH_UNKNOWN/);
  assert.match(unknown.result.stdout, /FETCH_PERSISTED_STATUS=42/);
  assert.doesNotMatch(unknown.result.stdout + unknown.result.stderr, /private-value|Bearer/i);
  assert.deepEqual(
    readForwardState({ rootDir: unknownFixture.forwardRoot, attemptId: forwardAttemptId }).fetchDiagnostic,
    { exitStatus: 42, category: 'FETCH_UNKNOWN' },
  );

  const failedFixture = await readyState();
  const persistenceFailure = execute({
    fixture: failedFixture,
    status: 17,
    stderr: 'fatal: index-pack failed token=must-remain-private',
    failPersistence: true,
  });
  assert.equal(persistenceFailure.result.status, 9);
  assert.match(persistenceFailure.result.stdout, /^FORWARD_FETCH_DIAGNOSTIC_PERSISTENCE_FAILED\n$/);
  assert.doesNotMatch(persistenceFailure.result.stdout + persistenceFailure.result.stderr, /must-remain-private/i);
  assert.equal(fs.existsSync(path.join(persistenceFailure.helperDir, 'fetch-diagnostic.raw')), true);

  const successFixture = await readyState();
  const success = execute({ fixture: successFixture, status: 0, stderr: '' });
  assert.equal(success.result.status, 0, success.result.stderr);
  assert.equal(success.result.stdout, 'FETCH_SUCCEEDED\n');
  assert.equal(fs.existsSync(path.join(success.helperDir, 'fetch-diagnostic.raw')), false);
  assert.equal(
    readForwardState({ rootDir: successFixture.forwardRoot, attemptId: forwardAttemptId }).fetchDiagnostic,
    null,
  );
});

test('detached recovery reporting validates and consumes the persisted fetch status and category', async (t) => {
  if (process.platform === 'darwin') {
    t.skip('the production recovery helper is exercised on GitHub Linux CI');
    return;
  }
  const fixture = makeFixture(t);
  await prepareForward(fixture);
  transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.MUTATION_STARTED,
  });
  recordFetchDiagnostic({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    exitStatus: 23,
    category: 'FETCH_PACK_FINALIZATION',
  });
  transitionForwardState({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    nextState: FORWARD_STATES.RECOVERABLE_FAILURE,
    failureClass: 'CHECKOUT_FAILED',
  });
  recordFailureEvidence({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    failureClass: 'CHECKOUT_FAILED',
    phase: 'CHECKOUT',
    serviceStates: { api: 'RUNNING_HEALTHY', web: 'RUNNING_HEALTHY', caddy: 'RUNNING_HEALTHY' },
    logCategories: { api: 'NO_MATCH', web: 'NO_MATCH', caddy: 'NO_MATCH' },
  });
  const match = recoveryHelper.match(/^ensure_existing_failure_evidence\(\) \{([\s\S]*?)^\}$/m);
  assert.ok(match, 'ensure_existing_failure_evidence must remain executable');
  const functionSource = `ensure_existing_failure_evidence() {${match[1]}\n}`;
  const diagnostic = path.join(fixture.root, 'recovery-diagnostic');
  const script = `
    set -euo pipefail
    STATE_OPERATION_TIMEOUT_SECONDS=5
    SHORT_KILL_GRACE_SECONDS=1
    forward_state_root="$FORWARD_ROOT"
    ATTEMPT_ID="$FORWARD_ATTEMPT_ID"
    forward_helper="$FORWARD_HELPER"
    diagnostic_file="$RECOVERY_DIAGNOSTIC"
    record_recovery_evidence() { return 99; }
    ${functionSource}
    ensure_existing_failure_evidence
    printf 'RECOVERY_FETCH_DIAGNOSTIC_CONSUMED\\n'
  `;
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FORWARD_ROOT: fixture.forwardRoot,
      FORWARD_ATTEMPT_ID: forwardAttemptId,
      FORWARD_HELPER: forwardHelperPath,
      RECOVERY_DIAGNOSTIC: diagnostic,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'RECOVERY_FETCH_DIAGNOSTIC_CONSUMED\n');
});

test('runner cleanup deletes helpers only for conclusively verified terminal results', () => {
  const match = workflow.match(/^ {10}recovery_result_is_conclusively_safe\(\) \{([\s\S]*?)^ {10}\}$/m);
  assert.ok(match);
  const source = `recovery_result_is_conclusively_safe() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  const cleanupMatch = workflow.match(/^ {10}recovery_helper_cleanup_is_safe\(\) \{([\s\S]*?)^ {10}\}$/m);
  assert.ok(cleanupMatch);
  const cleanupSource = `recovery_helper_cleanup_is_safe() {${cleanupMatch[1].replace(/^ {10}/gm, '')}\n}`;
  const cases = [
    ['FORWARD_RECOVERY_COMPLETE_VERIFIED', 0],
    ['FORWARD_RECOVERY_LEGACY_VERIFIED', 0],
    ['FORWARD_RECOVERY_NO_MUTATION', 0],
    ['FORWARD_RECOVERY_LEGACY_VERIFIED_STATE_UNCERTAIN', 1],
    ['FORWARD_RECOVERY_ROLLBACK_FAILED', 1],
    ['FORWARD_RECOVERY_STATE_UNCERTAIN', 1],
    ['FORWARD_RECOVERY_SUPERVISOR_FAILED', 1],
    ['FORWARD_RECOVERY_RECONNECT_FAILED', 1],
  ];
  for (const [category, expected] of cases) {
    const result = spawnSync('bash', ['-c', `set +e\n${source}\nrecovery_result_is_conclusively_safe "$1"`, 'bash', category]);
    assert.equal(result.status, expected, category);
  }
  const safeCleanup = spawnSync('bash', ['-c', `set +e\n${source}\n${cleanupSource}\nrecovery_helper_cleanup_is_safe "$1" "$2"`, 'bash', 'FORWARD_RECOVERY_LEGACY_VERIFIED', '0']);
  assert.equal(safeCleanup.status, 0);
  const persistenceUncertain = spawnSync('bash', ['-c', `set +e\n${source}\n${cleanupSource}\nrecovery_helper_cleanup_is_safe "$1" "$2"`, 'bash', 'FORWARD_RECOVERY_LEGACY_VERIFIED', '1']);
  assert.equal(persistenceUncertain.status, 1);
  assert.doesNotMatch(workflow, /FORWARD_RECOVERY_LOCK_TIMEOUT/);
  assert.match(workflow, /FORWARD_RECOVERY_HELPERS_PRESERVED/);
});

test('positive supervisor handshake precedes mutation and closes inherited mutation-lock fd 9', (t) => {
  if (process.platform === 'darwin') {
    t.skip('setsid and Linux descriptor inspection are exercised on GitHub Linux CI');
    return;
  }
  const match = workflow.match(/^ {10}launch_recovery_supervisor\(\) \{([\s\S]*?)^ {10}\}$/m);
  assert.ok(match);
  const source = `launch_recovery_supervisor() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-supervisor-handshake-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const helper = path.join(root, 'forward-deploy-recovery.sh');
  const descriptor = path.join(root, 'descriptor');
  const order = path.join(root, 'order');
  fs.writeFileSync(helper, `#!/usr/bin/env bash\nset -euo pipefail\nif [ -e /proc/$$/fd/9 ]; then printf 'OPEN\\n' > "$DESCRIPTOR_FILE"; else printf 'CLOSED\\n' > "$DESCRIPTOR_FILE"; fi\nprintf 'supervisor\\n' >> "$ORDER_FILE"\nprintf 'FORWARD_RECOVERY_SUPERVISOR_READY\\n' > "$HELPER_DIR/recovery-supervisor-ready"\nchmod 600 "$HELPER_DIR/recovery-supervisor-ready"\n`, { mode: 0o700 });
  const script = `
    set -euo pipefail
    recovery_helper="$TEST_ROOT/forward-deploy-recovery.sh"
    recovery_result="$TEST_ROOT/recovery-result"
    recovery_ready="$TEST_ROOT/recovery-supervisor-ready"
    HELPER_DIR="$TEST_ROOT"
    TARGET_SHA=${FORWARD_TARGET_SHA}
    ATTEMPT_ID=${forwardAttemptId}
    APP_URL=https://example.invalid
    DIAGNOSTIC_TIMEOUT_SECONDS=10
    REVISION_PROOF_TIMEOUT_SECONDS=30
    STATE_OPERATION_TIMEOUT_SECONDS=15
    SHORT_KILL_GRACE_SECONDS=2
    PHASE_KILL_GRACE_SECONDS=15
    ROLLBACK_TIMEOUT_SECONDS=300
    RECOVERY_LOCK_WAIT_SECONDS=2692
    RECOVERY_SUPERVISOR_HANDSHAKE_SECONDS=10
    exec 9>"$TEST_ROOT/parent-mutation.lock"
    ${source}
    launch_recovery_supervisor
    printf 'mutation\\n' >> "$ORDER_FILE"
  `;
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, TEST_ROOT: root, DESCRIPTOR_FILE: descriptor, ORDER_FILE: order },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(descriptor, 'utf8').trim(), 'CLOSED');
  assert.equal(fs.readFileSync(order, 'utf8'), 'supervisor\nmutation\n');
  const launch = workflow.indexOf('launch_recovery_supervisor ||');
  const mutation = workflow.indexOf('NEXT_STATE=MUTATION_STARTED', launch);
  assert(launch !== -1 && mutation > launch);
  assert.match(source, /9>&-/);
});

test('closed SSH output pipe cannot prevent inline legacy rollback', (t) => {
  const extractFunction = (name) => {
    const match = workflow.match(new RegExp(`^ {10}${name}\\(\\) \\{([\\s\\S]*?)^ {10}\\}$`, 'm'));
    assert.ok(match, `${name} must remain extractable`);
    return `${name}() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  };
  const marker = path.join(os.tmpdir(), `oasis-forward-epipe-rollback-${process.pid}`);
  fs.rmSync(marker, { force: true });
  t.after(() => fs.rmSync(marker, { force: true }));
  const script = `
    set -euo pipefail
    forward_state_root=/synthetic
    ATTEMPT_ID=${forwardAttemptId}
    forward_helper=/synthetic/state.mjs
    diagnostic_file=/dev/null
    STATE_OPERATION_TIMEOUT_SECONDS=15
    SHORT_KILL_GRACE_SECONDS=2
    failure_armed=1
    timeout() {
      while [[ "$1" == --* ]]; do shift; done
      shift
      if [ "$1" = env ]; then
        shift
        while [[ "$1" == *=* ]]; do export "$1"; shift; done
      fi
      "$@"
    }
    node() { return 0; }
    capture_sanitized_diagnostics() { api_state_category=OTHER; web_state_category=OTHER; caddy_state_category=OTHER; api_log_category=NO_MATCH; web_log_category=NO_MATCH; caddy_log_category=NO_MATCH; }
    persist_failure_evidence() { safe_status FORWARD_FAILURE_EVIDENCE_RECORDED; }
    rollback_legacy_runtime() { touch "$ROLLBACK_MARKER"; return 0; }
    ${extractFunction('safe_status')}
    ${extractFunction('recover_from_failure')}
    exec 1>&-
    set +e
    recover_from_failure UNEXPECTED_FAILURE UNEXPECTED_EXIT
    set -e
    [ -f "$ROLLBACK_MARKER" ]
  `;
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, ROLLBACK_MARKER: marker },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(marker), true);
});

test('API-unhealthy and web-blocked replacement evidence is classified without emitting raw logs', (t) => {
  function extractFunction(name) {
    const match = workflow.match(new RegExp(`^ {10}${name}\\(\\) \\{([\\s\\S]*?)^ {10}\\}$`, 'm'));
    assert.ok(match, `${name} must remain extractable`);
    return `${name}() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  }
  const stateSource = extractFunction('service_state_category');
  const logSource = extractFunction('service_log_category');
  const diagnostic = path.join(os.tmpdir(), `oasis-forward-diagnostic-${process.pid}`);
  t.after(() => fs.rmSync(diagnostic, { force: true }));
  fs.writeFileSync(
    diagnostic,
    'dependency failed to start: container oasis-care-v2-api-1 is unhealthy SENSITIVE_SENTINEL',
    { mode: 0o600 },
  );
  const script = `
    set -euo pipefail
    diagnostic_file="$TEST_DIAGNOSTIC"
    diagnostic_material="$(<"$diagnostic_file")"
    api_id=${'a'.repeat(64)}
    fake_compose() {
      service="\${!#}"
      if [ "$service" = api ]; then printf '%s\\n' "$api_id"; fi
    }
    docker() {
      if [ "$1" = inspect ]; then printf 'running|starting|0|false\\n'; return; fi
      if [ "$1" = logs ]; then return 0; fi
      return 1
    }
    timeout() { while [[ "$1" == --* ]]; do shift; done; shift; "$@"; }
    SHORT_KILL_GRACE_SECONDS=2
    DIAGNOSTIC_TIMEOUT_SECONDS=10
    compose=(fake_compose)
    ${stateSource}
    ${logSource}
    printf 'API=%s\\n' "$(service_state_category api)"
    printf 'WEB=%s\\n' "$(service_state_category web)"
    printf 'API_LOG=%s\\n' "$(service_log_category api)"
    printf 'WEB_LOG=%s\\n' "$(service_log_category web)"
  `;
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, TEST_DIAGNOSTIC: diagnostic },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    'API=RUNNING_UNHEALTHY\nWEB=MISSING\nAPI_LOG=READINESS_FAILURE\nWEB_LOG=READINESS_FAILURE\n',
  );
  assert.doesNotMatch(result.stdout + result.stderr, /SENSITIVE_SENTINEL/);
});

test('automatic rollback uses only immutable aliases and verifies private and public legacy health', () => {
  const rollback = workflow.match(/^ {10}rollback_legacy_runtime\(\) \{([\s\S]*?)^ {10}\}$/m)?.[1];
  const recovery = workflow.match(/^ {10}recover_from_failure\(\) \{([\s\S]*?)^ {10}\}$/m)?.[1];
  assert.ok(rollback);
  assert.ok(recovery);
  assert.match(rollback, /API_IMAGE_ALIAS/);
  assert.match(rollback, /WEB_IMAGE_ALIAS/);
  assert.match(rollback, /CADDY_IMAGE_ALIAS/);
  assert.match(rollback, /up -d --no-deps --no-build --pull never --wait --wait-timeout 180 api web caddy/);
  assert.match(rollback, /ps -q postgres/);
  assert.match(rollback, /TARGET_SHA="\$\{legacy_values\[LEGACY_TARGET_SHA\]\}"[\s\S]*rollback_legacy/);
  assert.match(rollback, /node "\$forward_helper" verify-legacy/);
  assert.match(rollback, /verify_rollback_aliases/g);
  assert.match(rollback, /RUN_MIGRATIONS=false/);
  assert.doesNotMatch(rollback, /(?:compose\[@\]|docker compose)[^\n]*\sbuild\s|git (?:fetch|pull|checkout)|docker (?:pull|image tag|image rm|rmi)|RUN_MIGRATIONS=true|prisma\s+migrate|migrate\s+deploy|pg_dump|pg_restore|exec /i);
  assert.match(recovery, /next_state=RECOVERABLE_FAILURE/);
  assert.match(recovery, /NEXT_STATE="\$next_state" FAILURE_CLASS="\$failure_class"/);
  assert.match(recovery, /persist_failure_evidence/);
  assert.match(recovery, /rollback_legacy_runtime/);
  assert.match(recovery, /FORWARD_ROLLBACK_FAILED/);
  assert.match(recovery, /FORWARD_RECOVERY_REQUIRED/);
  assert.match(workflow, /FAILURE_CLASS=UNEXPECTED_FAILURE|recover_from_failure UNEXPECTED_FAILURE UNEXPECTED_EXIT/);
  assert.match(docs, /Forward Deployment From Durable Legacy Rollback/);
  assert.match(docs, /does not authorize or execute\s+production deployment/);
});

test('rollback completes only when restored aliases and every health proof pass', (t) => {
  if (process.platform === 'darwin') {
    t.skip('the production workflow requires Bash 4 associative arrays; exercised on GitHub Linux CI');
    return;
  }
  const match = workflow.match(/^ {10}rollback_legacy_runtime\(\) \{([\s\S]*?)^ {10}\}$/m);
  assert.ok(match);
  const rollbackSource = `rollback_legacy_runtime() {${match[1].replace(/^ {10}/gm, '')}\n}`;
  const toolsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-rollback-tools-'));
  t.after(() => fs.rmSync(toolsDir, { recursive: true, force: true }));
  const commandLog = path.join(toolsDir, 'commands');
  const dockerScript = `#!/usr/bin/env bash
set -euo pipefail
if [ "$1" = compose ]; then
  shift
  while [ "$1" != up ] && [ "$1" != ps ]; do shift; done
  operation="$1"
  shift
  if [ "$operation" = up ]; then
    printf '%s\\n' "$*" >> "$COMMAND_LOG"
    exit 0
  fi
  [ "$1" = -q ]
  case "$2" in
    api) printf '%s\\n' '${'1'.repeat(64)}' ;;
    web) printf '%s\\n' '${'2'.repeat(64)}' ;;
    caddy) printf '%s\\n' '${'3'.repeat(64)}' ;;
    postgres) printf '%s\\n' '${'4'.repeat(64)}' ;;
    *) exit 1 ;;
  esac
  exit 0
fi
if [ "$1" = inspect ]; then
  format="$3"
  container="$4"
  if [[ "$format" == *'.Image'* ]]; then
    case "$container" in
      ${'1'.repeat(64)}) printf '%s\\n' "sha256:${'a'.repeat(64)}" ;;
      ${'2'.repeat(64)}) printf '%s\\n' "sha256:${'b'.repeat(64)}" ;;
      ${'3'.repeat(64)}) printf '%s\\n' "sha256:${'c'.repeat(64)}" ;;
      *) exit 1 ;;
    esac
  elif [ "\${FAIL_API_HEALTH:-0}" = 1 ] && [ "$container" = '${'1'.repeat(64)}' ]; then
    printf 'unhealthy\\n'
  else
    printf 'healthy\\n'
  fi
  exit 0
fi
exit 1
`;
  const timeoutScript = `#!/usr/bin/env bash
set -euo pipefail
while [[ "$1" == --* ]]; do shift; done
shift
exec "$@"
`;
  const nodeScript = `#!/usr/bin/env bash
set -euo pipefail
printf 'node:%s\\n' "$1" >> "$COMMAND_LOG"
case "$1" in
  *revision*) printf 'REVISION_AWARE_EXACT\\n' ;;
  *) printf 'FORWARD_LEGACY_STATE_UNCHANGED\\n' ;;
esac
`;
  fs.writeFileSync(path.join(toolsDir, 'docker'), dockerScript, { mode: 0o755 });
  fs.writeFileSync(path.join(toolsDir, 'timeout'), timeoutScript, { mode: 0o755 });
  fs.writeFileSync(path.join(toolsDir, 'node'), nodeScript, { mode: 0o755 });
  const shell = `
    set -euo pipefail
    declare -A legacy_values=(
      ["LEGACY_TARGET_SHA"]=${'7'.repeat(40)}
      ["API_IMAGE_ALIAS"]=oasis-legacy-bootstrap-api:${legacyAttemptId}
      ["WEB_IMAGE_ALIAS"]=oasis-legacy-bootstrap-web:${legacyAttemptId}
      ["CADDY_IMAGE_ALIAS"]=oasis-legacy-bootstrap-caddy:${legacyAttemptId}
      ["API_IMAGE_ID"]=sha256:${'a'.repeat(64)}
      ["WEB_IMAGE_ID"]=sha256:${'b'.repeat(64)}
      ["CADDY_IMAGE_ID"]=sha256:${'c'.repeat(64)}
    )
    verify_rollback_aliases() { return 0; }
    rollback_override="$TEST_ROOT/rollback.yml"
    diagnostic_file="$TEST_ROOT/diagnostic"
    ROLLBACK_TIMEOUT_SECONDS=300
    DIAGNOSTIC_TIMEOUT_SECONDS=10
    REVISION_PROOF_TIMEOUT_SECONDS=30
    STATE_OPERATION_TIMEOUT_SECONDS=15
    SHORT_KILL_GRACE_SECONDS=2
    PHASE_KILL_GRACE_SECONDS=15
    safe_status() { printf '%s\\n' "$1"; }
    APP_URL=https://example.invalid
    forward_state_root=/synthetic/forward
    ATTEMPT_ID=${forwardAttemptId}
    legacy_state_dir=/synthetic/legacy
    legacy_helper=/synthetic/legacy-bootstrap-state.mjs
    revision_helper=/synthetic/revision-proof.mjs
    forward_helper=/synthetic/forward-deploy-state.mjs
    ${rollbackSource}
    rollback_legacy_runtime
  `;
  const success = spawnSync('bash', ['-c', shell], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${toolsDir}:${process.env.PATH}`,
      TEST_ROOT: toolsDir,
      COMMAND_LOG: commandLog,
    },
  });
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /FORWARD_ROLLBACK_COMPLETE/);
  const commands = fs.readFileSync(commandLog, 'utf8');
  assert.match(commands, /--no-build --pull never/);
  assert.match(commands, /node:\/synthetic\/revision-proof\.mjs/);
  assert.match(commands, /node:\/synthetic\/forward-deploy-state\.mjs/);
  assert.doesNotMatch(commands, /(?:^|\s)build(?:\s|$)|(?:^|\s)pull(?! never)|migrat|exec/i);

  const unhealthy = spawnSync('bash', ['-c', shell], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${toolsDir}:${process.env.PATH}`,
      TEST_ROOT: toolsDir,
      COMMAND_LOG: commandLog,
      FAIL_API_HEALTH: '1',
    },
  });
  assert.notEqual(unhealthy.status, 0);
  assert.doesNotMatch(unhealthy.stdout, /FORWARD_ROLLBACK_COMPLETE/);
});

test('lock-wait exhaustion is non-terminal and exactly one resumed supervisor restores immutable legacy', async (t) => {
  if (process.platform === 'darwin') {
    t.skip('the production recovery supervisor requires Linux flock and Bash 4; exercised on GitHub Linux CI');
    return;
  }
  const fixture = await makeExecutableRecoveryFixture(t);
  const mutationLock = path.join(fixture.gitCommon, 'oasis-deploy', 'production-vps-mutation.lock');
  const holderReady = path.join(fixture.root, 'holder-ready');
  const holder = spawn('bash', ['-c', 'exec 9>"$MUTATION_LOCK"; flock 9; touch "$HOLDER_READY"; sleep 60'], {
    env: { ...fixture.env, MUTATION_LOCK: mutationLock, HOLDER_READY: holderReady },
    stdio: 'ignore',
  });
  await waitForPath(holderReady);

  const shortWaitEnv = { ...fixture.env, RECOVERY_LOCK_WAIT_SECONDS: '1' };
  const firstSupervisor = spawn('bash', [fixture.stagedRecoveryHelper], { env: shortWaitEnv, stdio: 'ignore' });
  const first = await waitForChild(firstSupervisor, 5000);
  assert.equal(first.code, 0);
  assert.equal(fs.existsSync(path.join(fixture.helperDir, 'recovery-result')), false);
  assert.equal(fs.existsSync(fixture.stagedRecoveryHelper), true, 'lock timeout must preserve recovery tooling');
  assert.equal(fs.existsSync(path.join(fixture.helperDir, 'recovery-supervisor-ready')), false);

  holder.kill('SIGTERM');
  await waitForChild(holder);
  const resumedA = spawn('bash', [fixture.stagedRecoveryHelper], { env: shortWaitEnv, stdio: 'ignore' });
  const resumedB = spawn('bash', [fixture.stagedRecoveryHelper], { env: shortWaitEnv, stdio: 'ignore' });
  const [resultA, resultB] = await Promise.all([waitForChild(resumedA), waitForChild(resumedB)]);
  assert.deepEqual([resultA.code, resultB.code].sort(), [0, 1]);
  const result = fs.readFileSync(path.join(fixture.helperDir, 'recovery-result'), 'utf8').trim();
  assert.equal(result, 'FORWARD_RECOVERY_LEGACY_VERIFIED');
  assert.equal(fs.readFileSync(fixture.runtimeMode, 'utf8').trim(), 'legacy');
  const state = readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId });
  assert.equal(state.state, FORWARD_STATES.RECOVERABLE_FAILURE);
  assert.equal(state.failureClass, 'TRANSPORT_RECOVERY_REQUIRED');
  assert.equal(state.failureEvidence?.phase, 'TRANSPORT');
  const commands = fs.readFileSync(fixture.commandLog, 'utf8');
  assert.equal((commands.match(/--no-build --pull never/g) ?? []).length, 1);
  assert.match(commands, /--no-build --pull never/);
  assert.match(commands, new RegExp(`oasis-legacy-bootstrap-api:${legacyAttemptId}`));
  assert.match(commands, new RegExp(`oasis-legacy-bootstrap-web:${legacyAttemptId}`));
  assert.match(commands, new RegExp(`oasis-legacy-bootstrap-caddy:${legacyAttemptId}`));
  assert.doesNotMatch(commands, /(?:^|\s)build(?:\s|$)|(?:^|\s)pull(?! never)|git|fetch|migrat|exec|image tag|image rm|rmi/i);
  for (const name of ['recovery-diagnostic', 'recovery-legacy-binding', 'recovery-rollback-override.yml']) {
    assert.equal(fs.existsSync(path.join(fixture.helperDir, name)), false, `${name} must be deleted`);
  }
  const afterTerminal = spawnSync('bash', [fixture.stagedRecoveryHelper], { env: shortWaitEnv, encoding: 'utf8' });
  assert.equal(afterTerminal.status, 0, afterTerminal.stderr);
  assert.equal((fs.readFileSync(fixture.commandLog, 'utf8').match(/--no-build --pull never/g) ?? []).length, 1);
});

test('detached recovery preserves a fetch failure persisted immediately before transport loss', async (t) => {
  if (process.platform === 'darwin') {
    t.skip('the production recovery supervisor requires Linux flock and Bash 4; exercised on GitHub Linux CI');
    return;
  }
  const fixture = await makeExecutableRecoveryFixture(t);
  recordFetchDiagnostic({
    rootDir: fixture.forwardRoot,
    attemptId: forwardAttemptId,
    exitStatus: 23,
    category: 'FETCH_PACK_FINALIZATION',
  });
  const result = spawnSync('bash', [fixture.stagedRecoveryHelper], {
    env: fixture.env,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.equal(
    fs.readFileSync(path.join(fixture.helperDir, 'recovery-result'), 'utf8').trim(),
    'FORWARD_RECOVERY_LEGACY_VERIFIED',
  );
  const state = readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId });
  assert.equal(state.state, FORWARD_STATES.RECOVERABLE_FAILURE);
  assert.equal(state.failureClass, 'CHECKOUT_FAILED');
  assert.equal(state.failureEvidence?.phase, 'CHECKOUT');
  assert.deepEqual(state.fetchDiagnostic, {
    exitStatus: 23,
    category: 'FETCH_PACK_FINALIZATION',
  });
  assert.equal(fs.readFileSync(fixture.runtimeMode, 'utf8').trim(), 'legacy');
});

test('recovery authenticates completion written before an uncertain return and does not roll it back', async (t) => {
  if (process.platform === 'darwin') {
    t.skip('the production recovery supervisor requires Linux flock and Bash 4; exercised on GitHub Linux CI');
    return;
  }
  const fixture = await makeExecutableRecoveryFixture(t, { state: FORWARD_STATES.COMPLETE });
  const transitionLock = path.join(fixture.forwardRoot, 'attempts', forwardAttemptId, 'transition.lock');
  fs.mkdirSync(transitionLock, { mode: 0o700 });
  const result = spawnSync('bash', [recoveryHelperPath], { env: { ...fixture.env, TARGET_PROOF: 'success' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.equal(
    fs.readFileSync(path.join(fixture.helperDir, 'recovery-result'), 'utf8').trim(),
    'FORWARD_RECOVERY_COMPLETE_VERIFIED',
  );
  assert.equal(readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId }).state, FORWARD_STATES.COMPLETE);
  assert.equal(fs.existsSync(transitionLock), false);
  assert.equal(fs.readFileSync(fixture.runtimeMode, 'utf8').trim(), 'target');
  assert.equal(fs.existsSync(fixture.commandLog), false, 'authenticated completion must not invoke rollback');
});

test('resumed recovery preserves an initiating failure class and fills only missing sanitized evidence', async (t) => {
  if (process.platform === 'darwin') {
    t.skip('the production recovery supervisor requires Linux flock and Bash 4; exercised on GitHub Linux CI');
    return;
  }
  const fixture = await makeExecutableRecoveryFixture(t, { state: FORWARD_STATES.RECOVERABLE_FAILURE });
  const result = spawnSync('bash', [recoveryHelperPath], { env: fixture.env, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  const state = readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId });
  assert.equal(state.state, FORWARD_STATES.RECOVERABLE_FAILURE);
  assert.equal(state.failureClass, 'RUNTIME_REPLACEMENT_FAILED');
  assert.equal(state.failureEvidence?.failureClass, 'RUNTIME_REPLACEMENT_FAILED');
  assert.equal(state.failureEvidence?.phase, 'RUNTIME_REPLACEMENT');
  assert.equal(fs.readFileSync(fixture.runtimeMode, 'utf8').trim(), 'legacy');
});

test('failed completion proof records uncertainty and restores legacy instead of leaving target containers active', async (t) => {
  if (process.platform === 'darwin') {
    t.skip('the production recovery supervisor requires Linux flock and Bash 4; exercised on GitHub Linux CI');
    return;
  }
  const fixture = await makeExecutableRecoveryFixture(t, { state: FORWARD_STATES.COMPLETE });
  const result = spawnSync('bash', [recoveryHelperPath], { env: { ...fixture.env, TARGET_PROOF: 'fail' }, encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.equal(
    fs.readFileSync(path.join(fixture.helperDir, 'recovery-result'), 'utf8').trim(),
    'FORWARD_RECOVERY_LEGACY_VERIFIED',
  );
  const state = readForwardState({ rootDir: fixture.forwardRoot, attemptId: forwardAttemptId });
  assert.equal(state.state, FORWARD_STATES.COMPLETION_UNCERTAIN);
  assert.equal(state.failureClass, 'COMPLETION_STATE_UNCERTAIN');
  assert.equal(state.failureEvidence?.phase, 'COMPLETION');
  assert.equal(fs.readFileSync(fixture.runtimeMode, 'utf8').trim(), 'legacy');
  const commands = fs.readFileSync(fixture.commandLog, 'utf8');
  assert.match(commands, /--no-build --pull never/);
  assert.doesNotMatch(commands, /(?:^|\s)build(?:\s|$)|(?:^|\s)pull(?! never)|git|fetch|migrat|exec|image tag|image rm|rmi/i);
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
