const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const middlewareSource = fs.readFileSync(path.join(__dirname, 'middleware.ts'), 'utf8')

test('Clerk middleware runs for authenticated API proxy routes', () => {
  const matcherBlock = middlewareSource.slice(middlewareSource.indexOf('export const config'))

  assert.doesNotMatch(matcherBlock, /\|api\/graphql/)
  assert.doesNotMatch(matcherBlock, /\|api\/evidence-packs/)
  assert.match(middlewareSource, /'\/api\/graphql\(\.\*\)'/)
  assert.match(middlewareSource, /'\/api\/evidence-packs\(\.\*\)'/)
})

test('logged-out users are redirected before protected route content can render', () => {
  assert.match(
    middlewareSource,
    /callbacks:\s*\{\s*authorized:\s*\(\{ token \}\) => !!token,?\s*\}/,
  )
  assert.match(middlewareSource, /pages:\s*\{\s*signIn:\s*'\/login',?\s*\}/)

  const clerkBlock = middlewareSource.slice(
    middlewareSource.indexOf('const clerkAuthMiddleware'),
    middlewareSource.indexOf('export default function middleware'),
  )
  const signedOutIndex = clerkBlock.indexOf('if (!authObject.userId)')
  const signInIndex = clerkBlock.indexOf('authObject.redirectToSignIn()')
  const routeDecisionIndex = clerkBlock.indexOf('resolveAuthenticatedRoute')
  const renderIndex = clerkBlock.lastIndexOf('NextResponse.next()')

  assert.ok(signedOutIndex >= 0)
  assert.ok(signInIndex > signedOutIndex)
  assert.ok(routeDecisionIndex > signInIndex)
  assert.ok(renderIndex > routeDecisionIndex)
})

test('authenticated route decisions happen before Next.js renders protected content', () => {
  const nextAuthBlock = middlewareSource.slice(
    middlewareSource.indexOf('const nextAuthMiddleware'),
    middlewareSource.indexOf('const clerkAuthMiddleware'),
  )
  const routeDecisionIndex = nextAuthBlock.indexOf('resolveAuthenticatedRoute')
  const renderIndex = nextAuthBlock.indexOf('NextResponse.next()')

  assert.ok(routeDecisionIndex >= 0)
  assert.ok(renderIndex > routeDecisionIndex)
})
