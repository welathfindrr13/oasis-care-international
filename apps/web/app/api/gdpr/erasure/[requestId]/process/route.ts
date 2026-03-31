import { gdprJsonRequest } from '../../../_shared';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { requestId: string } },
) {
  return gdprJsonRequest(`/gdpr/erasure/${params.requestId}/process`, {
    method: 'POST',
  });
}
