import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const workflow = fs.readFileSync(
  new URL("./production-backup-restore-proof.yml", import.meta.url),
  "utf8",
);

function indexOfRequired(value) {
  const index = workflow.indexOf(value);
  assert.notEqual(index, -1, `missing workflow contract: ${value}`);
  return index;
}

function extractRun(stepName) {
  const marker = `      - name: ${stepName}`;
  const stepStart = workflow.indexOf(marker);
  assert.notEqual(stepStart, -1);
  const runStart = workflow.indexOf("        run: |\n", stepStart);
  assert.notEqual(runStart, -1);
  const contentStart = runStart + "        run: |\n".length;
  const nextStep = workflow.indexOf("\n      - name:", contentStart);
  const block = workflow.slice(
    contentStart,
    nextStep === -1 ? workflow.length : nextStep,
  );
  return block
    .split("\n")
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
}

function extractHeredoc(script, name) {
  const startMarker = `<<'${name}'\n`;
  const start = script.indexOf(startMarker);
  assert.notEqual(start, -1, `missing heredoc start: ${name}`);
  const contentStart = start + startMarker.length;
  const end = script.indexOf(`\n${name}\n`, contentStart);
  assert.notEqual(end, -1, `missing heredoc end: ${name}`);
  return script.slice(contentStart, end);
}

