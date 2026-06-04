import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAccessContext,
  resolveAuthenticatedRoute,
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
