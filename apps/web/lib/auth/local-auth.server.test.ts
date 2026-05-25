import test from 'node:test';
import assert from 'node:assert/strict';

import { createLocalAccessToken, createLocalSessionUser } from './local-auth.server';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

test('createLocalSessionUser builds a local admin session with HS256 access token', () => {
  process.env.LOCAL_AUTH_JWT_SECRET = 'dev-local-jwt-secret-change-me-32-plus-chars';
  process.env.LOCAL_AUTH_ISSUER = 'oasis-local-dev';

  const user = createLocalSessionUser({
    email: 'boss@local.dev',
    name: 'Boss Local',
    role: 'admin',
  });

  assert.equal(user.role, 'admin');
  assert.deepEqual(user.roles, ['admin']);
  assert.equal(typeof user.accessToken, 'string');

  const payload = decodeJwtPayload(user.accessToken);
  assert.equal(payload.iss, 'oasis-local-dev');
  assert.equal(payload.email, 'boss@local.dev');
});

test('createLocalAccessToken keeps carer role in realm roles', () => {
  process.env.LOCAL_AUTH_JWT_SECRET = 'dev-local-jwt-secret-change-me-32-plus-chars';

  const token = createLocalAccessToken({
    role: 'carer',
    email: 'carer@local.dev',
  });

  const payload = decodeJwtPayload(token);
  assert.deepEqual(payload.realm_access, { roles: ['carer'] });
});

