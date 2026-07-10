"use client";

import { SignIn, useAuth, useClerk } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AcceptInvitationClient() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("__clerk_ticket");
  const status = searchParams.get("__clerk_status");
  const invitationId = searchParams.get("oasis_invitation_id") || "";
  const validInvitationId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      invitationId,
    );
  const validInvitation =
    Boolean(ticket) &&
    validInvitationId &&
    ["sign_in", "sign_up", "complete"].includes(status || "");
  const activationUrl = `/activate-invitation?oasis_invitation_id=${encodeURIComponent(invitationId)}`;

  useEffect(() => {
    if (validInvitation && status === "complete" && isLoaded && isSignedIn) {
      router.replace(activationUrl);
    }
  }, [activationUrl, isLoaded, isSignedIn, router, status, validInvitation]);

  if (!validInvitation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="max-w-lg rounded-2xl bg-white p-6 text-sm text-slate-700">
          This invitation link is invalid or incomplete. Request a new secure
          invitation. No care information has been loaded.
        </p>
      </main>
    );
  }

  if (isLoaded && isSignedIn && status !== "complete") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <section className="max-w-lg rounded-2xl bg-white p-6 text-sm text-slate-700">
          <h1 className="font-heading text-2xl font-black text-slate-950">
            Continue with the invited account
          </h1>
          <p className="my-4 leading-6">
            Sign out of the current account, then sign in using the account that
            received this invitation.
          </p>
          <button
            className="min-h-11 rounded-full bg-slate-950 px-6 py-3 font-bold text-white"
            onClick={() =>
              void clerk.signOut({ redirectUrl: window.location.href })
            }
          >
            Sign out and continue
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-800">
          Secure invitation
        </p>
        <h1 className="font-heading text-3xl font-black text-slate-950">
          Accept your Oasis invitation
        </h1>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          Sign in with the account that received the invitation. No care
          information is shown during verification.
        </p>
        <div className="flex justify-center">
          <SignIn
            routing="hash"
            forceRedirectUrl={activationUrl}
            signUpForceRedirectUrl={activationUrl}
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "w-full border-0 shadow-none p-0",
              },
            }}
          />
        </div>
      </section>
    </main>
  );
}
