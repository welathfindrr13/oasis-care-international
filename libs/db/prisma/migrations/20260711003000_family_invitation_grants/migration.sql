BEGIN;

-- Older invite flows could create more than one membership for the same family
-- contact and room. Preserve an audit snapshot, merge dependent records onto the
-- oldest membership, and quarantine the ambiguous access before adding unique
-- constraints. No access is inferred from historical duplicates.
CREATE TEMP TABLE "_family_membership_duplicate_map" ON COMMIT DROP AS
WITH "ranked_memberships" AS (
  SELECT
    "id" AS "old_membership_id",
    "care_room_id",
    "family_contact_id",
    FIRST_VALUE("id") OVER (
      PARTITION BY "care_room_id", "family_contact_id"
      ORDER BY "created_at", "id"
    ) AS "canonical_membership_id",
    COUNT(*) OVER (
      PARTITION BY "care_room_id", "family_contact_id"
    ) AS "membership_count"
  FROM "care_room_membership"
)
SELECT
  "old_membership_id",
  "care_room_id",
  "family_contact_id",
  "canonical_membership_id"
FROM "ranked_memberships"
WHERE "membership_count" > 1;

INSERT INTO "audit_log" (
  "id",
  "organization_id",
  "action",
  "resource_type",
  "resource_id",
  "old_values",
  "new_values"
)
SELECT
  'migration-family-membership-' || md5(
    "duplicate_group"."care_room_id" || ':' || "duplicate_group"."family_contact_id"
  ),
  "care_room"."organization_id",
  'FAMILY_MEMBERSHIP_DUPLICATE_QUARANTINED',
  'care_room_membership',
  "duplicate_group"."canonical_membership_id",
  jsonb_build_object(
    'memberships', (
      SELECT COALESCE(
        jsonb_agg(to_jsonb("membership_row") ORDER BY "membership_row"."created_at", "membership_row"."id"),
        '[]'::jsonb
      )
      FROM "care_room_membership" AS "membership_row"
      JOIN "_family_membership_duplicate_map" AS "membership_map"
        ON "membership_map"."old_membership_id" = "membership_row"."id"
      WHERE "membership_map"."canonical_membership_id" = "duplicate_group"."canonical_membership_id"
    ),
    'access_grants', (
      SELECT COALESCE(
        jsonb_agg(to_jsonb("grant_row") ORDER BY "grant_row"."created_at", "grant_row"."id"),
        '[]'::jsonb
      )
      FROM "access_grant" AS "grant_row"
      JOIN "_family_membership_duplicate_map" AS "grant_map"
        ON "grant_map"."old_membership_id" = "grant_row"."care_room_membership_id"
      WHERE "grant_map"."canonical_membership_id" = "duplicate_group"."canonical_membership_id"
    ),
    'family_pulse_ids', (
      SELECT COALESCE(
        jsonb_agg("pulse_row"."id" ORDER BY "pulse_row"."created_at", "pulse_row"."id"),
        '[]'::jsonb
      )
      FROM "family_pulse" AS "pulse_row"
      JOIN "_family_membership_duplicate_map" AS "pulse_map"
        ON "pulse_map"."old_membership_id" = "pulse_row"."care_room_membership_id"
      WHERE "pulse_map"."canonical_membership_id" = "duplicate_group"."canonical_membership_id"
    ),
    'concern_ids', (
      SELECT COALESCE(
        jsonb_agg("concern_row"."id" ORDER BY "concern_row"."created_at", "concern_row"."id"),
        '[]'::jsonb
      )
      FROM "concern" AS "concern_row"
      JOIN "_family_membership_duplicate_map" AS "concern_map"
        ON "concern_map"."old_membership_id" = "concern_row"."raised_by_membership_id"
      WHERE "concern_map"."canonical_membership_id" = "duplicate_group"."canonical_membership_id"
    )
  ),
  jsonb_build_object(
    'status', 'REVOKED',
    'reason', 'historical duplicate memberships require administrator re-invitation',
    'canonical_membership_id', "duplicate_group"."canonical_membership_id",
    'merged_membership_ids', (
      SELECT jsonb_agg("merged_map"."old_membership_id" ORDER BY "merged_map"."old_membership_id")
      FROM "_family_membership_duplicate_map" AS "merged_map"
      WHERE "merged_map"."canonical_membership_id" = "duplicate_group"."canonical_membership_id"
    )
  )
