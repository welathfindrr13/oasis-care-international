import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth/auth-options';

// Next.js build: mark as dynamic so /api/stats/today isn't prerendered
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Extract base API URL without /graphql path for REST endpoints
    const fullApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    const apiUrl = fullApiUrl.replace(/\/graphql$/, '');
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken as string | undefined;
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const res = await fetch(`${apiUrl}/stats/today`, {
      headers: {
        Cookie: cookies().toString(),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (res.status === 403) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (!res.ok) {
      // Return fallback stats instead of error
      return NextResponse.json({ booked: 0, finished: 0 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    // Return fallback stats on error
    return NextResponse.json({ booked: 0, finished: 0 });
  }
}
