import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assertSafeTestDatabaseSeed } from "./assert-safe-test-database.mjs";
import { convertLinkedCarerSeedToClerk } from "./convert-linked-carer-seed-to-clerk.mjs";

const safeEnv = {
  DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/oasis_test",
  NODE_ENV: "test",
  OASIS_TEST_DATABASE_SEED_ACK: "reset-test-data",
};

test("accepts an explicitly acknowledged loopback test database", () => {
  assert.deepEqual(assertSafeTestDatabaseSeed(safeEnv), {
    databaseName: "oasis_test",
    hostname: "127.0.0.1",
  });
});

test("accepts only the exact GitHub Actions Postgres service host", () => {
  assert.deepEqual(
    assertSafeTestDatabaseSeed({
      ...safeEnv,
      DATABASE_URL: "postgresql://test:test@postgres:5432/oasis_test",
      GITHUB_ACTIONS: "true",
    }),
    { databaseName: "oasis_test", hostname: "postgres" },
  );
  assert.throws(
    () =>
      assertSafeTestDatabaseSeed({
        ...safeEnv,
        DATABASE_URL: "postgresql://test:test@postgres.example:5432/oasis_test",
        GITHUB_ACTIONS: "true",
      }),
    /database host must be loopback or the exact GitHub Actions Postgres service host/,
  );
});

test("rejects a missing or incorrect destructive-seed acknowledgement", () => {
  assert.throws(
    () =>
      assertSafeTestDatabaseSeed({
        ...safeEnv,
        OASIS_TEST_DATABASE_SEED_ACK: "",
      }),
    /set OASIS_TEST_DATABASE_SEED_ACK=reset-test-data/,
  );
});

for (const nodeEnv of ["production", "staging"]) {
  test(`rejects NODE_ENV=${nodeEnv}`, () => {
    assert.throws(
      () => assertSafeTestDatabaseSeed({ ...safeEnv, NODE_ENV: nodeEnv }),
      new RegExp(`NODE_ENV=${nodeEnv}`),
    );
  });
}

test("rejects remote, non-test, and non-PostgreSQL database URLs", () => {
  for (const databaseUrl of [
    "postgresql://test:test@db.example.test:5432/oasis_test",
    "postgresql://test:test@127.0.0.1:5432/oasis",
    "postgresql://test:test@127.0.0.1:5432/oasis_staging",
    "mysql://test:test@127.0.0.1:3306/oasis_test",
  ]) {
    assert.throws(() =>
      assertSafeTestDatabaseSeed({ ...safeEnv, DATABASE_URL: databaseUrl }),
    );
  }
});

test("does not allow the GitHub service hostname outside GitHub Actions", () => {
  assert.throws(
    () =>
      assertSafeTestDatabaseSeed({
        ...safeEnv,
        DATABASE_URL: "postgresql://test:test@postgres:5432/oasis_test",
      }),
    /database host must be loopback or the exact GitHub Actions Postgres service host/,
  );
});

test("every mutating browser seed invokes the shared guard before Prisma construction", () => {
  for (const relativePath of [
    "./seed-linked-carer-browser.mjs",
    "./convert-linked-carer-seed-to-clerk.mjs",
  ]) {
    const source = fs.readFileSync(
      new URL(relativePath, import.meta.url),
      "utf8",
    );
    const guardIndex = source.indexOf("assertSafeTestDatabaseSeed();");
    const prismaIndex = source.indexOf("new PrismaClient()");
    assert.notEqual(guardIndex, -1, `${relativePath} must invoke the guard`);
    assert.notEqual(prismaIndex, -1, `${relativePath} must construct Prisma`);
    assert.ok(
      guardIndex < prismaIndex,
      `${relativePath} must guard before Prisma construction`,
    );
  }
});

test("Clerk conversion detaches and recreates invitation references around identity updates", async () => {
  const calls = [];
  const invitations = [
    "acacacac-acac-4cac-8cac-acacacacacac",
    "acacacac-acac-4cac-8cac-bcbcbcbcbcbc",
    "acacacac-acac-4cac-8cac-cdcdcdcdcdcd",
  ].map((id) => ({ id, identity_provider: "clerk" }));
  const tx = {
    careRoomMembership: {
      updateMany: async () => calls.push("detach"),
      update: async () => calls.push("rebind"),
    },
    organizationMembershipInvitation: {
      deleteMany: async () => calls.push("delete invitations"),
      updateMany: async () => calls.push("update remaining invitations"),
      createMany: async (input) => {
        calls.push("recreate invitations");
        assert.deepEqual(
          input.data.map(({ identity_provider, bound_auth_subject }) => ({
            identity_provider,
            bound_auth_subject,
          })),
          [
            {
              identity_provider: "clerk",
              bound_auth_subject: "user_clerk_family_browser",
            },
            {
              identity_provider: "clerk",
              bound_auth_subject: "user_clerk_revoked_family_browser",
            },
            {
              identity_provider: "clerk",
              bound_auth_subject: "user_clerk_unauthorized_family_browser",
            },
          ],
        );
      },
    },
    organizationMembership: {
      update: async () => calls.push("update membership identity"),
    },
    familyContact: {
      update: async () => calls.push("update family contact"),
    },
  };
  const prisma = {
    organizationMembershipInvitation: {
      findMany: async () => invitations,
    },
    careRoomMembership: {
      findMany: async () => [
        {
          id: "care-room-membership",
          organization_membership_invitation_id: invitations[0].id,
        },
      ],
    },
    $transaction: async (callback) => callback(tx),
  };

  await convertLinkedCarerSeedToClerk(prisma);

  assert.ok(calls.indexOf("detach") < calls.indexOf("delete invitations"));
  assert.ok(
    calls.indexOf("delete invitations") <
      calls.indexOf("update membership identity"),
  );
  assert.ok(
    calls.lastIndexOf("update membership identity") <
      calls.indexOf("recreate invitations"),
  );
  assert.ok(calls.indexOf("recreate invitations") < calls.indexOf("rebind"));
});
