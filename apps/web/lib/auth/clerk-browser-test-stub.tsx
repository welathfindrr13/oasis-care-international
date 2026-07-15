"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const SESSION_KEY = "oasis.synthetic-clerk-session";
const ORGANIZATION_KEY = "oasis.synthetic-clerk-organization";

type SyntheticSession = {
  signedIn: boolean;
  userId: string;
  token: string;
};

function readSession(): SyntheticSession {
  if (typeof window === "undefined") {
    return { signedIn: false, userId: "", token: "" };
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "{}");
    const token = typeof stored.token === "string" ? stored.token : "";
    return {
      signedIn: stored.signedIn === true,
      userId:
        subjectFromToken(token) ||
        (typeof stored.userId === "string" ? stored.userId : ""),
      token,
    };
  } catch {
    return { signedIn: false, userId: "", token: "" };
  }
}

function subjectFromToken(token: string): string {
  try {
    const encoded = token.split(".")[1] || "";
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const base64 = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const payload = JSON.parse(window.atob(base64));
    return typeof payload?.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

function writeSession(session: SyntheticSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("oasis-synthetic-clerk-session"));
}

function useSyntheticSession() {
  const [session, setSession] = useState<SyntheticSession>({
    signedIn: false,
    userId: "",
    token: "",
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const update = () => {
      setSession(readSession());
      setIsLoaded(true);
      (window as any).__OASIS_SYNTHETIC_CLERK_READY__ = true;
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("oasis-synthetic-clerk-session", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("oasis-synthetic-clerk-session", update);
    };
  }, []);

  return { ...session, isLoaded };
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  const session = useSyntheticSession();
  return {
    isLoaded: session.isLoaded,
    isSignedIn: session.signedIn,
    userId: session.userId || null,
    orgId: null,
    getToken: async () => {
      if (!session.signedIn) return null;
      return session.token || `synthetic-clerk-token:${session.userId}`;
    },
  };
}

export function useUser() {
  const session = useSyntheticSession();
  return {
    isLoaded: session.isLoaded,
    isSignedIn: session.signedIn,
    user: session.signedIn
      ? {
          id: session.userId,
          fullName: "Synthetic Clerk User",
          primaryEmailAddress: { emailAddress: "invited@example.test" },
        }
      : null,
  };
}

export function useClerk() {
  return {
    setActive: async ({ organization }: { organization: string }) => {
      window.localStorage.setItem(ORGANIZATION_KEY, organization);
    },
    signOut: async ({ redirectUrl }: { redirectUrl?: string } = {}) => {
      writeSession({ signedIn: false, userId: "", token: "" });
      if (redirectUrl) window.location.assign(redirectUrl);
    },
    openUserProfile: () => undefined,
  };
}

export function SignIn({
  forceRedirectUrl,
}: {
  forceRedirectUrl?: string;
  signUpForceRedirectUrl?: string;
  routing?: string;
  appearance?: unknown;
}) {
  const scenario =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get(
          "browser_clerk_scenario",
        );
  const isNew = scenario === "new";
  return (
    <button
      type="button"
      className="min-h-11 w-full rounded-full bg-slate-950 px-6 py-3 text-sm font-bold text-white"
      onClick={() => {
        writeSession({
          signedIn: true,
          userId: isNew ? "user_synthetic_new" : "user_synthetic_existing",
          token: "",
        });
        window.location.assign(forceRedirectUrl || "/");
      }}
    >
      {isNew ? "Create invited account" : "Continue with existing account"}
    </button>
  );
}
