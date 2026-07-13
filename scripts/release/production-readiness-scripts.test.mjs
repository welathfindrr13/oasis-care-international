import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...options.env,
    },
  });
}

function writeExecutable(filePath, contents) {
  writeFileSync(filePath, contents, { mode: 0o755 });
}

test('secret parity checker includes authentication and visit-proof secrets', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-secrets-'));
  const secretLog = path.join(tempDir, 'secret-ids.log');

  writeExecutable(
    path.join(tempDir, 'aws'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "secretsmanager" && "$2" == "describe-secret" ]]; then
  secret_id=""
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --secret-id)
        shift
        secret_id="$1"
        ;;
    esac
    shift || true
  done
  echo "$secret_id" >> "$AWS_SECRET_LOG"
  exit 0
fi
echo "unexpected aws call: $*" >&2
exit 2
`,
  );

  const result = run('bash', ['scripts/release/check-secrets-parity.sh'], {
    env: {
      AWS_REGION: 'eu-west-2',
      AWS_SECRET_LOG: secretLog,
      CHECK_STAGING: 'true',
      CHECK_PRODUCTION: 'true',
      PATH: `${tempDir}:${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const checkedSecrets = readFileSync(secretLog, 'utf8');

  assert.match(checkedSecrets, /oasis\/staging\/JWT_SECRET/);
  assert.match(checkedSecrets, /oasis\/production\/JWT_SECRET/);
  assert.match(
    checkedSecrets,
    /oasis\/staging\/VISIT_COMPLETION_PROOF_ACTIVE_SECRET/,
  );
  assert.match(
    checkedSecrets,
    /oasis\/production\/VISIT_COMPLETION_PROOF_ACTIVE_SECRET/,
  );
});

