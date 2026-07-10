import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "./migrations/20260710160000_onboarding_lifecycle_foundation/migration.sql",
  import.meta.url,
).pathname;
const schemaPath = new URL("./schema.prisma", import.meta.url).pathname;

const migration = readFileSync(migrationPath, "utf8");
const schema = readFileSync(schemaPath, "utf8");

function modelBlock(name) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `Missing model block for ${name}`);
  return match[0];
}

test("onboarding migration is expand-only for existing authorization records", () => {
  assert.match(migration, /CREATE TABLE "company_access_request"/);
  assert.match(migration, /CREATE TABLE "organization_membership_invitation"/);
  assert.doesNotMatch(migration, /ALTER TYPE "OrganizationMembershipStatus"/);
  assert.doesNotMatch(
    migration,
    /ALTER TABLE "organization_membership"\s+(?:ALTER|ADD COLUMN|DROP|RENAME)/i,
  );
  assert.doesNotMatch(
    migration,
    /(?:^|;)\s*(?:DELETE FROM|TRUNCATE|UPDATE\s+|DROP TABLE|ALTER TABLE[^;]*DROP COLUMN|ALTER TABLE[^;]*RENAME)/im,
  );
});

test("verified organization membership contract remains unchanged", () => {
  const membership = modelBlock("OrganizationMembership");
  const status = schema.match(
    /enum OrganizationMembershipStatus \{[\s\S]*?\n\}/,
  )?.[0];

  assert.match(membership, /auth_subject\s+String\s+@db\.VarChar\(191\)/);
  assert.match(
    membership,
    /status\s+OrganizationMembershipStatus\s+@default\(ACTIVE\)/,
  );
  assert.deepEqual(status?.match(/\b(?:ACTIVE|SUSPENDED|REVOKED)\b/g), [
    "ACTIVE",
    "SUSPENDED",
    "REVOKED",
  ]);
});

test("company requests have an explicit approval lifecycle and duplicate gate", () => {
  const request = modelBlock("CompanyAccessRequest");

  for (const state of [
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "DISABLED",
  ]) {
    assert.match(schema, new RegExp(`\\b${state}\\b`));
  }
  assert.match(request, /requested_at\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(migration, /company_access_request_state_check/);
  assert.match(migration, /company_access_request_one_pending_email_key/);
  assert.match(migration, /normalized_business_email" = lower\(btrim/);
});

test("pending invitations cannot activate without verified binding", () => {
  const invitation = modelBlock("OrganizationMembershipInvitation");

  for (const state of ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"]) {
    assert.match(schema, new RegExp(`\\b${state}\\b`));
  }
  assert.match(invitation, /bound_auth_subject\s+String\?/);
  assert.match(invitation, /activated_membership_id\s+String\?/);
  assert.match(migration, /organization_membership_invitation_state_check/);
  assert.match(migration, /organization_membership_invitation_one_pending_key/);
  assert.match(
    migration,
    /ADD CONSTRAINT "organization_membership_invitation_activated_membership_fkey"[\s\S]*?FOREIGN KEY \([\s\S]*?"organization_id",[\s\S]*?"activated_membership_id",[\s\S]*?"identity_provider",[\s\S]*?"bound_auth_subject"[\s\S]*?\)[\s\S]*?REFERENCES "organization_membership"\([\s\S]*?"organization_id",[\s\S]*?"id",[\s\S]*?"identity_provider",[\s\S]*?"auth_subject"[\s\S]*?\)/,
  );
});
