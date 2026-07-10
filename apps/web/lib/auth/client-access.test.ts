import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientAccessSnapshot } from './client-access';
import { AuthoritativeAccessSnapshot, unavailableAccessSnapshot } from './access-snapshot';

function ready(surface: 'ADMIN' | 'STAFF' | 'FAMILY', effectiveRole: string): AuthoritativeAccessSnapshot {
  return {
    authenticated: true,
    organizationId: 'org-1',
    effectiveRole,
    membershipState: 'ACTIVE',
    surface,
    linkedIdentityState: surface === 'ADMIN' ? 'NOT_REQUIRED' : 'LINKED',
    onboardingState: 'READY',
    resolution: 'READY',
  };
}

test('authoritative admin, carer and family snapshots drive capabilities', () => {
  const admin = createClientAccessSnapshot('authenticated', ready('ADMIN', 'admin'));
  const carer = createClientAccessSnapshot('authenticated', ready('STAFF', 'carer'));
  const family = createClientAccessSnapshot('authenticated', ready('FAMILY', 'family'));

  assert.equal(admin.isAdmin, true);
  assert.equal(admin.isStaff, true);
  assert.equal(carer.isCarer, true);
  assert.equal(carer.isAdmin, false);
  assert.equal(family.accessContext.workspace, 'family');
  assert.equal(family.isStaff, false);
});

test('provider loading and unavailable resolution expose no prior capabilities', () => {
  for (const access of [
    createClientAccessSnapshot('loading', ready('ADMIN', 'admin')),
    createClientAccessSnapshot('authenticated', unavailableAccessSnapshot()),
    createClientAccessSnapshot('unauthenticated', ready('ADMIN', 'admin')),
  ]) {
    assert.equal(access.authenticated, false);
    assert.equal(access.isAdmin, false);
    assert.equal(access.isCarer, false);
    assert.equal(access.isStaff, false);
    assert.equal(access.roles.length, 0);
    assert.equal(access.accessContext.workspace, 'none');
  }
});

test('client access accepts no provider claim roles, so the server snapshot always wins', () => {
  const databaseCarer = createClientAccessSnapshot('authenticated', ready('STAFF', 'carer'));
  assert.deepEqual(databaseCarer.roles, ['carer']);
  assert.equal(databaseCarer.isAdmin, false);
});
