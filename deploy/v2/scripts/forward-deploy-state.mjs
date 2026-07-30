import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORWARD_STATES = Object.freeze({
  PREPARED: 'PREPARED',
  MUTATION_STARTED: 'MUTATION_STARTED',
  RECOVERABLE_FAILURE: 'RECOVERABLE_FAILURE',
  COMPLETION_UNCERTAIN: 'COMPLETION_UNCERTAIN',
  COMPLETE: 'COMPLETE',
});

export const EXPECTED_LEGACY_STATE = 'LEGACY_ROLLED_BACK';
export const FORWARD_TARGET_SHA = 'fb10bdeb88b2be4924b4ee5cd0d22f88f872a7d6';
export const FORWARD_REPOSITORY = 'welathfindrr13/oasis-care-international';

export const FAILURE_CLASSES = Object.freeze([
  'CHECKOUT_FAILED',
  'PREFLIGHT_FAILED',
  'BUILD_FAILED',
  'RUNTIME_REPLACEMENT_FAILED',
  'CONTAINER_HEALTH_FAILED',
  'REVISION_PROOF_FAILED',
  'LEGACY_STATE_CHANGED',
  'TRANSPORT_RECOVERY_REQUIRED',
  'COMPLETION_STATE_UNCERTAIN',
  'UNEXPECTED_FAILURE',
]);

export const FAILURE_PHASES = Object.freeze([
  'CHECKOUT',
  'PREFLIGHT',
  'BUILD',
  'RUNTIME_REPLACEMENT',
  'CONTAINER_HEALTH',
  'REVISION_PROOF',
  'LEGACY_STATE',
  'TRANSPORT',
  'COMPLETION',
  'UNEXPECTED_EXIT',
]);

export const SERVICE_STATE_CATEGORIES = Object.freeze([
  'MISSING',
  'RUNNING_HEALTHY',
  'RUNNING_UNHEALTHY',
  'EXITED_ZERO',
  'EXITED_NONZERO',
  'OOM_KILLED',
  'OTHER',
]);

export const LOG_CATEGORIES = Object.freeze([
  'MODULE_RESOLUTION_FAILURE',
  'DATABASE_CONNECTION_FAILURE',
  'CONFIGURATION_FAILURE',
  'READINESS_FAILURE',
  'NO_MATCH',
  'UNAVAILABLE',
]);

export const FETCH_DIAGNOSTIC_CATEGORIES = Object.freeze([
  'FETCH_TIMEOUT',
  'FETCH_TERMINATED',
  'FETCH_AUTHENTICATION',
  'FETCH_DNS',
  'FETCH_TLS',
  'FETCH_NETWORK',
  'FETCH_REMOTE_REF',
  'FETCH_PACK_TRANSFER',
  'FETCH_PACK_FINALIZATION',
  'FETCH_OBJECT_CORRUPTION',
  'FETCH_REF_LOCK',
  'FETCH_DISK',
  'FETCH_INODE',
  'FETCH_UNKNOWN',
]);

const FAILURE_CLASS_SET = new Set(FAILURE_CLASSES);
const FAILURE_PHASE_SET = new Set(FAILURE_PHASES);
const SERVICE_STATE_CATEGORY_SET = new Set(SERVICE_STATE_CATEGORIES);
const LOG_CATEGORY_SET = new Set(LOG_CATEGORIES);
const FETCH_DIAGNOSTIC_CATEGORY_SET = new Set(FETCH_DIAGNOSTIC_CATEGORIES);
const MANIFEST_KIND = 'oasis-forward-deploy';
const MANIFEST_VERSION = 1;
const MAX_MANIFEST_BYTES = 32 * 1024;
const MAX_FAILURE_EVIDENCE_BYTES = 4 * 1024;
const MAX_FETCH_DIAGNOSTIC_BYTES = 64 * 1024;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const ATTEMPT_ID_PATTERN = /^[0-9a-f]{32}$/;
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SERVICES = Object.freeze(['api', 'web', 'caddy']);
const MUTATION_CONTENT = `${FORWARD_STATES.MUTATION_STARTED}\n`;
const COMPLETION_CONTENT = 'FORWARD_DEPLOY_COMPLETE\n';

export class ForwardStateError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code = 'FORWARD_STATE_INVALID') {
  throw new ForwardStateError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) fail();
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail();
  }
}

function assertNotSymlink(target, expectedType) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) fail();
  if (expectedType === 'directory' && !stat.isDirectory()) fail();
  if (expectedType === 'file' && !stat.isFile()) fail();
  return stat;
}

function assertPrivateMode(stat, expectedMode) {
  if ((stat.mode & 0o777) !== expectedMode) fail();
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function atomicWrite(destination, contents, mode = 0o600) {
  const directory = path.dirname(destination);
  const temporary = path.join(directory, `.tmp-${crypto.randomBytes(12).toString('hex')}`);
  const flags =
    fs.constants.O_CREAT |
    fs.constants.O_EXCL |
    fs.constants.O_WRONLY |
    (fs.constants.O_NOFOLLOW || 0);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, flags, mode);
    fs.writeFileSync(descriptor, contents, { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, destination);
    fsyncDirectory(directory);
  } catch {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // The durable state is uncertain and callers fail closed.
      }
    }
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
}

