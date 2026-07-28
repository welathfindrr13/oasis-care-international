import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = readFileSync(new URL('./verify-local.sh', import.meta.url), 'utf8');
const webBuildScriptUrl = new URL(
  './run-web-build-with-env.sh',
  import.meta.url,
);
const webBuildScript = readFileSync(webBuildScriptUrl, 'utf8');
const webImageBuildScriptUrl = new URL(
  './run-web-image-build-with-env.sh',
  import.meta.url,
);
const webImageBuildScript = readFileSync(webImageBuildScriptUrl, 'utf8');

test('local Deployment V2 compose verification uses the generated env file', () => {
  assert.match(script, /docker compose --env-file "\$TEMP_ENV" -f deploy\/v2\/docker-compose\.yml config/);
});

test('local Deployment V2 web build consumes the generated environment through the guarded helper', () => {
  assert.match(
    script,
    /deploy\/v2\/scripts\/run-web-build-with-env\.sh "\$TEMP_ENV"/,
  );
  for (const name of [
    'AUTH_IDENTITY_PROVIDER',
    'NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER',
    'NEXT_PUBLIC_CLERK_CSP_ORIGINS',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
  ]) {
    assert.match(webBuildScript, new RegExp(`\\b${name}\\b`));
  }
  assert.doesNotMatch(webBuildScript, /set -x|printenv|env\s*$/m);
});

test('the web build helper passes auth/provider/CSP values in a clean executable environment without printing them', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'oasis-web-build-env-'));
  const envFile = join(fixtureDir, 'verification.env');
  const outputFile = join(fixtureDir, 'probe.out');
  const stubPnpm = join(fixtureDir, 'pnpm');
  const fixtureValues = {
    AUTH_IDENTITY_PROVIDER: 'clerk',
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'clerk',
    NEXT_PUBLIC_CLERK_CSP_ORIGINS: 'https://clerk.example.test',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'synthetic-publishable-proof',
    NEXTAUTH_URL: 'https://care.example.test',
    NEXTAUTH_SECRET: 'synthetic-session-proof',
  };

  try {
    writeFileSync(
      envFile,
      Object.entries(fixtureValues)
        .map(([name, value]) => `${name}=${value}`)
        .join('\n') + '\n',
      { mode: 0o600 },
    );
    writeFileSync(
      stubPnpm,
      `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == "--filter @oasis/web build" ]]
[[ "$AUTH_IDENTITY_PROVIDER" == "clerk" ]]
[[ "$NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER" == "clerk" ]]
[[ "$NEXT_PUBLIC_CLERK_CSP_ORIGINS" == "https://clerk.example.test" ]]
[[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" == "synthetic-publishable-proof" ]]
[[ "$NEXTAUTH_URL" == "https://care.example.test" ]]
[[ "$NEXTAUTH_SECRET" == "synthetic-session-proof" ]]
printf 'WEB_BUILD_ENV_OK\\n' > "$PROBE_OUTPUT"
`,
      { mode: 0o700 },
    );
    chmodSync(stubPnpm, 0o700);

    const result = spawnSync(
      '/usr/bin/env',
      [
        '-i',
        `PATH=${fixtureDir}:/usr/bin:/bin`,
        `PROBE_OUTPUT=${outputFile}`,
        '/bin/bash',
        webBuildScriptUrl.pathname,
        envFile,
      ],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(outputFile, 'utf8'), 'WEB_BUILD_ENV_OK\n');
    for (const value of Object.values(fixtureValues)) {
      assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(value));
    }
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('the web image build receives the generated public auth environment without printing values', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'oasis-web-image-env-'));
  const envFile = join(fixtureDir, 'verification.env');
  const outputFile = join(fixtureDir, 'probe.out');
  const stubDocker = join(fixtureDir, 'docker');
  const fixtureValues = {
    NEXT_PUBLIC_API_URL: 'https://care.example.test/graphql',
    NEXT_PUBLIC_SITE_URL: 'https://care.example.test',
    NEXTAUTH_URL: 'https://care.example.test',
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'clerk',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'synthetic-publishable-proof',
    NEXT_PUBLIC_CLERK_CSP_ORIGINS: 'https://clerk.example.test',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://care.example.test/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://care.example.test/sign-up',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: 'https://care.example.test/today',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: 'https://care.example.test/today',
  };

  try {
    writeFileSync(
      envFile,
      Object.entries(fixtureValues)
        .map(([name, value]) => `${name}=${value}`)
        .join('\n') + '\n',
      { mode: 0o600 },
    );
    writeFileSync(
      stubDocker,
      `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == "build --build-arg NEXT_PUBLIC_API_URL --build-arg NEXT_PUBLIC_SITE_URL --build-arg NEXTAUTH_URL --build-arg NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --build-arg NEXT_PUBLIC_CLERK_CSP_ORIGINS --build-arg NEXT_PUBLIC_CLERK_SIGN_IN_URL --build-arg NEXT_PUBLIC_CLERK_SIGN_UP_URL --build-arg NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL --build-arg NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL -f apps/web/Dockerfile -t oasis-web:v2 ." ]]
[[ "$NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER" == "clerk" ]]
[[ "$NEXT_PUBLIC_CLERK_CSP_ORIGINS" == "https://clerk.example.test" ]]
[[ "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" == "synthetic-publishable-proof" ]]
printf 'WEB_IMAGE_ENV_OK\\n' > "$PROBE_OUTPUT"
`,
      { mode: 0o700 },
    );
    chmodSync(stubDocker, 0o700);

    const result = spawnSync(
      '/usr/bin/env',
      [
        '-i',
        `PATH=${fixtureDir}:/usr/bin:/bin`,
        `PROBE_OUTPUT=${outputFile}`,
        '/bin/bash',
        webImageBuildScriptUrl.pathname,
        envFile,
      ],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(outputFile, 'utf8'), 'WEB_IMAGE_ENV_OK\n');
    for (const value of Object.values(fixtureValues)) {
      assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(value));
    }
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('local Deployment V2 proof assembles non-secret proof and Clerk fixtures at runtime', () => {
  assert.match(
    script,
    /# Assemble local-only values at runtime so the repository never contains/,
  );
  assert.match(script, /^SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID=shift-local-verification$/m);
  assert.match(script, /^SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON=\[\]$/m);
  assert.match(script, /^VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID=visit-local-verification$/m);
  for (const name of [
    'POSTGRES_PASSWORD',
    'DATABASE_URL',
    'JWT_SECRET',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET',
    'VISIT_COMPLETION_PROOF_ACTIVE_SECRET',
    'CLERK_SECRET_KEY',
  ]) {
    assert.doesNotMatch(script, new RegExp(`^${name}=\\S+$`, 'm'));
  }
  assert.match(script, /LOCAL_DATABASE_URL="postgresql:\/\/oasis:\$\{LOCAL_POSTGRES_PASSWORD\}@postgres:5432\/oasis"/);
  assert.match(script, /DATABASE_URL="\$LOCAL_DATABASE_URL" \\/);
  assert.match(
    script,
    /printf 'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET=%s\\n' .* \| base64 \| tr -d '\\n'/,
  );
  assert.match(
    script,
    /printf 'VISIT_COMPLETION_PROOF_ACTIVE_SECRET=%s\\n' "\$\(printf '%s' 'local-verification-' 'visit-proof-' 'not-a-credential-value'\)"/,
  );
  assert.match(
    script,
    /printf 'CLERK_SECRET_KEY=%s\\n' "\$\(printf '%s' 'local-verification-' 'not-a-credential-value'\)" >> "\$TEMP_ENV"/,
  );
});
