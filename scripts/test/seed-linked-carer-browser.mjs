import crypto from "node:crypto";
import {
  PrismaClient,
  VisitStatus,
} from "../../libs/db/src/generated/client/index.js";
import { assertSafeTestDatabaseSeed } from "./assert-safe-test-database.mjs";

assertSafeTestDatabaseSeed();

const ORGANIZATION_ID = "org-browser-linked-carer";
const SENTINEL_ORGANIZATION_ID = "org-browser-sentinel";
const ORGANIZATION_IDS = [ORGANIZATION_ID, SENTINEL_ORGANIZATION_ID];
const CARER_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_CARER_ID = "33333333-3333-4333-8333-444444444444";
const SENTINEL_CARER_ID = "33333333-3333-4333-8333-555555555555";
const CLIENT_ID = "client-browser-linked-carer";
const SENTINEL_CLIENT_ID = "client-browser-sentinel";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const VISIT_ID = "55555555-5555-4555-8555-555555555555";
const UNASSIGNED_VISIT_ID = "55555555-5555-4555-8555-666666666666";
const FAMILY_UPDATE_VISIT_ID = "55555555-5555-4555-8555-777777777777";
const TASK_ID = "66666666-6666-4666-8666-666666666666";
const ADMIN_MEMBERSHIP_ID = "77777777-7777-4777-8777-777777777777";
const FAMILY_MEMBERSHIP_ID = "88888888-8888-4888-8888-888888888888";
const UNAUTHORIZED_FAMILY_MEMBERSHIP_ID =
  "88888888-8888-4888-8888-777777777777";
const REVOKED_FAMILY_MEMBERSHIP_ID = "88888888-8888-4888-8888-666666666666";
const MANAGER_MEMBERSHIP_ID = "12121212-1212-4212-8212-121212121212";
const CARE_MANAGER_MEMBERSHIP_ID = "13131313-1313-4313-8313-131313131313";
const OFFICE_MEMBERSHIP_ID = "14141414-1414-4414-8414-141414141414";
const FAMILY_CONTACT_ID = "99999999-9999-4999-8999-999999999999";
const REVOKED_FAMILY_CONTACT_ID = "99999999-9999-4999-8999-888888888888";
const UNAUTHORIZED_FAMILY_CONTACT_ID = "99999999-9999-4999-8999-777777777777";
const CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CARE_ROOM_MEMBERSHIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REVOKED_CARE_ROOM_MEMBERSHIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-aaaaaaaaaaaa";
const UNAUTHORIZED_CARE_ROOM_MEMBERSHIP_ID =
  "bbbbbbbb-bbbb-4bbb-8bbb-999999999999";
const SENTINEL_CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb";
const FAMILY_UPDATE_ID = "abababab-abab-4bab-8bab-abababababab";
const FAMILY_INVITATION_ID = "acacacac-acac-4cac-8cac-acacacacacac";
const REVOKED_FAMILY_INVITATION_ID = "acacacac-acac-4cac-8cac-bcbcbcbcbcbc";
const UNAUTHORIZED_FAMILY_INVITATION_ID =
  "acacacac-acac-4cac-8cac-cdcdcdcdcdcd";
const SENTINEL_VISIT_ID = "55555555-5555-4555-8555-888888888888";
const PENDING_INVITATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EXPIRED_INVITATION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const REVOKED_INVITATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function localSubject(role, email) {
  return `local-${crypto
    .createHash("sha256")
    .update(`${role}:${email}:${ORGANIZATION_ID}`)
    .digest("hex")
    .slice(0, 16)}`;
}

// The provider claims deliberately conflict with the database roles in the
// browser journey. Authorization must follow these server-side memberships.
const carerSubject = localSubject("admin", "carer@local.dev");
const adminSubject = localSubject("user", "admin@local.dev");
const familySubject = localSubject("user", "family@local.dev");
const unauthorizedFamilySubject = localSubject(
  "user",
  "unauthorized-family@local.dev",
);
const revokedFamilySubject = localSubject("user", "revoked-family@local.dev");
const managerSubject = localSubject("admin", "manager@local.dev");
const careManagerSubject = localSubject("admin", "care-manager@local.dev");
const officeSubject = localSubject("admin", "office@local.dev");

const prisma = new PrismaClient();
const scheduledStart = new Date(Date.now() + 60 * 60 * 1000);
const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

