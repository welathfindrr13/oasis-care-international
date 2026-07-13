#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  accessSync,
  chmodSync,
  constants,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [gitleaksPath, requestedBase, requestedHead] = process.argv.slice(2);
const shaPattern = /^[0-9a-f]{40}$/i;
const zeroShaPattern = /^0{40}$/;

function fail(message, exitCode = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function git(args, allowFailure = false) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    fail('Secret leak prevention could not resolve the requested Git range.');
  }
  return result;
}

function verifyCommit(sha) {
  if (!shaPattern.test(sha)) {
    fail('Secret leak prevention received an invalid commit identifier.');
  }
  git(['rev-parse', '--verify', `${sha}^{commit}`]);
}

function recommendation(ruleId) {
  const category = String(ruleId).toLowerCase();
  if (category.includes('private-key')) {
    return 'Replace the key pair and revoke the old public key if it could be active.';
  }
  if (category.includes('aws')) {
    return 'Disable and rotate the credential after identifying the owning account.';
  }
  if (category.includes('github')) {
    return 'Revoke and rotate the token after identifying the owning account.';
  }
  return 'Identify the owning system and revoke or rotate the credential if it could be valid.';
}

function safeText(value, fallback) {
  const normalized = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 512);
  return normalized || fallback;
}

if (!gitleaksPath || !requestedBase || !requestedHead) {
  fail('Usage: check-secret-range.mjs <gitleaks-path> <base-sha> <head-sha>');
}

try {
  accessSync(gitleaksPath, constants.X_OK);
} catch {
  fail('Secret leak prevention could not execute the pinned scanner.');
}

verifyCommit(requestedHead);

const trustedConfigDirectory = mkdtempSync(path.join(tmpdir(), 'oasis-gitleaks-config-'));
chmodSync(trustedConfigDirectory, 0o700);
const trustedConfigPath = path.join(trustedConfigDirectory, 'gitleaks.toml');
const trustedIgnorePath = path.join(trustedConfigDirectory, '.gitleaksignore');
writeFileSync(trustedConfigPath, 'title = "Oasis trusted default rules"\n\n[extend]\nuseDefault = true\n', { mode: 0o600 });
writeFileSync(trustedIgnorePath, '', { mode: 0o600 });
process.once('exit', () => {
  rmSync(trustedConfigDirectory, { recursive: true, force: true });
});

let logOptions;
if (zeroShaPattern.test(requestedBase)) {
  // A zero `before` means GitHub created the protected branch. With no trusted
  // prior branch tip, scan every commit reachable from the new head rather than
  // assuming only the final commit is new.
  logOptions = requestedHead;
} else {
  verifyCommit(requestedBase);
  const mergeBase = git(['merge-base', requestedBase, requestedHead]).stdout.trim();
  if (!shaPattern.test(mergeBase)) {
    fail('Secret leak prevention could not establish a safe Git range.');
  }
  logOptions = `${mergeBase}..${requestedHead}`;
}

const safeFindings = [];
const seen = new Set();
const commits = git(['rev-list', '--reverse', logOptions])
  .stdout.trim()
  .split('\n')
  .filter(Boolean);

function scanContent(content, repositoryPath, commit) {
  const scan = spawnSync(
    gitleaksPath,
    [
      'stdin',
      '--no-banner',
      '--no-color',
      '--log-level',
      'fatal',
      '--redact=100',
      '--ignore-gitleaks-allow',
      '--config',
      trustedConfigPath,
      '--gitleaks-ignore-path',
      trustedIgnorePath,
      '--report-format',
      'json',
      '--report-path',
      '-',
    ],
    {
      input: content,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      cwd: trustedConfigDirectory,
    },
  );

  if (scan.error || (scan.status !== 0 && scan.status !== 1)) {
    fail('Secret leak prevention could not complete the scan. No scanner output was retained.');
  }

  let rows;
  try {
    rows = scan.stdout.trim() ? JSON.parse(scan.stdout) : [];
  } catch {
    fail('Secret leak prevention rejected the range but could not safely classify the finding.');
  }

  for (const row of rows) {
    const finding = {
      credentialCategory: safeText(row.RuleID, 'unclassified-credential'),
      repositoryPath: safeText(repositoryPath, 'unknown-path'),
      commit,
      rotationRecommendation: recommendation(row.RuleID),
    };
    const key = JSON.stringify(finding);
    if (!seen.has(key)) {
      seen.add(key);
      safeFindings.push(finding);
    }
  }
}

for (const commit of commits) {
  const commitMessage = git(['show', '-s', '--format=%B', commit]).stdout;
  scanContent(commitMessage, '<commit-message>', commit);

  const commitLine = git(['rev-list', '--parents', '-n', '1', commit])
    .stdout.trim()
    .split(/\s+/);
  const parents = commitLine.slice(1);
  const changedPathSet = new Set();
  const diffArguments = parents.length === 0
    ? [['--root', commit]]
    : parents.map((parent) => [parent, commit]);

  // A normal diff-tree invocation suppresses merge diffs. Compare the final
  // merge result with every parent, then scan each final blob once so content
  // introduced only by conflict resolution cannot bypass the range gate.
  for (const comparison of diffArguments) {
    const paths = git([
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      '-z',
      '--diff-filter=AMT',
      ...comparison,
    ]).stdout.split('\0').filter(Boolean);
    for (const repositoryPath of paths) {
      changedPathSet.add(repositoryPath);
    }
  }

  for (const repositoryPath of changedPathSet) {
    const blob = spawnSync('git', ['show', `${commit}:${repositoryPath}`], {
      encoding: null,
      maxBuffer: 128 * 1024 * 1024,
    });
    if (blob.error || blob.status !== 0) {
      fail('Secret leak prevention could not read a changed file safely.');
    }

    scanContent(blob.stdout, repositoryPath, commit);
  }
}

if (safeFindings.length === 0) {
  process.stdout.write('Secret leak prevention passed for the introduced commit range.\n');
  process.exit(0);
}

process.stderr.write(
  'Secret leak prevention rejected this range. Remove the introduced credential and treat it as exposed until its owner confirms otherwise.\n',
);
for (const finding of safeFindings) {
  process.stderr.write(`${JSON.stringify(finding)}\n`);
}
process.exit(1);
