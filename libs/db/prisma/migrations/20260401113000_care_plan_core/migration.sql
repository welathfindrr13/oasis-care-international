-- Alter client profile for operational care-delivery fields
ALTER TABLE "client"
  ADD COLUMN "preferred_name" TEXT,
  ADD COLUMN "pronouns" TEXT,
  ADD COLUMN "preferred_language" TEXT,
  ADD COLUMN "communication_needs" TEXT,
  ADD COLUMN "accessibility_adjustments" TEXT,
  ADD COLUMN "representative_name" TEXT,
  ADD COLUMN "representative_relationship" TEXT,
  ADD COLUMN "representative_phone" TEXT,
  ADD COLUMN "representative_email" TEXT;

-- Care-plan lifecycle enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CarePlanStatus') THEN
    CREATE TYPE "CarePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');
  END IF;
END $$;

CREATE TABLE "care_plan" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "active_version_id" TEXT,
  "draft_version_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "care_plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "care_plan_version" (
  "id" TEXT NOT NULL,
  "care_plan_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "status" "CarePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "review_due_at" TIMESTAMP(3),
  "effective_from" TIMESTAMP(3),
  "authored_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "care_plan_version_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "care_plan_client_id_key" ON "care_plan"("client_id");
CREATE UNIQUE INDEX "care_plan_version_care_plan_id_version_number_key" ON "care_plan_version"("care_plan_id", "version_number");
CREATE UNIQUE INDEX "care_plan_active_version_id_key" ON "care_plan"("active_version_id");
CREATE UNIQUE INDEX "care_plan_draft_version_id_key" ON "care_plan"("draft_version_id");
CREATE INDEX "care_plan_version_care_plan_id_status_idx" ON "care_plan_version"("care_plan_id", "status");
CREATE INDEX "care_plan_version_approved_at_idx" ON "care_plan_version"("approved_at");

ALTER TABLE "care_plan"
  ADD CONSTRAINT "care_plan_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "care_plan_version"
  ADD CONSTRAINT "care_plan_version_care_plan_id_fkey"
  FOREIGN KEY ("care_plan_id") REFERENCES "care_plan"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "care_plan"
  ADD CONSTRAINT "care_plan_active_version_id_fkey"
  FOREIGN KEY ("active_version_id") REFERENCES "care_plan_version"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

ALTER TABLE "care_plan"
  ADD CONSTRAINT "care_plan_draft_version_id_fkey"
  FOREIGN KEY ("draft_version_id") REFERENCES "care_plan_version"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
