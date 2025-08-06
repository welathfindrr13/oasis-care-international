-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ai_summary_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "client" ADD COLUMN     "organization_id" TEXT;

-- CreateTable
CREATE TABLE "log_embedding" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "log_type" VARCHAR(50) NOT NULL,
    "log_timestamp" TIMESTAMP(3) NOT NULL,
    "embedding" vector(768),
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "log_embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_summary" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "summary_json" JSONB NOT NULL,
    "risk_levels" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "generated_by" VARCHAR(50) NOT NULL DEFAULT 'ai',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "feedback" VARCHAR(10),
    "expires_at" TIMESTAMP(3) NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_embedding_visit_id_idx" ON "log_embedding"("visit_id");

-- CreateIndex
CREATE INDEX "log_embedding_log_timestamp_idx" ON "log_embedding"("log_timestamp");

-- CreateIndex
CREATE INDEX "health_summary_client_id_idx" ON "health_summary"("client_id");

-- CreateIndex
CREATE INDEX "health_summary_period_start_period_end_idx" ON "health_summary"("period_start", "period_end");

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_embedding" ADD CONSTRAINT "log_embedding_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_summary" ADD CONSTRAINT "health_summary_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_summary" ADD CONSTRAINT "health_summary_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "carer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add dimension constraint for vector field
ALTER TABLE "log_embedding" ADD CONSTRAINT "chk_embedding_dim" CHECK (embedding IS NULL OR vector_dims(embedding) = 768);
