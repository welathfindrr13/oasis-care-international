import { gdprJsonRequest } from '../../_shared';

export const dynamic = 'force-dynamic';

export async function POST() {
  return gdprJsonRequest('/gdpr/retention-policies/enforce', {
    method: 'POST',
  });
}
