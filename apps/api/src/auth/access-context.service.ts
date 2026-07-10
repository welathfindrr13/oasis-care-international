import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "@oasis/db";

export type AccessMembershipState =
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
export type AccessOnboardingState =
  | "READY"
  | "NOT_STARTED"
  | "PENDING_INVITATION"
  | "SETUP_REQUIRED"
  | "BLOCKED";

export interface AuthenticatedIdentity {
  id?: string | null;
  sub?: string | null;
  organizationId?: string | null;
}

export interface AuthenticatedRequest {
  user?: AuthenticatedIdentity | null;
}

export interface CanonicalAccessContext {
  readonly authenticated: true;
  readonly authSubject: string;
  readonly identityProvider: string;
  readonly organizationId: string | null;
  readonly membershipId: string | null;
  readonly membershipState: AccessMembershipState;
  readonly rawRole: string | null;
  readonly effectiveRole: string | null;
  readonly surface: AccessSurface;
  readonly linkedIdentityState: LinkedIdentityState;
  readonly onboardingState: AccessOnboardingState;
  readonly domainIdentityId: string | null;
}

type MembershipRow = {
  id: string;
  organization_id: string;
  external_organization_id: string | null;
  auth_subject: string;
  role: string;
  status: string;
  revoked_at: Date | null;
  carer_id: string | null;
  carer: {
    id: string;
    organization_id: string;
    is_active: boolean;
    deleted_at: Date | null;
  } | null;
};

type FamilyContactRow = {
  id: string;
  organization_id: string;
  disabled_at: Date | null;
};

const CARER_ROLES = new Set(["carer", "staff"]);
const STAFF_ROLES = new Set(["manager", "care_manager", "office"]);
const FAMILY_ROLES = new Set(["user", "family", "client", "viewer"]);
export const ACCESS_UNAVAILABLE_MESSAGE =
  "Access is unavailable for this account";
const REQUEST_ACCESS_CONTEXT = Symbol("canonicalAccessContext");

type CachedAuthenticatedRequest = AuthenticatedRequest & {
  [REQUEST_ACCESS_CONTEXT]?: Promise<CanonicalAccessContext>;
};

@Injectable()
export class AccessContextService {
  constructor(private readonly prisma: PrismaService) {}

  resolveForRequest(
    request: AuthenticatedRequest,
  ): Promise<CanonicalAccessContext> {
    const cachedRequest = request as CachedAuthenticatedRequest;
    return (
      cachedRequest[REQUEST_ACCESS_CONTEXT] ??
      (cachedRequest[REQUEST_ACCESS_CONTEXT] = this.resolve(request?.user))
    );
  }

