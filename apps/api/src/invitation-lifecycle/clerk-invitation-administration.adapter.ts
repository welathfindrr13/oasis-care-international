import { Injectable } from "@nestjs/common";
import { ClerkProvisioningError } from "../company-access/clerk-provisioning.adapter";

const CLERK_API_BASE_URL = "https://api.clerk.com/v1";
const CLERK_TIMEOUT_MS = 10_000;
const CLERK_PAGE_LIMIT = 500;

type ClerkMetadata = Record<string, unknown> | null | undefined;

interface ClerkOrganizationInvitation {
  id: string;
  email_address: string;
  role: string;
  status: string;
  public_metadata?: ClerkMetadata;
  private_metadata?: ClerkMetadata;
}

interface ClerkListResponse<T> {
  data?: T[];
  total_count?: number;
}

export type EnsureOrganizationInvitationInput = {
  externalOrganizationId: string;
  invitationId: string;
  emailAddress: string;
  intendedRole: "admin" | "carer" | "family" | "user";
};

@Injectable()
export class ClerkInvitationAdministrationAdapter {
  async ensureOrganizationInvitation(
    input: EnsureOrganizationInvitationInput,
  ): Promise<{ externalInvitationId: string }> {
    const secretKey = this.secretKey();
    const invitations = await this.listOrganizationInvitations(
      secretKey,
      input.externalOrganizationId,
    );
    const exactMatches = invitations.filter(
      (item) =>
        item.private_metadata?.oasis_invitation_id === input.invitationId,
    );
    if (exactMatches.length > 1) {
      throw new ClerkProvisioningError("CLERK_INVITATION_AMBIGUOUS", false);
    }
    const exact = exactMatches[0];
    if (exact) {
      this.validateInvitation(exact, input);
      return { externalInvitationId: exact.id };
    }
    const email = this.normalizeEmail(input.emailAddress);
    if (
      invitations.some(
        (item) =>
          item.status.toLowerCase() === "pending" &&
          this.normalizeEmail(item.email_address) === email,
      )
    ) {
      throw new ClerkProvisioningError("CLERK_INVITATION_AMBIGUOUS", false);
    }

    const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(
      /\/$/,
      "",
    );
    if (!siteUrl) {
      throw new ClerkProvisioningError("CLERK_REDIRECT_NOT_CONFIGURED", false);
    }
    const created = await this.request<ClerkOrganizationInvitation>(
      secretKey,
      `/organizations/${encodeURIComponent(input.externalOrganizationId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({
          email_address: email,
          role: this.clerkRole(input.intendedRole),
          redirect_url: `${siteUrl}/accept-invitation?oasis_invitation_id=${encodeURIComponent(input.invitationId)}`,
          expires_in_days: 7,
          public_metadata: { oasis_invitation_id: input.invitationId },
          private_metadata: { oasis_invitation_id: input.invitationId },
        }),
      },
    );
    this.validateInvitation(created, input);
    return { externalInvitationId: created.id };
  }

  async revokeOrganizationInvitation(
    externalOrganizationId: string,
    externalInvitationId: string,
  ): Promise<void> {
    const secretKey = this.secretKey();
    try {
      await this.request<ClerkOrganizationInvitation>(
        secretKey,
        `/organizations/${encodeURIComponent(externalOrganizationId)}/invitations/${encodeURIComponent(externalInvitationId)}/revoke`,
        { method: "POST" },
      );
    } catch (error) {
      if (
        error instanceof ClerkProvisioningError &&
        error.code === "CLERK_HTTP_404"
      ) {
        return;
      }
      throw error;
    }
  }

  async revokeOrganizationInvitationByInternalId(
    input: EnsureOrganizationInvitationInput,
  ): Promise<void> {
    const secretKey = this.secretKey();
    const invitations = await this.listOrganizationInvitations(
      secretKey,
      input.externalOrganizationId,
    );
    const exact = invitations.filter(
      (item) =>
        item.private_metadata?.oasis_invitation_id === input.invitationId,
    );
    if (exact.length > 1) {
      throw new ClerkProvisioningError("CLERK_INVITATION_AMBIGUOUS", false);
    }
    const invitation = exact[0];
    const email = this.normalizeEmail(input.emailAddress);
    if (
      invitations.some(
        (item) =>
          item.id !== invitation?.id &&
          item.status.toLowerCase() === "pending" &&
          this.normalizeEmail(item.email_address) === email,
      )
    ) {
      throw new ClerkProvisioningError("CLERK_INVITATION_AMBIGUOUS", false);
    }
    if (!invitation) return;
    this.validateInvitationIdentity(invitation, input);
    const status = invitation.status.toLowerCase();
    if (status === "accepted") {
      throw new ClerkProvisioningError(
        "CLERK_INVITATION_ALREADY_ACCEPTED",
        false,
      );
    }
    if (status === "pending") {
      await this.revokeOrganizationInvitation(
        input.externalOrganizationId,
        invitation.id,
      );
    }
  }

  async removeOrganizationMembership(
    externalOrganizationId: string,
    userId: string,
  ): Promise<void> {
    const secretKey = this.secretKey();
    try {
      await this.request<unknown>(
        secretKey,
        `/organizations/${encodeURIComponent(externalOrganizationId)}/memberships/${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
    } catch (error) {
      if (
        error instanceof ClerkProvisioningError &&
        error.code === "CLERK_HTTP_404"
      ) {
        return;
      }
      throw error;
    }
  }

  private validateInvitation(
    invitation: ClerkOrganizationInvitation,
    input: EnsureOrganizationInvitationInput,
  ): void {
    const status = invitation.status.toLowerCase();
    if (!["pending", "accepted"].includes(status)) {
      throw new ClerkProvisioningError("CLERK_INVITATION_MISMATCH", false);
    }
    this.validateInvitationIdentity(invitation, input);
  }

  private validateInvitationIdentity(
    invitation: ClerkOrganizationInvitation,
    input: EnsureOrganizationInvitationInput,
  ): void {
    if (
      this.normalizeEmail(invitation.email_address) !==
        this.normalizeEmail(input.emailAddress) ||
      invitation.role !== this.clerkRole(input.intendedRole) ||
      invitation.public_metadata?.oasis_invitation_id !== input.invitationId ||
      invitation.private_metadata?.oasis_invitation_id !== input.invitationId
    ) {
      throw new ClerkProvisioningError("CLERK_INVITATION_MISMATCH", false);
    }
  }

  private clerkRole(
    role: EnsureOrganizationInvitationInput["intendedRole"],
  ): string {
    if (role === "admin") return "org:admin";
    return "org:member";
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private async listOrganizationInvitations(
    secretKey: string,
    externalOrganizationId: string,
  ): Promise<ClerkOrganizationInvitation[]> {
    const invitations: ClerkOrganizationInvitation[] = [];
    const invitationIds = new Set<string>();
    let offset = 0;
    let expectedTotal: number | undefined;

    while (true) {
      const query = new URLSearchParams({
        limit: String(CLERK_PAGE_LIMIT),
        offset: String(offset),
      });
      for (const status of ["pending", "accepted", "revoked", "expired"]) {
        query.append("status", status);
      }
      const response = await this.request<
        ClerkListResponse<ClerkOrganizationInvitation>
      >(
        secretKey,
        `/organizations/${encodeURIComponent(externalOrganizationId)}/invitations?${query.toString()}`,
      );
      const page = response.data || [];
      if (typeof response.total_count === "number") {
        if (
          expectedTotal !== undefined &&
          response.total_count !== expectedTotal
        ) {
          throw new ClerkProvisioningError(
            "CLERK_INVITATION_PAGE_INCOMPLETE",
            false,
          );
        }
        expectedTotal = response.total_count;
      }
      if (page.length === 0) {
        if (expectedTotal !== undefined && offset < expectedTotal) {
          throw new ClerkProvisioningError(
            "CLERK_INVITATION_PAGE_INCOMPLETE",
            false,
          );
        }
        break;
      }
      for (const invitation of page) {
        if (invitationIds.has(invitation.id)) {
          throw new ClerkProvisioningError(
            "CLERK_INVITATION_PAGE_INCOMPLETE",
            false,
          );
        }
        invitationIds.add(invitation.id);
        invitations.push(invitation);
      }
      offset += page.length;
      if (expectedTotal !== undefined && offset > expectedTotal) {
        throw new ClerkProvisioningError(
          "CLERK_INVITATION_PAGE_INCOMPLETE",
          false,
        );
      }
      if (expectedTotal !== undefined && offset === expectedTotal) break;
      if (expectedTotal === undefined && page.length < CLERK_PAGE_LIMIT) break;
    }

    if (
      expectedTotal !== undefined &&
      invitationIds.size !== expectedTotal
    ) {
      throw new ClerkProvisioningError(
        "CLERK_INVITATION_PAGE_INCOMPLETE",
        false,
      );
    }

    return invitations;
  }

  private secretKey(): string {
    const value = String(process.env.CLERK_SECRET_KEY || "").trim();
    if (!value) {
      throw new ClerkProvisioningError("CLERK_NOT_CONFIGURED", false);
    }
    return value;
  }

  private async request<T>(
    secretKey: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLERK_TIMEOUT_MS);
    try {
      const response = await fetch(`${CLERK_API_BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ClerkProvisioningError(
          `CLERK_HTTP_${response.status}`,
          response.status === 408 ||
            response.status === 409 ||
            response.status === 429 ||
            response.status >= 500,
        );
      }
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ClerkProvisioningError) throw error;
      if ((error as { name?: string })?.name === "AbortError") {
        throw new ClerkProvisioningError("CLERK_TIMEOUT", true);
      }
      throw new ClerkProvisioningError("CLERK_NETWORK_ERROR", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
