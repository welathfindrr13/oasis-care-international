import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync(new URL('./secret-leak-prevention.yml', import.meta.url), 'utf8');
const codeowners = fs.readFileSync(new URL('../CODEOWNERS', import.meta.url), 'utf8');

test('scans pull request and push ranges without a manual trigger', () => {
  assert.match(workflow, /pull_request:\n\s+branches: \[main, develop\]/);
  assert.match(workflow, /push:\n\s+branches: \[main, develop\]/);
  assert.doesNotMatch(workflow, /workflow_dispatch|schedule:/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /timeout-minutes: 10/);
});

test('pins the scanner release, checksum and checkout action', () => {
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40} # v4\.2\.2/);
  assert.match(workflow, /GITLEAKS_VERSION: 8\.30\.1/);
  assert.match(workflow, /GITLEAKS_LINUX_X64_SHA256: [0-9a-f]{64}/);
  assert.match(workflow, /sha256sum --check --status/);
});

test('uses the redacting range wrapper and does not upload scanner reports', () => {
  assert.match(workflow, /check-secret-range\.mjs "\$GITLEAKS_PATH" "\$BASE_SHA" "\$HEAD_SHA"/);
  assert.match(workflow, /GITLEAKS_TEST_BINARY="\$GITLEAKS_PATH" node --test/);
  assert.doesNotMatch(workflow, /upload-artifact|sarif|GITLEAKS_ENABLE_COMMENTS/);
});

test('assigns code ownership to the workflow, wrapper, tests, and CODEOWNERS file', () => {
  assert.match(codeowners, /\/\.github\/CODEOWNERS @welathfindrr13/);
  assert.match(codeowners, /secret-leak-prevention\.yml @welathfindrr13/);
  assert.match(codeowners, /check-secret-range\.mjs @welathfindrr13/);
});
