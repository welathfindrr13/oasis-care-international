-- Create enums for structured care logging
CREATE TYPE "CareLogCategory" AS ENUM (
  'TOILETING',
  'NUTRITION',
  'HYDRATION',
  'SLEEP',
  'MOOD',
  'MOBILITY',
  'MEDICATION',
  'SKIN',
  'PAIN',
  'INCIDENT',
  'OTHER'
);

CREATE TYPE "IntakeAmount" AS ENUM ('NONE', 'QUARTER', 'HALF', 'MOST', 'ALL');
CREATE TYPE "MoodLevel" AS ENUM ('VERY_LOW', 'LOW', 'NEUTRAL', 'GOOD', 'VERY_GOOD');
CREATE TYPE "StoolType" AS ENUM ('TYPE_1', 'TYPE_2', 'TYPE_3', 'TYPE_4', 'TYPE_5', 'TYPE_6', 'TYPE_7');

-- Create table
CREATE TABLE "care_log" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "visit_id" TEXT,
  "client_id" TEXT NOT NULL,
  "carer_id" TEXT NOT NULL,
  "medication_administration_id" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "category" "CareLogCategory" NOT NULL,
  "notes" TEXT,
  "urine_passed" BOOLEAN,
  "bowel_movement" BOOLEAN,
  "stool_type" "StoolType",
  "continence_status" VARCHAR(50),
  "assistance_level" VARCHAR(50),
  "meal_type" VARCHAR(50),
  "intake_amount" "IntakeAmount",
  "fluid_ml" INTEGER,
  "appetite" VARCHAR(50),
  "slept" BOOLEAN,
  "sleep_start" TIMESTAMP(3),
  "sleep_end" TIMESTAMP(3),
  "sleep_quality" VARCHAR(50),
  "mood_level" "MoodLevel",
  "agitation" BOOLEAN,
  "confusion" BOOLEAN,
  "pain_score" INTEGER,
  "escalated" BOOLEAN NOT NULL DEFAULT false,
  "escalated_to" VARCHAR(100),
  "escalated_at" TIMESTAMP(3),
  "source" VARCHAR(50),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "care_log_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "care_log_organization_id_idx" ON "care_log"("organization_id");
CREATE INDEX "care_log_visit_id_idx" ON "care_log"("visit_id");
CREATE INDEX "care_log_client_id_idx" ON "care_log"("client_id");
CREATE INDEX "care_log_carer_id_idx" ON "care_log"("carer_id");
CREATE INDEX "care_log_category_occurred_at_idx" ON "care_log"("category", "occurred_at");
CREATE INDEX "care_log_occurred_at_idx" ON "care_log"("occurred_at");

-- Foreign keys
ALTER TABLE "care_log"
  ADD CONSTRAINT "care_log_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "care_log"
  ADD CONSTRAINT "care_log_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "care_log"
  ADD CONSTRAINT "care_log_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "care_log"
  ADD CONSTRAINT "care_log_carer_id_fkey"
  FOREIGN KEY ("carer_id") REFERENCES "carer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "care_log"
  ADD CONSTRAINT "care_log_medication_administration_id_fkey"
  FOREIGN KEY ("medication_administration_id") REFERENCES "medication_administration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
