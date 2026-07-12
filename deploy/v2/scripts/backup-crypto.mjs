import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MAGIC_V1 = Buffer.from("OASISB1\n", "ascii");
const MAGIC_V2 = Buffer.from("OASISB2\n", "ascii");
const MAGIC_BYTES = MAGIC_V2.length;
const TIMESTAMP_BYTES = 8;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_PATTERN = /^[0-9a-f]{64}\n?$/;
const MIN_V1_ENCRYPTED_BYTES = MAGIC_BYTES + NONCE_BYTES + TAG_BYTES + 1;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function assertPrivateRegularFile(filePath, code) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    fail(code);
  }
  if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0) {
    fail(code);
  }
  return stat;
}

export function readEncryptionKey(keyFile) {
  assertPrivateRegularFile(keyFile, "BACKUP_KEY_INVALID");
  let handle;
  try {
    handle = fs.openSync(
      keyFile,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    const stat = fs.fstatSync(handle);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size < 64 || stat.size > 65) {
      fail("BACKUP_KEY_INVALID");
    }
    const encoded = fs.readFileSync(handle, "utf8");
    if (!KEY_PATTERN.test(encoded)) fail("BACKUP_KEY_INVALID");
    return Buffer.from(encoded.trim(), "hex");
  } catch (error) {
    if (error?.code === "BACKUP_KEY_INVALID") throw error;
    fail("BACKUP_KEY_INVALID");
  } finally {
    if (handle !== undefined) {
      try {
        fs.closeSync(handle);
      } catch {
        // The descriptor may already be closed after a read failure.
      }
    }
  }
}

function encryptionTransform(key, nonce, authenticatedHeader) {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(authenticatedHeader);
  return new TransformStreamAdapter(
    (chunk) => cipher.update(chunk),
    () => Buffer.concat([cipher.final(), cipher.getAuthTag()]),
  );
}

function decryptionTransform(key, nonce, tag, authenticatedHeader) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  if (authenticatedHeader) decipher.setAAD(authenticatedHeader);
  decipher.setAuthTag(tag);
  return new TransformStreamAdapter(
    (chunk) => decipher.update(chunk),
    () => decipher.final(),
  );
}

class TransformStreamAdapter extends Transform {
  constructor(transformChunk, flush) {
    super();
    this.transformChunk = transformChunk;
    this.flushTransform = flush;
  }

