import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveAuthMode } from '../../../lib/auth/mode';
import { getServerAuthContext } from '../../../lib/auth/server-auth';
import {
  getDirectBearerToken,
  resolveGraphQLProxyAccessToken,
} from '../../../lib/graphql/proxy-auth';

// Next.js build: mark as dynamic so /api/graphql isn't prerendered
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    const body = await request.text();
    
    const directAuthorization = request.headers.get('authorization') || '';
    const hasDirectBearer = Boolean(getDirectBearerToken(directAuthorization));
    const clerkMode = resolveAuthMode(process.env) === 'clerk';
    const token =
      hasDirectBearer || clerkMode
        ? null
        : await getToken({
            req: request as any,
            secret: process.env.NEXTAUTH_SECRET,
          });
    const serverAuth = hasDirectBearer ? null : await getServerAuthContext();
    const accessToken = resolveGraphQLProxyAccessToken({
      authorizationHeader: directAuthorization,
      clerkMode,
      serverAuthAccessToken: serverAuth?.accessToken,
      nextAuthAccessToken: (token as any)?.accessToken,
      nextAuthIdToken: (token as any)?.idToken,
      cookieHeader: request.headers.get('cookie'),
    });

    if (!accessToken) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // Build headers with Bearer token if available
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    const platformAction = request.headers.get('x-oasis-platform-action');
    if (platformAction === '1') {
      headers['X-Oasis-Platform-Action'] = '1';
    }
    
    // Forward the GraphQL request to the backend (with a timeout to avoid hanging the UI).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status === 401 || response.status === 403 ? response.status : 500;
      const safeMessage =
        status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Internal Server Error';

      console.error(`GraphQL proxy failed: ${response.status} ${response.statusText}`, errorText);
      return new NextResponse(safeMessage, { status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
