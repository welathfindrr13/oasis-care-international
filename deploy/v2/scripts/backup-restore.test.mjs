import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "../../..");
const cryptoHelper = path.join(scriptsDir, "backup-crypto.mjs");

function writeExecutable(filePath, contents) {
  writeFileSync(filePath, contents, { mode: 0o755 });
}

function createHarness(t) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "oasis-recovery-proof-"));
  const binDir = path.join(tempDir, "bin");
  const dockerPath = path.join(binDir, "docker");
  const keyFile = path.join(tempDir, "backup.key");

  mkdirSync(binDir);
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  writeExecutable(
    dockerPath,
    `#!/bin/bash
set -euo pipefail
if [[ -n "\${DOCKER_ARGUMENTS_LOG:-}" ]]; then
  printf '%s\\n' "$@" >> "$DOCKER_ARGUMENTS_LOG"
fi

case "$FAKE_DOCKER_MODE" in
  backup)
    printf 'synthetic custom archive\\n'
    ;;
  restore)
    /bin/cat > "$RESTORE_INPUT_LOG"
    ;;
  rehearsal)
    case "$1" in
      run)
        : > "$FAKE_DOCKER_STATE"
        printf '%064d\\n' 0
        ;;
      exec)
        if [[ "$*" == *" pg_isready "* ]]; then
          exit 0
        fi
        if [[ "$*" == *" pg_restore "* ]]; then
          /bin/cat > "$RESTORE_INPUT_LOG"
          exit 0
        fi
        if [[ "$*" == *" psql "* ]]; then
          printf '%s\\n' "\${FAKE_DOCKER_QUERY_RESULT:-RESTORE_QUERY_OK}"
          exit 0
        fi
        exit 2
        ;;
      rm)
        if [[ "\${FAKE_DOCKER_DESTROY_FAIL:-false}" == "true" ]]; then
          exit 1
        fi
        /bin/rm -f "$FAKE_DOCKER_STATE"
        ;;
      inspect)
        if [[ ! -f "$FAKE_DOCKER_STATE" ]]; then
          exit 1
        fi
        if [[ "$*" == *"--format"* ]]; then
          printf 'tmpfs /var/lib/postgresql/data\\n'
        fi
        ;;
      *)
        exit 2
        ;;
    esac
    ;;
  *)
    printf 'unexpected fake Docker mode\\n' >&2
    exit 2
    ;;
esac
`,
  );
  writeFileSync(keyFile, `${"ab".repeat(32)}\n`, { mode: 0o600 });

  const env = {
    HOME: tempDir,
    PATH: `${binDir}:/usr/bin:/bin`,
    ENV_FILE: path.join(tempDir, "missing.env"),
    BACKUP_ENCRYPTION_KEY_FILE: keyFile,
    NODE_BINARY: process.execPath,
  };
  const resolvedDocker = spawnSync("/bin/bash", ["-c", "command -v docker"], {
    encoding: "utf8",
    env,
  });

  assert.equal(resolvedDocker.status, 0, resolvedDocker.stderr);
  assert.equal(resolvedDocker.stdout.trim(), dockerPath);

  return { binDir, env, keyFile, tempDir };
}

function runScript(scriptName, args, harness, env) {
  return spawnSync("/bin/bash", [path.join(scriptsDir, scriptName), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...harness.env,
      ...env,
    },
  });
}

function readArguments(filePath) {
  return readFileSync(filePath, "utf8").trimEnd().split("\n");
}

function encryptFixture(
  harness,
  backupFile,
  plaintext = "synthetic custom archive\n",
) {
  const result = spawnSync(
    process.execPath,
    [cryptoHelper, "encrypt", harness.keyFile, backupFile],
    { encoding: "utf8", input: plaintext },
  );
  assert.equal(result.status, 0, result.stderr);
}

