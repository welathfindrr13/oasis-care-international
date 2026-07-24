"use client";

import { useClerk } from "@clerk/nextjs";

export function ChooseOrganizationTaskActions() {
  const clerk = useClerk();

  return (
    <button
      type="button"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-oasis-control-border bg-white px-5 py-3 text-sm font-semibold text-oasis-ink hover:bg-base-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-teal focus-visible:ring-offset-2"
      onClick={() => void clerk.signOut({ redirectUrl: "/login" })}
    >
      Use a different account
    </button>
  );
}
