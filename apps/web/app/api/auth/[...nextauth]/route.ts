import NextAuth from "next-auth";
import Cognito from "next-auth/providers/cognito";
import { extractRolesFromClaims, normalizeAppRoles } from "../../../../lib/auth/roles";

export const authOptions = {
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
  callbacks: {
    async jwt({ token, profile, account }) {
      const nextRoles =
        extractRolesFromClaims((profile as Record<string, unknown> | undefined) ?? null) ||
        normalizeAppRoles((token as any).roles);

      (token as any).roles = nextRoles;

      if (account?.access_token) {
        (token as any).accessToken = account.access_token;
      }

      return token;
    },
    async session({ session, token }) {
      (session as any).roles = normalizeAppRoles((token as any).roles);
      (session as any).accessToken = (token as any).accessToken;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
