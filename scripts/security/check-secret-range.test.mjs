import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptPath = new URL('./check-secret-range.mjs', import.meta.url).pathname;

test('forces full redaction and rejects inline scanner suppressions', () => {
  const source = readFileSync(scriptPath, 'utf8');
  assert.match(source, /'--redact=100'/);
  assert.match(source, /'--ignore-gitleaks-allow'/);
  assert.match(source, /'--config',[\s\S]+trustedConfigPath/);
  assert.match(source, /'--gitleaks-ignore-path',[\s\S]+trustedIgnorePath/);
  assert.match(source, /'--diff-filter=AMT'/);
  assert.doesNotMatch(source, /report-path[^\n]+\.json/);
});

function run(command, args, cwd, options = {}) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', ...options });
}

function initializeRepository() {
  const directory = mkdtempSync(path.join(tmpdir(), 'oasis-secret-range-'));
  assert.equal(run('git', ['init', '-q'], directory).status, 0);
  assert.equal(run('git', ['config', 'user.email', 'security-test@example.invalid'], directory).status, 0);
  assert.equal(run('git', ['config', 'user.name', 'Security Test'], directory).status, 0);
  return directory;
}

function commitAll(directory, message) {
  assert.equal(run('git', ['add', '-A'], directory).status, 0);
  assert.equal(run('git', ['commit', '-qm', message], directory).status, 0);
  return run('git', ['rev-parse', 'HEAD'], directory).stdout.trim();
}

function fixtureRepository() {
  const directory = initializeRepository();
  writeFileSync(path.join(directory, 'baseline.txt'), 'baseline\n');
  const base = commitAll(directory, 'baseline');
  writeFileSync(path.join(directory, 'change.txt'), 'safe change\n');
  const head = commitAll(directory, 'change');
  return { directory, base, head };
}

function fakeScanner(directory, body) {
  const scanner = path.join(directory, 'fake-gitleaks');
  writeFileSync(scanner, `#!/usr/bin/env node\n${body}\n`);
  chmodSync(scanner, 0o700);
  return scanner;
}

test('passes a safe range without retaining scanner diagnostics', () => {
  const { directory, base, head } = fixtureRepository();
  const scanner = fakeScanner(directory, "process.stdout.write('[]'); process.exit(0);");
  const result = run(process.execPath, [scriptPath, scanner, base, head], directory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed for the introduced commit range/);
  assert.equal(result.stderr, '');
});

test('rejects a finding while emitting only the approved redacted fields', () => {
  const { directory, base, head } = fixtureRepository();
  const scanner = fakeScanner(
    directory,
    `process.stdout.write(JSON.stringify([{RuleID:'generic-api-key',File:'apps/api/example.ts',Commit:'${head}',UnsafeDiagnostic:'must not surface'}])); process.exit(1);`,
  );
  const result = run(process.execPath, [scriptPath, scanner, base, head], directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /credentialCategory/);
  assert.match(result.stderr, /repositoryPath/);
  assert.match(result.stderr, /rotationRecommendation/);
  assert.doesNotMatch(result.stderr, /UnsafeDiagnostic|must not surface/);
  assert.equal(result.stdout, '');
});

test('rejects an invalid commit identifier before invoking the scanner', () => {
  const { directory, head } = fixtureRepository();
  const scanner = fakeScanner(directory, 'process.exit(0);');
  const result = run(process.execPath, [scriptPath, scanner, 'not-a-commit', head], directory);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid commit identifier/);
});

test('scans each changed final blob so unchanged context is available', () => {
  const directory = initializeRepository();
  writeFileSync(path.join(directory, 'context.txt'), 'context-keyword\n');
  const base = commitAll(directory, 'context');
  writeFileSync(path.join(directory, 'context.txt'), 'context-keyword\nadded-value\n');
  const head = commitAll(directory, 'add value');
  const scanner = fakeScanner(
    directory,
    `let input=''; process.stdin.on('data', chunk => input += chunk); process.stdin.on('end', () => { if (input.includes('context-keyword') && input.includes('added-value')) { process.stdout.write(JSON.stringify([{RuleID:'context-rule'}])); process.exitCode=1; } else { process.stdout.write('[]'); } });`,
  );
  const result = run(process.execPath, [scriptPath, scanner, base, head], directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /context\.txt/);
});

const pinnedBinary = process.env.GITLEAKS_TEST_BINARY;
const pinnedTest = { skip: pinnedBinary ? false : 'GITLEAKS_TEST_BINARY is not set' };
const generatedDetectorMarker = () => ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
const zeroCommit = '0'.repeat(40);

