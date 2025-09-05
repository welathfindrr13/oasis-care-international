-- AlterTable
ALTER TABLE "health_summary" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';

-- CreateTable
CREATE TABLE "consent_record" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" VARCHAR(50) NOT NULL,
    "purpose" VARCHAR(100) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "withdrawn_at" TIMESTAMP(3),
    "legal_basis" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policy" (
    "id" TEXT NOT NULL,
    "data_category" VARCHAR(50) NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "legal_basis" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erasure_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erasure_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_record_user_id_idx" ON "consent_record"("user_id");

-- CreateIndex
CREATE INDEX "consent_record_consent_type_idx" ON "consent_record"("consent_type");

-- CreateIndex
CREATE INDEX "consent_record_granted_at_idx" ON "consent_record"("granted_at");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_resource_type_resource_id_idx" ON "audit_log"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- CreateIndex
CREATE INDEX "retention_policy_data_category_idx" ON "retention_policy"("data_category");

-- CreateIndex
CREATE INDEX "retention_policy_is_active_idx" ON "retention_policy"("is_active");

-- CreateIndex
CREATE INDEX "erasure_queue_user_id_idx" ON "erasure_queue"("user_id");

-- CreateIndex
CREATE INDEX "erasure_queue_status_idx" ON "erasure_queue"("status");

-- CreateIndex
CREATE INDEX "erasure_queue_scheduled_for_idx" ON "erasure_queue"("scheduled_for");
