-- Map external auth identities (Cognito sub/email) to organizations.
CREATE TABLE IF NOT EXISTS "organization_identity" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "identity_provider" VARCHAR(50) NOT NULL,
  "identity_subject" VARCHAR(191),
  "normalized_email" VARCHAR(320),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_identity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "organization_identity_organization_id_idx"
  ON "organization_identity"("organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_identity_identity_provider_identity_subject_key"
  ON "organization_identity"("identity_provider", "identity_subject");

CREATE UNIQUE INDEX IF NOT EXISTS "organization_identity_identity_provider_normalized_email_key"
  ON "organization_identity"("identity_provider", "normalized_email");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_identity_organization_id_fkey'
      AND table_name = 'organization_identity'
  ) THEN
    ALTER TABLE "organization_identity"
      ADD CONSTRAINT "organization_identity_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill from existing carer records where org context already exists.
INSERT INTO "organization_identity" (
  "id",
  "organization_id",
  "identity_provider",
  "normalized_email",
  "notes",
  "updated_at"
)
SELECT
  concat('backfill-carer-', c."id"),
  c."organization_id",
  'cognito',
  lower(c."email"),
  'backfill:carer-email',
  NOW()
FROM "carer" c
WHERE c."deleted_at" IS NULL
  AND c."organization_id" IS NOT NULL
  AND c."email" IS NOT NULL
ON CONFLICT ("identity_provider", "normalized_email") DO NOTHING;
