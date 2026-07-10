import test from 'node:test';
import assert from 'node:assert/strict';

import { createHeaderViewer, getHeaderAccessLabel } from './headerIdentity';

test('canonical admin roles produce staff header access independently of the identity provider', () => {
  const viewer = createHeaderViewer({
    pathname: '/today',
    status: 'authenticated',
    roles: ['admin'],
    userName: 'Ada Admin',
    userEmail: 'ada@example.test',
  });

  assert.equal(viewer.accessContext.isExternal, false);
  assert.equal(getHeaderAccessLabel(viewer), 'ADMIN');
  assert.equal(viewer.userName, 'Ada Admin');
  assert.equal(viewer.userEmail, 'ada@example.test');
});

test('canonical family roles produce family header access', () => {
  const viewer = createHeaderViewer({
    pathname: '/family',
    status: 'authenticated',
    roles: ['user'],
    userName: 'Family Viewer',
    userEmail: 'family@example.test',
  });

  assert.equal(viewer.accessContext.isExternal, true);
  assert.equal(getHeaderAccessLabel(viewer), 'FAMILY ACCESS');
});

test('provider loading exposes no stale role or workspace', () => {
  const viewer = createHeaderViewer({
    pathname: '/today',
    status: 'loading',
    roles: ['admin'],
    userName: '',
    userEmail: '',
  });

  assert.equal(viewer.accessContext.isExternal, false);
  assert.equal(viewer.accessContext.workspace, 'none');
  assert.equal(viewer.isAdmin, false);
  assert.equal(getHeaderAccessLabel(viewer), '');
});
