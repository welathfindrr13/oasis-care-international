import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkProductionSignalHeartbeat,
  runProductionSignalSchedule,
} from "./production-signal-runner.mjs";

const TARGET_SHA = "a".repeat(40);
const RUNNER_PATH = fileURLToPath(
  new URL("./production-signal-runner.mjs", import.meta.url),
);

function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "oasis-production-signal-runner-"),
  );
  fs.chmodSync(directory, 0o700);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return {
    directory,
    heartbeatFile: path.join(directory, "heartbeat.json"),
  };
}

function environment(files, overrides = {}) {
  return {
    TARGET_SHA,
    PRODUCTION_SIGNAL_HEARTBEAT_FILE: files.heartbeatFile,
    ...overrides,
  };
}

test("writes a private revision-bound success heartbeat", (t) => {
  const files = fixture(t);
  const now = Date.now();
  const result = runProductionSignalSchedule({
    env: environment(files),
    now,
    runCommand: () => ({
      status: 0,
      stdout: [
        "PRODUCTION_SIGNAL_PUBLIC_UPTIME_OK",
        "PRODUCTION_SIGNAL_REVISION_OK",
        "PRODUCTION_SIGNAL_SERVICE_HEALTH_OK",
        "PRODUCTION_SIGNAL_DISK_OK",
        "PRODUCTION_SIGNAL_BACKUP_OK",
        "PRODUCTION_SIGNAL_CRITICAL_ERRORS_OK",
        "PRODUCTION_SIGNAL_AUTH_ABUSE_OK",
        "PRODUCTION_SIGNALS_OK",
      ].join("\n"),
      stderr: "",
    }),
  });

  assert.deepEqual(result, {
    exitCode: 0,
    marker: "PRODUCTION_SIGNAL_HEARTBEAT_WRITTEN",
  });
  assert.equal(fs.statSync(files.heartbeatFile).mode & 0o777, 0o600);
  assert.equal(
    checkProductionSignalHeartbeat({
      env: environment(files),
      now: now + 6 * 60 * 1000,
    }),
    "PRODUCTION_SIGNAL_HEARTBEAT_OK",
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(files.heartbeatFile, "utf8")), {
    version: 1,
    targetSha: TARGET_SHA,
    completedAtMs: now,
    status: "ok",
    marker: "PRODUCTION_SIGNALS_OK",
  });
});

