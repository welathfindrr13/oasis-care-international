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
    const shouldDeliver = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const outbox =
            await tx.organizationProvisioningOutbox.findUnique({
              where: { source_request_id: sourceRequestId },
              include: { invitation: true },
            });
          if (!outbox) {
            throw new ConflictException(
              "Provisioning has not been initialized",
            );
          }
          const now = new Date();
          if (
            outbox.status === "PROCESSING" &&
            (!outbox.lease_expires_at || outbox.lease_expires_at > now)
          ) {
            return false;
          }

          const invitation = outbox.invitation;
          const needsReplacement =
            outbox.status === "DELIVERED" &&
            (invitation.status === "EXPIRED" ||
              (invitation.status === "PENDING" &&
                invitation.expires_at <= now));
          if (needsReplacement) {
            const expired =
              await tx.organizationMembershipInvitation.updateMany({
                where: {
                  id: invitation.id,
                  status: invitation.status,
                  activated_membership_id: null,
                },
                data: {
                  status: "EXPIRED",
                  expired_at: invitation.expired_at || now,
                },
              });
            if (expired.count !== 1) {
              throw this.concurrentRequeueError();
            }

            const replacementId = randomUUID();
            await tx.organizationMembershipInvitation.create({
              data: {
                id: replacementId,
                organization_id: invitation.organization_id,
                source_request_id: sourceRequestId,
                identity_provider: invitation.identity_provider,
                intended_email: invitation.intended_email,
                normalized_email: invitation.normalized_email,
                intended_role: invitation.intended_role,
                created_by_subject: operatorSubject,
                expires_at: new Date(
                  now.getTime() + 7 * 24 * 60 * 60 * 1000,
                ),
              },
            });
            const repointed =
              await tx.organizationProvisioningOutbox.updateMany({
                where: {
                  id: outbox.id,
                  status: outbox.status,
                  invitation_id: invitation.id,
                },
                data: {
                  invitation_id: replacementId,
                  status: "PENDING",
                  available_at: now,
                  lease_token: null,
                  lease_expires_at: null,
                  last_error_code: null,
                  delivered_at: null,
                },
              });
            if (repointed.count !== 1) {
              throw this.concurrentRequeueError();
            }
            await tx.auditLog.createMany({
              data: [
                {
                  user_id: operatorSubject,
                  organization_id: outbox.organization_id,
                  action: "ORG_MEMBERSHIP_INVITATION_EXPIRED",
                  resource_type: "OrganizationMembershipInvitation",
                  resource_id: invitation.id,
                  old_values: { status: invitation.status },
                  new_values: { status: "EXPIRED" },
                },
                {
                  user_id: operatorSubject,
                  organization_id: outbox.organization_id,
                  action: "ORG_MEMBERSHIP_INVITATION_REISSUED",
                  resource_type: "OrganizationMembershipInvitation",
                  resource_id: replacementId,
                  old_values: {},
                  new_values: { status: "PENDING" },
                },
              ],
            });
            return true;
          }

          if (outbox.status === "DELIVERED") return false;
          if (invitation.status !== "PENDING") {
            throw new ConflictException("Invitation cannot be provisioned");
          }
          if (outbox.status === "PENDING") return true;

          const compareAndSet: Prisma.OrganizationProvisioningOutboxWhereInput =
            {
              id: outbox.id,
              status: outbox.status,
              invitation_id: invitation.id,
            };
          if (outbox.status === "PROCESSING") {
            compareAndSet.lease_token = outbox.lease_token;
            compareAndSet.lease_expires_at = { lte: now };
          }
          const transitioned =
            await tx.organizationProvisioningOutbox.updateMany({
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
            throw this.concurrentRequeueError();
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

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
      const deliveredAt = new Date();
      const invitation = await tx.organizationMembershipInvitation.updateMany({
        where: { id: outbox.invitation_id, status: "PENDING" },
        data: {
          external_invitation_id: result.externalInvitationId,
          expires_at: new Date(
            deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000,
          ),
        },
      });
      if (invitation.count !== 1) {
        throw new ClerkProvisioningError(
          "CLERK_INVITATION_STATE_CHANGED",
          false,
        );
      }
      await tx.organizationProvisioningOutbox.update({
        where: { id: outbox.id },
        data: {
          status: "DELIVERED",
          lease_token: null,
          lease_expires_at: null,
          last_error_code: null,
          delivered_at: deliveredAt,
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

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (!["P2002", "P2034"].includes(code || "") || attempt === 2) {
          throw error;
        }
      }
    }
    throw new ConflictException("Provisioning state changed; retry");
  }

  private concurrentRequeueError(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError(
      "Concurrent invitation reissue",
      {
        code: "P2034",
        clientVersion: Prisma.prismaVersion.client,
      },
    );
  }
}
