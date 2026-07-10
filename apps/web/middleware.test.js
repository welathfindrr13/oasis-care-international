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
    /callbacks:\s*\{\s*authorized:\s*\(\{ token, req \}\) => isPublicRoute\(req as any\) \|\| !!token,?\s*\}/,
  )
  assert.match(middlewareSource, /pages:\s*\{\s*signIn:\s*'\/login',?\s*\}/)

  const clerkBlock = middlewareSource.slice(
    middlewareSource.indexOf('const clerkAuthMiddleware'),
    middlewareSource.indexOf('export default function middleware'),
  )
  const signedOutIndex = clerkBlock.indexOf('if (!authObject.userId)')
  const signInIndex = clerkBlock.indexOf('authObject.redirectToSignIn()')
  const routeDecisionIndex = clerkBlock.indexOf('resolveAuthoritativeRoute')
  const renderIndex = clerkBlock.lastIndexOf('NextResponse.next()')

  assert.ok(signedOutIndex >= 0)
  assert.ok(signInIndex > signedOutIndex)
  assert.ok(routeDecisionIndex > signInIndex)
  assert.ok(renderIndex > routeDecisionIndex)
})

test('the self-authenticated access snapshot route bypasses workspace redirects', () => {
  assert.match(middlewareSource, /'\/api\/access-context\(\.\*\)'/)

  const nextAuthBlock = middlewareSource.slice(
    middlewareSource.indexOf('const nextAuthMiddleware'),
    middlewareSource.indexOf('const clerkAuthMiddleware'),
  )
  const publicRouteIndex = nextAuthBlock.indexOf('if (isPublicRoute(req))')
  const routeDecisionIndex = nextAuthBlock.indexOf('resolveAuthoritativeRoute')

  assert.ok(publicRouteIndex >= 0)
  assert.ok(routeDecisionIndex > publicRouteIndex)
})

test('authenticated route decisions happen before Next.js renders protected content', () => {
  const nextAuthBlock = middlewareSource.slice(
    middlewareSource.indexOf('const nextAuthMiddleware'),
    middlewareSource.indexOf('const clerkAuthMiddleware'),
  )
  const routeDecisionIndex = nextAuthBlock.indexOf('resolveAuthoritativeRoute')
  const applyIndex = nextAuthBlock.indexOf('return applyDecision')

  assert.ok(routeDecisionIndex >= 0)
  assert.ok(applyIndex >= 0)
  assert.ok(routeDecisionIndex < applyIndex)
})

test('company intake is public while the platform surface still requires provider authentication', () => {
  assert.match(middlewareSource, /'\/request-access\(\.\*\)'/)
  assert.match(middlewareSource, /'\/api\/company-access-requests\(\.\*\)'/)
  assert.match(middlewareSource, /const isPlatformRoute = createRouteMatcher\(\['\/platform\(\.\*\)'\]\)/)

  const clerkBlock = middlewareSource.slice(
    middlewareSource.indexOf('const clerkAuthMiddleware'),
    middlewareSource.indexOf('export default function middleware'),
  )
  const signedOutIndex = clerkBlock.indexOf('if (!authObject.userId)')
  const platformIndex = clerkBlock.indexOf('if (isPlatformRoute(req))')
  assert.ok(signedOutIndex >= 0)
  assert.ok(platformIndex > signedOutIndex)
})

test('invitation acceptance is public but activation requires a signed-in Clerk user', () => {
  assert.match(middlewareSource, /'\/accept-invitation\(\.\*\)'/)
  assert.match(
    middlewareSource,
    /const isInvitationActivationRoute = createRouteMatcher\(\['\/activate-invitation\(\.\*\)'\]\)/,
  )
  const clerkBlock = middlewareSource.slice(
    middlewareSource.indexOf('const clerkAuthMiddleware'),
    middlewareSource.indexOf('export default function middleware'),
  )
  const signedOutIndex = clerkBlock.indexOf('if (!authObject.userId)')
  const activationIndex = clerkBlock.indexOf('if (isInvitationActivationRoute(req))')
  const snapshotIndex = clerkBlock.indexOf('fetchAuthoritativeAccessSnapshot')
  assert.ok(signedOutIndex >= 0)
  assert.ok(activationIndex > signedOutIndex)
  assert.ok(snapshotIndex > activationIndex)
  assert.doesNotMatch(
    middlewareSource.slice(
      middlewareSource.indexOf('const isPublicRoute'),
      middlewareSource.indexOf('const isPlatformRoute'),
    ),
    /admin\/setup/,
  )
})