FROM (
  SELECT DISTINCT
    "care_room_id",
    "family_contact_id",
    "canonical_membership_id"
  FROM "_family_membership_duplicate_map"
) AS "duplicate_group"
JOIN "care_room"
  ON "care_room"."id" = "duplicate_group"."care_room_id";

UPDATE "family_pulse" AS "pulse"
SET
  "care_room_membership_id" = "membership_map"."canonical_membership_id",
  "updated_at" = CURRENT_TIMESTAMP
FROM "_family_membership_duplicate_map" AS "membership_map"
WHERE "pulse"."care_room_membership_id" = "membership_map"."old_membership_id"
  AND "membership_map"."old_membership_id" <> "membership_map"."canonical_membership_id";

UPDATE "concern" AS "concern_row"
SET
  "raised_by_membership_id" = "membership_map"."canonical_membership_id",
  "updated_at" = CURRENT_TIMESTAMP
FROM "_family_membership_duplicate_map" AS "membership_map"
WHERE "concern_row"."raised_by_membership_id" = "membership_map"."old_membership_id"
  AND "membership_map"."old_membership_id" <> "membership_map"."canonical_membership_id";

UPDATE "access_grant" AS "grant_row"
SET
  "care_room_membership_id" = "membership_map"."canonical_membership_id",
  "revoked_at" = COALESCE("grant_row"."revoked_at", CURRENT_TIMESTAMP),
  "updated_at" = CURRENT_TIMESTAMP
FROM "_family_membership_duplicate_map" AS "membership_map"
WHERE "grant_row"."care_room_membership_id" = "membership_map"."old_membership_id";

-- Remapping can expose repeated scopes. Historical duplicates elsewhere are
-- handled the same way: retain the oldest row, revoke it, and audit the group.
CREATE TEMP TABLE "_access_grant_duplicate_map" ON COMMIT DROP AS
WITH "ranked_grants" AS (
  SELECT
    "id" AS "old_grant_id",
    "care_room_membership_id",
    "scope",
    FIRST_VALUE("id") OVER (
      PARTITION BY "care_room_membership_id", "scope"
      ORDER BY "created_at", "id"
    ) AS "canonical_grant_id",
    COUNT(*) OVER (
      PARTITION BY "care_room_membership_id", "scope"
    ) AS "grant_count"
  FROM "access_grant"
)
SELECT
  "old_grant_id",
  "care_room_membership_id",
  "scope",
  "canonical_grant_id"
FROM "ranked_grants"
WHERE "grant_count" > 1;

INSERT INTO "audit_log" (
  "id",
  "organization_id",
  "action",
  "resource_type",
  "resource_id",
  "old_values",
  "new_values"
)
SELECT
  'migration-access-grant-' || md5(
    "duplicate_group"."care_room_membership_id" || ':' || "duplicate_group"."scope"::text
  ),
  "care_room"."organization_id",
  'ACCESS_GRANT_DUPLICATE_QUARANTINED',
  'access_grant',
  "duplicate_group"."canonical_grant_id",
  jsonb_build_object(
    'grants', (
      SELECT jsonb_agg(to_jsonb("grant_row") ORDER BY "grant_row"."created_at", "grant_row"."id")
      FROM "access_grant" AS "grant_row"
      JOIN "_access_grant_duplicate_map" AS "grant_map"
        ON "grant_map"."old_grant_id" = "grant_row"."id"
      WHERE "grant_map"."canonical_grant_id" = "duplicate_group"."canonical_grant_id"
    )
  ),
  jsonb_build_object(
    'status', 'REVOKED',
    'reason', 'historical duplicate grants require administrator re-invitation',
    'canonical_grant_id', "duplicate_group"."canonical_grant_id"
  )
