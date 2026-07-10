import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const STATES = Object.freeze({
  PREPARED: 'PREPARED',
  MUTATION_STARTED: 'MUTATION_STARTED',
  REVISION_AWARE_COMPLETE: 'REVISION_AWARE_COMPLETE',
  ROLLBACK_REQUIRED: 'ROLLBACK_REQUIRED',
  LEGACY_ROLLED_BACK: 'LEGACY_ROLLED_BACK',
});

const MANIFEST_KIND = 'oasis-legacy-bootstrap';
const MANIFEST_VERSION = 1;
const LEGACY_REVISION = 'LEGACY_UNKNOWN';
const MAX_MANIFEST_BYTES = 32 * 1024;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;
const ATTEMPT_ID_PATTERN = /^[0-9a-f]{32}$/;
const SERVICES = Object.freeze(['api', 'web', 'caddy']);
const STATES_AFTER_COMPLETION = new Set([
  STATES.REVISION_AWARE_COMPLETE,
  STATES.ROLLBACK_REQUIRED,
  STATES.LEGACY_ROLLED_BACK,
]);

const ALLOWED_TRANSITIONS = new Map([
  [STATES.PREPARED, new Set([STATES.MUTATION_STARTED])],
  [STATES.MUTATION_STARTED, new Set([
    STATES.REVISION_AWARE_COMPLETE,
    STATES.ROLLBACK_REQUIRED,
  ])],
  [STATES.REVISION_AWARE_COMPLETE, new Set([STATES.ROLLBACK_REQUIRED])],
  [STATES.ROLLBACK_REQUIRED, new Set([STATES.LEGACY_ROLLED_BACK])],
  [STATES.LEGACY_ROLLED_BACK, new Set()],
]);

class StateError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code = 'STATE_INVALID') {
  throw new StateError(code);
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) fail();
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail();
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function expectedAlias(service, attemptId) {
  return `oasis-legacy-bootstrap-${service}:${attemptId}`;
}

export function validateManifest(manifest) {
  exactKeys(manifest, [
    'schemaVersion',
    'kind',
    'attemptId',
    'legacyRevision',
    'targetSha',
    'status',
    'completedOnce',
    'images',
  ]);
  if (
    manifest.schemaVersion !== MANIFEST_VERSION ||
    manifest.kind !== MANIFEST_KIND ||
    manifest.legacyRevision !== LEGACY_REVISION ||
    !ATTEMPT_ID_PATTERN.test(manifest.attemptId) ||
    !SHA_PATTERN.test(manifest.targetSha) ||
    !Object.values(STATES).includes(manifest.status) ||
    typeof manifest.completedOnce !== 'boolean' ||
    (manifest.completedOnce && !STATES_AFTER_COMPLETION.has(manifest.status)) ||
    (!manifest.completedOnce && manifest.status === STATES.REVISION_AWARE_COMPLETE)
  ) {
    fail();
  }

  exactKeys(manifest.images, SERVICES);
  for (const service of SERVICES) {
    const image = manifest.images[service];
    exactKeys(image, ['id', 'alias']);
    if (
      !IMAGE_ID_PATTERN.test(image.id) ||
      image.alias !== expectedAlias(service, manifest.attemptId)
    ) {
      fail();
    }
  }
  return manifest;
}

export function canTransition(from, to) {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) === true;
}

function pathsFor(stateDir) {
  const resolved = path.resolve(stateDir || '');
  if (!stateDir || resolved === path.parse(resolved).root) fail();
  return {
    stateDir: resolved,
    reservation: path.join(resolved, 'reservation'),
    lock: path.join(resolved, 'transition.lock'),
    manifest: path.join(resolved, 'manifest.json'),
    completion: path.join(resolved, 'completion'),
  };
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
  const temporary = path.join(directory, `.tmp-${randomBytes(12).toString('hex')}`);
  const flags =
    fs.constants.O_CREAT |
    fs.constants.O_EXCL |
    fs.constants.O_WRONLY |
    (fs.constants.O_NOFOLLOW || 0);
  const descriptor = fs.openSync(temporary, flags, mode);
  let closed = false;
  try {
    fs.writeFileSync(descriptor, contents, { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    closed = true;
    fs.renameSync(temporary, destination);
    fsyncDirectory(directory);
  } catch {
    if (!closed) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // The state is uncertain and the caller will fail closed.
      }
    }
    throw new StateError('STATE_IO_UNCERTAIN');
  }
}

