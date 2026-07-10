import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveProtectedRoute } from './access';
import {
  createClerkClientAccessSnapshot,
  createNextAuthClientAccessSnapshot,
} from './client-access';

test('Clerk admin is authenticated for visit creation and medication provisioning access', () => {
  const access = createClerkClientAccessSnapshot({
    isLoaded: true,
    isSignedIn: true,
    sessionClaims: { org_role: 'org:admin' },
  });

  assert.equal(access.status, 'authenticated');
  assert.equal(access.authenticated, true);
  assert.equal(access.isAdmin, true);
  assert.equal(access.isStaff, true);
});

test('Clerk carer is authenticated for staff visit workspace paths without admin access', () => {
  const access = createClerkClientAccessSnapshot({
    isLoaded: true,
    isSignedIn: true,
    sessionClaims: { public_metadata: { role: 'carer' } },
  });

  assert.equal(access.authenticated, true);
  assert.equal(access.isCarer, true);
  assert.equal(access.isStaff, true);
  assert.equal(access.isAdmin, false);
});

test('Clerk family identity cannot pass staff visit or medication access checks', () => {
  const access = createClerkClientAccessSnapshot({
    isLoaded: true,
    isSignedIn: true,
    sessionClaims: { public_metadata: { role: 'family' } },
  });

  assert.equal(access.authenticated, true);
  assert.equal(access.isStaff, false);
  assert.equal(access.isAdmin, false);
  assert.equal(access.accessContext.workspace, 'family');
});

test('NextAuth admin and carer behavior remains unchanged', () => {
  const admin = createNextAuthClientAccessSnapshot({
    status: 'authenticated',
    roles: ['admin'],
  });
  const carer = createNextAuthClientAccessSnapshot({
    status: 'authenticated',
    roles: ['carer'],
  });

  assert.equal(admin.isAdmin, true);
  assert.equal(admin.isStaff, true);
  assert.equal(carer.isAdmin, false);
  assert.equal(carer.isCarer, true);
  assert.equal(carer.isStaff, true);
});

test('loading and logged-out identities fail closed', () => {
  for (const access of [
    createClerkClientAccessSnapshot({ isLoaded: false, isSignedIn: true }),
    createClerkClientAccessSnapshot({ isLoaded: true, isSignedIn: false }),
    createNextAuthClientAccessSnapshot({ status: 'unauthenticated', roles: ['admin'] }),
  ]) {
    assert.equal(access.authenticated, false);
    assert.equal(access.isAdmin, false);
    assert.equal(access.isCarer, false);
    assert.equal(access.isStaff, false);
  }
});

test('management-route denial from PR 92 remains enforced for carers and family users', () => {
  assert.deepEqual(resolveProtectedRoute('/management', true, ['carer']), {
    action: 'redirect',
    destination: '/today',
  });
  assert.deepEqual(resolveProtectedRoute('/management', true, ['user']), {
    action: 'redirect',
    destination: '/family',
  });
});

test('logged-out clinical routes still redirect to login before client access runs', () => {
  for (const pathname of ['/visits/visit_123', '/clients/client_123/care-logs', '/medication']) {
    assert.deepEqual(resolveProtectedRoute(pathname, false, []), {
      action: 'redirect',
      destination: '/login',
    }, pathname);
  }
});
