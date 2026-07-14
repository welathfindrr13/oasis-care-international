import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { isLocalAuthEnabled } from "../../../../lib/auth/mode";
import { authOptions } from './authOptions';

const handler = NextAuth(authOptions);

async function localAuthHandler(request: NextRequest, context: unknown) {
  if (!isLocalAuthEnabled(process.env)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return handler(request as any, context as any);
}

export { localAuthHandler as GET, localAuthHandler as POST };
