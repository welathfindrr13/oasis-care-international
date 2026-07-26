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
  capabilities:
    surface === 'ADMIN'
      ? ['PROFILE_HELP_VIEW', 'TENANT_ADMIN', 'PEOPLE_MANAGE']
      : surface === 'STAFF'
        ? [
            'PROFILE_HELP_VIEW',
            'FRONTLINE_SHIFT_VIEW',
            'FRONTLINE_SHIFT_EXECUTE',
            'FRONTLINE_ASSIGNED_VISITS_VIEW',
            'FRONTLINE_VISIT_EXECUTE',
          ]
        : ['FAMILY_UPDATES_VIEW', 'FAMILY_CONCERN_CREATE'],
  medicationEmarEnabled: false,
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
    '/request-access',
    '/request-access/complete',
    '/accept-invitation',
    '/accept-invitation/complete',
    '/activate-invitation',
    '/activate-invitation/complete',
    '/session-tasks/choose-organization',
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

test('authentication remains ahead of the medication launch boundary', () => {
  assert.deepEqual(
    resolveAuthoritativeRoute('/emar', {
      ...ready('ADMIN'),
      authenticated: false,
      resolution: 'UNAUTHENTICATED',
    }),
    { action: 'redirect', destination: '/login' },
  )
})

test('canonical snapshot fails closed for direct medication routes', () => {
  for (const pathname of ['/medication', '/medication/history', '/emar', '/emar/round']) {
    assert.deepEqual(resolveAuthoritativeRoute(pathname, ready('ADMIN')), {
      action: 'redirect',
      destination: '/access/feature-not-enabled',
    })
  }
  assert.deepEqual(
    resolveAuthoritativeRoute('/emar', {
      ...ready('ADMIN'),
      medicationEmarEnabled: true,
    }),
    { action: 'allow' },
  )
})

test('restricted management snapshots route only to Settings', () => {
  for (const effectiveRole of ['manager', 'care_manager', 'office']) {
    const snapshot: AuthoritativeAccessSnapshot = {
      ...ready('STAFF'),
      effectiveRole,
      linkedIdentityState: 'NOT_REQUIRED',
      capabilities:
        effectiveRole === 'manager'
          ? ['PROFILE_HELP_VIEW', 'AI_SUMMARY_REVIEW', 'GDPR_MANAGE']
          : ['PROFILE_HELP_VIEW'],
    }
    assert.deepEqual(resolveAuthoritativeRoute('/', snapshot), {
      action: 'redirect',
      destination: '/settings',
    })
    assert.deepEqual(resolveAuthoritativeRoute('/today', snapshot), {
      action: 'redirect',
      destination: '/settings',
    })
    assert.deepEqual(resolveAuthoritativeRoute('/settings', snapshot), {
      action: 'allow',
    })
  }
})

test('authoritative routing consumes capabilities instead of a second role policy', () => {
  const managementWithFrontlineAccess: AuthoritativeAccessSnapshot = {
    ...ready('STAFF'),
    effectiveRole: 'manager',
    linkedIdentityState: 'NOT_REQUIRED',
    capabilities: [
      'PROFILE_HELP_VIEW',
      'FRONTLINE_ASSIGNED_VISITS_VIEW',
    ],
  }
  assert.deepEqual(resolveAuthoritativeRoute('/today', managementWithFrontlineAccess), {
    action: 'allow',
  })
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
    capabilities: [],
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

test('care planning requires authoritative tenant administration', () => {
  assert.deepEqual(
    resolveAuthoritativeRoute('/care-planning', ready('ADMIN')),
    { action: 'allow' },
  )
  for (const pathname of ['/care-planning', '/care-planning/client-1']) {
    assert.deepEqual(
      resolveAuthoritativeRoute(pathname, ready('STAFF')),
      { action: 'redirect', destination: '/today' },
    )
    assert.deepEqual(
      resolveAuthoritativeRoute(pathname, ready('FAMILY')),
      { action: 'redirect', destination: '/family' },
    )
  }
})

test('allows admins to open activity reporting', () => {
  const decision = resolveAuthenticatedRoute(
    '/activity',
    ['admin'],
    ['TENANT_ADMIN'],
  )

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
  '/dashboard',
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
    assert.deepEqual(resolveProtectedRoute(
      pathname,
      true,
      ['admin'],
      ['TENANT_ADMIN'],
    ), {
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

test('frontline carers can open assigned work but not generic client profiles', () => {
  const capabilities = [
    'PROFILE_HELP_VIEW',
    'FRONTLINE_SHIFT_VIEW',
    'FRONTLINE_SHIFT_EXECUTE',
    'FRONTLINE_ASSIGNED_VISITS_VIEW',
    'FRONTLINE_VISIT_EXECUTE',
  ] as const

  for (const pathname of [
    '/today',
    '/visits',
    '/visits/visit-1',
    '/schedule/visit-1',
    '/shift',
    '/settings',
  ]) {
    assert.deepEqual(resolveAuthenticatedRoute(pathname, ['carer'], capabilities), {
      action: 'allow',
    }, pathname)
  }

  for (const pathname of [
    '/people',
    '/people/client-1',
    '/clients/client-1',
    '/schedule',
    '/schedule/new',
    '/medication',
    '/family-updates',
    '/family-updates/approvals',
    '/carebridge',
    '/care-planning',
    '/evidence',
    '/visits/new',
  ]) {
    assert.deepEqual(resolveAuthenticatedRoute(pathname, ['carer'], capabilities), {
      action: 'redirect',
      destination: '/today',
    }, pathname)
  }
})

test('tenant administrators retain access to both client profile aliases', () => {
  for (const pathname of ['/clients/client-1', '/people/client-1']) {
    assert.deepEqual(
      resolveAuthenticatedRoute(pathname, ['admin'], ['TENANT_ADMIN']),
      { action: 'allow' },
      pathname,
    )
  }
})
