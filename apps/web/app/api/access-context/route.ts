import { NextResponse } from "next/server";
import { getServerAuthContext } from "../../../lib/auth/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getServerAuthContext();
  return NextResponse.json(auth.accessSnapshot, {
    status: auth.authenticated ? 200 : 401,
    headers: { "Cache-Control": "no-store" },
  });
}
