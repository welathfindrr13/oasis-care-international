import { cookies } from "next/headers";

export function getBrowserClerkFixtureSession(): {
  userId: string | null;
  token: string | null;
} {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.OASIS_BROWSER_CLERK_STUB !== "true"
  ) {
    return { userId: null, token: null };
  }

  const token = cookies().get("__session")?.value?.trim() || null;
  return { userId: subjectFromToken(token), token };
}

function subjectFromToken(token: string | null): string | null {
  try {
    const encoded = token?.split(".")[1] || "";
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const base64 = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    return typeof payload?.sub === "string" && payload.sub.trim()
      ? payload.sub.trim()
      : null;
  } catch {
    return null;
  }
}
