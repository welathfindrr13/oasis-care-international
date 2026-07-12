import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { encryptStream } from "./backup-crypto.mjs";
import {
  checkProductionSignals,
  runBoundedProbeProcess,
} from "./production-signals.mjs";

const TARGET_SHA = "ab".repeat(20);
const signalsScript = fileURLToPath(
  new URL("./production-signals.mjs", import.meta.url),
);

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oasis-signals-"));
  const backupDirectory = path.join(directory, "backups");
  const backupFile = path.join(backupDirectory, "oasis-test.dump.enc");
  const keyFile = path.join(directory, "backup.key");
  const composeFile = path.join(directory, "compose.yml");
  const envFile = path.join(directory, ".env");
  fs.mkdirSync(backupDirectory, { mode: 0o700 });
  fs.writeFileSync(keyFile, `${"ab".repeat(32)}\n`, { mode: 0o600 });
  fs.writeFileSync(composeFile, "services: {}\n", { mode: 0o644 });
  fs.writeFileSync(envFile, "SYNTHETIC=true\n", { mode: 0o600 });
  await encryptStream({
    input: Readable.from(["synthetic backup payload"]),
    keyFile,
    outputFile: backupFile,
  });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return {
    backupDirectory,
    backupFile,
    composeFile,
    directory,
    envFile,
    keyFile,
  };
}

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function loginResponse(status = 200, body = "<html><h1>Oasis Care</h1></html>") {
  return new Response(status === 204 ? null : body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function successfulFetch(url) {
  const pathname = new URL(url).pathname;
  if (pathname === "/login") return loginResponse();
  if (pathname === "/health" || pathname === "/api/health") {
    return response({ status: "ok", commitSha: TARGET_SHA });
  }
  if (pathname === "/ready") {
    return response({
      status: "ready",
      commitSha: TARGET_SHA,
      checks: { database: "ok" },
    });
  }
  return response({}, 404);
}

function successfulCommand(command, args) {
  if (command === "df") {
    return {
      status: 0,
      stdout: `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/test 100 10 90 10% ${args[1]}\n`,
    };
  }
  if (command !== "docker") return { status: 1, stdout: "" };
  if (args.includes("logs")) return { status: 0, stdout: "" };
  if (args[0] === "exec" && args[2] === "df") {
    return {
      status: 0,
      stdout:
        "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/test 100 10 90 10% /var/lib/postgresql/data\n",
    };
  }
  if (args[0] === "inspect") {
    return { status: 0, stdout: "healthy|false|0\n" };
  }
  if (args.includes("ps") && args.includes("-q")) {
    return { status: 0, stdout: `${"a".repeat(64)}\n` };
  }
  return { status: 1, stdout: "" };
}

function environment(files, overrides = {}) {
  return {
    OASIS_PRODUCTION_APP_URL: "https://care.example.org",
    TARGET_SHA,
    COMPOSE_FILE: files.composeFile,
    ENV_FILE: files.envFile,
    BACKUP_DIR: files.backupDirectory,
    BACKUP_ENCRYPTION_KEY_FILE: files.keyFile,
    BACKUP_MAX_AGE_HOURS: "26",
    DISK_MAX_PERCENT: "85",
    CRITICAL_LOG_SINCE: "15m",
    ...overrides,
  };
}

test("reports only allowlisted success markers when every production signal passes", async (t) => {
  const files = await fixture(t);
  const markers = await checkProductionSignals({
    env: environment(files),
    fetchImpl: successfulFetch,
    runCommand: successfulCommand,
    now: Date.now(),
  });

  assert.deepEqual(markers, [
    "PRODUCTION_SIGNAL_PUBLIC_UPTIME_OK",
    "PRODUCTION_SIGNAL_REVISION_OK",
    "PRODUCTION_SIGNAL_SERVICE_HEALTH_OK",
    "PRODUCTION_SIGNAL_DISK_OK",
    "PRODUCTION_SIGNAL_BACKUP_OK",
    "PRODUCTION_SIGNAL_CRITICAL_ERRORS_OK",
    "PRODUCTION_SIGNAL_AUTH_ABUSE_OK",
    "PRODUCTION_SIGNALS_OK",
  ]);
});

test("fails safely when the public login endpoint is unavailable", async (t) => {
  const files = await fixture(t);
  await assert.rejects(
    checkProductionSignals({
      env: environment(files),
      fetchImpl: (url) =>
        new URL(url).pathname === "/login"
          ? loginResponse(503)
          : successfulFetch(url),
      runCommand: successfulCommand,
    }),
    { message: "PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED" },
  );
});

test("rejects redirects, empty success responses, and non-login HTML", async (t) => {
  const files = await fixture(t);
  for (const failedLogin of [
    loginResponse(302),
    loginResponse(204, ""),
    loginResponse(200, "<html>maintenance</html>"),
  ]) {
    await assert.rejects(
      checkProductionSignals({
        env: environment(files),
        fetchImpl: (url) =>
          new URL(url).pathname === "/login"
            ? failedLogin.clone()
            : successfulFetch(url),
        runCommand: successfulCommand,
      }),
      { message: "PRODUCTION_SIGNAL_PUBLIC_UPTIME_FAILED" },
    );
  }
});

test("fails safely on API, web, readiness, or exact-revision disagreement", async (t) => {
  const files = await fixture(t);
  await assert.rejects(
    checkProductionSignals({
      env: environment(files),
      fetchImpl: (url) => {
        if (new URL(url).pathname === "/api/health") {
          return response({ status: "ok", commitSha: "cd".repeat(20) });
        }
        return successfulFetch(url);
      },
      runCommand: successfulCommand,
    }),
    { message: "PRODUCTION_SIGNAL_REVISION_FAILED" },
  );
});

test("fails safely when a required container is unhealthy", async (t) => {
  const files = await fixture(t);
  await assert.rejects(
    checkProductionSignals({
      env: environment(files),
      fetchImpl: successfulFetch,
      runCommand: (command, args) =>
        command === "docker" && args[0] === "inspect"
          ? { status: 0, stdout: "healthy|true|1\n" }
          : successfulCommand(command, args),
    }),
    { message: "PRODUCTION_SIGNAL_SERVICE_HEALTH_FAILED" },
  );
});

test("fails safely at the configured disk pressure threshold", async (t) => {
  const files = await fixture(t);
  await assert.rejects(
    checkProductionSignals({
      env: environment(files),
      fetchImpl: successfulFetch,
      runCommand: (command, args) =>
        command === "df" || (command === "docker" && args[0] === "exec")
          ? {
              status: 0,
              stdout: `Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/test 100 90 10 90% ${args[1]}\n`,
            }
          : successfulCommand(command, args),
    }),
    { message: "PRODUCTION_SIGNAL_DISK_FAILED" },
  );
});

test("fails safely for a stale or unauthenticated encrypted backup", async (t) => {
  const files = await fixture(t);
  const now = Date.now();
  await encryptStream({
    input: Readable.from(["old but authenticated backup"]),
    keyFile: files.keyFile,
    outputFile: files.backupFile,
    createdAtMs: now - 27 * 60 * 60 * 1000,
  });
  fs.utimesSync(files.backupFile, new Date(now), new Date(now));
  await assert.rejects(
    checkProductionSignals({
      env: environment(files),
      fetchImpl: successfulFetch,
      runCommand: successfulCommand,
      now,
    }),
    { message: "PRODUCTION_SIGNAL_BACKUP_FAILED" },
  );

  await encryptStream({
    input: Readable.from(["current authenticated backup"]),
    keyFile: files.keyFile,
    outputFile: files.backupFile,
    createdAtMs: now,
  });
  const contents = fs.readFileSync(files.backupFile);
  contents[Math.floor(contents.length / 2)] ^= 0xff;
  fs.writeFileSync(files.backupFile, contents, { mode: 0o600 });
  await assert.rejects(
    checkProductionSignals({
      env: environment(files),
      fetchImpl: successfulFetch,
      runCommand: successfulCommand,
      now,
    }),
    { message: "PRODUCTION_SIGNAL_BACKUP_FAILED" },
  );
});

test("detects real critical log formats on stdout and stderr without exposing contents", async (t) => {
  const files = await fixture(t);
  const privateSentinel = "TEST-ONLY-PRIVATE-ROW";
  const formats = [
    { stdout: `GET /graphql → 500 :: ${privateSentinel}`, stderr: "" },
    { stdout: "", stderr: `GraphQL proxy failed: 500 ${privateSentinel}` },
    { stdout: `Failed to write audit log ${privateSentinel}`, stderr: "" },
    { stdout: `{"level":"error","error":"dial tcp ${privateSentinel}"}`, stderr: "" },
    { stdout: `{"level":50,"msg":"${privateSentinel}"}`, stderr: "" },
    { stdout: "", stderr: `⨯ Error: ${privateSentinel}` },
    { stdout: `[Nest] 1 - ERROR [Audit] ${privateSentinel}`, stderr: "" },
    { stdout: `GET /graphql → 500 :: JWT invalid ${privateSentinel}`, stderr: "" },
    {
      stdout: `{"level":50,"statusCode":500,"code":"FORBIDDEN","msg":"${privateSentinel}"}`,
      stderr: "",
    },
  ];
  for (const format of formats) {
    let observed;
    try {
      await checkProductionSignals({
        env: environment(files),
        fetchImpl: successfulFetch,
        runCommand: (command, args) =>
          command === "docker" && args.includes("logs")
            ? { status: 0, ...format }
            : successfulCommand(command, args),
      });
    } catch (error) {
      observed = error;
    }
    assert.equal(observed?.message, "PRODUCTION_SIGNAL_CRITICAL_ERRORS_FAILED");
    assert.doesNotMatch(String(observed), new RegExp(privateSentinel));
  }
});

test("does not classify ordinary authorization denials as critical errors", async (t) => {
  const files = await fixture(t);
  const markers = await checkProductionSignals({
    env: environment(files),
    fetchImpl: successfulFetch,
    runCommand: (command, args) =>
      command === "docker" && args.includes("logs")
        ? {
            status: 0,
            stdout: [
              "[Nest] 101 - ERROR [HttpExceptionFilter] GET /graphql → 401 :: Unauthorized",
              "[Nest] 101 - ERROR [HttpExceptionFilter] GET /family → 403 :: Forbidden",
              "[Nest] 101 - ERROR [HttpExceptionFilter] GET /missing → 404 :: Not Found",
              '{"level":50,"statusCode":401,"msg":"request denied"}',
              '{"errors":[{"extensions":{"code":"UNAUTHENTICATED"}}]}',
              "GraphQL proxy failed: 401 upstream denied the request",
              "ERROR JWT invalid for request",
              "Clerk token rejected",
            ].join("\n"),
            stderr: "",
          }
        : successfulCommand(command, args),
  });
  assert.equal(markers.at(-1), "PRODUCTION_SIGNALS_OK");
});

test("fails safely when repeated authorization denials reach the reviewed threshold", async (t) => {
  const files = await fixture(t);
  const privateSentinel = "DO-NOT-PRINT-DENIAL-DETAIL";
  const denials = [
    `[Nest] 1 - ERROR [HttpExceptionFilter] GET /graphql → 401 :: ${privateSentinel}`,
    `{"level":50,"statusCode":403,"msg":"${privateSentinel}"}`,
    `GraphQL proxy failed: 401 ${privateSentinel}`,
    `{"extensions":{"code":"UNAUTHENTICATED"},"message":"${privateSentinel}"}`,
    `extensions.code=FORBIDDEN ERROR ${privateSentinel}`,
  ].join("\n");
  let observed;
  try {
    await checkProductionSignals({
      env: environment(files, { AUTH_DENIAL_THRESHOLD: "5" }),
      fetchImpl: successfulFetch,
      runCommand: (command, args) =>
        command === "docker" && args.includes("logs")
          ? { status: 0, stdout: denials, stderr: "" }
          : successfulCommand(command, args),
    });
  } catch (error) {
    observed = error;
  }
  assert.equal(observed?.message, "PRODUCTION_SIGNAL_AUTH_ABUSE_FAILED");
  assert.doesNotMatch(String(observed), new RegExp(privateSentinel));
});

test("rejects permissive secret files and invalid thresholds", async (t) => {
  const files = await fixture(t);
  fs.chmodSync(files.keyFile, 0o644);
  await assert.rejects(
    checkProductionSignals({
      env: environment(files, { DISK_MAX_PERCENT: "100" }),
      fetchImpl: successfulFetch,
      runCommand: successfulCommand,
    }),
    { message: "PRODUCTION_SIGNAL_CONFIGURATION_FAILED" },
  );

  fs.chmodSync(files.keyFile, 0o600);
  await assert.rejects(
    checkProductionSignals({
      env: environment(files, { DISK_MAX_PERCENT: "100" }),
      fetchImpl: successfulFetch,
      runCommand: successfulCommand,
    }),
    { message: "PRODUCTION_SIGNAL_CONFIGURATION_FAILED" },
  );
});

test("CLI failures emit only an allowlisted marker", () => {
  const secretSentinel = "DO-NOT-PRINT-THIS-SECRET";
  const result = spawnSync(process.execPath, [signalsScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      TARGET_SHA,
      OASIS_PRODUCTION_APP_URL: `https://${secretSentinel}@care.example.org`,
    },
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "PRODUCTION_SIGNAL_CONFIGURATION_FAILED\n");
  assert.doesNotMatch(result.stderr, new RegExp(secretSentinel));
});

test("whole-probe watchdog classifies a timed-out child without leaking output", () => {
  const secretSentinel = "TIMED-OUT-PRIVATE-OUTPUT";
  let observedOptions;
  const result = runBoundedProbeProcess({
    timeoutMs: 37,
    spawnImpl: (_command, _args, options) => {
      observedOptions = options;
      return {
        status: null,
        error: { code: "ETIMEDOUT" },
        stdout: secretSentinel,
        stderr: secretSentinel,
      };
    },
  });

  assert.equal(observedOptions.timeout, 37);
  assert.equal(observedOptions.killSignal, "SIGKILL");
  assert.deepEqual(result, {
    exitCode: 1,
    stdout: "",
    stderr: "PRODUCTION_SIGNAL_TIMEOUT_FAILED\n",
  });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secretSentinel));
});
