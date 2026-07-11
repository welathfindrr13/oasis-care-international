import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL(
    './migrations/20260711003000_family_invitation_grants/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const schema = readFileSync(new URL('./schema.prisma', import.meta.url), 'utf8');

test('family invitations bind one exact pending room membership', () => {
  assert.match(migration, /organization_membership_invitation_id/);
  assert.match(migration, /care_room_membership_invitation_id_key/);
  assert.match(migration, /care_room_membership_room_contact_key/);
  assert.match(schema, /organization_membership_invitation\s+OrganizationMembershipInvitation\?/);
  assert.match(schema, /care_room_membership\s+CareRoomMembership\?/);
});

test('explicit family grants are unique and the migration creates no automatic scopes', () => {
  assert.match(migration, /access_grant_membership_scope_key/);
  assert.match(schema, /@@unique\(\[care_room_membership_id, scope\]/);
  assert.doesNotMatch(migration, /INSERT INTO "access_grant"/);
  assert.doesNotMatch(migration, /UPDATE "access_grant"/);
});

test('family invitation migration is expand-only and preflights conflicting history', () => {
  assert.match(migration, /duplicate care room memberships exist/);
  assert.match(migration, /duplicate access grants exist/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/);
});

test('legacy published stories remain hidden until versioned family-safe content exists', () => {
  assert.match(migration, /family_safe_version/);
  assert.match(migration, /verified_visit_story_family_safe_content_check/);
  assert.match(schema, /family_safe_version\s+Int\?/);
  assert.doesNotMatch(migration, /UPDATE "verified_visit_story"/);
});
