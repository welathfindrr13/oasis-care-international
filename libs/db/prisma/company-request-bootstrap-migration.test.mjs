import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "./migrations/20260710180000_company_request_bootstrap/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(
  new URL("./schema.prisma", import.meta.url),
  "utf8",
);

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `Missing model block for ${name}`);
  return match[0];
}

test("company bootstrap migration is expand-only and leaves verified memberships unchanged", () => {
  assert.match(migration, /CREATE TABLE "organization_provider_binding"/);
  assert.match(migration, /CREATE TABLE "organization_provisioning_outbox"/);
  assert.doesNotMatch(
    migration,
    /ALTER TABLE "organization_membership"\s+(?:ALTER|ADD COLUMN|DROP|RENAME)/i,
  );
  assert.doesNotMatch(
    migration,
    /(?:^|;)\s*(?:DELETE FROM|TRUNCATE|UPDATE\s+|DROP TABLE|ALTER TABLE[^;]*DROP COLUMN|ALTER TABLE[^;]*RENAME)/im,
  );

  const membership = modelBlock("OrganizationMembership");
  assert.match(
    membership,
    /status\s+OrganizationMembershipStatus\s+@default\(ACTIVE\)/,
  );
  assert.match(membership, /auth_subject\s+String\s+@db\.VarChar\(191\)/);
});

test("provider binding and outbox records are unique and tenant-bound", () => {
  assert.match(migration, /organization_provider_binding_org_provider_key/);
  assert.match(migration, /organization_provider_binding_external_key/);
  assert.match(migration, /organization_provider_binding_slug_key/);
  assert.match(
    migration,
    /organization_provisioning_outbox_source_request_id_key/,
  );
  assert.match(migration, /organization_provisioning_outbox_invitation_id_key/);
  assert.match(migration, /organization_provisioning_outbox_request_org_fkey/);
  assert.match(
    migration,
    /organization_provisioning_outbox_invitation_org_request_fkey/,
  );
});

test("outbox states require explicit leases, safe failures, or delivery timestamps", () => {
  for (const state of [
    "PENDING",
    "PROCESSING",
    "RETRYABLE",
    "DELIVERED",
    "NEEDS_ATTENTION",
  ]) {
    assert.match(schema, new RegExp(`\\b${state}\\b`));
  }
  assert.match(migration, /organization_provisioning_outbox_state_check/);
  assert.match(
    migration,
    /"status" = 'PROCESSING'[\s\S]*?"lease_token" IS NOT NULL[\s\S]*?"lease_expires_at" IS NOT NULL/,
  );
  assert.match(
    migration,
    /"status" = 'DELIVERED'[\s\S]*?"delivered_at" IS NOT NULL/,
  );
  assert.match(
    migration,
    /"status" = 'NEEDS_ATTENTION'[\s\S]*?"last_error_code" IS NOT NULL/,
  );
});
