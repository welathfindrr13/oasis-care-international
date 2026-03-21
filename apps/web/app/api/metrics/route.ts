import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth/auth-options';
import { hasRole } from '../../../lib/auth/roles';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!session || !hasRole((session as any).roles, 'admin') || !accessToken) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const fullApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    const apiUrl = fullApiUrl.replace(/\/graphql$/, '');
    const response = await fetch(`${apiUrl}/metrics`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return new NextResponse('Metrics endpoint not available or disabled', {
        status: response.status,
      });
    }

    const metrics = await response.text();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    return new NextResponse(
      `Metrics unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 502 }
    );
  }
}
