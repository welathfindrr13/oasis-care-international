import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isCanonicalSha } from "../../../.github/workflows/revision-proof.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SIGNAL_SCRIPT = path.join(SCRIPT_DIRECTORY, "production-signals.mjs");
const DEFAULT_HEARTBEAT_FILE =
  "/var/lib/oasis-production-signals/heartbeat.json";
const DEFAULT_MAX_AGE_SECONDS = 435;
const CHILD_TIMEOUT_MS = 130_000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const HEARTBEAT_VERSION = 1;
const SUCCESS_MARKERS = [
  "PRODUCTION_SIGNAL_PUBLIC_UPTIME_OK",
  "PRODUCTION_SIGNAL_REVISION_OK",
  "PRODUCTION_SIGNAL_SERVICE_HEALTH_OK",
  "PRODUCTION_SIGNAL_DISK_OK",
  "PRODUCTION_SIGNAL_BACKUP_OK",
  "PRODUCTION_SIGNAL_CRITICAL_ERRORS_OK",
  "PRODUCTION_SIGNAL_AUTH_ABUSE_OK",
  "PRODUCTION_SIGNALS_OK",
];
const FAILURE_MARKERS = new Set([
  "PRODUCTION_SIGNAL_CONFIGURATION_FAILED",
  "PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED",
  "PRODUCTION_SIGNAL_REVISION_FAILED",
  "PRODUCTION_SIGNAL_SERVICE_HEALTH_FAILED",
  "PRODUCTION_SIGNAL_DISK_FAILED",
  "PRODUCTION_SIGNAL_BACKUP_FAILED",
  "PRODUCTION_SIGNAL_CRITICAL_ERRORS_FAILED",
  "PRODUCTION_SIGNAL_AUTH_ABUSE_FAILED",
  "PRODUCTION_SIGNAL_TIMEOUT_FAILED",
  "PRODUCTION_SIGNAL_INTERNAL_FAILED",
]);
const RUNNER_MARKERS = {
  ok: "PRODUCTION_SIGNAL_HEARTBEAT_WRITTEN",
  failed: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED",
  current: "PRODUCTION_SIGNAL_HEARTBEAT_OK",
};

function fail() {
  throw new Error(RUNNER_MARKERS.failed);
}

function parseBoundedInteger(value, defaultValue, minimum, maximum) {
  if (value === undefined || value === "") return defaultValue;
  if (!/^\d+$/.test(value)) fail();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail();
  }
  return parsed;
}

function assertPrivateDirectory(directory) {
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch {
    fail();
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    fail();
  }
}

function assertPrivateRegularFile(filePath) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    fail();
  }
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    fail();
  }
  return stat;
}

function atomicWriteHeartbeat(filePath, heartbeat) {
  if (!path.isAbsolute(filePath)) fail();
  const directory = path.dirname(filePath);
  assertPrivateDirectory(directory);
  try {
    const existing = fs.lstatSync(filePath);
    if (!existing.isFile() || existing.isSymbolicLink()) fail();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const temporaryPath = path.join(
    directory,
    "." + path.basename(filePath) + "." + process.pid + "." +
      Date.now().toString(36),
  );
  let descriptor;
  try {
    descriptor = fs.openSync(
      temporaryPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY,
      0o600,
    );
    fs.writeFileSync(descriptor, JSON.stringify(heartbeat) + "\n", "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
    const directoryDescriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  } catch {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {}
    }
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    fail();
  }
}

function lines(value) {
  if (typeof value !== "string" || Buffer.byteLength(value) > MAX_OUTPUT_BYTES) {
    return [];
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function classifyResult(result) {
  const stdoutLines = lines(result.stdout);
  const stderrLines = lines(result.stderr);
  const outputLines = [...stdoutLines, ...stderrLines];
  const failureMarker = outputLines.find((line) => FAILURE_MARKERS.has(line));
  if (failureMarker) {
    return { status: "failed", marker: failureMarker };
  }
  if (
    result.status === 0 &&
    stderrLines.length === 0 &&
    stdoutLines.length === SUCCESS_MARKERS.length &&
    stdoutLines.every((line, index) => line === SUCCESS_MARKERS[index])
  ) {
    return { status: "ok", marker: "PRODUCTION_SIGNALS_OK" };
  }
  return {
    status: "failed",
    marker: "PRODUCTION_SIGNAL_INTERNAL_FAILED",
  };
}

function defaultRunCommand(command, args, options) {
  return spawnSync(command, args, options);
}

export function runProductionSignalSchedule({
  env = process.env,
  now,
  runCommand = defaultRunCommand,
} = {}) {
  const targetSha = env.TARGET_SHA || "";
  if (!isCanonicalSha(targetSha)) fail();
  const heartbeatFile =
    env.PRODUCTION_SIGNAL_HEARTBEAT_FILE || DEFAULT_HEARTBEAT_FILE;
  const result = runCommand(process.execPath, [SIGNAL_SCRIPT], {
    env,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  const classification = classifyResult(result);
  const heartbeat = {
    version: HEARTBEAT_VERSION,
    targetSha,
    completedAtMs: now ?? Date.now(),
    status: classification.status,
    marker: classification.marker,
  };
  atomicWriteHeartbeat(heartbeatFile, heartbeat);
  return {
    exitCode: classification.status === "ok" ? 0 : 1,
    marker:
      classification.status === "ok"
        ? RUNNER_MARKERS.ok
        : classification.marker,
  };
}

export function checkProductionSignalHeartbeat({
  env = process.env,
  now = Date.now(),
} = {}) {
  const targetSha = env.TARGET_SHA || "";
  if (!isCanonicalSha(targetSha)) fail();
  const heartbeatFile =
    env.PRODUCTION_SIGNAL_HEARTBEAT_FILE || DEFAULT_HEARTBEAT_FILE;
  const maximumAgeSeconds = parseBoundedInteger(
    env.PRODUCTION_SIGNAL_HEARTBEAT_MAX_AGE_SECONDS,
    DEFAULT_MAX_AGE_SECONDS,
    120,
    3600,
  );
  assertPrivateDirectory(path.dirname(heartbeatFile));
  const stat = assertPrivateRegularFile(heartbeatFile);
  if (stat.size <= 0 || stat.size > 4096) fail();

  let heartbeat;
  try {
    heartbeat = JSON.parse(fs.readFileSync(heartbeatFile, "utf8"));
  } catch {
    fail();
  }
  if (
    heartbeat?.version !== HEARTBEAT_VERSION ||
    heartbeat.targetSha !== targetSha ||
    heartbeat.status !== "ok" ||
    heartbeat.marker !== "PRODUCTION_SIGNALS_OK" ||
    !Number.isSafeInteger(heartbeat.completedAtMs)
  ) {
    fail();
  }
  const ageMs = now - heartbeat.completedAtMs;
  if (ageMs < -5 * 60 * 1000 || ageMs > maximumAgeSeconds * 1000) fail();
  return RUNNER_MARKERS.current;
}

function runCli() {
  const operation = process.argv[2];
  try {
    if (operation === "run") {
      const result = runProductionSignalSchedule();
      const stream = result.exitCode === 0 ? process.stdout : process.stderr;
      stream.write(result.marker + "\n");
      process.exitCode = result.exitCode;
      return;
    }
    if (operation === "check") {
      process.stdout.write(checkProductionSignalHeartbeat() + "\n");
      return;
    }
    fail();
  } catch {
    process.stderr.write(RUNNER_MARKERS.failed + "\n");
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  runCli();
}
