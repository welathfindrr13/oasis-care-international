import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { Prisma, PrismaService } from "@oasis/db";
import { randomUUID } from "node:crypto";
import { ClerkProvisioningError } from "../company-access/clerk-provisioning.adapter";
import { ClerkInvitationAdministrationAdapter } from "../invitation-lifecycle/clerk-invitation-administration.adapter";
import { CarerAccessLifecycleDTO } from "./dto/carer-invitation.dto";

const INVITATION_DAYS = 7;
const LEASE_MS = 2 * 60 * 1000;
const ALLOWED_WORKFORCE_ROLES = ["carer", "staff"];
const ADMIN_REQUIRED = "Verified admin organization membership is required";
const INVITATION_UNAVAILABLE = "Carer invitation is temporarily unavailable";

type VerifiedAdminPrincipal = {
  organizationId?: string | null;
  organizationMembershipId?: string | null;
  authSubject?: string | null;
};

@Injectable()
export class CarerInvitationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: any,
    private readonly clerk: ClerkInvitationAdministrationAdapter,
  ) {}

  async list(
    principal: VerifiedAdminPrincipal,
  ): Promise<CarerAccessLifecycleDTO[]> {
    const actor = this.requirePrincipal(principal);
    await this.requireVerifiedAdmin(this.prisma, actor);
    await this.reconcileOutstandingCleanup(actor.organizationId);
    await this.expireOverdue(actor.organizationId, actor.authSubject);
    const [invitations, legacyMemberships] = await Promise.all([
      this.prisma.organizationMembershipInvitation.findMany({
        where: {
          organization_id: actor.organizationId,
          identity_provider: this.identityProvider(),
          intended_role: "carer",
          source_request_id: null,
        },
        include: {
          activated_membership: {
            include: { carer: true },
          },
          provisioning_outbox: true,
        },
        orderBy: { created_at: "desc" },
      }),
      this.prisma.organizationMembership.findMany({
        where: {
          organization_id: actor.organizationId,
          identity_provider: this.identityProvider(),
          role: { in: ALLOWED_WORKFORCE_ROLES },
          activated_invitations: { none: {} },
        },
        include: { carer: true },
        orderBy: { created_at: "desc" },
      }),
    ]);
    return [
      ...invitations.map((invitation: any) => this.mapLifecycle(invitation)),
      ...legacyMemberships.map((membership: any) =>
        this.mapMembershipLifecycle(membership),
      ),
    ];
  }

  async invite(
    emailAddress: string,
    principal: VerifiedAdminPrincipal,
  ): Promise<CarerAccessLifecycleDTO> {
    this.requireInvitationProvider();
    const actor = this.requirePrincipal(principal);
    const email = this.normalizeEmail(emailAddress);
    if (!email || email.length > 320 || !email.includes("@")) {
      throw new BadRequestException("A valid carer email address is required");
    }
    await this.requireVerifiedAdmin(this.prisma, actor);
    await this.expireOverdue(actor.organizationId, actor.authSubject);

    let invitationId: string;
    try {
      invitationId = await this.withSerializableRetry<string>(() =>
        this.prisma.$transaction(
          async (tx: any) => {
            await this.requireVerifiedAdmin(tx, actor);
            const existing =
              await tx.organizationMembershipInvitation.findFirst({
                where: {
                  organization_id: actor.organizationId,
                  identity_provider: this.identityProvider(),
                  normalized_email: email,
                  status: "PENDING",
                  source_request_id: null,
                },
                select: { id: true, intended_role: true },
              });
            if (existing) {
              if (existing.intended_role !== "carer") {
                throw new ConflictException(
                  "A different access invitation is already pending for this email",
                );
              }
              return existing.id;
            }

            const unusableHistory =
              await tx.organizationMembershipInvitation.findFirst({
                where: {
                  organization_id: actor.organizationId,
                  identity_provider: this.identityProvider(),
                  normalized_email: email,
                  intended_role: "carer",
                  activated_membership_id: { not: null },
                },
                select: { id: true },
              });
            if (unusableHistory) {
              throw new ConflictException(
                "This account needs manual access review before it can be invited again",
              );
            }
            const existingAccount = await tx.organizationMembership.findFirst({
              where: {
                identity_provider: this.identityProvider(),
                normalized_email: email,
              },
              select: { id: true },
            });
            if (existingAccount) {
              throw new ConflictException(
                "This account needs manual access review before it can be invited again",
              );
            }

            const id = randomUUID();
            const now = new Date();
            await tx.organizationMembershipInvitation.create({
              data: {
                id,
                organization_id: actor.organizationId,
                identity_provider: this.identityProvider(),
                intended_email: email,
                normalized_email: email,
                intended_role: "carer",
                created_by_subject: actor.authSubject,
                expires_at: new Date(
                  now.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000,
                ),
              },
            });
            await tx.organizationProvisioningOutbox.create({
              data: {
                id: randomUUID(),
                organization_id: actor.organizationId,
                source_request_id: null,
                invitation_id: id,
                status: "PENDING",
              },
            });
            await tx.auditLog.create({
              data: {
                organization_id: actor.organizationId,
                user_id: actor.authSubject,
                action: "CARER_INVITATION_CREATED",
                resource_type: "OrganizationMembershipInvitation",
                resource_id: id,
                old_values: {},
                new_values: { status: "PENDING", intendedRole: "carer" },
              },
            });
            return id;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if ((error as { code?: string })?.code === "P2002") {
        const raced =
          await this.prisma.organizationMembershipInvitation.findFirst({
            where: {
              organization_id: actor.organizationId,
              identity_provider: this.identityProvider(),
              normalized_email: email,
              status: "PENDING",
              source_request_id: null,
            },
            select: { id: true, intended_role: true },
          });
        if (raced?.intended_role === "carer") invitationId = raced.id;
        else if (raced)
          throw new ConflictException(
            "A different access invitation is already pending for this email",
          );
        else
          throw new ConflictException("Carer invitation state changed; retry");
      } else {
        throw error;
      }
    }

    await this.deliver(invitationId, actor);
    return this.findLifecycle(invitationId, actor.organizationId);
  }

  async revokeInvitation(
    invitationId: string,
    principal: VerifiedAdminPrincipal,
  ): Promise<CarerAccessLifecycleDTO> {
    this.requireInvitationProvider();
    const actor = this.requirePrincipal(principal);
    await this.prisma.$transaction(async (tx: any) => {
      await this.requireVerifiedAdmin(tx, actor);
      const invitation = await tx.organizationMembershipInvitation.findFirst({
        where: {
          id: invitationId,
          organization_id: actor.organizationId,
          identity_provider: this.identityProvider(),
          intended_role: "carer",
          source_request_id: null,
          activated_membership_id: null,
          status: { in: ["PENDING", "REVOKED"] },
        },
        include: { provisioning_outbox: true },
      });
      if (!invitation) {
        throw new ConflictException(
          "Carer invitation can no longer be revoked",
        );
      }
      if (invitation.status === "PENDING") {
        const now = new Date();
        const updated = await tx.organizationMembershipInvitation.updateMany({
          where: { id: invitation.id, status: "PENDING" },
          data: {
            status: "REVOKED",
            revoked_at: now,
            external_cleanup_required: true,
            external_cleanup_error_code: null,
            external_cleanup_completed_at: null,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException("Carer invitation state changed; retry");
        }
        await tx.auditLog.create({
          data: {
            organization_id: actor.organizationId,
            user_id: actor.authSubject,
            action: "CARER_INVITATION_REVOKED",
            resource_type: "OrganizationMembershipInvitation",
            resource_id: invitation.id,
            old_values: { status: "PENDING" },
            new_values: { status: "REVOKED" },
          },
        });
      }
      if (
        invitation.status === "REVOKED" &&
        !invitation.external_cleanup_required
      ) {
        await tx.organizationMembershipInvitation.update({
          where: { id: invitation.id },
          data: {
            external_cleanup_required: true,
            external_cleanup_error_code: null,
            external_cleanup_completed_at: null,
          },
        });
      }
    });
    await this.reconcileInvitationCleanup(invitationId, actor.organizationId);
    return this.findLifecycle(invitationId, actor.organizationId);
  }

  async retryDelivery(
    invitationId: string,
    principal: VerifiedAdminPrincipal,
  ): Promise<CarerAccessLifecycleDTO> {
    this.requireInvitationProvider();
    const actor = this.requirePrincipal(principal);
    await this.requireVerifiedAdmin(this.prisma, actor);
    const invitation =
      await this.prisma.organizationMembershipInvitation.findFirst({
        where: {
          id: invitationId,
          organization_id: actor.organizationId,
          identity_provider: this.identityProvider(),
          intended_role: "carer",
          source_request_id: null,
          status: "PENDING",
          provisioning_outbox: { status: "RETRYABLE" },
        },
        select: { id: true },
      });
    if (!invitation) {
      throw new ConflictException(
        "Carer invitation delivery cannot be retried",
      );
    }
    await this.deliver(invitation.id, actor);
    return this.findLifecycle(invitation.id, actor.organizationId);
  }

  async reissue(
    invitationId: string,
    principal: VerifiedAdminPrincipal,
  ): Promise<CarerAccessLifecycleDTO> {
    this.requireInvitationProvider();
    const actor = this.requirePrincipal(principal);
    await this.requireVerifiedAdmin(this.prisma, actor);
    await this.expireOverdue(actor.organizationId, actor.authSubject);
    await this.withSerializableRetry<void>(() =>
      this.prisma.$transaction(
        async (tx: any) => {
          await this.requireVerifiedAdmin(tx, actor);
          const previous = await tx.organizationMembershipInvitation.findFirst({
            where: {
              id: invitationId,
              organization_id: actor.organizationId,
              identity_provider: this.identityProvider(),
              intended_role: "carer",
              source_request_id: null,
              activated_membership_id: null,
              status: { in: ["EXPIRED", "REVOKED"] },
            },
          });
          if (!previous) {
            throw new ConflictException("Carer invitation cannot be reissued");
          }
          await tx.organizationMembershipInvitation.update({
            where: { id: previous.id },
            data: {
              external_cleanup_required: true,
              external_cleanup_error_code: null,
              external_cleanup_completed_at: null,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    const cleaned = await this.reconcileInvitationCleanup(
      invitationId,
      actor.organizationId,
    );
    if (!cleaned) {
      return this.findLifecycle(invitationId, actor.organizationId);
    }
    const result = await this.withSerializableRetry<{
      invitationId: string;
    }>(() =>
      this.prisma.$transaction(
        async (tx: any) => {
          await this.requireVerifiedAdmin(tx, actor);
          const previous = await tx.organizationMembershipInvitation.findFirst({
            where: {
              id: invitationId,
              organization_id: actor.organizationId,
              identity_provider: this.identityProvider(),
              intended_role: "carer",
              source_request_id: null,
              activated_membership_id: null,
              status: { in: ["EXPIRED", "REVOKED"] },
              external_cleanup_required: false,
            },
          });
          if (!previous) {
            throw new ConflictException("Carer invitation cannot be reissued");
          }
          const pending = await tx.organizationMembershipInvitation.findFirst({
            where: {
              organization_id: actor.organizationId,
              identity_provider: this.identityProvider(),
              normalized_email: previous.normalized_email,
              status: "PENDING",
              source_request_id: null,
            },
            select: { id: true, intended_role: true },
          });
          if (pending) {
            if (pending.intended_role !== "carer") {
              throw new ConflictException(
                "A different access invitation is already pending for this email",
              );
            }
            return {
              invitationId: pending.id,
            };
          }
          const id = randomUUID();
          const now = new Date();
          await tx.organizationMembershipInvitation.create({
            data: {
              id,
              organization_id: actor.organizationId,
              identity_provider: this.identityProvider(),
              intended_email: previous.intended_email,
              normalized_email: previous.normalized_email,
              intended_role: "carer",
              created_by_subject: actor.authSubject,
              expires_at: new Date(
                now.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000,
              ),
            },
          });
          await tx.organizationProvisioningOutbox.create({
            data: {
              id: randomUUID(),
              organization_id: actor.organizationId,
              source_request_id: null,
              invitation_id: id,
              status: "PENDING",
            },
          });
          await tx.auditLog.create({
            data: {
              organization_id: actor.organizationId,
              user_id: actor.authSubject,
              action: "CARER_INVITATION_REISSUED",
              resource_type: "OrganizationMembershipInvitation",
              resource_id: id,
              old_values: { invitationId: previous.id },
              new_values: { status: "PENDING" },
            },
          });
          return {
            invitationId: id,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    await this.deliver(result.invitationId, actor);
    return this.findLifecycle(result.invitationId, actor.organizationId);
  }

  async deactivateMembership(
    membershipId: string,
    principal: VerifiedAdminPrincipal,
  ): Promise<CarerAccessLifecycleDTO> {
    const actor = this.requirePrincipal(principal);
    const cleanup = await this.withSerializableRetry<{
      invitationId: string | null;
    }>(() =>
      this.prisma.$transaction(
        async (tx: any) => {
          await this.requireVerifiedAdmin(tx, actor);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`carer-membership:${membershipId}`}, 0))`;
          let membership = await tx.organizationMembership.findFirst({
            where: {
              id: membershipId,
              organization_id: actor.organizationId,
              identity_provider: this.identityProvider(),
              role: { in: ALLOWED_WORKFORCE_ROLES },
            },
            include: {
              activated_invitations: {
                where: { intended_role: "carer" },
                take: 1,
              },
            },
          });
          if (!membership || membership.activated_invitations.length > 1) {
            throw new ConflictException(
              "Carer access can no longer be deactivated",
            );
          }
          let openShiftCount = 0;
          if (membership.carer_id) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`carer-identity:${actor.organizationId}:${membership.carer_id}`}, 0))`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`carer-assignment:${actor.organizationId}:${membership.carer_id}`}, 0))`;
            membership = await tx.organizationMembership.findFirst({
              where: {
                id: membershipId,
                organization_id: actor.organizationId,
                identity_provider: this.identityProvider(),
                role: { in: ALLOWED_WORKFORCE_ROLES },
              },
              include: {
                activated_invitations: {
                  where: { intended_role: "carer" },
                  take: 1,
                },
              },
            });
            if (!membership) {
              throw new ConflictException(
                "Carer access can no longer be deactivated",
              );
            }
            openShiftCount = await tx.carerShift.count({
              where: {
                organization_id: actor.organizationId,
                carer_id: membership.carer_id,
                clock_out_at: null,
                deleted_at: null,
              },
            });
          }
          if (membership.status === "ACTIVE" && !membership.revoked_at) {
            const now = new Date();
            const revoked = await tx.organizationMembership.updateMany({
              where: {
                id: membership.id,
                organization_id: actor.organizationId,
                status: "ACTIVE",
                revoked_at: null,
              },
              data: {
                status: "REVOKED",
                revoked_at: now,
                external_cleanup_required: Boolean(
                  membership.external_organization_id &&
                  membership.auth_subject,
                ),
                external_cleanup_error_code: null,
                external_cleanup_completed_at: null,
              },
            });
            if (revoked.count !== 1) {
              throw new ConflictException("Carer access state changed; retry");
            }
            if (membership.carer_id) {
              await tx.carer.updateMany({
                where: {
                  id: membership.carer_id,
                  organization_id: actor.organizationId,
                  is_active: true,
                  deleted_at: null,
                },
                data: { is_active: false },
              });
            }
            await tx.auditLog.create({
              data: {
                organization_id: actor.organizationId,
                user_id: actor.authSubject,
                action: "CARER_ACCESS_DEACTIVATED",
                resource_type: "OrganizationMembership",
                resource_id: membership.id,
                old_values: { status: "ACTIVE" },
                new_values: {
                  status: "REVOKED",
                  carerId: membership.carer_id,
                  openShiftCount,
                },
              },
            });
          }
          if (
            membership.status !== "ACTIVE" &&
            membership.external_organization_id &&
            membership.auth_subject &&
            !membership.external_cleanup_required &&
            !membership.external_cleanup_completed_at
          ) {
            await tx.organizationMembership.update({
              where: { id: membership.id },
              data: {
                external_cleanup_required: true,
                external_cleanup_error_code: null,
              },
            });
          }
          return {
            invitationId: membership.activated_invitations[0]?.id ?? null,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );

    await this.reconcileMembershipCleanup(membershipId, actor.organizationId);
    if (cleanup.invitationId) {
      return this.findLifecycle(cleanup.invitationId, actor.organizationId);
    }
    return this.findMembershipLifecycle(membershipId, actor.organizationId);
  }

  private async deliver(
    invitationId: string,
    actor: {
      organizationId: string;
      membershipId: string;
      authSubject: string;
    },
  ): Promise<void> {
    const claimed = await this.claimDelivery(invitationId);
    if (!claimed) return;
    try {
      await this.requireVerifiedAdmin(this.prisma, actor);
      const binding = await this.prisma.organizationProviderBinding.findUnique({
        where: {
          organization_id_identity_provider: {
            organization_id: actor.organizationId,
            identity_provider: this.identityProvider(),
          },
        },
      });
      if (!binding) {
        throw new ClerkProvisioningError("CLERK_ORGANIZATION_NOT_BOUND", false);
      }
      const result = await this.clerk.ensureOrganizationInvitation({
        externalOrganizationId: binding.external_organization_id,
        invitationId: claimed.invitation.id,
        emailAddress: claimed.invitation.intended_email,
        intendedRole: "carer",
      });
      const deliveredAt = new Date();
      let cleanupRequired = false;
      await this.prisma.$transaction(async (tx: any) => {
        const current = await tx.organizationMembershipInvitation.findFirst({
          where: {
            id: claimed.invitation.id,
            organization_id: actor.organizationId,
            intended_role: "carer",
            source_request_id: null,
          },
        });
        if (!current) {
          throw new ConflictException("Carer invitation state changed; retry");
        }
        if (current.status === "PENDING") {
          if (
            current.external_invitation_id &&
            current.external_invitation_id !== result.externalInvitationId
          ) {
            throw new ConflictException(
              "Carer invitation state changed; retry",
            );
          }
          await tx.organizationMembershipInvitation.update({
            where: { id: current.id },
            data: {
              external_invitation_id: result.externalInvitationId,
              expires_at: new Date(
                deliveredAt.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000,
              ),
            },
          });
        } else if (["REVOKED", "EXPIRED"].includes(current.status)) {
          if (
            current.external_invitation_id &&
            current.external_invitation_id !== result.externalInvitationId
          ) {
            throw new ConflictException(
              "Carer invitation state changed; retry",
            );
          }
          cleanupRequired = true;
          await tx.organizationMembershipInvitation.update({
            where: { id: current.id },
            data: {
              external_invitation_id: result.externalInvitationId,
              external_cleanup_required: true,
              external_cleanup_error_code: null,
              external_cleanup_completed_at: null,
            },
          });
        } else {
          throw new ConflictException("Carer invitation state changed; retry");
        }
        const delivered = await tx.organizationProvisioningOutbox.updateMany({
          where: {
            id: claimed.id,
            status: "PROCESSING",
            lease_token: claimed.lease_token,
          },
          data: {
            status: "DELIVERED",
            lease_token: null,
            lease_expires_at: null,
            last_error_code: null,
            delivered_at: deliveredAt,
          },
        });
        if (delivered.count !== 1) {
          throw new ConflictException(
            "Carer invitation delivery lease changed; retry",
          );
        }
      });
      if (cleanupRequired) {
        await this.reconcileInvitationCleanup(
          claimed.invitation.id,
          actor.organizationId,
        );
      }
    } catch (error) {
      await this.markDeliveryFailed(
        claimed.id,
        claimed.lease_token as string,
        error,
      );
    }
  }

  private async claimDelivery(invitationId: string): Promise<any | null> {
    return this.prisma.$transaction(async (tx: any) => {
      const current = await tx.organizationProvisioningOutbox.findUnique({
        where: { invitation_id: invitationId },
      });
      if (!current || current.source_request_id) return null;
      const now = new Date();
      const eligible =
        current.status === "PENDING" ||
        current.status === "RETRYABLE" ||
        current.status === "NEEDS_ATTENTION" ||
        (current.status === "PROCESSING" &&
          current.lease_expires_at &&
          current.lease_expires_at <= now);
      if (!eligible) return null;
      const leaseToken = randomUUID();
      const compareAndSet: Record<string, unknown> = {
        id: current.id,
        status: current.status,
      };
      if (current.status === "PROCESSING") {
        compareAndSet.lease_token = current.lease_token;
        compareAndSet.lease_expires_at = current.lease_expires_at;
      }
      const updated = await tx.organizationProvisioningOutbox.updateMany({
        where: compareAndSet,
        data: {
          status: "PROCESSING",
          lease_token: leaseToken,
          lease_expires_at: new Date(now.getTime() + LEASE_MS),
          last_error_code: null,
          attempt_count: { increment: 1 },
        },
      });
      if (updated.count !== 1) return null;
      return tx.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { id: current.id },
        include: { invitation: true },
      });
    });
  }

  private async markDeliveryFailed(
    outboxId: string,
    leaseToken: string,
    error: unknown,
  ): Promise<void> {
    const known = error instanceof ClerkProvisioningError ? error : null;
    await this.prisma.organizationProvisioningOutbox.updateMany({
      where: { id: outboxId, status: "PROCESSING", lease_token: leaseToken },
      data: {
        status: known?.retryable ? "RETRYABLE" : "NEEDS_ATTENTION",
        available_at: new Date(Date.now() + 30_000),
        lease_token: null,
        lease_expires_at: null,
        last_error_code: known?.code || "INVITATION_DELIVERY_FAILED",
      },
    });
  }

  private async reconcileOutstandingCleanup(
    organizationId: string,
  ): Promise<void> {
    const [invitations, memberships] = await Promise.all([
      this.prisma.organizationMembershipInvitation.findMany({
        where: {
          organization_id: organizationId,
          intended_role: "carer",
          source_request_id: null,
          external_cleanup_required: true,
        },
        select: { id: true },
        take: 20,
      }),
      this.prisma.organizationMembership.findMany({
        where: {
          organization_id: organizationId,
          role: { in: ALLOWED_WORKFORCE_ROLES },
          external_cleanup_required: true,
        },
        select: { id: true },
        take: 20,
      }),
    ]);
    for (const invitation of invitations) {
      await this.reconcileInvitationCleanup(invitation.id, organizationId);
    }
    for (const membership of memberships) {
      await this.reconcileMembershipCleanup(membership.id, organizationId);
    }
  }

  private async reconcileInvitationCleanup(
    invitationId: string,
    organizationId: string,
  ): Promise<boolean> {
    const invitation =
      await this.prisma.organizationMembershipInvitation.findFirst({
        where: {
          id: invitationId,
          organization_id: organizationId,
          identity_provider: this.identityProvider(),
          intended_role: "carer",
          source_request_id: null,
        },
      });
    if (!invitation?.external_cleanup_required) return true;
    const binding = await this.prisma.organizationProviderBinding.findUnique({
      where: {
        organization_id_identity_provider: {
          organization_id: organizationId,
          identity_provider: this.identityProvider(),
        },
      },
    });
    if (!binding) {
      await this.markInvitationCleanupFailed(
        invitation.id,
        "CLERK_ORGANIZATION_NOT_BOUND",
      );
      return false;
    }
    try {
      await this.clerk.revokeOrganizationInvitationByInternalId({
        externalOrganizationId: binding.external_organization_id,
        invitationId: invitation.id,
        emailAddress: invitation.intended_email,
        intendedRole: "carer",
      });
      await this.prisma.organizationMembershipInvitation.updateMany({
        where: { id: invitation.id, external_cleanup_required: true },
        data: {
          external_cleanup_required: false,
          external_cleanup_error_code: null,
          external_cleanup_completed_at: new Date(),
        },
      });
      return true;
    } catch (error) {
      await this.markInvitationCleanupFailed(
        invitation.id,
        this.cleanupErrorCode(error),
      );
      return false;
    }
  }

  private async reconcileMembershipCleanup(
    membershipId: string,
    organizationId: string,
  ): Promise<boolean> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        id: membershipId,
        organization_id: organizationId,
        identity_provider: this.identityProvider(),
        role: { in: ALLOWED_WORKFORCE_ROLES },
      },
    });
    if (!membership?.external_cleanup_required) return true;
    const binding = await this.prisma.organizationProviderBinding.findUnique({
      where: {
        organization_id_identity_provider: {
          organization_id: organizationId,
          identity_provider: this.identityProvider(),
        },
      },
    });
    if (
      !binding ||
      !membership.external_organization_id ||
      binding.external_organization_id !==
        membership.external_organization_id ||
      !membership.auth_subject
    ) {
      await this.prisma.organizationMembership.updateMany({
        where: { id: membership.id, external_cleanup_required: true },
        data: {
          external_cleanup_error_code: "CLERK_MEMBERSHIP_BINDING_MISMATCH",
        },
      });
      return false;
    }
    try {
      await this.clerk.removeOrganizationMembership(
        binding.external_organization_id,
        membership.auth_subject,
      );
      await this.prisma.organizationMembership.updateMany({
        where: { id: membership.id, external_cleanup_required: true },
        data: {
          external_cleanup_required: false,
          external_cleanup_error_code: null,
          external_cleanup_completed_at: new Date(),
        },
      });
      return true;
    } catch (error) {
      await this.prisma.organizationMembership.updateMany({
        where: { id: membership.id, external_cleanup_required: true },
        data: { external_cleanup_error_code: this.cleanupErrorCode(error) },
      });
      return false;
    }
  }

  private async markInvitationCleanupFailed(
    invitationId: string,
    code: string,
  ): Promise<void> {
    await this.prisma.organizationMembershipInvitation.updateMany({
      where: { id: invitationId, external_cleanup_required: true },
      data: { external_cleanup_error_code: code },
    });
  }

  private cleanupErrorCode(error: unknown): string {
    return error instanceof ClerkProvisioningError
      ? error.code
      : "CLERK_CLEANUP_FAILED";
  }

  private async expireOverdue(
    organizationId: string,
    actorSubject: string,
  ): Promise<void> {
    const overdue = await this.prisma.organizationMembershipInvitation.findMany(
      {
        where: {
          organization_id: organizationId,
          identity_provider: this.identityProvider(),
          intended_role: "carer",
          source_request_id: null,
          status: "PENDING",
          expires_at: { lte: new Date() },
        },
        select: { id: true },
      },
    );
    for (const item of overdue) {
      await this.prisma.$transaction(async (tx: any) => {
        const now = new Date();
        const changed = await tx.organizationMembershipInvitation.updateMany({
          where: {
            id: item.id,
            organization_id: organizationId,
            status: "PENDING",
          },
          data: { status: "EXPIRED", expired_at: now },
        });
        if (changed.count === 1) {
          await tx.auditLog.create({
            data: {
              organization_id: organizationId,
              user_id: actorSubject,
              action: "CARER_INVITATION_EXPIRED",
              resource_type: "OrganizationMembershipInvitation",
              resource_id: item.id,
              old_values: { status: "PENDING" },
              new_values: { status: "EXPIRED" },
            },
          });
        }
      });
    }
  }

  private async findLifecycle(
    invitationId: string,
    organizationId: string,
  ): Promise<CarerAccessLifecycleDTO> {
    const invitation =
      await this.prisma.organizationMembershipInvitation.findFirst({
        where: {
          id: invitationId,
          organization_id: organizationId,
          intended_role: "carer",
          source_request_id: null,
        },
        include: {
          activated_membership: { include: { carer: true } },
          provisioning_outbox: true,
        },
      });
    if (!invitation)
      throw new ConflictException("Carer invitation is unavailable");
    return this.mapLifecycle(invitation);
  }

  private mapLifecycle(invitation: any): CarerAccessLifecycleDTO {
    const membership = invitation.activated_membership;
    const active =
      membership?.status === "ACTIVE" && membership?.revoked_at == null;
    const ready =
      active &&
      membership?.carer_id &&
      membership?.carer?.is_active === true &&
      membership?.carer?.deleted_at == null;
    const linkMissing = active && !membership?.carer_id;
    const revoked = membership && !active;
    const status = revoked ? "REVOKED" : active ? "ACTIVE" : invitation.status;
    return {
      lifecycleId: `invitation:${invitation.id}`,
      invitationId: invitation.id,
      membershipId: membership?.id ?? null,
      carerId: membership?.carer_id ?? null,
      emailAddress: invitation.intended_email,
      status,
      readiness: ready
        ? "READY"
        : linkMissing
          ? "LINK_REQUIRED"
          : active
            ? "BLOCKED"
            : status === "PENDING"
              ? "AWAITING_ACCEPTANCE"
              : "DISABLED",
      deliveryStatus: invitation.provisioning_outbox?.status || "UNAVAILABLE",
      cleanupStatus: invitation.external_cleanup_required
        ? invitation.external_cleanup_error_code
          ? "MANUAL_REVIEW"
          : "PENDING"
        : "COMPLETE",
      expiresAt: invitation.expires_at,
      canRevoke: invitation.status === "PENDING" && !membership,
      canReissue:
        !membership && ["EXPIRED", "REVOKED"].includes(invitation.status),
      canRetryDelivery:
        invitation.status === "PENDING" &&
        invitation.provisioning_outbox?.status === "RETRYABLE",
      canLink: Boolean(linkMissing),
      canDeactivate: Boolean(active),
    };
  }

  private async findMembershipLifecycle(
    membershipId: string,
    organizationId: string,
  ): Promise<CarerAccessLifecycleDTO> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        id: membershipId,
        organization_id: organizationId,
        role: { in: ALLOWED_WORKFORCE_ROLES },
      },
      include: { carer: true },
    });
    if (!membership) throw new ConflictException("Carer access is unavailable");
    return this.mapMembershipLifecycle(membership);
  }

  private mapMembershipLifecycle(membership: any): CarerAccessLifecycleDTO {
    const active = membership.status === "ACTIVE" && !membership.revoked_at;
    const ready =
      active &&
      membership.carer_id &&
      membership.carer?.is_active === true &&
      membership.carer?.deleted_at == null;
    const linkMissing = active && !membership.carer_id;
    return {
      lifecycleId: `membership:${membership.id}`,
      invitationId: null,
      membershipId: membership.id,
      carerId: membership.carer_id ?? null,
      emailAddress: membership.normalized_email || "Workforce login",
      status: active ? "ACTIVE" : "REVOKED",
      readiness: ready
        ? "READY"
        : linkMissing
          ? "LINK_REQUIRED"
          : active
            ? "BLOCKED"
            : "DISABLED",
      deliveryStatus: "UNAVAILABLE",
      cleanupStatus: membership.external_cleanup_required
        ? membership.external_cleanup_error_code
          ? "MANUAL_REVIEW"
          : "PENDING"
        : "COMPLETE",
      expiresAt: null,
      canRevoke: false,
      canReissue: false,
      canRetryDelivery: false,
      canLink: Boolean(linkMissing),
      canDeactivate: active,
    };
  }

  private requirePrincipal(principal: VerifiedAdminPrincipal) {
    const organizationId = String(principal.organizationId || "").trim();
    const membershipId = String(
      principal.organizationMembershipId || "",
    ).trim();
    const authSubject = String(principal.authSubject || "").trim();
    if (!organizationId || !membershipId || !authSubject) {
      throw new ForbiddenException(ADMIN_REQUIRED);
    }
    return { organizationId, membershipId, authSubject };
  }

  private async requireVerifiedAdmin(tx: any, actor: any): Promise<void> {
    const membership = await tx.organizationMembership.findFirst({
      where: {
        id: actor.membershipId,
        organization_id: actor.organizationId,
        identity_provider: this.identityProvider(),
        auth_subject: actor.authSubject,
        role: "admin",
        status: "ACTIVE",
        revoked_at: null,
      },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException(ADMIN_REQUIRED);
  }

  private identityProvider(): string {
    return String(process.env.AUTH_IDENTITY_PROVIDER || "cognito")
      .trim()
      .toLowerCase();
  }

  private requireInvitationProvider(): void {
    if (this.identityProvider() !== "clerk") {
      throw new ConflictException(
        "Secure workforce invitations are not configured in this environment",
      );
    }
  }

  private normalizeEmail(value: string): string {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if ((error as { code?: string })?.code !== "P2034" || attempt === 2) {
          throw error;
        }
      }
    }
    throw new InternalServerErrorException(INVITATION_UNAVAILABLE);
  }
}
