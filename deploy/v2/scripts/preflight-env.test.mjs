import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './preflight-env.mjs';

const strongSecret = '0123456789abcdef0123456789abcdef';

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
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: 'clerk',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_abcdefghijklmnopqrstuvwxyz1234567890',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: 'https://care.example.org/sign-in',
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
    CLERK_AUDIENCE: '',
    CLERK_AUTHORIZED_PARTIES: '',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '',
  }));

  assert(result.errors.some((error) => error.includes('CLERK_ISSUER')));
  assert(result.errors.some((error) => error.includes('CLERK_JWKS_URL')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')));
  assert(result.errors.some((error) => error.includes('NEXT_PUBLIC_CLERK_SIGN_IN_URL')));
  assert(result.errors.some((error) => error.includes('CLERK_AUDIENCE or CLERK_AUTHORIZED_PARTIES')));
});
