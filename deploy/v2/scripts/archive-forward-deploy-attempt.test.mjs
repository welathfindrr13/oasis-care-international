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
const forwardHelperPath = path.join(here, 'forward-deploy-state.mjs');
const revisionHelperPath = path.resolve(here, '../../../.github/workflows/revision-proof.mjs');
const legacyAttemptId = '79e13dc0591adc1f69b6b7552d6de64a';
const nextAttemptId = '0123456789abcdef0123456789abcdef';
const imageIds = Object.freeze({
  api: `sha256:${'1'.repeat(64)}`,
  web: `sha256:${'2'.repeat(64)}`,
  caddy: `sha256:${'3'.repeat(64)}`,
});
const legacyAliasImageIds = Object.freeze({
  [`oasis-legacy-bootstrap-api:${legacyAttemptId}`]: imageIds.api,
  [`oasis-legacy-bootstrap-web:${legacyAttemptId}`]: imageIds.web,
  [`oasis-legacy-bootstrap-caddy:${legacyAttemptId}`]: imageIds.caddy,
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
    aliasResolver: (alias) => legacyAliasImageIds[alias],
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

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed: ${result.stderr || result.stdout || result.error?.message || 'unknown error'}`,
  );
  return result;
}

function sudoChecked(args, options = {}) {
  return runChecked('sudo', ['-n', ...args], options);
}

function installSystemFile(source, destination, mode, owner = 'deploy', group = 'deploy') {
  sudoChecked(['install', '-o', owner, '-g', group, '-m', mode, source, destination]);
}

function writeTemporaryFile(root, name, contents) {
  const target = path.join(root, name);
  fs.writeFileSync(target, contents, { mode: 0o600 });
  return target;
}

function asDeploy(args, options = {}) {
  return sudoChecked(['-u', 'deploy', ...args], options);
}

async function createExecutableWrapperFixture(t, { helperVariant = 'valid' } = {}) {
  const stateFixture = await createFixture(t);
  const suffix = crypto.randomBytes(4).toString('hex');
  const systemRepository = '/opt/oasis-care';
  const systemGitCommon = path.join(systemRepository, '.git');
  const systemDeployRoot = path.join(systemGitCommon, 'oasis-deploy');
  const systemForwardRoot = path.join(systemDeployRoot, 'forward-deployment-v1');
  const systemHistoryRoot = path.join(systemDeployRoot, 'forward-deployment-history-v1');
  const helperDir = `/var/tmp/oasis-forward-archive.${suffix}`;
  const toolsDir = `/var/tmp/oasis-forward-archive-tools.${suffix}`;
  const marker = '/etc/oasis/production-deploy-target-class';

  if (spawnSync('id', ['-u', 'deploy'], { stdio: 'ignore' }).status !== 0) {
    sudoChecked(['useradd', '--system', '--create-home', '--shell', '/bin/bash', 'deploy']);
  }

  sudoChecked(['rm', '-rf', systemRepository, helperDir, toolsDir]);
  sudoChecked(['rm', '-f', marker]);
  t.after(() => {
    sudoChecked(['rm', '-rf', systemRepository, helperDir, toolsDir]);
    sudoChecked(['rm', '-f', marker]);
  });

  for (const directory of [
    systemRepository,
    path.join(systemRepository, 'deploy/v2/scripts'),
    path.join(systemRepository, '.github/workflows'),
  ]) {
    sudoChecked(['install', '-d', '-o', 'deploy', '-g', 'deploy', '-m', '0755', directory]);
  }
  sudoChecked(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0755', '/etc/oasis']);

  const staleRevision = writeTemporaryFile(
    stateFixture.root,
    'stale-revision-proof.mjs',
    `${fs.readFileSync(revisionHelperPath, 'utf8')}\n// stale fixture revision\n`,
  );
  const syntheticEnv = writeTemporaryFile(stateFixture.root, 'synthetic.env', 'SYNTHETIC=true\n');
  const syntheticCompose = writeTemporaryFile(stateFixture.root, 'docker-compose.yml', 'services: {}\n');
  const productionMarker = writeTemporaryFile(stateFixture.root, 'production-marker', 'production\n');

  installSystemFile(wrapperPath, path.join(systemRepository, 'deploy/v2/scripts/archive-forward-deploy-attempt.sh'), '0755');
  installSystemFile(archiveHelperPath, path.join(systemRepository, 'deploy/v2/scripts/archive-forward-deploy-attempt.mjs'), '0755');
  installSystemFile(forwardHelperPath, path.join(systemRepository, 'deploy/v2/scripts/forward-deploy-state.mjs'), '0644');
  installSystemFile(legacyHelperPath, path.join(systemRepository, 'deploy/v2/scripts/legacy-bootstrap-state.mjs'), '0644');
  installSystemFile(staleRevision, path.join(systemRepository, '.github/workflows/revision-proof.mjs'), '0644');
  installSystemFile(syntheticEnv, path.join(systemRepository, 'deploy/v2/.env'), '0600');
  installSystemFile(syntheticCompose, path.join(systemRepository, 'deploy/v2/docker-compose.yml'), '0644');
  installSystemFile(productionMarker, marker, '0644', 'root', 'root');

  asDeploy(['git', '-C', systemRepository, 'init', '-q']);
  asDeploy(['git', '-C', systemRepository, 'config', 'user.name', 'Oasis CI']);
  asDeploy(['git', '-C', systemRepository, 'config', 'user.email', 'ci@oasis.invalid']);
  asDeploy(['git', '-C', systemRepository, 'add', '.']);
  asDeploy(['git', '-C', systemRepository, 'commit', '-q', '-m', 'stale helper fixture']);
  const staleSha = asDeploy(['git', '-C', systemRepository, 'rev-parse', 'HEAD']).stdout.trim();

  installSystemFile(revisionHelperPath, path.join(systemRepository, '.github/workflows/revision-proof.mjs'), '0644');
  asDeploy(['git', '-C', systemRepository, 'add', '.github/workflows/revision-proof.mjs']);
  asDeploy(['git', '-C', systemRepository, 'commit', '-q', '-m', 'reviewed helper fixture']);
  const rotationToolSha = asDeploy(['git', '-C', systemRepository, 'rev-parse', 'HEAD']).stdout.trim();
  asDeploy([
    'git',
    '-C',
    systemRepository,
    'remote',
    'add',
    'origin',
    'https://github.com/welathfindrr13/oasis-care-international.git',
  ]);

  sudoChecked(['cp', '-a', stateFixture.deployStateRoot, systemGitCommon]);
  sudoChecked(['chown', '-R', 'deploy:deploy', systemDeployRoot]);

  sudoChecked(['install', '-d', '-o', 'deploy', '-g', 'deploy', '-m', '0700', helperDir]);
  sudoChecked(['install', '-d', '-o', 'deploy', '-g', 'deploy', '-m', '0700', toolsDir]);
  const stagedFiles = [
    [wrapperPath, path.join(helperDir, 'archive-forward-deploy-attempt.sh'), '0700'],
    [archiveHelperPath, path.join(helperDir, 'archive-forward-deploy-attempt.mjs'), '0600'],
    [forwardHelperPath, path.join(helperDir, 'forward-deploy-state.mjs'), '0600'],
    [legacyHelperPath, path.join(helperDir, 'legacy-bootstrap-state.mjs'), '0600'],
    [revisionHelperPath, path.join(helperDir, 'revision-proof.mjs'), '0600'],
  ];
  for (const [source, destination, mode] of stagedFiles) {
    installSystemFile(source, destination, mode);
  }

  if (helperVariant === 'stale') {
    const staleBlob = asDeploy([
      'git',
      '-C',
      systemRepository,
      'show',
      `${staleSha}:.github/workflows/revision-proof.mjs`,
    ]).stdout;
    const staleStaged = writeTemporaryFile(stateFixture.root, 'stale-staged-revision.mjs', staleBlob);
    installSystemFile(staleStaged, path.join(helperDir, 'revision-proof.mjs'), '0600');
  } else if (helperVariant === 'mixed') {
    installSystemFile(legacyHelperPath, path.join(helperDir, 'forward-deploy-state.mjs'), '0600');
  } else if (helperVariant === 'modified') {
    const modifiedWrapper = writeTemporaryFile(
      stateFixture.root,
      'modified-archive-wrapper.sh',
      `${fs.readFileSync(wrapperPath, 'utf8')}\n# modified fixture wrapper\n`,
    );
    installSystemFile(modifiedWrapper, path.join(helperDir, 'archive-forward-deploy-attempt.sh'), '0700');
  }

  const dockerLog = path.join(toolsDir, 'docker-commands');
  const emptyLog = writeTemporaryFile(stateFixture.root, 'docker-commands', '');
  installSystemFile(emptyLog, dockerLog, '0600');
  const fakeGit = writeTemporaryFile(stateFixture.root, 'git', [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'if [ "${1:-}" = ls-remote ]; then',
    '  printf "%s\\trefs/heads/main\\n" "$TEST_ROTATION_SHA"',
    '  exit 0',
    'fi',
    'exec "$REAL_GIT" "$@"',
    '',
  ].join('\n'));
  const fakeNode = writeTemporaryFile(stateFixture.root, 'node', [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'if [ "$(basename "${1:-}")" = revision-proof.mjs ]; then',
    '  exit 0',
    'fi',
    'exec "$REAL_NODE" "$@"',
    '',
  ].join('\n'));
  const fakeDocker = writeTemporaryFile(stateFixture.root, 'docker', [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'printf "%s\\n" "$*" >> "$TEST_DOCKER_LOG"',
    'if [ "${1:-}" = image ] && [ "${2:-}" = inspect ]; then',
    '  alias="${5:-}"',
    '  if [ "${TEST_ALIAS_BEHAVIOR:-valid}" = missing ] && [[ "$alias" == oasis-legacy-bootstrap-api:* ]]; then exit 1; fi',
    `  if [ "\${TEST_ALIAS_BEHAVIOR:-valid}" = retagged ] && [[ "$alias" == oasis-legacy-bootstrap-api:* ]]; then printf '%s\\n' 'sha256:${'9'.repeat(64)}'; exit 0; fi`,
    '  case "$alias" in',
    `    oasis-legacy-bootstrap-api:${legacyAttemptId}) printf '%s\\n' '${imageIds.api}' ;;`,
    `    oasis-legacy-bootstrap-web:${legacyAttemptId}) printf '%s\\n' '${imageIds.web}' ;;`,
    `    oasis-legacy-bootstrap-caddy:${legacyAttemptId}) printf '%s\\n' '${imageIds.caddy}' ;;`,
    '    *) exit 1 ;;',
    '  esac',
    '  exit 0',
    'fi',
    'if [ "${1:-}" = compose ]; then',
    '  service="${@: -1}"',
    '  case "$service" in',
    `    api) printf '%s\\n' '${'a'.repeat(64)}' ;;`,
    `    web) printf '%s\\n' '${'b'.repeat(64)}' ;;`,
    `    caddy) printf '%s\\n' '${'c'.repeat(64)}' ;;`,
    `    postgres) printf '%s\\n' '${'d'.repeat(64)}' ;;`,
    '    *) exit 1 ;;',
    '  esac',
    '  exit 0',
    'fi',
    'if [ "${1:-}" = inspect ]; then',
    '  format="${3:-}"',
    '  container="${4:-}"',
    '  if [[ "$format" == *".Image"* ]]; then',
    '    case "$container" in',
    `      ${'a'.repeat(64)}) printf '%s\\n' '${imageIds.api}' ;;`,
    `      ${'b'.repeat(64)}) printf '%s\\n' '${imageIds.web}' ;;`,
    `      ${'c'.repeat(64)}) printf '%s\\n' '${imageIds.caddy}' ;;`,
    '      *) exit 1 ;;',
    '    esac',
    '  else',
    '    printf "healthy\\n"',
    '  fi',
    '  exit 0',
    'fi',
    'exit 1',
    '',
  ].join('\n'));
  for (const [source, name] of [[fakeGit, 'git'], [fakeNode, 'node'], [fakeDocker, 'docker']]) {
    installSystemFile(source, path.join(toolsDir, name), '0700');
  }

  const runWrapper = (aliasBehavior = 'valid') => spawnSync(
    'sudo',
    [
      '-n',
      '-u',
      'deploy',
      'env',
      `PATH=${toolsDir}:/usr/bin:/bin`,
      'HOME=/home/deploy',
      `REAL_GIT=${spawnSync('command', ['-v', 'git'], { shell: true, encoding: 'utf8' }).stdout.trim() || '/usr/bin/git'}`,
      `REAL_NODE=${process.execPath}`,
      `ROTATION_TOOL_SHA=${rotationToolSha}`,
      `TEST_ROTATION_SHA=${rotationToolSha}`,
      `TEST_ALIAS_BEHAVIOR=${aliasBehavior}`,
      `TEST_DOCKER_LOG=${dockerLog}`,
      'bash',
      path.join(helperDir, 'archive-forward-deploy-attempt.sh'),
    ],
    { encoding: 'utf8' },
  );

  const existsAsDeploy = (target) => spawnSync(
    'sudo',
    ['-n', '-u', 'deploy', 'test', '-e', target],
    { stdio: 'ignore' },
  ).status === 0;
  const readAsDeploy = (target) => asDeploy(['cat', target]).stdout;

  return {
    helperDir,
    dockerLog,
    systemForwardRoot,
    systemHistoryRoot,
    runWrapper,
    existsAsDeploy,
    readAsDeploy,
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

test('missing or retagged immutable aliases fail before the archive rename', async (t) => {
  for (const [name, resolver] of [
    ['missing', (alias) => alias.includes('-api:') ? undefined : legacyAliasImageIds[alias]],
    ['retagged', (alias) => alias.includes('-api:') ? `sha256:${'9'.repeat(64)}` : legacyAliasImageIds[alias]],
  ]) {
    await t.test(name, async (subtest) => {
      const fixture = await createFixture(subtest);
      await assert.rejects(
        fixture.archive({ aliasResolver: resolver }),
        (error) => error.code === 'FORWARD_ARCHIVE_ALIAS_UNSAFE',
      );
      assert.equal(fs.existsSync(fixture.forwardRoot), true);
      assert.equal(fs.existsSync(fixture.historyRoot), false);
    });
  }
});

test('a post-rename alias mismatch restores and reauthenticates the canonical state', async (t) => {
  const fixture = await createFixture(t);
  const before = snapshotTree(fixture.forwardRoot);
  let resolutions = 0;

  await assert.rejects(
    fixture.archive({
      aliasResolver: (alias) => {
        resolutions += 1;
        if (resolutions > 3 && alias.includes('-api:')) return `sha256:${'9'.repeat(64)}`;
        return legacyAliasImageIds[alias];
      },
    }),
    (error) => error.code === 'FORWARD_ARCHIVE_VERIFICATION_FAILED_RESTORED',
  );
  assert.deepEqual(snapshotTree(fixture.forwardRoot), before);
  assert.equal(fs.existsSync(fixture.archivedRoot), false);
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

test('the executable production wrapper authenticates helpers and immutable aliases before archival', async (t) => {
  if (process.platform !== 'linux' || process.env.CI !== 'true') {
    t.skip('the root-owned production path fixture runs only on disposable GitHub Linux CI');
    return;
  }

  for (const aliasBehavior of ['missing', 'retagged']) {
    await t.test(`${aliasBehavior} alias`, async (subtest) => {
      const fixture = await createExecutableWrapperFixture(subtest);
      const result = fixture.runWrapper(aliasBehavior);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /FORWARD_ARCHIVE_ALIAS_UNSAFE\n$/);
      assert.equal(fixture.existsAsDeploy(fixture.systemForwardRoot), true);
      assert.equal(fixture.existsAsDeploy(fixture.systemHistoryRoot), false);
    });
  }

  for (const helperVariant of ['stale', 'mixed', 'modified']) {
    await t.test(`${helperVariant} helper`, async (subtest) => {
      const fixture = await createExecutableWrapperFixture(subtest, { helperVariant });
      const result = fixture.runWrapper();
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /FORWARD_ARCHIVE_HELPER_UNSAFE\n$/);
      assert.equal(fixture.existsAsDeploy(fixture.systemForwardRoot), true);
      assert.equal(fixture.existsAsDeploy(fixture.systemHistoryRoot), false);
      assert.equal(fixture.readAsDeploy(fixture.dockerLog), '');
    });
  }

  await t.test('authentic helper bundle and aliases', async (subtest) => {
    const fixture = await createExecutableWrapperFixture(subtest);
    const result = fixture.runWrapper();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /FORWARD_ARCHIVE_HELPERS_AUTHENTIC\n/);
    assert.match(result.stdout, /FORWARD_ARCHIVE_COMPLETE\n$/);
    assert.equal(fixture.existsAsDeploy(fixture.systemForwardRoot), false);
    assert.equal(fixture.existsAsDeploy(fixture.systemHistoryRoot), true);

    const dockerCommands = fixture.readAsDeploy(fixture.dockerLog);
    for (const service of ['api', 'web', 'caddy']) {
      const alias = `oasis-legacy-bootstrap-${service}:${legacyAttemptId}`;
      assert.equal((dockerCommands.match(new RegExp(alias, 'g')) ?? []).length, 2);
    }
    assert.doesNotMatch(
      dockerCommands,
      /(?:^|\s)(?:up|build|pull|tag|rmi|rm)(?:\s|$)|migrat/i,
    );
  });
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
