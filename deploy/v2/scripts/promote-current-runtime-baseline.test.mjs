import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CURRENT_RUNTIME_SHA,
  NEXT_FORWARD_TARGET_SHA,
  RuntimeBaselinePromotionError,
  promoteCurrentRuntimeBaseline,
  recoverCurrentRuntimeBaseline,
} from "./promote-current-runtime-baseline.mjs";
import {
  STATES as LEGACY_STATES,
  prepareState as prepareLegacyState,
  readState as readLegacyState,
  transitionState as transitionLegacyState,
} from "./legacy-bootstrap-state.mjs";
import {
  FORWARD_REPOSITORY,
  FORWARD_STATES,
  prepareForwardState,
  readForwardState,
  readForwardStateForTarget,
  readLegacyBinding,
  transitionForwardState,
} from "./forward-deploy-state.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, "../../..");
const wrapperPath = path.join(here, "promote-current-runtime-baseline.sh");
const promotionHelperPath = path.join(
  here,
  "promote-current-runtime-baseline.mjs",
);
const forwardHelperPath = path.join(here, "forward-deploy-state.mjs");
const legacyHelperPath = path.join(here, "legacy-bootstrap-state.mjs");
const revisionHelperPath = path.join(
  repositoryRoot,
  ".github/workflows/revision-proof.mjs",
);
const preflightHelperPath = path.join(here, "preflight-env.mjs");
const workflowSha = "e972db33404c778cf6ad3afe8f0b56fb31a0712a";
const oldLegacySha = "72b34c2b2a1b959f7ac1db442afcbe9f9a65f07c";
const oldLegacyAttemptId = "11111111111111111111111111111111";
const completedForwardAttemptId = "22222222222222222222222222222222";
const baselineAttemptId = "33333333333333333333333333333333";
const nextForwardAttemptId = "44444444444444444444444444444444";
const oldImages = Object.freeze({
  api: `sha256:${"1".repeat(64)}`,
  web: `sha256:${"2".repeat(64)}`,
  caddy: `sha256:${"3".repeat(64)}`,
});
const currentImages = Object.freeze({
  api: `sha256:${"4".repeat(64)}`,
  web: `sha256:${"5".repeat(64)}`,
  caddy: `sha256:${"6".repeat(64)}`,
});

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout || result.error?.message || "unknown error"}`,
  );
  return result;
}

function sudoChecked(args, options = {}) {
  return runChecked("sudo", ["-n", ...args], options);
}

function installSystemFile(
  source,
  destination,
  mode,
  owner = "deploy",
  group = "deploy",
) {
  sudoChecked([
    "install",
    "-o",
    owner,
    "-g",
    group,
    "-m",
    mode,
    source,
    destination,
  ]);
}

function writeTemporaryFile(root, name, contents) {
  const target = path.join(root, name);
  fs.writeFileSync(target, contents, { mode: 0o600 });
  return target;
}

function asDeploy(args, options = {}) {
  return sudoChecked(["-u", "deploy", ...args], options);
}

function snapshotTree(root) {
  const result = [];
  const visit = (absolute, relative) => {
    const stat = fs.lstatSync(absolute);
    result.push({
      relative,
      type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
      mode: stat.mode & 0o777,
      digest: stat.isFile()
        ? crypto
            .createHash("sha256")
            .update(fs.readFileSync(absolute))
            .digest("hex")
        : null,
    });
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
  return result;
}

function assertNoRuntimeOrDataMutationCommands(dockerCommands) {
  assert.doesNotMatch(
    dockerCommands,
    /(?:^|\n)compose [^\n]*\b(?:build|pull|up|restart|stop|down|run|exec|start|create|kill|rm)\b/im,
  );
  assert.doesNotMatch(
    dockerCommands,
    /(?:^|\n)(?:container )?(?:restart|stop|kill|exec|run|rm)\b/im,
  );
  assert.doesNotMatch(
    dockerCommands,
    /(?:^|\n)(?:psql|pg_restore|pg_dump|prisma|migrat(?:e|ion)?)\b/im,
  );
}

function assertNoDirectDatabaseMutationSource() {
  const executableSource = [
    fs.readFileSync(wrapperPath, "utf8"),
    fs.readFileSync(promotionHelperPath, "utf8"),
  ].join("\n");
  assert.doesNotMatch(
    executableSource,
    /\b(?:psql|pg_restore|pg_dump|prisma|migrat(?:e|ion)?)\b/i,
  );
}

async function createFixture(t, { complete = true } = {}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "oasis-runtime-baseline-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gitCommon = path.join(root, ".git");
  const deployRoot = path.join(gitCommon, "oasis-deploy");
  const legacyRoot = path.join(deployRoot, "legacy-bootstrap-v1");
  const legacyState = path.join(legacyRoot, "state");
  const forwardRoot = path.join(deployRoot, "forward-deployment-v1");
  const mutationLock = path.join(deployRoot, "production-vps-mutation.lock");

  fs.mkdirSync(deployRoot, { recursive: true, mode: 0o700 });
  fs.chmodSync(gitCommon, 0o755);
  fs.chmodSync(deployRoot, 0o700);
  fs.writeFileSync(mutationLock, "", { mode: 0o600 });
  fs.chmodSync(mutationLock, 0o600);

  prepareLegacyState({
    stateDir: legacyState,
    targetSha: oldLegacySha,
    attemptId: oldLegacyAttemptId,
    imageIds: oldImages,
  });
  transitionLegacyState({
    stateDir: legacyState,
    targetSha: oldLegacySha,
    nextState: LEGACY_STATES.MUTATION_STARTED,
  });
  transitionLegacyState({
    stateDir: legacyState,
    targetSha: oldLegacySha,
    nextState: LEGACY_STATES.ROLLBACK_REQUIRED,
  });
  transitionLegacyState({
    stateDir: legacyState,
    targetSha: oldLegacySha,
    nextState: LEGACY_STATES.LEGACY_ROLLED_BACK,
  });
  const legacyBinding = await readLegacyBinding({
    legacyStateDir: legacyState,
    legacyStateHelper: legacyHelperPath,
  });
  await prepareForwardState({
    rootDir: forwardRoot,
    targetSha: NEXT_FORWARD_TARGET_SHA,
    workflowSha,
    originMainSha: workflowSha,
    repository: FORWARD_REPOSITORY,
    attemptId: completedForwardAttemptId,
    legacyStateDir: legacyState,
    legacyStateHelper: legacyHelperPath,
    expectedLegacyDigest: legacyBinding.digest,
    runningImageIds: oldImages,
  });
  transitionForwardState({
    rootDir: forwardRoot,
    attemptId: completedForwardAttemptId,
    nextState: FORWARD_STATES.MUTATION_STARTED,
  });
  if (complete) {
    transitionForwardState({
      rootDir: forwardRoot,
      attemptId: completedForwardAttemptId,
      nextState: FORWARD_STATES.COMPLETE,
    });
  }

  const manifestPath = path.join(
    forwardRoot,
    "attempts",
    completedForwardAttemptId,
    "manifest.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.targetSha = CURRENT_RUNTIME_SHA;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, {
    mode: 0o600,
  });
  fs.chmodSync(manifestPath, 0o600);

  const aliases = new Map(
    Object.entries(oldImages).map(([service, imageId]) => [
      `oasis-legacy-bootstrap-${service}:${oldLegacyAttemptId}`,
      imageId,
    ]),
  );
  const lockFd = fs.openSync(mutationLock, "r+");
  t.after(() => fs.closeSync(lockFd));
  const aliasResolver = (alias) =>
    aliases.has(alias)
      ? { status: "present", imageId: aliases.get(alias) }
      : { status: "absent" };
  const aliasRemover = (alias) => {
    if (!aliases.delete(alias)) throw new Error("alias does not exist");
  };

  const promote = (overrides = {}) =>
    promoteCurrentRuntimeBaseline({
      gitCommonDir: gitCommon,
      baselineAttemptId,
      currentRuntimeSha: CURRENT_RUNTIME_SHA,
      nextTargetSha: NEXT_FORWARD_TARGET_SHA,
      runningImageIds: currentImages,
      mutationLockFd: lockFd,
      lockVerifier: () => {},
      aliasResolver,
      aliasCreator: (imageId, alias) => {
        if (aliases.has(alias)) throw new Error("alias already exists");
        aliases.set(alias, imageId);
      },
      aliasRemover,
      ...overrides,
    });

  return {
    root,
    gitCommon,
    deployRoot,
    legacyRoot,
    legacyState,
    forwardRoot,
    mutationLock,
    lockFd,
    aliases,
    aliasResolver,
    aliasRemover,
    promote,
  };
}

async function createExecutableWrapperFixture(
  t,
  {
    helperVariant = "valid",
    terminatePromotion = false,
    signalWrapper = false,
  } = {},
) {
  const stateFixture = await createFixture(t);
  const suffix = crypto.randomBytes(4).toString("hex");
  const systemRepository = "/opt/oasis-care";
  const systemGitCommon = path.join(systemRepository, ".git");
  const systemDeployRoot = path.join(systemGitCommon, "oasis-deploy");
  const systemForwardRoot = path.join(
    systemDeployRoot,
    "forward-deployment-v1",
  );
  const systemForwardHistory = path.join(
    systemDeployRoot,
    "forward-deployment-history-v1",
  );
  const systemLegacyRoot = path.join(systemDeployRoot, "legacy-bootstrap-v1");
  const helperDir = `/var/tmp/oasis-runtime-baseline.${suffix}`;
  const toolsDir = `/var/tmp/oasis-runtime-baseline-tools.${suffix}`;
  const aliasDir = `/var/tmp/oasis-runtime-baseline-aliases.${suffix}`;
  const marker = "/etc/oasis/production-deploy-target-class";

  if (spawnSync("id", ["-u", "deploy"], { stdio: "ignore" }).status !== 0) {
    sudoChecked([
      "useradd",
      "--system",
      "--create-home",
      "--shell",
      "/bin/bash",
      "deploy",
    ]);
  }

  sudoChecked(["rm", "-rf", systemRepository, helperDir, toolsDir, aliasDir]);
  sudoChecked(["rm", "-f", marker]);
  t.after(() => {
    sudoChecked(["rm", "-rf", systemRepository, helperDir, toolsDir, aliasDir]);
    sudoChecked(["rm", "-f", marker]);
  });

  sudoChecked([
    "install",
    "-d",
    "-o",
    "root",
    "-g",
    "root",
    "-m",
    "0755",
    "/etc/oasis",
  ]);
  const productionMarker = writeTemporaryFile(
    stateFixture.root,
    "production-marker",
    "production\n",
  );
  installSystemFile(productionMarker, marker, "0644", "root", "root");

  sudoChecked([
    "install",
    "-d",
    "-o",
    "deploy",
    "-g",
    "deploy",
    "-m",
    "0755",
    systemRepository,
  ]);
  asDeploy(["git", "-C", systemRepository, "init", "-q"]);
  asDeploy(["git", "-C", systemRepository, "config", "user.name", "Oasis CI"]);
  asDeploy([
    "git",
    "-C",
    systemRepository,
    "config",
    "user.email",
    "ci@oasis.invalid",
  ]);
  for (const directory of [
    path.join(systemRepository, "deploy/v2/scripts"),
    path.join(systemRepository, ".github/workflows"),
  ]) {
    sudoChecked([
      "install",
      "-d",
      "-o",
      "deploy",
      "-g",
      "deploy",
      "-m",
      "0755",
      directory,
    ]);
  }
  const reviewedFiles = [
    [
      wrapperPath,
      path.join(
        systemRepository,
        "deploy/v2/scripts/promote-current-runtime-baseline.sh",
      ),
      "0755",
    ],
    [
      promotionHelperPath,
      path.join(
        systemRepository,
        "deploy/v2/scripts/promote-current-runtime-baseline.mjs",
      ),
      "0644",
    ],
    [
      forwardHelperPath,
      path.join(systemRepository, "deploy/v2/scripts/forward-deploy-state.mjs"),
      "0644",
    ],
    [
      legacyHelperPath,
      path.join(
        systemRepository,
        "deploy/v2/scripts/legacy-bootstrap-state.mjs",
      ),
      "0644",
    ],
    [
      revisionHelperPath,
      path.join(systemRepository, ".github/workflows/revision-proof.mjs"),
      "0644",
    ],
    [
      preflightHelperPath,
      path.join(systemRepository, "deploy/v2/scripts/preflight-env.mjs"),
      "0644",
    ],
  ];
  for (const [source, destination, mode] of reviewedFiles) {
    installSystemFile(source, destination, mode);
  }
  asDeploy([
    "git",
    "-C",
    systemRepository,
    "add",
    "--",
    ...reviewedFiles.map(([, destination]) =>
      path.relative(systemRepository, destination),
    ),
  ]);
  asDeploy([
    "git",
    "-C",
    systemRepository,
    "commit",
    "-q",
    "-m",
    "reviewed runtime-baseline fixture",
  ]);
  const rotationToolSha = asDeploy([
    "git",
    "-C",
    systemRepository,
    "rev-parse",
    "HEAD",
  ]).stdout.trim();
  asDeploy([
    "git",
    "-C",
    systemRepository,
    "remote",
    "add",
    "origin",
    "https://github.com/welathfindrr13/oasis-care-international.git",
  ]);

  sudoChecked(["cp", "-a", stateFixture.deployRoot, systemGitCommon]);
  sudoChecked(["chown", "-R", "deploy:deploy", systemDeployRoot]);

  for (const directory of [helperDir, toolsDir, aliasDir]) {
    sudoChecked([
      "install",
      "-d",
      "-o",
      "deploy",
      "-g",
      "deploy",
      "-m",
      "0700",
      directory,
    ]);
  }
  const stagedFiles = [
    [
      wrapperPath,
      path.join(helperDir, "promote-current-runtime-baseline.sh"),
      "0700",
    ],
    [
      promotionHelperPath,
      path.join(helperDir, "promote-current-runtime-baseline.mjs"),
      "0600",
    ],
    [
      forwardHelperPath,
      path.join(helperDir, "forward-deploy-state.mjs"),
      "0600",
    ],
    [
      legacyHelperPath,
      path.join(helperDir, "legacy-bootstrap-state.mjs"),
      "0600",
    ],
    [revisionHelperPath, path.join(helperDir, "revision-proof.mjs"), "0600"],
    [preflightHelperPath, path.join(helperDir, "preflight-env.mjs"), "0600"],
  ];
  for (const [source, destination, mode] of stagedFiles) {
    installSystemFile(source, destination, mode);
  }
  if (helperVariant === "stale") {
    const staleWrapper = writeTemporaryFile(
      stateFixture.root,
      "stale-runtime-baseline-wrapper.sh",
      `${fs.readFileSync(wrapperPath, "utf8")}\n# stale fixture revision\n`,
    );
    installSystemFile(
      staleWrapper,
      path.join(helperDir, "promote-current-runtime-baseline.sh"),
      "0700",
    );
  } else if (helperVariant === "mixed") {
    installSystemFile(
      legacyHelperPath,
      path.join(helperDir, "forward-deploy-state.mjs"),
      "0600",
    );
  }

  const dockerLog = path.join(toolsDir, "docker-commands");
  const wrapperPidFile = path.join(toolsDir, "wrapper.pid");
  const emptyLog = writeTemporaryFile(stateFixture.root, "docker-commands", "");
  installSystemFile(emptyLog, dockerLog, "0600");
  const signalLauncher = writeTemporaryFile(
    stateFixture.root,
    "signal-launcher",
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "%s\\n" "$$" > "$TEST_WRAPPER_PID_FILE"',
      'exec bash "$TEST_WRAPPER_PATH"',
      "",
    ].join("\n"),
  );
  installSystemFile(
    signalLauncher,
    path.join(toolsDir, "signal-launcher"),
    "0700",
  );
  const fakeGit = writeTemporaryFile(
    stateFixture.root,
    "git",
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'if [ "${1:-}" = ls-remote ]; then',
      '  printf "%s\\trefs/heads/main\\n" "$TEST_ROTATION_SHA"',
      "  exit 0",
      "fi",
      'if [ "${1:-}" = rev-parse ] && [ "${2:-}" = HEAD ]; then',
      '  printf "%s\\n" "$TEST_CURRENT_SHA"',
      "  exit 0",
      "fi",
      'if [ "${1:-}" = merge-base ] && [ "${2:-}" = --is-ancestor ] && [ "${3:-}" = "$TEST_NEXT_SHA" ] && [ "${4:-}" = "$TEST_ROTATION_SHA" ]; then',
      "  exit 0",
      "fi",
      'exec "$REAL_GIT" "$@"',
      "",
    ].join("\n"),
  );
  const fakeNode = writeTemporaryFile(
    stateFixture.root,
    "node",
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'helper="$(basename "${1:-}")"',
      'if [ "$helper" = preflight-env.mjs ] || [ "$helper" = revision-proof.mjs ]; then',
      "  exit 0",
      "fi",
      'if [ "$helper" = promote-current-runtime-baseline.mjs ] && [ "${2:-promote}" = promote ] && [ "${TEST_TERMINATE_PROMOTION:-0}" = 1 ]; then',
      '  "$REAL_NODE" "$@" &',
      "  child=$!",
      "  for _ in $(seq 1 200); do",
      '    if [ -e "$TEST_ALIAS_DIR/oasis-legacy-bootstrap-api:$BASELINE_ATTEMPT_ID" ]; then',
      '      kill -KILL "$child" 2>/dev/null || true',
      '      wait "$child" 2>/dev/null || true',
      "      exit 143",
      "    fi",
      "    sleep 0.01",
      "  done",
      '  kill -KILL "$child" 2>/dev/null || true',
      '  wait "$child" 2>/dev/null || true',
      "  exit 143",
      "fi",
      'exec "$REAL_NODE" "$@"',
      "",
    ].join("\n"),
  );
  const fakeDocker = writeTemporaryFile(
    stateFixture.root,
    "docker",
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "%s\\n" "$*" >> "$TEST_DOCKER_LOG"',
      'if [ "${1:-}" = compose ]; then',
      '  service="${@: -1}"',
      '  case "$service" in',
      `    api) printf '%s\\n' '${"a".repeat(64)}' ;;`,
      `    web) printf '%s\\n' '${"b".repeat(64)}' ;;`,
      `    caddy) printf '%s\\n' '${"c".repeat(64)}' ;;`,
      `    postgres) printf '%s\\n' '${"d".repeat(64)}' ;;`,
      "    *) exit 1 ;;",
      "  esac",
      "  exit 0",
      "fi",
      'if [ "${1:-}" = inspect ]; then',
      '  format="${3:-}"',
      '  container="${4:-}"',
      '  if [[ "$format" == *".Image"* ]]; then',
      '    case "$container" in',
      `      ${"a".repeat(64)}) printf '%s\\n' '${currentImages.api}' ;;`,
      `      ${"b".repeat(64)}) printf '%s\\n' '${currentImages.web}' ;;`,
      `      ${"c".repeat(64)}) printf '%s\\n' '${currentImages.caddy}' ;;`,
      "      *) exit 1 ;;",
      "    esac",
      "  else",
      '    printf "healthy\\n"',
      "  fi",
      "  exit 0",
      "fi",
      'if [ "${1:-}" = image ] && [ "${2:-}" = inspect ]; then',
      '  alias="${5:-}"',
      '  case "$alias" in',
      `    oasis-legacy-bootstrap-api:${oldLegacyAttemptId}) printf '%s\\n' '${oldImages.api}'; exit 0 ;;`,
      `    oasis-legacy-bootstrap-web:${oldLegacyAttemptId}) printf '%s\\n' '${oldImages.web}'; exit 0 ;;`,
      `    oasis-legacy-bootstrap-caddy:${oldLegacyAttemptId}) printf '%s\\n' '${oldImages.caddy}'; exit 0 ;;`,
      "  esac",
      '  if [ -f "$TEST_ALIAS_DIR/$alias" ]; then',
      '    cat "$TEST_ALIAS_DIR/$alias"',
      "    exit 0",
      "  fi",
      '  printf "Error response from daemon: No such image: %s\\n" "$alias" >&2',
      "  exit 1",
      "fi",
      'if [ "${1:-}" = image ] && [ "${2:-}" = tag ]; then',
      '  image_id="${3:-}"',
      '  alias="${4:-}"',
      '  printf "%s\\n" "$image_id" > "$TEST_ALIAS_DIR/$alias"',
      '  if [ "${TEST_DELAY_PROMOTION:-0}" = 1 ] && [[ "$alias" == oasis-legacy-bootstrap-api:* ]]; then sleep 3; fi',
      "  exit 0",
      "fi",
      'if [ "${1:-}" = image ] && [ "${2:-}" = rm ]; then',
      '  alias="${3:-}"',
      '  rm -f -- "$TEST_ALIAS_DIR/$alias"',
      "  exit 0",
      "fi",
      "exit 1",
      "",
    ].join("\n"),
  );
  const fakeDatabaseTool = writeTemporaryFile(
    stateFixture.root,
    "database-tool",
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "%s %s\\n" "$(basename "$0")" "$*" >> "$TEST_DOCKER_LOG"',
      "exit 97",
      "",
    ].join("\n"),
  );
  for (const [source, name] of [
    [fakeGit, "git"],
    [fakeNode, "node"],
    [fakeDocker, "docker"],
    [fakeDatabaseTool, "psql"],
    [fakeDatabaseTool, "pg_restore"],
    [fakeDatabaseTool, "pg_dump"],
    [fakeDatabaseTool, "prisma"],
    [fakeDatabaseTool, "pnpm"],
    [fakeDatabaseTool, "npx"],
  ]) {
    installSystemFile(source, path.join(toolsDir, name), "0700");
  }

  const realGit =
    spawnSync("command", ["-v", "git"], {
      shell: true,
      encoding: "utf8",
    }).stdout.trim() || "/usr/bin/git";
  const wrapperArgs = [
    "-n",
    "-u",
    "deploy",
    "env",
    `PATH=${toolsDir}:/usr/bin:/bin`,
    "HOME=/home/deploy",
    `REAL_GIT=${realGit}`,
    `REAL_NODE=${process.execPath}`,
    `ROTATION_TOOL_SHA=${rotationToolSha}`,
    `TEST_ROTATION_SHA=${rotationToolSha}`,
    `TEST_CURRENT_SHA=${CURRENT_RUNTIME_SHA}`,
    `TEST_NEXT_SHA=${NEXT_FORWARD_TARGET_SHA}`,
    `BASELINE_ATTEMPT_ID=${baselineAttemptId}`,
    `TEST_ALIAS_DIR=${aliasDir}`,
    `TEST_DOCKER_LOG=${dockerLog}`,
    `TEST_TERMINATE_PROMOTION=${terminatePromotion ? "1" : "0"}`,
    `TEST_DELAY_PROMOTION=${signalWrapper ? "1" : "0"}`,
    "bash",
    path.join(helperDir, "promote-current-runtime-baseline.sh"),
  ];
  const runWrapper = () =>
    spawnSync("sudo", wrapperArgs, {
      encoding: "utf8",
      timeout: 30_000,
    });

  const existsAsDeploy = (target) =>
    spawnSync("sudo", ["-n", "-u", "deploy", "test", "-e", target], {
      stdio: "ignore",
    }).status === 0;
  const readAsDeploy = (target) => asDeploy(["cat", target]).stdout;
  const readLegacyManifestAsDeploy = () =>
    JSON.parse(
      readAsDeploy(path.join(systemLegacyRoot, "state", "manifest.json")),
    );
  const waitForRestoredState = async () => {
    const journal = path.join(
      systemDeployRoot,
      "runtime-baseline-promotion-v1",
      baselineAttemptId,
      "journal.json",
    );
    for (let attempt = 0; attempt < 500; attempt += 1) {
      if (
        existsAsDeploy(systemForwardRoot) &&
        existsAsDeploy(systemLegacyRoot) &&
        existsAsDeploy(journal)
      ) {
        try {
          if (JSON.parse(readAsDeploy(journal)).phase === "RESTORED") {
            return true;
          }
        } catch {
          // Recovery writes the journal atomically; retry until it is readable.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  };
  const signalRunningWrapper = async () => {
    const signalWrapperArgs = [
      ...wrapperArgs.slice(0, -2),
      `TEST_WRAPPER_PID_FILE=${wrapperPidFile}`,
      `TEST_WRAPPER_PATH=${path.join(helperDir, "promote-current-runtime-baseline.sh")}`,
      "setsid",
      "bash",
      path.join(toolsDir, "signal-launcher"),
    ];
    const child = spawn("sudo", signalWrapperArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const completion = new Promise((resolve) => {
      child.on("close", (status, signal) => {
        resolve({ status, signal, stdout, stderr });
      });
    });

    const alias = path.join(
      aliasDir,
      `oasis-legacy-bootstrap-api:${baselineAttemptId}`,
    );
    let promotionReached = false;
    for (let attempt = 0; attempt < 300; attempt += 1) {
      if (existsAsDeploy(alias) && existsAsDeploy(wrapperPidFile)) {
        promotionReached = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!promotionReached) {
      child.kill("SIGKILL");
      throw new Error("wrapper did not reach the mutation phase");
    }

    const wrapperPid = readAsDeploy(wrapperPidFile).trim();
    assert.match(wrapperPid, /^[1-9][0-9]*$/);
    sudoChecked(["kill", "-TERM", "--", `-${wrapperPid}`]);
    return completion;
  };

  return {
    aliasDir,
    dockerLog,
    helperDir,
    rotationToolSha,
    systemDeployRoot,
    systemForwardRoot,
    systemForwardHistory,
    systemLegacyRoot,
    runWrapper,
    signalRunningWrapper,
    waitForRestoredState,
    existsAsDeploy,
    readAsDeploy,
    readLegacyManifestAsDeploy,
  };
}

test("rotates an authenticated COMPLETE forward state and promotes the current runtime as the next rollback baseline", async (t) => {
  const fixture = await createFixture(t);
  const forwardBefore = snapshotTree(fixture.forwardRoot);
  const legacyBefore = snapshotTree(fixture.legacyRoot);

  const result = await fixture.promote();

  assert.equal(fs.existsSync(fixture.forwardRoot), false);
  assert.deepEqual(snapshotTree(result.forwardArchive), forwardBefore);
  assert.deepEqual(snapshotTree(result.legacyArchive), legacyBefore);
  assert.equal(
    readForwardStateForTarget({
      rootDir: result.forwardArchive,
      attemptId: completedForwardAttemptId,
      expectedTargetSha: CURRENT_RUNTIME_SHA,
    }).state,
    FORWARD_STATES.COMPLETE,
  );
  const promoted = readLegacyState({ stateDir: fixture.legacyState });
  assert.equal(promoted.status, LEGACY_STATES.LEGACY_ROLLED_BACK);
  assert.equal(promoted.targetSha, CURRENT_RUNTIME_SHA);
  assert.equal(promoted.attemptId, baselineAttemptId);
  for (const [service, imageId] of Object.entries(currentImages)) {
    assert.equal(promoted.images[service].id, imageId);
    assert.equal(fixture.aliases.get(promoted.images[service].alias), imageId);
  }

  const newBinding = await readLegacyBinding({
    legacyStateDir: fixture.legacyState,
    legacyStateHelper: legacyHelperPath,
  });
  await prepareForwardState({
    rootDir: fixture.forwardRoot,
    targetSha: NEXT_FORWARD_TARGET_SHA,
    workflowSha,
    originMainSha: workflowSha,
    repository: FORWARD_REPOSITORY,
    attemptId: nextForwardAttemptId,
    legacyStateDir: fixture.legacyState,
    legacyStateHelper: legacyHelperPath,
    expectedLegacyDigest: newBinding.digest,
    runningImageIds: currentImages,
  });
  assert.equal(
    readForwardState({
      rootDir: fixture.forwardRoot,
      attemptId: nextForwardAttemptId,
    }).state,
    FORWARD_STATES.PREPARED,
  );
  assert.deepEqual(snapshotTree(result.forwardArchive), forwardBefore);
  assert.deepEqual(snapshotTree(result.legacyArchive), legacyBefore);
});

test("preserves pre-existing failed-attempt history while adding the completed attempt archive", async (t) => {
  const fixture = await createFixture(t);
  const priorHistory = path.join(
    fixture.deployRoot,
    "forward-deployment-history-v1",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  fs.mkdirSync(priorHistory, { recursive: true, mode: 0o700 });
  fs.chmodSync(path.dirname(priorHistory), 0o700);
  fs.chmodSync(priorHistory, 0o700);
  fs.writeFileSync(
    path.join(priorHistory, "preserved-evidence"),
    "RECOVERABLE_FAILURE\n",
    {
      mode: 0o600,
    },
  );
  const before = snapshotTree(priorHistory);

  const result = await fixture.promote();

  assert.deepEqual(snapshotTree(priorHistory), before);
  assert.equal(path.basename(result.forwardArchive), completedForwardAttemptId);
  assert.equal(fs.existsSync(result.forwardArchive), true);
});

test("rejects non-COMPLETE forward state before moving either canonical state tree", async (t) => {
  const fixture = await createFixture(t, { complete: false });
  const forwardBefore = snapshotTree(fixture.forwardRoot);
  const legacyBefore = snapshotTree(fixture.legacyRoot);

  await assert.rejects(fixture.promote(), (error) => {
    assert.equal(error.code, "RUNTIME_BASELINE_FORWARD_STATE_UNSAFE");
    return true;
  });
  assert.deepEqual(snapshotTree(fixture.forwardRoot), forwardBefore);
  assert.deepEqual(snapshotTree(fixture.legacyRoot), legacyBefore);
});

test("rejects an existing or retagged new rollback alias before rotating canonical state", async (t) => {
  const fixture = await createFixture(t);
  const forwardBefore = snapshotTree(fixture.forwardRoot);
  const legacyBefore = snapshotTree(fixture.legacyRoot);
  fixture.aliases.set(
    `oasis-legacy-bootstrap-api:${baselineAttemptId}`,
    `sha256:${"9".repeat(64)}`,
  );

  await assert.rejects(fixture.promote(), (error) => {
    assert.equal(error.code, "RUNTIME_BASELINE_ALIAS_ALREADY_EXISTS");
    return true;
  });
  assert.deepEqual(snapshotTree(fixture.forwardRoot), forwardBefore);
  assert.deepEqual(snapshotTree(fixture.legacyRoot), legacyBefore);
});

test("a post-swap verification failure restores both canonical state trees and preserves the staged promotion evidence", async (t) => {
  const fixture = await createFixture(t);
  const forwardBefore = snapshotTree(fixture.forwardRoot);
  const legacyBefore = snapshotTree(fixture.legacyRoot);

  await assert.rejects(
    fixture.promote({
      onDurableStep: (phase) => {
        if (phase === "BASELINE_INSTALLED") {
          throw new RuntimeBaselinePromotionError(
            "SYNTHETIC_POST_SWAP_FAILURE",
          );
        }
      },
    }),
    (error) => {
      assert.equal(error.code, "RUNTIME_BASELINE_VERIFICATION_FAILED_RESTORED");
      return true;
    },
  );
  assert.deepEqual(snapshotTree(fixture.forwardRoot), forwardBefore);
  assert.deepEqual(snapshotTree(fixture.legacyRoot), legacyBefore);
  assert.equal(
    fs.existsSync(
      path.join(
        fixture.deployRoot,
        "runtime-baseline-promotion-v1",
        baselineAttemptId,
        "legacy-bootstrap-v1",
        "state",
      ),
    ),
    true,
  );
});

test("operational alias lookup failure is not treated as authoritative absence", async (t) => {
  const fixture = await createFixture(t);
  const forwardBefore = snapshotTree(fixture.forwardRoot);
  const legacyBefore = snapshotTree(fixture.legacyRoot);

  await assert.rejects(
    fixture.promote({
      aliasResolver: (alias) => {
        if (alias.includes(baselineAttemptId)) {
          throw new RuntimeBaselinePromotionError(
            "RUNTIME_BASELINE_ALIAS_LOOKUP_FAILED",
          );
        }
        return fixture.aliasResolver(alias);
      },
    }),
    (error) => error.code === "RUNTIME_BASELINE_ALIAS_LOOKUP_FAILED",
  );
  assert.deepEqual(snapshotTree(fixture.forwardRoot), forwardBefore);
  assert.deepEqual(snapshotTree(fixture.legacyRoot), legacyBefore);
  assert.equal(
    fixture.aliases.has(`oasis-legacy-bootstrap-api:${baselineAttemptId}`),
    false,
  );
});

test("failure while creating a later alias removes every alias created by the interrupted attempt", async (t) => {
  const fixture = await createFixture(t);
  let writes = 0;

  await assert.rejects(
    fixture.promote({
      aliasCreator: (imageId, alias) => {
        writes += 1;
        if (writes === 2) {
          throw new RuntimeBaselinePromotionError(
            "RUNTIME_BASELINE_ALIAS_WRITE_FAILED",
          );
        }
        fixture.aliases.set(alias, imageId);
      },
    }),
    (error) => error.code === "RUNTIME_BASELINE_VERIFICATION_FAILED_RESTORED",
  );
  for (const service of ["api", "web", "caddy"]) {
    assert.equal(
      fixture.aliases.has(
        `oasis-legacy-bootstrap-${service}:${baselineAttemptId}`,
      ),
      false,
    );
  }
  assert.equal(fs.existsSync(fixture.forwardRoot), true);
  assert.equal(fs.existsSync(fixture.legacyRoot), true);
});

for (const interruptedPhase of [
  "FORWARD_ARCHIVED",
  "LEGACY_ARCHIVED",
  "BASELINE_INSTALLED",
]) {
  test(`durable recovery restores canonical state after process loss at ${interruptedPhase}`, async (t) => {
    const fixture = await createFixture(t);
    const forwardBefore = snapshotTree(fixture.forwardRoot);
    const legacyBefore = snapshotTree(fixture.legacyRoot);

    await assert.rejects(
      fixture.promote({
        recoverOnFailure: false,
        onDurableStep: (phase) => {
          if (phase === interruptedPhase) {
            throw new Error("simulated process loss");
          }
        },
      }),
      /simulated process loss/,
    );

    const recovered = recoverCurrentRuntimeBaseline({
      gitCommonDir: fixture.gitCommon,
      baselineAttemptId,
      mutationLockFd: fixture.lockFd,
      lockVerifier: () => {},
      aliasResolver: fixture.aliasResolver,
      aliasRemover: fixture.aliasRemover,
    });
    assert.equal(recovered.outcome, "RESTORED");
    assert.deepEqual(snapshotTree(fixture.forwardRoot), forwardBefore);
    assert.deepEqual(snapshotTree(fixture.legacyRoot), legacyBefore);
  });
}

test("recovery adjudicates a rename that completed before its phase journal update", async (t) => {
  const fixture = await createFixture(t);
  const forwardBefore = snapshotTree(fixture.forwardRoot);
  const legacyBefore = snapshotTree(fixture.legacyRoot);
  await assert.rejects(
    fixture.promote({
      recoverOnFailure: false,
      onDurableStep: (phase) => {
        if (phase === "PREPARED") throw new Error("stop before rename");
      },
    }),
    /stop before rename/,
  );
  const forwardArchive = path.join(
    fixture.deployRoot,
    "forward-deployment-history-v1",
    completedForwardAttemptId,
  );
  fs.renameSync(fixture.forwardRoot, forwardArchive);

  const recovered = recoverCurrentRuntimeBaseline({
    gitCommonDir: fixture.gitCommon,
    baselineAttemptId,
    mutationLockFd: fixture.lockFd,
    lockVerifier: () => {},
    aliasResolver: fixture.aliasResolver,
    aliasRemover: fixture.aliasRemover,
  });
  assert.equal(recovered.outcome, "RESTORED");
  assert.deepEqual(snapshotTree(fixture.forwardRoot), forwardBefore);
  assert.deepEqual(snapshotTree(fixture.legacyRoot), legacyBefore);
});

test("fails closed before mutation when the exact next target, current revision, or mutation lock proof differs", async (t) => {
  const fixture = await createFixture(t);
  await assert.rejects(
    fixture.promote({ nextTargetSha: oldLegacySha }),
    (error) => error.code === "RUNTIME_BASELINE_PROMOTION_INVALID",
  );
  await assert.rejects(
    fixture.promote({ currentRuntimeSha: oldLegacySha }),
    (error) => error.code === "RUNTIME_BASELINE_PROMOTION_INVALID",
  );
  await assert.rejects(
    fixture.promote({
      lockVerifier: () => {
        throw new RuntimeBaselinePromotionError(
          "RUNTIME_BASELINE_LOCK_REQUIRED",
        );
      },
    }),
    (error) => error.code === "RUNTIME_BASELINE_LOCK_REQUIRED",
  );
  assert.equal(fs.existsSync(fixture.forwardRoot), true);
  assert.equal(fs.existsSync(fixture.legacyRoot), true);
});

test("the executable production wrapper authenticates its full boundary and recovers a terminated promotion", async (t) => {
  if (process.platform !== "linux" || process.env.CI !== "true") {
    t.skip(
      "the root-owned production path fixture runs only on disposable GitHub Linux CI",
    );
    return;
  }

  assertNoDirectDatabaseMutationSource();

  for (const helperVariant of ["stale", "mixed"]) {
    await t.test(
      `${helperVariant} helper fails before mutation`,
      async (subtest) => {
        const fixture = await createExecutableWrapperFixture(subtest, {
          helperVariant,
        });
        const result = fixture.runWrapper();
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stdout, /RUNTIME_BASELINE_HELPER_UNSAFE\n$/);
        assert.equal(fixture.existsAsDeploy(fixture.systemForwardRoot), true);
        assert.equal(fixture.existsAsDeploy(fixture.systemLegacyRoot), true);
        assert.equal(
          fixture.existsAsDeploy(
            path.join(fixture.systemForwardHistory, completedForwardAttemptId),
          ),
          false,
        );
        assert.equal(fixture.readAsDeploy(fixture.dockerLog), "");
      },
    );
  }

  await t.test(
    "authentic helper bundle completes with inherited fd 9 and production gates",
    async (subtest) => {
      const fixture = await createExecutableWrapperFixture(subtest);
      const result = fixture.runWrapper();
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /RUNTIME_BASELINE_MUTATION_LOCK_ACQUIRED\n/);
      assert.match(result.stdout, /RUNTIME_BASELINE_LOCKED_PREFLIGHT_VALID\n/);
      assert.match(result.stdout, /RUNTIME_BASELINE_PROMOTION_COMPLETE\n/);
      assert.match(result.stdout, /RUNTIME_BASELINE_WRAPPER_COMPLETE\n$/);
      assert.equal(fixture.existsAsDeploy(fixture.systemForwardRoot), false);
      assert.equal(
        fixture.existsAsDeploy(
          path.join(fixture.systemForwardHistory, completedForwardAttemptId),
        ),
        true,
      );
      const promoted = fixture.readLegacyManifestAsDeploy();
      assert.equal(promoted.status, LEGACY_STATES.LEGACY_ROLLED_BACK);
      assert.equal(promoted.targetSha, CURRENT_RUNTIME_SHA);
      assert.equal(promoted.attemptId, baselineAttemptId);
      const dockerCommands = fixture.readAsDeploy(fixture.dockerLog);
      assert.match(dockerCommands, /compose .* ps -q api/);
      assert.match(dockerCommands, /image tag/);
      assertNoRuntimeOrDataMutationCommands(dockerCommands);
    },
  );

  await t.test(
    "terminated promotion invokes durable recovery before the wrapper exits",
    async (subtest) => {
      const fixture = await createExecutableWrapperFixture(subtest, {
        terminatePromotion: true,
      });
      const result = fixture.runWrapper();
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stdout, /RUNTIME_BASELINE_WRAPPER_COMPLETE/);
      assert.equal(fixture.existsAsDeploy(fixture.systemForwardRoot), true);
      assert.equal(fixture.existsAsDeploy(fixture.systemLegacyRoot), true);
      assert.equal(
        fixture.existsAsDeploy(
          path.join(fixture.systemForwardHistory, completedForwardAttemptId),
        ),
        false,
      );
      const restoredLegacy = fixture.readLegacyManifestAsDeploy();
      assert.equal(restoredLegacy.targetSha, oldLegacySha);
      assert.equal(restoredLegacy.attemptId, oldLegacyAttemptId);
      const journal = JSON.parse(
        fixture.readAsDeploy(
          path.join(
            fixture.systemDeployRoot,
            "runtime-baseline-promotion-v1",
            baselineAttemptId,
            "journal.json",
          ),
        ),
      );
      assert.equal(journal.phase, "RESTORED");
      for (const service of ["api", "web", "caddy"]) {
        assert.equal(
          fixture.existsAsDeploy(
            path.join(
              fixture.aliasDir,
              `oasis-legacy-bootstrap-${service}:${baselineAttemptId}`,
            ),
          ),
          false,
        );
      }
      const dockerCommands = fixture.readAsDeploy(fixture.dockerLog);
      assert.match(dockerCommands, /image rm/);
      assertNoRuntimeOrDataMutationCommands(dockerCommands);
    },
  );

  await t.test(
    "TERM delivered to the running wrapper restores state and cannot report success",
    async (subtest) => {
      const fixture = await createExecutableWrapperFixture(subtest, {
        signalWrapper: true,
      });
      const result = await fixture.signalRunningWrapper();
      assert.ok(
        result.status !== 0 || result.signal !== null,
        `wrapper reported success after TERM\n${result.stderr}`,
      );
      assert.doesNotMatch(result.stdout, /RUNTIME_BASELINE_WRAPPER_COMPLETE/);
      assert.equal(await fixture.waitForRestoredState(), true);
      assert.equal(fixture.existsAsDeploy(fixture.systemForwardRoot), true);
      assert.equal(fixture.existsAsDeploy(fixture.systemLegacyRoot), true);
      assert.equal(
        fixture.existsAsDeploy(
          path.join(fixture.systemForwardHistory, completedForwardAttemptId),
        ),
        false,
      );
      const restoredLegacy = fixture.readLegacyManifestAsDeploy();
      assert.equal(restoredLegacy.targetSha, oldLegacySha);
      assert.equal(restoredLegacy.attemptId, oldLegacyAttemptId);
      const journal = JSON.parse(
        fixture.readAsDeploy(
          path.join(
            fixture.systemDeployRoot,
            "runtime-baseline-promotion-v1",
            baselineAttemptId,
            "journal.json",
          ),
        ),
      );
      assert.equal(journal.phase, "RESTORED");
      const dockerCommands = fixture.readAsDeploy(fixture.dockerLog);
      assert.match(dockerCommands, /image rm/);
      assertNoRuntimeOrDataMutationCommands(dockerCommands);
    },
  );
});
