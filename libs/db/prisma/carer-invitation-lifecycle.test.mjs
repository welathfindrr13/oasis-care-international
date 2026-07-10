import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "./migrations/20260710223000_carer_invitation_lifecycle/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(
  new URL("./schema.prisma", import.meta.url),
  "utf8",
);

test("generic invitation delivery makes only the company request link optional", () => {
  assert.match(
    migration,
    /ALTER TABLE IF EXISTS "organization_provisioning_outbox"/,
  );
  assert.match(migration, /ALTER COLUMN "source_request_id" DROP NOT NULL/);
  assert.match(schema, /source_request_id\s+String\?\s+@unique/);
  assert.match(schema, /source_request\s+CompanyAccessRequest\?\s+@relation/);
  assert.match(migration, /external_cleanup_required/);
  assert.match(
    migration,
    /organization_provisioning_outbox_invitation_org_fkey/,
  );
  assert.match(
    schema,
    /organization_provisioning_outbox_invitation_org_fkey/,
  );
  assert.doesNotMatch(
    migration,
    /DROP CONSTRAINT|DROP TABLE|DELETE FROM|TRUNCATE/,
  );
});

test("one active workforce identity can link each Carer", () => {
  assert.match(
    migration,
    /Multiple active organization memberships link the same Carer/,
  );
  assert.match(migration, /organization_membership_one_active_carer_key/);
  assert.match(migration, /WHERE "status" = 'ACTIVE'/);
  assert.match(migration, /"revoked_at" IS NULL/);
  assert.match(migration, /"carer_id" IS NOT NULL/);
});