test("records an allowlisted failure without persisting child output", (t) => {
  const files = fixture(t);
  const privateSentinel = "DO-NOT-PERSIST-PRIVATE-LOG";
  const result = runProductionSignalSchedule({
    env: environment(files),
    runCommand: () => ({
      status: 1,
      stdout: privateSentinel,
      stderr: "PRODUCTION_SIGNAL_AUTH_ABUSE_FAILED\n",
    }),
  });

  assert.deepEqual(result, {
    exitCode: 1,
    marker: "PRODUCTION_SIGNAL_AUTH_ABUSE_FAILED",
  });
  const stored = fs.readFileSync(files.heartbeatFile, "utf8");
  assert.doesNotMatch(stored, new RegExp(privateSentinel));
  assert.equal(JSON.parse(stored).status, "failed");
  assert.throws(
    () => checkProductionSignalHeartbeat({ env: environment(files) }),
    { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
  );
});

test("maps malformed, oversized, or timed-out child results to internal failure", (t) => {
  for (const result of [
    { status: null, stdout: "", stderr: "", error: new Error("timeout secret") },
    { status: 0, stdout: "unexpected success", stderr: "" },
    { status: 1, stdout: "x".repeat(65 * 1024), stderr: "private" },
  ]) {
    const files = fixture(t);
    const outcome = runProductionSignalSchedule({
      env: environment(files),
      runCommand: () => result,
    });
    assert.deepEqual(outcome, {
      exitCode: 1,
      marker: "PRODUCTION_SIGNAL_INTERNAL_FAILED",
    });
    assert.equal(
      JSON.parse(fs.readFileSync(files.heartbeatFile, "utf8")).marker,
      "PRODUCTION_SIGNAL_INTERNAL_FAILED",
    );
  }
});

test("rejects partial or contradictory success output", (t) => {
  for (const result of [
    { status: 0, stdout: "PRODUCTION_SIGNALS_OK\n", stderr: "" },
    {
      status: 0,
      stdout: [
        "PRODUCTION_SIGNAL_PUBLIC_UPTIME_OK",
        "PRODUCTION_SIGNAL_REVISION_OK",
        "PRODUCTION_SIGNAL_SERVICE_HEALTH_OK",
        "PRODUCTION_SIGNAL_DISK_OK",
        "PRODUCTION_SIGNAL_BACKUP_OK",
        "PRODUCTION_SIGNAL_CRITICAL_ERRORS_OK",
        "PRODUCTION_SIGNAL_AUTH_ABUSE_OK",
        "PRODUCTION_SIGNALS_OK",
      ].join("\n"),
      stderr: "PRODUCTION_SIGNAL_BACKUP_FAILED\n",
    },
  ]) {
    const files = fixture(t);
    assert.deepEqual(
      runProductionSignalSchedule({
        env: environment(files),
        runCommand: () => result,
      }),
      {
        exitCode: 1,
        marker:
          result.stderr === ""
            ? "PRODUCTION_SIGNAL_INTERNAL_FAILED"
            : "PRODUCTION_SIGNAL_BACKUP_FAILED",
      },
    );
  }
});

test("rejects stale, future, wrong-revision, permissive, and tampered heartbeats", (t) => {
  const cases = [
    { ageMs: 436_000 },
    { ageMs: -301_000 },
    { targetSha: "b".repeat(40) },
    { marker: "PRODUCTION_SIGNAL_INTERNAL_FAILED" },
    { status: "failed" },
    { version: 2 },
    { completedAtMs: "not-a-number" },
  ];
  for (const mutation of cases) {
    const files = fixture(t);
    const now = Date.now();
    const heartbeat = {
      version: 1,
      targetSha: TARGET_SHA,
      completedAtMs: now - (mutation.ageMs || 0),
      status: "ok",
      marker: "PRODUCTION_SIGNALS_OK",
      ...mutation,
    };
    delete heartbeat.ageMs;
    fs.writeFileSync(files.heartbeatFile, JSON.stringify(heartbeat), {
      mode: 0o600,
    });
    assert.throws(
      () =>
        checkProductionSignalHeartbeat({
          env: environment(files),
          now,
        }),
      { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
    );
  }

  const files = fixture(t);
  fs.writeFileSync(
    files.heartbeatFile,
    JSON.stringify({
      version: 1,
      targetSha: TARGET_SHA,
      completedAtMs: Date.now(),
      status: "ok",
      marker: "PRODUCTION_SIGNALS_OK",
    }),
    { mode: 0o600 },
  );
  fs.chmodSync(files.heartbeatFile, 0o644);
  assert.throws(
    () => checkProductionSignalHeartbeat({ env: environment(files) }),
    { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
  );
});

test("accepts a successful heartbeat at the reviewed freshness boundary", (t) => {
  const files = fixture(t);
  const now = Date.now();
  fs.writeFileSync(
    files.heartbeatFile,
    JSON.stringify({
      version: 1,
      targetSha: TARGET_SHA,
      completedAtMs: now - 435_000,
      status: "ok",
      marker: "PRODUCTION_SIGNALS_OK",
    }),
    { mode: 0o600 },
  );
  assert.equal(
    checkProductionSignalHeartbeat({ env: environment(files), now }),
    "PRODUCTION_SIGNAL_HEARTBEAT_OK",
  );
});

test("rejects symlinked heartbeat state and non-private state directories", (t) => {
  const files = fixture(t);
  const target = path.join(files.directory, "target.json");
  fs.writeFileSync(target, "{}", { mode: 0o600 });
  fs.symlinkSync(target, files.heartbeatFile);
  assert.throws(
    () => checkProductionSignalHeartbeat({ env: environment(files) }),
    { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
  );

  fs.unlinkSync(files.heartbeatFile);
  fs.writeFileSync(
    files.heartbeatFile,
    JSON.stringify({
      version: 1,
      targetSha: TARGET_SHA,
      completedAtMs: Date.now(),
      status: "ok",
      marker: "PRODUCTION_SIGNALS_OK",
    }),
    { mode: 0o600 },
  );
  fs.chmodSync(files.directory, 0o755);
  assert.throws(
    () => checkProductionSignalHeartbeat({ env: environment(files) }),
    { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
  );
  fs.unlinkSync(files.heartbeatFile);
  assert.throws(
    () =>
      runProductionSignalSchedule({
        env: environment(files),
        runCommand: () => ({
          status: 0,
          stdout: "PRODUCTION_SIGNALS_OK\n",
          stderr: "",
        }),
      }),
    { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
  );
});

test("rejects invalid revisions and heartbeat age configuration", (t) => {
  const files = fixture(t);
  assert.throws(
    () =>
      runProductionSignalSchedule({
        env: environment(files, { TARGET_SHA: "main" }),
        runCommand: () => ({
          status: 0,
          stdout: "PRODUCTION_SIGNALS_OK\n",
          stderr: "",
        }),
      }),
    { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
  );
  fs.writeFileSync(
    files.heartbeatFile,
    JSON.stringify({
      version: 1,
      targetSha: TARGET_SHA,
      completedAtMs: Date.now(),
      status: "ok",
      marker: "PRODUCTION_SIGNALS_OK",
    }),
    { mode: 0o600 },
  );
  assert.throws(
    () =>
      checkProductionSignalHeartbeat({
        env: environment(files, {
          PRODUCTION_SIGNAL_HEARTBEAT_MAX_AGE_SECONDS: "7200",
        }),
      }),
    { message: "PRODUCTION_SIGNAL_HEARTBEAT_FAILED" },
  );
});

test("heartbeat CLI emits only its fixed success or failure marker", (t) => {
  const files = fixture(t);
  fs.writeFileSync(
    files.heartbeatFile,
    JSON.stringify({
      version: 1,
      targetSha: TARGET_SHA,
      completedAtMs: Date.now(),
      status: "ok",
      marker: "PRODUCTION_SIGNALS_OK",
    }),
    { mode: 0o600 },
  );
  const successful = spawnSync(process.execPath, [RUNNER_PATH, "check"], {
    env: { ...process.env, ...environment(files) },
    encoding: "utf8",
  });
  assert.equal(successful.status, 0);
  assert.equal(successful.stdout, "PRODUCTION_SIGNAL_HEARTBEAT_OK\n");
  assert.equal(successful.stderr, "");

  const privateSentinel = "PRIVATE-HEARTBEAT-CONTENT";
  fs.writeFileSync(files.heartbeatFile, privateSentinel, { mode: 0o600 });
  const failed = spawnSync(process.execPath, [RUNNER_PATH, "check"], {
    env: { ...process.env, ...environment(files) },
    encoding: "utf8",
  });
  assert.equal(failed.status, 1);
  assert.equal(failed.stdout, "");
  assert.equal(failed.stderr, "PRODUCTION_SIGNAL_HEARTBEAT_FAILED\n");
  assert.doesNotMatch(failed.stdout + failed.stderr, new RegExp(privateSentinel));
});