test("backup writes only an encrypted archive through the isolated Postgres service", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "backups", "recovery.dump.enc");
  const composeFile = path.join(harness.tempDir, "synthetic-compose.yml");
  const dockerArgumentsLog = path.join(harness.tempDir, "backup-arguments.log");

  const result = runScript("backup-postgres.sh", [], harness, {
    BACKUP_DIR: path.dirname(backupFile),
    BACKUP_FILE: backupFile,
    COMPOSE_FILE: composeFile,
    DOCKER_ARGUMENTS_LOG: dockerArgumentsLog,
    FAKE_DOCKER_MODE: "backup",
    POSTGRES_DB: "recovery_test",
    POSTGRES_USER: "recovery_operator",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const encrypted = readFileSync(backupFile);
  assert.equal(encrypted.includes(Buffer.from("synthetic custom archive")), false);
  assert.equal(encrypted.subarray(0, 8).toString("ascii"), "OASISB1\n");
  assert.equal(result.stdout, "BACKUP_ENCRYPTION_READY\nBACKUP_CREATED_ENCRYPTED\n");
  assert.deepEqual(readArguments(dockerArgumentsLog), [
    "compose",
    "-f",
    composeFile,
    "exec",
    "-T",
    "postgres",
    "pg_dump",
    "--username",
    "recovery_operator",
    "--dbname",
    "recovery_test",
    "--format",
    "custom",
    "--no-owner",
    "--no-acl",
  ]);
});

test("non-interactive restore fails closed without pre-restore backup confirmation", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "synthetic.dump.enc");
  const dockerArgumentsLog = path.join(harness.tempDir, "restore-arguments.log");
  encryptFixture(harness, backupFile);

  const result = runScript("restore-postgres.sh", [backupFile], harness, {
    DOCKER_ARGUMENTS_LOG: dockerArgumentsLog,
    FAKE_DOCKER_MODE: "restore",
    NON_INTERACTIVE: "true",
    POSTGRES_DB: "recovery_test",
    POSTGRES_USER: "recovery_operator",
  });

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stderr, /PRE_RESTORE_BACKUP_CONFIRMED=true is required/);
  assert.equal(existsSync(dockerArgumentsLog), false);
});

test("interactive restore also fails closed without pre-restore backup confirmation", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "synthetic.dump.enc");
  const dockerArgumentsLog = path.join(harness.tempDir, "restore-arguments.log");
  encryptFixture(harness, backupFile);

  const result = runScript("restore-postgres.sh", [backupFile], harness, {
    DOCKER_ARGUMENTS_LOG: dockerArgumentsLog,
    FAKE_DOCKER_MODE: "restore",
    POSTGRES_DB: "recovery_test",
    POSTGRES_USER: "recovery_operator",
  });

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /PRE_RESTORE_BACKUP_CONFIRMED=true is required/);
  assert.equal(existsSync(dockerArgumentsLog), false);
});

test("confirmed restore authenticates then streams decrypted data to pg_restore", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "synthetic.dump.enc");
  const composeFile = path.join(harness.tempDir, "synthetic-compose.yml");
  const dockerArgumentsLog = path.join(harness.tempDir, "restore-arguments.log");
  const restoreInputLog = path.join(harness.tempDir, "restore-input.dump");
  encryptFixture(harness, backupFile);

  const result = runScript("restore-postgres.sh", [backupFile], harness, {
    COMPOSE_FILE: composeFile,
    DOCKER_ARGUMENTS_LOG: dockerArgumentsLog,
    FAKE_DOCKER_MODE: "restore",
    NON_INTERACTIVE: "true",
    POSTGRES_DB: "recovery_test",
    POSTGRES_USER: "recovery_operator",
    PRE_RESTORE_BACKUP_CONFIRMED: "true",
    RESTORE_INPUT_LOG: restoreInputLog,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    /^ENCRYPTED_BACKUP_AUTHENTICATED\nRESTORE_ARCHIVE_SHA256=[0-9a-f]{64}\nRESTORE_COMPLETE\n$/,
  );
  assert.equal(readFileSync(restoreInputLog, "utf8"), "synthetic custom archive\n");
  assert.deepEqual(readArguments(dockerArgumentsLog), [
    "compose",
    "-f",
    composeFile,
    "exec",
    "-T",
    "postgres",
    "pg_restore",
    "--username",
    "recovery_operator",
    "--dbname",
    "recovery_test",
    "--clean",
    "--if-exists",
    "--single-transaction",
    "--no-owner",
    "--no-acl",
  ]);
});

