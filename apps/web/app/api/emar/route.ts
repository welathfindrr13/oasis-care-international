import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../../../lib/auth/auth-options';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const token = session ? null : await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  const accessToken =
    typeof (session as any)?.accessToken === 'string'
      ? (session as any).accessToken
      : typeof (token as any)?.accessToken === 'string'
        ? (token as any).accessToken
        : null;

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'A valid medication date is required' }, { status: 400 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/graphql$/, '') ?? 'https://api.oasis-care.co';

  try {
    const response = await fetch(`${apiBaseUrl}/medication/today?date=${encodeURIComponent(date)}`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const text = await response.text();
    let payload: { error?: string } | unknown[] | null = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        !Array.isArray(payload) && payload && typeof payload === 'object' && typeof (payload as any).error === 'string'
          ? (payload as any).error
          : `Medication request failed: ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    if (!Array.isArray(payload)) {
      return NextResponse.json({ error: 'Failed to load medications' }, { status: 500 });
    }

    return NextResponse.json({ medications: payload });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load medications' },
      { status: 500 }
    );
  }
}
