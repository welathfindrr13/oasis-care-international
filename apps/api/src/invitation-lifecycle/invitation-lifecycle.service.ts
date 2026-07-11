import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, PrismaService } from "@oasis/db";
import { ClerkProvisioningError } from "../company-access/clerk-provisioning.adapter";
import {
  AcceptedClerkOrganizationInvitation,
  ClerkInvitationVerificationAdapter,
} from "./clerk-invitation-verification.adapter";
import { InvitationActivationResultDTO } from "./invitation-lifecycle.dto";

const ACTIVATION_UNAVAILABLE = "Invitation activation is unavailable";

type ActivationPrincipal = {
  sub?: string | null;
  id?: string | null;
  authProvider?: string | null;
};

type VerifiedInvitation = {
  invitationId: string;
  organizationId: string;
  intendedRole: string;
  normalizedEmail: string;
  external: AcceptedClerkOrganizationInvitation;
};

type ActivationProof = {
  invitationId: string;
  organizationId: string;
  subject: string;
  intendedRole: string;
  normalizedEmail: string;
  externalInvitationId: string;
  externalOrganizationId: string;
  externalMembershipId: string;
};

@Injectable()
export class InvitationLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerk: ClerkInvitationVerificationAdapter,
  ) {}

  async activateViewerInvitation(
    principal: ActivationPrincipal | null | undefined,
    invitationId: string,
  ): Promise<InvitationActivationResultDTO> {
    const subject = String(principal?.sub || principal?.id || "").trim();
    if (principal?.authProvider !== "clerk" || !subject || !invitationId) {
      this.deny();
    }

    await this.expireInvitationIfOverdue(invitationId);

    let proof: ActivationProof | null = null;
    try {
      const accepted = await this.clerk.listAcceptedInvitationsForUser(subject);
      const invitation = await this.resolveCandidate(
        accepted,
        invitationId,
        subject,
      );
      const externalMembership = await this.clerk.getOrganizationMembership(
        subject,
        invitation.external.organizationId,
      );
      if (
        externalMembership.userId !== subject ||
        externalMembership.organizationId !==
          invitation.external.organizationId ||
        externalMembership.role !== this.clerkRole(invitation.intendedRole)
      ) {
        this.deny();
      }

      proof = {
        invitationId: invitation.invitationId,
        organizationId: invitation.organizationId,
        subject,
        intendedRole: invitation.intendedRole,
        normalizedEmail: invitation.normalizedEmail,
        externalInvitationId: invitation.external.id,
        externalOrganizationId: invitation.external.organizationId,
        externalMembershipId: externalMembership.id,
      };

      try {
        return await this.activateTransaction(proof);
      } catch (error) {
        if (["P2002", "P2034"].includes(String((error as any)?.code || ""))) {
          const raced = await this.findAcceptedActivation(proof);
          if (raced) return raced;
        }
        throw error;
      }
    } catch (error) {
      const raced = proof
        ? await this.findAcceptedActivation(proof).catch(() => null)
        : null;
      if (raced) return raced;
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof ClerkProvisioningError && error.retryable) {
        throw new ServiceUnavailableException(
          "Invitation verification is temporarily unavailable",
        );
      }
      this.deny();
    }
  }

  private async resolveCandidate(
    accepted: AcceptedClerkOrganizationInvitation[],
    invitationId: string,
    subject: string,
  ): Promise<VerifiedInvitation> {
    if (accepted.length === 0 || accepted.length > 500) this.deny();
    const invitation =
      await this.prisma.organizationMembershipInvitation.findUnique({
        where: { id: invitationId },
        include: {
          source_request: { select: { status: true } },
          provisioning_outbox: { select: { status: true } },
          activated_membership: {
            select: {
              status: true,
              revoked_at: true,
              auth_subject: true,
            },
          },
        },
      });
    if (!invitation || invitation.identity_provider !== "clerk") this.deny();
    if (
      invitation.status !== "PENDING" &&
      !(
        invitation.status === "ACCEPTED" &&
        invitation.bound_auth_subject === subject &&
        invitation.activated_membership?.status === "ACTIVE" &&
        !invitation.activated_membership.revoked_at &&
        invitation.activated_membership.auth_subject === subject
      )
    ) {
      this.deny();
    }
    if (
      invitation.status === "PENDING" &&
      invitation.expires_at <= new Date()
    ) {
      this.deny();
    }
    const external = accepted.find(
      (item) => item.id === invitation.external_invitation_id,
    );
    const companyReady = invitation.source_request_id
      ? invitation.source_request?.status === "APPROVED" &&
        invitation.provisioning_outbox?.status === "DELIVERED"
      : true;
    const exact =
      companyReady &&
      external &&
      external.emailAddress === invitation.normalized_email &&
      external.role === this.clerkRole(invitation.intended_role) &&
      external.publicMetadata?.oasis_invitation_id === invitation.id &&
      external.privateMetadata?.oasis_invitation_id === invitation.id;
    if (!exact) this.deny();

    const binding = await this.prisma.organizationProviderBinding.findFirst({
      where: {
        organization_id: invitation.organization_id,
        identity_provider: "clerk",
        external_organization_id: external.organizationId,
      },
      select: { id: true },
    });
    if (!binding) this.deny();
    return {
      invitationId: invitation.id,
      organizationId: invitation.organization_id,
      intendedRole: invitation.intended_role,
      normalizedEmail: invitation.normalized_email,
      external,
    };
  }

  private async activateTransaction(
    input: ActivationProof,
  ): Promise<InvitationActivationResultDTO> {
    return this.withSerializableRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const invitation =
            await tx.organizationMembershipInvitation.findUnique({
              where: { id: input.invitationId },
              include: {
                source_request: { select: { status: true } },
                provisioning_outbox: { select: { status: true } },
                care_room_memberships: {
                  include: {
                    care_room: true,
                    family_contact: true,
                    access_grants: {
                      where: { revoked_at: null },
                      select: { id: true },
                    },
                  },
                },
              },
            });
          if (!invitation) this.deny();

          const companyReady = invitation.source_request_id
            ? invitation.source_request?.status === "APPROVED" &&
              invitation.provisioning_outbox?.status === "DELIVERED"
            : true;
          const exactInvitation =
            companyReady &&
            invitation.organization_id === input.organizationId &&
            invitation.identity_provider === "clerk" &&
            invitation.external_invitation_id === input.externalInvitationId &&
            invitation.normalized_email === input.normalizedEmail &&
            invitation.intended_role === input.intendedRole;
          if (!exactInvitation) this.deny();

          const binding = await tx.organizationProviderBinding.findFirst({
            where: {
              organization_id: input.organizationId,
              identity_provider: "clerk",
              external_organization_id: input.externalOrganizationId,
            },
            select: { id: true },
          });
          if (!binding) this.deny();

          if (invitation.status === "ACCEPTED") {
            return this.acceptedResult(tx, input);
          }

          const familyTarget = invitation.care_room_memberships.length === 1
            ? invitation.care_room_memberships[0]
            : null;
          if (input.intendedRole === 'family') {
            const validFamilyTarget =
              familyTarget &&
              familyTarget.organization_membership_invitation_id === invitation.id &&
              familyTarget.status === 'INVITED' &&
              familyTarget.accepted_at === null &&
              familyTarget.revoked_at === null &&
              familyTarget.care_room.organization_id === invitation.organization_id &&
              familyTarget.care_room.status === 'ACTIVE' &&
              familyTarget.family_contact.organization_id === invitation.organization_id &&
              familyTarget.family_contact.auth_subject === null &&
              familyTarget.family_contact.disabled_at === null &&
              familyTarget.access_grants.length === 0;
            if (!validFamilyTarget) this.deny();
          } else if (invitation.care_room_memberships.length > 0) {
            this.deny();
          }

          if (
            invitation.status !== "PENDING" ||
            invitation.expires_at <= new Date()
          ) {
            this.deny();
          }

          const existingMemberships = await tx.organizationMembership.findMany({
            where: {
              identity_provider: "clerk",
              auth_subject: input.subject,
            },
            select: { id: true },
            take: 2,
          });
          if (existingMemberships.length !== 0) this.deny();

          const membership = await tx.organizationMembership.create({
            data: {
              organization_id: invitation.organization_id,
              identity_provider: "clerk",
              auth_subject: input.subject,
              normalized_email: invitation.normalized_email,
              role: invitation.intended_role,
              status: "ACTIVE",
              external_organization_id: input.externalOrganizationId,
              external_membership_id: input.externalMembershipId,
            },
          });
          const acceptedAt = new Date();
          if (input.intendedRole === 'family') {
            const contactBound = await tx.familyContact.updateMany({
              where: {
                id: familyTarget!.family_contact_id,
                organization_id: invitation.organization_id,
                auth_subject: null,
                disabled_at: null,
              },
              data: { auth_subject: input.subject },
            });
            const roomActivated = await tx.careRoomMembership.updateMany({
              where: {
                id: familyTarget!.id,
                organization_membership_invitation_id: invitation.id,
                status: 'INVITED',
                accepted_at: null,
                revoked_at: null,
              },
              data: {
                status: 'ACTIVE',
                accepted_at: acceptedAt,
              },
            });
            if (contactBound.count !== 1 || roomActivated.count !== 1) {
              throw new Prisma.PrismaClientKnownRequestError(
                'Concurrent family invitation activation',
                {
                  code: 'P2034',
                  clientVersion: Prisma.prismaVersion.client,
                },
              );
            }
          }
          const transitioned =
            await tx.organizationMembershipInvitation.updateMany({
              where: { id: invitation.id, status: "PENDING" },
              data: {
                status: "ACCEPTED",
                bound_auth_subject: input.subject,
                activated_membership_id: membership.id,
                accepted_at: acceptedAt,
              },
            });
          if (transitioned.count !== 1) {
            throw new Prisma.PrismaClientKnownRequestError(
              "Concurrent invitation activation",
              {
                code: "P2034",
                clientVersion: Prisma.prismaVersion.client,
              },
            );
          }
          await tx.auditLog.create({
            data: {
              user_id: input.subject,
              organization_id: invitation.organization_id,
              action: "ORG_MEMBERSHIP_INVITATION_ACCEPTED",
              resource_type: "OrganizationMembershipInvitation",
              resource_id: invitation.id,
              old_values: { status: "PENDING" },
              new_values: { status: "ACCEPTED", membershipId: membership.id },
            },
          });
          return {
            status: "ACTIVE" as const,
            externalOrganizationId: input.externalOrganizationId,
            nextPath: this.activationNextPath(input.intendedRole),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async acceptedResult(
    tx: Prisma.TransactionClient,
    input: ActivationProof,
  ): Promise<InvitationActivationResultDTO> {
    const accepted = await tx.organizationMembershipInvitation.findFirst({
      where: {
        id: input.invitationId,
        organization_id: input.organizationId,
        identity_provider: "clerk",
        external_invitation_id: input.externalInvitationId,
        normalized_email: input.normalizedEmail,
        intended_role: input.intendedRole,
        status: "ACCEPTED",
        bound_auth_subject: input.subject,
        activated_membership: {
          auth_subject: input.subject,
          status: "ACTIVE",
          revoked_at: null,
          external_organization_id: input.externalOrganizationId,
          external_membership_id: input.externalMembershipId,
        },
      },
      include: {
        activated_membership: true,
        care_room_memberships: {
          include: { family_contact: true, care_room: true },
        },
      },
    });
    if (!accepted) this.deny();
    if (input.intendedRole === 'family') {
      const familyMembership = accepted.care_room_memberships.find(
        (membership) =>
          membership.status === 'ACTIVE' &&
          membership.revoked_at === null &&
          membership.family_contact.auth_subject === input.subject &&
          membership.family_contact.disabled_at === null &&
          membership.care_room.organization_id === input.organizationId &&
          membership.care_room.status === 'ACTIVE',
      );
      if (
        !familyMembership
      ) {
        this.deny();
      }
    } else if (accepted.care_room_memberships.length > 0) {
      this.deny();
    }
    return {
      status: "ACTIVE",
      externalOrganizationId: input.externalOrganizationId,
      nextPath: this.activationNextPath(input.intendedRole),
    };
  }

  private async findAcceptedActivation(
    input: ActivationProof,
  ): Promise<InvitationActivationResultDTO | null> {
    try {
      return await this.prisma.$transaction((tx) =>
        this.acceptedResult(tx, input),
      );
    } catch (error) {
      if (error instanceof ForbiddenException) return null;
      throw error;
    }
  }

  private async expireInvitationIfOverdue(invitationId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationMembershipInvitation.findFirst({
        where: {
          id: invitationId,
          identity_provider: "clerk",
          status: "PENDING",
          expires_at: { lte: now },
        },
        select: {
          id: true,
          organization_id: true,
          intended_role: true,
          source_request_id: true,
          provisioning_outbox: { select: { status: true } },
          care_room_memberships: { select: { id: true, status: true } },
        },
      });
      if (!invitation) return;
      if (
        invitation.source_request_id &&
        invitation.provisioning_outbox?.status !== "DELIVERED"
      ) {
        return;
      }
      const familyTarget = invitation.intended_role === 'family'
        ? invitation.care_room_memberships.length === 1
          ? invitation.care_room_memberships[0]
          : null
        : null;
      if (
        (invitation.intended_role === 'family' && !familyTarget) ||
        (invitation.intended_role !== 'family' && invitation.care_room_memberships.length > 0)
      ) {
        return;
      }
      const transitioned = await tx.organizationMembershipInvitation.updateMany(
        {
          where: { id: invitation.id, status: "PENDING" },
          data: { status: "EXPIRED", expired_at: now },
        },
      );
      if (transitioned.count !== 1) return;
      if (
        familyTarget?.status === 'INVITED'
      ) {
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
          user_id: "system:invitation-lifecycle",
          organization_id: invitation.organization_id,
          action: "ORG_MEMBERSHIP_INVITATION_EXPIRED",
          resource_type: "OrganizationMembershipInvitation",
          resource_id: invitation.id,
          old_values: { status: "PENDING" },
          new_values: { status: "EXPIRED" },
        },
      });
    });
  }

  private clerkRole(intendedRole: string): string {
    if (intendedRole === "admin") return "org:admin";
    if (["carer", "family", "user"].includes(intendedRole)) {
      return "org:member";
    }
    this.deny();
  }

  private activationNextPath(intendedRole: string): string {
    if (intendedRole === 'admin') return '/admin/setup';
    if (intendedRole === 'family') return '/family';
    return '/access/setup';
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
    throw new ServiceUnavailableException(ACTIVATION_UNAVAILABLE);
  }

  private deny(): never {
    throw new ForbiddenException(ACTIVATION_UNAVAILABLE);
  }
}
