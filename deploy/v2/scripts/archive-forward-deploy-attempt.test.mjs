import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ARCHIVABLE_ATTEMPT_ID,
  ARCHIVABLE_FAILURE_CLASS,
  ARCHIVABLE_REPOSITORY,
  ARCHIVABLE_TARGET_SHA,
  ARCHIVABLE_WORKFLOW_SHA,
  ARCHIVE_REVIEW_BASE_SHA,
  ForwardArchiveError,
  archiveFailedForwardAttempt,
} from './archive-forward-deploy-attempt.mjs';
import {
  STATES as LEGACY_STATES,
  prepareState as prepareLegacyState,
  transitionState as transitionLegacyState,
} from './legacy-bootstrap-state.mjs';
import {
  FORWARD_STATES,
  prepareForwardState,
  readForwardState,
  readLegacyBinding,
  recordFailureEvidence,
  transitionForwardState,
} from './forward-deploy-state.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const archiveHelperPath = path.join(here, 'archive-forward-deploy-attempt.mjs');
const legacyHelperPath = path.join(here, 'legacy-bootstrap-state.mjs');
const wrapperPath = path.join(here, 'archive-forward-deploy-attempt.sh');
const legacyAttemptId = '79e13dc0591adc1f69b6b7552d6de64a';
const nextAttemptId = '0123456789abcdef0123456789abcdef';
const imageIds = Object.freeze({
  api: `sha256:${'1'.repeat(64)}`,
  web: `sha256:${'2'.repeat(64)}`,
  caddy: `sha256:${'3'.repeat(64)}`,
});

function snapshotTree(root) {
  const result = [];
  const visit = (absolute, relative) => {
    const stat = fs.lstatSync(absolute);
    const entry = {
      relative,
      type: stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other',
      mode: stat.mode & 0o777,
      uid: stat.uid,
      gid: stat.gid,
      digest: stat.isFile()
        ? crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')
        : null,
    };
    result.push(entry);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        visit(path.join(absolute, name), relative ? path.join(relative, name) : name);
      }
    }
  };
  visit(root, '');
  return result;
}