test('migration runner supports a parameterised dry run without Terraform or AWS calls', () => {
  const result = run('bash', ['infrastructure/scripts/run-migration.sh'], {
    env: {
      MIGRATION_DRY_RUN: 'true',
      AWS_REGION: 'eu-west-2',
      EXPECTED_AWS_ACCOUNT_ID: '123456789012',
      CLUSTER: 'oasis-care-production-cluster',
      TASK_DEF: 'oasis-care-production-api',
      CONTAINER_NAME: 'api',
      SUBNET_ID: 'subnet-prod-1',
      SECURITY_GROUP_ID: 'sg-prod-1',
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /cluster: oasis-care-production-cluster/);
  assert.match(result.stdout, /task definition: oasis-care-production-api/);
  assert.match(result.stdout, /container: api/);
  assert.match(result.stdout, /subnet-prod-1/);
  assert.match(result.stdout, /sg-prod-1/);
  assert.match(result.stdout, /npx prisma migrate deploy/);
  assert.doesNotMatch(result.stdout + result.stderr, /terraform output/);
});

test('migration dry run remains safe when expected AWS account is unset', () => {
  const result = run('bash', ['infrastructure/scripts/run-migration.sh'], {
    env: {
      MIGRATION_DRY_RUN: 'true',
      EXPECTED_AWS_ACCOUNT_ID: '',
      AWS_ACCOUNT_ID: '',
      SUBNET_ID: 'subnet-prod-1',
      SECURITY_GROUP_ID: 'sg-prod-1',
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /expected account: <not enforced>/);
});

test('smoke script supports parameterised API, web, and GraphQL dry-run checks', () => {
  const result = run('bash', ['infrastructure/scripts/smoke-test.sh'], {
    env: {
      SMOKE_DRY_RUN: 'true',
      API_BASE_URL: 'https://api.example.test',
      WEB_BASE_URL: 'https://app.example.test',
      GRAPHQL_ENDPOINT: 'https://api.example.test/graphql',
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /GET https:\/\/api\.example\.test\/health/);
  assert.match(result.stdout, /GET https:\/\/app\.example\.test\/api\/health/);
  assert.match(result.stdout, /POST https:\/\/api\.example\.test\/graphql/);
  assert.doesNotMatch(result.stdout, /oasis-care\.(co|com)/);
});

test('smoke script fails safely without explicit targets', () => {
  const result = run('bash', ['infrastructure/scripts/smoke-test.sh'], {
    env: {
      SMOKE_DRY_RUN: 'true',
      API_BASE_URL: '',
      WEB_BASE_URL: '',
      GRAPHQL_ENDPOINT: '',
    },
  });

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /GRAPHQL_ENDPOINT or API_BASE_URL is required/);
  assert.doesNotMatch(result.stdout + result.stderr, /oasis-care\.(co|com)/);
});

test('smoke script requires explicit live opt-in before network calls', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-smoke-'));
  const curlLog = path.join(tempDir, 'curl.log');

  writeExecutable(
    path.join(tempDir, 'curl'),
    `#!/usr/bin/env bash
echo "$*" >> "$SMOKE_CURL_LOG"
exit 2
`,
  );

  const result = run('bash', ['infrastructure/scripts/smoke-test.sh'], {
    env: {
      SMOKE_DRY_RUN: 'false',
      API_BASE_URL: 'https://api.example.test',
      WEB_BASE_URL: 'https://app.example.test',
      GRAPHQL_ENDPOINT: 'https://api.example.test/graphql',
      SMOKE_CURL_LOG: curlLog,
      PATH: `${tempDir}:${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /SMOKE_OPT_IN_REQUIRED/);
  assert.throws(() => readFileSync(curlLog, 'utf8'));
});

test('migration runner checks the named migration container exit code', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-migration-'));

  writeExecutable(
    path.join(tempDir, 'aws'),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "sts" && "$2" == "get-caller-identity" ]]; then
  echo "123456789012"
  exit 0
fi
if [[ "$1" == "ecs" && "$2" == "run-task" ]]; then
  echo "arn:aws:ecs:eu-west-2:123456789012:task/oasis/migration-task"
  exit 0
fi
if [[ "$1" == "ecs" && "$2" == "wait" ]]; then
  exit 0
fi
if [[ "$1" == "ecs" && "$2" == "describe-tasks" ]]; then
  query=""
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --query)
        shift
        query="$1"
        ;;
    esac
    shift || true
  done
  if [[ "$query" == *"?name=="* ]]; then
    echo "1"
  else
    echo "0"
  fi
  exit 0
fi
echo "unexpected aws call: $*" >&2
exit 2
`,
  );

  const result = run('bash', ['infrastructure/scripts/run-migration.sh'], {
    env: {
      AWS_REGION: 'eu-west-2',
      EXPECTED_AWS_ACCOUNT_ID: '123456789012',
      CLUSTER: 'oasis-care-production-cluster',
      TASK_DEF: 'oasis-care-production-api',
      CONTAINER_NAME: 'api',
      SUBNET_ID: 'subnet-prod-1',
      SECURITY_GROUP_ID: 'sg-prod-1',
      PATH: `${tempDir}:${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Migration failed with exit code: 1/);
});

test('migration runner fails closed when non-dry-run expected account is unset', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-migration-'));
  const awsLog = path.join(tempDir, 'aws.log');

  writeExecutable(
    path.join(tempDir, 'aws'),
    `#!/usr/bin/env bash
echo "$*" >> "$AWS_CALL_LOG"
exit 2
`,
  );

  const result = run('bash', ['infrastructure/scripts/run-migration.sh'], {
    env: {
      AWS_REGION: 'eu-west-2',
      EXPECTED_AWS_ACCOUNT_ID: '',
      AWS_ACCOUNT_ID: '',
      CLUSTER: 'oasis-care-production-cluster',
      TASK_DEF: 'oasis-care-production-api',
      CONTAINER_NAME: 'api',
      SUBNET_ID: 'subnet-prod-1',
      SECURITY_GROUP_ID: 'sg-prod-1',
      AWS_CALL_LOG: awsLog,
      PATH: `${tempDir}:${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /EXPECTED_AWS_ACCOUNT_ID is required/);
  assert.throws(() => readFileSync(awsLog, 'utf8'));
});

test('staging diagnostic continuation script has valid bash syntax', () => {
  const result = run('bash', ['-n', 'scripts/diag/complete-diagnostic.sh']);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('live release probes require explicit environment instead of built-in live defaults', () => {
  const liveProbeFiles = [
    'scripts/release/mobile-route-smoke.mjs',
    'scripts/release/probes/strict_post_deploy_matrix.mjs',
    'scripts/release/probes/care_log_probe.mjs',
    'scripts/release/probes/ai_summary_probe.mjs',
    'scripts/release/probes/emar_provisioning_probe.mjs',
  ];

  for (const file of liveProbeFiles) {
    const source = readFileSync(path.join(repoRoot, file), 'utf8');
    assert.doesNotMatch(source, /app\.oasis-care\.co/);
    assert.doesNotMatch(source, /boss@yourdomain\.com|carer-demo@yourdomain\.com/);
    assert.doesNotMatch(source, /SecurePassword123!/);
  }
});
