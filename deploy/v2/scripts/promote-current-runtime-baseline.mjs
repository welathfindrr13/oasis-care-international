#!/usr/bin/env node
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  FORWARD_STATES,
  FORWARD_TARGET_SHA,
  readForwardStateForTarget,
  verifyLegacyStateUnchanged,
} from "./forward-deploy-state.mjs";
import {
  STATES as LEGACY_STATES,
  prepareState as prepareLegacyState,
  readState as readLegacyState,
  transitionState as transitionLegacyState,
} from "./legacy-bootstrap-state.mjs";

export const CURRENT_RUNTIME_SHA = "5c194b259f5a9d21c58d9f68c3f8b196843a894d";
export const NEXT_FORWARD_TARGET_SHA =
  "fb10bdeb88b2be4924b4ee5cd0d22f88f872a7d6";

const ATTEMPT_ID_PATTERN = /^[0-9a-f]{32}$/;
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REQUIRED_SERVICES = Object.freeze(["api", "web", "caddy"]);
const FORWARD_ROOT_NAME = "forward-deployment-v1";
const FORWARD_HISTORY_NAME = "forward-deployment-history-v1";
const LEGACY_ROOT_NAME = "legacy-bootstrap-v1";
const LEGACY_HISTORY_NAME = "legacy-bootstrap-history-v1";
const STAGING_ROOT_NAME = "runtime-baseline-promotion-v1";
const MUTATION_LOCK_NAME = "production-vps-mutation.lock";

export class RuntimeBaselinePromotionError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code = "RUNTIME_BASELINE_PROMOTION_INVALID") {
  throw new RuntimeBaselinePromotionError(code);
}

function exactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    fail();
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    fail();
  }
}

function safeAbsoluteDirectory(value) {
  const resolved = path.resolve(value || "");
  if (!value || resolved === path.parse(resolved).root) fail();
  return resolved;
}

function assertOwnedPath(target, type, allowedModes) {
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    fail("RUNTIME_BASELINE_ACCESS_UNSAFE");
  }
  const mode = stat.mode & 0o777;
  if (
    stat.isSymbolicLink() ||
    (type === "directory" && !stat.isDirectory()) ||
    (type === "file" && !stat.isFile()) ||
    !allowedModes.includes(mode) ||
    stat.uid !== process.getuid?.() ||
    stat.gid !== process.getgid?.()
  ) {
    fail("RUNTIME_BASELINE_ACCESS_UNSAFE");
  }
  return stat;
}

function assertPrivateDirectory(target) {
  return assertOwnedPath(target, "directory", [0o700]);
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function walkPrivateTree(root) {
  const entries = [];
  const visit = (absolute, relative) => {
    const stat = fs.lstatSync(absolute);
    if (
      stat.isSymbolicLink() ||
      (!stat.isDirectory() && !stat.isFile()) ||
      stat.uid !== process.getuid?.() ||
      stat.gid !== process.getgid?.()
    ) {
      fail("RUNTIME_BASELINE_LAYOUT_UNSAFE");
    }
    const mode = stat.mode & 0o777;
    if (
      (stat.isDirectory() && mode !== 0o700) ||
      (stat.isFile() && mode !== 0o600 && mode !== 0o700)
    ) {
      fail("RUNTIME_BASELINE_LAYOUT_UNSAFE");
    }
    entries.push({ absolute, relative, stat });
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) {
        visit(
          path.join(absolute, name),
          relative ? path.join(relative, name) : name,
        );
      }
    }
  };
  visit(root, "");
  return entries;
}