test("tampered encrypted backup fails before pg_restore is invoked", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "synthetic.dump.enc");
  const dockerArgumentsLog = path.join(harness.tempDir, "restore-arguments.log");
  encryptFixture(harness, backupFile);
  const contents = readFileSync(backupFile);
  contents[Math.floor(contents.length / 2)] ^= 0xff;
  writeFileSync(backupFile, contents, { mode: 0o600 });

  const result = runScript("restore-postgres.sh", [backupFile], harness, {
    DOCKER_ARGUMENTS_LOG: dockerArgumentsLog,
    FAKE_DOCKER_MODE: "restore",
    NON_INTERACTIVE: "true",
    POSTGRES_DB: "recovery_test",
    POSTGRES_USER: "recovery_operator",
    PRE_RESTORE_BACKUP_CONFIRMED: "true",
  });

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /ENCRYPTED_BACKUP_AUTHENTICATION_FAILED/);
  assert.equal(existsSync(dockerArgumentsLog), false);
});

test("disposable rehearsal restores, queries, and destroys its isolated Postgres container", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "synthetic.dump.enc");
  const dockerArgumentsLog = path.join(harness.tempDir, "rehearsal-arguments.log");
  const restoreInputLog = path.join(harness.tempDir, "restore-input.dump");
  const fakeDockerState = path.join(harness.tempDir, "container.state");
  encryptFixture(harness, backupFile);

  const result = runScript("rehearse-backup-restore.sh", [backupFile], harness, {
    DOCKER_ARGUMENTS_LOG: dockerArgumentsLog,
    FAKE_DOCKER_MODE: "rehearsal",
    FAKE_DOCKER_STATE: fakeDockerState,
    RESTORE_INPUT_LOG: restoreInputLog,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    result.stdout,
    [
      "ENCRYPTED_BACKUP_AUTHENTICATED",
      "DISPOSABLE_POSTGRES_READY",
      "DISPOSABLE_RESTORE_COMPLETE",
      "DISPOSABLE_RESTORE_QUERY_OK",
      "DISPOSABLE_RESTORE_DESTROYED",
      "",
    ].join("\n"),
  );
  assert.equal(readFileSync(restoreInputLog, "utf8"), "synthetic custom archive\n");
  assert.equal(existsSync(fakeDockerState), false);
  const argumentsLog = readFileSync(dockerArgumentsLog, "utf8");
  assert.match(argumentsLog, /run\n-d\n--name\noasis-restore-rehearsal-/);
  assert.match(argumentsLog, /--network\nnone/);
  assert.match(argumentsLog, /--log-driver\nnone/);
  assert.match(
    argumentsLog,
    /--mount\ntype=tmpfs,destination=\/var\/lib\/postgresql\/data,tmpfs-size=1073741824/,
  );
  assert.match(argumentsLog, /pgvector\/pgvector@sha256:5af280ae/);
  assert.match(argumentsLog, /pg_restore/);
  assert.match(argumentsLog, /--single-transaction/);
  assert.match(argumentsLog, /psql/);
  assert.match(argumentsLog, /count\(\*\) FROM public\._prisma_migrations/);
  assert.match(argumentsLog, /rm\n-fv\noasis-restore-rehearsal-/);
  assert.match(argumentsLog, /inspect\noasis-restore-rehearsal-/);
});

test("failed rehearsal reports a container destruction failure", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "synthetic.dump.enc");
  const restoreInputLog = path.join(harness.tempDir, "restore-input.dump");
  const fakeDockerState = path.join(harness.tempDir, "container.state");
  encryptFixture(harness, backupFile);

  const result = runScript("rehearse-backup-restore.sh", [backupFile], harness, {
    FAKE_DOCKER_DESTROY_FAIL: "true",
    FAKE_DOCKER_MODE: "rehearsal",
    FAKE_DOCKER_QUERY_RESULT: "RESTORE_QUERY_FAILED",
    FAKE_DOCKER_STATE: fakeDockerState,
    RESTORE_INPUT_LOG: restoreInputLog,
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /DISPOSABLE_RESTORE_QUERY_FAILED/);
  assert.match(result.stderr, /DISPOSABLE_RESTORE_DESTROY_FAILED/);
});
