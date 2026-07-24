"use client";

import { useClerk, useOrganizationList } from "@clerk/nextjs";
import { useState } from "react";

export function ChooseOrganizationTaskActions() {
  const clerk = useClerk();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const memberships = userMemberships.data ?? [];

  const activateOrganization = async (organizationId: string) => {
    setActivatingId(organizationId);
    setError("");
    try {
      if (!setActive) {
        throw new Error("Clerk organization activation is unavailable");
      }
      await setActive({ organization: organizationId });
      window.location.assign("/access");
    } catch {
      setError(
        "We could not verify that company. Try again or use your invitation link.",
      );
      setActivatingId(null);
    }
  };

  return (
    <>
      {!isLoaded && (
        <p role="status" className="text-sm text-oasis-muted">
          Checking approved company access…
        </p>
      )}

      {isLoaded && memberships.length > 0 && (
        <div className="mb-6 border-b border-oasis-border pb-6">
          <h2 className="text-base font-bold text-oasis-ink">
            Continue to an existing company
          </h2>
          <p className="mt-2 text-sm leading-6 text-oasis-muted">
            Oasis will still verify your approved internal membership before
            any company information is shown.
          </p>
          <ul className="mt-4 space-y-3">
            {memberships.map((membership) => (
              <li key={membership.id}>
                <button
                  type="button"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-oasis-control-border bg-white px-5 py-3 text-sm font-semibold text-oasis-ink hover:bg-base-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-teal focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
                  disabled={activatingId !== null}
                  onClick={() =>
                    void activateOrganization(membership.organization.id)
                  }
                >
                  {activatingId === membership.organization.id
                    ? "Verifying company…"
                    : `Continue to ${membership.organization.name}`}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm font-semibold text-oasis-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-oasis-control-border bg-white px-5 py-3 text-sm font-semibold text-oasis-ink hover:bg-base-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-teal focus-visible:ring-offset-2"
        onClick={() => void clerk.signOut({ redirectUrl: "/login" })}
      >
        Use a different account
      </button>
    </>
  );
}
