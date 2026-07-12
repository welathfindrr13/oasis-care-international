import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  REVISION_AWARE_EXACT,
  isCanonicalSha,
  normalizeBaseUrl,
  verifyRevision,
} from "../../../.github/workflows/revision-proof.mjs";
import { readAuthenticatedBackupMetadata } from "./backup-crypto.mjs";

const SERVICES = ["caddy", "web", "api", "postgres"];
const HARD_CRITICAL_LOG_PATTERN =
  /(?:\bFATAL\b|\bpanic\b|uncaught|unhandled|status(?:Code)?["'=:\s]+5\d{2}|HTTP\s+5\d{2}|→\s*5\d{2}\s*::|GraphQL proxy (?:failed:\s*5\d{2}|error)|Failed to write audit log)/im;
const GENERIC_ERROR_LOG_PATTERN =
  /(?:["']level["']\s*:\s*(?:["']error["']|50)(?=\s*[,}])|(?:^|\s)(?:⨯\s*)?Error:)/im;
const UPPERCASE_ERROR_PATTERN = /(?:^|\s)ERROR(?:\s|:|\[)/m;
const EXPECTED_HTTP_DENIAL_PATTERN =
  /\bERROR\s+\[HttpExceptionFilter\].*→\s*4\d{2}\s*::/;
const AUTH_DENIAL_PATTERN =
  /(?:→\s*(?:401|403)\s*::|["']statusCode["']\s*:\s*(?:401|403)\b|["']?code["']?\s*[:=]\s*["']?(?:UNAUTHENTICATED|FORBIDDEN(?:_[A-Z_]+)?)\b|\b(?:Clerk|JWT)\b.*\b(?:unauthorized|forbidden|invalid|denied|rejected)\b)/i;
const PRIVATE_FILE_MASK = 0o077;
const MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024;
const MAX_LOGIN_BODY_BYTES = 256 * 1024;
const COMMAND_TIMEOUT_MS = 10_000;
const WHOLE_PROBE_TIMEOUT_MS = 120_000;
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

export function containsCriticalLog(value) {
  return value.split(/\r?\n/).some((line) => {
    if (isAuthDenialLine(line)) return HARD_CRITICAL_LOG_PATTERN.test(line);
    if (EXPECTED_HTTP_DENIAL_PATTERN.test(line)) {
      return HARD_CRITICAL_LOG_PATTERN.test(line);
    }
    return (
      HARD_CRITICAL_LOG_PATTERN.test(line) ||
      GENERIC_ERROR_LOG_PATTERN.test(line) ||
      UPPERCASE_ERROR_PATTERN.test(line)
    );
  });
}

export function isAuthDenialLine(line) {
  return AUTH_DENIAL_PATTERN.test(line);
}

class SignalFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new SignalFailure(code);
}

function assertPrivateFile(filePath, code) {
  const stat = assertRegularFile(filePath, code);
  if ((stat.mode & PRIVATE_FILE_MASK) !== 0) fail(code);
  return stat;
}

function assertRegularFile(filePath, code) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    fail(code);
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isFile()
  ) {
    fail(code);
  }
  return stat;
}

function assertDirectory(directory, code) {
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch {
    fail(code);
  }
  if (
    stat.isSymbolicLink() ||
    !stat.isDirectory() ||
    (stat.mode & PRIVATE_FILE_MASK) !== 0
  ) {
    fail(code);
  }
}

function parseBoundedInteger(value, { defaultValue, minimum, maximum, code }) {
  const raw = value == null || value === "" ? String(defaultValue) : value;
  if (!/^\d+$/.test(raw)) fail(code);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail(code);
  }
  return parsed;
}

function defaultRunCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    timeout: COMMAND_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function runChecked(runCommand, command, args, code, includeStderr = false) {
  const result = runCommand(command, args);
  const stderr = result?.stderr || "";
  if (
    !result ||
    result.status !== 0 ||
    typeof result.stdout !== "string" ||
    typeof stderr !== "string" ||
    Buffer.byteLength(result.stdout) + Buffer.byteLength(stderr) >
      MAX_COMMAND_OUTPUT_BYTES
  ) {
    fail(code);
  }
  return includeStderr
    ? `${result.stdout}\n${stderr}`.trim()
    : result.stdout.trim();
}

function parseDiskUse(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) fail("PRODUCTION_SIGNAL_DISK_FAILED");
  const columns = lines.at(-1).trim().split(/\s+/);
  const match = columns[4]?.match(/^(\d{1,3})%$/);
  if (!match) fail("PRODUCTION_SIGNAL_DISK_FAILED");
  const percentage = Number(match[1]);
  if (percentage < 0 || percentage > 100) {
    fail("PRODUCTION_SIGNAL_DISK_FAILED");
  }
  return percentage;
}

function latestEncryptedBackup(backupDirectory) {
  assertDirectory(backupDirectory, "PRODUCTION_SIGNAL_BACKUP_FAILED");
  let latest = null;
  for (const name of fs.readdirSync(backupDirectory)) {
    if (!name.endsWith(".dump.enc") || name.includes(path.sep)) continue;
    const candidate = path.join(backupDirectory, name);
    const stat = assertPrivateFile(candidate, "PRODUCTION_SIGNAL_BACKUP_FAILED");
    if (!latest || stat.mtimeMs > latest.stat.mtimeMs) {
      latest = { file: candidate, stat };
    }
  }
  if (!latest) fail("PRODUCTION_SIGNAL_BACKUP_FAILED");
  return latest;
}

async function checkPublicSignals({ baseUrl, targetSha, fetchImpl }) {
  const base = normalizeBaseUrl(baseUrl);
  let loginResponse;
  try {
    loginResponse = await fetchImpl(new URL("/login", base), {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    fail("PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED");
  }
  if (
    !loginResponse ||
    loginResponse.status !== 200 ||
    !/^text\/html(?:\s*;|$)/i.test(loginResponse.headers.get("content-type") || "") ||
    !loginResponse.body
  ) {
    fail("PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED");
  }
  const reader = loginResponse.body.getReader();
  const decoder = new TextDecoder();
  let loginBody = "";
  let totalBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_LOGIN_BODY_BYTES) {
      await reader.cancel();
      fail("PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED");
    }
    loginBody += decoder.decode(value, { stream: true });
  }
  loginBody += decoder.decode();
  if (!loginBody.includes("Oasis Care")) {
    fail("PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED");
  }
  const revision = await verifyRevision({
    mode: "target_exact",
    baseUrl: baseUrl,
    targetSha,
    fetchImpl,
  });
  if (revision !== REVISION_AWARE_EXACT) {
    fail("PRODUCTION_SIGNAL_REVISION_FAILED");
  }
}

function checkDockerSignals({
  composeFile,
  envFile,
  diskMaximum,
  logSince,
  authDenialThreshold,
  runCommand,
}) {
  const compose = ["compose", "--env-file", envFile, "-f", composeFile];
  const containerIds = new Map();
  for (const service of SERVICES) {
    const containerId = runChecked(
      runCommand,
      "docker",
      [...compose, "ps", "-q", service],
      "PRODUCTION_SIGNAL_SERVICE_HEALTH_FAILED",
    );
    if (!/^[0-9a-f]{64}$/.test(containerId)) {
      fail("PRODUCTION_SIGNAL_SERVICE_HEALTH_FAILED");
    }
    const state = runChecked(
      runCommand,
      "docker",
      [
        "inspect",
        "--format",
        "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}|{{.State.OOMKilled}}|{{.RestartCount}}",
        containerId,
      ],
      "PRODUCTION_SIGNAL_SERVICE_HEALTH_FAILED",
    );
    if (state !== "healthy|false|0") {
      fail("PRODUCTION_SIGNAL_SERVICE_HEALTH_FAILED");
    }
    containerIds.set(service, containerId);
  }

  const databaseDisk = readContainerDiskUse({
    containerId: containerIds.get("postgres"),
    runCommand,
  });
  if (databaseDisk >= diskMaximum) fail("PRODUCTION_SIGNAL_DISK_FAILED");

  const logs = runChecked(
    runCommand,
    "docker",
    [...compose, "logs", "--since", logSince, "--no-color", "api", "web", "caddy"],
    "PRODUCTION_SIGNAL_CRITICAL_ERRORS_FAILED",
    true,
  );
  if (containsCriticalLog(logs)) {
    fail("PRODUCTION_SIGNAL_CRITICAL_ERRORS_FAILED");
  }
  const authDenials = logs
    .split(/\r?\n/)
    .filter((line) => isAuthDenialLine(line)).length;
  if (authDenials >= authDenialThreshold) {
    fail("PRODUCTION_SIGNAL_AUTH_ABUSE_FAILED");
  }
}

export function readContainerDiskUse({
  containerId,
  runCommand = defaultRunCommand,
}) {
  if (!/^[0-9a-f]{64}$/.test(containerId || "")) {
    fail("PRODUCTION_SIGNAL_DISK_FAILED");
  }
  return parseDiskUse(
    runChecked(
      runCommand,
      "docker",
      ["exec", containerId, "df", "-P", "/var/lib/postgresql/data"],
      "PRODUCTION_SIGNAL_DISK_FAILED",
    ),
  );
}

async function checkBackupSignal({
  backupDirectory,
  keyFile,
  backupMaximumAgeHours,
  diskMaximum,
  now,
  runCommand,
}) {
  const backupDisk = parseDiskUse(
    runChecked(
      runCommand,
      "df",
      ["-P", backupDirectory],
      "PRODUCTION_SIGNAL_DISK_FAILED",
    ),
  );
  if (backupDisk >= diskMaximum) fail("PRODUCTION_SIGNAL_DISK_FAILED");

  const latest = latestEncryptedBackup(backupDirectory);
  let metadata;
  try {
    metadata = await readAuthenticatedBackupMetadata({
      inputFile: latest.file,
      keyFile,
    });
  } catch {
    fail("PRODUCTION_SIGNAL_BACKUP_FAILED");
  }
  if (metadata.formatVersion !== 2 || !Number.isSafeInteger(metadata.createdAtMs)) {
    fail("PRODUCTION_SIGNAL_BACKUP_FAILED");
  }
  const ageMs = now - metadata.createdAtMs;
  if (ageMs < -5 * 60 * 1000 || ageMs > backupMaximumAgeHours * 60 * 60 * 1000) {
    fail("PRODUCTION_SIGNAL_BACKUP_FAILED");
  }
}

export async function checkProductionSignals({
  env = process.env,
  fetchImpl = fetch,
  runCommand = defaultRunCommand,
  now = Date.now(),
} = {}) {
  const targetSha = env.TARGET_SHA || "";
  if (!isCanonicalSha(targetSha)) fail("PRODUCTION_SIGNAL_CONFIGURATION_FAILED");
  try {
    normalizeBaseUrl(env.OASIS_PRODUCTION_APP_URL);
  } catch {
    fail("PRODUCTION_SIGNAL_CONFIGURATION_FAILED");
  }

  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const deployDirectory = path.resolve(scriptDirectory, "..");
  const composeFile = env.COMPOSE_FILE || path.join(deployDirectory, "docker-compose.yml");
  const envFile = env.ENV_FILE || path.join(deployDirectory, ".env");
  const backupDirectory = env.BACKUP_DIR || path.join(deployDirectory, "backups");
  const keyFile = env.BACKUP_ENCRYPTION_KEY_FILE || "";
  assertRegularFile(composeFile, "PRODUCTION_SIGNAL_CONFIGURATION_FAILED");
  assertPrivateFile(envFile, "PRODUCTION_SIGNAL_CONFIGURATION_FAILED");
  assertPrivateFile(keyFile, "PRODUCTION_SIGNAL_CONFIGURATION_FAILED");

  const diskMaximum = parseBoundedInteger(env.DISK_MAX_PERCENT, {
    defaultValue: 85,
    minimum: 50,
    maximum: 95,
    code: "PRODUCTION_SIGNAL_CONFIGURATION_FAILED",
  });
  const backupMaximumAgeHours = parseBoundedInteger(env.BACKUP_MAX_AGE_HOURS, {
    defaultValue: 26,
    minimum: 1,
    maximum: 168,
    code: "PRODUCTION_SIGNAL_CONFIGURATION_FAILED",
  });
  const logSince = env.CRITICAL_LOG_SINCE || "15m";
  if (!/^\d{1,3}[mhd]$/.test(logSince)) {
    fail("PRODUCTION_SIGNAL_CONFIGURATION_FAILED");
  }
  const authDenialThreshold = parseBoundedInteger(env.AUTH_DENIAL_THRESHOLD, {
    defaultValue: 25,
    minimum: 5,
    maximum: 1000,
    code: "PRODUCTION_SIGNAL_CONFIGURATION_FAILED",
  });

  await checkPublicSignals({
    baseUrl: env.OASIS_PRODUCTION_APP_URL,
    targetSha,
    fetchImpl,
  });
  checkDockerSignals({
    composeFile,
    envFile,
    diskMaximum,
    logSince,
    authDenialThreshold,
    runCommand,
  });
  await checkBackupSignal({
    backupDirectory,
    keyFile,
    backupMaximumAgeHours,
    diskMaximum,
    now,
    runCommand,
  });

  return SUCCESS_MARKERS;
}

async function runInternalProbe() {
  try {
    const markers = await checkProductionSignals();
    process.stdout.write(`${markers.join("\n")}\n`);
  } catch (error) {
    const code =
      error instanceof SignalFailure
        ? error.code
        : "PRODUCTION_SIGNAL_INTERNAL_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}

export function runBoundedProbeProcess({
  spawnImpl = spawnSync,
  env = process.env,
  timeoutMs = WHOLE_PROBE_TIMEOUT_MS,
} = {}) {
  const scriptFile = fileURLToPath(import.meta.url);
  const result = spawnImpl(process.execPath, [scriptFile, "internal-run"], {
    encoding: "utf8",
    env,
    maxBuffer: MAX_COMMAND_OUTPUT_BYTES,
    timeout: timeoutMs,
    killSignal: "SIGKILL",
  });
  if (result.error?.code === "ETIMEDOUT") {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "PRODUCTION_SIGNAL_TIMEOUT_FAILED\n",
    };
  }
  const expectedSuccess = `${SUCCESS_MARKERS.join("\n")}\n`;
  if (result.status === 0 && result.stdout === expectedSuccess && result.stderr === "") {
    return { exitCode: 0, stdout: expectedSuccess, stderr: "" };
  }
  const failure = (result.stderr || "").trim();
  if (
    result.status === 1 &&
    result.stdout === "" &&
    FAILURE_MARKERS.has(failure)
  ) {
    return { exitCode: 1, stdout: "", stderr: `${failure}\n` };
  }
  return {
    exitCode: 1,
    stdout: "",
    stderr: "PRODUCTION_SIGNAL_INTERNAL_FAILED\n",
  };
}

async function main() {
  if (process.argv[2] === "disk-probe" && process.argv.length === 4) {
    try {
      readContainerDiskUse({ containerId: process.argv[3] });
      process.stdout.write("PRODUCTION_SIGNAL_DISK_PROBE_OK\n");
    } catch {
      process.stderr.write("PRODUCTION_SIGNAL_DISK_FAILED\n");
      process.exitCode = 1;
    }
    return;
  }
  if (process.argv[2] === "internal-run" && process.argv.length === 3) {
    await runInternalProbe();
    return;
  }
  if (process.argv.length !== 2) {
    process.stderr.write("PRODUCTION_SIGNAL_CONFIGURATION_FAILED\n");
    process.exitCode = 1;
    return;
  }
  const result = runBoundedProbeProcess();
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