  _transform(chunk, _encoding, callback) {
    try {
      callback(null, this.transformChunk(chunk));
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    try {
      callback(null, this.flushTransform());
    } catch (error) {
      callback(error);
    }
  }
}

export async function encryptStream({
  input,
  keyFile,
  outputFile,
  createdAtMs = Date.now(),
}) {
  const key = readEncryptionKey(keyFile);
  if (!Number.isSafeInteger(createdAtMs) || createdAtMs <= 0) {
    fail("BACKUP_ENCRYPTION_FAILED");
  }
  const createdAtSeconds = Math.floor(createdAtMs / 1000);
  if (createdAtSeconds <= 0) fail("BACKUP_ENCRYPTION_FAILED");
  const timestamp = Buffer.alloc(TIMESTAMP_BYTES);
  timestamp.writeBigUInt64BE(BigInt(createdAtSeconds));
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const authenticatedHeader = Buffer.concat([MAGIC_V2, timestamp, nonce]);
  const output = fs.createWriteStream(outputFile, {
    flags: "w",
    mode: 0o600,
  });
  output.write(authenticatedHeader);
  try {
    await pipeline(
      input,
      encryptionTransform(key, nonce, authenticatedHeader),
      output,
    );
    fs.chmodSync(outputFile, 0o600);
  } catch {
    try {
      fs.rmSync(outputFile, { force: true });
    } catch {
      // The caller still fails closed if cleanup cannot complete.
    }
    fail("BACKUP_ENCRYPTION_FAILED");
  }
}

async function decryptOnce({ inputFile, key, output }) {
  assertPrivateRegularFile(inputFile, "ENCRYPTED_BACKUP_INVALID");
  let handle;
  try {
    handle = fs.openSync(
      inputFile,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
  } catch {
    fail("ENCRYPTED_BACKUP_INVALID");
  }
  const stat = fs.fstatSync(handle);
  if (!stat.isFile() || stat.size < MIN_V1_ENCRYPTED_BYTES) {
    fs.closeSync(handle);
    fail("ENCRYPTED_BACKUP_INVALID");
  }
  const magic = Buffer.alloc(MAGIC_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    fs.readSync(handle, magic, 0, magic.length, 0);
    fs.readSync(handle, tag, 0, tag.length, stat.size - TAG_BYTES);
  } catch {
    fs.closeSync(handle);
    fail("ENCRYPTED_BACKUP_INVALID");
  }
  let headerLength;
  let formatVersion;
  if (magic.equals(MAGIC_V2)) {
    headerLength = MAGIC_BYTES + TIMESTAMP_BYTES + NONCE_BYTES;
    formatVersion = 2;
  } else if (magic.equals(MAGIC_V1)) {
    headerLength = MAGIC_BYTES + NONCE_BYTES;
    formatVersion = 1;
  } else {
    fs.closeSync(handle);
    fail("ENCRYPTED_BACKUP_INVALID");
  }
  if (stat.size < headerLength + TAG_BYTES + 1) {
    fs.closeSync(handle);
    fail("ENCRYPTED_BACKUP_INVALID");
  }

  const header = Buffer.alloc(headerLength);
  try {
    fs.readSync(handle, header, 0, header.length, 0);
  } catch {
    fs.closeSync(handle);
    fail("ENCRYPTED_BACKUP_INVALID");
  }

  let createdAtMs = null;
  let nonceOffset = MAGIC_BYTES;
  let authenticatedHeader = null;
  if (formatVersion === 2) {
    const createdAtSeconds = header.readBigUInt64BE(MAGIC_BYTES);
    if (createdAtSeconds > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1000))) {
      fs.closeSync(handle);
      fail("ENCRYPTED_BACKUP_INVALID");
    }
    createdAtMs = Number(createdAtSeconds) * 1000;
    nonceOffset += TIMESTAMP_BYTES;
    authenticatedHeader = header;
  }

  const nonce = header.subarray(nonceOffset, nonceOffset + NONCE_BYTES);
  const encrypted = fs.createReadStream(null, {
    fd: handle,
    autoClose: true,
    start: header.length,
    end: stat.size - TAG_BYTES - 1,
  });
  try {
    await pipeline(
      encrypted,
      decryptionTransform(key, nonce, tag, authenticatedHeader),
      output,
    );
  } catch {
    fail("BACKUP_DECRYPTION_FAILED");
  }
  return { formatVersion, createdAtMs };
}

export async function verifyEncryptedFile({ inputFile, keyFile }) {
  const key = readEncryptionKey(keyFile);
  return verifyEncryptedFileWithKey({ inputFile, key });
}

async function verifyEncryptedFileWithKey({ inputFile, key }) {
  return decryptOnce({
    inputFile,
    key,
    output: new Writable({ write(_chunk, _encoding, callback) { callback(); } }),
  });
}

export async function readAuthenticatedBackupMetadata({ inputFile, keyFile }) {
  return verifyEncryptedFile({ inputFile, keyFile });
}

async function createEncryptedSnapshot(inputFile) {
  const sourceStat = assertPrivateRegularFile(
    inputFile,
    "ENCRYPTED_BACKUP_INVALID",
  );
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "oasis-encrypted-restore-"),
  );
  fs.chmodSync(directory, 0o700);
  const snapshotFile = path.join(directory, "archive.dump.enc");
  let sourceHandle;
  try {
    sourceHandle = fs.openSync(
      inputFile,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    const openedStat = fs.fstatSync(sourceHandle);
    if (!openedStat.isFile() || openedStat.size !== sourceStat.size) {
      fs.closeSync(sourceHandle);
      fail("ENCRYPTED_BACKUP_INVALID");
    }
    await pipeline(
      fs.createReadStream(null, { fd: sourceHandle, autoClose: true }),
      fs.createWriteStream(snapshotFile, { flags: "wx", mode: 0o600 }),
    );
    if (fs.statSync(snapshotFile).size !== openedStat.size) {
      fail("ENCRYPTED_BACKUP_INVALID");
    }
    return { directory, snapshotFile };
  } catch (error) {
    if (sourceHandle !== undefined) {
      try {
        fs.closeSync(sourceHandle);
      } catch {
        // The stream may already have closed the descriptor.
      }
    }
    fs.rmSync(directory, { recursive: true, force: true });
    if (error?.code === "ENCRYPTED_BACKUP_INVALID") throw error;
    fail("ENCRYPTED_BACKUP_INVALID");
  }
}

