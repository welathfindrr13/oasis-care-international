import crypto from "node:crypto";
import {
  PrismaClient,
  VisitStatus,
} from "../../libs/db/src/generated/client/index.js";

const ORGANIZATION_ID = "org-browser-linked-carer";
const CARER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_CARER_ID = "33333333-3333-4333-8333-444444444444";
const CLIENT_ID = "client-browser-linked-carer";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const VISIT_ID = "55555555-5555-4555-8555-555555555555";
const UNASSIGNED_VISIT_ID = "55555555-5555-4555-8555-666666666666";
const TASK_ID = "66666666-6666-4666-8666-666666666666";
const ADMIN_MEMBERSHIP_ID = "77777777-7777-4777-8777-777777777777";
const FAMILY_MEMBERSHIP_ID = "88888888-8888-4888-8888-888888888888";
const FAMILY_CONTACT_ID = "99999999-9999-4999-8999-999999999999";
const CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CARE_ROOM_MEMBERSHIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PENDING_INVITATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EXPIRED_INVITATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const REVOKED_INVITATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function localSubject(role, email) {
  return `local-${crypto
    .createHash("sha256")
    .update(`${role}:${email}:auto`)
    .digest("hex")
    .slice(0, 16)}`;
}

// The provider claims deliberately conflict with the database roles in the
// browser journey. Authorization must follow these server-side memberships.
const carerSubject = localSubject("admin", "carer@local.dev");
const adminSubject = localSubject("user", "admin@local.dev");
const familySubject = localSubject("user", "family@local.dev");

const prisma = new PrismaClient();
const scheduledStart = new Date(Date.now() + 60 * 60 * 1000);
const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