test("production backup proof is manual main-only and protected", () => {
  assert.match(workflow, /^name: Production Backup Restore Proof/m);
  assert.match(workflow, /^on:\n\s+workflow_dispatch:\n\s+inputs:/m);
  assert.match(workflow, /expected_production_sha:/);
  assert.match(workflow, /production_backup_approval:/);
  assert.doesNotMatch(workflow, /\bpush:|\bpull_request:|\bschedule:/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment:\s*\n\s*name: production/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(
    workflow,
    /concurrency:\s*\n\s*group: production-vps-mutation\s*\n\s*cancel-in-progress: false/,
  );
});

test("production backup proof pins reviewed helpers to the dispatched main commit", () => {
  assert.match(
    workflow,
    /uses: actions\/checkout@v4\s*\n\s*with:\s*\n\s*ref: \$\{\{ github\.sha \}\}\s*\n\s*persist-credentials: false/,
  );
  assert.match(
    workflow,
    /sha256sum backup-crypto\.mjs backup-postgres\.sh rehearse-backup-restore\.sh/,
  );
  assert.match(workflow, /sha256sum -c reviewed-helpers\.sha256/);
  assert.match(workflow, /PRODUCTION_BACKUP_REVIEWED_HELPER_INVALID/);
});

test("production backup proof binds approval to canonical live and proof SHAs", () => {
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /PROOF_COMMIT_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(
    workflow,
    /APPROVE_PRODUCTION_BACKUP_RESTORE_PROOF_\$\{EXPECTED_PRODUCTION_SHA\}_WITH_\$\{PROOF_COMMIT_SHA\}/,
  );
  assert.match(workflow, /PRODUCTION_BACKUP_APPROVAL_BINDS_LIVE_AND_PROOF_SHA/);
  assert.match(workflow, /PRODUCTION_BACKUP_APPROVAL_MISMATCH/);
  assert.match(workflow, /PRODUCTION_BACKUP_INPUTS_INVALID/);
});

test("production backup transport is host-key pinned on every SSH and SCP command", () => {
  const remoteLines = workflow
    .split("\n")
    .filter((line) => /\b(?:ssh|scp) -/.test(line));

  assert(remoteLines.length >= 6);
  for (const line of remoteLines) {
    assert.match(line, /-i ~\/\.ssh\/oasis_production_vps/);
    assert.match(line, /-o BatchMode=yes/);
    assert.match(line, /-o StrictHostKeyChecking=yes/);
    assert.match(line, /-o UserKnownHostsFile=~\/\.ssh\/known_hosts/);
    assert.match(line, /-o IdentitiesOnly=yes/);
    assert.match(line, /-o ConnectTimeout=10/);
  }
  assert.match(workflow, /OASIS_PRODUCTION_VPS_HOST/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_USER/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_SSH_KEY/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_KNOWN_HOSTS/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_HOST.*\^\[A-Za-z0-9\]/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_USER.*\^\[A-Za-z_\]/);
  assert.doesNotMatch(
    workflow,
    /ssh-keyscan|\bOASIS_VPS_HOST\b|\bOASIS_VPS_USER\b/,
  );
});

test("production identity and healthy postgres are proven before backup creation", () => {
  const marker = indexOfRequired("/etc/oasis/production-deploy-target-class");
  const shaProof = indexOfRequired("PRODUCTION_CODE_SHA_OK");
  const postgresProof = indexOfRequired("PRODUCTION_POSTGRES_UNHEALTHY");
  const backupCall = workflow.lastIndexOf('"$helper_dir/backup-postgres.sh"');
  assert.notEqual(backupCall, -1);

  assert(marker < shaProof);
  assert(shaProof < postgresProof);
  assert(postgresProof < backupCall);
  assert.match(
    workflow,
    /current_sha.*git --no-replace-objects rev-parse HEAD/,
  );
  assert.match(workflow, /git status --porcelain --untracked-files=no/);
  assert.match(workflow, /docker inspect --format/);
});

test("production proof requires synthetic-only classification and the deploy host lock", () => {
  const lock = indexOfRequired("oasis-deploy/production-vps-mutation.lock");
  const dataClass = indexOfRequired("PRODUCTION_DATA_CLASS_SYNTHETIC_ONLY");
  const shaProof = indexOfRequired("PRODUCTION_CODE_SHA_OK");
  const backupCall = workflow.lastIndexOf('"$helper_dir/backup-postgres.sh"');

  assert(lock < dataClass);
  assert(lock < shaProof);
  assert(lock < backupCall);
  assert.match(workflow, /\/etc\/oasis\/controlled-data-class/);
  assert.match(workflow, /= 0:0:600/);
  assert.match(workflow, /= synthetic-only/);
  assert.doesNotMatch(workflow, /oasis-production-backup-proof\.lock/);
});

test("durable production key and archive are regular root-only files", () => {
  assert.match(workflow, /remote_key_file="\/etc\/oasis\/oasis-backup\.key"/);
  assert.match(workflow, /openssl rand -hex 32/);
  assert.match(workflow, /ln "\$temporary_key" "\$key_file"/);
  assert.match(workflow, /stat -c '%u:%g:%a'.*= 0:0:600/);
  assert.match(
    workflow,
    /if \[ -e "\$directory" \] \|\| \[ -L "\$directory" \]; then[\s\S]*else[\s\S]*install -d -m 0700 "\$directory"/,
  );
  assert.match(
    workflow,
    /stat -c '%u:%g:%a' "\$directory".*= 0:0:700.*PRODUCTION_BACKUP_STORAGE_INVALID/,
  );
  assert.match(workflow, /ensure_private_directory \/etc\/oasis/);
  assert.match(workflow, /ensure_private_directory \/var\/backups\/oasis/);
  assert.match(workflow, /validate-key "\$key_file"/);
  assert.match(workflow, /PRODUCTION_BACKUP_KEY_READY/);
  assert.match(workflow, /PRODUCTION_BACKUP_ARCHIVE_READY/);
  assert.match(workflow, /verify "\$key_file" "\$backup_file"/);
  assert.doesNotMatch(workflow, /chmod 0?777|chmod 0?666/);
});

test("backup is encrypted without writing or transporting a plaintext dump", () => {
  assert.match(workflow, /BACKUP_ENCRYPTION_KEY_FILE="\$key_file"/);
  assert.match(workflow, /BACKUP_FILE="\$backup_file"/);
  assert.match(workflow, /BACKUP_CREATED_ENCRYPTED/);
  assert.doesNotMatch(workflow, /pg_dump|pg_restore/);
  assert.doesNotMatch(workflow, /upload-artifact|download-artifact/);
});

test("only the encrypted archive and checksum leave the production trust boundary", () => {
  const backupRetrieval = indexOfRequired(
    '$remote_backup_file" "$local_backup"',
  );
  const manifestRetrieval = indexOfRequired(
    '$remote_helper_dir/retrieval.sha256" "$local_manifest"',
  );
  const cleanup = workflow.lastIndexOf(
    'rm -f "$local_backup" "$local_manifest"',
  );

  assert(backupRetrieval < manifestRetrieval);
  assert(manifestRetrieval < cleanup);
  assert.match(workflow, /private_dir="\$\(mktemp -d\)"/);
  assert.match(workflow, /umask 077/);
  assert.match(workflow, /sha256sum -c retrieval\.sha256/);
  assert.match(workflow, /PRODUCTION_BACKUP_RETRIEVED_VERIFIED/);
  assert.match(workflow, /PRODUCTION_BACKUP_EPHEMERAL_MATERIAL_DESTROYED/);
  assert.doesNotMatch(workflow, /\$remote_key_file" "\$local/);
  assert.doesNotMatch(workflow, /local_key=/);
});

test("disposable restore requires all authentication query and destruction markers", () => {
  for (const marker of [
    "ENCRYPTED_BACKUP_AUTHENTICATED",
    "DISPOSABLE_POSTGRES_READY",
    "DISPOSABLE_RESTORE_COMPLETE",
    "DISPOSABLE_RESTORE_QUERY_OK",
    "DISPOSABLE_RESTORE_DESTROYED",
  ]) {
    assert.match(workflow, new RegExp(marker));
  }
  assert.match(workflow, /PRODUCTION_BACKUP_RESTORE_PROOF_PASS/);
  assert.match(workflow, /PRODUCTION_BACKUP_DISPOSABLE_RESTORE_FAILED/);
  assert.match(workflow, /PRODUCTION_BACKUP_REHEARSAL_OUTPUT_INVALID/);
});

test("production archive capacity and retention are bounded", () => {
  const capacity = indexOfRequired("PRODUCTION_BACKUP_CAPACITY_OK");
  const backupCall = workflow.lastIndexOf('"$helper_dir/backup-postgres.sh"');
  const retrieved = indexOfRequired("PRODUCTION_BACKUP_RETRIEVED_VERIFIED");
  const retention = indexOfRequired("PRODUCTION_BACKUP_RETENTION_READY");

  assert(capacity < backupCall);
  assert(retrieved < retention);
  assert(backupCall < retention);
  assert.match(workflow, /pg_database_size\(current_database\(\)\)/);
  assert.match(workflow, /database_bytes \* 2 \+ 1073741824/);
  assert.match(workflow, /oasis-production-latest\.dump\.enc/);
  assert.match(workflow, /oasis-production-previous\.dump\.enc/);
  assert.match(
    workflow,
    /remote_backup_file="\/var\/backups\/oasis\/\.proof-staging\/oasis-proof-/,
  );
  assert.match(
    workflow,
    /ensure_private_directory \/var\/backups\/oasis\/\.proof-staging/,
  );
  assert.match(workflow, /PRODUCTION_BACKUP_STAGED_READY/);
  assert.match(workflow, /<<'REMOTE_PROMOTION'/);
  assert.match(workflow, /PRODUCTION_BACKUP_CAPACITY_INSUFFICIENT/);
});

test("remote production proof shell is syntactically valid", () => {
  const runner = extractRun(
    "Create retrieve restore and destroy production backup proof",
  );
  const remoteProof = extractHeredoc(runner, "REMOTE_PROOF");
  const remotePromotion = extractHeredoc(runner, "REMOTE_PROMOTION");
  const syntax = spawnSync("/bin/bash", ["-n"], {
    encoding: "utf8",
    input: remoteProof,
  });
  assert.equal(syntax.status, 0, syntax.stderr);
  const promotionSyntax = spawnSync("/bin/bash", ["-n"], {
    encoding: "utf8",
    input: remotePromotion,
  });
  assert.equal(promotionSyntax.status, 0, promotionSyntax.stderr);
});

test("proof never deploys migrates restores production or mutates application records", () => {
  assert.doesNotMatch(
    workflow,
    /docker compose[^\n]*\b(?:up|build|restart|down)\b/,
  );
  assert.doesNotMatch(
    workflow,
    /restore-postgres|prisma migrate|migrate deploy|RUN_MIGRATIONS=true/i,
  );
  assert.doesNotMatch(
    workflow,
    /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP|ALTER TABLE)\b/i,
  );
  assert.doesNotMatch(workflow, /git checkout|git pull|git reset/);
});

