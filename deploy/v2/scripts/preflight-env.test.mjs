import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLERK_REQUIRED, REQUIRED, validate } from './preflight-env.mjs';

const strongSecret = '01234567'.repeat(4);
const visitProofSecret = [
  'aaaa', 'aaaa', 'aaaa', 'aaaa',
  'aaaa', 'aaaa', 'aaaa', 'aaaa',
].join(' ');
const deployDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(deployDir, 'scripts/preflight-env.mjs');

function validEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    APP_DOMAIN: 'care.example.org',
    ACME_EMAIL: 'ops@example.org',
    POSTGRES_DB: 'oasis',
    POSTGRES_USER: 'oasis',
    POSTGRES_PASSWORD: strongSecret,
    DATABASE_URL: `postgresql://oasis:${strongSecret}@postgres:5432/oasis`,
    JWT_SECRET: strongSecret,
    SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'shift-current',
    SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: Buffer.alloc(32, 1).toString('base64'),
    SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: '[]',
    VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: 'production-v1',
    VISIT_COMPLETION_PROOF_ACTIVE_SECRET: visitProofSecret,
    NEXTAUTH_SECRET: `${strongSecret}nextauth`,
    NEXTAUTH_URL: 'https://care.example.org',
    NEXT_PUBLIC_API_URL: 'https://care.example.org/graphql',
    NEXT_PUBLIC_SITE_URL: 'https://care.example.org',
    ALLOWED_ORIGINS: 'https://care.example.org',
    AUTH_IDENTITY_PROVIDER: 'clerk',
    CLERK_ISSUER: 'https://clerk.provider.org',
    CLERK_JWKS_URL: 'https://clerk.provider.org/.well-known/jwks.json',
    CLERK_AUDIENCE: 'oasis-production-api',
    CLERK_AUTHORIZED_PARTIES: 'https://care.example.org',
    CLERK_SECRET_KEY: `${strongSecret}clerk`,
    PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID: 'org_oasis_platform_ops',
    PLATFORM_OPERATOR_CLERK_SUBJECTS: 'user_oasis_platform_operator',
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'clerk',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ['pk', 'test', 'a'.repeat(40)].join('_'),
    NEXT_PUBLIC_CLERK_CSP_ORIGINS: 'https://bright-gull-23.clerk.accounts.dev',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://care.example.org/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://care.example.org/sign-up',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: 'https://care.example.org/today',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: 'https://care.example.org/today',
    LOCAL_AUTH_ENABLED: 'false',
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: 'false',
    DEMO_MODE: 'false',
    RUN_MIGRATIONS: 'false',
    AI_SUMMARY_ENABLED: 'false',
    MEDICATION_EMAR_ENABLED: 'false',
    ...overrides,
  };
}

test('valid production-shaped environment passes', () => {
  const result = validate(validEnv());
  assert.deepEqual(result.errors, []);
});

test('production-like environments reject medication and eMAR enablement', () => {
  for (const NODE_ENV of ['production', 'staging']) {
    const result = validate(
      validEnv({ NODE_ENV, MEDICATION_EMAR_ENABLED: 'true' }),
    );
    assert(
      result.errors.includes(
        'MEDICATION_EMAR_ENABLED=true is forbidden for the current production launch',
      ),
    );
  }
});

test('missing, blank and malformed medication values remain disabled', () => {
  for (const value of [undefined, '', ' ', 'false', 'TRUE', '1', 'enabled']) {
    const env = validEnv();
    if (value === undefined) delete env.MEDICATION_EMAR_ENABLED;
    else env.MEDICATION_EMAR_ENABLED = value;
    assert.deepEqual(validate(env).errors, []);
  }
});

test('isolated non-production tests may explicitly enable legacy medication coverage', () => {
  assert.deepEqual(
    validate(
      validEnv({ NODE_ENV: 'test', MEDICATION_EMAR_ENABLED: 'true' }),
    ).errors,
    [],
  );
});