FROM (
  SELECT DISTINCT
    "care_room_membership_id",
    "scope",
    "canonical_grant_id"
  FROM "_access_grant_duplicate_map"
) AS "duplicate_group"
JOIN "care_room_membership"
  ON "care_room_membership"."id" = "duplicate_group"."care_room_membership_id"
JOIN "care_room"
  ON "care_room"."id" = "care_room_membership"."care_room_id";

UPDATE "access_grant" AS "grant_row"
SET
  "revoked_at" = COALESCE("grant_row"."revoked_at", CURRENT_TIMESTAMP),
  "updated_at" = CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "canonical_grant_id"
  FROM "_access_grant_duplicate_map"
) AS "duplicate_grant"
WHERE "grant_row"."id" = "duplicate_grant"."canonical_grant_id";

DELETE FROM "access_grant" AS "grant_row"
USING "_access_grant_duplicate_map" AS "grant_map"
WHERE "grant_row"."id" = "grant_map"."old_grant_id"
  AND "grant_map"."old_grant_id" <> "grant_map"."canonical_grant_id";

UPDATE "care_room_membership" AS "membership_row"
SET
  "status" = 'REVOKED',
  "revoked_at" = COALESCE("membership_row"."revoked_at", CURRENT_TIMESTAMP),
  "updated_at" = CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "canonical_membership_id"
  FROM "_family_membership_duplicate_map"
) AS "duplicate_membership"
WHERE "membership_row"."id" = "duplicate_membership"."canonical_membership_id";

DELETE FROM "care_room_membership" AS "membership_row"
USING "_family_membership_duplicate_map" AS "membership_map"
WHERE "membership_row"."id" = "membership_map"."old_membership_id"
  AND "membership_map"."old_membership_id" <> "membership_map"."canonical_membership_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "care_room_membership"
    GROUP BY "care_room_id", "family_contact_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'family invitation migration blocked: unresolved duplicate care room memberships';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "access_grant"
    GROUP BY "care_room_membership_id", "scope"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'family invitation migration blocked: unresolved duplicate access grants';
  END IF;
END
$$;

ALTER TABLE "care_room_membership"
  ADD COLUMN "organization_membership_invitation_id" TEXT;

ALTER TABLE "verified_visit_story"
  ADD COLUMN "family_safe_version" INTEGER,
  ADD COLUMN "family_safe_title" TEXT,
  ADD COLUMN "family_safe_body" TEXT;

ALTER TABLE "verified_visit_story"
  ADD CONSTRAINT "verified_visit_story_family_safe_content_check"
  CHECK (
    ("family_safe_version" IS NULL AND "family_safe_title" IS NULL AND "family_safe_body" IS NULL)
    OR
    (
      "family_safe_version" IS NOT NULL
      AND "family_safe_version" = 1
      AND "family_safe_title" IS NOT NULL
      AND "family_safe_body" IS NOT NULL
      AND length(btrim("family_safe_title")) > 0
      AND length(btrim("family_safe_body")) > 0
    )
  );

CREATE INDEX "care_room_membership_invitation_id_idx"
  ON "care_room_membership"("organization_membership_invitation_id");

CREATE UNIQUE INDEX "care_room_membership_room_contact_key"
  ON "care_room_membership"("care_room_id", "family_contact_id");

CREATE UNIQUE INDEX "access_grant_membership_scope_key"
  ON "access_grant"("care_room_membership_id", "scope");

ALTER TABLE "care_room_membership"
  ADD CONSTRAINT "care_room_membership_organization_membership_invitation_id_fkey"
  FOREIGN KEY ("organization_membership_invitation_id")
  REFERENCES "organization_membership_invitation"("id")
  ON DELETE RESTRICT
  ON UPDATE RESTRICT;

COMMIT;
