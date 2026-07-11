import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  AccessGrantScope,
  CareRoomMembershipStatus,
  Prisma,
  PrismaService,
} from '@oasis/db';
import { randomUUID } from 'node:crypto';
import { ClerkProvisioningError } from '../company-access/clerk-provisioning.adapter';
import { ClerkInvitationAdministrationAdapter } from '../invitation-lifecycle/clerk-invitation-administration.adapter';
import {
  InviteFamilyContactInput,
  UpdateFamilyAccessGrantsInput,
} from './dto/carebridge.dto';

const INVITATION_DAYS = 7;
const DELIVERY_LEASE_MS = 2 * 60 * 1000;
const ADMIN_REQUIRED = 'Verified admin organization membership is required';
const FAMILY_INVITATION_UNAVAILABLE = 'Family invitation is temporarily unavailable';
const FAMILY_ACCESS_UNAVAILABLE = 'Family access is unavailable';
const SUPPORTED_FAMILY_SCOPES = new Set<AccessGrantScope>([
  AccessGrantScope.VIEW_UPDATES,
  AccessGrantScope.VIEW_VISIT_TIMES,
  AccessGrantScope.VIEW_TASK_SUMMARY,
  AccessGrantScope.VIEW_WEEKLY_SUMMARIES,
  AccessGrantScope.RAISE_CONCERNS,
  AccessGrantScope.REPLY_TO_CONCERNS,
  AccessGrantScope.SUBMIT_PULSE,
]);

export type VerifiedFamilyAdminPrincipal = {
  organizationId?: string | null;
  organizationMembershipId?: string | null;
  authSubject?: string | null;
};

