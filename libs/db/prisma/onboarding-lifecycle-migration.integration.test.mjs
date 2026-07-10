import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { GenericContainer } from "testcontainers";
import generatedClient from "../src/generated/client/index.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const prismaDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(prismaDir, "schema.prisma");
const migrationsUnderTest = [
  "20260710160000_onboarding_lifecycle_foundation",
  "20260710180000_company_request_bootstrap",
  "20260710203000_verified_invitation_activation",
];
const { PrismaClient } = generatedClient;

async function deployMigrations(schema, databaseUrl) {
  await execFileAsync(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", schema],
    {
      cwd: join(prismaDir, ".."),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      maxBuffer: 10 * 1024 * 1024,
    },
  );
}

async function expectPostgresError(operation, code) {
  let caught;
  try {
    await operation();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `Expected PostgreSQL error ${code}`);
  assert.equal(caught.meta?.code, code, caught.message);
}

function prismaFor(databaseUrl) {
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

test(
  "onboarding lifecycle migration preserves legacy access and enforces bindings",
  { timeout: 120_000 },
  async (t) => {
    const fixtureRoot = await mkdtemp(
      join(tmpdir(), "oasis-onboarding-migration-"),
    );
    const legacyPrismaDir = join(fixtureRoot, "prisma");
    await cp(prismaDir, legacyPrismaDir, { recursive: true });
    for (const migrationName of migrationsUnderTest) {
      await rm(join(legacyPrismaDir, "migrations", migrationName), {
        recursive: true,
        force: true,
      });
    }

    const container = await new GenericContainer("pgvector/pgvector:pg16")
      .withEnvironment({
        POSTGRES_USER: "test",
        POSTGRES_PASSWORD: "test",
        POSTGRES_DB: "oasis_upgrade",
      })
      .withExposedPorts(5432)
      .start();

    t.after(async () => {
      await container.stop();
      await rm(fixtureRoot, { recursive: true, force: true });
    });

    const databaseUrl = `postgresql://test:test@${container.getHost()}:${container.getMappedPort(5432)}/oasis_upgrade`;
    await deployMigrations(join(legacyPrismaDir, "schema.prisma"), databaseUrl);

    let prisma = prismaFor(databaseUrl);
    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization" ("id", "name", "ai_summary_enabled", "created_at", "updated_at")
    VALUES
      ('org-a', 'Synthetic A', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('org-b', 'Synthetic B', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "status", "revoked_at", "created_at", "updated_at"
    )
    VALUES
      ('legacy-active', 'org-a', 'clerk', 'legacy-active-subject',
       'legacy-active@example.test', 'admin', 'ACTIVE', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('legacy-suspended', 'org-a', 'clerk', 'legacy-suspended-subject',
       'legacy-suspended@example.test', 'carer', 'SUSPENDED', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('legacy-revoked', 'org-a', 'clerk', 'legacy-revoked-subject',
       'legacy-revoked@example.test', 'carer', 'REVOKED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
    const legacyRowsBefore = await prisma.$queryRawUnsafe(`
    SELECT "id", "organization_id", "identity_provider", "auth_subject",
           "normalized_email", "role", "status"::text AS "status"
      FROM "organization_membership"
     ORDER BY "id"
  `);
    await prisma.$disconnect();

    await deployMigrations(schemaPath, databaseUrl);
    prisma = prismaFor(databaseUrl);
    t.after(async () => prisma.$disconnect());

    const legacyRowsAfter = await prisma.$queryRawUnsafe(`
    SELECT "id", "organization_id", "identity_provider", "auth_subject",
           "normalized_email", "role", "status"::text AS "status"
      FROM "organization_membership"
     WHERE "id" LIKE 'legacy-%'
     ORDER BY "id"
  `);
    assert.deepEqual(legacyRowsAfter, legacyRowsBefore);

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "created_at", "updated_at"
    ) VALUES (
      'legacy-style-after', 'org-a', 'clerk', 'legacy-style-after-subject',
      'legacy-style-after@example.test', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    const [legacyStyleAfter] = await prisma.$queryRawUnsafe(`
    SELECT "status"::text AS "status", "auth_subject" IS NOT NULL AS "subject_bound"
      FROM "organization_membership"
     WHERE "id" = 'legacy-style-after'
  `);
    assert.deepEqual(legacyStyleAfter, {
      status: "ACTIVE",
      subject_bound: true,
    });

    await prisma.$executeRawUnsafe(`
    INSERT INTO "company_access_request" (
      "id", "company_name", "contact_name", "business_email",
      "normalized_business_email", "status", "updated_at"
    ) VALUES (
      'request-main', 'Synthetic Care', 'Synthetic Contact',
      'Admin@example.test', 'admin@example.test', 'PENDING_APPROVAL', CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      INSERT INTO "company_access_request" (
        "id", "company_name", "contact_name", "business_email",
        "normalized_business_email", "status", "updated_at"
      ) VALUES (
        'request-main-duplicate', 'Synthetic Care', 'Synthetic Contact',
        'admin@example.test', 'admin@example.test', 'PENDING_APPROVAL', CURRENT_TIMESTAMP
      )
    `),
      "23505",
    );
    await prisma.$executeRawUnsafe(`
    UPDATE "company_access_request"
       SET "status" = 'APPROVED',
           "organization_id" = 'org-a',
           "approved_at" = CURRENT_TIMESTAMP,
           "reviewed_at" = CURRENT_TIMESTAMP,
           "reviewed_by_subject" = 'platform-operator'
     WHERE "id" = 'request-main'
  `);

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership_invitation" (
      "id", "organization_id", "source_request_id", "identity_provider",
      "intended_email", "normalized_email", "intended_role", "status",
      "expires_at", "updated_at"
    ) VALUES (
      'invite-main', 'org-a', 'request-main', 'clerk',
      'Admin@example.test', 'admin@example.test', 'admin', 'PENDING',
      CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
    )
  `);

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_provisioning_outbox" (
      "id", "organization_id", "source_request_id", "invitation_id", "updated_at"
    ) VALUES (
      'outbox-main', 'org-a', 'request-main', 'invite-main', CURRENT_TIMESTAMP
    )
  `);
    const [bootstrapState] = await prisma.$queryRawUnsafe(`
    SELECT request."status"::text AS "request_status",
           invitation."status"::text AS "invitation_status",
           outbox."status"::text AS "outbox_status",
           COUNT(membership."id")::int AS "active_memberships"
      FROM "company_access_request" request
      JOIN "organization_membership_invitation" invitation
        ON invitation."source_request_id" = request."id"
      JOIN "organization_provisioning_outbox" outbox
        ON outbox."source_request_id" = request."id"
      LEFT JOIN "organization_membership" membership
        ON membership."organization_id" = request."organization_id"
       AND membership."auth_subject" = 'admin@example.test'
     WHERE request."id" = 'request-main'
     GROUP BY request."status", invitation."status", outbox."status"
  `);
    assert.deepEqual(bootstrapState, {
      request_status: "APPROVED",
      invitation_status: "PENDING",
      outbox_status: "PENDING",
      active_memberships: 0,
    });

    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      UPDATE "organization_provisioning_outbox"
         SET "status" = 'DELIVERED',
             "delivered_at" = NULL
       WHERE "id" = 'outbox-main'
    `),
      "23514",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_provider_binding" (
      "id", "organization_id", "identity_provider", "external_organization_id",
      "external_slug", "updated_at"
    ) VALUES (
      'binding-main', 'org-a', 'clerk', 'org_external_main',
      'oasis-org-a', CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      INSERT INTO "organization_provider_binding" (
        "id", "organization_id", "identity_provider", "external_organization_id",
        "external_slug", "updated_at"
      ) VALUES (
        'binding-duplicate', 'org-a', 'clerk', 'org_external_other',
        'oasis-org-a-other', CURRENT_TIMESTAMP
      )
    `),
      "23505",
    );
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      INSERT INTO "organization_membership_invitation" (
        "id", "organization_id", "identity_provider", "intended_email",
        "normalized_email", "intended_role", "status", "expires_at", "updated_at"
      ) VALUES (
        'invite-competing-role', 'org-a', 'clerk', 'admin@example.test',
        'admin@example.test', 'carer', 'PENDING',
        CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
      )
    `),
      "23505",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "company_access_request" (
      "id", "company_name", "contact_name", "business_email",
      "normalized_business_email", "status", "organization_id",
      "approved_at", "updated_at"
    ) VALUES (
      'request-org-b', 'Synthetic B', 'Synthetic Contact',
      'cross@example.test', 'cross@example.test', 'APPROVED', 'org-b',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      INSERT INTO "organization_membership_invitation" (
        "id", "organization_id", "source_request_id", "identity_provider",
        "intended_email", "normalized_email", "intended_role", "status",
        "expires_at", "updated_at"
      ) VALUES (
        'invite-cross-tenant-source', 'org-a', 'request-org-b', 'clerk',
        'cross@example.test', 'cross@example.test', 'admin', 'PENDING',
        CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
      )
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "company_access_request" (
      "id", "company_name", "contact_name", "business_email",
      "normalized_business_email", "status", "organization_id",
      "approved_at", "updated_at"
    ) VALUES (
      'request-email-source', 'Synthetic Email', 'Synthetic Contact',
      'source@example.test', 'source@example.test', 'APPROVED', 'org-a',
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      INSERT INTO "organization_membership_invitation" (
        "id", "organization_id", "source_request_id", "identity_provider",
        "intended_email", "normalized_email", "intended_role", "status",
        "expires_at", "updated_at"
      ) VALUES (
        'invite-cross-email-source', 'org-a', 'request-email-source', 'clerk',
        'other@example.test', 'other@example.test', 'admin', 'PENDING',
        CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
      )
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "company_access_request" (
      "id", "company_name", "contact_name", "business_email",
      "normalized_business_email", "status", "updated_at"
    ) VALUES (
      'request-unapproved', 'Synthetic Pending', 'Synthetic Contact',
      'pending@example.test', 'pending@example.test', 'PENDING_APPROVAL', CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      INSERT INTO "organization_membership_invitation" (
        "id", "organization_id", "source_request_id", "identity_provider",
        "intended_email", "normalized_email", "intended_role", "status",
        "expires_at", "updated_at"
      ) VALUES (
        'invite-unapproved-source', 'org-a', 'request-unapproved', 'clerk',
        'pending@example.test', 'pending@example.test', 'admin', 'PENDING',
        CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
      )
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "status", "created_at", "updated_at"
    ) VALUES (
      'membership-main', 'org-a', 'clerk', 'subject-main',
      'admin@example.test', 'admin', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      UPDATE "organization_membership_invitation"
         SET "status" = 'ACCEPTED',
             "activated_membership_id" = 'membership-main',
             "bound_auth_subject" = 'wrong-subject',
             "accepted_at" = CURRENT_TIMESTAMP
       WHERE "id" = 'invite-main'
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership_invitation" (
      "id", "organization_id", "identity_provider", "intended_email",
      "normalized_email", "intended_role", "status", "expires_at", "updated_at"
    ) VALUES (
      'invite-tenant-mismatch', 'org-a', 'clerk', 'tenant@example.test',
      'tenant@example.test', 'admin', 'PENDING',
      CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
    )
  `);
    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "status", "created_at", "updated_at"
    ) VALUES (
      'membership-tenant-mismatch', 'org-b', 'clerk', 'subject-tenant-mismatch',
      'tenant@example.test', 'admin', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      UPDATE "organization_membership_invitation"
         SET "status" = 'ACCEPTED',
             "activated_membership_id" = 'membership-tenant-mismatch',
             "bound_auth_subject" = 'subject-tenant-mismatch',
             "accepted_at" = CURRENT_TIMESTAMP
       WHERE "id" = 'invite-tenant-mismatch'
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership_invitation" (
      "id", "organization_id", "identity_provider", "intended_email",
      "normalized_email", "intended_role", "status", "expires_at", "updated_at"
    ) VALUES (
      'invite-provider-mismatch', 'org-a', 'clerk', 'provider@example.test',
      'provider@example.test', 'admin', 'PENDING',
      CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
    )
  `);
    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "status", "created_at", "updated_at"
    ) VALUES (
      'membership-provider-mismatch', 'org-a', 'cognito', 'subject-provider-mismatch',
      'provider@example.test', 'admin', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      UPDATE "organization_membership_invitation"
         SET "status" = 'ACCEPTED',
             "activated_membership_id" = 'membership-provider-mismatch',
             "bound_auth_subject" = 'subject-provider-mismatch',
             "accepted_at" = CURRENT_TIMESTAMP
       WHERE "id" = 'invite-provider-mismatch'
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership_invitation" (
      "id", "organization_id", "identity_provider", "intended_email",
      "normalized_email", "intended_role", "status", "expires_at", "updated_at"
    ) VALUES (
      'invite-role-mismatch', 'org-a', 'clerk', 'role@example.test',
      'role@example.test', 'admin', 'PENDING',
      CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
    )
  `);
    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "status", "created_at", "updated_at"
    ) VALUES (
      'membership-role-mismatch', 'org-a', 'clerk', 'subject-role-mismatch',
      'role@example.test', 'carer', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      UPDATE "organization_membership_invitation"
         SET "status" = 'ACCEPTED',
             "activated_membership_id" = 'membership-role-mismatch',
             "bound_auth_subject" = 'subject-role-mismatch',
             "accepted_at" = CURRENT_TIMESTAMP
       WHERE "id" = 'invite-role-mismatch'
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership_invitation" (
      "id", "organization_id", "identity_provider", "intended_email",
      "normalized_email", "intended_role", "status", "expires_at", "updated_at"
    ) VALUES (
      'invite-email-mismatch', 'org-a', 'clerk', 'intended@example.test',
      'intended@example.test', 'admin', 'PENDING',
      CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
    )
  `);
    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "status", "created_at", "updated_at"
    ) VALUES (
      'membership-email-mismatch', 'org-a', 'clerk', 'subject-email-mismatch',
      'different@example.test', 'admin', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      UPDATE "organization_membership_invitation"
         SET "status" = 'ACCEPTED',
             "activated_membership_id" = 'membership-email-mismatch',
             "bound_auth_subject" = 'subject-email-mismatch',
             "accepted_at" = CURRENT_TIMESTAMP
       WHERE "id" = 'invite-email-mismatch'
    `),
      "23503",
    );

    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership_invitation" (
      "id", "organization_id", "identity_provider", "intended_email",
      "normalized_email", "intended_role", "status", "expires_at", "updated_at"
    ) VALUES (
      'invite-expired', 'org-a', 'clerk', 'expired@example.test',
      'expired@example.test', 'admin', 'PENDING',
      CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP
    )
  `);
    await prisma.$executeRawUnsafe(`
    INSERT INTO "organization_membership" (
      "id", "organization_id", "identity_provider", "auth_subject",
      "normalized_email", "role", "status", "created_at", "updated_at"
    ) VALUES (
      'membership-expired', 'org-a', 'clerk', 'subject-expired',
      'expired@example.test', 'admin', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `);
    await expectPostgresError(
      () =>
        prisma.$executeRawUnsafe(`
      UPDATE "organization_membership_invitation"
         SET "status" = 'ACCEPTED',
             "activated_membership_id" = 'membership-expired',
             "bound_auth_subject" = 'subject-expired',
             "accepted_at" = "expires_at" + INTERVAL '1 second'
       WHERE "id" = 'invite-expired'
    `),
      "23514",
    );

    await prisma.$executeRawUnsafe(`
    UPDATE "organization_membership_invitation"
       SET "status" = 'ACCEPTED',
           "activated_membership_id" = 'membership-main',
           "bound_auth_subject" = 'subject-main',
           "accepted_at" = CURRENT_TIMESTAMP
     WHERE "id" = 'invite-main'
  `);
    await prisma.$executeRawUnsafe(`
      INSERT INTO "organization_membership_invitation" (
        "id", "organization_id", "source_request_id", "identity_provider",
        "intended_email", "normalized_email", "intended_role", "status",
        "expires_at", "updated_at"
      ) VALUES (
        'invite-bootstrap-retry', 'org-a', 'request-main', 'clerk',
        'admin@example.test', 'admin@example.test', 'admin', 'PENDING',
        CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP
      )
    `);

    const sourceInvitationStates = await prisma.$queryRawUnsafe(`
      SELECT "status"::text AS "status"
        FROM "organization_membership_invitation"
       WHERE "source_request_id" = 'request-main'
       ORDER BY "status"
    `);
    assert.deepEqual(sourceInvitationStates, [
      { status: "ACCEPTED" },
      { status: "PENDING" },
    ]);

    const [accepted] = await prisma.$queryRawUnsafe(`
    SELECT invitation."status"::text AS "invitation_status",
           membership."status"::text AS "membership_status"
      FROM "organization_membership_invitation" invitation
      JOIN "organization_membership" membership
        ON membership."organization_id" = invitation."organization_id"
       AND membership."id" = invitation."activated_membership_id"
       AND membership."identity_provider" = invitation."identity_provider"
       AND membership."auth_subject" = invitation."bound_auth_subject"
       AND membership."normalized_email" = invitation."normalized_email"
       AND membership."role" = invitation."intended_role"
     WHERE invitation."id" = 'invite-main'
  `);
    assert.deepEqual(accepted, {
      invitation_status: "ACCEPTED",
      membership_status: "ACTIVE",
    });
  },
);