async function createFixture(t, { state = FORWARD_STATES.RECOVERABLE_FAILURE, withEvidence = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oasis-forward-archive-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, 'repository');
  const gitCommon = path.join(repositoryRoot, '.git');
  const deployStateRoot = path.join(gitCommon, 'oasis-deploy');
  const legacyStateDir = path.join(deployStateRoot, 'legacy-bootstrap-v1', 'state');
  const forwardRoot = path.join(deployStateRoot, 'forward-deployment-v1');
  const historyRoot = path.join(deployStateRoot, 'forward-deployment-history-v1');
  const archivedRoot = path.join(historyRoot, ARCHIVABLE_ATTEMPT_ID);
  const mutationLock = path.join(deployStateRoot, 'production-vps-mutation.lock');

  fs.mkdirSync(deployStateRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(gitCommon, 0o755);
  fs.chmodSync(deployStateRoot, 0o700);
  fs.writeFileSync(mutationLock, '', { mode: 0o600 });
  fs.chmodSync(mutationLock, 0o600);

  prepareLegacyState({
    stateDir: legacyStateDir,
    targetSha: '72b34c2b2a1b959f7ac1db442afcbe9f9a65f07c',
    attemptId: legacyAttemptId,
    imageIds,
  });
  transitionLegacyState({ stateDir: legacyStateDir, targetSha: '72b34c2b2a1b959f7ac1db442afcbe9f9a65f07c', nextState: LEGACY_STATES.MUTATION_STARTED });
  transitionLegacyState({ stateDir: legacyStateDir, targetSha: '72b34c2b2a1b959f7ac1db442afcbe9f9a65f07c', nextState: LEGACY_STATES.ROLLBACK_REQUIRED });
  transitionLegacyState({ stateDir: legacyStateDir, targetSha: '72b34c2b2a1b959f7ac1db442afcbe9f9a65f07c', nextState: LEGACY_STATES.LEGACY_ROLLED_BACK });
  const legacyBinding = await readLegacyBinding({ legacyStateDir, legacyStateHelper: legacyHelperPath });

  await prepareForwardState({
    rootDir: forwardRoot,
    targetSha: ARCHIVABLE_TARGET_SHA,
    workflowSha: ARCHIVABLE_WORKFLOW_SHA,
    originMainSha: ARCHIVABLE_WORKFLOW_SHA,
    repository: ARCHIVABLE_REPOSITORY,
    attemptId: ARCHIVABLE_ATTEMPT_ID,
    legacyStateDir,
    legacyStateHelper: legacyHelperPath,
    expectedLegacyDigest: legacyBinding.digest,
    runningImageIds: imageIds,
  });
  if (state !== FORWARD_STATES.PREPARED) {
    transitionForwardState({ rootDir: forwardRoot, attemptId: ARCHIVABLE_ATTEMPT_ID, nextState: FORWARD_STATES.MUTATION_STARTED });
  }
  if (state === FORWARD_STATES.RECOVERABLE_FAILURE) {
    transitionForwardState({
      rootDir: forwardRoot,
      attemptId: ARCHIVABLE_ATTEMPT_ID,
      nextState: FORWARD_STATES.RECOVERABLE_FAILURE,
      failureClass: ARCHIVABLE_FAILURE_CLASS,
    });
    if (withEvidence) {
      recordFailureEvidence({
        rootDir: forwardRoot,
        attemptId: ARCHIVABLE_ATTEMPT_ID,
        failureClass: ARCHIVABLE_FAILURE_CLASS,
        phase: 'RUNTIME_REPLACEMENT',
        serviceStates: { api: 'RUNNING_UNHEALTHY', web: 'MISSING', caddy: 'RUNNING_HEALTHY' },
        logCategories: { api: 'READINESS_FAILURE', web: 'UNAVAILABLE', caddy: 'NO_MATCH' },
      });
    }
  } else if (state === FORWARD_STATES.COMPLETE) {
    transitionForwardState({ rootDir: forwardRoot, attemptId: ARCHIVABLE_ATTEMPT_ID, nextState: FORWARD_STATES.COMPLETE });
  } else if (state === FORWARD_STATES.COMPLETION_UNCERTAIN) {
    transitionForwardState({
      rootDir: forwardRoot,
      attemptId: ARCHIVABLE_ATTEMPT_ID,
      nextState: FORWARD_STATES.COMPLETION_UNCERTAIN,
      failureClass: 'COMPLETION_STATE_UNCERTAIN',
    });
  }

  const lockFd = fs.openSync(mutationLock, 'r+');
  t.after(() => {
    try {
      fs.closeSync(lockFd);
    } catch {
      // The descriptor may be closed explicitly by a child-process test.
    }
  });

  const archive = (overrides = {}) => archiveFailedForwardAttempt({
    gitCommonDir: gitCommon,
    attemptId: ARCHIVABLE_ATTEMPT_ID,
    targetSha: ARCHIVABLE_TARGET_SHA,
    reviewBaseSha: ARCHIVE_REVIEW_BASE_SHA,
    repository: ARCHIVABLE_REPOSITORY,
    legacyStateDir,
    legacyStateHelper: legacyHelperPath,
    runningImageIds: imageIds,
    mutationLockFd: lockFd,
    lockVerifier: () => {},
    ...overrides,
  });

  return {
    root,
    repositoryRoot,
    gitCommon,
    deployStateRoot,
    legacyStateDir,
    forwardRoot,
    historyRoot,
    archivedRoot,
    mutationLock,
    lockFd,
    legacyBinding,
    archive,
  };
}

test('archives the exact failed attempt atomically and preserves every state byte, mode and evidence field', async (t) => {
  const fixture = await createFixture(t);
  const before = snapshotTree(fixture.forwardRoot);

  const result = await fixture.archive();

  assert.equal(fs.existsSync(fixture.forwardRoot), false);
  assert.equal(result.destinationRoot, fixture.archivedRoot);
  assert.deepEqual(snapshotTree(fixture.archivedRoot), before);
  const archived = readForwardState({ rootDir: fixture.archivedRoot, attemptId: ARCHIVABLE_ATTEMPT_ID });
  assert.equal(archived.state, FORWARD_STATES.RECOVERABLE_FAILURE);
  assert.equal(archived.failureClass, ARCHIVABLE_FAILURE_CLASS);
  assert.deepEqual(archived.failureEvidence, {
    failureClass: ARCHIVABLE_FAILURE_CLASS,
    phase: 'RUNTIME_REPLACEMENT',
    serviceStates: { api: 'RUNNING_UNHEALTHY', web: 'MISSING', caddy: 'RUNNING_HEALTHY' },
    logCategories: { api: 'READINESS_FAILURE', web: 'UNAVAILABLE', caddy: 'NO_MATCH' },
  });
});

test('a consumed incident can be archived once, a fresh root can be prepared once, and history stays immutable', async (t) => {
  const fixture = await createFixture(t);
  await fixture.archive();
  const archivedSnapshot = snapshotTree(fixture.archivedRoot);

  await assert.rejects(fixture.archive(), (error) => {
    assert.equal(error.code, 'FORWARD_ARCHIVE_ALREADY_ROTATED');
    return true;
  });
  assert.deepEqual(snapshotTree(fixture.archivedRoot), archivedSnapshot);

  await prepareForwardState({
    rootDir: fixture.forwardRoot,
    targetSha: ARCHIVABLE_TARGET_SHA,
    workflowSha: ARCHIVE_REVIEW_BASE_SHA,
    originMainSha: ARCHIVE_REVIEW_BASE_SHA,
    repository: ARCHIVABLE_REPOSITORY,
    attemptId: nextAttemptId,
    legacyStateDir: fixture.legacyStateDir,
    legacyStateHelper: legacyHelperPath,
    expectedLegacyDigest: fixture.legacyBinding.digest,
    runningImageIds: imageIds,
  });
  assert.equal(readForwardState({ rootDir: fixture.forwardRoot, attemptId: nextAttemptId }).state, FORWARD_STATES.PREPARED);
  assert.deepEqual(snapshotTree(fixture.archivedRoot), archivedSnapshot);
  await assert.rejects(
    prepareForwardState({
      rootDir: fixture.forwardRoot,
      targetSha: ARCHIVABLE_TARGET_SHA,
      workflowSha: ARCHIVE_REVIEW_BASE_SHA,
      originMainSha: ARCHIVE_REVIEW_BASE_SHA,
      repository: ARCHIVABLE_REPOSITORY,
      attemptId: 'f'.repeat(32),
      legacyStateDir: fixture.legacyStateDir,
      legacyStateHelper: legacyHelperPath,
      expectedLegacyDigest: fixture.legacyBinding.digest,
      runningImageIds: imageIds,
    }),
    (error) => error.code === 'FORWARD_STATE_ALREADY_CONSUMED',
  );
});

test('a valid historical failure with no retained diagnostic evidence remains archivable without inventing evidence', async (t) => {
  const fixture = await createFixture(t, { withEvidence: false });
  await fixture.archive();
  const archived = readForwardState({ rootDir: fixture.archivedRoot, attemptId: ARCHIVABLE_ATTEMPT_ID });
  assert.equal(archived.state, FORWARD_STATES.RECOVERABLE_FAILURE);
  assert.equal(archived.failureClass, ARCHIVABLE_FAILURE_CLASS);
  assert.equal(archived.failureEvidence, null);
});

test('rejects every incident binding other than the reviewed attempt, target, base and repository', async (t) => {
  const fixture = await createFixture(t);
  for (const overrides of [
    { attemptId: 'f'.repeat(32) },
    { targetSha: 'f'.repeat(40) },
    { reviewBaseSha: 'f'.repeat(40) },
    { repository: 'example/other' },
  ]) {
    await assert.rejects(fixture.archive(overrides), (error) => {
      assert.equal(error.code, 'FORWARD_ARCHIVE_INVALID');
      return true;
    });
  }
  assert.equal(fs.existsSync(fixture.forwardRoot), true);
  assert.equal(fs.existsSync(fixture.historyRoot), false);
});

test('rejects prepared, mutation-started, complete and completion-uncertain state without moving it', async (t) => {
  for (const state of [
    FORWARD_STATES.PREPARED,
    FORWARD_STATES.MUTATION_STARTED,
    FORWARD_STATES.COMPLETE,
    FORWARD_STATES.COMPLETION_UNCERTAIN,
  ]) {
    await t.test(state, async (subtest) => {
      const fixture = await createFixture(subtest, { state });
      await assert.rejects(fixture.archive(), (error) => {
        assert.equal(error.code, 'FORWARD_ARCHIVE_STATE_UNSAFE');
        return true;
      });
      assert.equal(fs.existsSync(fixture.forwardRoot), true);
      assert.equal(fs.existsSync(fixture.historyRoot), false);
    });
  }
});

test('rejects a runtime image mismatch, an unsafe owner mode and a different lock descriptor', async (t) => {
  await t.test('runtime mismatch', async (subtest) => {
    const fixture = await createFixture(subtest);
    await assert.rejects(
      fixture.archive({ runningImageIds: { ...imageIds, api: `sha256:${'9'.repeat(64)}` } }),
      (error) => error.code === 'FORWARD_ARCHIVE_RUNTIME_UNSAFE',
    );
    assert.equal(fs.existsSync(fixture.forwardRoot), true);
  });
  await t.test('unsafe mode', async (subtest) => {
    const fixture = await createFixture(subtest);
    fs.chmodSync(fixture.forwardRoot, 0o755);
    await assert.rejects(fixture.archive(), (error) => error.code === 'FORWARD_ARCHIVE_ACCESS_UNSAFE');
    assert.equal(fs.existsSync(fixture.forwardRoot), true);
  });
  await t.test('wrong descriptor', async (subtest) => {
    const fixture = await createFixture(subtest);
    const other = path.join(fixture.root, 'other-lock');
    fs.writeFileSync(other, '', { mode: 0o600 });
    const otherFd = fs.openSync(other, 'r+');
    subtest.after(() => fs.closeSync(otherFd));
    await assert.rejects(
      fixture.archive({ mutationLockFd: otherFd }),
      (error) => error.code === 'FORWARD_ARCHIVE_LOCK_REQUIRED',
    );
    assert.equal(fs.existsSync(fixture.forwardRoot), true);
  });
});

test('rejects unexpected or colliding history and never overwrites it', async (t) => {
  const fixture = await createFixture(t);
  fs.mkdirSync(fixture.historyRoot, { mode: 0o700 });
  const preserved = path.join(fixture.historyRoot, 'preserved');
  fs.writeFileSync(preserved, 'preserve-me', { mode: 0o600 });

  await assert.rejects(fixture.archive(), (error) => error.code === 'FORWARD_ARCHIVE_HISTORY_UNSAFE');
  assert.equal(fs.readFileSync(preserved, 'utf8'), 'preserve-me');
  assert.equal(fs.existsSync(fixture.forwardRoot), true);
});

test('a symlink anomaly aborts before history or canonical state can move', async (t) => {
  const fixture = await createFixture(t);
  fs.symlinkSync('/dev/null', path.join(fixture.forwardRoot, 'attempts', ARCHIVABLE_ATTEMPT_ID, 'unexpected-link'));

  await assert.rejects(fixture.archive());
  assert.equal(fs.existsSync(fixture.forwardRoot), true);
  assert.equal(fs.existsSync(fixture.historyRoot), false);
});

test('post-rename verification failure restores and reauthenticates the canonical root', async (t) => {
  const fixture = await createFixture(t);
  const before = snapshotTree(fixture.forwardRoot);

  await assert.rejects(
    fixture.archive({ afterRename: () => { throw new Error('synthetic verification failure'); } }),
    (error) => {
      assert.equal(error.code, 'FORWARD_ARCHIVE_VERIFICATION_FAILED_RESTORED');
      return true;
    },
  );
  assert.deepEqual(snapshotTree(fixture.forwardRoot), before);
  assert.equal(fs.existsSync(fixture.archivedRoot), false);
});

test('an unprovable post-rename layout fails closed and preserves both paths for manual adjudication', async (t) => {
  const fixture = await createFixture(t);

  await assert.rejects(
    fixture.archive({
      afterRename: ({ sourceRoot }) => {
        fs.mkdirSync(sourceRoot, { mode: 0o700 });
      },
    }),
    (error) => {
      assert.equal(error.code, 'FORWARD_ARCHIVE_STATE_UNCERTAIN');
      return true;
    },
  );
  assert.equal(fs.existsSync(fixture.forwardRoot), true);
  assert.equal(fs.existsSync(fixture.archivedRoot), true);
});

test('the CLI emits only the fixed completion category while using inherited mutation-lock fd 9', async (t) => {
  if (process.platform !== 'linux') {
    t.skip('production flock acquisition is exercised on GitHub Linux CI');
    return;
  }
  const fixture = await createFixture(t);
  const stdio = ['ignore', 'pipe', 'pipe', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', fixture.lockFd];
  const result = spawnSync(process.execPath, [archiveHelperPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_COMMON_DIR: fixture.gitCommon,
      ATTEMPT_ID: ARCHIVABLE_ATTEMPT_ID,
      TARGET_SHA: ARCHIVABLE_TARGET_SHA,
      REVIEW_BASE_SHA: ARCHIVE_REVIEW_BASE_SHA,
      REPOSITORY: ARCHIVABLE_REPOSITORY,
      LEGACY_STATE_DIR: fixture.legacyStateDir,
      LEGACY_STATE_HELPER: legacyHelperPath,
      RUNNING_API_IMAGE_ID: imageIds.api,
      RUNNING_WEB_IMAGE_ID: imageIds.web,
      RUNNING_CADDY_IMAGE_ID: imageIds.caddy,
      MUTATION_LOCK_FD: '9',
    },
    stdio,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'FORWARD_ARCHIVE_COMPLETE\n');
  assert.equal(result.stderr, '');
  assert.equal(fs.existsSync(fixture.archivedRoot), true);
});

test('the CLI cannot archive while another Linux process holds the production mutation lock', async (t) => {
  if (process.platform !== 'linux') {
    t.skip('production flock contention is exercised on GitHub Linux CI');
    return;
  }
  const fixture = await createFixture(t);
  const holder = spawn('bash', ['-c', 'exec 9<>"$1"; flock -n 9; printf "LOCKED\\n"; sleep 20', 'bash', fixture.mutationLock], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  t.after(() => holder.kill('SIGKILL'));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('lock holder did not start')), 5000);
    holder.stdout.once('data', (chunk) => {
      clearTimeout(timer);
      chunk.toString() === 'LOCKED\n' ? resolve() : reject(new Error('unexpected lock marker'));
    });
    holder.once('error', reject);
  });

  const stdio = ['ignore', 'pipe', 'pipe', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', fixture.lockFd];
  const result = spawnSync(process.execPath, [archiveHelperPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_COMMON_DIR: fixture.gitCommon,
      ATTEMPT_ID: ARCHIVABLE_ATTEMPT_ID,
      TARGET_SHA: ARCHIVABLE_TARGET_SHA,
      REVIEW_BASE_SHA: ARCHIVE_REVIEW_BASE_SHA,
      REPOSITORY: ARCHIVABLE_REPOSITORY,
      LEGACY_STATE_DIR: fixture.legacyStateDir,
      LEGACY_STATE_HELPER: legacyHelperPath,
      RUNNING_API_IMAGE_ID: imageIds.api,
      RUNNING_WEB_IMAGE_ID: imageIds.web,
      RUNNING_CADDY_IMAGE_ID: imageIds.caddy,
      MUTATION_LOCK_FD: '9',
    },
    stdio,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, 'FORWARD_ARCHIVE_LOCK_REQUIRED\n');
  assert.equal(result.stderr, '');
  assert.equal(fs.existsSync(fixture.forwardRoot), true);
  assert.equal(fs.existsSync(fixture.historyRoot), false);
});