test('shift idempotency signing configuration is dedicated and strongly encoded', () => {
  const malformed = validate(validEnv({
    SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID: 'INVALID KEY',
    SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET: Buffer.alloc(31, 1).toString('base64'),
  }));

  assert(malformed.errors.some((error) => error.includes('SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID')));
  assert(malformed.errors.some((error) => error.includes('SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET')));
});

test('shift idempotency previous keys accept a bounded valid rotation set', () => {
  const result = validate(validEnv({
    SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: JSON.stringify(
      Array.from({ length: 4 }, (_, index) => ({
        id: `shift-previous-${index + 1}`,
        secret: Buffer.alloc(32, index + 2).toString('base64'),
      })),
    ),
  }));

  assert.deepEqual(result.errors, []);
});

test('shift idempotency previous keys reject malformed JSON and out-of-bounds arrays', () => {
  for (const value of [
    'not-json',
    '{}',
  ]) {
    const result = validate(validEnv({
      SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: value,
    }));
    assert(
      result.errors.some((error) =>
        error.includes('SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON'),
      ),
    );
  }

  const capacityResult = validate(validEnv({
    SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: JSON.stringify(
      Array.from({ length: 5 }, (_, index) => ({
        id: `shift-capacity-${index + 1}`,
        secret: Buffer.alloc(32, index + 10).toString('base64'),
      })),
    ),
  }));
  assert(
    capacityResult.errors.some((error) => error.includes('stop rotation at capacity')),
  );
});

test('shift idempotency previous keys reject duplicate current and previous key ids', () => {
  const previousSecret = Buffer.alloc(32, 2).toString('base64');
  for (const value of [
    JSON.stringify([{ id: 'shift-current', secret: previousSecret }]),
    JSON.stringify([
      { id: 'shift-previous', secret: previousSecret },
      { id: 'shift-previous', secret: Buffer.alloc(32, 3).toString('base64') },
    ]),
  ]) {
    const result = validate(validEnv({
      SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: value,
    }));
    assert(
      result.errors.some((error) => error.includes('duplicate key id')),
    );
  }
});

test('shift idempotency previous keys reject invalid shapes, ids, and secrets', () => {
  for (const value of [
    JSON.stringify([null]),
    JSON.stringify([{ id: 'shift-previous' }]),
    JSON.stringify([
      {
        id: 'shift-previous',
        secret: Buffer.alloc(32, 2).toString('base64'),
        extra: true,
      },
    ]),
    JSON.stringify([
      { id: 'INVALID KEY', secret: Buffer.alloc(32, 2).toString('base64') },
    ]),
    JSON.stringify([
      { id: 'shift-previous', secret: Buffer.alloc(31, 2).toString('base64') },
    ]),
    JSON.stringify([
      { id: 'shift-previous', secret: `${Buffer.alloc(32, 2).toString('base64')}=` },
    ]),
  ]) {
    const result = validate(validEnv({
      SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: value,
    }));
    assert(
      result.errors.some((error) =>
        error.includes('SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON'),
      ),
    );
  }
});

test('visit completion proof rotation requires a distinct complete previous key', () => {
  const partial = validate(validEnv({
    VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: 'production-v0',
  }));
  const collision = validate(validEnv({
    VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: 'production-v1',
    VISIT_COMPLETION_PROOF_PREVIOUS_SECRET: visitProofSecret,
  }));

  assert(partial.errors.some((error) => error.includes('configured together')));
  assert(collision.errors.some((error) => error.includes('identifiers must be unique')));
  assert(collision.errors.some((error) => error.includes('distinct secrets')));
});

test('placeholders and localhost fail', () => {
  const result = validate(validEnv({
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'replace-me-clerk-publishable-key',
  }));
  assert(result.errors.some((error) => error.includes('NEXTAUTH_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')));
});

test('production-like public URLs must use HTTPS', () => {
  const result = validate(validEnv({
    NEXT_PUBLIC_SITE_URL: 'http://care.example.org',
    NEXT_PUBLIC_API_URL: 'http://care.example.org/graphql',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'http://care.example.org/sign-in',
  }));

  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_SITE_URL must use https')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_API_URL must use https')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_IN_URL must use https')));
});