  async resolve(
    identity: AuthenticatedIdentity | null | undefined,
  ): Promise<CanonicalAccessContext> {
    const authSubject = nonEmpty(identity?.sub || identity?.id);
    if (!authSubject) {
      throw new ForbiddenException(ACCESS_UNAVAILABLE_MESSAGE);
    }

    const identityProvider = configuredIdentityProvider();
    const tokenOrganizationId = nonEmpty(identity?.organizationId);
    const memberships = (await (
      this.prisma as any
    ).organizationMembership.findMany({
      where: {
        identity_provider: identityProvider,
        auth_subject: authSubject,
        status: "ACTIVE",
        revoked_at: null,
      },
      select: {
        id: true,
        organization_id: true,
        external_organization_id: true,
        auth_subject: true,
        role: true,
        status: true,
        revoked_at: true,
        carer_id: true,
        carer: {
          select: {
            id: true,
            organization_id: true,
            is_active: true,
            deleted_at: true,
          },
        },
      },
      take: 2,
    })) as MembershipRow[];

    if (memberships.length === 0) {
      const existingMembership = await (
        this.prisma as any
      ).organizationMembership.findFirst({
        where: {
          identity_provider: identityProvider,
          auth_subject: authSubject,
        },
        select: { id: true },
      });
      return existingMembership
        ? denied(authSubject, identityProvider, "INACTIVE", "BLOCKED")
        : denied(authSubject, identityProvider, "MISSING", "NOT_STARTED");
    }
    if (memberships.length !== 1) {
      return denied(authSubject, identityProvider, "AMBIGUOUS", "BLOCKED");
    }

    const membership = memberships[0];

    if (
      tokenOrganizationId &&
      !matchesOrganization(identityProvider, membership, tokenOrganizationId)
    ) {
      return denied(
        authSubject,
        identityProvider,
        "ORGANIZATION_MISMATCH",
        "BLOCKED",
      );
    }

    const rawRole = normalizeRole(membership.role);
    if (rawRole === "admin") {
      return ready(
        membership,
        authSubject,
        identityProvider,
        rawRole,
        "admin",
        "ADMIN",
        "NOT_REQUIRED",
        null,
      );
    }
    if (STAFF_ROLES.has(rawRole)) {
      return ready(
        membership,
        authSubject,
        identityProvider,
        rawRole,
        rawRole,
        "STAFF",
        "NOT_REQUIRED",
        null,
      );
    }
    if (CARER_ROLES.has(rawRole)) {
      const carer = membership.carer;
      if (
        !membership.carer_id ||
        !carer ||
        carer.id !== membership.carer_id ||
        carer.organization_id !== membership.organization_id ||
        !carer.is_active ||
        carer.deleted_at !== null
      ) {
        return activeButUnavailable(
          membership,
          authSubject,
          identityProvider,
          rawRole,
          "carer",
          membership.carer_id ? "INVALID" : "REQUIRED",
          membership.carer_id ? "BLOCKED" : "SETUP_REQUIRED",
        );
      }

      return ready(
        membership,
        authSubject,
        identityProvider,
        rawRole,
        "carer",
        "STAFF",
        "LINKED",
        carer.id,
      );
    }
    if (FAMILY_ROLES.has(rawRole)) {
      return this.resolveFamilyAccess(
        membership,
        authSubject,
        identityProvider,
        rawRole,
      );
    }

    return activeButUnavailable(
      membership,
      authSubject,
      identityProvider,
      rawRole,
      null,
      "NOT_REQUIRED",
      "BLOCKED",
    );
  }

  isPermitted(context: CanonicalAccessContext): boolean {
    return (
      context.membershipState === "ACTIVE" &&
      context.surface !== "NONE" &&
      context.onboardingState === "READY"
    );
  }

  requirePermitted(context: CanonicalAccessContext): CanonicalAccessContext {
    if (!this.isPermitted(context)) {
      throw new ForbiddenException(ACCESS_UNAVAILABLE_MESSAGE);
    }
    return context;
  }

