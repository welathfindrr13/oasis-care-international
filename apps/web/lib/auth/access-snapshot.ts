import {
  type AccessCapability,
  parseAccessCapabilities,
} from "./capabilities";

export type MembershipState =
  | "ACTIVE"
  | "MISSING"
  | "INACTIVE"
  | "AMBIGUOUS"
  | "ORGANIZATION_MISMATCH";
export type AccessSurface = "ADMIN" | "STAFF" | "FAMILY" | "NONE";
export type LinkedIdentityState =
  | "LINKED"
  | "NOT_REQUIRED"
  | "REQUIRED"
  | "INVALID";
export type OnboardingState =
  | "READY"
  | "NOT_STARTED"
  | "PENDING_INVITATION"
  | "SETUP_REQUIRED"
  | "BLOCKED";
export type AccessResolution =
  | "UNAUTHENTICATED"
  | "READY"
  | "DENIED"
  | "UNAVAILABLE";

export interface AuthoritativeAccessSnapshot {
  authenticated: boolean;
  organizationId: string | null;
  effectiveRole: string | null;
  membershipState: MembershipState;
  surface: AccessSurface;
  linkedIdentityState: LinkedIdentityState;
  onboardingState: OnboardingState;
  resolution: AccessResolution;
  capabilities: AccessCapability[];
}

const VIEWER_ACCESS_QUERY = `
  query ViewerAccessSnapshot {
    viewerAccessSnapshot {
      authenticated
      organizationId
      effectiveRole
      membershipState
      surface
      linkedIdentityState
      onboardingState
      capabilities
    }
  }
`;

export function unauthenticatedAccessSnapshot(): AuthoritativeAccessSnapshot {
  return {
    authenticated: false,
    organizationId: null,
    effectiveRole: null,
    membershipState: "MISSING",
    surface: "NONE",
    linkedIdentityState: "NOT_REQUIRED",
    onboardingState: "NOT_STARTED",
    resolution: "UNAUTHENTICATED",
    capabilities: [],
  };
}

export function unavailableAccessSnapshot(): AuthoritativeAccessSnapshot {
  return {
    authenticated: true,
    organizationId: null,
    effectiveRole: null,
    membershipState: "MISSING",
    surface: "NONE",
    linkedIdentityState: "NOT_REQUIRED",
    onboardingState: "BLOCKED",
    resolution: "UNAVAILABLE",
    capabilities: [],
  };
}

export function rolesFromAccessSnapshot(
  snapshot: AuthoritativeAccessSnapshot,
): string[] {
  if (snapshot.resolution !== "READY") return [];
  if (!snapshot.organizationId) return [];
  if (
    snapshot.surface === "ADMIN" &&
    snapshot.effectiveRole === "admin" &&
    snapshot.linkedIdentityState === "NOT_REQUIRED"
  ) {
    return ["admin"];
  }
  if (snapshot.surface === "STAFF") {
    const effectiveRole = snapshot.effectiveRole;
    const linkedCarer =
      effectiveRole === "carer" &&
      snapshot.linkedIdentityState === "LINKED";
    const unlinkedStaff =
      isOneOf(effectiveRole, ["manager", "care_manager", "office"]) &&
      snapshot.linkedIdentityState === "NOT_REQUIRED";
    if (!effectiveRole || (!linkedCarer && !unlinkedStaff)) return [];
    return Array.from(new Set([effectiveRole, "carer"]));
  }
  if (
    snapshot.surface === "FAMILY" &&
    snapshot.effectiveRole === "family" &&
    snapshot.linkedIdentityState === "LINKED"
  ) {
    return ["user"];
  }
  return [];
}

export async function fetchAuthoritativeAccessSnapshot(
  accessToken: string | null | undefined,
  options: {
    apiUrl?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<AuthoritativeAccessSnapshot> {
  const token = String(accessToken || "").trim();
  if (!token) return unauthenticatedAccessSnapshot();

  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs || 5000,
  );

  try {
    const response = await fetchImpl(normalizeGraphqlUrl(options.apiUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: VIEWER_ACCESS_QUERY }),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || Array.isArray(payload.errors)) {
      const unauthenticated = payload?.errors?.some(
        (item: any) => item?.extensions?.code === "UNAUTHENTICATED",
      );
      return unauthenticated
        ? unauthenticatedAccessSnapshot()
        : unavailableAccessSnapshot();
    }

    const snapshot = parseAccessSnapshot(payload?.data?.viewerAccessSnapshot);
    return snapshot || unavailableAccessSnapshot();
  } catch {
    return unavailableAccessSnapshot();
  } finally {
    clearTimeout(timeout);
  }
}

export function parseAccessSnapshot(
  value: unknown,
): AuthoritativeAccessSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.authenticated !== true ||
    !isOneOf(candidate.membershipState, [
      "ACTIVE",
      "MISSING",
      "INACTIVE",
      "AMBIGUOUS",
      "ORGANIZATION_MISMATCH",
    ]) ||
    !isOneOf(candidate.surface, ["ADMIN", "STAFF", "FAMILY", "NONE"]) ||
    !isOneOf(candidate.linkedIdentityState, [
      "LINKED",
      "NOT_REQUIRED",
      "REQUIRED",
      "INVALID",
    ]) ||
    !isOneOf(candidate.onboardingState, [
      "READY",
      "NOT_STARTED",
      "PENDING_INVITATION",
      "SETUP_REQUIRED",
      "BLOCKED",
    ])
  ) {
    return null;
  }

  const effectiveRole =
    typeof candidate.effectiveRole === "string" && candidate.effectiveRole.trim()
      ? candidate.effectiveRole.trim().toLowerCase()
      : null;
  const capabilities = parseAccessCapabilities(candidate.capabilities);
  if (!capabilities) return null;
  const organizationId =
    typeof candidate.organizationId === "string" && candidate.organizationId.trim()
      ? candidate.organizationId.trim()
      : null;
  const contractMatchesSurface =
    (candidate.surface === "ADMIN" &&
      effectiveRole === "admin" &&
      candidate.linkedIdentityState === "NOT_REQUIRED") ||
    (candidate.surface === "STAFF" &&
      ((effectiveRole === "carer" && candidate.linkedIdentityState === "LINKED") ||
        (isOneOf(effectiveRole, ["manager", "care_manager", "office"]) &&
          candidate.linkedIdentityState === "NOT_REQUIRED"))) ||
    (candidate.surface === "FAMILY" &&
      effectiveRole === "family" &&
      candidate.linkedIdentityState === "LINKED");
  const ready =
    candidate.membershipState === "ACTIVE" &&
    candidate.surface !== "NONE" &&
    candidate.onboardingState === "READY" &&
    organizationId !== null &&
    contractMatchesSurface;
  if (
    candidate.membershipState === "ACTIVE" &&
    candidate.surface !== "NONE" &&
    candidate.onboardingState === "READY" &&
    (!organizationId || !contractMatchesSurface)
  ) {
    return null;
  }
  return {
    authenticated: true,
    organizationId,
    effectiveRole,
    membershipState: candidate.membershipState as MembershipState,
    surface: candidate.surface as AccessSurface,
    linkedIdentityState: candidate.linkedIdentityState as LinkedIdentityState,
    onboardingState: candidate.onboardingState as OnboardingState,
    resolution: ready ? "READY" : "DENIED",
    capabilities: ready ? capabilities : [],
  };
}

function normalizeGraphqlUrl(value?: string): string {
  const configured = String(
    value || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql",
  ).trim();
  return configured.endsWith("/graphql")
    ? configured
    : `${configured.replace(/\/$/, "")}/graphql`;
}

function isOneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
