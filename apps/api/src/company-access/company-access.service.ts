import { randomUUID } from "crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PrismaService } from "@oasis/db";
import {
  CreateCompanyAccessRequestInput,
  PlatformBootstrapManagerAccessStatus,
  PlatformBootstrapManagerCleanupStatus,
  PlatformCompanyAccessRejectionCode,
  PlatformCompanyAccessRequestDTO,
  PlatformCompanyAccessRequestPageDTO,
  PlatformCompanyAccessRequestStatus,
  PlatformProvisioningStatus,
} from "./company-access.dto";
import { ClerkInvitationAdministrationAdapter } from "../invitation-lifecycle/clerk-invitation-administration.adapter";
import { ClerkProvisioningError } from "./clerk-provisioning.adapter";
import { OrganizationProvisioningService } from "./organization-provisioning.service";

type RequestWithProvisioning = Prisma.CompanyAccessRequestGetPayload<{
  include: {
    provisioning_outbox: true;
    membership_invitations: {
      include: { activated_membership: true };
    };
  };
}>;

type BootstrapManager = {
  invitationId: string;
  membershipId: string;
  organizationId: string;
  email: string;
  authSubject: string;
  externalOrganizationId: string;
  status: string;
  revokedAt: Date | null;
  cleanupRequired: boolean;
  cleanupErrorCode: string | null;
  cleanupCompletedAt: Date | null;
};

