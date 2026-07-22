#!/usr/bin/env node
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  FORWARD_STATES,
  readForwardState,
  verifyLegacyStateUnchanged,
} from './forward-deploy-state.mjs';

export const ARCHIVE_REVIEW_BASE_SHA = '0d7b8472535220d56efeb56512449cbfcc884ee7';
export const ARCHIVABLE_ATTEMPT_ID = 'e8db1facbaa5b7e9d45b1994af3211d0';
export const ARCHIVABLE_TARGET_SHA = '18aacd8458a3f96a38bf470d9a4c837ad563fa5c';
export const ARCHIVABLE_WORKFLOW_SHA = '5fe23e7e9eac33945763bef272c92f68dd39e4ff';
export const ARCHIVABLE_FAILURE_CLASS = 'RUNTIME_REPLACEMENT_FAILED';
export const ARCHIVABLE_REPOSITORY = 'welathfindrr13/oasis-care-international';

const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REQUIRED_SERVICES = Object.freeze(['api', 'web', 'caddy']);
const FORWARD_ROOT_NAME = 'forward-deployment-v1';
const HISTORY_ROOT_NAME = 'forward-deployment-history-v1';
const MUTATION_LOCK_NAME = 'production-vps-mutation.lock';

export class ForwardArchiveError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code = 'FORWARD_ARCHIVE_INVALID') {
  throw new ForwardArchiveError(code);
}

function safeAbsoluteDirectory(value) {
  const resolved = path.resolve(value || '');
  if (!value || resolved === path.parse(resolved).root) fail();
  return resolved;
}

function exactKeys(value, expected) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail();
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail();
  }
}

function assertOwnedPath(target, type, mode) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    fail('FORWARD_ARCHIVE_ACCESS_UNSAFE');
  }
  if (
    stat.isSymbolicLink() ||
    (type === 'directory' && !stat.isDirectory()) ||
    (type === 'file' && !stat.isFile()) ||
    (stat.mode & 0o777) !== mode ||
    stat.uid !== process.getuid?.() ||
    stat.gid !== process.getgid?.()
  ) {
    fail('FORWARD_ARCHIVE_ACCESS_UNSAFE');
  }
  return stat;
}

function assertGitCommonDirectory(gitCommonDir) {
  const stat = assertOwnedPath(gitCommonDir, 'directory', fs.lstatSync(gitCommonDir).mode & 0o777);
  if ((stat.mode & 0o022) !== 0) fail('FORWARD_ARCHIVE_ACCESS_UNSAFE');
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function validateMutationLockDescriptor(lockPath, lockFd) {
  if (!Number.isInteger(lockFd) || lockFd < 0) fail('FORWARD_ARCHIVE_LOCK_REQUIRED');
  const pathStat = assertOwnedPath(lockPath, 'file', 0o600);
  let descriptorStat;
  try {
    descriptorStat = fs.fstatSync(lockFd);
  } catch {
    fail('FORWARD_ARCHIVE_LOCK_REQUIRED');
  }
  if (
    !descriptorStat.isFile() ||
    descriptorStat.dev !== pathStat.dev ||
    descriptorStat.ino !== pathStat.ino
  ) {
    fail('FORWARD_ARCHIVE_LOCK_REQUIRED');
  }
}

function acquireMutationLock(lockFd) {
  const stdio = Array.from({ length: Math.max(lockFd + 1, 3) }, () => 'ignore');
  stdio[lockFd] = lockFd;
  const result = spawnSync('flock', ['-n', String(lockFd)], { stdio });
  if (result.status !== 0) fail('FORWARD_ARCHIVE_LOCK_REQUIRED');
}

function walkStateTree(root) {
  const entries = [];
  const visit = (absolute, relative) => {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      fail('FORWARD_ARCHIVE_LAYOUT_UNSAFE');
    }
    const expectedMode = stat.isDirectory() ? 0o700 : 0o600;
    if (
      (stat.mode & 0o777) !== expectedMode ||
      stat.uid !== process.getuid?.() ||
      stat.gid !== process.getgid?.()
    ) {
      fail('FORWARD_ARCHIVE_ACCESS_UNSAFE');
    }
    entries.push({ absolute, relative, stat });
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        visit(path.join(absolute, name), relative ? path.join(relative, name) : name);
      }
    }
  };
  visit(root, '');
  return entries;
}

