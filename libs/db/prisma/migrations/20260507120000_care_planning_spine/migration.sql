-- Care-planning spine: assessments, approved care plans, and evidence packs.
-- This migration mirrors the Prisma models already present in schema.prisma and
-- uses guards so local/staging databases that were manually pushed do not fail.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessmentStatus') THEN
    CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessmentSource') THEN
    CREATE TYPE "AssessmentSource" AS ENUM ('MANUAL', 'VISIT_REVIEW', 'HOSPITAL_DISCHARGE', 'REFERRAL_HANDOFF');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CarePlanStatus') THEN
    CREATE TYPE "CarePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvidencePackStatus') THEN
    CREATE TYPE "EvidencePackStatus" AS ENUM ('DRAFT', 'COMPILED', 'PUBLISHED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvidenceSourceType') THEN
    CREATE TYPE "EvidenceSourceType" AS ENUM (
      'VISIT',
      'CARE_LOG',
      'MEDICATION_ADMINISTRATION',
      'ASSESSMENT',
      'CARE_PLAN',
      'CONCERN',
      'MANUAL_NOTE'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "assessment" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "client_id" TEXT NOT NULL,
  "visit_id" TEXT,
  "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "AssessmentSource" NOT NULL DEFAULT 'MANUAL',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "findings" JSONB NOT NULL,
  "risk_flags" JSONB,
  "recommended_actions" JSONB,
  "assessor_id" TEXT,
  "completed_at" TIMESTAMP(3),
  "review_due_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "care_plan" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "client_id" TEXT NOT NULL,
  "assessment_id" TEXT,
  "status" "CarePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "goals" JSONB NOT NULL,
  "interventions" JSONB NOT NULL,
  "safety_notes" TEXT,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMP(3),
  "review_due_at" TIMESTAMP(3),
  "authored_by_id" TEXT,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "care_plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "evidence_pack" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "client_id" TEXT NOT NULL,
  "care_plan_id" TEXT,
  "status" "EvidencePackStatus" NOT NULL DEFAULT 'DRAFT',
  "kind" VARCHAR(50) NOT NULL DEFAULT 'REGULATORY_REVIEW',
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "summary" JSONB,
  "source_refs" JSONB NOT NULL,
  "generated_by" VARCHAR(50) NOT NULL DEFAULT 'system',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evidence_pack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "evidence_item" (
  "id" TEXT NOT NULL,
  "evidence_pack_id" TEXT NOT NULL,
  "source_type" "EvidenceSourceType" NOT NULL,
  "source_id" TEXT,
  "occurred_at" TIMESTAMP(3),
  "headline" TEXT NOT NULL,
  "detail" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evidence_item_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assessment_organization_id_idx" ON "assessment"("organization_id");
CREATE INDEX IF NOT EXISTS "assessment_client_id_idx" ON "assessment"("client_id");
CREATE INDEX IF NOT EXISTS "assessment_visit_id_idx" ON "assessment"("visit_id");
CREATE INDEX IF NOT EXISTS "assessment_status_idx" ON "assessment"("status");
CREATE INDEX IF NOT EXISTS "assessment_review_due_at_idx" ON "assessment"("review_due_at");

CREATE INDEX IF NOT EXISTS "care_plan_organization_id_idx" ON "care_plan"("organization_id");
CREATE INDEX IF NOT EXISTS "care_plan_client_id_idx" ON "care_plan"("client_id");
CREATE INDEX IF NOT EXISTS "care_plan_assessment_id_idx" ON "care_plan"("assessment_id");
CREATE INDEX IF NOT EXISTS "care_plan_status_idx" ON "care_plan"("status");
CREATE INDEX IF NOT EXISTS "care_plan_review_due_at_idx" ON "care_plan"("review_due_at");

CREATE INDEX IF NOT EXISTS "evidence_pack_organization_id_idx" ON "evidence_pack"("organization_id");
CREATE INDEX IF NOT EXISTS "evidence_pack_client_id_idx" ON "evidence_pack"("client_id");
CREATE INDEX IF NOT EXISTS "evidence_pack_care_plan_id_idx" ON "evidence_pack"("care_plan_id");
CREATE INDEX IF NOT EXISTS "evidence_pack_status_idx" ON "evidence_pack"("status");
CREATE INDEX IF NOT EXISTS "evidence_pack_period_start_period_end_idx" ON "evidence_pack"("period_start", "period_end");

CREATE INDEX IF NOT EXISTS "evidence_item_evidence_pack_id_idx" ON "evidence_item"("evidence_pack_id");
CREATE INDEX IF NOT EXISTS "evidence_item_source_type_idx" ON "evidence_item"("source_type");
CREATE INDEX IF NOT EXISTS "evidence_item_source_id_idx" ON "evidence_item"("source_id");
CREATE INDEX IF NOT EXISTS "evidence_item_occurred_at_idx" ON "evidence_item"("occurred_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'assessment_client_id_fkey'
      AND table_name = 'assessment'
  ) THEN
    ALTER TABLE "assessment"
      ADD CONSTRAINT "assessment_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "client"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'care_plan_client_id_fkey'
      AND table_name = 'care_plan'
  ) THEN
    ALTER TABLE "care_plan"
      ADD CONSTRAINT "care_plan_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "client"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'care_plan_assessment_id_fkey'
      AND table_name = 'care_plan'
  ) THEN
    ALTER TABLE "care_plan"
      ADD CONSTRAINT "care_plan_assessment_id_fkey"
      FOREIGN KEY ("assessment_id") REFERENCES "assessment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'evidence_pack_client_id_fkey'
      AND table_name = 'evidence_pack'
  ) THEN
    ALTER TABLE "evidence_pack"
      ADD CONSTRAINT "evidence_pack_client_id_fkey"
      FOREIGN KEY ("client_id") REFERENCES "client"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'evidence_pack_care_plan_id_fkey'
      AND table_name = 'evidence_pack'
  ) THEN
    ALTER TABLE "evidence_pack"
      ADD CONSTRAINT "evidence_pack_care_plan_id_fkey"
      FOREIGN KEY ("care_plan_id") REFERENCES "care_plan"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'evidence_item_evidence_pack_id_fkey'
      AND table_name = 'evidence_item'
  ) THEN
    ALTER TABLE "evidence_item"
      ADD CONSTRAINT "evidence_item_evidence_pack_id_fkey"
      FOREIGN KEY ("evidence_pack_id") REFERENCES "evidence_pack"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
