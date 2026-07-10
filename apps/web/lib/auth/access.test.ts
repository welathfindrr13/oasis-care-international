import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAccessContext,
  resolveAuthenticatedRoute,
  resolveProtectedRoute,
} from './access'

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
