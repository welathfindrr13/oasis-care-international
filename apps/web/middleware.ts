import { NextResponse } from 'next/server'
import { withAuth } from 'next-auth/middleware'
import { resolveAuthenticatedRoute } from './lib/auth/access'

function getTokenRoles(token: Record<string, any> | null | undefined): unknown {
  return token?.roles ?? token?.['cognito:groups'] ?? token?.realm_access?.roles
}

export default withAuth(
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
  },
)

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - api/health (health check)
     * - api/graphql (GraphQL proxy - auth handled by backend)
     * - api/evidence-packs (export API - auth handled by route/backend)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - PWA files (manifest and service worker)
     * - public assets
     */
    "/((?!$|api/auth|api/health|api/graphql|api/evidence-packs|login|offline|manifest\\.webmanifest|sw\\.js|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
}
