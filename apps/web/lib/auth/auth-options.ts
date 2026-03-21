import { NextAuthOptions } from 'next-auth';
import Cognito from 'next-auth/providers/cognito';
import { extractRolesFromClaims, normalizeAppRoles } from './roles';

function parseJwtClaims(token: string | undefined): Record<string, unknown> | null {
  if (!token) {
    return null;
  }

  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function sanitizeAuthLoggerMetadata(metadata: unknown): unknown {
  if (metadata instanceof Error) {
    return { name: metadata.name, message: metadata.message };
  }

  if (Array.isArray(metadata)) {
    return metadata.map(sanitizeAuthLoggerMetadata);
  }

  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  return Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
      if (/token|secret|password/i.test(key)) {
        return [];
      }

      if (key === 'error' && value instanceof Error) {
        return [[key, sanitizeAuthLoggerMetadata(value)]];
      }

      return [[key, sanitizeAuthLoggerMetadata(value)]];
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    Cognito({
      issuer: process.env.COGNITO_ISSUER,
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  logger: {
    error(code, metadata) {
      const safeMetadata = sanitizeAuthLoggerMetadata(metadata);
      console.error(`[next-auth][error][${code}]`, safeMetadata);
    },
    warn(code) {
      console.warn(`[next-auth][warn][${code}]`);
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[next-auth][debug][${code}]`, sanitizeAuthLoggerMetadata(metadata));
      }
    },
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);
        const origin = new URL(baseUrl).origin;

        if (target.origin === origin) {
          return url;
        }
      } catch {
        // Fall through to the safe default.
      }

      return `${baseUrl}/dashboard`;
    },
    async jwt({ token, profile, account }) {
      if (account?.access_token) {
        (token as any).accessToken = account.access_token;
      }

      const profileRoles = extractRolesFromClaims((profile as Record<string, unknown> | undefined) ?? null);
      const accessTokenRoles = extractRolesFromClaims(
        parseJwtClaims((account?.access_token as string | undefined) ?? ((token as any).accessToken as string | undefined))
      );
      const existingRoles = normalizeAppRoles((token as any).roles);
      const nextRoles = profileRoles.length
        ? profileRoles
        : accessTokenRoles.length
          ? accessTokenRoles
          : existingRoles;

      (token as any).roles = nextRoles;

      return token;
    },
    async session({ session, token }) {
      (session as any).roles = normalizeAppRoles((token as any).roles);
      (session as any).accessToken = (token as any).accessToken;
      return session;
    },
  },
};
