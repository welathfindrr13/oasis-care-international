import { Injectable } from "@nestjs/common";
import { ClerkProvisioningError } from "../company-access/clerk-provisioning.adapter";

const CLERK_API_BASE_URL = "https://api.clerk.com/v1";
const CLERK_TIMEOUT_MS = 10_000;

type ClerkMetadata = Record<string, unknown> | null | undefined;

export interface AcceptedClerkOrganizationInvitation {
  id: string;
  organizationId: string;
  emailAddress: string;
  role: string;
  publicMetadata?: ClerkMetadata;
  privateMetadata?: ClerkMetadata;
}

export interface ClerkOrganizationMembershipProof {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
}

interface ClerkListResponse<T> {
  data?: T[];
  total_count?: number;
}

interface ClerkInvitationResponse {
  id: string;
  organization_id: string;
  email_address: string;
  role: string;
  status: string;
  public_metadata?: ClerkMetadata;
  private_metadata?: ClerkMetadata;
}

interface ClerkMembershipResponse {
  id: string;
  role: string;
  organization?: { id?: string };
  public_user_data?: { user_id?: string };
}

@Injectable()
export class ClerkInvitationVerificationAdapter {
  async listAcceptedInvitationsForUser(
    subject: string,
  ): Promise<AcceptedClerkOrganizationInvitation[]> {
    const response = await this.request<
      ClerkListResponse<ClerkInvitationResponse>
    >(
      `/users/${encodeURIComponent(subject)}/organization_invitations?status=accepted&limit=500`,
    );
    const items = response.data || [];
    this.requireCompletePage(response.total_count, items.length);
    return items.map((item) => {
      if (
        item.status !== "accepted" ||
        !item.id ||
        !item.organization_id ||
        !item.email_address ||
        !item.role
      ) {
        throw new ClerkProvisioningError(
          "CLERK_INVITATION_PROOF_INVALID",
          false,
        );
      }
      return {
        id: item.id,
        organizationId: item.organization_id,
        emailAddress: item.email_address.trim().toLowerCase(),
        role: item.role,
        publicMetadata: item.public_metadata,
        privateMetadata: item.private_metadata,
      };
    });
  }

  async getOrganizationMembership(
    subject: string,
    externalOrganizationId: string,
  ): Promise<ClerkOrganizationMembershipProof> {
    const response = await this.request<
      ClerkListResponse<ClerkMembershipResponse>
    >(
      `/users/${encodeURIComponent(subject)}/organization_memberships?limit=500`,
    );
    const items = response.data || [];
    this.requireCompletePage(response.total_count, items.length);
    const matches = items.filter(
      (item) => item.organization?.id === externalOrganizationId,
    );
    if (matches.length !== 1) {
      throw new ClerkProvisioningError("CLERK_MEMBERSHIP_PROOF_INVALID", false);
    }
    const membership = matches[0];
    if (
      !membership.id ||
      membership.public_user_data?.user_id !== subject ||
      !membership.role
    ) {
      throw new ClerkProvisioningError("CLERK_MEMBERSHIP_PROOF_INVALID", false);
    }
    return {
      id: membership.id,
      organizationId: externalOrganizationId,
      userId: subject,
      role: membership.role,
    };
  }

  private requireCompletePage(
    totalCount: number | undefined,
    itemCount: number,
  ): void {
    if (typeof totalCount === "number" && totalCount > itemCount) {
      throw new ClerkProvisioningError("CLERK_PROOF_PAGE_INCOMPLETE", false);
    }
  }

  private async request<T>(path: string): Promise<T> {
    const secretKey = String(process.env.CLERK_SECRET_KEY || "").trim();
    if (!secretKey) {
      throw new ClerkProvisioningError("CLERK_NOT_CONFIGURED", false);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLERK_TIMEOUT_MS);
    try {
      const response = await fetch(`${CLERK_API_BASE_URL}${path}`, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ClerkProvisioningError(
          `CLERK_HTTP_${response.status}`,
          response.status === 408 ||
            response.status === 429 ||
            response.status >= 500,
        );
      }
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
