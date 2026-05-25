import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import Cognito from 'next-auth/providers/cognito';
import { createLocalSessionUser } from '../../../../lib/auth/local-auth.server';
import { isLocalAuthEnabled } from '../../../../lib/auth/mode';
import { extractRolesFromClaims, normalizeAppRoles } from '../../../../lib/auth/roles';

function decodeJwtPayload(tokenValue: unknown): Record<string, any> | null {
  if (typeof tokenValue !== 'string' || tokenValue.split('.').length < 2) {
    return null;
  }

  try {
    const payload = tokenValue.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required auth configuration: ${name}`);
  }
  return value;
}

function getConfiguredCognitoProvider() {
  const issuer = (process.env.COGNITO_ISSUER || '').trim();
  const clientId = (process.env.COGNITO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.COGNITO_CLIENT_SECRET || '').trim();

  if (!issuer || !clientId || !clientSecret) {
    return null;
  }

  if (!/^https?:\/\//.test(issuer)) {
    throw new Error('COGNITO_ISSUER must be an absolute URL');
  }

  return Cognito({
    issuer,
    clientId,
    clientSecret,
  });
}

const localAuthEnabled = isLocalAuthEnabled(process.env);
const cognitoProvider = getConfiguredCognitoProvider();

if (!localAuthEnabled && !cognitoProvider) {
  requireEnv('COGNITO_ISSUER');
  requireEnv('COGNITO_CLIENT_ID');
  requireEnv('COGNITO_CLIENT_SECRET');
}

const providers = [];

if (localAuthEnabled) {
  providers.push(
    CredentialsProvider({
      id: 'oasis-local',
      name: 'Local development',
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
        role: { label: 'Role', type: 'text' },
        organizationId: { label: 'Organization', type: 'text' },
      },
      async authorize(credentials) {
        return createLocalSessionUser({
          email: credentials?.email,
          name: credentials?.name,
          role: credentials?.role,
          organizationId: credentials?.organizationId,
        }) as any;
      },
    }),
  );
}

if (cognitoProvider) {
  providers.push(cognitoProvider);
}

export const authOptions: NextAuthOptions = {
  providers,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 15 * 60, // 15 minutes
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'oasis-local' && user) {
        token.accessToken = (user as any).accessToken;
        token.idToken = (user as any).idToken;
        token.refreshToken = null;
        token.expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
        token.roles = normalizeAppRoles((user as any).roles ?? (user as any).role);
        token.authMode = 'local';
        return token;
      }

      // On initial sign-in, store the Cognito access token
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.authMode = 'cognito';
      }

      // Keep roles synced from token claims (not only initial profile payload).
      const claimsFromAccessToken = decodeJwtPayload(token.accessToken);
      const groupsFromAccessToken = extractRolesFromClaims(claimsFromAccessToken);
      if (groupsFromAccessToken.length > 0) {
        token.roles = groupsFromAccessToken;
      } else {
        const profileRoles = normalizeAppRoles((profile as any)?.['cognito:groups']);
        token.roles = profileRoles.length > 0 ? profileRoles : normalizeAppRoles(token.roles);
      }
      
      return token;
    },
    async session({ session, token }) {
      // Expose access token to the client session
      (session as any).accessToken = token.accessToken;
      (session as any).idToken = token.idToken;
      (session as any).roles = token.roles ?? [];
      (session as any).authMode = token.authMode ?? 'cognito';
      return session;
    },
  },
};
