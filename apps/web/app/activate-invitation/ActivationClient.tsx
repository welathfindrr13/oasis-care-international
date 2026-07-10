"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { clientQuery } from "../../lib/graphql/client-side";

const ACTIVATE_INVITATION = `
  mutation ActivateViewerOrganizationInvitation($input: InvitationActivationInputDTO!) {
    activateViewerOrganizationInvitation(input: $input) {
      status
      externalOrganizationId
    }
  }
`;

export function ActivationClient() {
  const { getToken } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    setWorking(true);
    setError("");
    try {
      const invitationId = searchParams.get("oasis_invitation_id") || "";
      const data = await clientQuery<{
        activateViewerOrganizationInvitation: {
          status: "ACTIVE";
          externalOrganizationId: string;
        };
      }>(
        ACTIVATE_INVITATION,
        { input: { invitationId } },
        { getBearerToken: getToken },
      );
      await clerk.setActive({
        organization:
          data.activateViewerOrganizationInvitation.externalOrganizationId,
      });
      router.replace("/admin/setup");
      router.refresh();
    } catch {
      setError(
        "We could not safely activate this invitation. Use the invited account or try again shortly.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      {error && (
        <p
          className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      <button
        className="w-full rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        disabled={working}
        onClick={() => void activate()}
      >
        {working ? "Verifying invitation…" : "Activate secure workspace"}
      </button>
    </div>
  );
}
