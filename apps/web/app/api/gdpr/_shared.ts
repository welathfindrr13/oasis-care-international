import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '../../../lib/auth/auth-options';
import { hasRole } from '../../../lib/auth/roles';

export const dynamic = 'force-dynamic';

export async function getAdminApiContext() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken as string | undefined;

  if (!session || !hasRole((session as any).roles, 'admin') || !accessToken) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql').replace(/\/graphql$/, '');

  return {
    accessToken,
    apiBaseUrl,
  };
}

export async function gdprJsonRequest(
  path: string,
  init?: RequestInit,
) {
  const context = await getAdminApiContext();
  if ('error' in context) {
    return context.error;
  }

  try {
    const response = await fetch(`${context.apiBaseUrl}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.accessToken}`,
        ...(init?.headers || {}),
      },
    });

    const text = await response.text();
    let payload: unknown = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text ? { message: text } : null;
    }

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GDPR request failed' },
      { status: 502 }
    );
  }
}
