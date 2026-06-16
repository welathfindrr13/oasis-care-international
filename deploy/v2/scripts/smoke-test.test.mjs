import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync(new URL('./smoke-test.sh', import.meta.url), 'utf8');

test('smoke test uses strict TLS by default', () => {
  assert.doesNotMatch(script, /curl\s+-k\b/);
  assert.match(script, /ALLOW_INSECURE_TLS/);
  assert.match(script, /CURL_TLS_ARGS=\(\)/);
});

test('insecure TLS mode is explicit and labelled as invalid proof', () => {
  assert.match(script, /CURL_TLS_ARGS=\(--insecure\)/);
  assert.match(script, /not valid HTTPS\/domain proof/);
});
