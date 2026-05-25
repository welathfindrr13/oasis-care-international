import { NextRequest, NextResponse } from 'next/server';

function normalizeBaseUrl(raw: string | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '');
  return `https://${value.replace(/\/+$/, '')}`;
}

function resolveLogoutBaseUrl(): string | null {
  const explicit = normalizeBaseUrl(process.env.COGNITO_LOGOUT_URL);
  if (explicit) return explicit.endsWith('/logout') ? explicit : `${explicit}/logout`;

  const domain = normalizeBaseUrl(process.env.COGNITO_DOMAIN || process.env.COGNITO_HOSTED_UI_DOMAIN);
  if (domain) return `${domain}/logout`;

  const issuer = normalizeBaseUrl(process.env.COGNITO_ISSUER);
  if (issuer && issuer.includes('/oauth2')) {
    return `${issuer}/logout`;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const fallback = new URL('/login', request.nextUrl.origin);
  const logoutBaseUrl = resolveLogoutBaseUrl();
  const clientId = String(process.env.COGNITO_CLIENT_ID || '').trim();

  if (!logoutBaseUrl || !clientId) {
    return NextResponse.redirect(fallback);
  }

  const postLogoutRedirect =
    String(process.env.COGNITO_LOGOUT_REDIRECT_URI || '').trim() ||
    `${request.nextUrl.origin}/login`;

  const logoutUrl = new URL(logoutBaseUrl);
  logoutUrl.searchParams.set('client_id', clientId);
  logoutUrl.searchParams.set('logout_uri', postLogoutRedirect);

  return NextResponse.redirect(logoutUrl);
}
