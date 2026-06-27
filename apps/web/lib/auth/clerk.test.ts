import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractClerkRolesFromClaims,
  getClerkBearerTokenFromCookieHeader,
  getClerkOrganizationIdFromClaims,
} from './clerk';

test('extractClerkRolesFromClaims maps Clerk organization admin to Oasis admin', () => {
  const roles = extractClerkRolesFromClaims({ org_role: 'org:admin' });

  assert(roles.includes('admin'));
});

test('extractClerkRolesFromClaims maps current Clerk compact organization admin claim', () => {
  const roles = extractClerkRolesFromClaims({ o: { id: 'org_123', rol: 'admin' } });

  assert(roles.includes('admin'));
});

test('extractClerkRolesFromClaims does not treat default org member as staff', () => {
  const roles = extractClerkRolesFromClaims({ org_role: 'org:member' });

  assert.equal(roles[0], 'user');
  assert(!roles.includes('carer'));
  assert(!roles.includes('admin'));
});

test('extractClerkRolesFromClaims does not treat compact Clerk member as staff', () => {
  const roles = extractClerkRolesFromClaims({ o: { id: 'org_123', rol: 'member' } });

  assert.equal(roles[0], 'user');
  assert(!roles.includes('carer'));
  assert(!roles.includes('admin'));
});

test('extractClerkRolesFromClaims uses explicit Oasis metadata role for staff/family split', () => {
  assert(extractClerkRolesFromClaims({ public_metadata: { role: 'carer' } }).includes('carer'));
  assert(extractClerkRolesFromClaims({ public_metadata: { role: 'family' } }).includes('client'));
});

test('extractClerkRolesFromClaims ignores unsafe metadata roles', () => {
  const roles = extractClerkRolesFromClaims({
    org_role: 'org:member',
    unsafe_metadata: { role: 'admin', roles: ['carer'] },
  });

  assert.deepEqual(roles, ['user']);
});

test('getClerkOrganizationIdFromClaims resolves active organization claim variants', () => {
  assert.equal(getClerkOrganizationIdFromClaims({ org_id: 'org_123' }), 'org_123');
  assert.equal(getClerkOrganizationIdFromClaims({ organizationId: 'org_456' }), 'org_456');
  assert.equal(getClerkOrganizationIdFromClaims({ o: { id: 'org_789', rol: 'admin' } }), 'org_789');
});

test('getClerkBearerTokenFromCookieHeader extracts exact Clerk session token', () => {
  const token = 'header.payload.signature';
  const cookie = `theme=dark; __session=${encodeURIComponent(token)}; other=value`;

  assert.equal(getClerkBearerTokenFromCookieHeader(cookie), token);
});

test('getClerkBearerTokenFromCookieHeader supports suffixed Clerk session cookies as fallback', () => {
  const token = 'tenant.header.payload';
  const cookie = `__session_oasis=${encodeURIComponent(token)}`;

  assert.equal(getClerkBearerTokenFromCookieHeader(cookie), token);
});

test('getClerkBearerTokenFromCookieHeader prefers exact session cookie over suffixed cookies', () => {
  const exactToken = 'exact.header.payload';
  const suffixedToken = 'suffix.header.payload';
  const cookie = `__session_oasis=${encodeURIComponent(suffixedToken)}; __session=${encodeURIComponent(exactToken)}`;

  assert.equal(getClerkBearerTokenFromCookieHeader(cookie), exactToken);
});

test('getClerkBearerTokenFromCookieHeader uses first suffixed cookie deterministically', () => {
  const firstToken = 'first.header.payload';
  const secondToken = 'second.header.payload';
  const cookie = `__session_oasis=${encodeURIComponent(firstToken)}; __session_other=${encodeURIComponent(secondToken)}`;

  assert.equal(getClerkBearerTokenFromCookieHeader(cookie), firstToken);
});

test('getClerkBearerTokenFromCookieHeader ignores unrelated and empty cookies', () => {
  assert.equal(getClerkBearerTokenFromCookieHeader(null), '');
  assert.equal(getClerkBearerTokenFromCookieHeader(undefined), '');
  assert.equal(getClerkBearerTokenFromCookieHeader('theme=dark; session=not-clerk'), '');
  assert.equal(getClerkBearerTokenFromCookieHeader('__session=; __session_oasis='), '');
});

test('getClerkBearerTokenFromCookieHeader ignores malformed cookie chunks without crashing', () => {
  const token = 'valid.header.payload';
  const cookie = `no-equals; =missing-name; __session_oasis=${encodeURIComponent(token)}; also-bad`;

  assert.equal(getClerkBearerTokenFromCookieHeader(cookie), token);
});

test('getClerkBearerTokenFromCookieHeader decodes URL-encoded values and preserves invalid escapes', () => {
  const encodedToken = 'header.payload/with+symbols';

  assert.equal(
    getClerkBearerTokenFromCookieHeader(`__session=${encodeURIComponent(encodedToken)}`),
    encodedToken,
  );
  assert.equal(getClerkBearerTokenFromCookieHeader('__session=bad%token'), 'bad%token');
});