function treeDigest(root) {
  const hash = crypto.createHash("sha256");
  for (const entry of walkPrivateTree(root)) {
    const type = entry.stat.isDirectory() ? "directory" : "file";
    hash.update(
      `${type}\0${entry.relative}\0${entry.stat.mode & 0o777}\0${entry.stat.uid}\0${entry.stat.gid}\0`,
    );
    if (type === "file") hash.update(fs.readFileSync(entry.absolute));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function validateMutationLockDescriptor(lockPath, lockFd) {
  if (!Number.isInteger(lockFd) || lockFd < 0)
    fail("RUNTIME_BASELINE_LOCK_REQUIRED");
  const pathStat = assertOwnedPath(lockPath, "file", [0o600]);
  let descriptorStat;
  try {
    descriptorStat = fs.fstatSync(lockFd);
  } catch {
    fail("RUNTIME_BASELINE_LOCK_REQUIRED");
  }
  if (
    !descriptorStat.isFile() ||
    descriptorStat.dev !== pathStat.dev ||
    descriptorStat.ino !== pathStat.ino
  ) {
    fail("RUNTIME_BASELINE_LOCK_REQUIRED");
  }
}

function acquireMutationLock(lockFd) {
  const stdio = Array.from({ length: Math.max(lockFd + 1, 3) }, () => "ignore");
  stdio[lockFd] = lockFd;
  const result = spawnSync("flock", ["-n", String(lockFd)], { stdio });
  if (result.status !== 0) fail("RUNTIME_BASELINE_LOCK_REQUIRED");
}

const PROMOTION_PHASES = Object.freeze({
  PREPARING: "PREPARING",
  PREPARED: "PREPARED",
  FORWARD_ARCHIVED: "FORWARD_ARCHIVED",
  LEGACY_ARCHIVED: "LEGACY_ARCHIVED",
  BASELINE_INSTALLED: "BASELINE_INSTALLED",
  COMPLETE: "COMPLETE",
  RESTORED: "RESTORED",
});
const PROMOTION_PHASE_SET = new Set(Object.values(PROMOTION_PHASES));
const JOURNAL_KIND = "oasis-runtime-baseline-promotion";
const JOURNAL_VERSION = 1;

function atomicWrite(destination, contents, mode = 0o600) {
  const directory = path.dirname(destination);
  const temporary = path.join(
    directory,
    `.tmp-${crypto.randomBytes(12).toString("hex")}`,
  );
  const flags =
    fs.constants.O_CREAT |
    fs.constants.O_EXCL |
    fs.constants.O_WRONLY |
    (fs.constants.O_NOFOLLOW || 0);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, flags, mode);
    fs.writeFileSync(descriptor, contents, { encoding: "utf8" });
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
        // A later recovery pass must adjudicate the retained promotion directory.
      }
    }
    fail("RUNTIME_BASELINE_IO_UNCERTAIN");
  }
}

function resolveAlias(alias) {
  const result = spawnSync(
    "timeout",
    [
      "--signal=TERM",
      "--kill-after=2s",
      "10s",
      "docker",
      "image",
      "inspect",
      "--format",
      "{{.Id}}",
      alias,
    ],
    { encoding: "utf8", maxBuffer: 2048, stdio: ["ignore", "pipe", "pipe"] },
  );
  const output = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const errorOutput = typeof result.stderr === "string" ? result.stderr : "";
  if (result.status !== 0) {
    if (
      result.status === 1 &&
      /(?:no such image|no such object|no such image or container)/i.test(
        errorOutput,
      )
    ) {
      return { status: "absent" };
    }
    fail("RUNTIME_BASELINE_ALIAS_LOOKUP_FAILED");
  }
  if (!IMAGE_ID_PATTERN.test(output) || output.includes("\n")) {
    fail("RUNTIME_BASELINE_ALIAS_UNSAFE");
  }
  return { status: "present", imageId: output };
}

function createAlias(imageId, alias) {
  const result = spawnSync(
    "timeout",
    [
      "--signal=TERM",
      "--kill-after=2s",
      "10s",
      "docker",
      "image",
      "tag",
      imageId,
      alias,
    ],
    { stdio: "ignore" },
  );
  if (result.status !== 0) fail("RUNTIME_BASELINE_ALIAS_WRITE_FAILED");
}

function removeAlias(alias) {
  const result = spawnSync(
    "timeout",
    ["--signal=TERM", "--kill-after=2s", "10s", "docker", "image", "rm", alias],
    { stdio: "ignore" },
  );
  if (result.status !== 0) fail("RUNTIME_BASELINE_ALIAS_REMOVE_FAILED");
}

