import { PrismaClient } from "../../libs/db/src/generated/client/index.js";
import { assertSafeTestDatabaseSeed } from "./assert-safe-test-database.mjs";

assertSafeTestDatabaseSeed();
const prisma = new PrismaClient();
const externalOrganizationId = "org_clerk_browser_primary";

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

try {
  await prisma.$transaction([
    ...memberships.map(([id, subject]) =>
      prisma.organizationMembership.update({
        where: { id },
        data: {
          identity_provider: "clerk",
          auth_subject: subject,
          external_organization_id: externalOrganizationId,
        },
      }),
    ),
    prisma.organizationMembershipInvitation.updateMany({
      where: { organization_id: "org-browser-linked-carer" },
      data: { identity_provider: "clerk" },
    }),
    ...familyBindings.flatMap(({ invitationId, contactId, subject }) => [
      prisma.organizationMembershipInvitation.update({
        where: { id: invitationId },
        data: { bound_auth_subject: subject },
      }),
      prisma.familyContact.update({
        where: { id: contactId },
        data: { auth_subject: subject },
      }),
    ]),
  ]);
} finally {
  await prisma.$disconnect();
}