test("proof suppresses diagnostics secrets paths and backup material", () => {
  assert.doesNotMatch(
    workflow,
    /cat .*diagnostic|cat deploy\/v2\/\.env|\bprintenv\b|set -x/,
  );
  assert.doesNotMatch(
    workflow,
    /DATABASE_URL|POSTGRES_PASSWORD|NEXTAUTH_SECRET|CLERK_SECRET_KEY/,
  );
  assert.doesNotMatch(workflow, /https?:\/\/|app\.oasis|api\.oasis/);
  assert.doesNotMatch(workflow, /echo "?\$OASIS_PRODUCTION/);
  assert.doesNotMatch(workflow, /printf '[^']*OASIS_PRODUCTION/);
  assert.doesNotMatch(
    workflow,
    /printf .*backup_file|echo .*backup_file|printf .*key_file|echo .*key_file/,
  );
});

test("remote proof creates restores rotates and fails closed on SHA mismatch", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "oasis-remote-backup-proof-"),
  );
  const repo = path.join(root, "repo");
  const etc = path.join(root, "etc", "oasis");
  const backups = path.join(root, "backups");
  const bin = path.join(root, "bin");
  const helperDir = "/tmp/oasis-backup-proof.RmT12345";
  const targetSha = "a".repeat(40);
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(helperDir, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.mkdirSync(etc, { recursive: true, mode: 0o700 });
  fs.chmodSync(etc, 0o700);
  fs.mkdirSync(backups, { recursive: true, mode: 0o700 });
  fs.chmodSync(backups, 0o700);
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(helperDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(etc, "production-deploy-target-class"),
    "production\n",
  );
  fs.writeFileSync(
    path.join(etc, "controlled-data-class"),
    "synthetic-only\n",
    {
      mode: 0o600,
    },
  );
  fs.mkdirSync(path.join(repo, "deploy", "v2"), { recursive: true });
  fs.writeFileSync(path.join(repo, "deploy", "v2", ".env"), "SYNTHETIC=true\n");
  fs.writeFileSync(
    path.join(repo, "deploy", "v2", "docker-compose.yml"),
    "services: {}\n",
  );
  fs.writeFileSync(
    path.join(helperDir, "reviewed-helpers.sha256"),
    "synthetic\n",
  );
  fs.writeFileSync(path.join(helperDir, "backup-crypto.mjs"), "export {};\n");
  writeExecutable(
    path.join(helperDir, "backup-postgres.sh"),
    `#!/bin/bash
set -euo pipefail
cat >/dev/null
printf 'synthetic encrypted archive\\n' > "$BACKUP_FILE"
chmod 0600 "$BACKUP_FILE"
printf 'BACKUP_ENCRYPTION_READY\\nBACKUP_CREATED_ENCRYPTED\\n'
`,
  );
  writeExecutable(
    path.join(helperDir, "rehearse-backup-restore.sh"),
    `#!/bin/bash
set -euo pipefail
cat >/dev/null
printf '%s\\n' \\
  ENCRYPTED_BACKUP_AUTHENTICATED \\
  DISPOSABLE_POSTGRES_READY \\
  DISPOSABLE_RESTORE_COMPLETE \\
  DISPOSABLE_RESTORE_QUERY_OK \\
  DISPOSABLE_RESTORE_DESTROYED
`,
  );
  writeExecutable(path.join(bin, "id"), "#!/bin/bash\nprintf '0\\n'\n");
  writeExecutable(
    path.join(bin, "git"),
    `#!/bin/bash
set -euo pipefail
case "$*" in
  *"rev-parse --git-common-dir"*) printf '.git\\n' ;;
  *"rev-parse HEAD"*) printf '${targetSha}\\n' ;;
  *"status --porcelain"*) : ;;
  *) exit 2 ;;
esac
`,
  );
  writeExecutable(
    path.join(bin, "stat"),
    `#!/bin/bash
set -euo pipefail
target="\${!#}"
if [[ -d "$target" ]]; then
  if [[ "\${BAD_STORAGE_OWNER:-false}" == true ]] && { [[ "$target" == "${etc}" ]] || [[ "$target" == "${backups}" ]]; }; then
    printf '1000:1000:700\\n'
    exit 0
  fi
  printf '0:0:700\\n'
else
  printf '0:0:600\\n'
fi
`,
  );
  writeExecutable(
    path.join(bin, "node"),
    "#!/bin/bash\nset -euo pipefail\nexit 0\n",
  );
  writeExecutable(
    path.join(bin, "docker"),
    `#!/bin/bash
set -euo pipefail
case "$*" in
  *" config --quiet"*) exit 0 ;;
  *" ps -q postgres"*) printf 'synthetic-postgres-container\\n' ;;
  *"inspect --format"*) printf 'healthy\\n' ;;
  *"exec synthetic-postgres-container sh -lc"*) printf '1024\\n' ;;
  *) exit 2 ;;
esac
`,
  );
  writeExecutable(
    path.join(bin, "df"),
    "#!/bin/bash\nprintf 'Filesystem 1-blocks Used Available Capacity Mounted on\\nsynthetic 20000000000 1 19999999999 1%% /\\n'\n",
  );
  writeExecutable(
    path.join(bin, "openssl"),
    "#!/bin/bash\nprintf '%064d\\n' 0\n",
  );
  writeExecutable(path.join(bin, "flock"), "#!/bin/bash\nexit 0\n");
  writeExecutable(
    path.join(bin, "sha256sum"),
    `#!/bin/bash
set -euo pipefail
if [[ "\${1:-}" == -c ]]; then exit 0; fi
printf '%064d  %s\\n' 0 "\${1:-synthetic}"
`,
  );

  const runner = extractRun(
    "Create retrieve restore and destroy production backup proof",
  );
  const remoteProof = extractHeredoc(runner, "REMOTE_PROOF")
    .replaceAll("/opt/oasis-care", repo)
    .replaceAll("/etc/oasis", etc)
    .replaceAll("/var/backups/oasis", backups);
  const remotePromotion = extractHeredoc(runner, "REMOTE_PROMOTION")
    .replaceAll("/opt/oasis-care", repo)
    .replaceAll("/etc/oasis", etc)
    .replaceAll("/var/backups/oasis", backups);
  const keyFile = path.join(etc, "oasis-backup.key");
  const retrievalFile = path.join(backups, "oasis-production-latest.dump.enc");
  const backupFile = path.join(
    backups,
    ".proof-staging",
    "oasis-proof-12345-1.dump.enc",
  );
  const success = spawnSync(
    "/bin/bash",
    [
      "-c",
      remoteProof,
      "remote-proof",
      targetSha,
      helperDir,
      backupFile,
      keyFile,
      retrievalFile,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    },
  );
  assert.equal(success.status, 0, success.stderr || success.stdout);
  assert.match(success.stdout, /PRODUCTION_DATA_CLASS_SYNTHETIC_ONLY/);
  assert.match(success.stdout, /PRODUCTION_BACKUP_CAPACITY_OK/);
  assert.match(success.stdout, /DISPOSABLE_RESTORE_DESTROYED/);
  assert.match(success.stdout, /PRODUCTION_BACKUP_STAGED_READY/);
  assert.equal(fs.existsSync(backupFile), true);
  assert.equal(fs.existsSync(retrievalFile), false);
  assert.equal(fs.existsSync(keyFile), true);
  assert.equal(fs.existsSync(path.join(helperDir, "retrieval.sha256")), true);
  fs.rmSync(path.join(helperDir, "retrieval.sha256"));

  const streamedBackupFile = path.join(
    backups,
    ".proof-staging",
    "oasis-proof-12345-3.dump.enc",
  );
  const streamed = spawnSync(
    "/bin/bash",
    [
      "-se",
      "--",
      targetSha,
      helperDir,
      streamedBackupFile,
      keyFile,
      retrievalFile,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
      input: remoteProof,
    },
  );
  assert.equal(streamed.status, 0, streamed.stderr || streamed.stdout);
  assert.match(streamed.stdout, /PRODUCTION_BACKUP_STAGED_READY/);
  assert.equal(fs.existsSync(streamedBackupFile), true);
  fs.rmSync(streamedBackupFile);

  const promotion = spawnSync(
    "/bin/bash",
    [
      "-c",
      remotePromotion,
      "remote-promotion",
      "promote",
      targetSha,
      helperDir,
      backupFile,
      keyFile,
      retrievalFile,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    },
  );
  assert.equal(promotion.status, 0, promotion.stderr || promotion.stdout);
  assert.equal(promotion.stdout, "PRODUCTION_BACKUP_RETENTION_READY\n");
  assert.equal(fs.existsSync(backupFile), false);
  assert.equal(fs.existsSync(retrievalFile), true);

  const wrongStorageOwner = spawnSync(
    "/bin/bash",
    [
      "-c",
      remoteProof,
      "remote-proof",
      targetSha,
      helperDir,
      backupFile,
      keyFile,
      retrievalFile,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        BAD_STORAGE_OWNER: "true",
        PATH: `${bin}:/usr/bin:/bin`,
      },
    },
  );
  assert.notEqual(wrongStorageOwner.status, 0);
  assert.match(wrongStorageOwner.stderr, /PRODUCTION_BACKUP_STORAGE_INVALID/);

  const mismatchFile = path.join(
    backups,
    ".proof-staging",
    "oasis-proof-12345-2.dump.enc",
  );
  const mismatch = spawnSync(
    "/bin/bash",
    [
      "-c",
      remoteProof,
      "remote-proof",
      "b".repeat(40),
      helperDir,
      mismatchFile,
      keyFile,
      retrievalFile,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
    },
  );
  assert.equal(mismatch.status, 1, mismatch.stdout + mismatch.stderr);
  assert.match(mismatch.stderr, /PRODUCTION_CODE_SHA_MISMATCH/);
  assert.equal(fs.existsSync(mismatchFile), false);
});