  private async resolveFamilyAccess(
    membership: MembershipRow,
    authSubject: string,
    identityProvider: string,
    rawRole: string,
  ): Promise<CanonicalAccessContext> {
    const contacts = (await (this.prisma as any).familyContact.findMany({
      where: {
        organization_id: membership.organization_id,
        auth_subject: authSubject,
      },
      select: {
        id: true,
        organization_id: true,
        disabled_at: true,
      },
      take: 2,
    })) as FamilyContactRow[];

    if (contacts.length !== 1) {
      return activeButUnavailable(
        membership,
        authSubject,
        identityProvider,
        rawRole,
        "family",
        contacts.length === 0 ? "REQUIRED" : "INVALID",
        contacts.length === 0 ? "SETUP_REQUIRED" : "BLOCKED",
      );
    }

    const contact = contacts[0];
    if (
      contact.disabled_at !== null ||
      contact.organization_id !== membership.organization_id
    ) {
      return activeButUnavailable(
        membership,
        authSubject,
        identityProvider,
        rawRole,
        "family",
        "INVALID",
        "BLOCKED",
      );
    }

    const activeRoom = await (
      this.prisma as any
    ).careRoomMembership.findFirst({
      where: {
        family_contact_id: contact.id,
        status: "ACTIVE",
        revoked_at: null,
        care_room: {
          organization_id: membership.organization_id,
          status: "ACTIVE",
        },
      },
      select: { id: true },
    });
    if (activeRoom) {
      return ready(
        membership,
        authSubject,
        identityProvider,
        rawRole,
        "family",
        "FAMILY",
        "LINKED",
        contact.id,
      );
    }

    const pendingInvitation = await (
      this.prisma as any
    ).careRoomMembership.findFirst({
      where: {
        family_contact_id: contact.id,
        status: "INVITED",
        revoked_at: null,
        care_room: {
          organization_id: membership.organization_id,
          status: "ACTIVE",
        },
      },
      select: { id: true },
    });
    const existingRoomMembership = pendingInvitation
      ? null
      : await (this.prisma as any).careRoomMembership.findFirst({
          where: { family_contact_id: contact.id },
          select: { id: true },
        });
    return activeButUnavailable(
      membership,
      authSubject,
      identityProvider,
      rawRole,
      "family",
      "LINKED",
      pendingInvitation
        ? "PENDING_INVITATION"
        : existingRoomMembership
          ? "BLOCKED"
          : "SETUP_REQUIRED",
      contact.id,
    );
  }
}

function configuredIdentityProvider(): string {
  return (
    (process.env.AUTH_IDENTITY_PROVIDER || "cognito").trim().toLowerCase() ||
    "cognito"
  );
}

function normalizeRole(role: string): string {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function matchesOrganization(
  provider: string,
  membership: MembershipRow,
  tokenOrganizationId: string,
): boolean {
  return (
    membership.organization_id === tokenOrganizationId ||
    (provider === "clerk" &&
      membership.external_organization_id === tokenOrganizationId)
  );
}

function denied(
  authSubject: string,
  identityProvider: string,
  membershipState: Exclude<AccessMembershipState, "ACTIVE">,
  onboardingState: AccessOnboardingState,
): CanonicalAccessContext {
  return Object.freeze({
    authenticated: true as const,
    authSubject,
    identityProvider,
    organizationId: null,
    membershipId: null,
    membershipState,
    rawRole: null,
    effectiveRole: null,
    surface: "NONE" as const,
    linkedIdentityState: "NOT_REQUIRED" as const,
    onboardingState,
    domainIdentityId: null,
  });
}

function ready(
  membership: MembershipRow,
  authSubject: string,
  identityProvider: string,
  rawRole: string,
  effectiveRole: string,
  surface: Exclude<AccessSurface, "NONE">,
  linkedIdentityState: LinkedIdentityState,
  domainIdentityId: string | null,
): CanonicalAccessContext {
  return Object.freeze({
    authenticated: true as const,
    authSubject,
    identityProvider,
    organizationId: membership.organization_id,
    membershipId: membership.id,
    membershipState: "ACTIVE" as const,
    rawRole,
    effectiveRole,
    surface,
    linkedIdentityState,
    onboardingState: "READY" as const,
    domainIdentityId,
  });
}

function activeButUnavailable(
  membership: MembershipRow,
  authSubject: string,
  identityProvider: string,
  rawRole: string,
  effectiveRole: string | null,
  linkedIdentityState: LinkedIdentityState,
  onboardingState: AccessOnboardingState,
  domainIdentityId: string | null = null,
): CanonicalAccessContext {
  return Object.freeze({
    authenticated: true as const,
    authSubject,
    identityProvider,
    organizationId: membership.organization_id,
    membershipId: membership.id,
    membershipState: "ACTIVE" as const,
    rawRole,
    effectiveRole,
    surface: "NONE" as const,
    linkedIdentityState,
    onboardingState,
    domainIdentityId,
  });
}

function nonEmpty(value?: string | null): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}
