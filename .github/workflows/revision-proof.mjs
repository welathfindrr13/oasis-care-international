import { pathToFileURL } from 'node:url';

export const REVISION_AWARE_EXACT = 'REVISION_AWARE_EXACT';
export const LEGACY_UNKNOWN = 'LEGACY_UNKNOWN';
export const REVISION_UNSAFE = 'REVISION_UNSAFE';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const MAX_BODY_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

export function isCanonicalSha(value) {
  return typeof value === 'string' && SHA_PATTERN.test(value);
}

export function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('invalid base URL');
  }

  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash ||
    url.port ||
    !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(url.hostname) ||
    (value !== url.origin && value !== `${url.origin}/`)
  ) {
    throw new Error('invalid base URL');
  }

  return url;
}

function revisionKind(value) {
  if (
    value == null ||
    (typeof value === 'string' &&
      (value.trim() === '' || value.trim().toLowerCase() === 'unknown'))
  ) {
    return { kind: 'legacy' };
  }

  if (isCanonicalSha(value)) {
    return { kind: 'exact', sha: value };
  }

  return { kind: 'unsafe' };
}

export function classifyRevisionPayloads(apiPayload, webPayload) {
  if (
    !isPlainObject(apiPayload) ||
    !isPlainObject(webPayload) ||
    apiPayload.status !== 'ok' ||
    webPayload.status !== 'ok'
  ) {
    return { classification: REVISION_UNSAFE };
  }

  const api = revisionKind(apiPayload.commitSha);
  const web = revisionKind(webPayload.commitSha);
  if (api.kind === 'legacy' && web.kind === 'legacy') {
    return { classification: LEGACY_UNKNOWN };
  }
  if (api.kind === 'exact' && web.kind === 'exact' && api.sha === web.sha) {
    return { classification: REVISION_AWARE_EXACT, sha: api.sha };
  }
  return { classification: REVISION_UNSAFE };
}

export function readyPayloadMatches(payload, expectedRevision) {
  if (
    !isPlainObject(payload) ||
    payload.status !== 'ready' ||
    !isPlainObject(payload.checks) ||
    payload.checks.database !== 'ok'
  ) {
    return false;
  }

  if (expectedRevision === LEGACY_UNKNOWN) {
    return revisionKind(payload.commitSha).kind === 'legacy';
  }
  return isCanonicalSha(expectedRevision) && payload.commitSha === expectedRevision;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function readBoundedJson(response) {
  if (response.status !== 200) {
    throw new Error('unsafe response');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new Error('unsafe response');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('unsafe response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('unsafe response');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  const parsed = JSON.parse(text);
  if (!isPlainObject(parsed)) {
    throw new Error('unsafe response');
  }
  return parsed;
}

async function fetchPayload(fetchImpl, url) {
  const response = await fetchImpl(url, {
    redirect: 'manual',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return readBoundedJson(response);
}

export async function verifyRevision({ mode, baseUrl, targetSha, fetchImpl = fetch }) {
  try {
    const base = normalizeBaseUrl(baseUrl);
    if (mode !== 'bootstrap_legacy' && mode !== 'target_exact' && mode !== 'rollback_legacy') {
      return REVISION_UNSAFE;
    }
    if ((mode === 'target_exact' || mode === 'rollback_legacy') && !isCanonicalSha(targetSha)) {
      return REVISION_UNSAFE;
    }

    const apiUrl = new URL('/health', base);
    const webUrl = new URL('/api/health', base);
    const readyUrl = new URL('/ready', base);
    const [apiPayload, webPayload, readyPayload] = await Promise.all([
      fetchPayload(fetchImpl, apiUrl),
      fetchPayload(fetchImpl, webUrl),
      fetchPayload(fetchImpl, readyUrl),
    ]);

    const pair = classifyRevisionPayloads(apiPayload, webPayload);
    if (mode === 'target_exact') {
      return pair.classification === REVISION_AWARE_EXACT &&
        pair.sha === targetSha &&
        readyPayloadMatches(readyPayload, targetSha)
        ? REVISION_AWARE_EXACT
        : REVISION_UNSAFE;
    }

    if (
      pair.classification === LEGACY_UNKNOWN &&
      readyPayloadMatches(readyPayload, LEGACY_UNKNOWN)
    ) {
      return LEGACY_UNKNOWN;
    }
    if (
      mode === 'rollback_legacy' &&
      pair.classification === REVISION_AWARE_EXACT &&
      pair.sha === targetSha &&
      readyPayloadMatches(readyPayload, targetSha)
    ) {
      return REVISION_AWARE_EXACT;
    }
    return REVISION_UNSAFE;
  } catch {
    return REVISION_UNSAFE;
  }
}

async function main() {
  const mode = process.argv[2] || '';
  const result = await verifyRevision({
    mode,
    baseUrl: process.env.OASIS_PRODUCTION_APP_URL,
    targetSha: process.env.TARGET_SHA,
  });
  process.stdout.write(`${result}\n`);
  process.exitCode =
    (mode === 'target_exact' && result === REVISION_AWARE_EXACT) ||
    (mode === 'bootstrap_legacy' && result === LEGACY_UNKNOWN) ||
    (mode === 'rollback_legacy' && (result === LEGACY_UNKNOWN || result === REVISION_AWARE_EXACT))
      ? 0
      : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
