import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json(
      { message: "JSON requests are required" },
      { status: 415 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const configuredApiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";
    const endpoint = new URL("/company-access-requests", configuredApiUrl);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: await request.text(),
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 429) {
      return NextResponse.json(
        { message: "Please wait before trying again." },
        { status: 429 },
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        { message: "Request could not be submitted." },
        {
          status:
            response.status === 400 || response.status === 415
              ? response.status
              : 500,
        },
      );
    }
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch {
    return NextResponse.json(
      { message: "Request could not be submitted." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
