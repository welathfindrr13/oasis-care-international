-- CreateEnum
CREATE TYPE "ShiftVerificationMethod" AS ENUM ('GPS', 'QR', 'NFC', 'PHONE', 'MANUAL');

-- CreateTable
CREATE TABLE "carer_shift" (
    "id" TEXT NOT NULL,
    "carer_id" TEXT NOT NULL,
    "clock_in_at" TIMESTAMP(3) NOT NULL,
    "clock_out_at" TIMESTAMP(3),
    "clock_in_method" "ShiftVerificationMethod" NOT NULL DEFAULT 'GPS',
    "clock_out_method" "ShiftVerificationMethod",
    "clock_in_lat" DOUBLE PRECISION,
    "clock_in_lng" DOUBLE PRECISION,
    "clock_in_accuracy_m" DOUBLE PRECISION,
    "clock_out_lat" DOUBLE PRECISION,
    "clock_out_lng" DOUBLE PRECISION,
    "clock_out_accuracy_m" DOUBLE PRECISION,
    "clock_in_source" VARCHAR(50),
    "clock_out_source" VARCHAR(50),
    "clock_in_reason_code" VARCHAR(50),
    "clock_out_reason_code" VARCHAR(50),
    "location_consent_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "carer_shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carer_shift_carer_id_idx" ON "carer_shift"("carer_id");

-- CreateIndex
CREATE INDEX "carer_shift_clock_in_at_idx" ON "carer_shift"("clock_in_at");

-- CreateIndex
CREATE INDEX "carer_shift_clock_out_at_idx" ON "carer_shift"("clock_out_at");

-- CreateIndex
CREATE UNIQUE INDEX "carer_shift_one_open_per_carer_idx" ON "carer_shift"("carer_id")
WHERE "clock_out_at" IS NULL AND "deleted_at" IS NULL;

-- AddForeignKey
ALTER TABLE "carer_shift" ADD CONSTRAINT "carer_shift_carer_id_fkey"
FOREIGN KEY ("carer_id") REFERENCES "carer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
