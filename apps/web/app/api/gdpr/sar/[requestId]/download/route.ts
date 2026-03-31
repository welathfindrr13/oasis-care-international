import { NextResponse } from 'next/server';
import { getAdminApiContext } from '../../../_shared';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { requestId: string } },
) {
  const context = await getAdminApiContext();
  if ('error' in context) {
    return context.error;
  }

  try {
    const response = await fetch(`${context.apiBaseUrl}/gdpr/sar/${params.requestId}/download`, {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      return new NextResponse(text || 'Download unavailable', { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/gzip',
        'Content-Disposition': response.headers.get('content-disposition') || `attachment; filename="subject-access-${params.requestId}.json.gz"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download export' },
      { status: 502 }
    );
  }
}
