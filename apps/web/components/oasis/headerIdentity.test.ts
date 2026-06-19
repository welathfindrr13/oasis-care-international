import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createClerkHeaderViewer,
  createNextAuthHeaderViewer,
  getHeaderAccessLabel,
} from './headerIdentity';

test('createClerkHeaderViewer uses Clerk organization admin claims for staff header access', () => {
  const viewer = createClerkHeaderViewer({
    pathname: '/today',
    isLoaded: true,
    isSignedIn: true,
    userName: 'Ada Admin',
    userEmail: 'ada@example.test',
    sessionClaims: {
      org_role: 'org:admin',
    },
  });

  assert.equal(viewer.accessContext.isExternal, false);
  assert.equal(getHeaderAccessLabel(viewer), 'ADMIN');
  assert.equal(viewer.userName, 'Ada Admin');
  assert.equal(viewer.userEmail, 'ada@example.test');
});

test('createClerkHeaderViewer uses explicit family metadata as family access', () => {
  const viewer = createClerkHeaderViewer({
    pathname: '/family',
    isLoaded: true,
    isSignedIn: true,
    userName: 'Family Viewer',
    userEmail: 'family@example.test',
    sessionClaims: {
      public_metadata: { role: 'family' },
    },
  });

  assert.equal(viewer.accessContext.isExternal, true);
  assert.equal(getHeaderAccessLabel(viewer), 'FAMILY ACCESS');
});

test('createNextAuthHeaderViewer preserves the existing loading fallback', () => {
  const viewer = createNextAuthHeaderViewer({
    pathname: '/today',
    status: 'loading',
    roles: [],
    userName: '',
    userEmail: '',
  });

  assert.equal(viewer.accessContext.isExternal, false);
  assert.equal(getHeaderAccessLabel(viewer), 'ADMIN');
});
