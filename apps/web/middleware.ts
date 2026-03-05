export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth routes)
     * - api/health (health check)
     * - api/graphql (GraphQL proxy - auth handled by backend)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    "/((?!api/auth|api/health|api/graphql|login|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
}


