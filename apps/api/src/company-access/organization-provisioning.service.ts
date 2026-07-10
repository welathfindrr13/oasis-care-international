import { randomUUID } from "crypto";
import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, PrismaService } from "@oasis/db";
import {
  ClerkProvisioningAdapter,
  ClerkProvisioningError,
} from "./clerk-provisioning.adapter";

const LEASE_MS = 2 * 60 * 1000;
const MAX_AUTOMATIC_ATTEMPTS = 5;

@Injectable()
export class OrganizationProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerk: ClerkProvisioningAdapter,
  ) {}

  async deliverForRequest(sourceRequestId: string): Promise<void> {
    const claimed = await this.claim(sourceRequestId);
    if (!claimed) return;

    try {
      const binding = await this.prisma.organizationProviderBinding.findUnique({
        where: {
          organization_id_identity_provider: {
            organization_id: claimed.organization_id,
            identity_provider: "clerk",
          },
        },
      });
      const result = await this.clerk.ensureBootstrap({
        organizationId: claimed.organization_id,
        organizationName: claimed.organization.name,
        invitationId: claimed.invitation_id,
        emailAddress: claimed.invitation.intended_email,
        externalOrganizationId: binding?.external_organization_id,
      });
      await this.markDelivered(
        claimed.id,
        claimed.lease_token as string,
        result,
      );
    } catch (error) {
      const failure = this.classifyFailure(error);
      await this.markFailed(
        claimed.id,
        claimed.lease_token as string,
        claimed.attempt_count,
        failure,
      );
    }
  }

  async requeue(
    sourceRequestId: string,
    operatorSubject: string,
  ): Promise<void> {
    const shouldDeliver = await this.prisma.$transaction(async (tx) => {
      const outbox = await tx.organizationProvisioningOutbox.findUnique({
        where: { source_request_id: sourceRequestId },
      });
      if (!outbox) {
        throw new ConflictException("Provisioning has not been initialized");
      }
      if (outbox.status === "DELIVERED") return false;
      if (outbox.status === "PENDING") return true;

      const now = new Date();
      if (
        outbox.status === "PROCESSING" &&
        (!outbox.lease_expires_at || outbox.lease_expires_at > now)
      ) {
        throw new ConflictException("Provisioning is already in progress");
      }

      const compareAndSet: Prisma.OrganizationProvisioningOutboxWhereInput = {
        id: outbox.id,
        status: outbox.status,
      };
      if (outbox.status === "PROCESSING") {
        compareAndSet.lease_token = outbox.lease_token;
        compareAndSet.lease_expires_at = { lte: now };
      }
      const transitioned = await tx.organizationProvisioningOutbox.updateMany({
        where: compareAndSet,
        data: {
          status: "PENDING",
          available_at: now,
          lease_token: null,
          lease_expires_at: null,
          last_error_code: null,
          delivered_at: null,
        },
      });
      if (transitioned.count !== 1) {
        const latest =
          await tx.organizationProvisioningOutbox.findUniqueOrThrow({
            where: { id: outbox.id },
          });
        if (latest.status === "DELIVERED") return false;
        if (latest.status === "PENDING") return true;
        throw new ConflictException(
          "Provisioning state changed; refresh and retry",
        );
      }

      await tx.auditLog.create({
        data: {
          user_id: operatorSubject,
          organization_id: outbox.organization_id,
          action: "CLERK_PROVISIONING_REQUEUED",
          resource_type: "OrganizationProvisioningOutbox",
          resource_id: outbox.id,
          old_values: { status: outbox.status },
          new_values: { status: "PENDING" },
        },
      });
      return true;
    });

    if (shouldDeliver) {
      await this.deliverForRequest(sourceRequestId);
    }
  }

  private async claim(sourceRequestId: string) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const current = await tx.organizationProvisioningOutbox.findUnique({
        where: { source_request_id: sourceRequestId },
      });
      if (!current) return null;

      const eligible =
        current.status === "PENDING" ||
        (current.status === "RETRYABLE" && current.available_at <= now) ||
        (current.status === "PROCESSING" &&
          Boolean(current.lease_expires_at && current.lease_expires_at <= now));
      if (!eligible) return null;

      const leaseToken = randomUUID();
      const where: Prisma.OrganizationProvisioningOutboxWhereInput = {
        id: current.id,
        status: current.status,
      };
      if (current.status === "RETRYABLE") {
        where.available_at = { lte: now };
      }
      if (current.status === "PROCESSING") {
        where.lease_expires_at = { lte: now };
      }

      const updated = await tx.organizationProvisioningOutbox.updateMany({
        where,
        data: {
          status: "PROCESSING",
          lease_token: leaseToken,
          lease_expires_at: new Date(now.getTime() + LEASE_MS),
          attempt_count: { increment: 1 },
        },
      });
      if (updated.count !== 1) return null;

      return tx.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { id: current.id },
        include: { organization: true, invitation: true },
      });
    });
  }

  private async markDelivered(
    outboxId: string,
    leaseToken: string,
    result: {
      externalOrganizationId: string;
      externalOrganizationSlug: string;
      externalInvitationId: string;
    },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const outbox = await tx.organizationProvisioningOutbox.findFirst({
        where: { id: outboxId, status: "PROCESSING", lease_token: leaseToken },
      });
      if (!outbox) return;

      await tx.organizationProviderBinding.upsert({
        where: {
          organization_id_identity_provider: {
            organization_id: outbox.organization_id,
            identity_provider: "clerk",
          },
        },
        create: {
          organization_id: outbox.organization_id,
          identity_provider: "clerk",
          external_organization_id: result.externalOrganizationId,
          external_slug: result.externalOrganizationSlug,
        },
        update: {
          external_organization_id: result.externalOrganizationId,
          external_slug: result.externalOrganizationSlug,
        },
      });
      await tx.organizationMembershipInvitation.update({
        where: { id: outbox.invitation_id },
        data: { external_invitation_id: result.externalInvitationId },
      });
      await tx.organizationProvisioningOutbox.update({
        where: { id: outbox.id },
        data: {
          status: "DELIVERED",
          lease_token: null,
          lease_expires_at: null,
          last_error_code: null,
          delivered_at: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          user_id: "system:provisioning",
          organization_id: outbox.organization_id,
          action: "CLERK_PROVISIONING_DELIVERED",
          resource_type: "OrganizationProvisioningOutbox",
          resource_id: outbox.id,
          old_values: { status: "PROCESSING" },
          new_values: { status: "DELIVERED" },
        },
      });
    });
  }

  private async markFailed(
    outboxId: string,
    leaseToken: string,
    attemptCount: number,
    failure: { code: string; retryable: boolean },
  ): Promise<void> {
    const retryable =
      failure.retryable && attemptCount < MAX_AUTOMATIC_ATTEMPTS;
    const status = retryable ? "RETRYABLE" : "NEEDS_ATTENTION";
    const retryDelayMs = Math.min(
      15 * 60_000,
      30_000 * 2 ** Math.max(0, attemptCount - 1),
    );

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationProvisioningOutbox.updateMany({
        where: { id: outboxId, status: "PROCESSING", lease_token: leaseToken },
        data: {
          status,
          available_at: new Date(Date.now() + retryDelayMs),
          lease_token: null,
          lease_expires_at: null,
          last_error_code: failure.code,
          delivered_at: null,
        },
      });
      if (updated.count !== 1) return;

      const outbox = await tx.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { id: outboxId },
      });
      await tx.auditLog.create({
        data: {
          user_id: "system:provisioning",
          organization_id: outbox.organization_id,
          action: "CLERK_PROVISIONING_FAILED",
          resource_type: "OrganizationProvisioningOutbox",
          resource_id: outbox.id,
          old_values: { status: "PROCESSING" },
          new_values: { status, errorCode: failure.code },
        },
      });
    });
  }

  private classifyFailure(error: unknown): {
    code: string;
    retryable: boolean;
  } {
    if (error instanceof ClerkProvisioningError) {
      return { code: error.code, retryable: error.retryable };
    }
    if ((error as { code?: string })?.code === "P2002") {
      return { code: "PROVISIONING_BINDING_CONFLICT", retryable: false };
    }
    return { code: "PROVISIONING_INTERNAL_ERROR", retryable: true };
  }
}
