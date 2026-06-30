#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLACEHOLDER_RE = /(<[^>]+>|replace-me|changeme|change-me|placeholder|example\.com|example\.invalid|oasis-care\.local|your-domain|your-|ci-|dummy|test-secret)/i;
const LOCALHOST_RE = /(^|[/:@])(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?=$|[/:?#])/i;
const WEAK_SECRET_RE = /^(password|secret|jwt-secret|nextauth-secret|postgres|oasis|admin|changeme|replace-me)$/i;

const REQUIRED = [
  'APP_DOMAIN',
  'ACME_EMAIL',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'DATABASE_URL',
  'JWT_SECRET',
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
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
];

const SECRET_NAMES = new Set([
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
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

function isTruthy(value) {
  return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
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
    console.error(`Env file not found: ${fullPath}`);
    process.exit(2);
  }

  const fileValues = parseEnvFile(fullPath);
  const values = fileValues;
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

export { CLERK_REQUIRED, REQUIRED, authModeProof, parseEnvFile, validate };
