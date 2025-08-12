import { headers } from 'next/headers';

export function getSiteBaseUrl() {
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host  = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
}
