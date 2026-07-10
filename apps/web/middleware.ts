import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import { resolveAuthenticatedRoute } from './lib/auth/access'
import { extractClerkRolesFromClaims } from './lib/auth/clerk'
import { resolveAuthMode } from './lib/auth/mode'

function getTokenRoles(token: Record<string, any> | null | undefined): unknown {
  return token?.roles ?? token?.['cognito:groups'] ?? token?.realm_access?.roles
}

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/offline(.*)',
  '/manifest.webmanifest',
  '/sw.js',
  '/api/auth(.*)',
  '/api/health(.*)',
  '/api/graphql(.*)',
  '/api/evidence-packs(.*)',
])

const nextAuthMiddleware = withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname
    const token = req.nextauth.token as Record<string, any> | null
    const decision = resolveAuthenticatedRoute(path, getTokenRoles(token))

    if (decision.action === 'redirect') {
      return NextResponse.redirect(new URL(decision.destination, req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  },
)

const clerkAuthMiddleware = clerkMiddleware((auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  const authObject = auth()
  if (!authObject.userId) {
    return authObject.redirectToSignIn()
  }

  const claims = (authObject as any).sessionClaims ?? null
  const decision = resolveAuthenticatedRoute(req.nextUrl.pathname, extractClerkRolesFromClaims(claims))

  if (decision.action === 'redirect') {
    return NextResponse.redirect(new URL(decision.destination, req.url))
  }

  return NextResponse.next()
})

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (resolveAuthMode(process.env) === 'clerk') {
    return clerkAuthMiddleware(req, event)
  }

  return nextAuthMiddleware(req as any, event as any)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - api/health (health check)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - PWA files (manifest and service worker)
     * - public assets
     */
    "/((?!$|api/auth|api/health|login|offline|manifest\\.webmanifest|sw\\.js|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
}
