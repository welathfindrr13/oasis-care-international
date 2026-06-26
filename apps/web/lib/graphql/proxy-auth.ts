import { getClerkBearerTokenFromCookieHeader } from '../auth/clerk';

interface ResolveGraphQLProxyAccessTokenInput {
  authorizationHeader?: string | null;
  clerkMode: boolean;
  serverAuthAccessToken?: string | null;
  nextAuthAccessToken?: string | null;
  nextAuthIdToken?: string | null;
  cookieHeader?: string | null;
}

export function getDirectBearerToken(authorizationHeader: string | null | undefined): string {
  const value = (authorizationHeader || '').trim();
  if (!value.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return value.slice('bearer '.length).trim();
}

function normalizedToken(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveGraphQLProxyAccessToken({
  authorizationHeader,
  clerkMode,
  serverAuthAccessToken,
  nextAuthAccessToken,
  nextAuthIdToken,
  cookieHeader,
}: ResolveGraphQLProxyAccessTokenInput): string {
  const directBearer = getDirectBearerToken(authorizationHeader);
  if (directBearer) {
    return directBearer;
  }

  if (clerkMode) {
    return (
      getClerkBearerTokenFromCookieHeader(cookieHeader) ||
      normalizedToken(serverAuthAccessToken)
    );
  }

  return (
    normalizedToken(serverAuthAccessToken) ||
    normalizedToken(nextAuthAccessToken) ||
    normalizedToken(nextAuthIdToken)
  );
}
