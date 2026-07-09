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

function writeExecutable(filePath, contents) {
  writeFileSync(filePath, contents, { mode: 0o755 });
}

function createHarness(t) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "oasis-recovery-proof-"));
  const binDir = path.join(tempDir, "bin");
  const dockerPath = path.join(binDir, "docker");

  mkdirSync(binDir);
  t.after(() => rmSync(tempDir, { recursive: true, force: true }));

  writeExecutable(
    path.join(binDir, "dirname"),
    '#!/bin/bash\nexec /usr/bin/dirname "$@"\n',
  );
  writeExecutable(
    path.join(binDir, "date"),
    '#!/bin/bash\nprintf "20260709T000000Z\\n"\n',
  );
  writeExecutable(
    path.join(binDir, "mkdir"),
    '#!/bin/bash\nexec /bin/mkdir "$@"\n',
  );
  writeExecutable(
    dockerPath,
    `#!/bin/bash
set -euo pipefail
printf '%s\\n' "$@" > "$DOCKER_ARGUMENTS_LOG"

case "$FAKE_DOCKER_MODE" in
  backup)
    printf 'synthetic custom archive\\n'
    ;;
  restore)
    /bin/cat > "$RESTORE_INPUT_LOG"
    ;;
  *)
    printf 'unexpected fake Docker mode\\n' >&2
    exit 2
    ;;
esac
`,
  );

  const env = {
    HOME: tempDir,
    PATH: binDir,
    ENV_FILE: path.join(tempDir, "missing.env"),
  };
  const resolvedDocker = spawnSync("/bin/bash", ["-c", "command -v docker"], {
    encoding: "utf8",
    env,
  });

  assert.equal(resolvedDocker.status, 0, resolvedDocker.stderr);
  assert.equal(resolvedDocker.stdout.trim(), dockerPath);

  return { binDir, env, tempDir };
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

test("backup writes a custom-format archive through the isolated Postgres service", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "backups", "recovery.dump");
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
  assert.equal(readFileSync(backupFile, "utf8"), "synthetic custom archive\n");
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
  const backupFile = path.join(harness.tempDir, "synthetic.dump");
  const dockerArgumentsLog = path.join(
    harness.tempDir,
    "restore-arguments.log",
  );

  writeFileSync(backupFile, "synthetic custom archive\n");

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

test("confirmed synthetic restore streams the selected archive to pg_restore", (t) => {
  const harness = createHarness(t);
  const backupFile = path.join(harness.tempDir, "synthetic.dump");
  const composeFile = path.join(harness.tempDir, "synthetic-compose.yml");
  const dockerArgumentsLog = path.join(
    harness.tempDir,
    "restore-arguments.log",
  );
  const restoreInputLog = path.join(harness.tempDir, "restore-input.dump");

  writeFileSync(backupFile, "synthetic custom archive\n");

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
  assert.equal(
    readFileSync(restoreInputLog, "utf8"),
    "synthetic custom archive\n",
  );
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
    "--no-owner",
    "--no-acl",
  ]);
});