try {
  await prisma.auditLog.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.carerShift.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.careLog.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.accessGrant.deleteMany({
    where: {
      care_room_membership: {
        care_room: { organization_id: { in: ORGANIZATION_IDS } },
      },
    },
  });
  await prisma.concernMessage.deleteMany({
    where: { concern: { organization_id: { in: ORGANIZATION_IDS } } },
  });
  await prisma.concernEvent.deleteMany({
    where: { concern: { organization_id: { in: ORGANIZATION_IDS } } },
  });
  await prisma.concern.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.verifiedVisitStory.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.careRoomMembership.deleteMany({
    where: { care_room: { organization_id: { in: ORGANIZATION_IDS } } },
  });
  await prisma.careRoom.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.familyContact.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.visitTask.deleteMany({
    where: { visit: { organization_id: { in: ORGANIZATION_IDS } } },
  });
  await prisma.visit.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.organizationProvisioningOutbox.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.organizationMembershipInvitation.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.organizationMembership.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.carer.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.client.deleteMany({
    where: { organization_id: { in: ORGANIZATION_IDS } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: ORGANIZATION_IDS } },
  });

  await prisma.organization.createMany({
    data: [
      { id: ORGANIZATION_ID, name: "Linked Carer Browser Proof" },
      { id: SENTINEL_ORGANIZATION_ID, name: "Sentinel Browser Tenant" },
    ],
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
  await prisma.carer.create({
    data: {
      id: SENTINEL_CARER_ID,
      organization_id: SENTINEL_ORGANIZATION_ID,
      first_name: "Sentinel",
      last_name: "Carer",
      email: "sentinel-carer@example.test",
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
  await prisma.client.create({
    data: {
      id: SENTINEL_CLIENT_ID,
      organization_id: SENTINEL_ORGANIZATION_ID,
      full_name: "TEST ONLY Sentinel Person",
      address_line1: "99 Sentinel Street",
      city: "London",
      postcode: "SW1A 2AA",
    },
  });
  await prisma.organizationMembership.create({
    data: {
      id: MEMBERSHIP_ID,
      organization_id: ORGANIZATION_ID,
      identity_provider: "clerk",
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
        identity_provider: "clerk",
        auth_subject: adminSubject,
        normalized_email: "admin@local.dev",
        role: "admin",
        status: "ACTIVE",
      },
      {
        id: FAMILY_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "clerk",
        auth_subject: familySubject,
        normalized_email: "family@local.dev",
        role: "family",
        status: "ACTIVE",
      },
      {
        id: UNAUTHORIZED_FAMILY_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "clerk",
        auth_subject: unauthorizedFamilySubject,
        normalized_email: "unauthorized-family@local.dev",
        role: "family",
        status: "ACTIVE",
      },
      {
        id: REVOKED_FAMILY_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "clerk",
        auth_subject: revokedFamilySubject,
        normalized_email: "revoked-family@local.dev",
        role: "family",
        status: "ACTIVE",
      },
      {
        id: MANAGER_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "clerk",
        auth_subject: managerSubject,
        normalized_email: "manager@local.dev",
        role: "manager",
        status: "ACTIVE",
      },
      {
        id: CARE_MANAGER_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "clerk",
        auth_subject: careManagerSubject,
        normalized_email: "care-manager@local.dev",
        role: "care_manager",
        status: "ACTIVE",
      },
      {
        id: OFFICE_MEMBERSHIP_ID,
        organization_id: ORGANIZATION_ID,
        identity_provider: "clerk",
        auth_subject: officeSubject,
        normalized_email: "office@local.dev",
        role: "office",
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
        identity_provider: "clerk",
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
        identity_provider: "clerk",
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
        identity_provider: "clerk",
        intended_email: "revoked-carer@example.test",
        normalized_email: "revoked-carer@example.test",
        intended_role: "carer",
        status: "REVOKED",
        expires_at: sevenDaysFromNow,
        revoked_at: now,
      },
      {
        id: FAMILY_INVITATION_ID,
        organization_id: ORGANIZATION_ID,
        activated_membership_id: FAMILY_MEMBERSHIP_ID,
        identity_provider: "clerk",
        intended_email: "family@local.dev",
        normalized_email: "family@local.dev",
        intended_role: "family",
        status: "ACCEPTED",
        external_invitation_id: "external-family-browser",
        bound_auth_subject: familySubject,
        created_at: oneDayAgo,
        expires_at: sevenDaysFromNow,
        accepted_at: now,
      },
      {
        id: REVOKED_FAMILY_INVITATION_ID,
        organization_id: ORGANIZATION_ID,
        activated_membership_id: REVOKED_FAMILY_MEMBERSHIP_ID,
        identity_provider: "clerk",
        intended_email: "revoked-family@local.dev",
        normalized_email: "revoked-family@local.dev",
        intended_role: "family",
        status: "ACCEPTED",
        external_invitation_id: "external-revoked-family-browser",
        bound_auth_subject: revokedFamilySubject,
        created_at: oneDayAgo,
        expires_at: sevenDaysFromNow,
        accepted_at: now,
      },
      {
        id: UNAUTHORIZED_FAMILY_INVITATION_ID,
        organization_id: ORGANIZATION_ID,
        activated_membership_id: UNAUTHORIZED_FAMILY_MEMBERSHIP_ID,
        identity_provider: "clerk",
        intended_email: "unauthorized-family@local.dev",
        normalized_email: "unauthorized-family@local.dev",
        intended_role: "family",
        status: "ACCEPTED",
        external_invitation_id: "external-unauthorized-family-browser",
        bound_auth_subject: unauthorizedFamilySubject,
        created_at: oneDayAgo,
        expires_at: sevenDaysFromNow,
        accepted_at: now,
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
  await prisma.familyContact.createMany({
    data: [
      {
        id: FAMILY_CONTACT_ID,
        organization_id: ORGANIZATION_ID,
        auth_subject: familySubject,
        email: "family@local.dev",
        full_name: "Browser Family",
        relationship: "Daughter",
      },
      {
        id: REVOKED_FAMILY_CONTACT_ID,
        organization_id: ORGANIZATION_ID,
        auth_subject: revokedFamilySubject,
        email: "revoked-family@local.dev",
        full_name: "Revoked Browser Family",
        relationship: "Relative",
      },
      {
        id: UNAUTHORIZED_FAMILY_CONTACT_ID,
        organization_id: ORGANIZATION_ID,
        auth_subject: unauthorizedFamilySubject,
        email: "unauthorized-family@local.dev",
        full_name: "Unauthorized Browser Family",
        relationship: "Relative",
      },
    ],
  });
  await prisma.careRoom.create({
    data: {
      id: CARE_ROOM_ID,
      organization_id: ORGANIZATION_ID,
      client_id: CLIENT_ID,
      status: "ACTIVE",
    },
  });
  await prisma.careRoom.create({
    data: {
      id: SENTINEL_CARE_ROOM_ID,
      organization_id: SENTINEL_ORGANIZATION_ID,
      client_id: SENTINEL_CLIENT_ID,
      status: "ACTIVE",
    },
  });
  await prisma.careRoomMembership.create({
    data: {
      id: CARE_ROOM_MEMBERSHIP_ID,
      care_room_id: CARE_ROOM_ID,
      family_contact_id: FAMILY_CONTACT_ID,
      organization_membership_invitation_id: FAMILY_INVITATION_ID,
      role: "FAMILY_VIEWER",
      status: "ACTIVE",
      access_basis: "CLIENT_CONSENT",
      accepted_at: new Date(),
      access_grants: {
        create: [
          { scope: "VIEW_UPDATES" },
          { scope: "VIEW_VISIT_TIMES" },
          { scope: "VIEW_TASK_SUMMARY" },
          { scope: "RAISE_CONCERNS" },
        ],
      },
    },
  });
  await prisma.careRoomMembership.create({
    data: {
      id: REVOKED_CARE_ROOM_MEMBERSHIP_ID,
      care_room_id: CARE_ROOM_ID,
      family_contact_id: REVOKED_FAMILY_CONTACT_ID,
      organization_membership_invitation_id: REVOKED_FAMILY_INVITATION_ID,
      role: "FAMILY_VIEWER",
      status: "REVOKED",
      access_basis: "CLIENT_CONSENT",
      accepted_at: now,
      revoked_at: now,
    },
  });
  await prisma.careRoomMembership.create({
    data: {
      id: UNAUTHORIZED_CARE_ROOM_MEMBERSHIP_ID,
      care_room_id: CARE_ROOM_ID,
      family_contact_id: UNAUTHORIZED_FAMILY_CONTACT_ID,
      organization_membership_invitation_id: UNAUTHORIZED_FAMILY_INVITATION_ID,
      role: "FAMILY_VIEWER",
      status: "ACTIVE",
      access_basis: "CLIENT_CONSENT",
      accepted_at: now,
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
      id: SENTINEL_VISIT_ID,
      organization_id: SENTINEL_ORGANIZATION_ID,
      carer_id: SENTINEL_CARER_ID,
      client_id: SENTINEL_CLIENT_ID,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: VisitStatus.SCHEDULED,
      notes: "TEST ONLY sentinel tenant visit",
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
  await prisma.visit.create({
    data: {
      id: FAMILY_UPDATE_VISIT_ID,
      organization_id: ORGANIZATION_ID,
      carer_id: OTHER_CARER_ID,
      client_id: CLIENT_ID,
      scheduled_start: new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000),
      scheduled_end: new Date(scheduledEnd.getTime() - 24 * 60 * 60 * 1000),
      status: VisitStatus.COMPLETED,
      notes: "Synthetic completed family update visit",
    },
  });
  await prisma.verifiedVisitStory.create({
    data: {
      id: FAMILY_UPDATE_ID,
      organization_id: ORGANIZATION_ID,
      care_room_id: CARE_ROOM_ID,
      client_id: CLIENT_ID,
      visit_id: FAMILY_UPDATE_VISIT_ID,
      status: "PUBLISHED",
      draft_title: "Internal synthetic draft",
      draft_body: "Internal synthetic browser-only draft body.",
      approved_title: "A comfortable morning visit",
      approved_body: "The morning visit went well.",
      family_safe_version: 1,
      family_safe_title: "A comfortable morning visit",
      family_safe_body:
        "The morning visit went well and the planned support was completed.",
      source_refs: [{ type: "Visit", id: FAMILY_UPDATE_VISIT_ID }],
      approved_at: new Date(),
      published_at: new Date(),
    },
  });
} finally {
  await prisma.$disconnect();
}
