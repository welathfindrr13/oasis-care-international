import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "./migrations/20260710203000_verified_invitation_activation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("verified activation enforces one active organization per subject", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "organization_membership_one_active_subject_key"[\s\S]*"identity_provider", "auth_subject"[\s\S]*WHERE "status" = 'ACTIVE' AND "revoked_at" IS NULL/,
  );
  assert.match(migration, /Multiple active organization memberships exist/);
  assert.doesNotMatch(
    migration,
    /DELETE FROM|UPDATE "organization_membership"/,
  );
});

test("external Clerk memberships can bind to only one internal membership", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "organization_membership_provider_external_membership_key"[\s\S]*"identity_provider", "external_membership_id"/,
  );
  assert.match(
    migration,
    /Duplicate external organization membership bindings exist/,
  );
});

test("expired invitation history no longer blocks a source-bound replacement", () => {
  assert.match(
    migration,
    /DROP INDEX "organization_membership_invitation_source_request_id_key"/,
  );
  assert.match(
    migration,
    /DROP INDEX "organization_membership_invitation_source_identity_key"/,
  );
  assert.match(
    migration,
    /CREATE INDEX "organization_membership_invitation_source_identity_idx"/,
  );
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN/);
});
