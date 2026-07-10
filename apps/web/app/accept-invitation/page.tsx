import { AcceptInvitationClient } from "./AcceptInvitationClient";
import { resolveAuthMode } from "../../lib/auth/mode";

export const dynamic = "force-dynamic";

export default function AcceptInvitationPage() {
  if (resolveAuthMode(process.env) !== "clerk") {
    return <InvitationUnavailable />;
  }
  return <AcceptInvitationClient />;
}

function InvitationUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <p className="rounded-2xl bg-white p-6 text-sm text-slate-700">
        Secure invitations are not available in this environment. No care
        information has been loaded.
      </p>
    </main>
  );
}
