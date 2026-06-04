import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/authOptions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken;
    const roles = Array.isArray((session as any)?.roles)
      ? (session as any).roles.map((r: unknown) => String(r).toLowerCase().trim())
      : [];

    if (!accessToken) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!roles.includes('admin')) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const fullApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    const apiUrl = fullApiUrl.replace(/\/graphql$/, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/stats/today`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 401) return new NextResponse('Unauthorized', { status: 401 });
      if (response.status === 403) return new NextResponse('Forbidden', { status: 403 });
      return new NextResponse('Upstream Error', { status: 502 });
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to fetch activity stats:', error);
    const isAbortError = (error as any)?.name === 'AbortError';
    return new NextResponse(isAbortError ? 'Gateway Timeout' : 'Upstream Error', {
      status: isAbortError ? 504 : 502,
    });
  }
}