function pathsFor(
  gitCommonDir,
  baselineAttemptId,
  forwardAttemptId,
  legacyAttemptId,
) {
  const gitCommon = safeAbsoluteDirectory(gitCommonDir);
  const deployRoot = path.join(gitCommon, "oasis-deploy");
  const forwardRoot = path.join(deployRoot, FORWARD_ROOT_NAME);
  const forwardHistory = path.join(deployRoot, FORWARD_HISTORY_NAME);
  const forwardArchive = path.join(forwardHistory, forwardAttemptId);
  const legacyRoot = path.join(deployRoot, LEGACY_ROOT_NAME);
  const legacyHistory = path.join(deployRoot, LEGACY_HISTORY_NAME);
  const legacyArchive = path.join(
    legacyHistory,
    `${legacyAttemptId}-before-${baselineAttemptId}`,
  );
  const stagingRoot = path.join(deployRoot, STAGING_ROOT_NAME);
  const stagingAttempt = path.join(stagingRoot, baselineAttemptId);
  const stagedLegacyRoot = path.join(stagingAttempt, LEGACY_ROOT_NAME);
  const stagedLegacyState = path.join(stagedLegacyRoot, "state");
  const journal = path.join(stagingAttempt, "journal.json");
  const mutationLock = path.join(deployRoot, MUTATION_LOCK_NAME);
  return {
    gitCommon,
    deployRoot,
    forwardRoot,
    forwardHistory,
    forwardArchive,
    legacyRoot,
    legacyState: path.join(legacyRoot, "state"),
    legacyHistory,
    legacyArchive,
    stagingRoot,
    stagingAttempt,
    stagedLegacyRoot,
    stagedLegacyState,
    journal,
    mutationLock,
  };
}

function deriveSingleForwardAttemptId(forwardRoot) {
  assertPrivateDirectory(forwardRoot);
  const rootEntries = fs.readdirSync(forwardRoot);
  if (rootEntries.length !== 1 || rootEntries[0] !== "attempts") {
    fail("RUNTIME_BASELINE_FORWARD_STATE_UNSAFE");
  }
  const attempts = path.join(forwardRoot, "attempts");
  assertPrivateDirectory(attempts);
  const attemptIds = fs.readdirSync(attempts);
  if (attemptIds.length !== 1 || !ATTEMPT_ID_PATTERN.test(attemptIds[0])) {
    fail("RUNTIME_BASELINE_FORWARD_STATE_UNSAFE");
  }
  return attemptIds[0];
}

function validateRunningImages(runningImageIds) {
  exactKeys(runningImageIds, REQUIRED_SERVICES);
  for (const service of REQUIRED_SERVICES) {
    if (!IMAGE_ID_PATTERN.test(runningImageIds[service] || "")) {
      fail("RUNTIME_BASELINE_RUNTIME_UNSAFE");
    }
  }
}

function ensurePrivateDirectory(directory, parent) {
  if (fs.existsSync(directory)) {
    assertPrivateDirectory(directory);
    return;
  }
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
    fsyncDirectory(parent);
  } catch {
    fail("RUNTIME_BASELINE_IO_UNCERTAIN");
  }
}

function verifyLegacyAliases(legacy, aliasResolver) {
  for (const service of REQUIRED_SERVICES) {
    const lookup = aliasResolver(legacy.images[service].alias);
    if (
      lookup?.status !== "present" ||
      lookup.imageId !== legacy.images[service].id
    ) {
      fail("RUNTIME_BASELINE_ALIAS_UNSAFE");
    }
  }
}

function verifyNewLegacyState(
  stateDir,
  baselineAttemptId,
  runningImageIds,
  aliasResolver,
) {
  const legacy = readLegacyState({ stateDir });
  if (
    legacy.status !== LEGACY_STATES.LEGACY_ROLLED_BACK ||
    legacy.targetSha !== CURRENT_RUNTIME_SHA ||
    legacy.attemptId !== baselineAttemptId
  ) {
    fail("RUNTIME_BASELINE_NEW_STATE_UNSAFE");
  }
  for (const service of REQUIRED_SERVICES) {
    const lookup = aliasResolver(legacy.images[service].alias);
    if (
      legacy.images[service].id !== runningImageIds[service] ||
      lookup?.status !== "present" ||
      lookup.imageId !== runningImageIds[service]
    ) {
      fail("RUNTIME_BASELINE_NEW_STATE_UNSAFE");
    }
  }
  return legacy;
}

function renameAndSync(source, destination, sourceParent, destinationParent) {
  fs.renameSync(source, destination);
  fsyncDirectory(sourceParent);
  if (destinationParent !== sourceParent) fsyncDirectory(destinationParent);
}

