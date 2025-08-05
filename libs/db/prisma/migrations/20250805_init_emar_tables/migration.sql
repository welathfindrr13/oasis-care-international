-- CreateEnum
CREATE TYPE "MedicationStatus" AS ENUM ('SCHEDULED', 'ADMINISTERED', 'MISSED', 'REFUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicationAuditAction" AS ENUM ('PRESCRIPTION_CREATED', 'PRESCRIPTION_UPDATED', 'PRESCRIPTION_DELETED', 'MEDICATION_SCHEDULED', 'MEDICATION_ADMINISTERED', 'MEDICATION_MISSED', 'MEDICATION_REFUSED', 'MEDICATION_CANCELLED');

-- CreateTable
CREATE TABLE "medication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "medication_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "frequency_per_day" INTEGER NOT NULL,
    "frequency_interval_hours" INTEGER,
    "administration_times" TEXT[],
    "special_instructions" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_administration" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "scheduled_time" TIMESTAMP(3) NOT NULL,
    "administered_time" TIMESTAMP(3),
    "administered_by" TEXT,
    "status" "MedicationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "medication_administration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_audit" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT,
    "medication_administration_id" TEXT,
    "action" "MedicationAuditAction" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescription_client_id_idx" ON "prescription"("client_id");

-- CreateIndex
CREATE INDEX "prescription_medication_id_idx" ON "prescription"("medication_id");

-- CreateIndex
CREATE INDEX "prescription_start_date_end_date_idx" ON "prescription"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "medication_administration_prescription_id_idx" ON "medication_administration"("prescription_id");

-- CreateIndex
CREATE INDEX "medication_administration_visit_id_idx" ON "medication_administration"("visit_id");

-- CreateIndex
CREATE INDEX "medication_administration_scheduled_time_idx" ON "medication_administration"("scheduled_time");

-- CreateIndex
CREATE INDEX "medication_administration_status_scheduled_time_idx" ON "medication_administration"("status", "scheduled_time");

-- CreateIndex
CREATE INDEX "medication_audit_prescription_id_idx" ON "medication_audit"("prescription_id");

-- CreateIndex
CREATE INDEX "medication_audit_medication_administration_id_idx" ON "medication_audit"("medication_administration_id");

-- CreateIndex
CREATE INDEX "medication_audit_timestamp_idx" ON "medication_audit"("timestamp");

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_administration" ADD CONSTRAINT "medication_administration_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_audit" ADD CONSTRAINT "medication_audit_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_audit" ADD CONSTRAINT "medication_audit_medication_administration_id_fkey" FOREIGN KEY ("medication_administration_id") REFERENCES "medication_administration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
