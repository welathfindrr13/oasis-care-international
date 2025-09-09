import NextAuth from "next-auth";
import Cognito from "next-auth/providers/cognito";

const handler = NextAuth({
  providers: [
    Cognito({
      issuer: process.env.COGNITO_ISSUER,
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      const groups = (profile && (profile as any)["cognito:groups"]) || token.roles || [];
      token.roles = groups;
      return token;
    },
    async session({ session, token }) {
      (session as any).roles = token.roles ?? [];
      return session;
    },
  },
});

export { handler as GET, handler as POST };
