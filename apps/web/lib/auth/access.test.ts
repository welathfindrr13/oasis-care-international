import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAccessContext,
  resolveAuthoritativeRoute,
  resolveAuthenticatedRoute,
  resolveProtectedRoute,
  shouldBypassAuthoritativeRoute,
} from './access'
import { AuthoritativeAccessSnapshot } from './access-snapshot'

const ready = (surface: 'ADMIN' | 'STAFF' | 'FAMILY'): AuthoritativeAccessSnapshot => ({
  authenticated: true,
  organizationId: 'org-1',
  effectiveRole: surface === 'ADMIN' ? 'admin' : surface === 'STAFF' ? 'carer' : 'family',
  membershipState: 'ACTIVE',
  surface,
  linkedIdentityState: surface === 'ADMIN' ? 'NOT_REQUIRED' : 'LINKED',
  onboardingState: 'READY',
  resolution: 'READY',
})

test('unknown roles never become family or admin access', () => {
  const context = getAccessContext([])
  assert.equal(context.workspace, 'none')
  assert.equal(context.isExternal, false)
  assert.equal(context.isAdmin, false)
})

test('pre-workspace and offline routes bypass authoritative workspace redirects', () => {
  for (const pathname of [
    '/offline',
    '/offline/help',
    '/accept-invitation',
    '/accept-invitation/complete',
    '/activate-invitation',
    '/activate-invitation/complete',
    '/platform',
    '/platform/company-requests',
  ]) {
    assert.equal(shouldBypassAuthoritativeRoute(pathname), true, pathname)
  }
  for (const pathname of ['/today', '/access', '/admin/setup']) {
    assert.equal(shouldBypassAuthoritativeRoute(pathname), false, pathname)
  }
})

test('canonical snapshot routes admin, carer and family surfaces', () => {
  assert.deepEqual(resolveAuthoritativeRoute('/access', ready('ADMIN')), { action: 'redirect', destination: '/today' })
  assert.deepEqual(resolveAuthoritativeRoute('/management', ready('STAFF')), { action: 'redirect', destination: '/today' })
  assert.deepEqual(resolveAuthoritativeRoute('/today', ready('FAMILY')), { action: 'redirect', destination: '/family' })
})

test('ready access redirects stale denial-state URLs back to the canonical workspace', () => {
  assert.deepEqual(resolveAuthoritativeRoute('/access/disabled', ready('ADMIN')), {
    action: 'redirect', destination: '/today',
  })
  assert.deepEqual(resolveAuthoritativeRoute('/access/no-membership', ready('FAMILY')), {
    action: 'redirect', destination: '/family',
  })
})

test('canonical denied states have explicit provider-neutral routes', () => {
  const base: AuthoritativeAccessSnapshot = {
    ...ready('ADMIN'),
    effectiveRole: null,
    surface: 'NONE',
    resolution: 'DENIED',
  }
  assert.deepEqual(resolveAuthoritativeRoute('/today', { ...base, membershipState: 'MISSING', onboardingState: 'NOT_STARTED' }), {
    action: 'redirect', destination: '/access/no-membership',
  })
  assert.deepEqual(resolveAuthoritativeRoute('/today', { ...base, membershipState: 'INACTIVE', onboardingState: 'BLOCKED' }), {
    action: 'redirect', destination: '/access/disabled',
  })
  assert.deepEqual(resolveAuthoritativeRoute('/today', { ...base, membershipState: 'ACTIVE', onboardingState: 'PENDING_INVITATION' }), {
    action: 'redirect', destination: '/access/pending',
  })
})

test('treats generic authenticated users as external family users', () => {
  const context = getAccessContext(['user'])

  assert.equal(context.workspace, 'family')
  assert.equal(context.isExternal, true)
  assert.equal(context.homePath, '/family')
})

test('treats carers as staff users', () => {
  const context = getAccessContext(['carer'])

  assert.equal(context.workspace, 'staff')
  assert.equal(context.isExternal, false)
  assert.equal(context.homePath, '/today')
})