function safeRoot(rootDir) {
  const resolved = path.resolve(rootDir || '');
  if (!rootDir || resolved === path.parse(resolved).root) fail();
  return resolved;
}

function pathsFor(rootDir, attemptId) {
  if (!ATTEMPT_ID_PATTERN.test(attemptId || '')) fail();
  const root = safeRoot(rootDir);
  const attempts = path.join(root, 'attempts');
  const attempt = path.join(attempts, attemptId);
  return {
    root,
    attempts,
    preparationLock: path.join(root, 'preparation.lock'),
    attempt,
    reservation: path.join(attempt, 'reservation'),
    transitionLock: path.join(attempt, 'transition.lock'),
    manifest: path.join(attempt, 'manifest.json'),
    mutation: path.join(attempt, 'mutation-started'),
    failure: path.join(attempt, 'recoverable-failure'),
    completionUncertain: path.join(attempt, 'completion-uncertain'),
    failureEvidence: path.join(attempt, 'failure-evidence.json'),
    fetchDiagnostic: path.join(attempt, 'fetch-diagnostic.json'),
    completion: path.join(attempt, 'completion'),
  };
}

function validateFetchDiagnostic(diagnostic) {
  exactKeys(diagnostic, ['exitStatus', 'category']);
  if (
    !Number.isInteger(diagnostic.exitStatus) ||
    diagnostic.exitStatus < 1 ||
    diagnostic.exitStatus > 255 ||
    !FETCH_DIAGNOSTIC_CATEGORY_SET.has(diagnostic.category)
  ) {
    fail();
  }
  return diagnostic;
}

function validateFailureEvidence(evidence, expectedFailureClass) {
  exactKeys(evidence, ['failureClass', 'phase', 'serviceStates', 'logCategories']);
  if (
    evidence.failureClass !== expectedFailureClass ||
    !FAILURE_CLASS_SET.has(evidence.failureClass) ||
    !FAILURE_PHASE_SET.has(evidence.phase)
  ) {
    fail();
  }
  exactKeys(evidence.serviceStates, SERVICES);
  exactKeys(evidence.logCategories, SERVICES);
  for (const service of SERVICES) {
    if (
      !SERVICE_STATE_CATEGORY_SET.has(evidence.serviceStates[service]) ||
      !LOG_CATEGORY_SET.has(evidence.logCategories[service])
    ) {
      fail();
    }
  }
  return evidence;
}

