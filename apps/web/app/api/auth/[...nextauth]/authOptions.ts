import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createLocalSessionUser } from '../../../../lib/auth/local-auth.server';
import { isLocalAuthEnabled } from '../../../../lib/auth/mode';

const localAuthEnabled = isLocalAuthEnabled(process.env);

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
    async jwt({ token, account, user }) {
      if (account?.provider === 'oasis-local' && user) {
        token.accessToken = (user as any).accessToken;
        token.idToken = (user as any).idToken;
        token.refreshToken = null;
        token.expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
        token.authMode = 'local';
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      // Expose access token to the client session
      (session as any).accessToken = token.accessToken;
      (session as any).idToken = token.idToken;
      (session as any).authMode = 'local';
      return session;
    },
  },
};