@Injectable()
export class CompanyAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: OrganizationProvisioningService,
    private readonly clerk: ClerkInvitationAdministrationAdapter,
  ) {}

  async createPublicRequest(
    input: CreateCompanyAccessRequestInput,
  ): Promise<void> {
    const normalizedEmail = input.businessEmail.trim().toLowerCase();
    try {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.companyAccessRequest.create({
          data: {
            company_name: input.companyName,
            contact_name: input.contactName,
            business_email: normalizedEmail,
            normalized_business_email: normalizedEmail,
            operational_note: input.operationalNote,
          },
        });
        await tx.auditLog.create({
          data: {
            user_id: "anonymous",
            organization_id: null,
            action: "PUBLIC_ACCESS_REQUEST_CREATED",
            resource_type: "CompanyAccessRequest",
            resource_id: created.id,
            old_values: {},
            new_values: { status: "PENDING_APPROVAL" },
          },
        });
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const existing = await this.prisma.companyAccessRequest.findFirst({
        where: {
          normalized_business_email: normalizedEmail,
          status: "PENDING_APPROVAL",
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.auditLog.create({
          data: {
            user_id: "anonymous",
            organization_id: null,
            action: "PUBLIC_ACCESS_REQUEST_REPEATED",
            resource_type: "CompanyAccessRequest",
            resource_id: existing.id,
            old_values: {},
            new_values: { status: "PENDING_APPROVAL" },
          },
        });
        return;
      }
      throw error;
    }
  }

  async list(
    status: PlatformCompanyAccessRequestStatus,
    offset: number,
    limit: number,
  ): Promise<PlatformCompanyAccessRequestPageDTO> {
    if (!Number.isInteger(offset) || offset < 0 || offset > 10_000) {
      throw new BadRequestException("Offset must be between 0 and 10000");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException("Limit must be between 1 and 100");
    }
    const where = { status } as Prisma.CompanyAccessRequestWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.companyAccessRequest.findMany({
        where,
        include: {
          provisioning_outbox: true,
          membership_invitations: {
            where: {
              identity_provider: "clerk",
              intended_role: "admin",
              status: "ACCEPTED",
            },
            include: { activated_membership: true },
          },
        },
        orderBy: [{ requested_at: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.prisma.companyAccessRequest.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toDTO(item)),
      total,
      offset,
      limit,
    };
  }

  async get(id: string): Promise<PlatformCompanyAccessRequestDTO> {
    const request = await this.findRequest(id);
    if (!request)
      throw new NotFoundException("Company access request not found");
    return this.toDTO(request);
  }

  async getOrganizationSetupDetails(
    organizationId: string,
  ): Promise<{ id: string; name: string }> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });
    if (!organization) throw new NotFoundException("Organization not found");
    return organization;
  }

  async approve(
    id: string,
    operatorSubject: string,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    await this.withSerializableRetry(async () => {
      await this.prisma.$transaction(
        async (tx) => {
          const request = await tx.companyAccessRequest.findUnique({
            where: { id },
          });
          if (!request)
            throw new NotFoundException("Company access request not found");
          if (request.status === "APPROVED") return;
          if (request.status !== "PENDING_APPROVAL") {
            throw new ConflictException(
              "Only pending requests can be approved",
            );
          }

          const priorBootstrap = await tx.companyAccessRequest.findFirst({
            where: {
              id: { not: id },
              normalized_business_email: request.normalized_business_email,
              approved_at: { not: null },
              status: { in: ["APPROVED", "DISABLED"] },
            },
            select: { id: true },
          });
          if (priorBootstrap) {
            throw new ConflictException(
              "An organization bootstrap already exists for this business email",
            );
          }

          const now = new Date();
          const organizationId = randomUUID();
          const invitationId = randomUUID();
          const outboxId = randomUUID();
          await tx.organization.create({
            data: { id: organizationId, name: request.company_name.trim() },
          });
          const transitioned = await tx.companyAccessRequest.updateMany({
            where: { id, status: "PENDING_APPROVAL" },
            data: {
              status: "APPROVED",
              organization_id: organizationId,
              reviewed_at: now,
              reviewed_by_subject: operatorSubject,
              approved_at: now,
            },
          });
          if (transitioned.count !== 1) {
            throw new Prisma.PrismaClientKnownRequestError(
              "Concurrent approval",
              {
                code: "P2034",
                clientVersion: Prisma.prismaVersion.client,
              },
            );
          }
          await tx.organizationMembershipInvitation.create({
            data: {
              id: invitationId,
              organization_id: organizationId,
              source_request_id: id,
              identity_provider: "clerk",
              intended_email: request.normalized_business_email,
              normalized_email: request.normalized_business_email,
              intended_role: "admin",
              created_by_subject: operatorSubject,
              expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          await tx.organizationProvisioningOutbox.create({
            data: {
              id: outboxId,
              organization_id: organizationId,
              source_request_id: id,
              invitation_id: invitationId,
            },
          });
          await tx.auditLog.create({
            data: {
              user_id: operatorSubject,
              organization_id: organizationId,
              action: "COMPANY_ACCESS_REQUEST_APPROVED",
              resource_type: "CompanyAccessRequest",
              resource_id: id,
              old_values: { status: "PENDING_APPROVAL" },
              new_values: { status: "APPROVED" },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });

    await this.provisioning.deliverForRequest(id);
    return this.get(id);
  }

  async reject(
    id: string,
    operatorSubject: string,
    rejectionCode: PlatformCompanyAccessRejectionCode,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.companyAccessRequest.findUnique({
        where: { id },
      });
      if (!request)
        throw new NotFoundException("Company access request not found");
      if (request.status === "REJECTED") return;
      if (request.status !== "PENDING_APPROVAL") {
        throw new ConflictException("Only pending requests can be rejected");
      }
      const now = new Date();
      const transitioned = await tx.companyAccessRequest.updateMany({
        where: { id, status: "PENDING_APPROVAL" },
        data: {
          status: "REJECTED",
          reviewed_at: now,
          reviewed_by_subject: operatorSubject,
          rejected_at: now,
        },
      });
      if (transitioned.count !== 1) {
        const latest = await tx.companyAccessRequest.findUniqueOrThrow({
          where: { id },
        });
        if (latest.status === "REJECTED") return;
        throw new ConflictException("Company access request state changed");
      }
      await tx.auditLog.create({
        data: {
          user_id: operatorSubject,
          organization_id: null,
          action: "COMPANY_ACCESS_REQUEST_REJECTED",
          resource_type: "CompanyAccessRequest",
          resource_id: id,
          old_values: { status: "PENDING_APPROVAL" },
          new_values: { status: "REJECTED", rejectionCode },
        },
      });
    });
    return this.get(id);
  }

  async retryProvisioning(
    id: string,
    operatorSubject: string,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    const request = await this.findRequest(id);
    if (!request)
      throw new NotFoundException("Company access request not found");
    if (request.status !== "APPROVED") {
      throw new ConflictException(
        "Only approved requests can retry provisioning",
      );
    }
    await this.provisioning.requeue(id, operatorSubject);
    return this.get(id);
  }

  async revokeBootstrapManagerAccess(
    id: string,
    operatorSubject: string,
  ): Promise<PlatformCompanyAccessRequestDTO> {
    const target = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const request = await tx.companyAccessRequest.findUnique({
            where: { id },
          });
          if (!request)
            throw new NotFoundException("Company access request not found");
          if (!request.organization_id) {
            throw new ConflictException(
              "The company bootstrap organization is unavailable",
            );
          }
          if (!["APPROVED", "DISABLED"].includes(request.status)) {
            throw new ConflictException(
              "Only an approved company bootstrap can revoke its first Manager",
            );
          }

          const invitations =
            await tx.organizationMembershipInvitation.findMany({
              where: {
                source_request_id: request.id,
                organization_id: request.organization_id,
                identity_provider: "clerk",
                normalized_email: request.normalized_business_email,
                intended_role: "admin",
                status: "ACCEPTED",
              },
              include: { activated_membership: true },
              take: 2,
            });
          if (invitations.length !== 1) {
            throw new ConflictException(
              "The first Manager membership could not be identified safely",
            );
          }
          const invitation = invitations[0];
          const membership = invitation.activated_membership;
          if (
            !membership ||
            invitation.activated_membership_id !== membership.id ||
            invitation.bound_auth_subject !== membership.auth_subject ||
            membership.organization_id !== request.organization_id ||
            membership.identity_provider !== "clerk" ||
            membership.normalized_email !== request.normalized_business_email ||
            membership.role !== "admin"
          ) {
            throw new ConflictException(
              "The first Manager membership binding is invalid",
            );
          }

          if (request.status === "APPROVED") {
            if (membership.status !== "ACTIVE" || membership.revoked_at) {
              throw new ConflictException(
                "The first Manager membership state changed",
              );
            }
            const now = new Date();
            const requestTransition = await tx.companyAccessRequest.updateMany({
              where: { id: request.id, status: "APPROVED" },
              data: { status: "DISABLED", disabled_at: now },
            });
            const membershipTransition =
              await tx.organizationMembership.updateMany({
                where: {
                  id: membership.id,
                  organization_id: request.organization_id,
                  identity_provider: "clerk",
                  auth_subject: membership.auth_subject,
                  role: "admin",
                  status: "ACTIVE",
                  revoked_at: null,
                },
                data: {
                  status: "REVOKED",
                  revoked_at: now,
                  external_cleanup_required: true,
                  external_cleanup_error_code: null,
                  external_cleanup_completed_at: null,
                },
              });
            if (
              requestTransition.count !== 1 ||
              membershipTransition.count !== 1
            ) {
              throw new Prisma.PrismaClientKnownRequestError(
                "Concurrent first Manager revocation",
                {
                  code: "P2034",
                  clientVersion: Prisma.prismaVersion.client,
                },
              );
            }
            await tx.auditLog.create({
              data: {
                user_id: operatorSubject,
                organization_id: request.organization_id,
                action: "BOOTSTRAP_MANAGER_ACCESS_REVOKED",
                resource_type: "CompanyAccessRequest",
                resource_id: request.id,
                old_values: {
                  requestStatus: "APPROVED",
                  membershipStatus: "ACTIVE",
                },
                new_values: {
                  requestStatus: "DISABLED",
                  membershipStatus: "REVOKED",
                  cleanupStatus: "PENDING",
                  invitationId: invitation.id,
                  membershipId: membership.id,
                },
              },
            });
            return this.bootstrapManagerTarget(invitation, {
              ...membership,
              status: "REVOKED",
              revoked_at: now,
              external_cleanup_required: true,
              external_cleanup_error_code: null,
              external_cleanup_completed_at: null,
            });
          }

          if (membership.status !== "REVOKED" || !membership.revoked_at) {
            throw new ConflictException(
              "The revoked first Manager membership is unavailable",
            );
          }
          return this.bootstrapManagerTarget(invitation, membership);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    if (target.cleanupRequired) {
      await this.reconcileBootstrapManagerCleanup(target);
    }
    return this.get(id);
  }

  private async reconcileBootstrapManagerCleanup(
    target: BootstrapManager,
  ): Promise<void> {
    const binding = await this.prisma.organizationProviderBinding.findUnique({
      where: {
        organization_id_identity_provider: {
          organization_id: target.organizationId,
          identity_provider: "clerk",
        },
      },
    });
    if (
      !binding ||
      !target.externalOrganizationId ||
      binding.external_organization_id !== target.externalOrganizationId
    ) {
      await this.markBootstrapManagerCleanupFailed(
        target,
        "CLERK_MEMBERSHIP_BINDING_MISMATCH",
      );
      return;
    }

    try {
      await this.clerk.removeOrganizationMembership(
        binding.external_organization_id,
        target.authSubject,
      );
      await this.prisma.organizationMembership.updateMany({
        where: {
          id: target.membershipId,
          organization_id: target.organizationId,
          status: "REVOKED",
          external_cleanup_required: true,
        },
        data: {
          external_cleanup_required: false,
          external_cleanup_error_code: null,
          external_cleanup_completed_at: new Date(),
        },
      });
    } catch (error) {
      await this.markBootstrapManagerCleanupFailed(
        target,
        this.cleanupErrorCode(error),
      );
    }
  }

  private markBootstrapManagerCleanupFailed(
    target: BootstrapManager,
    code: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.organizationMembership.updateMany({
      where: {
        id: target.membershipId,
        organization_id: target.organizationId,
        status: "REVOKED",
        external_cleanup_required: true,
      },
      data: { external_cleanup_error_code: code },
    });
  }

  private cleanupErrorCode(error: unknown): string {
    return error instanceof ClerkProvisioningError
      ? error.code
      : "CLERK_CLEANUP_FAILED";
  }

  private bootstrapManagerTarget(
    invitation: {
      id: string;
      organization_id: string;
      intended_email: string;
    },
    membership: {
      id: string;
      auth_subject: string;
      external_organization_id: string | null;
      status: string;
      revoked_at: Date | null;
      external_cleanup_required: boolean;
      external_cleanup_error_code: string | null;
      external_cleanup_completed_at: Date | null;
    },
  ): BootstrapManager {
    return {
      invitationId: invitation.id,
      membershipId: membership.id,
      organizationId: invitation.organization_id,
      email: invitation.intended_email,
      authSubject: membership.auth_subject,
      externalOrganizationId: membership.external_organization_id || "",
      status: membership.status,
      revokedAt: membership.revoked_at,
      cleanupRequired: membership.external_cleanup_required,
      cleanupErrorCode: membership.external_cleanup_error_code,
      cleanupCompletedAt: membership.external_cleanup_completed_at,
    };
  }

  private findRequest(id: string): Promise<RequestWithProvisioning | null> {
    return this.prisma.companyAccessRequest.findUnique({
      where: { id },
      include: {
        provisioning_outbox: true,
        membership_invitations: {
          where: {
            identity_provider: "clerk",
            intended_role: "admin",
            status: "ACCEPTED",
          },
          include: { activated_membership: true },
        },
      },
    });
  }

  private toDTO(
    request: RequestWithProvisioning,
  ): PlatformCompanyAccessRequestDTO {
    const bootstrapManager = this.bootstrapManagerView(request);
    return {
      id: request.id,
      companyName: request.company_name,
      contactName: request.contact_name,
      businessEmail: request.business_email,
      operationalNote: request.operational_note || undefined,
      status: request.status as PlatformCompanyAccessRequestStatus,
      organizationId: request.organization_id || undefined,
      provisioningStatus: request.provisioning_outbox?.status as
        | PlatformProvisioningStatus
        | undefined,
      provisioningAttemptCount: request.provisioning_outbox?.attempt_count,
      provisioningErrorCode:
        request.provisioning_outbox?.last_error_code || undefined,
      ...bootstrapManager,
      requestedAt: request.requested_at,
      reviewedAt: request.reviewed_at || undefined,
    };
  }

  private bootstrapManagerView(
    request: RequestWithProvisioning,
  ): Pick<
    PlatformCompanyAccessRequestDTO,
    | "bootstrapManagerEmail"
    | "bootstrapManagerAccessStatus"
    | "bootstrapManagerCleanupStatus"
    | "bootstrapManagerCleanupErrorCode"
  > {
    const exact = request.membership_invitations.filter((invitation) => {
      const membership = invitation.activated_membership;
      return (
        request.organization_id !== null &&
        invitation.organization_id === request.organization_id &&
        invitation.source_request_id === request.id &&
        invitation.normalized_email === request.normalized_business_email &&
        invitation.identity_provider === "clerk" &&
        invitation.intended_role === "admin" &&
        invitation.status === "ACCEPTED" &&
        membership !== null &&
        invitation.activated_membership_id === membership.id &&
        invitation.bound_auth_subject === membership.auth_subject &&
        membership.organization_id === request.organization_id &&
        membership.identity_provider === "clerk" &&
        membership.normalized_email === request.normalized_business_email &&
        membership.role === "admin"
      );
    });
    const invitation = exact.length === 1 ? exact[0] : undefined;
    const membership = invitation?.activated_membership;
    if (!invitation || !membership) {
      return {
        bootstrapManagerAccessStatus:
          PlatformBootstrapManagerAccessStatus.UNAVAILABLE,
        bootstrapManagerCleanupStatus:
          PlatformBootstrapManagerCleanupStatus.NOT_REQUIRED,
      };
    }

    const active = membership.status === "ACTIVE" && !membership.revoked_at;
    const revoked =
      membership.status === "REVOKED" && membership.revoked_at !== null;
    if (!active && !revoked) {
      return {
        bootstrapManagerEmail: invitation.intended_email,
        bootstrapManagerAccessStatus:
          PlatformBootstrapManagerAccessStatus.UNAVAILABLE,
        bootstrapManagerCleanupStatus:
          PlatformBootstrapManagerCleanupStatus.NOT_REQUIRED,
      };
    }

    return {
      bootstrapManagerEmail: invitation.intended_email,
      bootstrapManagerAccessStatus: active
        ? PlatformBootstrapManagerAccessStatus.ACTIVE
        : PlatformBootstrapManagerAccessStatus.REVOKED,
      bootstrapManagerCleanupStatus: active
        ? PlatformBootstrapManagerCleanupStatus.NOT_REQUIRED
        : membership.external_cleanup_required
          ? membership.external_cleanup_error_code
            ? PlatformBootstrapManagerCleanupStatus.NEEDS_ATTENTION
            : PlatformBootstrapManagerCleanupStatus.PENDING
          : membership.external_cleanup_completed_at
            ? PlatformBootstrapManagerCleanupStatus.COMPLETE
            : PlatformBootstrapManagerCleanupStatus.NEEDS_ATTENTION,
      bootstrapManagerCleanupErrorCode:
        membership.external_cleanup_error_code ||
        (revoked &&
        !membership.external_cleanup_required &&
        !membership.external_cleanup_completed_at
          ? "CLERK_CLEANUP_STATE_UNAVAILABLE"
          : undefined),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === "P2002";
  }

  private async withSerializableRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        if ((error as { code?: string })?.code !== "P2034" || attempt === 3)
          throw error;
      }
    }
    throw new ConflictException("Concurrent company access update");
  }
}
