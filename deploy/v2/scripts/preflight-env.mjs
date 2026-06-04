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
  'COGNITO_ISSUER',
  'COGNITO_CLIENT_ID',
  'COGNITO_CLIENT_SECRET',
  'LOCAL_AUTH_ENABLED',
  'NEXT_PUBLIC_LOCAL_AUTH_ENABLED',
  'RUN_MIGRATIONS',
];

const SECRET_NAMES = new Set([
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'NEXTAUTH_SECRET',
  'COGNITO_CLIENT_SECRET',
  'LOCAL_AUTH_JWT_SECRET',
  'DEMO_SEED_TOKEN',
]);

const URL_NAMES = new Set([
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SITE_URL',
  'ALLOWED_ORIGINS',
  'COGNITO_ISSUER',
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

  for (const [name, rawValue] of Object.entries(values)) {
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

  if (String(values.AUTH_IDENTITY_PROVIDER || '').trim().toLowerCase() !== 'cognito') {
    warnings.push('AUTH_IDENTITY_PROVIDER is not cognito; current production auth code is still Cognito-shaped and needs explicit QA/code review.');
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
  const values = { ...fileValues, ...process.env };
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

  console.log('Deployment V2 env preflight passed.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}

export { parseEnvFile, validate };