function ensureExistingStateLayout(paths) {
  assertPrivateMode(assertNotSymlink(paths.stateDir, 'directory'), 0o700);
  assertPrivateMode(assertNotSymlink(paths.reservation, 'directory'), 0o700);
  if (fs.existsSync(paths.lock)) fail('STATE_LOCKED');
  if (!fs.existsSync(paths.manifest)) fail();
}

function acquireLock(paths) {
  try {
    fs.mkdirSync(paths.lock, { mode: 0o700 });
    fsyncDirectory(paths.stateDir);
  } catch (error) {
    if (error?.code === 'EEXIST') fail('STATE_LOCKED');
    throw new StateError('STATE_IO_UNCERTAIN');
  }
}

function releaseLock(paths) {
  fs.rmdirSync(paths.lock);
  fsyncDirectory(paths.stateDir);
}

function readManifestFile(paths, { lockHeld = false } = {}) {
  ensureExistingStateLayout({
    ...paths,
    lock: lockHeld ? path.join(paths.stateDir, '.lock-held-sentinel') : paths.lock,
  });
  const stat = assertNotSymlink(paths.manifest, 'file');
  assertPrivateMode(stat, 0o600);
  if (stat.size <= 0 || stat.size > MAX_MANIFEST_BYTES) fail();
  const manifest = validateManifest(JSON.parse(fs.readFileSync(paths.manifest, 'utf8')));

  const completionExists = fs.existsSync(paths.completion);
  if (completionExists) {
    assertPrivateMode(assertNotSymlink(paths.completion, 'file'), 0o600);
    const completion = fs.readFileSync(paths.completion, 'utf8');
    if (completion !== `${STATES.REVISION_AWARE_COMPLETE}\n`) fail();
    if (!manifest.completedOnce) fail();
  }
  return manifest;
}

function createManifest({ targetSha, attemptId, imageIds }) {
  const manifest = {
    schemaVersion: MANIFEST_VERSION,
    kind: MANIFEST_KIND,
    attemptId,
    legacyRevision: LEGACY_REVISION,
    targetSha,
    status: STATES.PREPARED,
    completedOnce: false,
    images: Object.fromEntries(
      SERVICES.map((service) => [
        service,
        { id: imageIds[service], alias: expectedAlias(service, attemptId) },
      ]),
    ),
  };
  return validateManifest(manifest);
}