test('the production wrapper is identity- and lock-bound and contains no deployment, migration or deletion command', () => {
  const wrapper = fs.readFileSync(wrapperPath, 'utf8');
  assert.match(wrapper, /EXPECTED_USER=deploy/);
  assert.match(wrapper, /EXPECTED_REPOSITORY_ROOT=\/opt\/oasis-care/);
  assert.match(wrapper, /\^\/var\/tmp\/oasis-forward-archive\\\./);
  assert.match(wrapper, /deploy:deploy:700/);
  assert.match(wrapper, /archive_helper="\$helper_dir\/archive-forward-deploy-attempt\.mjs"/);
  assert.match(wrapper, /forward_helper="\$helper_dir\/forward-deploy-state\.mjs"/);
  assert.match(wrapper, /exec 9<>"\$mutation_lock"/);
  assert.match(wrapper, /flock -n 9/);
  assert.match(wrapper, /PRODUCTION_MARKER=\/etc\/oasis\/production-deploy-target-class/);
  assert.match(wrapper, /ROTATION_TOOL_SHA="\$\{ROTATION_TOOL_SHA:-\}"/);
  assert.match(wrapper, /git ls-remote --exit-code origin refs\/heads\/main/);
  assert.match(wrapper, /repository_status=.*git status/);
  assert.match(wrapper, /FORWARD_ARCHIVE_LOCKED_PREFLIGHT_VALID/);
  assert.match(wrapper, /MUTATION_LOCK_FD=9/);
  assert.match(wrapper, /revision-proof\.mjs/);
  assert.match(wrapper, /rollback_legacy/);
  assert.doesNotMatch(wrapper, /docker\s+(?:compose\s+)?(?:build|pull)|compose\[@\].*\bup\b/);
  assert.doesNotMatch(wrapper, /git\s+(?:fetch|pull|checkout|reset)/);
  assert.doesNotMatch(wrapper, /\brm\b|\bunlink\b|\bmigrate\b|RUN_MIGRATIONS/);
});

test('all exported failures remain fixed archive categories', () => {
  const error = new ForwardArchiveError('FORWARD_ARCHIVE_STATE_UNSAFE');
  assert.equal(error.code, 'FORWARD_ARCHIVE_STATE_UNSAFE');
});
