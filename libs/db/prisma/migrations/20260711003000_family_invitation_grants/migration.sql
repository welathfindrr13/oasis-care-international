DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "care_room_membership"
    GROUP BY "care_room_id", "family_contact_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'family invitation migration blocked: duplicate care room memberships exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "access_grant"
    GROUP BY "care_room_membership_id", "scope"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'family invitation migration blocked: duplicate access grants exist';
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

CREATE UNIQUE INDEX "care_room_membership_invitation_id_key"
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