test('pinned scanner ignores repository config and ignore-file suppression', pinnedTest, (t) => {
  const directory = initializeRepository();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const marker = generatedDetectorMarker();
  const direct = run(
    pinnedBinary,
    ['stdin', '--no-banner', '--log-level', 'fatal', '--redact=100', '--report-format', 'json', '--report-path', '-'],
    directory,
    { input: `${marker}\n` },
  );
  assert.equal(direct.status, 1);
  const [directFinding] = JSON.parse(direct.stdout);
  assert.ok(directFinding.Fingerprint);

  writeFileSync(
    path.join(directory, '.gitleaks.toml'),
    '[extend]\nuseDefault = true\ndisabledRules = ["aws-access-token"]\n',
  );
  writeFileSync(path.join(directory, '.gitleaksignore'), `${directFinding.Fingerprint}\n`);
  const base = commitAll(directory, 'repository suppression');
  writeFileSync(path.join(directory, 'introduced.txt'), `${marker}\n`);
  const head = commitAll(directory, 'introduced value');

  const result = run(process.execPath, [scriptPath, pinnedBinary, base, head], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /introduced\.txt/);
  assert.doesNotMatch(result.stderr, new RegExp(marker));
});

test('pinned scanner checks complete zero-base multi-commit history', pinnedTest, (t) => {
  const directory = initializeRepository();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, 'root.txt'), 'root\n');
  commitAll(directory, 'root');
  writeFileSync(path.join(directory, 'earlier.txt'), `${generatedDetectorMarker()}\n`);
  commitAll(directory, 'earlier introduced value');
  writeFileSync(path.join(directory, 'head.txt'), 'safe head\n');
  const head = commitAll(directory, 'safe head');

  const result = run(process.execPath, [scriptPath, pinnedBinary, zeroCommit, head], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /earlier\.txt/);
});

test('pinned scanner includes symlink-to-regular-file type changes', pinnedTest, (t) => {
  const directory = initializeRepository();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  symlinkSync('safe-target', path.join(directory, 'type-change.txt'));
  const base = commitAll(directory, 'symlink');
  unlinkSync(path.join(directory, 'type-change.txt'));
  writeFileSync(path.join(directory, 'type-change.txt'), `${generatedDetectorMarker()}\n`);
  const head = commitAll(directory, 'regular file');

  const result = run(process.execPath, [scriptPath, pinnedBinary, base, head], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /type-change\.txt/);
});

test('pinned scanner rejects a detector introduced only by a merge result', pinnedTest, (t) => {
  const directory = initializeRepository();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, 'merge-result.txt'), 'base\n');
  const base = commitAll(directory, 'base');

  assert.equal(run('git', ['checkout', '-qb', 'left'], directory).status, 0);
  writeFileSync(path.join(directory, 'merge-result.txt'), 'left-safe\n');
  commitAll(directory, 'left parent');

  assert.equal(run('git', ['checkout', '-qb', 'right', base], directory).status, 0);
  writeFileSync(path.join(directory, 'merge-result.txt'), 'right-safe\n');
  commitAll(directory, 'right parent');

  assert.equal(run('git', ['checkout', '-q', 'left'], directory).status, 0);
  const merge = run('git', ['merge', '--no-ff', 'right', '-m', 'merge parents'], directory);
  assert.notEqual(merge.status, 0, 'fixture must require an explicit merge result');
  const marker = generatedDetectorMarker();
  writeFileSync(path.join(directory, 'merge-result.txt'), `resolved\n${marker}\n`);
  const head = commitAll(directory, 'merge result');

  const result = run(process.execPath, [scriptPath, pinnedBinary, base, head], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /merge-result\.txt/);
  assert.match(result.stderr, new RegExp(head));
  assert.doesNotMatch(result.stderr, new RegExp(marker));
});

test('pinned scanner rejects a detector introduced only in a commit message', pinnedTest, (t) => {
  const directory = initializeRepository();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, 'baseline.txt'), 'baseline\n');
  const base = commitAll(directory, 'baseline');
  writeFileSync(path.join(directory, 'safe-change.txt'), 'safe change\n');
  const marker = generatedDetectorMarker();
  const head = commitAll(directory, `message-only detector ${marker}`);

  const result = run(process.execPath, [scriptPath, pinnedBinary, base, head], directory);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /<commit-message>/);
  assert.match(result.stderr, new RegExp(head));
  assert.doesNotMatch(result.stderr, new RegExp(marker));
  assert.doesNotMatch(result.stdout, new RegExp(marker));
});
