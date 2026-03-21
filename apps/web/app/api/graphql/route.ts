import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth/auth-options';

// Next.js build: mark as dynamic so /api/graphql isn't prerendered
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    const body = await request.text();
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken as string | undefined;
    
    // Forward the GraphQL request to the backend
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies().toString(),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body,
      cache: 'no-store',
    });

    if (response.status === 403) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (!response.ok) {
      console.error(`GraphQL proxy failed: ${response.status} ${response.statusText}`);
      return new NextResponse('Internal Server Error', { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
