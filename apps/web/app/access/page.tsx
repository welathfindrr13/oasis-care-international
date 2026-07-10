import { redirect } from "next/navigation";
import { resolveAuthoritativeRoute } from "../../lib/auth/access";
import { getServerAuthContext } from "../../lib/auth/server-auth";

export const dynamic = "force-dynamic";

export default async function AccessRouterPage() {
  const auth = await getServerAuthContext();
  const decision = resolveAuthoritativeRoute("/access", auth.accessSnapshot);
  redirect(
    decision.action === "redirect"
      ? decision.destination
      : "/access/unavailable",
  );
}
