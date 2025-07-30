import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Next.js build: mark as dynamic so /api/stats/today isn't prerendered
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/stats/today`, {
      headers: {
        Cookie: cookies().toString(),
      },
      cache: 'no-store',
    });

    if (res.status === 403) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (!res.ok) {
      return new NextResponse('Internal Server Error', { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