export function prepareState({ stateDir, targetSha, attemptId, imageIds }) {
  if (!SHA_PATTERN.test(targetSha || '') || !ATTEMPT_ID_PATTERN.test(attemptId || '')) fail();
  exactKeys(imageIds, SERVICES);
  for (const service of SERVICES) {
    if (!IMAGE_ID_PATTERN.test(imageIds[service] || '')) fail();
  }
  const manifest = createManifest({ targetSha, attemptId, imageIds });
  const paths = pathsFor(stateDir);

  if (fs.existsSync(paths.stateDir)) {
    assertPrivateMode(assertNotSymlink(paths.stateDir, 'directory'), 0o700);
    if (
      fs.existsSync(paths.reservation) ||
      fs.existsSync(paths.manifest) ||
      fs.existsSync(paths.lock) ||
      fs.existsSync(paths.completion)
    ) {
      fail('STATE_ALREADY_CONSUMED');
    }
  } else {
    fs.mkdirSync(paths.stateDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(paths.stateDir, 0o700);
    fsyncDirectory(path.dirname(paths.stateDir));
  }

  try {
    fs.mkdirSync(paths.reservation, { mode: 0o700 });
    fsyncDirectory(paths.stateDir);
  } catch (error) {
    if (error?.code === 'EEXIST') fail('STATE_ALREADY_CONSUMED');
    throw new StateError('STATE_IO_UNCERTAIN');
  }

  acquireLock(paths);
  atomicWrite(paths.manifest, `${JSON.stringify(manifest)}\n`);
  releaseLock(paths);
  return manifest;
}

export function readState({ stateDir }) {
  const paths = pathsFor(stateDir);
  return readManifestFile(paths);
}

export function transitionState({ stateDir, targetSha, nextState }) {
  if (!SHA_PATTERN.test(targetSha || '') || !Object.values(STATES).includes(nextState)) fail();
  const paths = pathsFor(stateDir);
  ensureExistingStateLayout(paths);
  acquireLock(paths);
  let releaseOnError = false;
  let completedManifestIsDurable = false;
  try {
    const current = readManifestFile(paths, { lockHeld: true });
    if (current.targetSha !== targetSha || !canTransition(current.status, nextState)) {
      releaseOnError = true;
      fail();
    }
    const updated = validateManifest({
      ...current,
      status: nextState,
      completedOnce:
        current.completedOnce || nextState === STATES.REVISION_AWARE_COMPLETE,
    });
    atomicWrite(paths.manifest, `${JSON.stringify(updated)}\n`);
    if (nextState === STATES.REVISION_AWARE_COMPLETE) {
      completedManifestIsDurable = true;
      if (fs.existsSync(paths.completion)) fail('STATE_IO_UNCERTAIN');
      atomicWrite(paths.completion, `${STATES.REVISION_AWARE_COMPLETE}\n`);
    }
    releaseLock(paths);
    return updated;
  } catch (error) {
    if ((releaseOnError || completedManifestIsDurable) && fs.existsSync(paths.lock)) {
      releaseLock(paths);
    }
    throw error;
  }
}

export function writeExportFile({ stateDir, targetSha, destination }) {
  if (!SHA_PATTERN.test(targetSha || '')) fail();
  const paths = pathsFor(stateDir);
  const resolvedDestination = path.resolve(destination || '');
  if (
    !destination ||
    path.dirname(resolvedDestination) !== paths.stateDir ||
    !path.basename(resolvedDestination).startsWith('.export-') ||
    fs.existsSync(resolvedDestination)
  ) {
    fail();
  }
  ensureExistingStateLayout(paths);
  acquireLock(paths);
  try {
    const manifest = readManifestFile(paths, { lockHeld: true });
    if (manifest.targetSha !== targetSha) fail();
    const lines = [
      `TARGET_SHA=${manifest.targetSha}`,
      `ATTEMPT_ID=${manifest.attemptId}`,
      `STATUS=${manifest.status}`,
      ...SERVICES.flatMap((service) => [
        `${service.toUpperCase()}_IMAGE_ID=${manifest.images[service].id}`,
        `${service.toUpperCase()}_IMAGE_ALIAS=${manifest.images[service].alias}`,
      ]),
    ];
    atomicWrite(resolvedDestination, `${lines.join('\n')}\n`);
    releaseLock(paths);
    return manifest;
  } catch (error) {
    if (error instanceof StateError && error.code === 'STATE_INVALID' && fs.existsSync(paths.lock)) {
      releaseLock(paths);
    }
    throw error;
  }
}

function environmentImageIds() {
  return {
    api: process.env.API_IMAGE_ID,
    web: process.env.WEB_IMAGE_ID,
    caddy: process.env.CADDY_IMAGE_ID,
  };
}

function outputForState(status) {
  return `STATE_${status}`;
}

async function main() {
  const command = process.argv[2] || '';
  try {
    if (command === 'prepare') {
      const manifest = prepareState({
        stateDir: process.env.LEGACY_STATE_DIR,
        targetSha: process.env.TARGET_SHA,
        attemptId: process.env.ATTEMPT_ID,
        imageIds: environmentImageIds(),
      });
      process.stdout.write(`${outputForState(manifest.status)}\n`);
      return;
    }
    if (command === 'transition') {
      const manifest = transitionState({
        stateDir: process.env.LEGACY_STATE_DIR,
        targetSha: process.env.TARGET_SHA,
        nextState: process.env.NEXT_STATE,
      });
      process.stdout.write(`${outputForState(manifest.status)}\n`);
      return;
    }
    if (command === 'export') {
      writeExportFile({
        stateDir: process.env.LEGACY_STATE_DIR,
        targetSha: process.env.TARGET_SHA,
        destination: process.env.LEGACY_STATE_EXPORT_PATH,
      });
      process.stdout.write('STATE_EXPORT_READY\n');
      return;
    }
    fail();
  } catch (error) {
    const code = error instanceof StateError ? error.code : 'STATE_IO_UNCERTAIN';
    process.stdout.write(`${code}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