test('Clerk CSP configuration requires one exact HTTPS FAPI origin', () => {
  for (const value of [
    'http://bright-gull-23.clerk.accounts.dev',
    'https://user@bright-gull-23.clerk.accounts.dev',
    'https://*.clerk.accounts.dev',
    'https://bright-gull-23.clerk.accounts.dev/path',
    'https://bright-gull-23.clerk.accounts.dev?region=eu',
    'https://bright-gull-23.clerk.accounts.dev#fragment',
    'https://first.example.org,https://second.example.org',
  ]) {
    const result = validate(validEnv({ NEXT_PUBLIC_CLERK_CSP_ORIGINS: value }));
    assert(
      result.errors.some((error) =>
        error.includes('NEXT_PUBLIC_CLERK_CSP_ORIGINS'),
      ),
    );
  }
});

test('production-like app domain, NextAuth URL, and allowed origins must match the web origin', () => {
  const result = validate(validEnv({
    APP_DOMAIN: 'other.example.org',
    NEXTAUTH_URL: 'https://auth.example.org',
    ALLOWED_ORIGINS: 'https://other.example.org',
  }));

  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_SITE_URL host must match APP_DOMAIN')));
  assert(result.errors.some((error) => error.includes('NEXTAUTH_URL origin must match')));
  assert(result.errors.some((error) => error.includes('ALLOWED_ORIGINS must include')));
});

test('Clerk authorized parties and redirect URLs must match the public web origin', () => {
  const result = validate(validEnv({
    CLERK_AUTHORIZED_PARTIES: 'https://other.example.org',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://other.example.org/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://other.example.org/sign-up',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: 'https://other.example.org/today',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: 'https://other.example.org/today',
  }));

  assert(result.errors.some((error) => error.includes('CLERK_AUTHORIZED_PARTIES must include')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_IN_URL origin must match')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_UP_URL origin must match')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL origin must match')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL origin must match')));
});

test('platform operators require one dedicated Clerk org and a bounded unique subject allowlist', () => {
  const malformed = validate(validEnv({
    PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID: 'customer-org',
    PLATFORM_OPERATOR_CLERK_SUBJECTS: 'user_operator,user_operator,not-a-clerk-user',
  }));

  assert(malformed.errors.some((error) => error.includes('PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID')));
  assert(malformed.errors.some((error) => error.includes('must not contain duplicates')));
  assert(malformed.errors.some((error) => error.includes('entries must be exact Clerk user IDs')));
});