test('treats client users as external family users', () => {
  const context = getAccessContext(['client'])

  assert.equal(context.workspace, 'family')
  assert.equal(context.isExternal, true)
  assert.equal(context.homePath, '/family')
})

test('redirects external users away from staff routes', () => {
  const decision = resolveAuthenticatedRoute('/dashboard', ['user'])

  assert.deepEqual(decision, {
    action: 'redirect',
    destination: '/family',
  })
})

test('redirects client users away from staff routes', () => {
  const decision = resolveAuthenticatedRoute('/dashboard', ['client'])

  assert.deepEqual(decision, {
    action: 'redirect',
    destination: '/family',
  })
})

test('sends authenticated users to the right home workspace from root', () => {
  assert.deepEqual(resolveAuthenticatedRoute('/', ['user']), {
    action: 'redirect',
    destination: '/family',
  })

  assert.deepEqual(resolveAuthenticatedRoute('/', ['admin']), {
    action: 'redirect',
    destination: '/today',
  })
})

test('allows external users into the family area', () => {
  const decision = resolveAuthenticatedRoute('/family', ['user'])

  assert.deepEqual(decision, {
    action: 'allow',
  })
})

test('redirects staff users away from the family area', () => {
  const decision = resolveAuthenticatedRoute('/family', ['admin'])

  assert.deepEqual(decision, {
    action: 'redirect',
    destination: '/today',
  })
})

test('keeps admin-only pages restricted for non-admin staff', () => {
  const decision = resolveAuthenticatedRoute('/admin/analytics', ['carer'])

  assert.deepEqual(decision, {
    action: 'redirect',
    destination: '/today',
  })
})

test('allows admins to open activity reporting', () => {
  const decision = resolveAuthenticatedRoute('/activity', ['admin'])

  assert.deepEqual(decision, {
    action: 'allow',
  })
})

test('redirects staff away from activity reporting', () => {
  const decision = resolveAuthenticatedRoute('/activity', ['carer'])

  assert.deepEqual(decision, {
    action: 'redirect',
    destination: '/today',
  })
})

test('redirects family users away from activity reporting', () => {
  const decision = resolveAuthenticatedRoute('/activity', ['client'])

  assert.deepEqual(decision, {
    action: 'redirect',
    destination: '/family',
  })
})

const managementRoutes = [
  '/management',
  '/management/operations',
  '/activity',
  '/staff',
  '/staff/training',
  '/evidence',
  '/reports',
  '/admin',
  '/admin/carers',
  '/admin/analytics',
  '/admin/metrics',
  '/people/new',
  '/clients/new',
  '/schedule/new',
  '/visits/new',
]

test('allows admins to access management routes and equivalent aliases', () => {
  for (const pathname of managementRoutes) {
    assert.deepEqual(resolveProtectedRoute(pathname, true, ['admin']), {
      action: 'allow',
    }, pathname)
  }
})

test('denies carers who enter management routes and aliases directly', () => {
  for (const pathname of managementRoutes) {
    assert.deepEqual(resolveProtectedRoute(pathname, true, ['carer']), {
      action: 'redirect',
      destination: '/today',
    }, pathname)
  }
})

test('denies family users before management content can render', () => {
  for (const pathname of managementRoutes) {
    assert.deepEqual(resolveProtectedRoute(pathname, true, ['user']), {
      action: 'redirect',
      destination: '/family',
    }, pathname)
  }
})

test('redirects logged-out management requests to login before render', () => {
  assert.deepEqual(resolveProtectedRoute('/management', false, []), {
    action: 'redirect',
    destination: '/login',
  })
})

test('keeps shared staff workflows available to carers', () => {
  for (const pathname of [
    '/people',
    '/schedule',
    '/medication',
    '/family-updates',
    '/care-planning',
    '/settings',
  ]) {
    assert.deepEqual(resolveAuthenticatedRoute(pathname, ['carer']), {
      action: 'allow',
    }, pathname)
  }
})