function acquireDirectoryLock(lockPath, parent) {
  try {
    fs.mkdirSync(lockPath, { mode: 0o700 });
    fsyncDirectory(parent);
  } catch (error) {
    if (error?.code === 'EEXIST') fail('FORWARD_STATE_LOCKED');
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
}

function releaseDirectoryLock(lockPath, parent) {
  try {
    fs.rmdirSync(lockPath);
    fsyncDirectory(parent);
  } catch {
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
}

function validateRollbackImages(images, legacyAttemptId) {
  exactKeys(images, SERVICES);
  for (const service of SERVICES) {
    const image = images[service];
    exactKeys(image, ['id', 'alias']);
    if (
      !IMAGE_ID_PATTERN.test(image.id) ||
      image.alias !== `oasis-legacy-bootstrap-${service}:${legacyAttemptId}`
    ) {
      fail();
    }
  }
  return images;
}

export function validateForwardManifest(
  manifest,
  { expectedTargetSha = FORWARD_TARGET_SHA } = {},
) {
  exactKeys(manifest, [
    'schemaVersion',
    'kind',
    'attemptId',
    'targetSha',
    'workflowSha',
    'originMainSha',
    'repository',
    'expectedStartState',
    'legacyStateDigest',
    'legacyTargetSha',
    'legacyAttemptId',
    'rollbackImages',
  ]);
  if (
    !SHA_PATTERN.test(expectedTargetSha || '') ||
    manifest.schemaVersion !== MANIFEST_VERSION ||
    manifest.kind !== MANIFEST_KIND ||
    !ATTEMPT_ID_PATTERN.test(manifest.attemptId) ||
    manifest.targetSha !== expectedTargetSha ||
    !SHA_PATTERN.test(manifest.workflowSha) ||
    manifest.originMainSha !== manifest.workflowSha ||
    manifest.repository !== FORWARD_REPOSITORY ||
    manifest.expectedStartState !== EXPECTED_LEGACY_STATE ||
    !DIGEST_PATTERN.test(manifest.legacyStateDigest) ||
    !SHA_PATTERN.test(manifest.legacyTargetSha) ||
    !ATTEMPT_ID_PATTERN.test(manifest.legacyAttemptId)
  ) {
    fail();
  }
  validateRollbackImages(manifest.rollbackImages, manifest.legacyAttemptId);
  return manifest;
}

function legacyPaths(legacyStateDir) {
  const stateDir = safeRoot(legacyStateDir);
  return {
    stateDir,
    reservation: path.join(stateDir, 'reservation'),
    manifest: path.join(stateDir, 'manifest.json'),
    completion: path.join(stateDir, 'completion'),
  };
}

function readLegacyBytes(paths) {
  assertPrivateMode(assertNotSymlink(paths.stateDir, 'directory'), 0o700);
  assertPrivateMode(assertNotSymlink(paths.reservation, 'directory'), 0o700);
  if (fs.readdirSync(paths.reservation).length !== 0) fail();
  const allowed = new Set(['reservation', 'manifest.json', 'completion']);
  for (const entry of fs.readdirSync(paths.stateDir)) {
    if (!allowed.has(entry)) fail();
  }
  const manifestStat = assertNotSymlink(paths.manifest, 'file');
  assertPrivateMode(manifestStat, 0o600);
  if (manifestStat.size <= 0 || manifestStat.size > MAX_MANIFEST_BYTES) fail();
  const manifestBytes = fs.readFileSync(paths.manifest);
  let completionBytes = Buffer.from('ABSENT');
  if (fs.existsSync(paths.completion)) {
    assertPrivateMode(assertNotSymlink(paths.completion, 'file'), 0o600);
    completionBytes = fs.readFileSync(paths.completion);
  }
  const digest = crypto
    .createHash('sha256')
    .update('oasis-legacy-start-v1\0reservation-present\0')
    .update(manifestBytes)
    .update('\0completion\0')
    .update(completionBytes)
    .digest('hex');
  return { digest };
}

export async function readLegacyBinding({ legacyStateDir, legacyStateHelper }) {
  const helperPath = path.resolve(legacyStateHelper || '');
  if (!legacyStateHelper || helperPath === path.parse(helperPath).root) fail();
  assertNotSymlink(helperPath, 'file');
  let helper;
  try {
    helper = await import(`${pathToFileURL(helperPath).href}?forward=${crypto.randomBytes(8).toString('hex')}`);
  } catch {
    fail();
  }
  if (typeof helper.readState !== 'function') fail();

  let legacy;
  try {
    legacy = helper.readState({ stateDir: legacyStateDir });
  } catch {
    fail();
  }
  if (legacy?.status !== EXPECTED_LEGACY_STATE) fail('FORWARD_LEGACY_STATE_UNSAFE');
  if (!SHA_PATTERN.test(legacy.targetSha) || !ATTEMPT_ID_PATTERN.test(legacy.attemptId)) fail();
  const rollbackImages = Object.fromEntries(
    SERVICES.map((service) => [service, { ...legacy.images?.[service] }]),
  );
  validateRollbackImages(rollbackImages, legacy.attemptId);
  const { digest } = readLegacyBytes(legacyPaths(legacyStateDir));
  return {
    digest,
    targetSha: legacy.targetSha,
    attemptId: legacy.attemptId,
    rollbackImages,
  };
}

function validateRunningImages(runningImageIds, rollbackImages) {
  exactKeys(runningImageIds, SERVICES);
  for (const service of SERVICES) {
    if (
      !IMAGE_ID_PATTERN.test(runningImageIds[service] || '') ||
      runningImageIds[service] !== rollbackImages[service].id
    ) {
      fail('FORWARD_RUNNING_IMAGES_UNSAFE');
    }
  }
}

export async function prepareForwardState({
  rootDir,
  targetSha,
  workflowSha,
  originMainSha,
  repository,
  attemptId,
  legacyStateDir,
  legacyStateHelper,
  expectedLegacyDigest,
  runningImageIds,
}) {
  if (
    targetSha !== FORWARD_TARGET_SHA ||
    !SHA_PATTERN.test(workflowSha || '') ||
    originMainSha !== workflowSha ||
    repository !== FORWARD_REPOSITORY ||
    !ATTEMPT_ID_PATTERN.test(attemptId || '') ||
    !DIGEST_PATTERN.test(expectedLegacyDigest || '')
  ) {
    fail();
  }
  const binding = await readLegacyBinding({ legacyStateDir, legacyStateHelper });
  if (binding.digest !== expectedLegacyDigest) fail('FORWARD_LEGACY_STATE_UNSAFE');
  validateRunningImages(runningImageIds, binding.rollbackImages);

  const manifest = validateForwardManifest({
    schemaVersion: MANIFEST_VERSION,
    kind: MANIFEST_KIND,
    attemptId,
    targetSha,
    workflowSha,
    originMainSha,
    repository,
    expectedStartState: EXPECTED_LEGACY_STATE,
    legacyStateDigest: binding.digest,
    legacyTargetSha: binding.targetSha,
    legacyAttemptId: binding.attemptId,
    rollbackImages: binding.rollbackImages,
  });
  const paths = pathsFor(rootDir, attemptId);
  const parent = path.dirname(paths.root);
  assertPrivateMode(assertNotSymlink(parent, 'directory'), 0o700);
  try {
    fs.mkdirSync(paths.root, { mode: 0o700 });
    fsyncDirectory(parent);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      assertPrivateMode(assertNotSymlink(paths.root, 'directory'), 0o700);
      if (fs.existsSync(paths.preparationLock)) fail('FORWARD_STATE_LOCKED');
      fail('FORWARD_STATE_ALREADY_CONSUMED');
    }
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
  acquireDirectoryLock(paths.preparationLock, paths.root);
  let releasePreparation = true;
  try {
    fs.mkdirSync(paths.attempts, { mode: 0o700 });
    fsyncDirectory(paths.root);
    fs.mkdirSync(paths.attempt, { mode: 0o700 });
    fsyncDirectory(paths.attempts);
    fs.mkdirSync(paths.reservation, { mode: 0o700 });
    fsyncDirectory(paths.attempt);
    atomicWrite(paths.manifest, `${JSON.stringify(manifest)}\n`);
    releaseDirectoryLock(paths.preparationLock, paths.root);
    releasePreparation = false;
    return manifest;
  } catch (error) {
    if (releasePreparation && fs.existsSync(paths.preparationLock)) {
      try {
        releaseDirectoryLock(paths.preparationLock, paths.root);
      } catch {
        throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
      }
    }
    if (error instanceof ForwardStateError) throw error;
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
}

function readMarker(target, expected) {
  assertPrivateMode(assertNotSymlink(target, 'file'), 0o600);
  const contents = fs.readFileSync(target, 'utf8');
  if (contents !== expected) fail();
}

function readForwardStateInternal(
  paths,
  { lockHeld = false, expectedTargetSha = FORWARD_TARGET_SHA } = {},
) {
  assertPrivateMode(assertNotSymlink(paths.root, 'directory'), 0o700);
  if (fs.existsSync(paths.preparationLock)) fail('FORWARD_STATE_LOCKED');
  if (
    fs.readdirSync(paths.root).length !== 1 ||
    fs.readdirSync(paths.root)[0] !== 'attempts'
  ) {
    fail();
  }
  assertPrivateMode(assertNotSymlink(paths.attempts, 'directory'), 0o700);
  if (
    fs.readdirSync(paths.attempts).length !== 1 ||
    fs.readdirSync(paths.attempts)[0] !== path.basename(paths.attempt)
  ) {
    fail();
  }
  assertPrivateMode(assertNotSymlink(paths.attempt, 'directory'), 0o700);
  assertPrivateMode(assertNotSymlink(paths.reservation, 'directory'), 0o700);
  if (!lockHeld && fs.existsSync(paths.transitionLock)) fail('FORWARD_STATE_LOCKED');
  const allowed = new Set([
    'reservation',
    'manifest.json',
    'mutation-started',
    'recoverable-failure',
    'completion-uncertain',
    'failure-evidence.json',
    'fetch-diagnostic.json',
    'completion',
    ...(lockHeld ? ['transition.lock'] : []),
  ]);
  for (const entry of fs.readdirSync(paths.attempt)) {
    if (!allowed.has(entry)) fail();
  }
  const manifestStat = assertNotSymlink(paths.manifest, 'file');
  assertPrivateMode(manifestStat, 0o600);
  if (manifestStat.size <= 0 || manifestStat.size > MAX_MANIFEST_BYTES) fail();
  const manifest = validateForwardManifest(JSON.parse(fs.readFileSync(paths.manifest, 'utf8')), {
    expectedTargetSha,
  });

  const mutationExists = fs.existsSync(paths.mutation);
  const failureExists = fs.existsSync(paths.failure);
  const completionUncertainExists = fs.existsSync(paths.completionUncertain);
  const failureEvidenceExists = fs.existsSync(paths.failureEvidence);
  const fetchDiagnosticExists = fs.existsSync(paths.fetchDiagnostic);
  const completionExists = fs.existsSync(paths.completion);
  if (
    (failureExists && completionExists) ||
    (failureExists && completionUncertainExists) ||
    ((failureExists || completionExists) && !mutationExists) ||
    (completionUncertainExists && !mutationExists) ||
    (failureEvidenceExists && !failureExists && !completionUncertainExists) ||
    (fetchDiagnosticExists && !mutationExists) ||
    (fetchDiagnosticExists && (completionExists || completionUncertainExists))
  ) {
    fail();
  }
  if (mutationExists) readMarker(paths.mutation, MUTATION_CONTENT);
  let failureClass = null;
  if (failureExists) {
    assertPrivateMode(assertNotSymlink(paths.failure, 'file'), 0o600);
    failureClass = fs.readFileSync(paths.failure, 'utf8').trim();
    if (!FAILURE_CLASS_SET.has(failureClass)) fail();
  }
  if (fetchDiagnosticExists && failureExists && failureClass !== 'CHECKOUT_FAILED') fail();
  if (completionUncertainExists) {
    assertPrivateMode(assertNotSymlink(paths.completionUncertain, 'file'), 0o600);
    const uncertainClass = fs.readFileSync(paths.completionUncertain, 'utf8').trim();
    if (uncertainClass !== 'COMPLETION_STATE_UNCERTAIN') fail();
    failureClass = uncertainClass;
  }
  let failureEvidence = null;
  if (failureEvidenceExists) {
    const evidenceStat = assertNotSymlink(paths.failureEvidence, 'file');
    assertPrivateMode(evidenceStat, 0o600);
    if (evidenceStat.size <= 0 || evidenceStat.size > MAX_FAILURE_EVIDENCE_BYTES) fail();
    failureEvidence = validateFailureEvidence(
      JSON.parse(fs.readFileSync(paths.failureEvidence, 'utf8')),
      failureClass,
    );
  }
  let fetchDiagnostic = null;
  if (fetchDiagnosticExists) {
    const diagnosticStat = assertNotSymlink(paths.fetchDiagnostic, 'file');
    assertPrivateMode(diagnosticStat, 0o600);
    if (diagnosticStat.size <= 0 || diagnosticStat.size > MAX_FAILURE_EVIDENCE_BYTES) fail();
    fetchDiagnostic = validateFetchDiagnostic(
      JSON.parse(fs.readFileSync(paths.fetchDiagnostic, 'utf8')),
    );
  }
  if (completionExists) readMarker(paths.completion, COMPLETION_CONTENT);

  const state = completionUncertainExists
    ? FORWARD_STATES.COMPLETION_UNCERTAIN
    : completionExists
      ? FORWARD_STATES.COMPLETE
    : failureExists
      ? FORWARD_STATES.RECOVERABLE_FAILURE
      : mutationExists
        ? FORWARD_STATES.MUTATION_STARTED
        : FORWARD_STATES.PREPARED;
  return { manifest, state, failureClass, failureEvidence, fetchDiagnostic };
}

export function readForwardState({ rootDir, attemptId }) {
  return readForwardStateInternal(pathsFor(rootDir, attemptId));
}

export function readForwardStateForTarget({ rootDir, attemptId, expectedTargetSha }) {
  if (!SHA_PATTERN.test(expectedTargetSha || '')) fail();
  return readForwardStateInternal(pathsFor(rootDir, attemptId), { expectedTargetSha });
}

export function transitionForwardState({ rootDir, attemptId, nextState, failureClass }) {
  if (!Object.values(FORWARD_STATES).includes(nextState)) fail();
  const paths = pathsFor(rootDir, attemptId);
  readForwardStateInternal(paths);
  acquireDirectoryLock(paths.transitionLock, paths.attempt);
  let releaseTransition = true;
  try {
    const current = readForwardStateInternal(paths, { lockHeld: true });
    if (nextState === FORWARD_STATES.MUTATION_STARTED) {
      if (current.state !== FORWARD_STATES.PREPARED || failureClass != null) fail();
      atomicWrite(paths.mutation, MUTATION_CONTENT);
    } else if (nextState === FORWARD_STATES.RECOVERABLE_FAILURE) {
      if (
        current.state !== FORWARD_STATES.MUTATION_STARTED ||
        !FAILURE_CLASS_SET.has(failureClass) ||
        (current.fetchDiagnostic !== null && failureClass !== 'CHECKOUT_FAILED')
      ) {
        fail();
      }
      atomicWrite(paths.failure, `${failureClass}\n`);
    } else if (nextState === FORWARD_STATES.COMPLETE) {
      if (
        current.state !== FORWARD_STATES.MUTATION_STARTED ||
        current.fetchDiagnostic !== null ||
        failureClass != null
      ) {
        fail();
      }
      atomicWrite(paths.completion, COMPLETION_CONTENT);
    } else if (nextState === FORWARD_STATES.COMPLETION_UNCERTAIN) {
      if (
        (current.state !== FORWARD_STATES.MUTATION_STARTED && current.state !== FORWARD_STATES.COMPLETE) ||
        current.fetchDiagnostic !== null ||
        failureClass !== 'COMPLETION_STATE_UNCERTAIN'
      ) {
        fail();
      }
      atomicWrite(paths.completionUncertain, `${failureClass}\n`);
    } else {
      fail();
    }
    releaseDirectoryLock(paths.transitionLock, paths.attempt);
    releaseTransition = false;
    return readForwardState({ rootDir, attemptId });
  } catch (error) {
    if (releaseTransition && fs.existsSync(paths.transitionLock)) {
      try {
        releaseDirectoryLock(paths.transitionLock, paths.attempt);
      } catch {
        throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
      }
    }
    if (error instanceof ForwardStateError) throw error;
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
}

export function adjudicateForwardStateUnderMutationLock({ rootDir, attemptId }) {
  const paths = pathsFor(rootDir, attemptId);
  if (!fs.existsSync(paths.transitionLock)) {
    return readForwardStateInternal(paths);
  }
  const lockStat = assertNotSymlink(paths.transitionLock, 'directory');
  assertPrivateMode(lockStat, 0o700);
  if (fs.readdirSync(paths.transitionLock).length !== 0) fail();
  readForwardStateInternal(paths, { lockHeld: true });
  releaseDirectoryLock(paths.transitionLock, paths.attempt);
  return readForwardStateInternal(paths);
}

export function recordFailureEvidence({
  rootDir,
  attemptId,
  failureClass,
  phase,
  serviceStates,
  logCategories,
}) {
  const paths = pathsFor(rootDir, attemptId);
  const evidence = validateFailureEvidence({
    failureClass,
    phase,
    serviceStates,
    logCategories,
  }, failureClass);
  readForwardStateInternal(paths);
  acquireDirectoryLock(paths.transitionLock, paths.attempt);
  let releaseTransition = true;
  try {
    const current = readForwardStateInternal(paths, { lockHeld: true });
    if (
      (current.state !== FORWARD_STATES.RECOVERABLE_FAILURE &&
        current.state !== FORWARD_STATES.COMPLETION_UNCERTAIN) ||
      current.failureClass !== failureClass ||
      current.failureEvidence !== null ||
      fs.existsSync(paths.failureEvidence)
    ) {
      fail();
    }
    atomicWrite(paths.failureEvidence, `${JSON.stringify(evidence)}\n`);
    releaseDirectoryLock(paths.transitionLock, paths.attempt);
    releaseTransition = false;
    return readForwardState({ rootDir, attemptId }).failureEvidence;
  } catch (error) {
    if (releaseTransition && fs.existsSync(paths.transitionLock)) {
      try {
        releaseDirectoryLock(paths.transitionLock, paths.attempt);
      } catch {
        throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
      }
    }
    if (error instanceof ForwardStateError) throw error;
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
}

export function redactGitFetchDiagnostic(stderr) {
  return String(stderr ?? '')
    .replace(/\b(Authorization\s*:\s*)(?:Basic|Bearer)\s+\S+/gi, '$1[REDACTED]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|glpat-[A-Za-z0-9_-]{16,})\b/g, '[REDACTED]')
    .replace(/(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:access_token|auth|authorization|credential|key|password|secret|token)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/\b((?:access_token|auth|authorization|credential|password|secret|token)\s*[=:]\s*)\S+/gi, '$1[REDACTED]');
}

export function classifyGitFetchFailure({ exitStatus, stderr }) {
  const numericStatus = Number(exitStatus);
  if (!Number.isInteger(numericStatus) || numericStatus < 1 || numericStatus > 255) fail();
  if (numericStatus === 124) {
    return validateFetchDiagnostic({ exitStatus: numericStatus, category: 'FETCH_TIMEOUT' });
  }
  if (numericStatus === 137 || numericStatus === 143) {
    return validateFetchDiagnostic({ exitStatus: numericStatus, category: 'FETCH_TERMINATED' });
  }

  const material = redactGitFetchDiagnostic(stderr).toLowerCase();
  let category = 'FETCH_UNKNOWN';
  if (/(authentication failed|permission denied|could not read username|terminal prompts disabled|invalid credentials|repository access denied|http (401|403))/.test(material)) {
    category = 'FETCH_AUTHENTICATION';
  } else if (/(could not resolve host|name or service not known|temporary failure in name resolution|nodename nor servname)/.test(material)) {
    category = 'FETCH_DNS';
  } else if (/(ssl certificate|tls|certificate verify failed|schannel|gnutls_handshake)/.test(material)) {
    category = 'FETCH_TLS';
  } else if (/(could not connect|connection (timed out|refused|reset)|network is unreachable|failed to connect)/.test(material)) {
    category = 'FETCH_NETWORK';
  } else if (/(couldn't find remote ref|remote ref .* not found|repository not found|not a git repository|does not appear to be a git repository)/.test(material)) {
    category = 'FETCH_REMOTE_REF';
  } else if (/(inode|too many links)/.test(material)) {
    category = 'FETCH_INODE';
  } else if (/(no space left on device|disk quota exceeded|file too large|input\/output error)/.test(material)) {
    category = 'FETCH_DISK';
  } else if (/(cannot lock ref|unable to update local ref|reference broken|\.lock['": ]|ref lock)/.test(material)) {
    category = 'FETCH_REF_LOCK';
  } else if (/(object .* corrupt|corrupt object|bad object|sha1 mismatch|invalid object|unresolved deltas)/.test(material)) {
    category = 'FETCH_OBJECT_CORRUPTION';
  } else if (/(index-pack failed|invalid index-pack output|unable to index pack|pack finalization|failed to write pack|packfile .* does not match index)/.test(material)) {
    category = 'FETCH_PACK_FINALIZATION';
  } else if (/(rpc failed|early eof|unexpected disconnect|fetch-pack:|sideband packet|pack transfer|remote end hung up)/.test(material)) {
    category = 'FETCH_PACK_TRANSFER';
  }
  return validateFetchDiagnostic({ exitStatus: numericStatus, category });
}

export function classifyGitFetchDiagnosticFile({ diagnosticFile, exitStatus }) {
  const resolved = path.resolve(diagnosticFile || '');
  if (!diagnosticFile || resolved === path.parse(resolved).root) fail();
  const stat = assertNotSymlink(resolved, 'file');
  assertPrivateMode(stat, 0o600);
  if (stat.size > MAX_FETCH_DIAGNOSTIC_BYTES) fail();
  return classifyGitFetchFailure({
    exitStatus,
    stderr: fs.readFileSync(resolved, 'utf8'),
  });
}

export function recordFetchDiagnostic({ rootDir, attemptId, exitStatus, category }) {
  const paths = pathsFor(rootDir, attemptId);
  const diagnostic = validateFetchDiagnostic({
    exitStatus: Number(exitStatus),
    category,
  });
  readForwardStateInternal(paths);
  acquireDirectoryLock(paths.transitionLock, paths.attempt);
  let releaseTransition = true;
  try {
    const current = readForwardStateInternal(paths, { lockHeld: true });
    if (
      current.state !== FORWARD_STATES.MUTATION_STARTED ||
      current.fetchDiagnostic !== null ||
      fs.existsSync(paths.fetchDiagnostic)
    ) {
      fail();
    }
    atomicWrite(paths.fetchDiagnostic, `${JSON.stringify(diagnostic)}\n`);
    releaseDirectoryLock(paths.transitionLock, paths.attempt);
    releaseTransition = false;
    return readForwardState({ rootDir, attemptId }).fetchDiagnostic;
  } catch (error) {
    if (releaseTransition && fs.existsSync(paths.transitionLock)) {
      try {
        releaseDirectoryLock(paths.transitionLock, paths.attempt);
      } catch {
        throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
      }
    }
    if (error instanceof ForwardStateError) throw error;
    throw new ForwardStateError('FORWARD_STATE_IO_UNCERTAIN');
  }
}

export async function verifyLegacyStateUnchanged({
  rootDir,
  attemptId,
  legacyStateDir,
  legacyStateHelper,
  expectedTargetSha = FORWARD_TARGET_SHA,
}) {
  const forward = readForwardStateForTarget({ rootDir, attemptId, expectedTargetSha });
  const legacy = await readLegacyBinding({ legacyStateDir, legacyStateHelper });
  if (
    legacy.digest !== forward.manifest.legacyStateDigest ||
    legacy.targetSha !== forward.manifest.legacyTargetSha ||
    legacy.attemptId !== forward.manifest.legacyAttemptId ||
    JSON.stringify(legacy.rollbackImages) !== JSON.stringify(forward.manifest.rollbackImages)
  ) {
    fail('FORWARD_LEGACY_STATE_UNSAFE');
  }
  return forward;
}

function writePrivateExport(destination, lines) {
  const resolved = path.resolve(destination || '');
  if (!destination || fs.existsSync(resolved)) fail();
  const parent = path.dirname(resolved);
  assertPrivateMode(assertNotSymlink(parent, 'directory'), 0o700);
  atomicWrite(resolved, `${lines.join('\n')}\n`);
}

export async function writeLegacyBindingExport({ legacyStateDir, legacyStateHelper, destination }) {
  const binding = await readLegacyBinding({ legacyStateDir, legacyStateHelper });
  writePrivateExport(destination, [
    `LEGACY_STATE_DIGEST=${binding.digest}`,
    `LEGACY_TARGET_SHA=${binding.targetSha}`,
    `LEGACY_ATTEMPT_ID=${binding.attemptId}`,
    ...SERVICES.flatMap((service) => [
      `${service.toUpperCase()}_IMAGE_ID=${binding.rollbackImages[service].id}`,
      `${service.toUpperCase()}_IMAGE_ALIAS=${binding.rollbackImages[service].alias}`,
    ]),
  ]);
  return binding;
}

function environmentRunningImages() {
  return {
    api: process.env.RUNNING_API_IMAGE_ID,
    web: process.env.RUNNING_WEB_IMAGE_ID,
    caddy: process.env.RUNNING_CADDY_IMAGE_ID,
  };
}

function environmentFailureEvidence() {
  return {
    failureClass: process.env.FAILURE_CLASS,
    phase: process.env.FAILURE_PHASE,
    serviceStates: Object.fromEntries(
      SERVICES.map((service) => [service, process.env[`${service.toUpperCase()}_STATE_CATEGORY`]]),
    ),
    logCategories: Object.fromEntries(
      SERVICES.map((service) => [service, process.env[`${service.toUpperCase()}_LOG_CATEGORY`]]),
    ),
  };
}

function stateOutput(state) {
  return `FORWARD_STATE_${state}`;
}

async function main() {
  const command = process.argv[2] || '';
  try {
    if (command === 'inspect-legacy') {
      await writeLegacyBindingExport({
        legacyStateDir: process.env.LEGACY_STATE_DIR,
        legacyStateHelper: process.env.LEGACY_STATE_HELPER,
        destination: process.env.FORWARD_BINDING_EXPORT,
      });
      process.stdout.write('FORWARD_LEGACY_START_VALID\n');
      return;
    }
    if (command === 'prepare') {
      await prepareForwardState({
        rootDir: process.env.FORWARD_STATE_ROOT,
        targetSha: process.env.TARGET_SHA,
        workflowSha: process.env.WORKFLOW_SHA,
        originMainSha: process.env.ORIGIN_MAIN_SHA,
        repository: process.env.REPOSITORY,
        attemptId: process.env.ATTEMPT_ID,
        legacyStateDir: process.env.LEGACY_STATE_DIR,
        legacyStateHelper: process.env.LEGACY_STATE_HELPER,
        expectedLegacyDigest: process.env.EXPECTED_LEGACY_STATE_DIGEST,
        runningImageIds: environmentRunningImages(),
      });
      process.stdout.write(`${stateOutput(FORWARD_STATES.PREPARED)}\n`);
      return;
    }
    if (command === 'transition') {
      const result = transitionForwardState({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
        nextState: process.env.NEXT_STATE,
        failureClass: process.env.FAILURE_CLASS,
      });
      process.stdout.write(`${stateOutput(result.state)}\n`);
      return;
    }
    if (command === 'inspect') {
      const result = readForwardState({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
      });
      process.stdout.write(`${stateOutput(result.state)}\n`);
      return;
    }
    if (command === 'adjudicate-completion') {
      const result = adjudicateForwardStateUnderMutationLock({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
      });
      process.stdout.write(`${stateOutput(result.state)}\n`);
      return;
    }
    if (command === 'inspect-failure') {
      const result = readForwardState({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
      });
      if (
        (result.state !== FORWARD_STATES.RECOVERABLE_FAILURE &&
          result.state !== FORWARD_STATES.COMPLETION_UNCERTAIN) ||
        !FAILURE_CLASS_SET.has(result.failureClass)
      ) {
        fail();
      }
      process.stdout.write(`FORWARD_FAILURE_CLASS_${result.failureClass}\n`);
      process.stdout.write(`FORWARD_FAILURE_EVIDENCE_${result.failureEvidence === null ? 'ABSENT' : 'PRESENT'}\n`);
      process.stdout.write(`FORWARD_FETCH_DIAGNOSTIC_${result.fetchDiagnostic === null ? 'ABSENT' : 'PRESENT'}\n`);
      if (result.fetchDiagnostic !== null) {
        process.stdout.write(`FORWARD_FETCH_EXIT_STATUS_${result.fetchDiagnostic.exitStatus}\n`);
        process.stdout.write(`FORWARD_FETCH_CATEGORY_${result.fetchDiagnostic.category}\n`);
      }
      return;
    }
    if (command === 'inspect-fetch') {
      const result = readForwardState({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
      });
      process.stdout.write(`FORWARD_FETCH_DIAGNOSTIC_${result.fetchDiagnostic === null ? 'ABSENT' : 'PRESENT'}\n`);
      return;
    }
    if (command === 'classify-fetch') {
      const diagnostic = classifyGitFetchDiagnosticFile({
        diagnosticFile: process.env.FETCH_DIAGNOSTIC_FILE,
        exitStatus: process.env.FETCH_EXIT_STATUS,
      });
      process.stdout.write(`FETCH_EXIT_STATUS=${diagnostic.exitStatus}\n`);
      process.stdout.write(`FETCH_ERROR_CATEGORY=${diagnostic.category}\n`);
      return;
    }
    if (command === 'record-fetch-diagnostic') {
      recordFetchDiagnostic({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
        exitStatus: process.env.FETCH_EXIT_STATUS,
        category: process.env.FETCH_ERROR_CATEGORY,
      });
      process.stdout.write('FORWARD_FETCH_DIAGNOSTIC_RECORDED\n');
      return;
    }
    if (command === 'record-evidence') {
      recordFailureEvidence({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
        ...environmentFailureEvidence(),
      });
      process.stdout.write('FORWARD_FAILURE_EVIDENCE_RECORDED\n');
      return;
    }
    if (command === 'verify-legacy') {
      await verifyLegacyStateUnchanged({
        rootDir: process.env.FORWARD_STATE_ROOT,
        attemptId: process.env.ATTEMPT_ID,
        legacyStateDir: process.env.LEGACY_STATE_DIR,
        legacyStateHelper: process.env.LEGACY_STATE_HELPER,
      });
      process.stdout.write('FORWARD_LEGACY_STATE_UNCHANGED\n');
      return;
    }
    fail();
  } catch (error) {
    const code = error instanceof ForwardStateError ? error.code : 'FORWARD_STATE_IO_UNCERTAIN';
    process.stdout.write(`${code}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