test('local auth and demo mode are forbidden in production-like env', () => {
  const result = validate(validEnv({
    LOCAL_AUTH_ENABLED: 'true',
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: 'true',
    DEMO_MODE: 'true',
  }));
  assert(result.errors.some((error) => error.includes('LOCAL_AUTH_ENABLED')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_LOCAL_AUTH_ENABLED')));
  assert(result.errors.some((error) => error.includes('DEMO_MODE')));
});

test('AI summary enabled requires AWS/model configuration and warns', () => {
  const result = validate(validEnv({ AI_SUMMARY_ENABLED: 'true' }));
  assert(result.errors.some((error) => error.includes('AWS_REGION')));
  assert(result.errors.some((error) => error.includes('BEDROCK_MODEL')));
  assert(result.warnings.some((warning) => warning.includes('AI summary is enabled')));
});

test('production-like env rejects Cognito as the Deployment V2 auth provider', () => {
  const result = validate(validEnv({
    AUTH_IDENTITY_PROVIDER: 'cognito',
    COGNITO_ISSUER: 'https://auth.provider.org/oauth2/default',
    COGNITO_CLIENT_ID: 'oasis-production-client',
    COGNITO_CLIENT_SECRET: `${strongSecret}cognito`,
  }));

  assert(result.errors.some((error) => error.includes('AUTH_IDENTITY_PROVIDER=clerk')));
});

test('production-like env rejects non-Clerk public auth provider', () => {
  const result = validate(validEnv({
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'cognito',
  }));

  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk')));
});

test('production-like env requires public auth provider to be present', () => {
  const result = validate(validEnv({
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: '',
  }));

  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER is required')));
});

test('successful preflight prints sanitized Clerk auth-mode proof', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-preflight-'));
  const envFile = path.join(tempDir, 'deploy.env');
  const fileEnv = Object.entries(validEnv())
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  writeFileSync(envFile, `${fileEnv}\n`);

  const result = spawnSync(process.execPath, [scriptPath, envFile], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /RUN_MIGRATIONS safety class: RUN_MIGRATIONS_NOT_TRUE/);
  assert.match(result.stdout, /AUTH_IDENTITY_PROVIDER is clerk: YES/);
  assert.match(result.stdout, /NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER is clerk: YES/);
  assert.match(result.stdout, /Auth provider envs match: YES/);
});

test('preflight refuses RUN_MIGRATIONS=true without printing env values', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-preflight-'));
  const envFile = path.join(tempDir, 'deploy.env');
  const leakedDbUrl = `postgresql://oasis:${strongSecret}@postgres:5432/oasis`;
  const fileEnv = Object.entries(validEnv({
    DATABASE_URL: leakedDbUrl,
    RUN_MIGRATIONS: 'true',
  }))
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  writeFileSync(envFile, `${fileEnv}\n`);

  const result = spawnSync(process.execPath, [scriptPath, envFile], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /RUN_MIGRATIONS safety class: RUN_MIGRATIONS_TRUE/);
  assert.doesNotMatch(result.stdout + result.stderr, /RUN_MIGRATIONS=true/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(strongSecret));
  assert.doesNotMatch(result.stdout + result.stderr, /postgresql:\/\//);
});

test('preflight fails closed when RUN_MIGRATIONS cannot be checked', () => {
  const result = spawnSync(process.execPath, [scriptPath, '/path/that/does/not/exist/deploy.env'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stdout, /RUN_MIGRATIONS safety class: RUN_MIGRATIONS_UNKNOWN/);
  assert.doesNotMatch(result.stdout + result.stderr, /\.env contents|DATABASE_URL|postgresql:\/\//);
});

test('preflight fails closed when env path cannot be read as a file', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-preflight-'));

  const result = spawnSync(process.execPath, [scriptPath, tempDir], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stdout, /RUN_MIGRATIONS safety class: RUN_MIGRATIONS_UNKNOWN/);
  assert.doesNotMatch(result.stdout + result.stderr, /\.env contents|DATABASE_URL|postgresql:\/\//);
});

test('preflight treats absent RUN_MIGRATIONS as not true for the safety gate', () => {
  const values = validEnv();
  delete values.RUN_MIGRATIONS;
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-preflight-'));
  const envFile = path.join(tempDir, 'deploy.env');
  const fileEnv = Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  writeFileSync(envFile, `${fileEnv}\n`);

  const result = spawnSync(process.execPath, [scriptPath, envFile], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /RUN_MIGRATIONS safety class: RUN_MIGRATIONS_NOT_TRUE/);
  assert.match(result.stderr, /RUN_MIGRATIONS is required/);
});

test('failed preflight does not print secret values', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-preflight-'));
  const envFile = path.join(tempDir, 'deploy.env');
  const leakedSecret = 'do-not-print-this-secret-value-1234567890';
  const leakedPreviousSecret = Buffer.from(
    'do-not-print-this-previous-key-value',
  ).toString('base64');
  const fileEnv = Object.entries(validEnv({
    JWT_SECRET: leakedSecret,
    SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON: JSON.stringify([
      { id: 'INVALID KEY', secret: leakedPreviousSecret },
    ]),
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'cognito',
  }))
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  writeFileSync(envFile, `${fileEnv}\n`);

  const result = spawnSync(process.execPath, [scriptPath, envFile], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(leakedSecret));
  assert.doesNotMatch(result.stderr, new RegExp(leakedSecret));
  assert.doesNotMatch(result.stdout, new RegExp(leakedPreviousSecret));
  assert.doesNotMatch(result.stderr, new RegExp(leakedPreviousSecret));
  assert.match(result.stderr, /NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk/);
});

test('Clerk production env requires issuer, JWKS, public key, sign-in URL, and authorized parties', () => {
  const result = validate(validEnv({
    CLERK_ISSUER: '',
    CLERK_JWKS_URL: '',
    CLERK_SECRET_KEY: '',
    PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID: '',
    PLATFORM_OPERATOR_CLERK_SUBJECTS: '',
    CLERK_AUDIENCE: '',
    CLERK_AUTHORIZED_PARTIES: '',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_CLERK_CSP_ORIGINS: '',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '',
  }));

  assert(result.errors.some((error) => error.includes('CLERK_ISSUER')));
  assert(result.errors.some((error) => error.includes('CLERK_JWKS_URL')));
  assert(result.errors.some((error) => error.includes('CLERK_SECRET_KEY')));
  assert(result.errors.some((error) => error.includes('PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID')));
  assert(result.errors.some((error) => error.includes('PLATFORM_OPERATOR_CLERK_SUBJECTS')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_CSP_ORIGINS')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_IN_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_UP_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL')));
  assert(result.errors.some((error) => error.includes('CLERK_AUTHORIZED_PARTIES')));
});

test('Clerk audience remains optional when authorized parties are configured', () => {
  const result = validate(validEnv({
    CLERK_AUDIENCE: '',
    CLERK_AUTHORIZED_PARTIES: 'https://care.example.org',
  }));

  assert.deepEqual(result.errors, []);
});

test('Clerk audience cannot substitute for required authorized parties', () => {
  const result = validate(validEnv({
    CLERK_AUDIENCE: 'oasis-production-api',
    CLERK_AUTHORIZED_PARTIES: '',
  }));

  assert(result.errors.some((error) => error.includes('CLERK_AUTHORIZED_PARTIES')));
});

test('preflight required env coverage stays ahead of compose required interpolation', () => {
  const compose = readFileSync(path.join(deployDir, 'docker-compose.yml'), 'utf8');
  const composeRequired = new Set(
    Array.from(compose.matchAll(/\$\{([A-Z0-9_]+):\?/g), (match) => match[1]),
  );
  const preflightRequired = new Set([...REQUIRED, ...CLERK_REQUIRED]);

  for (const name of composeRequired) {
    assert(preflightRequired.has(name), `${name} is required by compose but missing from preflight`);
  }
});

test('preflight validates file values instead of ambient process env overrides', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-preflight-'));
  const envFile = path.join(tempDir, 'deploy.env');
  const fileEnv = Object.entries(validEnv({ NEXTAUTH_URL: '' }))
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  writeFileSync(envFile, `${fileEnv}\n`);

  const result = spawnSync(process.execPath, [scriptPath, envFile], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NEXTAUTH_URL: 'https://care.example.org',
    },
  });

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /NEXTAUTH_URL is required/);
});

test('ambient unrelated env cannot cause placeholder failures for a valid env file', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-preflight-'));
  const envFile = path.join(tempDir, 'deploy.env');
  const fileEnv = Object.entries(validEnv())
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  writeFileSync(envFile, `${fileEnv}\n`);

  const result = spawnSync(process.execPath, [scriptPath, envFile], {
    encoding: 'utf8',
    env: {
      ...process.env,
      UNRELATED_VENDOR_PLACEHOLDER: 'https://example.com/replace-me',
    },
  });

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('runtime deployment config does not provide production placeholder fallbacks', () => {
  const compose = readFileSync(path.join(deployDir, 'docker-compose.yml'), 'utf8');
  const caddyfile = readFileSync(path.join(deployDir, 'Caddyfile'), 'utf8');

  assert.doesNotMatch(compose, /\$\{[A-Z0-9_]+:-[^}]*?(replace-me|example\.com|clerk\.example\.com|app\.example\.com)/);
  assert.doesNotMatch(caddyfile, /\{\$[A-Z0-9_]+:(localhost|admin@example\.com)\}/);
});