function validateJournal(journal) {
  exactKeys(journal, [
    "schemaVersion",
    "kind",
    "phase",
    "baselineAttemptId",
    "forwardAttemptId",
    "legacyAttemptId",
    "currentRuntimeSha",
    "nextTargetSha",
    "forwardDigest",
    "legacyDigest",
    "runningImageIds",
    "aliasIntents",
    "createdAliases",
  ]);
  if (
    journal.schemaVersion !== JOURNAL_VERSION ||
    journal.kind !== JOURNAL_KIND ||
    !PROMOTION_PHASE_SET.has(journal.phase) ||
    !ATTEMPT_ID_PATTERN.test(journal.baselineAttemptId || "") ||
    !ATTEMPT_ID_PATTERN.test(journal.forwardAttemptId || "") ||
    !ATTEMPT_ID_PATTERN.test(journal.legacyAttemptId || "") ||
    journal.currentRuntimeSha !== CURRENT_RUNTIME_SHA ||
    journal.nextTargetSha !== NEXT_FORWARD_TARGET_SHA ||
    !/^[0-9a-f]{64}$/.test(journal.forwardDigest || "") ||
    !/^[0-9a-f]{64}$/.test(journal.legacyDigest || "") ||
    !Array.isArray(journal.createdAliases) ||
    !Array.isArray(journal.aliasIntents) ||
    journal.aliasIntents.some(
      (service) => !REQUIRED_SERVICES.includes(service),
    ) ||
    journal.createdAliases.some(
      (service) => !REQUIRED_SERVICES.includes(service),
    ) ||
    new Set(journal.aliasIntents).size !== journal.aliasIntents.length ||
    new Set(journal.createdAliases).size !== journal.createdAliases.length ||
    journal.createdAliases.some(
      (service) => !journal.aliasIntents.includes(service),
    )
  ) {
    fail("RUNTIME_BASELINE_JOURNAL_UNSAFE");
  }
  validateRunningImages(journal.runningImageIds);
  return journal;
}

function readJournal(journalPath) {
  const stat = assertOwnedPath(journalPath, "file", [0o600]);
  if (stat.size <= 0 || stat.size > 32 * 1024)
    fail("RUNTIME_BASELINE_JOURNAL_UNSAFE");
  try {
    return validateJournal(JSON.parse(fs.readFileSync(journalPath, "utf8")));
  } catch (error) {
    if (error instanceof RuntimeBaselinePromotionError) throw error;
    fail("RUNTIME_BASELINE_JOURNAL_UNSAFE");
  }
}

function writeJournal(journalPath, journal, updates) {
  const next = validateJournal({ ...journal, ...updates });
  atomicWrite(journalPath, `${JSON.stringify(next)}\n`);
  return next;
}

function expectedNewAlias(service, baselineAttemptId) {
  return `oasis-legacy-bootstrap-${service}:${baselineAttemptId}`;
}

function removeIntendedNewAliases(
  journal,
  baselineAttemptId,
  aliasResolver,
  aliasRemover,
) {
  for (const service of journal.aliasIntents) {
    const alias = expectedNewAlias(service, baselineAttemptId);
    const lookup = aliasResolver(alias);
    if (lookup?.status === "absent") continue;
    if (
      lookup?.status !== "present" ||
      lookup.imageId !== journal.runningImageIds[service]
    ) {
      fail("RUNTIME_BASELINE_STATE_UNCERTAIN");
    }
    aliasRemover(alias);
    if (aliasResolver(alias)?.status !== "absent") {
      fail("RUNTIME_BASELINE_ALIAS_REMOVE_FAILED");
    }
  }
}

function verifyCanonicalRestored(paths, journal, aliasResolver) {
  if (
    !fs.existsSync(paths.forwardRoot) ||
    !fs.existsSync(paths.legacyRoot) ||
    fs.existsSync(paths.forwardArchive) ||
    fs.existsSync(paths.legacyArchive) ||
    treeDigest(paths.forwardRoot) !== journal.forwardDigest ||
    treeDigest(paths.legacyRoot) !== journal.legacyDigest
  ) {
    fail("RUNTIME_BASELINE_STATE_UNCERTAIN");
  }
  const forward = readForwardStateForTarget({
    rootDir: paths.forwardRoot,
    attemptId: journal.forwardAttemptId,
    expectedTargetSha: CURRENT_RUNTIME_SHA,
  });
  if (forward.state !== FORWARD_STATES.COMPLETE) {
    fail("RUNTIME_BASELINE_STATE_UNCERTAIN");
  }
  verifyLegacyAliases(
    readLegacyState({ stateDir: path.join(paths.legacyRoot, "state") }),
    aliasResolver,
  );
}

