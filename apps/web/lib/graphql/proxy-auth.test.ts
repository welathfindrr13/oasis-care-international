import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDirectBearerToken,
  resolveGraphQLProxyAccessToken,
} from './proxy-auth';

test('getDirectBearerToken extracts explicit Authorization bearer token', () => {
  assert.equal(getDirectBearerToken('Bearer direct.jwt.value'), 'direct.jwt.value');
  assert.equal(getDirectBearerToken('bearer lower.jwt.value'), 'lower.jwt.value');
  assert.equal(getDirectBearerToken('Basic nope'), '');
  assert.equal(getDirectBearerToken(null), '');
});

test('resolveGraphQLProxyAccessToken gives explicit bearer priority', () => {
  const token = resolveGraphQLProxyAccessToken({
    authorizationHeader: 'Bearer direct.jwt.value',
    clerkMode: true,
    serverAuthAccessToken: 'server.jwt.value',
    cookieHeader: '__session=cookie.jwt.value',
  });

  assert.equal(token, 'direct.jwt.value');
});

test('resolveGraphQLProxyAccessToken prefers server Clerk token over cookie fallback', () => {
  const token = resolveGraphQLProxyAccessToken({
    clerkMode: true,
    serverAuthAccessToken: 'server.jwt.value',
    cookieHeader: `theme=dark; __session=${encodeURIComponent('cookie.jwt.value')}`,
  });

  assert.equal(token, 'server.jwt.value');
});

test('resolveGraphQLProxyAccessToken falls back to Clerk session cookie when server token is unavailable', () => {
  const token = resolveGraphQLProxyAccessToken({
    clerkMode: true,
    cookieHeader: `theme=dark; __session=${encodeURIComponent('cookie.jwt.value')}`,
  });

  assert.equal(token, 'cookie.jwt.value');
});

test('resolveGraphQLProxyAccessToken preserves NextAuth token order outside Clerk mode', () => {
  assert.equal(
    resolveGraphQLProxyAccessToken({
      clerkMode: false,
      serverAuthAccessToken: 'server.jwt.value',
      nextAuthAccessToken: 'access.jwt.value',
      nextAuthIdToken: 'id.jwt.value',
      cookieHeader: '__session=clerk.jwt.value',
    }),
    'server.jwt.value',
  );

  assert.equal(
    resolveGraphQLProxyAccessToken({
      clerkMode: false,
      nextAuthAccessToken: 'access.jwt.value',
      nextAuthIdToken: 'id.jwt.value',
      cookieHeader: '__session=clerk.jwt.value',
    }),
    'access.jwt.value',
  );

  assert.equal(
    resolveGraphQLProxyAccessToken({
      clerkMode: false,
      nextAuthIdToken: 'id.jwt.value',
      cookieHeader: '__session=clerk.jwt.value',
    }),
    'id.jwt.value',
  );
});

test('resolveGraphQLProxyAccessToken returns empty string when no supported auth material exists', () => {
  assert.equal(resolveGraphQLProxyAccessToken({ clerkMode: true }), '');
  assert.equal(resolveGraphQLProxyAccessToken({ clerkMode: false }), '');
});
