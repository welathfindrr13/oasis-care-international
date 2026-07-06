-- Require tenant ownership for sensitive tenant-owned tables.
-- AuditLog remains nullable as the documented audit/system-event exception.

ALTER TABLE "carer" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "client" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "visit" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "carer_shift" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "medication_audit" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "assessment" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "care_plan" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "evidence_pack" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "care_log" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "consent_record" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "erasure_queue" ALTER COLUMN "organization_id" SET NOT NULL;
