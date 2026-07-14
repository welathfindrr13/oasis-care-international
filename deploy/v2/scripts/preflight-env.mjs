#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLACEHOLDER_RE = /(<[^>]+>|replace-me|changeme|change-me|placeholder|example\.com|example\.invalid|oasis-care\.local|your-domain|your-|ci-|dummy|test-secret)/i;
const LOCALHOST_RE = /(^|[/:@])(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?=$|[/:?#])/i;
const WEAK_SECRET_RE = /^(password|secret|jwt-secret|nextauth-secret|postgres|oasis|admin|changeme|replace-me)$/i;
const SHIFT_KEY_ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const SHIFT_SECRET_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const SHIFT_MINIMUM_SECRET_BYTES = 32;
// Match the runtime bound. Rotation must stop rather than evict a key that may
// still sign a retryable persisted proof.
const SHIFT_MAXIMUM_PREVIOUS_KEYS = 4;
const RUN_MIGRATIONS_NOT_TRUE = 'RUN_MIGRATIONS_NOT_TRUE';
const RUN_MIGRATIONS_TRUE = 'RUN_MIGRATIONS_TRUE';
const RUN_MIGRATIONS_UNKNOWN = 'RUN_MIGRATIONS_UNKNOWN';

const REQUIRED = [
  'APP_DOMAIN',
  'ACME_EMAIL',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'DATABASE_URL',
  'JWT_SECRET',
  'SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID',
  'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SITE_URL',
  'ALLOWED_ORIGINS',
  'AUTH_IDENTITY_PROVIDER',
  'NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER',
  'LOCAL_AUTH_ENABLED',
  'NEXT_PUBLIC_LOCAL_AUTH_ENABLED',
  'RUN_MIGRATIONS',
];

const CLERK_REQUIRED = [
  'CLERK_ISSUER',
  'CLERK_JWKS_URL',
  'CLERK_SECRET_KEY',
  'CLERK_AUTHORIZED_PARTIES',
  'PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID',
  'PLATFORM_OPERATOR_CLERK_SUBJECTS',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
];

const SECRET_NAMES = new Set([
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET',
  'NEXTAUTH_SECRET',
  'COGNITO_CLIENT_SECRET',
  'LOCAL_AUTH_JWT_SECRET',
  'CLERK_SECRET_KEY',
  'DEMO_SEED_TOKEN',
]);

const URL_NAMES = new Set([
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SITE_URL',
  'ALLOWED_ORIGINS',
  'COGNITO_ISSUER',
  'CLERK_ISSUER',
  'CLERK_JWKS_URL',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
  'CLERK_AUTHORIZED_PARTIES',
]);

const AUDITED_OPTIONAL_NAMES = new Set([
  'NODE_ENV',
  'DEMO_MODE',
  'GDPR_ENABLED',
  'METRICS_ENABLED',
  'AI_SUMMARY_ENABLED',
  'AWS_REGION',
  'BEDROCK_MODEL',
  'COGNITO_ISSUER',
  'COGNITO_CLIENT_ID',
  'COGNITO_CLIENT_SECRET',
  'LOCAL_AUTH_ISSUER',
  'LOCAL_AUTH_JWT_SECRET',
  'CLERK_AUDIENCE',
  'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON',
]);

const AUDITED_NAMES = new Set([
  ...REQUIRED,
  ...CLERK_REQUIRED,
  ...SECRET_NAMES,
  ...URL_NAMES,
  ...AUDITED_OPTIONAL_NAMES,
]);

function parseEnvFile(filePath) {
  const values = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function add(errors, message) {
  errors.push(message);
}

function isCanonicalShiftSecret(value) {
  const encoded = String(value || '').trim();
  if (!SHIFT_SECRET_RE.test(encoded) || encoded.length % 4 !== 0) return false;
  const decoded = Buffer.from(encoded, 'base64');
  return (
    decoded.length >= SHIFT_MINIMUM_SECRET_BYTES &&
    decoded.toString('base64') === encoded
  );
}

function validateShiftIdempotencyKeyRing(values, errors) {
  const currentKeyId = String(values.SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID || '').trim();
  if (currentKeyId && !SHIFT_KEY_ID_RE.test(currentKeyId)) {
    add(errors, 'SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID must use the approved key-id format');
  }

  const currentSecret = String(values.SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET || '').trim();
  if (currentSecret && !isCanonicalShiftSecret(currentSecret)) {
    add(errors, 'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET must be canonical base64 for at least 32 bytes');
  }

  let previousKeys;
  try {
    previousKeys = JSON.parse(
      String(values.SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON || '[]'),
    );
  } catch {
    add(errors, 'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON must be a valid key array');
    return;
  }

  if (!Array.isArray(previousKeys) || previousKeys.length > SHIFT_MAXIMUM_PREVIOUS_KEYS) {
    add(errors, 'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON must contain at most 4 previous keys; stop rotation at capacity');
    return;
  }

  const seenKeyIds = new Set(currentKeyId ? [currentKeyId] : []);
  for (const value of previousKeys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      add(errors, 'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON entries must contain only id and secret');
      return;
    }
    const keys = Object.keys(value);
    if (
      keys.some((key) => !['id', 'secret'].includes(key)) ||
      !Object.prototype.hasOwnProperty.call(value, 'id') ||
      !Object.prototype.hasOwnProperty.call(value, 'secret')
    ) {
      add(errors, 'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON entries must contain only id and secret');
      return;
    }

    const keyId = String(value.id || '').trim();
    if (!SHIFT_KEY_ID_RE.test(keyId)) {
      add(errors, 'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON contains an invalid key id');
      return;
    }
    if (!isCanonicalShiftSecret(value.secret)) {
      add(errors, 'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON contains an invalid secret');
      return;
    }
    if (seenKeyIds.has(keyId)) {
      add(errors, 'SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON contains a duplicate key id');
      return;
    }
    seenKeyIds.add(keyId);
  }
}

function isTruthy(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function classifyRunMigrations(values) {
  return String(values.RUN_MIGRATIONS ?? '').trim() === 'true'
    ? RUN_MIGRATIONS_TRUE
    : RUN_MIGRATIONS_NOT_TRUE;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUrl(name, value, errors) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    add(errors, `${name} must be a valid URL`);
    return null;
  }
}

function requireHttpsUrl(name, value, errors) {
  const url = parseUrl(name, value, errors);
  if (!url) return null;
  if (url.protocol !== 'https:') {
    add(errors, `${name} must use https for production-like Deployment V2 proof`);
  }
  if (LOCALHOST_RE.test(url.href)) {
    add(errors, `${name} must not point at localhost in production-like env`);
  }
  return url;
}

function normalizeOrigin(url) {
  return url ? url.origin.replace(/\/$/, '') : '';
}

function normalizeProvider(value) {
  return String(value || '').trim().toLowerCase();
}

function authModeProof(values) {
  const authProvider = normalizeProvider(values.AUTH_IDENTITY_PROVIDER);
  const publicAuthProvider = normalizeProvider(values.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER);

  return {
    authProviderIsClerk: authProvider === 'clerk',
    publicAuthProviderIsClerk: publicAuthProvider === 'clerk',
    authProvidersMatch: Boolean(authProvider) && authProvider === publicAuthProvider,
  };
}

function validate(values) {
  const errors = [];
  const warnings = [];
  const nodeEnv = String(values.NODE_ENV || 'production').toLowerCase();
  const isProductionLike = ['production', 'staging'].includes(nodeEnv);

  for (const name of REQUIRED) {
    if (!String(values[name] || '').trim()) {
      add(errors, `${name} is required for Deployment V2 preflight`);
    }
  }

  const proof = authModeProof(values);
  const authProvider = normalizeProvider(values.AUTH_IDENTITY_PROVIDER);
  validateShiftIdempotencyKeyRing(values, errors);
  if (isProductionLike && !proof.authProviderIsClerk) {
    add(errors, 'AUTH_IDENTITY_PROVIDER=clerk is required for production Deployment V2 auth');
  }
  if (isProductionLike && !proof.publicAuthProviderIsClerk) {
    add(errors, 'NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER=clerk is required for production Deployment V2 public auth');
  }

  if (authProvider === 'clerk') {
    for (const name of CLERK_REQUIRED) {
      if (!String(values[name] || '').trim()) {
        add(errors, `${name} is required when AUTH_IDENTITY_PROVIDER=clerk`);
      }
    }
    if (!String(values.CLERK_AUDIENCE || '').trim() && !String(values.CLERK_AUTHORIZED_PARTIES || '').trim()) {
      add(errors, 'CLERK_AUDIENCE or CLERK_AUTHORIZED_PARTIES is required when AUTH_IDENTITY_PROVIDER=clerk');
    }

    const operatorOrganizationId = String(values.PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID || '').trim();
    if (operatorOrganizationId && !/^org_[A-Za-z0-9_-]{3,187}$/.test(operatorOrganizationId)) {
      add(errors, 'PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID must be one exact Clerk organization ID');
    }
    const operatorSubjects = splitCsv(values.PLATFORM_OPERATOR_CLERK_SUBJECTS);
    if (operatorSubjects.length > 25) {
      add(errors, 'PLATFORM_OPERATOR_CLERK_SUBJECTS must contain at most 25 exact subject IDs');
    }
    if (new Set(operatorSubjects).size !== operatorSubjects.length) {
      add(errors, 'PLATFORM_OPERATOR_CLERK_SUBJECTS must not contain duplicates');
    }
    for (const subject of operatorSubjects) {
      if (!/^user_[A-Za-z0-9_-]{3,186}$/.test(subject)) {
        add(errors, 'PLATFORM_OPERATOR_CLERK_SUBJECTS entries must be exact Clerk user IDs');
        break;
      }
    }
  }

  for (const [name, rawValue] of Object.entries(values)) {
    if (!AUDITED_NAMES.has(name)) continue;

    const value = String(rawValue || '').trim();
    if (!value) continue;

    if (PLACEHOLDER_RE.test(value)) {
      add(errors, `${name} still contains a placeholder/example value`);
    }

    if (isProductionLike && URL_NAMES.has(name) && LOCALHOST_RE.test(value)) {
      add(errors, `${name} must not point at localhost in production-like env`);
    }

    if (SECRET_NAMES.has(name)) {
      if (value.length < 32) {
        add(errors, `${name} must be at least 32 characters`);
      }
      if (WEAK_SECRET_RE.test(value)) {
        add(errors, `${name} looks like an insecure default secret`);
      }
    }
  }

  if (isProductionLike && isTruthy(values.DEMO_MODE)) {
    add(errors, 'DEMO_MODE=true is forbidden in production-like env');
  }

  if (isProductionLike && isTruthy(values.LOCAL_AUTH_ENABLED)) {
    add(errors, 'LOCAL_AUTH_ENABLED=true is forbidden in production-like env');
  }

  if (isProductionLike && isTruthy(values.NEXT_PUBLIC_LOCAL_AUTH_ENABLED)) {
    add(errors, 'NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true is forbidden in production-like env');
  }

  if (String(values.AI_SUMMARY_ENABLED || 'false').toLowerCase() === 'true') {
    if (!String(values.AWS_REGION || '').trim()) {
      add(errors, 'AWS_REGION is required only when AI_SUMMARY_ENABLED=true');
    }
    if (!String(values.BEDROCK_MODEL || '').trim()) {
      add(errors, 'BEDROCK_MODEL is required only when AI_SUMMARY_ENABLED=true');
    }
    warnings.push('AI summary is enabled; this is outside the no-AWS core runtime gate.');
  }

  if (authProvider === 'cognito') {
    warnings.push('Cognito is legacy-only for Deployment V2 and is not accepted as completed production auth.');
  }

  if (isProductionLike) {
    const appDomain = String(values.APP_DOMAIN || '').trim().toLowerCase();
    if (appDomain.includes('://')) {
      add(errors, 'APP_DOMAIN must be a bare domain, not a URL');
    }
    if (LOCALHOST_RE.test(appDomain)) {
      add(errors, 'APP_DOMAIN must not be localhost in production-like env');
    }

    const siteUrl = requireHttpsUrl('NEXT_PUBLIC_SITE_URL', values.NEXT_PUBLIC_SITE_URL, errors);
    const nextAuthUrl = requireHttpsUrl('NEXTAUTH_URL', values.NEXTAUTH_URL, errors);
    requireHttpsUrl('NEXT_PUBLIC_API_URL', values.NEXT_PUBLIC_API_URL, errors);
    const clerkSignInUrl = requireHttpsUrl('NEXT_PUBLIC_CLERK_SIGN_IN_URL', values.NEXT_PUBLIC_CLERK_SIGN_IN_URL, errors);

    const siteOrigin = normalizeOrigin(siteUrl);
    if (siteUrl && appDomain && siteUrl.hostname.toLowerCase() !== appDomain) {
      add(errors, 'NEXT_PUBLIC_SITE_URL host must match APP_DOMAIN for HTTPS/domain proof');
    }
    if (nextAuthUrl && siteOrigin && normalizeOrigin(nextAuthUrl) !== siteOrigin) {
      add(errors, 'NEXTAUTH_URL origin must match NEXT_PUBLIC_SITE_URL origin');
    }
    if (clerkSignInUrl && siteOrigin && normalizeOrigin(clerkSignInUrl) !== siteOrigin) {
      add(errors, 'NEXT_PUBLIC_CLERK_SIGN_IN_URL origin must match NEXT_PUBLIC_SITE_URL origin');
    }

    for (const name of [
      'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
      'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
      'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
    ]) {
      if (!String(values[name] || '').trim()) continue;
      const url = requireHttpsUrl(name, values[name], errors);
      if (url && siteOrigin && normalizeOrigin(url) !== siteOrigin) {
        add(errors, `${name} origin must match NEXT_PUBLIC_SITE_URL origin`);
      }
    }

    const allowedOrigins = splitCsv(values.ALLOWED_ORIGINS);
    if (allowedOrigins.length === 0) {
      add(errors, 'ALLOWED_ORIGINS must include the public web origin');
    }
    const normalizedAllowedOrigins = [];
    for (const [index, origin] of allowedOrigins.entries()) {
      const url = requireHttpsUrl(`ALLOWED_ORIGINS[${index}]`, origin, errors);
      if (url) normalizedAllowedOrigins.push(normalizeOrigin(url));
    }
    if (siteOrigin && !normalizedAllowedOrigins.includes(siteOrigin)) {
      add(errors, 'ALLOWED_ORIGINS must include NEXT_PUBLIC_SITE_URL origin');
    }

    if (authProvider === 'clerk') {
      const authorizedParties = splitCsv(values.CLERK_AUTHORIZED_PARTIES);
      if (authorizedParties.length === 0) {
        add(errors, 'CLERK_AUTHORIZED_PARTIES must include the public web origin for HTTPS/domain proof');
      }
      const normalizedAuthorizedParties = [];
      for (const [index, origin] of authorizedParties.entries()) {
        const url = requireHttpsUrl(`CLERK_AUTHORIZED_PARTIES[${index}]`, origin, errors);
        if (url) normalizedAuthorizedParties.push(normalizeOrigin(url));
      }
      if (siteOrigin && !normalizedAuthorizedParties.includes(siteOrigin)) {
        add(errors, 'CLERK_AUTHORIZED_PARTIES must include NEXT_PUBLIC_SITE_URL origin');
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const envFile = args[0];
  if (!envFile) {
    console.error('Usage: preflight-env.mjs <env-file>');
    process.exit(2);
  }

  const fullPath = path.resolve(envFile);
  if (!fs.existsSync(fullPath)) {
    console.log(`RUN_MIGRATIONS safety class: ${RUN_MIGRATIONS_UNKNOWN}`);
    console.error('Deployment V2 env preflight failed: RUN_MIGRATIONS_UNKNOWN');
    process.exit(2);
  }

  let fileValues;
  try {
    fileValues = parseEnvFile(fullPath);
  } catch {
    console.log(`RUN_MIGRATIONS safety class: ${RUN_MIGRATIONS_UNKNOWN}`);
    console.error('Deployment V2 env preflight failed: RUN_MIGRATIONS_UNKNOWN');
    process.exit(2);
  }

  const values = fileValues;
  const runMigrationsClass = classifyRunMigrations(values);
  console.log(`RUN_MIGRATIONS safety class: ${runMigrationsClass}`);
  if (runMigrationsClass !== RUN_MIGRATIONS_NOT_TRUE) {
    console.error('Deployment V2 env preflight failed: RUN_MIGRATIONS must not be true for this deploy lane.');
    process.exit(1);
  }

  const { errors, warnings } = validate(values);

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`);
  }

  if (errors.length > 0) {
    console.error('Deployment V2 env preflight failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const proof = authModeProof(values);
  console.log(`AUTH_IDENTITY_PROVIDER is clerk: ${proof.authProviderIsClerk ? 'YES' : 'NO'}`);
  console.log(`NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER is clerk: ${proof.publicAuthProviderIsClerk ? 'YES' : 'NO'}`);
  console.log(`Auth provider envs match: ${proof.authProvidersMatch ? 'YES' : 'NO'}`);
  console.log('Deployment V2 env preflight passed.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export {
  CLERK_REQUIRED,
  REQUIRED,
  RUN_MIGRATIONS_NOT_TRUE,
  RUN_MIGRATIONS_TRUE,
  RUN_MIGRATIONS_UNKNOWN,
  authModeProof,
  classifyRunMigrations,
  parseEnvFile,
  validate,
};