export function recoverCurrentRuntimeBaseline({
  gitCommonDir,
  baselineAttemptId,
  mutationLockFd = 9,
  lockVerifier = acquireMutationLock,
  aliasResolver = resolveAlias,
  aliasRemover = removeAlias,
}) {
  const gitCommon = safeAbsoluteDirectory(gitCommonDir);
  const stagingAttempt = path.join(
    gitCommon,
    "oasis-deploy",
    STAGING_ROOT_NAME,
    baselineAttemptId,
  );
  assertPrivateDirectory(stagingAttempt);
  const journalPath = path.join(stagingAttempt, "journal.json");
  let journal = readJournal(journalPath);
  const paths = pathsFor(
    gitCommon,
    baselineAttemptId,
    journal.forwardAttemptId,
    journal.legacyAttemptId,
  );
  validateMutationLockDescriptor(paths.mutationLock, mutationLockFd);
  lockVerifier(mutationLockFd);

  if (journal.phase === PROMOTION_PHASES.COMPLETE) {
    if (
      fs.existsSync(paths.forwardRoot) ||
      !fs.existsSync(paths.forwardArchive) ||
      !fs.existsSync(paths.legacyArchive) ||
      treeDigest(paths.forwardArchive) !== journal.forwardDigest ||
      treeDigest(paths.legacyArchive) !== journal.legacyDigest
    ) {
      fail("RUNTIME_BASELINE_STATE_UNCERTAIN");
    }
    verifyNewLegacyState(
      paths.legacyState,
      baselineAttemptId,
      journal.runningImageIds,
      aliasResolver,
    );
    verifyLegacyAliases(
      readLegacyState({ stateDir: path.join(paths.legacyArchive, "state") }),
      aliasResolver,
    );
    return { outcome: PROMOTION_PHASES.COMPLETE, journal, ...paths };
  }

  if (journal.phase === PROMOTION_PHASES.RESTORED) {
    removeIntendedNewAliases(
      journal,
      baselineAttemptId,
      aliasResolver,
      aliasRemover,
    );
    verifyCanonicalRestored(paths, journal, aliasResolver);
    return { outcome: PROMOTION_PHASES.RESTORED, journal, ...paths };
  }

  try {
    const canonicalLegacyExists = fs.existsSync(paths.legacyRoot);
    const stagedLegacyExists = fs.existsSync(paths.stagedLegacyRoot);
    const archivedLegacyExists = fs.existsSync(paths.legacyArchive);

    if (canonicalLegacyExists && archivedLegacyExists) {
      const canonical = readLegacyState({ stateDir: paths.legacyState });
      if (
        canonical.targetSha !== CURRENT_RUNTIME_SHA ||
        canonical.attemptId !== baselineAttemptId ||
        stagedLegacyExists
      ) {
        fail("RUNTIME_BASELINE_STATE_UNCERTAIN");
      }
      renameAndSync(
        paths.legacyRoot,
        paths.stagedLegacyRoot,
        paths.deployRoot,
        paths.stagingAttempt,
      );
    } else if (!canonicalLegacyExists && archivedLegacyExists) {
      if (stagedLegacyExists) {
        verifyNewLegacyState(
          paths.stagedLegacyState,
          baselineAttemptId,
          journal.runningImageIds,
          aliasResolver,
        );
      }
    } else if (!canonicalLegacyExists || archivedLegacyExists) {
      fail("RUNTIME_BASELINE_STATE_UNCERTAIN");
    }

    if (fs.existsSync(paths.legacyArchive)) {
      renameAndSync(
        paths.legacyArchive,
        paths.legacyRoot,
        paths.legacyHistory,
        paths.deployRoot,
      );
    }

    if (
      !fs.existsSync(paths.forwardRoot) &&
      fs.existsSync(paths.forwardArchive)
    ) {
      renameAndSync(
        paths.forwardArchive,
        paths.forwardRoot,
        paths.forwardHistory,
        paths.deployRoot,
      );
    } else if (
      fs.existsSync(paths.forwardRoot) === fs.existsSync(paths.forwardArchive)
    ) {
      fail("RUNTIME_BASELINE_STATE_UNCERTAIN");
    }

    removeIntendedNewAliases(
      journal,
      baselineAttemptId,
      aliasResolver,
      aliasRemover,
    );

    verifyCanonicalRestored(paths, journal, aliasResolver);
    journal = writeJournal(journalPath, journal, {
      phase: PROMOTION_PHASES.RESTORED,
    });
    return { outcome: PROMOTION_PHASES.RESTORED, journal, ...paths };
  } catch (error) {
    if (
      error instanceof RuntimeBaselinePromotionError &&
      error.code === "RUNTIME_BASELINE_STATE_UNCERTAIN"
    ) {
      throw error;
    }
    throw new RuntimeBaselinePromotionError("RUNTIME_BASELINE_STATE_UNCERTAIN");
  }
}

