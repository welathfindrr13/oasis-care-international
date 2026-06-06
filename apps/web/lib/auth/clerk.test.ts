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

test('extractClerkRolesFromClaims does not treat default org member as staff', () => {
  const roles = extractClerkRolesFromClaims({ org_role: 'org:member' });

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
});

test('getClerkBearerTokenFromCookieHeader extracts Clerk session token without logging it', () => {
  const token = 'header.payload.signature';
  const cookie = `theme=dark; __session=${encodeURIComponent(token)}; other=value`;

  assert.equal(getClerkBearerTokenFromCookieHeader(cookie), token);
});

test('getClerkBearerTokenFromCookieHeader supports suffixed Clerk session cookies', () => {
  const token = 'tenant.header.payload';
  const cookie = `__session_oasis=${encodeURIComponent(token)}`;

  assert.equal(getClerkBearerTokenFromCookieHeader(cookie), token);
});