function stateTreeDigest(root) {
  const hash = crypto.createHash('sha256');
  for (const entry of walkStateTree(root)) {
    const type = entry.stat.isDirectory() ? 'directory' : 'file';
    hash.update(`${type}\0${entry.relative}\0${entry.stat.mode & 0o777}\0${entry.stat.uid}\0${entry.stat.gid}\0`);
    if (type === 'file') {
      hash.update(fs.readFileSync(entry.absolute));
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

function validateIncidentState(state, attemptId) {
  if (
    state.state !== FORWARD_STATES.RECOVERABLE_FAILURE ||
    state.failureClass !== ARCHIVABLE_FAILURE_CLASS ||
    state.manifest.attemptId !== attemptId ||
    state.manifest.targetSha !== ARCHIVABLE_TARGET_SHA ||
    state.manifest.workflowSha !== ARCHIVABLE_WORKFLOW_SHA ||
    state.manifest.originMainSha !== ARCHIVABLE_WORKFLOW_SHA ||
    state.manifest.repository !== ARCHIVABLE_REPOSITORY ||
    state.manifest.expectedStartState !== 'LEGACY_ROLLED_BACK'
  ) {
    fail('FORWARD_ARCHIVE_STATE_UNSAFE');
  }
}

function readIncidentState(rootDir, attemptId) {
  try {
    const state = readForwardState({ rootDir, attemptId });
    validateIncidentState(state, attemptId);
    return state;
  } catch (error) {
    if (error instanceof ForwardArchiveError) throw error;
    fail('FORWARD_ARCHIVE_STATE_UNSAFE');
  }
}

async function verifyLegacyBinding({ rootDir, attemptId, legacyStateDir, legacyStateHelper }) {
  try {
    await verifyLegacyStateUnchanged({ rootDir, attemptId, legacyStateDir, legacyStateHelper });
  } catch (error) {
    if (error instanceof ForwardArchiveError) throw error;
    fail('FORWARD_ARCHIVE_LEGACY_UNSAFE');
  }
}

function validateRunningImages(runningImageIds, state) {
  exactKeys(runningImageIds, REQUIRED_SERVICES);
  for (const service of REQUIRED_SERVICES) {
    if (
      !IMAGE_ID_PATTERN.test(runningImageIds[service] || '') ||
      runningImageIds[service] !== state.manifest.rollbackImages[service].id
    ) {
      fail('FORWARD_ARCHIVE_RUNTIME_UNSAFE');
    }
  }
}

function resolveDockerAlias(alias) {
  const result = spawnSync(
    'timeout',
    [
      '--signal=TERM',
      '--kill-after=2s',
      '10s',
      'docker',
      'image',
      'inspect',
      '--format',
      '{{.Id}}',
      alias,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  const output = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  if (result.status !== 0 || !IMAGE_ID_PATTERN.test(output) || output.includes('\n')) {
    fail('FORWARD_ARCHIVE_ALIAS_UNSAFE');
  }
  return output;
}

function verifyRollbackAliases(state, aliasResolver) {
  for (const service of REQUIRED_SERVICES) {
    const rollbackImage = state.manifest.rollbackImages[service];
    let resolved;
    try {
      resolved = aliasResolver(rollbackImage.alias);
    } catch (error) {
      if (error instanceof ForwardArchiveError) throw error;
      fail('FORWARD_ARCHIVE_ALIAS_UNSAFE');
    }
    if (resolved !== rollbackImage.id) fail('FORWARD_ARCHIVE_ALIAS_UNSAFE');
  }
}

function archivePaths(gitCommonDir, attemptId) {
  const gitCommon = safeAbsoluteDirectory(gitCommonDir);
  const deployStateRoot = path.join(gitCommon, 'oasis-deploy');
  const sourceRoot = path.join(deployStateRoot, FORWARD_ROOT_NAME);
  const historyRoot = path.join(deployStateRoot, HISTORY_ROOT_NAME);
  const destinationRoot = path.join(historyRoot, attemptId);
  const mutationLock = path.join(deployStateRoot, MUTATION_LOCK_NAME);
  return { gitCommon, deployStateRoot, sourceRoot, historyRoot, destinationRoot, mutationLock };
}

async function validateArchivedState({
  rootDir,
  attemptId,
  legacyStateDir,
  legacyStateHelper,
  runningImageIds,
  expectedDigest,
}) {
  if (stateTreeDigest(rootDir) !== expectedDigest) fail('FORWARD_ARCHIVE_CONTENT_CHANGED');
  const state = readIncidentState(rootDir, attemptId);
  validateRunningImages(runningImageIds, state);
  await verifyLegacyBinding({ rootDir, attemptId, legacyStateDir, legacyStateHelper });
  return state;
}

export async function archiveFailedForwardAttempt({
  gitCommonDir,
  attemptId,
  targetSha,
  reviewBaseSha,
  repository,
  legacyStateDir,
  legacyStateHelper,
  runningImageIds,
  mutationLockFd = 9,
  lockVerifier = acquireMutationLock,
  aliasResolver = resolveDockerAlias,
  afterRename = () => {},
}) {
  if (
    attemptId !== ARCHIVABLE_ATTEMPT_ID ||
    targetSha !== ARCHIVABLE_TARGET_SHA ||
    reviewBaseSha !== ARCHIVE_REVIEW_BASE_SHA ||
    repository !== ARCHIVABLE_REPOSITORY
  ) {
    fail();
  }

  const paths = archivePaths(gitCommonDir, attemptId);
  assertGitCommonDirectory(paths.gitCommon);
  assertOwnedPath(paths.deployStateRoot, 'directory', 0o700);
  validateMutationLockDescriptor(paths.mutationLock, mutationLockFd);
  lockVerifier(mutationLockFd);

  if (fs.existsSync(paths.destinationRoot)) {
    if (fs.existsSync(paths.sourceRoot)) fail('FORWARD_ARCHIVE_HISTORY_UNSAFE');
    const archivedDigest = stateTreeDigest(paths.destinationRoot);
    const archivedState = await validateArchivedState({
      rootDir: paths.destinationRoot,
      attemptId,
      legacyStateDir,
      legacyStateHelper,
      runningImageIds,
      expectedDigest: archivedDigest,
    });
    verifyRollbackAliases(archivedState, aliasResolver);
    fail('FORWARD_ARCHIVE_ALREADY_ROTATED');
  }
  if (!fs.existsSync(paths.sourceRoot)) {
    fail('FORWARD_ARCHIVE_STATE_MISSING');
  }

  const sourceDigest = stateTreeDigest(paths.sourceRoot);
  const sourceState = readIncidentState(paths.sourceRoot, attemptId);
  validateRunningImages(runningImageIds, sourceState);
  await verifyLegacyBinding({
    rootDir: paths.sourceRoot,
    attemptId,
    legacyStateDir,
    legacyStateHelper,
  });
  verifyRollbackAliases(sourceState, aliasResolver);

  if (fs.existsSync(paths.historyRoot)) {
    assertOwnedPath(paths.historyRoot, 'directory', 0o700);
    if (fs.readdirSync(paths.historyRoot).length !== 0) fail('FORWARD_ARCHIVE_HISTORY_UNSAFE');
  } else {
    try {
      fs.mkdirSync(paths.historyRoot, { mode: 0o700 });
      fsyncDirectory(paths.deployStateRoot);
    } catch {
      fail('FORWARD_ARCHIVE_IO_UNCERTAIN');
    }
  }

  let renamed = false;
  try {
    fs.renameSync(paths.sourceRoot, paths.destinationRoot);
    renamed = true;
    fsyncDirectory(paths.deployStateRoot);
    fsyncDirectory(paths.historyRoot);
    await afterRename(paths);
    if (fs.existsSync(paths.sourceRoot) || !fs.existsSync(paths.destinationRoot)) {
      fail('FORWARD_ARCHIVE_IO_UNCERTAIN');
    }
    verifyRollbackAliases(sourceState, aliasResolver);
    const archivedState = await validateArchivedState({
      rootDir: paths.destinationRoot,
      attemptId,
      legacyStateDir,
      legacyStateHelper,
      runningImageIds,
      expectedDigest: sourceDigest,
    });
    return { state: archivedState, ...paths };
  } catch (error) {
    if (renamed) {
      try {
        if (fs.existsSync(paths.sourceRoot) || !fs.existsSync(paths.destinationRoot)) {
          throw new Error('archive paths are uncertain');
        }
        fs.renameSync(paths.destinationRoot, paths.sourceRoot);
        fsyncDirectory(paths.deployStateRoot);
        fsyncDirectory(paths.historyRoot);
        await validateArchivedState({
          rootDir: paths.sourceRoot,
          attemptId,
          legacyStateDir,
          legacyStateHelper,
          runningImageIds,
          expectedDigest: sourceDigest,
        });
        throw new ForwardArchiveError('FORWARD_ARCHIVE_VERIFICATION_FAILED_RESTORED');
      } catch (restoreError) {
        if (
          restoreError instanceof ForwardArchiveError &&
          restoreError.code === 'FORWARD_ARCHIVE_VERIFICATION_FAILED_RESTORED'
        ) {
          throw restoreError;
        }
        throw new ForwardArchiveError('FORWARD_ARCHIVE_STATE_UNCERTAIN');
      }
    }
    if (error instanceof ForwardArchiveError) throw error;
    throw new ForwardArchiveError('FORWARD_ARCHIVE_IO_UNCERTAIN');
  }
}

function runningImagesFromEnvironment() {
  return {
    api: process.env.RUNNING_API_IMAGE_ID,
    web: process.env.RUNNING_WEB_IMAGE_ID,
    caddy: process.env.RUNNING_CADDY_IMAGE_ID,
  };
}

async function main() {
  try {
    await archiveFailedForwardAttempt({
      gitCommonDir: process.env.GIT_COMMON_DIR,
      attemptId: process.env.ATTEMPT_ID,
      targetSha: process.env.TARGET_SHA,
      reviewBaseSha: process.env.REVIEW_BASE_SHA,
      repository: process.env.REPOSITORY,
      legacyStateDir: process.env.LEGACY_STATE_DIR,
      legacyStateHelper: process.env.LEGACY_STATE_HELPER,
      runningImageIds: runningImagesFromEnvironment(),
      mutationLockFd: Number(process.env.MUTATION_LOCK_FD),
    });
    process.stdout.write('FORWARD_ARCHIVE_COMPLETE\n');
  } catch (error) {
    const code = error instanceof ForwardArchiveError ? error.code : 'FORWARD_ARCHIVE_IO_UNCERTAIN';
    process.stdout.write(`${code}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
