"use client";

import { useClerk } from "@clerk/nextjs";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { resolveAuthMode } from "../../lib/auth/mode";

export function AccessStateActions() {
  const accountAction =
    resolveAuthMode({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER:
        process.env.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER,
      NEXT_PUBLIC_LOCAL_AUTH_ENABLED:
        process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED,
    } as NodeJS.ProcessEnv) === "clerk" ? (
      <ClerkAccessStateActions />
    ) : (
      <NextAuthAccessStateActions />
    );
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <button
        className={secondaryButtonClass}
        onClick={() => window.location.assign("/access")}
      >
        Check access again
      </button>
      {accountAction}
    </div>
  );
}

function ClerkAccessStateActions() {
  const { signOut } = useClerk();
  return (
    <button
      className={buttonClass}
      onClick={() => signOut({ redirectUrl: "/login" })}
    >
      Use a different account
    </button>
  );
}

function NextAuthAccessStateActions() {
  return (
    <button
      className={buttonClass}
      onClick={() => nextAuthSignOut({ callbackUrl: "/login" })}
    >
      Use a different account
    </button>
  );
}

const buttonClass =
  "rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2";
const secondaryButtonClass =
  "rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2";
