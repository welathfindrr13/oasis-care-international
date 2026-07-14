import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const webRoot = path.resolve(import.meta.dirname, '..')
const repositoryRoot = path.resolve(webRoot, '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(webRoot, relativePath), 'utf8')
}

test('active web authentication supports Clerk and the explicit local fixture only', () => {
  const modeSource = source('lib/auth/mode.ts')
  const authOptionsSource = source('app/api/auth/[...nextauth]/authOptions.ts')
  const nextAuthRouteSource = source('app/api/auth/[...nextauth]/route.ts')

  assert.match(modeSource, /export type AuthMode = 'clerk' \| 'local'/)
  assert.match(modeSource, /Unsupported auth identity provider/)
  assert.doesNotMatch(authOptionsSource, /providers\/cognito/i)
  assert.doesNotMatch(authOptionsSource, /COGNITO_/)
  assert.match(nextAuthRouteSource, /isLocalAuthEnabled\(process\.env\)/)
  assert.match(nextAuthRouteSource, /status: 404/)
})

test('the legacy hosted-provider logout endpoint is removed', () => {
  assert.equal(
    fs.existsSync(path.join(webRoot, 'app/api/auth/cognito-logout/route.ts')),
    false,
  )
  assert.doesNotMatch(source('components/oasis/Header.tsx'), /cognito-logout/i)
})

test('CI builds the production web path with Clerk configuration only', () => {
  const workflow = fs.readFileSync(
    path.join(repositoryRoot, '.github/workflows/ci.yml'),
    'utf8',
  )

  assert.doesNotMatch(workflow, /COGNITO_(?:ISSUER|CLIENT_ID|CLIENT_SECRET):/)
  assert.match(workflow, /AUTH_IDENTITY_PROVIDER: clerk/)
  assert.match(workflow, /NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: clerk/)
  assert.match(workflow, /export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=/)
})

test('browser fixtures select the explicit local web provider without Cognito', () => {
  const accessibilityConfig = fs.readFileSync(
    path.join(repositoryRoot, 'playwright.accessibility.config.ts'),
    'utf8',
  )
  const linkedCarerConfig = fs.readFileSync(
    path.join(repositoryRoot, 'playwright.linked-carer.config.ts'),
    'utf8',
  )
  const linkedCarerWebServer = linkedCarerConfig.split('@oasis/web dev')[1] || ''

  assert.doesNotMatch(accessibilityConfig, /AUTH_IDENTITY_PROVIDER:\s*["']cognito["']/)
  assert.doesNotMatch(linkedCarerWebServer, /AUTH_IDENTITY_PROVIDER:\s*["']cognito["']/)
  assert.match(accessibilityConfig, /LOCAL_AUTH_ENABLED:\s*["']true["']/)
  assert.match(linkedCarerWebServer, /LOCAL_AUTH_ENABLED:\s*["']true["']/)
})
