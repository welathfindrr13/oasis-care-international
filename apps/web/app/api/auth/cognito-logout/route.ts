import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_COGNITO_HOSTED_UI_DOMAIN = 'https://eu-west-2ypo6sl1zm.auth.eu-west-2.amazoncognito.com';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getHostedUiBaseUrl() {
  return trimTrailingSlash(
    process.env.COGNITO_HOSTED_UI_DOMAIN ??
      process.env.NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN ??
      DEFAULT_COGNITO_HOSTED_UI_DOMAIN
  );
}

function getSiteBaseUrl(request: NextRequest) {
  return trimTrailingSlash(
    process.env.NEXTAUTH_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      request.nextUrl.origin
  );
}

export async function GET(request: NextRequest) {
  const clientId = process.env.COGNITO_CLIENT_ID;
  const siteBaseUrl = getSiteBaseUrl(request);

  if (!clientId) {
    return NextResponse.redirect(new URL('/login', siteBaseUrl));
  }

  const logoutUrl = new URL('/logout', getHostedUiBaseUrl());
  logoutUrl.searchParams.set('client_id', clientId);
  logoutUrl.searchParams.set('logout_uri', `${siteBaseUrl}/login`);

  return NextResponse.redirect(logoutUrl);
}
