import { Injectable } from "@nestjs/common";

const CLERK_API_BASE_URL = "https://api.clerk.com/v1";
const CLERK_TIMEOUT_MS = 10_000;

type ClerkMetadata = Record<string, unknown> | null | undefined;

interface ClerkOrganization {
  id: string;
  name: string;
  slug: string;
  private_metadata?: ClerkMetadata;
}

interface ClerkOrganizationInvitation {
  id: string;
  email_address: string;
  role: string;
  status: string;
  private_metadata?: ClerkMetadata;
}

interface ClerkListResponse<T> {
  data?: T[];
  total_count?: number;
}

export interface EnsureClerkBootstrapInput {
  organizationId: string;
  organizationName: string;
  invitationId: string;
  emailAddress: string;
  externalOrganizationId?: string;
}

export interface EnsureClerkBootstrapResult {
  externalOrganizationId: string;
  externalOrganizationSlug: string;
  externalInvitationId: string;
}

export class ClerkProvisioningError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "ClerkProvisioningError";
  }
}

@Injectable()
export class ClerkProvisioningAdapter {
  async ensureBootstrap(
    input: EnsureClerkBootstrapInput,
  ): Promise<EnsureClerkBootstrapResult> {
    const secretKey = String(process.env.CLERK_SECRET_KEY || "").trim();
    if (!secretKey) {
      throw new ClerkProvisioningError("CLERK_NOT_CONFIGURED", false);
    }

    const slug = `oasis-${input.organizationId.replace(/-/g, "").toLowerCase()}`;
    const organization = input.externalOrganizationId
      ? await this.getAndValidateOrganization(
          secretKey,
          input.externalOrganizationId,
          input.organizationId,
          slug,
        )
      : await this.findOrCreateOrganization(secretKey, input, slug);
    const invitation = await this.findOrCreateInvitation(
      secretKey,
      organization.id,
      input,
    );

    return {
      externalOrganizationId: organization.id,
      externalOrganizationSlug: slug,
      externalInvitationId: invitation.id,
    };
  }

  private async findOrCreateOrganization(
    secretKey: string,
    input: EnsureClerkBootstrapInput,
    slug: string,
  ): Promise<ClerkOrganization> {
    const existing = await this.findOrganizationBySlug(secretKey, slug);
    if (existing) {
      this.validateOrganization(existing, input.organizationId, slug);
      return existing;
    }

    try {
      const created = await this.request<ClerkOrganization>(
        secretKey,
        "/organizations",
        {
          method: "POST",
          body: JSON.stringify({
            name: input.organizationName,
            slug,
            private_metadata: { oasis_organization_id: input.organizationId },
          }),
        },
      );
      this.validateOrganization(created, input.organizationId, slug);
      return created;
    } catch (error) {
      if (
        error instanceof ClerkProvisioningError &&
        (error.code === "CLERK_HTTP_409" || error.code === "CLERK_HTTP_422")
      ) {
        const reconciled = await this.findOrganizationBySlug(secretKey, slug);
        if (reconciled) {
          this.validateOrganization(reconciled, input.organizationId, slug);
          return reconciled;
        }
      }
      throw error;
    }
  }

  private async findOrganizationBySlug(
    secretKey: string,
    slug: string,
  ): Promise<ClerkOrganization | null> {
    const response = await this.request<ClerkListResponse<ClerkOrganization>>(
      secretKey,
      `/organizations?query=${encodeURIComponent(slug)}&limit=500`,
    );
    const matches = (response.data || []).filter((item) => item.slug === slug);
    if (matches.length > 1) {
      throw new ClerkProvisioningError("CLERK_ORGANIZATION_AMBIGUOUS", false);
    }
    if (
      matches.length === 0 &&
      typeof response.total_count === "number" &&
      response.total_count > (response.data || []).length
    ) {
      throw new ClerkProvisioningError(
        "CLERK_ORGANIZATION_PAGE_INCOMPLETE",
        false,
      );
    }
    return matches[0] || null;
  }

  private async getAndValidateOrganization(
    secretKey: string,
    externalOrganizationId: string,
    organizationId: string,
    slug: string,
  ): Promise<ClerkOrganization> {
    const organization = await this.request<ClerkOrganization>(
      secretKey,
      `/organizations/${encodeURIComponent(externalOrganizationId)}`,
    );
    this.validateOrganization(organization, organizationId, slug);
    return organization;
  }

  private validateOrganization(
    organization: ClerkOrganization,
    organizationId: string,
    slug: string,
  ): void {
    if (
      organization.slug !== slug ||
      organization.private_metadata?.oasis_organization_id !== organizationId
    ) {
      throw new ClerkProvisioningError("CLERK_ORGANIZATION_MISMATCH", false);
    }
  }

  private async findOrCreateInvitation(
    secretKey: string,
    externalOrganizationId: string,
    input: EnsureClerkBootstrapInput,
  ): Promise<ClerkOrganizationInvitation> {
    const invitationQuery = new URLSearchParams({ limit: "500" });
    for (const status of ["pending", "accepted", "revoked", "expired"]) {
      invitationQuery.append("status", status);
    }
    const invitations = await this.request<
      ClerkListResponse<ClerkOrganizationInvitation>
    >(
      secretKey,
      `/organizations/${encodeURIComponent(externalOrganizationId)}/invitations?${invitationQuery.toString()}`,
    );
    const items = invitations.data || [];
    const invitation = items.find(
      (item) =>
        item.private_metadata?.oasis_invitation_id === input.invitationId,
    );
    if (invitation) {
      this.validateInvitation(invitation, input);
      return invitation;
    }
    if (
      typeof invitations.total_count === "number" &&
      invitations.total_count > items.length
    ) {
      throw new ClerkProvisioningError(
        "CLERK_INVITATION_PAGE_INCOMPLETE",
        false,
      );
    }

    const normalizedEmail = input.emailAddress.trim().toLowerCase();
    if (
      items.some(
        (item) =>
          item.status === "pending" &&
          item.email_address.trim().toLowerCase() === normalizedEmail,
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
      `/organizations/${encodeURIComponent(externalOrganizationId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({
          email_address: input.emailAddress,
          role: "org:admin",
          redirect_url: `${siteUrl}/admin/setup`,
          expires_in_days: 7,
          private_metadata: { oasis_invitation_id: input.invitationId },
        }),
      },
    );
    this.validateInvitation(created, input);
    return created;
  }

  private validateInvitation(
    invitation: ClerkOrganizationInvitation,
    input: EnsureClerkBootstrapInput,
  ): void {
    const status = invitation.status.toLowerCase();
    const validStatus = status === "pending" || status === "accepted";
    if (
      !validStatus ||
      invitation.email_address.trim().toLowerCase() !==
        input.emailAddress.trim().toLowerCase() ||
      invitation.role !== "org:admin" ||
      invitation.private_metadata?.oasis_invitation_id !== input.invitationId
    ) {
      throw new ClerkProvisioningError("CLERK_INVITATION_MISMATCH", false);
    }
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
