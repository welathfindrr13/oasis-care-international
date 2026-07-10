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
  PlatformCompanyAccessRejectionCode,
  PlatformCompanyAccessRequestDTO,
  PlatformCompanyAccessRequestPageDTO,
  PlatformCompanyAccessRequestStatus,
  PlatformProvisioningStatus,
} from "./company-access.dto";
import { OrganizationProvisioningService } from "./organization-provisioning.service";

type RequestWithProvisioning = Prisma.CompanyAccessRequestGetPayload<{
  include: { provisioning_outbox: true };
}>;

@Injectable()
export class CompanyAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: OrganizationProvisioningService,
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
        include: { provisioning_outbox: true },
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

  private findRequest(id: string): Promise<RequestWithProvisioning | null> {
    return this.prisma.companyAccessRequest.findUnique({
      where: { id },
      include: { provisioning_outbox: true },
    });
  }

  private toDTO(
    request: RequestWithProvisioning,
  ): PlatformCompanyAccessRequestDTO {
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
      requestedAt: request.requested_at,
      reviewedAt: request.reviewed_at || undefined,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === "P2002";
  }

  private async withSerializableRetry(
    work: () => Promise<void>,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await work();
        return;
      } catch (error) {
        if ((error as { code?: string })?.code !== "P2034" || attempt === 3)
          throw error;
      }
    }
  }
}