@Injectable()
export class FamilyInvitationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: any,
    private readonly clerk: ClerkInvitationAdministrationAdapter,
  ) {}

  async invite(
    input: InviteFamilyContactInput,
    principal: VerifiedFamilyAdminPrincipal,
  ) {
    this.requireInvitationProvider();
    const actor = this.requirePrincipal(principal);
    const email = this.normalizeEmail(input.email);
    const fullName = String(input.fullName || '').trim();
    const relationship = String(input.relationship || '').trim() || null;
    if (!email || email.length > 320 || !email.includes('@')) {
      throw new BadRequestException('A valid family contact email address is required');
    }
    if (!fullName || fullName.length > 200 || (relationship && relationship.length > 100)) {
      throw new BadRequestException('Family contact details are invalid');
    }

    await this.requireVerifiedAdmin(this.prisma, actor);
    await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx: any) => {
          await this.requireVerifiedAdmin(tx, actor);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`family-invitation:${actor.organizationId}:${email}`}, 0))`;
          await this.expireOverdueInvitations(
            tx,
            actor,
            email,
            new Date(),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    let result: { membershipId: string; invitationId: string; deliveryRequired: boolean };
    try {
      result = await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx: any) => {
            await this.requireVerifiedAdmin(tx, actor);
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`family-invitation:${actor.organizationId}:${email}`}, 0))`;
            const now = new Date();

            const room = await tx.careRoom.findFirst({
              where: {
                id: input.careRoomId,
                organization_id: actor.organizationId,
                status: 'ACTIVE',
              },
              select: { id: true },
            });
            if (!room) {
              throw new ForbiddenException(FAMILY_ACCESS_UNAVAILABLE);
            }

            const pending = await tx.organizationMembershipInvitation.findFirst({
              where: {
                organization_id: actor.organizationId,
                identity_provider: this.identityProvider(),
                normalized_email: email,
                status: 'PENDING',
                expires_at: { gt: now },
              },
              select: { id: true },
            });
            const contacts = await tx.familyContact.findMany({
              where: { organization_id: actor.organizationId, email },
              select: {
                id: true,
                auth_subject: true,
                disabled_at: true,
              },
              take: 2,
            });
            const existingAccounts = await tx.organizationMembership.findMany({
              where: {
                organization_id: actor.organizationId,
                identity_provider: this.identityProvider(),
                normalized_email: email,
              },
              select: { id: true, auth_subject: true, role: true, status: true },
              take: 2,
            });
            if (pending || contacts.length > 1 || existingAccounts.length > 1) {
              throw new ConflictException(
                'This account needs manual family-access review before it can be invited',
              );
            }

            const contact = contacts[0] ?? null;
            const trustedInvitation = contact?.auth_subject && !contact.disabled_at
              ? await tx.organizationMembershipInvitation.findFirst({
                  where: {
                    organization_id: actor.organizationId,
                    identity_provider: this.identityProvider(),
                    normalized_email: email,
                    intended_role: 'family',
                    status: 'ACCEPTED',
                    bound_auth_subject: contact.auth_subject,
                    activated_membership: {
                      organization_id: actor.organizationId,
                      identity_provider: this.identityProvider(),
                      auth_subject: contact.auth_subject,
                      normalized_email: email,
                      role: 'family',
                      status: 'ACTIVE',
                      revoked_at: null,
                    },
                  },
                  orderBy: { accepted_at: 'desc' },
                  select: {
                    id: true,
                    activated_membership_id: true,
                  },
                })
              : null;

            if (trustedInvitation) {
              if (
                existingAccounts.length !== 1 ||
                existingAccounts[0].id !== trustedInvitation.activated_membership_id
              ) {
                throw new ConflictException(
                  'This account needs manual family-access review before it can be invited',
                );
              }
              const existingRoomMembership = await tx.careRoomMembership.findFirst({
                where: {
                  care_room_id: room.id,
                  family_contact_id: contact!.id,
                },
                include: { access_grants: true },
              });
              if (
                existingRoomMembership?.status === CareRoomMembershipStatus.ACTIVE &&
                existingRoomMembership.revoked_at === null
              ) {
                throw new ConflictException('This family member already has access to this CareRoom');
              }
              if (
                existingRoomMembership &&
                ![CareRoomMembershipStatus.REVOKED, CareRoomMembershipStatus.EXPIRED].includes(
                  existingRoomMembership.status,
                )
              ) {
                throw new ConflictException(
                  'This account needs manual family-access review before it can be invited',
                );
              }
              if (existingRoomMembership) {
                await tx.accessGrant.updateMany({
                  where: {
                    care_room_membership_id: existingRoomMembership.id,
                    revoked_at: null,
                  },
                  data: { revoked_at: now },
                });
              }
              const membership = existingRoomMembership
                ? await tx.careRoomMembership.update({
                    where: { id: existingRoomMembership.id },
                    data: {
                      organization_membership_invitation_id: trustedInvitation.id,
                      role: input.role,
                      access_basis: input.accessBasis,
                      status: CareRoomMembershipStatus.ACTIVE,
                      invited_by_user_id: actor.authSubject,
                      approved_by_user_id: null,
                      revoked_by_user_id: null,
                      invited_at: now,
                      accepted_at: now,
                      revoked_at: null,
                    },
                  })
                : await tx.careRoomMembership.create({
                    data: {
                      care_room_id: room.id,
                      family_contact_id: contact!.id,
                      organization_membership_invitation_id: trustedInvitation.id,
                      role: input.role,
                      access_basis: input.accessBasis,
                      status: CareRoomMembershipStatus.ACTIVE,
                      invited_by_user_id: actor.authSubject,
                      accepted_at: now,
                    },
                  });
              await tx.auditLog.create({
                data: {
                  organization_id: actor.organizationId,
                  user_id: actor.authSubject,
                  action: existingRoomMembership ? 'FAMILY_ACCESS_RESTORED' : 'FAMILY_ACCESS_ADDED',
                  resource_type: 'CareRoomMembership',
                  resource_id: membership.id,
                  old_values: existingRoomMembership
                    ? { status: existingRoomMembership.status }
                    : {},
                  new_values: {
                    invitationId: trustedInvitation.id,
                    careRoomId: room.id,
                    status: 'ACTIVE',
                    grantCount: 0,
                  },
                },
              });
              return {
                membershipId: membership.id,
                invitationId: trustedInvitation.id,
                deliveryRequired: false,
              };
            }

            if (
              existingAccounts.length > 0 ||
              (contact && (contact.auth_subject !== null || contact.disabled_at !== null))
            ) {
              throw new ConflictException(
                'This account needs manual family-access review before it can be invited',
              );
            }

            const unresolvedHistory = await tx.organizationMembershipInvitation.findFirst({
              where: {
                organization_id: actor.organizationId,
                identity_provider: this.identityProvider(),
                normalized_email: email,
                intended_role: 'family',
                source_request_id: null,
                OR: [
                  { external_cleanup_required: true },
                  {
                    provisioning_outbox: {
                      status: { in: ['PROCESSING', 'RETRYABLE', 'NEEDS_ATTENTION'] },
                    },
                  },
                ],
              },
              select: { id: true },
            });
            if (unresolvedHistory) {
              throw new ConflictException(
                'This account needs manual family-access review before it can be invited',
              );
            }

            const id = randomUUID();
            await tx.organizationMembershipInvitation.create({
              data: {
                id,
                organization_id: actor.organizationId,
                identity_provider: this.identityProvider(),
                intended_email: email,
                normalized_email: email,
                intended_role: 'family',
                created_by_subject: actor.authSubject,
                expires_at: new Date(now.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
              },
            });
            const invitationContact = contact
              ? await tx.familyContact.update({
                  where: { id: contact.id },
                  data: {
                    full_name: fullName,
                    relationship,
                    identity_type: this.identityProvider(),
                  },
                })
              : await tx.familyContact.create({
                  data: {
                    organization_id: actor.organizationId,
                    full_name: fullName,
                    email,
                    relationship,
                    identity_type: this.identityProvider(),
                  },
                });
            const previousRoomMembership = await tx.careRoomMembership.findFirst({
              where: {
                care_room_id: room.id,
                family_contact_id: invitationContact.id,
              },
            });
            if (
              previousRoomMembership &&
              ![CareRoomMembershipStatus.REVOKED, CareRoomMembershipStatus.EXPIRED].includes(
                previousRoomMembership.status,
              )
            ) {
              throw new ConflictException(
                'This account needs manual family-access review before it can be invited',
              );
            }
            if (previousRoomMembership) {
              await tx.accessGrant.updateMany({
                where: {
                  care_room_membership_id: previousRoomMembership.id,
                  revoked_at: null,
                },
                data: { revoked_at: now },
              });
            }
            const membership = previousRoomMembership
              ? await tx.careRoomMembership.update({
                  where: { id: previousRoomMembership.id },
                  data: {
                    organization_membership_invitation_id: id,
                    role: input.role,
                    access_basis: input.accessBasis,
                    status: CareRoomMembershipStatus.INVITED,
                    invited_by_user_id: actor.authSubject,
                    approved_by_user_id: null,
                    revoked_by_user_id: null,
                    invited_at: now,
                    accepted_at: null,
                    revoked_at: null,
                  },
                })
              : await tx.careRoomMembership.create({
                  data: {
                    care_room_id: room.id,
                    family_contact_id: invitationContact.id,
                    organization_membership_invitation_id: id,
                    role: input.role,
                    access_basis: input.accessBasis,
                    status: CareRoomMembershipStatus.INVITED,
                    invited_by_user_id: actor.authSubject,
                  },
                });
            await tx.organizationProvisioningOutbox.create({
              data: {
                id: randomUUID(),
                organization_id: actor.organizationId,
                source_request_id: null,
                invitation_id: id,
                status: 'PENDING',
              },
            });
            await tx.auditLog.create({
              data: {
                organization_id: actor.organizationId,
                user_id: actor.authSubject,
                action: 'FAMILY_INVITATION_CREATED',
                resource_type: 'CareRoomMembership',
                resource_id: membership.id,
                old_values: {},
                new_values: {
                  invitationId: id,
                  careRoomId: room.id,
                  status: 'INVITED',
                  grantCount: 0,
                },
              },
            });
            return {
              membershipId: membership.id,
              invitationId: id,
              deliveryRequired: true,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof ForbiddenException) {
        throw error;
      }
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException('Family invitation state changed; retry');
      }
      throw error;
    }

    if (result.deliveryRequired) {
      await this.deliver(result.invitationId, actor);
    }
    return this.findMembership(result.membershipId, actor.organizationId);
  }

  async setGrants(
    input: UpdateFamilyAccessGrantsInput,
    principal: VerifiedFamilyAdminPrincipal,
  ) {
    const actor = this.requirePrincipal(principal);
    const scopes = [...new Set(input.scopes || [])];
    if (scopes.some((scope) => !SUPPORTED_FAMILY_SCOPES.has(scope))) {
      throw new BadRequestException('One or more family access grants are not available');
    }

    await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx: any) => {
          await this.requireVerifiedAdmin(tx, actor);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`family-membership:${input.careRoomMembershipId}`}, 0))`;
          const membership = await this.findMutableActiveMembership(
            tx,
            input.careRoomMembershipId,
            actor.organizationId,
          );
          const previous = membership.access_grants
            .filter((grant: any) => grant.revoked_at == null)
            .map((grant: any) => grant.scope);
          const now = new Date();

          await tx.accessGrant.updateMany({
            where: {
              care_room_membership_id: membership.id,
              revoked_at: null,
              ...(scopes.length > 0 ? { scope: { notIn: scopes } } : {}),
            },
            data: { revoked_at: now },
          });
          for (const scope of scopes) {
            const existing = membership.access_grants.find((grant: any) => grant.scope === scope);
            if (existing) {
              if (existing.revoked_at) {
                await tx.accessGrant.update({
                  where: { id: existing.id },
                  data: { revoked_at: null, granted_at: now },
                });
              }
            } else {
              await tx.accessGrant.create({
                data: { care_room_membership_id: membership.id, scope },
              });
            }
          }
          await tx.careRoomMembership.update({
            where: { id: membership.id },
            data: { approved_by_user_id: actor.authSubject },
          });
          await tx.auditLog.create({
            data: {
              organization_id: actor.organizationId,
              user_id: actor.authSubject,
              action: 'FAMILY_ACCESS_GRANTS_UPDATED',
              resource_type: 'CareRoomMembership',
              resource_id: membership.id,
              old_values: { scopes: previous },
              new_values: { scopes },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    return this.findMembership(input.careRoomMembershipId, actor.organizationId);
  }

  async revokeAccess(
    careRoomMembershipId: string,
    principal: VerifiedFamilyAdminPrincipal,
  ) {
    const actor = this.requirePrincipal(principal);
    await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx: any) => {
          await this.requireVerifiedAdmin(tx, actor);
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`family-membership:${careRoomMembershipId}`}, 0))`;
          const membership = await tx.careRoomMembership.findFirst({
            where: {
              id: careRoomMembershipId,
              status: 'ACTIVE',
              revoked_at: null,
              care_room: {
                organization_id: actor.organizationId,
                status: 'ACTIVE',
              },
            },
            select: { id: true },
          });
          if (!membership) throw new ConflictException(FAMILY_ACCESS_UNAVAILABLE);
          const now = new Date();
          const changed = await tx.careRoomMembership.updateMany({
            where: { id: membership.id, status: 'ACTIVE', revoked_at: null },
            data: {
              status: 'REVOKED',
              revoked_at: now,
              revoked_by_user_id: actor.authSubject,
            },
          });
          if (changed.count !== 1) throw new ConflictException(FAMILY_ACCESS_UNAVAILABLE);
          await tx.accessGrant.updateMany({
            where: { care_room_membership_id: membership.id, revoked_at: null },
            data: { revoked_at: now },
          });
          await tx.auditLog.create({
            data: {
              organization_id: actor.organizationId,
              user_id: actor.authSubject,
              action: 'FAMILY_ACCESS_REVOKED',
              resource_type: 'CareRoomMembership',
              resource_id: membership.id,
              old_values: { status: 'ACTIVE' },
              new_values: { status: 'REVOKED' },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    return this.findMembership(careRoomMembershipId, actor.organizationId);
  }

  async revokeInvitation(
    invitationId: string,
    principal: VerifiedFamilyAdminPrincipal,
  ) {
    this.requireInvitationProvider();
    const actor = this.requirePrincipal(principal);
    let membershipId = '';
    await this.prisma.$transaction(async (tx: any) => {
      await this.requireVerifiedAdmin(tx, actor);
      const invitation = await tx.organizationMembershipInvitation.findFirst({
        where: {
          id: invitationId,
          organization_id: actor.organizationId,
          identity_provider: this.identityProvider(),
          intended_role: 'family',
          source_request_id: null,
          activated_membership_id: null,
          status: { in: ['PENDING', 'REVOKED'] },
        },
        include: { care_room_memberships: true },
      });
      if (!invitation || invitation.care_room_memberships.length !== 1) {
        throw new ConflictException('Family invitation can no longer be revoked');
      }
      membershipId = invitation.care_room_memberships[0].id;
      if (invitation.status === 'PENDING') {
        const now = new Date();
        const changed = await tx.organizationMembershipInvitation.updateMany({
          where: { id: invitation.id, status: 'PENDING' },
          data: {
            status: 'REVOKED',
            revoked_at: now,
            external_cleanup_required: true,
            external_cleanup_error_code: null,
            external_cleanup_completed_at: null,
          },
        });
        if (changed.count !== 1) throw new ConflictException('Family invitation state changed; retry');
        await tx.careRoomMembership.updateMany({
          where: { id: membershipId, status: 'INVITED' },
          data: {
            status: 'REVOKED',
            revoked_at: now,
            revoked_by_user_id: actor.authSubject,
          },
        });
        await tx.auditLog.create({
          data: {
            organization_id: actor.organizationId,
            user_id: actor.authSubject,
            action: 'FAMILY_INVITATION_REVOKED',
            resource_type: 'CareRoomMembership',
            resource_id: membershipId,
            old_values: { status: 'INVITED' },
            new_values: { status: 'REVOKED', invitationId },
          },
        });
      }
    });
    await this.reconcileInvitationCleanup(invitationId, actor.organizationId);
    return this.findMembership(membershipId, actor.organizationId);
  }

  async retryDelivery(
    invitationId: string,
    principal: VerifiedFamilyAdminPrincipal,
  ) {
    this.requireInvitationProvider();
    const actor = this.requirePrincipal(principal);
    await this.requireVerifiedAdmin(this.prisma, actor);
    const now = new Date();
    const invitation = await this.prisma.organizationMembershipInvitation.findFirst({
      where: {
        id: invitationId,
        organization_id: actor.organizationId,
        identity_provider: this.identityProvider(),
        intended_role: 'family',
        source_request_id: null,
        status: 'PENDING',
        provisioning_outbox: {
          OR: [
            { status: { in: ['PENDING', 'RETRYABLE'] } },
            { status: 'PROCESSING', lease_expires_at: { lte: now } },
          ],
        },
      },
      select: { id: true },
    });
    if (!invitation) throw new ConflictException('Family invitation delivery cannot be retried');
    await this.deliver(invitation.id, actor);
    return this.findMembershipByInvitation(invitation.id, actor.organizationId);
  }

  private async findMutableActiveMembership(tx: any, id: string, organizationId: string) {
    const membership = await tx.careRoomMembership.findFirst({
      where: {
        id,
        status: 'ACTIVE',
        revoked_at: null,
        care_room: { organization_id: organizationId, status: 'ACTIVE' },
        family_contact: {
          organization_id: organizationId,
          disabled_at: null,
          auth_subject: { not: null },
        },
        organization_membership_invitation: {
          status: 'ACCEPTED',
          intended_role: 'family',
          activated_membership: { status: 'ACTIVE', revoked_at: null },
        },
      },
      include: {
        family_contact: true,
        access_grants: true,
        organization_membership_invitation: {
          include: { activated_membership: true },
        },
      },
    });
    if (
      !membership ||
      membership.family_contact.auth_subject !==
        membership.organization_membership_invitation.bound_auth_subject
    ) {
      throw new ConflictException(FAMILY_ACCESS_UNAVAILABLE);
    }
    return membership;
  }

  private async expireOverdueInvitations(
    tx: any,
    actor: ReturnType<FamilyInvitationService['requirePrincipal']>,
    email: string,
    now: Date,
  ) {
    const overdue = await tx.organizationMembershipInvitation.findMany({
      where: {
        organization_id: actor.organizationId,
        identity_provider: this.identityProvider(),
        normalized_email: email,
        intended_role: 'family',
        source_request_id: null,
        status: 'PENDING',
        expires_at: { lte: now },
      },
      select: {
        id: true,
        care_room_memberships: { select: { id: true, status: true } },
      },
    });

    for (const invitation of overdue) {
      if (invitation.care_room_memberships.length !== 1) continue;
      const familyTarget = invitation.care_room_memberships[0];
      const transitioned = await tx.organizationMembershipInvitation.updateMany({
        where: {
          id: invitation.id,
          status: 'PENDING',
          expires_at: { lte: now },
        },
        data: { status: 'EXPIRED', expired_at: now },
      });
      if (transitioned.count !== 1) continue;

      if (familyTarget.status === 'INVITED') {
        await tx.careRoomMembership.updateMany({
          where: {
            id: familyTarget.id,
            status: 'INVITED',
            accepted_at: null,
            revoked_at: null,
          },
          data: { status: 'EXPIRED' },
        });
      }
      await tx.auditLog.create({
        data: {
          organization_id: actor.organizationId,
          user_id: actor.authSubject,
          action: 'FAMILY_INVITATION_EXPIRED',
          resource_type: 'OrganizationMembershipInvitation',
          resource_id: invitation.id,
          old_values: { status: 'PENDING' },
          new_values: { status: 'EXPIRED' },
        },
      });
    }
  }

  private async deliver(invitationId: string, actor: ReturnType<FamilyInvitationService['requirePrincipal']>) {
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
      if (!binding) throw new ClerkProvisioningError('CLERK_ORGANIZATION_NOT_BOUND', false);
      const result = await this.clerk.ensureOrganizationInvitation({
        externalOrganizationId: binding.external_organization_id,
        invitationId: claimed.invitation.id,
        emailAddress: claimed.invitation.intended_email,
        intendedRole: 'family',
      });
      const deliveredAt = new Date();
      let cleanupRequired = false;
      await this.prisma.$transaction(async (tx: any) => {
        const current = await tx.organizationMembershipInvitation.findFirst({
          where: {
            id: claimed.invitation.id,
            organization_id: actor.organizationId,
            intended_role: 'family',
            source_request_id: null,
          },
        });
        if (!current) throw new ConflictException('Family invitation state changed; retry');
        if (
          current.external_invitation_id &&
          current.external_invitation_id !== result.externalInvitationId
        ) {
          throw new ConflictException('Family invitation state changed; retry');
        }
        if (current.status === 'PENDING') {
          await tx.organizationMembershipInvitation.update({
            where: { id: current.id },
            data: {
              external_invitation_id: result.externalInvitationId,
              expires_at: new Date(deliveredAt.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
            },
          });
        } else if (['REVOKED', 'EXPIRED'].includes(current.status)) {
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
          throw new ConflictException('Family invitation state changed; retry');
        }
        const delivered = await tx.organizationProvisioningOutbox.updateMany({
          where: {
            id: claimed.id,
            status: 'PROCESSING',
            lease_token: claimed.lease_token,
          },
          data: {
            status: 'DELIVERED',
            lease_token: null,
            lease_expires_at: null,
            last_error_code: null,
            delivered_at: deliveredAt,
          },
        });
        if (delivered.count !== 1) throw new ConflictException('Family invitation delivery lease changed; retry');
      });
      if (cleanupRequired) {
        await this.reconcileInvitationCleanup(claimed.invitation.id, actor.organizationId);
      }
    } catch (error) {
      await this.markDeliveryFailed(claimed.id, claimed.lease_token, error);
    }
  }

  private async claimDelivery(invitationId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const current = await tx.organizationProvisioningOutbox.findUnique({
        where: { invitation_id: invitationId },
        include: { invitation: true },
      });
      if (
        !current ||
        current.source_request_id ||
        current.invitation.intended_role !== 'family'
      ) return null;
      const now = new Date();
      const eligible =
        current.status === 'PENDING' ||
        current.status === 'RETRYABLE' ||
        (current.status === 'PROCESSING' && current.lease_expires_at && current.lease_expires_at <= now);
      if (!eligible) return null;
      const leaseToken = randomUUID();
      const where: Record<string, unknown> = { id: current.id, status: current.status };
      if (current.status === 'PROCESSING') {
        where.lease_token = current.lease_token;
        where.lease_expires_at = current.lease_expires_at;
      }
      const changed = await tx.organizationProvisioningOutbox.updateMany({
        where,
        data: {
          status: 'PROCESSING',
          lease_token: leaseToken,
          lease_expires_at: new Date(now.getTime() + DELIVERY_LEASE_MS),
          last_error_code: null,
          attempt_count: { increment: 1 },
        },
      });
      if (changed.count !== 1) return null;
      return tx.organizationProvisioningOutbox.findUniqueOrThrow({
        where: { id: current.id },
        include: { invitation: true },
      });
    });
  }

  private async markDeliveryFailed(outboxId: string, leaseToken: string, error: unknown) {
    const known = error instanceof ClerkProvisioningError ? error : null;
    await this.prisma.organizationProvisioningOutbox.updateMany({
      where: { id: outboxId, status: 'PROCESSING', lease_token: leaseToken },
      data: {
        status: known?.retryable ? 'RETRYABLE' : 'NEEDS_ATTENTION',
        available_at: new Date(Date.now() + 30_000),
        lease_token: null,
        lease_expires_at: null,
        last_error_code: known?.code || 'FAMILY_INVITATION_DELIVERY_FAILED',
      },
    });
  }

  private async reconcileInvitationCleanup(invitationId: string, organizationId: string) {
    const invitation = await this.prisma.organizationMembershipInvitation.findFirst({
      where: {
        id: invitationId,
        organization_id: organizationId,
        identity_provider: this.identityProvider(),
        intended_role: 'family',
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
      await this.markCleanupFailed(invitation.id, 'CLERK_ORGANIZATION_NOT_BOUND');
      return false;
    }
    try {
      await this.clerk.revokeOrganizationInvitationByInternalId({
        externalOrganizationId: binding.external_organization_id,
        invitationId: invitation.id,
        emailAddress: invitation.intended_email,
        intendedRole: 'family',
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
      await this.markCleanupFailed(
        invitation.id,
        error instanceof ClerkProvisioningError ? error.code : 'CLERK_CLEANUP_FAILED',
      );
      return false;
    }
  }

  private async markCleanupFailed(invitationId: string, code: string) {
    await this.prisma.organizationMembershipInvitation.updateMany({
      where: { id: invitationId, external_cleanup_required: true },
      data: { external_cleanup_error_code: code },
    });
  }

  private async findMembershipByInvitation(invitationId: string, organizationId: string) {
    const membership = await this.prisma.careRoomMembership.findFirst({
      where: {
        organization_membership_invitation_id: invitationId,
        care_room: { organization_id: organizationId },
      },
      include: this.membershipInclude(),
    });
    if (!membership) throw new ConflictException(FAMILY_ACCESS_UNAVAILABLE);
    return this.mapMembership(membership);
  }

  private async findMembership(id: string, organizationId: string) {
    const membership = await this.prisma.careRoomMembership.findFirst({
      where: { id, care_room: { organization_id: organizationId } },
      include: this.membershipInclude(),
    });
    if (!membership) throw new ConflictException(FAMILY_ACCESS_UNAVAILABLE);
    return this.mapMembership(membership);
  }

  private membershipInclude() {
    return {
      family_contact: true,
      access_grants: { where: { revoked_at: null } },
      organization_membership_invitation: {
        include: { provisioning_outbox: true },
      },
    };
  }

  private mapMembership(membership: any) {
    const invitation = membership.organization_membership_invitation;
    return {
      id: membership.id,
      invitationId: invitation?.id ?? null,
      role: membership.role,
      status: membership.status,
      accessBasis: membership.access_basis,
      reviewDueAt: membership.review_due_at ?? null,
      familyContact: {
        id: membership.family_contact.id,
        fullName: membership.family_contact.full_name,
        email: membership.family_contact.email ?? null,
        relationship: membership.family_contact.relationship ?? null,
      },
      accessGrants: (membership.access_grants || []).map((grant: any) => ({
        id: grant.id,
        scope: grant.scope,
        grantedAt: grant.granted_at,
        revokedAt: grant.revoked_at ?? null,
      })),
      invitationStatus: invitation?.status ?? null,
      deliveryStatus: invitation?.provisioning_outbox?.status ?? null,
      cleanupStatus: invitation?.external_cleanup_required
        ? invitation.external_cleanup_error_code
          ? 'MANUAL_REVIEW'
          : 'PENDING'
        : 'COMPLETE',
      invitationExpiresAt: invitation?.expires_at ?? null,
    };
  }

  private requirePrincipal(principal: VerifiedFamilyAdminPrincipal) {
    const organizationId = String(principal.organizationId || '').trim();
    const membershipId = String(principal.organizationMembershipId || '').trim();
    const authSubject = String(principal.authSubject || '').trim();
    if (!organizationId || !membershipId || !authSubject) {
      throw new ForbiddenException(ADMIN_REQUIRED);
    }
    return { organizationId, membershipId, authSubject };
  }

  private async requireVerifiedAdmin(tx: any, actor: ReturnType<FamilyInvitationService['requirePrincipal']>) {
    const membership = await tx.organizationMembership.findFirst({
      where: {
        id: actor.membershipId,
        organization_id: actor.organizationId,
        identity_provider: this.identityProvider(),
        auth_subject: actor.authSubject,
        role: 'admin',
        status: 'ACTIVE',
        revoked_at: null,
      },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException(ADMIN_REQUIRED);
  }

  private identityProvider() {
    return String(process.env.AUTH_IDENTITY_PROVIDER || 'cognito').trim().toLowerCase();
  }

  private requireInvitationProvider() {
    if (this.identityProvider() !== 'clerk') {
      throw new ConflictException('Secure family invitations are not configured in this environment');
    }
  }

  private normalizeEmail(value: string) {
    return String(value || '').trim().toLowerCase();
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if ((error as { code?: string })?.code !== 'P2034' || attempt === 2) throw error;
      }
    }
    throw new InternalServerErrorException(FAMILY_INVITATION_UNAVAILABLE);
  }
}
