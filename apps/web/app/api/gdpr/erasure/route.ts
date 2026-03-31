import { NextRequest } from 'next/server';
import { gdprJsonRequest } from '../_shared';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  return gdprJsonRequest('/gdpr/erasure', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