test("proof runner completes the allowlisted retrieval restore and cleanup contract", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "oasis-production-backup-workflow-"),
  );
  const workspace = path.join(root, "workspace");
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const scripts = path.join(workspace, "deploy", "v2", "scripts");
  const transferLog = path.join(root, "transfer.log");
  const cleanupLog = path.join(root, "cleanup.log");
  const promotionLog = path.join(root, "promotion.log");
  const targetSha = "a".repeat(40);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(home, ".ssh"), { recursive: true });
  fs.mkdirSync(scripts, { recursive: true });

  writeExecutable(
    path.join(bin, "ssh"),
    `#!/bin/bash
set -euo pipefail
/bin/cat >/dev/null || true
case "$*" in
  *"mktemp -d /tmp/oasis-backup-proof.XXXXXXXX"*)
    printf '/tmp/oasis-backup-proof.Ab12Cd34\\n'
    ;;
  *"promote ${targetSha}"*)
    printf 'PROMOTION\\n' >> "$PROMOTION_LOG"
    printf 'PRODUCTION_BACKUP_RETENTION_READY\\n'
    ;;
  *"${targetSha}"*)
    printf '%s\\n' \\
      DEPLOY_TARGET_PRODUCTION \\
      PRODUCTION_DATA_CLASS_SYNTHETIC_ONLY \\
      PRODUCTION_CODE_SHA_OK \\
      PRODUCTION_BACKUP_KEY_READY \\
      PRODUCTION_BACKUP_CAPACITY_OK \\
      BACKUP_CREATED_ENCRYPTED \\
      PRODUCTION_BACKUP_ARCHIVE_READY \\
      ENCRYPTED_BACKUP_AUTHENTICATED \\
      DISPOSABLE_POSTGRES_READY \\
      DISPOSABLE_RESTORE_COMPLETE \\
      DISPOSABLE_RESTORE_QUERY_OK \\
      DISPOSABLE_RESTORE_DESTROYED \\
      PRODUCTION_BACKUP_STAGED_READY
    ;;
  *"/tmp/oasis-backup-proof.Ab12Cd34 /var/backups/oasis/.proof-staging/oasis-proof-"*)
    printf 'CLEANUP\\n' >> "$CLEANUP_LOG"
    ;;
esac
`,
  );
  writeExecutable(
    path.join(bin, "scp"),
    `#!/bin/bash
set -euo pipefail
destination="\${!#}"
case "$*" in
  *":/var/backups/oasis/.proof-staging/oasis-proof-"*)
    printf 'synthetic encrypted archive\\n' > "$destination"
    printf 'DOWNLOAD %s\\n' "$destination" >> "$TRANSFER_LOG"
    ;;
  *":/tmp/oasis-backup-proof.Ab12Cd34/retrieval.sha256"*)
    if [[ "\${FAIL_MANIFEST:-false}" == true ]]; then
      exit 1
    fi
    printf '%064d  production.dump.enc\\n' 0 > "$destination"
    printf 'DOWNLOAD %s\\n' "$destination" >> "$TRANSFER_LOG"
    ;;
esac
`,
  );
  writeExecutable(
    path.join(bin, "sha256sum"),
    `#!/bin/bash
set -euo pipefail
if [[ "\${1:-}" == -c ]]; then
  exit 0
fi
for file in "$@"; do
  printf '%064d  %s\\n' 0 "$file"
done
`,
  );
  fs.writeFileSync(path.join(scripts, "backup-crypto.mjs"), "export {};\n");
  writeExecutable(
    path.join(scripts, "backup-postgres.sh"),
    "#!/bin/bash\nexit 0\n",
  );
  writeExecutable(
    path.join(scripts, "rehearse-backup-restore.sh"),
    `#!/bin/bash
set -euo pipefail
printf '%s\\n' \\
  ENCRYPTED_BACKUP_AUTHENTICATED \\
  DISPOSABLE_POSTGRES_READY \\
  DISPOSABLE_RESTORE_COMPLETE \\
  DISPOSABLE_RESTORE_QUERY_OK \\
  DISPOSABLE_RESTORE_DESTROYED
`,
  );

  const result = spawnSync(
    "/bin/bash",
    [
      "-c",
      extractRun("Create retrieve restore and destroy production backup proof"),
    ],
    {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        EXPECTED_PRODUCTION_SHA: targetSha,
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_RUN_ID: "12345",
        GITHUB_WORKSPACE: workspace,
        HOME: home,
        CLEANUP_LOG: cleanupLog,
        OASIS_PRODUCTION_VPS_HOST: "production.invalid",
        OASIS_PRODUCTION_VPS_USER: "root",
        PATH: `${bin}:/usr/bin:/bin`,
        PROMOTION_LOG: promotionLog,
        TRANSFER_LOG: transferLog,
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(
    result.stdout,
    [
      "DEPLOY_TARGET_PRODUCTION",
      "PRODUCTION_DATA_CLASS_SYNTHETIC_ONLY",
      "PRODUCTION_CODE_SHA_OK",
      "PRODUCTION_BACKUP_KEY_READY",
      "PRODUCTION_BACKUP_CAPACITY_OK",
      "BACKUP_CREATED_ENCRYPTED",
      "PRODUCTION_BACKUP_ARCHIVE_READY",
      "ENCRYPTED_BACKUP_AUTHENTICATED",
      "DISPOSABLE_POSTGRES_READY",
      "DISPOSABLE_RESTORE_COMPLETE",
      "DISPOSABLE_RESTORE_QUERY_OK",
      "DISPOSABLE_RESTORE_DESTROYED",
      "PRODUCTION_BACKUP_STAGED_READY",
      "PRODUCTION_BACKUP_RETRIEVED_VERIFIED",
      "PRODUCTION_BACKUP_RETENTION_READY",
      "PRODUCTION_BACKUP_EPHEMERAL_MATERIAL_DESTROYED",
      "PRODUCTION_BACKUP_RESTORE_PROOF_PASS",
      "",
    ].join("\n"),
  );
  const downloadedPaths = fs
    .readFileSync(transferLog, "utf8")
    .trim()
    .split("\n")
    .map((line) => line.slice("DOWNLOAD ".length));
  assert.equal(downloadedPaths.length, 2);
  for (const downloadedPath of downloadedPaths) {
    assert.equal(fs.existsSync(downloadedPath), false);
  }
  assert.equal(fs.readFileSync(promotionLog, "utf8"), "PROMOTION\n");

  fs.writeFileSync(transferLog, "");
  const failed = spawnSync(
    "/bin/bash",
    [
      "-c",
      extractRun("Create retrieve restore and destroy production backup proof"),
    ],
    {
      cwd: workspace,
      encoding: "utf8",
      env: {
        ...process.env,
        CLEANUP_LOG: cleanupLog,
        EXPECTED_PRODUCTION_SHA: targetSha,
        FAIL_MANIFEST: "true",
        GITHUB_RUN_ATTEMPT: "2",
        GITHUB_RUN_ID: "12345",
        GITHUB_WORKSPACE: workspace,
        HOME: home,
        OASIS_PRODUCTION_VPS_HOST: "production.invalid",
        OASIS_PRODUCTION_VPS_USER: "root",
        PATH: `${bin}:/usr/bin:/bin`,
        PROMOTION_LOG: promotionLog,
        TRANSFER_LOG: transferLog,
      },
    },
  );
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stderr, /PRODUCTION_BACKUP_MANIFEST_RETRIEVAL_FAILED/);
  const failedDownload = fs
    .readFileSync(transferLog, "utf8")
    .trim()
    .slice("DOWNLOAD ".length);
  assert.equal(fs.existsSync(failedDownload), false);
  assert.equal(fs.readFileSync(promotionLog, "utf8"), "PROMOTION\n");
  assert.equal(
    fs.readFileSync(cleanupLog, "utf8").trim().split("\n").length,
    2,
  );
});
