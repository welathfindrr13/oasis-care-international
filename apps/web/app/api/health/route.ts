import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const environment =
    process.env.APP_ENVIRONMENT ??
    process.env.ENVIRONMENT ??
    process.env.STAGE ??
    process.env.NODE_ENV ??
    'development';

  return NextResponse.json({
    status: 'ok',
    version: process.env.APP_VERSION ?? process.env.VERSION ?? 'unknown',
    commitSha: process.env.APP_COMMIT_SHA ?? process.env.COMMIT_SHA ?? 'unknown',
    environment,
  });
}
