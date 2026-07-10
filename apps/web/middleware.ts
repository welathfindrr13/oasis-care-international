import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import { resolveAuthoritativeRoute } from './lib/auth/access'
import { fetchAuthoritativeAccessSnapshot, unavailableAccessSnapshot } from './lib/auth/access-snapshot'
import { resolveAuthMode } from './lib/auth/mode'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/offline(.*)',
  '/manifest.webmanifest',
  '/sw.js',
  '/api/auth(.*)',
  '/api/health(.*)',
  '/api/graphql(.*)',
  '/api/access-context(.*)',
  '/api/evidence-packs(.*)',
  '/request-access(.*)',
  '/api/company-access-requests(.*)',
  '/accept-invitation(.*)',
])
const isPlatformRoute = createRouteMatcher(['/platform(.*)'])
const isInvitationActivationRoute = createRouteMatcher(['/activate-invitation(.*)'])
const nextAuthMiddleware = withAuth(
  async function middleware(req) {
    if (isPublicRoute(req)) return NextResponse.next()
    if (isPlatformRoute(req)) return NextResponse.next()
    if (isInvitationActivationRoute(req)) return NextResponse.next()
    const token = req.nextauth.token as Record<string, any> | null
    const accessToken = String(token?.accessToken || token?.idToken || '')
    const snapshot = accessToken
      ? await fetchAuthoritativeAccessSnapshot(accessToken)
      : unavailableAccessSnapshot()
    const decision = resolveAuthoritativeRoute(req.nextUrl.pathname, snapshot)
    return applyDecision(req, decision)
  },
  {
    callbacks: { authorized: ({ token, req }) => isPublicRoute(req as any) || !!token },
    pages: { signIn: '/login' },
  },
)

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next()
  const authObject = auth()
  if (!authObject.userId) return authObject.redirectToSignIn()
  if (isPlatformRoute(req)) return NextResponse.next()
  if (isInvitationActivationRoute(req)) return NextResponse.next()
  let accessToken: string | null = null
  try {
    accessToken = await authObject.getToken()
  } catch {
    accessToken = null
  }
  const snapshot = accessToken
    ? await fetchAuthoritativeAccessSnapshot(accessToken)
    : unavailableAccessSnapshot()
  const decision = resolveAuthoritativeRoute(req.nextUrl.pathname, snapshot)
  return applyDecision(req, decision)
})

function applyDecision(req: NextRequest, decision: ReturnType<typeof resolveAuthoritativeRoute>) {
  if (decision.action === 'redirect' && decision.destination !== req.nextUrl.pathname) {
    return NextResponse.redirect(new URL(decision.destination, req.url))
  }
  return NextResponse.next()
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.OASIS_BROWSER_CLERK_STUB === 'true'
  ) {
    return NextResponse.next()
  }
  return resolveAuthMode(process.env) === 'clerk'
    ? clerkAuthMiddleware(req, event)
    : nextAuthMiddleware(req as any, event as any)
}

export const config = {
  matcher: [
    "/((?!$|api/auth|api/health|login|offline|manifest\\.webmanifest|sw\\.js|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
}
