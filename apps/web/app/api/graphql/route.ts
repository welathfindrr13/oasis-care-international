import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../auth/[...nextauth]/authOptions';

// Next.js build: mark as dynamic so /api/graphql isn't prerendered
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    const body = await request.text();
    
    // Read NextAuth JWT from request cookies in route handlers.
    // Prefer the Cognito *access token* for backend API calls (it typically carries groups/roles
    // and is used consistently elsewhere in the app, e.g. `/api/stats/today`).
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    const session = await getServerSession(authOptions);

    const tokenAccessToken = (token as any)?.accessToken;
    const sessionAccessToken = (session as any)?.accessToken;
    const tokenIdToken = (token as any)?.idToken;
    const sessionIdToken = (session as any)?.idToken;

    const accessToken = tokenAccessToken || sessionAccessToken || tokenIdToken || sessionIdToken;

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