export async function promoteCurrentRuntimeBaseline({
  gitCommonDir,
  baselineAttemptId,
  currentRuntimeSha,
  nextTargetSha,
  runningImageIds,
  mutationLockFd = 9,
  lockVerifier = acquireMutationLock,
  aliasResolver = resolveAlias,
  aliasCreator = createAlias,
  aliasRemover = removeAlias,
  onDurableStep = () => {},
  recoverOnFailure = true,
}) {
  if (
    !ATTEMPT_ID_PATTERN.test(baselineAttemptId || "") ||
    currentRuntimeSha !== CURRENT_RUNTIME_SHA ||
    nextTargetSha !== NEXT_FORWARD_TARGET_SHA ||
    FORWARD_TARGET_SHA !== NEXT_FORWARD_TARGET_SHA
  ) {
    fail();
  }
  validateRunningImages(runningImageIds);

  const preliminaryGitCommon = safeAbsoluteDirectory(gitCommonDir);
  const preliminaryForwardRoot = path.join(
    preliminaryGitCommon,
    "oasis-deploy",
    FORWARD_ROOT_NAME,
  );
  const forwardAttemptId = deriveSingleForwardAttemptId(preliminaryForwardRoot);
  const preliminaryLegacyState = path.join(
    preliminaryGitCommon,
    "oasis-deploy",
    LEGACY_ROOT_NAME,
    "state",
  );
  const currentLegacy = readLegacyState({ stateDir: preliminaryLegacyState });
  if (currentLegacy.status !== LEGACY_STATES.LEGACY_ROLLED_BACK) {
    fail("RUNTIME_BASELINE_LEGACY_STATE_UNSAFE");
  }

  const paths = pathsFor(
    preliminaryGitCommon,
    baselineAttemptId,
    forwardAttemptId,
    currentLegacy.attemptId,
  );
  assertOwnedPath(paths.gitCommon, "directory", [
    fs.lstatSync(paths.gitCommon).mode & 0o777,
  ]);
  assertPrivateDirectory(paths.deployRoot);
  validateMutationLockDescriptor(paths.mutationLock, mutationLockFd);
  lockVerifier(mutationLockFd);

  if (
    fs.existsSync(paths.forwardArchive) ||
    fs.existsSync(paths.legacyArchive) ||
    fs.existsSync(paths.stagingAttempt)
  ) {
    fail("RUNTIME_BASELINE_DESTINATION_EXISTS");
  }

  const forwardState = readForwardStateForTarget({
    rootDir: paths.forwardRoot,
    attemptId: forwardAttemptId,
    expectedTargetSha: CURRENT_RUNTIME_SHA,
  });
  if (forwardState.state !== FORWARD_STATES.COMPLETE) {
    fail("RUNTIME_BASELINE_FORWARD_STATE_UNSAFE");
  }
  await verifyLegacyStateUnchanged({
    rootDir: paths.forwardRoot,
    attemptId: forwardAttemptId,
    legacyStateDir: paths.legacyState,
    legacyStateHelper: path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "legacy-bootstrap-state.mjs",
    ),
    expectedTargetSha: CURRENT_RUNTIME_SHA,
  });
  verifyLegacyAliases(currentLegacy, aliasResolver);
  for (const service of REQUIRED_SERVICES) {
    const lookup = aliasResolver(expectedNewAlias(service, baselineAttemptId));
    if (lookup?.status !== "absent") {
      fail(
        lookup?.status === "present"
          ? "RUNTIME_BASELINE_ALIAS_ALREADY_EXISTS"
          : "RUNTIME_BASELINE_ALIAS_LOOKUP_FAILED",
      );
    }
  }

  const forwardDigest = treeDigest(paths.forwardRoot);
  const legacyDigest = treeDigest(paths.legacyRoot);

  ensurePrivateDirectory(paths.forwardHistory, paths.deployRoot);
  ensurePrivateDirectory(paths.legacyHistory, paths.deployRoot);
  ensurePrivateDirectory(paths.stagingRoot, paths.deployRoot);
  fs.mkdirSync(paths.stagingAttempt, { mode: 0o700 });
  fsyncDirectory(paths.stagingRoot);
  let journal = validateJournal({
    schemaVersion: JOURNAL_VERSION,
    kind: JOURNAL_KIND,
    phase: PROMOTION_PHASES.PREPARING,
    baselineAttemptId,
    forwardAttemptId,
    legacyAttemptId: currentLegacy.attemptId,
    currentRuntimeSha: CURRENT_RUNTIME_SHA,
    nextTargetSha: NEXT_FORWARD_TARGET_SHA,
    forwardDigest,
    legacyDigest,
    runningImageIds: { ...runningImageIds },
    aliasIntents: [],
    createdAliases: [],
  });
  atomicWrite(paths.journal, `${JSON.stringify(journal)}\n`);

  try {
    for (const service of REQUIRED_SERVICES) {
      const lookup = aliasResolver(
        expectedNewAlias(service, baselineAttemptId),
      );
      if (lookup?.status !== "absent") {
        fail(
          lookup?.status === "present"
            ? "RUNTIME_BASELINE_ALIAS_ALREADY_EXISTS"
            : "RUNTIME_BASELINE_ALIAS_LOOKUP_FAILED",
        );
      }
    }
    fs.mkdirSync(paths.stagedLegacyRoot, { mode: 0o700 });
    fsyncDirectory(paths.stagingAttempt);
    for (const service of REQUIRED_SERVICES) {
      const alias = expectedNewAlias(service, baselineAttemptId);
      journal = writeJournal(paths.journal, journal, {
        aliasIntents: [...journal.aliasIntents, service],
      });
      aliasCreator(runningImageIds[service], alias);
      const lookup = aliasResolver(alias);
      if (
        lookup?.status !== "present" ||
        lookup.imageId !== runningImageIds[service]
      ) {
        fail("RUNTIME_BASELINE_ALIAS_WRITE_FAILED");
      }
      journal = writeJournal(paths.journal, journal, {
        createdAliases: [...journal.createdAliases, service],
      });
    }

    prepareLegacyState({
      stateDir: paths.stagedLegacyState,
      targetSha: CURRENT_RUNTIME_SHA,
      attemptId: baselineAttemptId,
      imageIds: runningImageIds,
    });
    transitionLegacyState({
      stateDir: paths.stagedLegacyState,
      targetSha: CURRENT_RUNTIME_SHA,
      nextState: LEGACY_STATES.MUTATION_STARTED,
    });
    transitionLegacyState({
      stateDir: paths.stagedLegacyState,
      targetSha: CURRENT_RUNTIME_SHA,
      nextState: LEGACY_STATES.ROLLBACK_REQUIRED,
    });
    transitionLegacyState({
      stateDir: paths.stagedLegacyState,
      targetSha: CURRENT_RUNTIME_SHA,
      nextState: LEGACY_STATES.LEGACY_ROLLED_BACK,
    });
    verifyNewLegacyState(
      paths.stagedLegacyState,
      baselineAttemptId,
      runningImageIds,
      aliasResolver,
    );
    journal = writeJournal(paths.journal, journal, {
      phase: PROMOTION_PHASES.PREPARED,
    });
    await onDurableStep(PROMOTION_PHASES.PREPARED, paths);

    renameAndSync(
      paths.forwardRoot,
      paths.forwardArchive,
      paths.deployRoot,
      paths.forwardHistory,
    );
    journal = writeJournal(paths.journal, journal, {
      phase: PROMOTION_PHASES.FORWARD_ARCHIVED,
    });
    await onDurableStep(PROMOTION_PHASES.FORWARD_ARCHIVED, paths);

    renameAndSync(
      paths.legacyRoot,
      paths.legacyArchive,
      paths.deployRoot,
      paths.legacyHistory,
    );
    journal = writeJournal(paths.journal, journal, {
      phase: PROMOTION_PHASES.LEGACY_ARCHIVED,
    });
    await onDurableStep(PROMOTION_PHASES.LEGACY_ARCHIVED, paths);

    renameAndSync(
      paths.stagedLegacyRoot,
      paths.legacyRoot,
      paths.stagingAttempt,
      paths.deployRoot,
    );
    journal = writeJournal(paths.journal, journal, {
      phase: PROMOTION_PHASES.BASELINE_INSTALLED,
    });
    await onDurableStep(PROMOTION_PHASES.BASELINE_INSTALLED, paths);

    if (
      fs.existsSync(paths.forwardRoot) ||
      treeDigest(paths.forwardArchive) !== forwardDigest ||
      treeDigest(paths.legacyArchive) !== legacyDigest
    ) {
      fail("RUNTIME_BASELINE_CONTENT_CHANGED");
    }
    const archivedForward = readForwardStateForTarget({
      rootDir: paths.forwardArchive,
      attemptId: forwardAttemptId,
      expectedTargetSha: CURRENT_RUNTIME_SHA,
    });
    if (archivedForward.state !== FORWARD_STATES.COMPLETE) {
      fail("RUNTIME_BASELINE_FORWARD_STATE_UNSAFE");
    }
    verifyLegacyAliases(
      readLegacyState({ stateDir: path.join(paths.legacyArchive, "state") }),
      aliasResolver,
    );
    const newLegacy = verifyNewLegacyState(
      paths.legacyState,
      baselineAttemptId,
      runningImageIds,
      aliasResolver,
    );
    journal = writeJournal(paths.journal, journal, {
      phase: PROMOTION_PHASES.COMPLETE,
    });
    await onDurableStep(PROMOTION_PHASES.COMPLETE, paths);
    return {
      forwardAttemptId,
      forwardArchive: paths.forwardArchive,
      legacyArchive: paths.legacyArchive,
      newLegacy,
      journal,
      ...paths,
    };
  } catch (error) {
    if (!recoverOnFailure) throw error;
    const recovered = recoverCurrentRuntimeBaseline({
      gitCommonDir,
      baselineAttemptId,
      mutationLockFd,
      lockVerifier: () => {},
      aliasResolver,
      aliasRemover,
    });
    if (recovered.outcome !== PROMOTION_PHASES.RESTORED) {
      throw new RuntimeBaselinePromotionError(
        "RUNTIME_BASELINE_STATE_UNCERTAIN",
      );
    }
    throw new RuntimeBaselinePromotionError(
      error instanceof RuntimeBaselinePromotionError
        ? "RUNTIME_BASELINE_VERIFICATION_FAILED_RESTORED"
        : "RUNTIME_BASELINE_IO_FAILED_RESTORED",
    );
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
  const command = process.argv[2] || "promote";
  try {
    if (command === "promote") {
      await promoteCurrentRuntimeBaseline({
        gitCommonDir: process.env.GIT_COMMON_DIR,
        baselineAttemptId: process.env.BASELINE_ATTEMPT_ID,
        currentRuntimeSha: process.env.CURRENT_RUNTIME_SHA,
        nextTargetSha: process.env.NEXT_TARGET_SHA,
        runningImageIds: runningImagesFromEnvironment(),
        mutationLockFd: Number(process.env.MUTATION_LOCK_FD),
      });
      process.stdout.write("RUNTIME_BASELINE_PROMOTION_COMPLETE\n");
      return;
    }
    if (command === "recover") {
      const result = recoverCurrentRuntimeBaseline({
        gitCommonDir: process.env.GIT_COMMON_DIR,
        baselineAttemptId: process.env.BASELINE_ATTEMPT_ID,
        mutationLockFd: Number(process.env.MUTATION_LOCK_FD),
      });
      process.stdout.write(`RUNTIME_BASELINE_${result.outcome}\n`);
      return;
    }
    fail();
  } catch (error) {
    const code =
      error instanceof RuntimeBaselinePromotionError
        ? error.code
        : "RUNTIME_BASELINE_IO_UNCERTAIN";
    process.stdout.write(`${code}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
