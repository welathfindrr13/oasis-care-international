import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(new URL("./backup-crypto.mjs", import.meta.url));

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oasis-backup-crypto-"));
  const keyFile = path.join(directory, "backup.key");
  const encryptedFile = path.join(directory, "backup.dump.enc");
  fs.writeFileSync(keyFile, `${"ab".repeat(32)}\n`, { mode: 0o600 });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, encryptedFile, keyFile };
}

function run(args, options = {}) {
  return spawnSync(process.execPath, [helper, ...args], {
    encoding: Object.hasOwn(options, "encoding") ? options.encoding : "utf8",
    input: options.input,
  });
}

test("encrypts and decrypts a custom-format stream without plaintext at rest", (t) => {
  const { encryptedFile, keyFile } = fixture(t);
  const plaintext = Buffer.concat([
    Buffer.from("PGDMP synthetic custom archive\n"),
    Buffer.alloc(16 * 1024, 0x5a),
  ]);

  const encrypted = run(["encrypt", keyFile, encryptedFile], {
    encoding: null,
    input: plaintext,
  });
  assert.equal(encrypted.status, 0, encrypted.stderr?.toString());
  const ciphertext = fs.readFileSync(encryptedFile);
  assert.equal(ciphertext.includes(plaintext.subarray(0, 16)), false);
  assert.equal(fs.statSync(encryptedFile).mode & 0o777, 0o600);

  const decrypted = run(["decrypt", keyFile, encryptedFile], {
    encoding: null,
  });
  assert.equal(decrypted.status, 0, decrypted.stderr?.toString());
  assert.deepEqual(decrypted.stdout, plaintext);
});

test("rejects permissive key files before encryption", (t) => {
  const { encryptedFile, keyFile } = fixture(t);
  fs.chmodSync(keyFile, 0o644);

  const result = run(["encrypt", keyFile, encryptedFile], {
    input: "synthetic archive",
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "BACKUP_KEY_INVALID\n");
  assert.equal(fs.existsSync(encryptedFile), false);
});

test("wrong keys and modified ciphertext fail authenticated decryption", (t) => {
  const { directory, encryptedFile, keyFile } = fixture(t);
  const plaintext = "synthetic archive that must authenticate";
  assert.equal(
    run(["encrypt", keyFile, encryptedFile], { input: plaintext }).status,
    0,
  );

  const wrongKey = path.join(directory, "wrong.key");
  fs.writeFileSync(wrongKey, `${"cd".repeat(32)}\n`, { mode: 0o600 });
  const wrongKeyResult = run(["decrypt", wrongKey, encryptedFile]);
  assert.equal(wrongKeyResult.status, 1);
  assert.equal(wrongKeyResult.stdout, "");
  assert.equal(wrongKeyResult.stderr, "BACKUP_DECRYPTION_FAILED\n");

  const modified = fs.readFileSync(encryptedFile);
  modified[Math.floor(modified.length / 2)] ^= 0xff;
  fs.writeFileSync(encryptedFile, modified, { mode: 0o600 });
  const tamperedResult = run(["decrypt", keyFile, encryptedFile]);
  assert.equal(tamperedResult.status, 1);
  assert.equal(tamperedResult.stderr, "BACKUP_DECRYPTION_FAILED\n");
});

test("prepared restore session pins the archive without copying the key", (t) => {
  const { directory, encryptedFile, keyFile } = fixture(t);
  const sessionDirectory = path.join(directory, "restore-session");
  fs.mkdirSync(sessionDirectory, { mode: 0o700 });
  assert.equal(
    run(["encrypt", keyFile, encryptedFile], { input: "selected archive" }).status,
    0,
  );

  const prepared = run([
    "prepare",
    keyFile,
    encryptedFile,
    sessionDirectory,
  ]);
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.match(prepared.stdout, /^[0-9a-f]{64}\n$/);

  assert.equal(
    run(["encrypt", keyFile, encryptedFile], { input: "replacement archive" })
      .status,
    0,
  );

  const decrypted = run([
    "decrypt-pinned",
    keyFile,
    path.join(sessionDirectory, "archive.dump.enc"),
  ]);
  assert.equal(decrypted.status, 0, decrypted.stderr);
  assert.equal(decrypted.stdout, "selected archive");
  assert.deepEqual(fs.readdirSync(sessionDirectory), ["archive.dump.enc"]);

  fs.writeFileSync(keyFile, `${"cd".repeat(32)}\n`, { mode: 0o600 });
  const replacedKey = run([
    "decrypt-pinned",
    keyFile,
    path.join(sessionDirectory, "archive.dump.enc"),
  ]);
  assert.equal(replacedKey.status, 1);
  assert.equal(replacedKey.stdout, "");
  assert.equal(replacedKey.stderr, "BACKUP_DECRYPTION_FAILED\n");
});