export async function decryptStream({ inputFile, keyFile, output }) {
  // Pin the selected ciphertext in a private snapshot, then authenticate that
  // exact object before any plaintext reaches pg_restore or another consumer.
  const { directory, snapshotFile } = await createEncryptedSnapshot(inputFile);
  const key = readEncryptionKey(keyFile);
  try {
    await verifyEncryptedFileWithKey({ inputFile: snapshotFile, key });
    await decryptOnce({ inputFile: snapshotFile, key, output });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function digestFile(inputFile) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(inputFile), hash);
  return hash.digest("hex");
}

export async function prepareRestoreSession({ inputFile, keyFile, sessionDirectory }) {
  const sessionStat = assertPrivateRegularDirectory(sessionDirectory);
  if ((sessionStat.mode & 0o077) !== 0 || fs.readdirSync(sessionDirectory).length !== 0) {
    fail("RESTORE_SESSION_INVALID");
  }
  const key = readEncryptionKey(keyFile);
  const { directory, snapshotFile } = await createEncryptedSnapshot(inputFile);
  const sessionArchive = path.join(sessionDirectory, "archive.dump.enc");
  try {
    await verifyEncryptedFileWithKey({ inputFile: snapshotFile, key });
    fs.copyFileSync(snapshotFile, sessionArchive, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(sessionArchive, 0o600);
    return await digestFile(sessionArchive);
  } catch (error) {
    try {
      fs.rmSync(sessionArchive, { force: true });
    } catch {
      // The session remains fail-closed if cleanup cannot complete.
    }
    throw error;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function assertPrivateRegularDirectory(directory) {
  let stat;
  try {
    stat = fs.lstatSync(directory);
  } catch {
    fail("RESTORE_SESSION_INVALID");
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    fail("RESTORE_SESSION_INVALID");
  }
  return stat;
}

async function decryptPinned({ inputFile, keyFile, output }) {
  const key = readEncryptionKey(keyFile);
  await verifyEncryptedFileWithKey({ inputFile, key });
  await decryptOnce({ inputFile, key, output });
}

async function main() {
  const [command, keyFile, inputFile, sessionDirectory] = process.argv.slice(2);
  if (command === "validate-key" && keyFile && !inputFile) {
    readEncryptionKey(keyFile);
    return;
  }
  if (command === "encrypt" && keyFile && inputFile) {
    await encryptStream({ input: process.stdin, keyFile, outputFile: inputFile });
    return;
  }
  if (command === "verify" && keyFile && inputFile) {
    await verifyEncryptedFile({ inputFile, keyFile });
    return;
  }
  if (command === "decrypt" && keyFile && inputFile) {
    await decryptStream({ inputFile, keyFile, output: process.stdout });
    return;
  }
  if (command === "prepare" && keyFile && inputFile && sessionDirectory) {
    const digest = await prepareRestoreSession({
      inputFile,
      keyFile,
      sessionDirectory,
    });
    process.stdout.write(`${digest}\n`);
    return;
  }
  if (command === "decrypt-pinned" && keyFile && inputFile && !sessionDirectory) {
    await decryptPinned({ inputFile, keyFile, output: process.stdout });
    return;
  }
  fail("BACKUP_CRYPTO_USAGE_INVALID");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const allowed = new Set([
      "BACKUP_KEY_INVALID",
      "ENCRYPTED_BACKUP_INVALID",
      "BACKUP_ENCRYPTION_FAILED",
      "BACKUP_DECRYPTION_FAILED",
      "BACKUP_CRYPTO_USAGE_INVALID",
      "RESTORE_SESSION_INVALID",
    ]);
    const code = allowed.has(error?.code) ? error.code : "BACKUP_CRYPTO_FAILED";
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
