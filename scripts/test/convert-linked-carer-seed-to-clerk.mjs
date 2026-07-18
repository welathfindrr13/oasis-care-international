import { PrismaClient } from "../../libs/db/src/generated/client/index.js";
import { pathToFileURL } from "node:url";
import { assertSafeTestDatabaseSeed } from "./assert-safe-test-database.mjs";

const externalOrganizationId = "org_clerk_browser_primary";
const organizationId = "org-browser-linked-carer";
const bootstrapRequestId = "f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0";
const bootstrapInvitationId = "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1";
const bootstrapMembershipId = "77777777-7777-4777-8777-777777777777";
const bootstrapSubject = "user_clerk_manager_browser";

const memberships = [
  ["44444444-4444-4444-8444-444444444444", "user_clerk_carer_browser"],
  ["77777777-7777-4777-8777-777777777777", "user_clerk_manager_browser"],
  ["88888888-8888-4888-8888-888888888888", "user_clerk_family_browser"],
  [
    "88888888-8888-4888-8888-777777777777",
    "user_clerk_unauthorized_family_browser",
  ],
  ["88888888-8888-4888-8888-666666666666", "user_clerk_revoked_family_browser"],
  ["12121212-1212-4212-8212-121212121212", "user_clerk_staff_manager_browser"],
  ["13131313-1313-4313-8313-131313131313", "user_clerk_care_manager_browser"],
  ["14141414-1414-4414-8414-141414141414", "user_clerk_office_browser"],
];

const familyBindings = [
  {
    invitationId: "acacacac-acac-4cac-8cac-acacacacacac",
    contactId: "99999999-9999-4999-8999-999999999999",
    subject: "user_clerk_family_browser",
  },
  {
    invitationId: "acacacac-acac-4cac-8cac-bcbcbcbcbcbc",
    contactId: "99999999-9999-4999-8999-888888888888",
    subject: "user_clerk_revoked_family_browser",
  },
  {
    invitationId: "acacacac-acac-4cac-8cac-cdcdcdcdcdcd",
    contactId: "99999999-9999-4999-8999-777777777777",
    subject: "user_clerk_unauthorized_family_browser",
  },
];

export async function convertLinkedCarerSeedToClerk(prisma) {
  const invitationIds = familyBindings.map(({ invitationId }) => invitationId);
  const [invitations, careRoomMembershipBindings] = await Promise.all([
    prisma.organizationMembershipInvitation.findMany({
      where: { id: { in: invitationIds } },
    }),
    prisma.careRoomMembership.findMany({
      where: { organization_membership_invitation_id: { in: invitationIds } },
      select: { id: true, organization_membership_invitation_id: true },
    }),
  ]);
  if (invitations.length !== invitationIds.length) {
    throw new Error(
      "Clerk browser seed is missing a family invitation binding",
    );
  }

  const subjectsByInvitation = new Map(
    familyBindings.map(({ invitationId, subject }) => [invitationId, subject]),
  );

  await prisma.$transaction(async (tx) => {
    await tx.careRoomMembership.updateMany({
      where: { organization_membership_invitation_id: { in: invitationIds } },
      data: { organization_membership_invitation_id: null },
    });
    await tx.organizationMembershipInvitation.deleteMany({
      where: { id: { in: invitationIds } },
    });

    for (const [id, subject] of memberships) {
      await tx.organizationMembership.update({
        where: { id },
        data: {
          identity_provider: "clerk",
          auth_subject: subject,
          external_organization_id: externalOrganizationId,
        },
      });
    }

    await tx.organizationMembershipInvitation.updateMany({
      where: { organization_id: organizationId },
      data: { identity_provider: "clerk" },
    });
    await tx.organizationMembershipInvitation.create({
      data: {
        id: bootstrapInvitationId,
        organization_id: organizationId,
        source_request_id: bootstrapRequestId,
        activated_membership_id: bootstrapMembershipId,
        identity_provider: "clerk",
        intended_email: "admin@local.dev",
        normalized_email: "admin@local.dev",
        intended_role: "admin",
        status: "ACCEPTED",
        external_invitation_id: "orginv_browser_bootstrap_manager",
        created_by_subject: "user_platform_operator_browser",
        bound_auth_subject: bootstrapSubject,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        accepted_at: new Date(),
      },
    });
    await tx.organizationMembershipInvitation.createMany({
      data: invitations.map((invitation) => ({
        ...invitation,
        identity_provider: "clerk",
        bound_auth_subject: subjectsByInvitation.get(invitation.id),
      })),
    });

    for (const { contactId, subject } of familyBindings) {
      await tx.familyContact.update({
        where: { id: contactId },
        data: { auth_subject: subject },
      });
    }
    for (const binding of careRoomMembershipBindings) {
      await tx.careRoomMembership.update({
        where: { id: binding.id },
        data: {
          organization_membership_invitation_id:
            binding.organization_membership_invitation_id,
        },
      });
    }
  });
}

async function main() {
  assertSafeTestDatabaseSeed();
  const prisma = new PrismaClient();
  try {
    await convertLinkedCarerSeedToClerk(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
