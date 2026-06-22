import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLERK_REQUIRED, REQUIRED, validate } from './preflight-env.mjs';

const strongSecret = '0123456789abcdef0123456789abcdef';
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
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'clerk',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2FyZS5leGFtcGxlLm9yZyQ=',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://care.example.org/sign-in',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: 'https://care.example.org/sign-up',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: 'https://care.example.org/today',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: 'https://care.example.org/today',
    LOCAL_AUTH_ENABLED: 'false',
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: 'false',
    DEMO_MODE: 'false',
    RUN_MIGRATIONS: 'false',
    AI_SUMMARY_ENABLED: 'false',
    ...overrides,
  };
}

test('valid production-shaped environment passes', () => {
  const result = validate(validEnv());
  assert.deepEqual(result.errors, []);
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

test('Clerk production env requires issuer, JWKS, public key, sign-in URL, and audience or azp', () => {
  const result = validate(validEnv({
    CLERK_ISSUER: '',
    CLERK_JWKS_URL: '',
    CLERK_SECRET_KEY: '',
    CLERK_AUDIENCE: '',
    CLERK_AUTHORIZED_PARTIES: '',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: '',
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: '',
  }));

  assert(result.errors.some((error) => error.includes('CLERK_ISSUER')));
  assert(result.errors.some((error) => error.includes('CLERK_JWKS_URL')));
  assert(result.errors.some((error) => error.includes('CLERK_SECRET_KEY')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_IN_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_UP_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL')));
  assert(result.errors.some((error) => error.includes('CLERK_AUDIENCE or CLERK_AUTHORIZED_PARTIES')));
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
