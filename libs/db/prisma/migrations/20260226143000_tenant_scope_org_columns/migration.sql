-- Add tenant scoping columns for core care operations
ALTER TABLE "carer" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "visit" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
ALTER TABLE "carer_shift" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Backfill organization scope where derivable from existing relations
UPDATE "visit" v
SET "organization_id" = c."organization_id"
FROM "client" c
WHERE c."id" = v."client_id"
  AND v."organization_id" IS NULL
  AND c."organization_id" IS NOT NULL;

UPDATE "visit" v
SET "organization_id" = cr."organization_id"
FROM "carer" cr
WHERE cr."id" = v."carer_id"
  AND v."organization_id" IS NULL
  AND cr."organization_id" IS NOT NULL;

UPDATE "carer" cr
SET "organization_id" = inferred."organization_id"
FROM (
  SELECT v."carer_id" AS carer_id, MAX(v."organization_id") AS organization_id
  FROM "visit" v
  WHERE v."organization_id" IS NOT NULL
  GROUP BY v."carer_id"
) AS inferred
WHERE cr."id" = inferred.carer_id
  AND cr."organization_id" IS NULL;

UPDATE "carer_shift" s
SET "organization_id" = cr."organization_id"
FROM "carer" cr
WHERE cr."id" = s."carer_id"
  AND s."organization_id" IS NULL
  AND cr."organization_id" IS NOT NULL;

-- Add indexes used by tenant-filtered queries
CREATE INDEX IF NOT EXISTS "carer_organization_id_idx" ON "carer"("organization_id");
CREATE INDEX IF NOT EXISTS "visit_organization_id_idx" ON "visit"("organization_id");
CREATE INDEX IF NOT EXISTS "carer_shift_organization_id_idx" ON "carer_shift"("organization_id");

-- Add foreign keys to organization table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'carer_organization_id_fkey'
      AND table_name = 'carer'
  ) THEN
    ALTER TABLE "carer"
      ADD CONSTRAINT "carer_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'visit_organization_id_fkey'
      AND table_name = 'visit'
  ) THEN
    ALTER TABLE "visit"
      ADD CONSTRAINT "visit_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'carer_shift_organization_id_fkey'
      AND table_name = 'carer_shift'
  ) THEN
    ALTER TABLE "carer_shift"
      ADD CONSTRAINT "carer_shift_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
