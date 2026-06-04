-- Tenant Isolation Gate 001:
-- Add explicit verified organisation memberships and tenant-scoped compliance logs.
-- Existing nullable operational organization_id columns are intentionally not made
-- NOT NULL in this migration; that requires a production backfill gate.

CREATE TYPE "OrganizationMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

CREATE TABLE "organization_membership" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "identity_provider" VARCHAR(50) NOT NULL,
  "auth_subject" VARCHAR(191) NOT NULL,
  "normalized_email" VARCHAR(320),
  "role" VARCHAR(50) NOT NULL,
  "status" "OrganizationMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "external_organization_id" VARCHAR(191),
  "external_membership_id" VARCHAR(191),
  "metadata" JSONB,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_membership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_membership_organization_id_idx"
  ON "organization_membership"("organization_id");

CREATE INDEX "organization_membership_identity_provider_auth_subject_idx"
  ON "organization_membership"("identity_provider", "auth_subject");

CREATE INDEX "organization_membership_status_idx"
  ON "organization_membership"("status");

CREATE UNIQUE INDEX "organization_membership_identity_provider_auth_subject_organization_id_key"
  ON "organization_membership"("identity_provider", "auth_subject", "organization_id");

ALTER TABLE "organization_membership"
  ADD CONSTRAINT "organization_membership_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent_record" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "audit_log" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "erasure_queue" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "medication_audit" ADD COLUMN "organization_id" TEXT;

CREATE INDEX "consent_record_organization_id_idx" ON "consent_record"("organization_id");
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log"("organization_id");
CREATE INDEX "erasure_queue_organization_id_idx" ON "erasure_queue"("organization_id");
CREATE INDEX "medication_audit_organization_id_idx" ON "medication_audit"("organization_id");

ALTER TABLE "consent_record"
  ADD CONSTRAINT "consent_record_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "erasure_queue"
  ADD CONSTRAINT "erasure_queue_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medication_audit"
  ADD CONSTRAINT "medication_audit_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