try {
  await prisma.auditLog.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.carerShift.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.careLog.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.accessGrant.deleteMany({
    where: {
      care_room_membership: { care_room: { organization_id: ORGANIZATION_ID } },
    },
  });
  await prisma.careRoomMembership.deleteMany({
    where: { care_room: { organization_id: ORGANIZATION_ID } },
  });
  await prisma.careRoom.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.familyContact.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.visitTask.deleteMany({
    where: { visit: { organization_id: ORGANIZATION_ID } },
  });
  await prisma.visit.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.organizationProvisioningOutbox.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.organizationMembershipInvitation.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.organizationMembership.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.carer.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.client.deleteMany({
    where: { organization_id: ORGANIZATION_ID },
  });
  await prisma.organization.deleteMany({ where: { id: ORGANIZATION_ID } });

  await prisma.organization.create({
    data: { id: ORGANIZATION_ID, name: "Linked Carer Browser Proof" },
  });
  await prisma.carer.create({
    data: {
      id: CARER_ID,
      organization_id: ORGANIZATION_ID,
      first_name: "Browser",
      last_name: "Carer",
      email: "linked-browser-carer@example.test",
      phone: "07000000000",
      is_active: true,
    },
  });
  await prisma.carer.create({
    data: {
      id: OTHER_CARER_ID,
      organization_id: ORGANIZATION_ID,
      first_name: "Other",
      last_name: "Carer",
      email: "other-browser-carer@example.test",
      phone: "07000000001",
      is_active: true,
    },
  });
  await prisma.client.create({
    data: {
      id: CLIENT_ID,
      organization_id: ORGANIZATION_ID,
      full_name: "Assigned Fake Client",
      address_line1: "10 Canary Street",
      city: "London",
      postcode: "SW1A 1AA",
    },
  });
  await prisma.organizationMembership.create({
    data: {
      id: MEMBERSHIP_ID,
      organization_id: ORGANIZATION_ID,
      identity_provider: "cognito",
      auth_subject: carerSubject,
      normalized_email: "carer@local.dev",
      role: "carer",
      status: "ACTIVE",
      carer_id: CARER_ID,
    },
  });
  await prisma.organizationMembership.createMany({
    data: [
      {
        id: ADMIN_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "cognito",
        auth_subject: adminSubject,
        normalized_email: "admin@local.dev",
        role: "admin",
        status: "ACTIVE",
      },
      {
        id: FAMILY_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "cognito",
        auth_subject: familySubject,
        normalized_email: "family@local.dev",
        role: "family",
        status: "ACTIVE",
      },
    ],
  });
  const now = new Date();
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await prisma.organizationMembershipInvitation.createMany({
    data: [
      {
        id: PENDING_INVITATION_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "cognito",
        intended_email: "pending-carer@example.test",
        normalized_email: "pending-carer@example.test",
        intended_role: "carer",
        status: "PENDING",
        external_invitation_id: "external-pending-browser",
        expires_at: sevenDaysFromNow,
      },
      {
        id: EXPIRED_INVITATION_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "cognito",
        intended_email: "expired-carer@example.test",
        normalized_email: "expired-carer@example.test",
        intended_role: "carer",
        status: "EXPIRED",
        external_invitation_id: "external-expired-browser",
        created_at: eightDaysAgo,
        expires_at: oneDayAgo,
        expired_at: now,
      },
      {
        id: REVOKED_INVITATION_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "cognito",
        intended_email: "revoked-carer@example.test",
        normalized_email: "revoked-carer@example.test",
        intended_role: "carer",
        status: "REVOKED",
        expires_at: sevenDaysFromNow,
        revoked_at: now,
      },
    ],
  });
  await prisma.organizationProvisioningOutbox.createMany({
    data: [
      {
        organization_id: ORGANIZATION_ID,
        invitation_id: PENDING_INVITATION_ID,
        status: "DELIVERED",
        delivered_at: now,
      },
      {
        organization_id: ORGANIZATION_ID,
        invitation_id: EXPIRED_INVITATION_ID,
        status: "DELIVERED",
        delivered_at: oneDayAgo,
      },
      {
        organization_id: ORGANIZATION_ID,
        invitation_id: REVOKED_INVITATION_ID,
        status: "DELIVERED",
        delivered_at: now,
      },
    ],
  });
  await prisma.familyContact.create({
    data: {
      id: FAMILY_CONTACT_ID,
      organization_id: ORGANIZATION_ID,
      auth_subject: familySubject,
      email: "family@local.dev",
      full_name: "Browser Family",
      relationship: "Daughter",
    },
  });
  await prisma.careRoom.create({
    data: {
      id: CARE_ROOM_ID,
      organization_id: ORGANIZATION_ID,
      client_id: CLIENT_ID,
      status: "ACTIVE",
    },
  });
  await prisma.careRoomMembership.create({
    data: {
      id: CARE_ROOM_MEMBERSHIP_ID,
      care_room_id: CARE_ROOM_ID,
      family_contact_id: FAMILY_CONTACT_ID,
      role: "FAMILY_VIEWER",
      status: "ACTIVE",
      access_basis: "CLIENT_CONSENT",
      accepted_at: new Date(),
      access_grants: {
        create: [{ scope: "VIEW_UPDATES" }, { scope: "VIEW_VISIT_TIMES" }],
      },
    },
  });
  await prisma.visit.create({
    data: {
      id: VISIT_ID,
      organization_id: ORGANIZATION_ID,
      carer_id: CARER_ID,
      client_id: CLIENT_ID,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: VisitStatus.SCHEDULED,
      notes: "Synthetic linked-carer browser proof",
      tasks: {
        create: {
          id: TASK_ID,
          task_name: "Confirm assigned visit",
          description: "Fake-data browser proof task",
        },
      },
    },
  });
  await prisma.visit.create({
    data: {
      id: UNASSIGNED_VISIT_ID,
      organization_id: ORGANIZATION_ID,
      carer_id: OTHER_CARER_ID,
      client_id: CLIENT_ID,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: VisitStatus.SCHEDULED,
      notes: "Synthetic unassigned visit exclusion proof",
    },
  });
} finally {
  await prisma.$disconnect();
}
