-- Expand-only provisioning state for approved company access requests.
-- External identity-provider work is leased and recoverable; no active tenant
-- membership is created by this migration or by the approval transaction.

CREATE TYPE "OrganizationProvisioningOutboxStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRYABLE',
  'DELIVERED',
  'NEEDS_ATTENTION'
);

CREATE TABLE "organization_provider_binding" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "identity_provider" VARCHAR(50) NOT NULL,
  "external_organization_id" VARCHAR(191) NOT NULL,
  "external_slug" VARCHAR(191) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_provider_binding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_provider_binding_identity_check" CHECK (
    length(btrim("identity_provider")) > 0
    AND "identity_provider" = lower(btrim("identity_provider"))
    AND length(btrim("external_organization_id")) > 0
    AND length(btrim("external_slug")) > 0
  )
);

CREATE TABLE "organization_provisioning_outbox" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "source_request_id" TEXT NOT NULL,
  "invitation_id" TEXT NOT NULL,
  "status" "OrganizationProvisioningOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" VARCHAR(191),
  "lease_expires_at" TIMESTAMP(3),
  "last_error_code" VARCHAR(100),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_provisioning_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_provisioning_outbox_attempt_check" CHECK (
    "attempt_count" >= 0
  ),
  CONSTRAINT "organization_provisioning_outbox_state_check" CHECK (
    (
      "status" = 'PENDING'
      AND "lease_token" IS NULL
      AND "lease_expires_at" IS NULL
      AND "last_error_code" IS NULL
      AND "delivered_at" IS NULL
    )
    OR (
      "status" = 'PROCESSING'
      AND "lease_token" IS NOT NULL
      AND "lease_expires_at" IS NOT NULL
      AND "delivered_at" IS NULL
    )
    OR (
      "status" = 'RETRYABLE'
      AND "lease_token" IS NULL
      AND "lease_expires_at" IS NULL
      AND "last_error_code" IS NOT NULL
      AND "delivered_at" IS NULL
    )
    OR (
      "status" = 'DELIVERED'
      AND "lease_token" IS NULL
      AND "lease_expires_at" IS NULL
      AND "last_error_code" IS NULL
      AND "delivered_at" IS NOT NULL
    )
    OR (
      "status" = 'NEEDS_ATTENTION'
      AND "lease_token" IS NULL
      AND "lease_expires_at" IS NULL
      AND "last_error_code" IS NOT NULL
      AND "delivered_at" IS NULL
    )
  )
);

CREATE UNIQUE INDEX "organization_provider_binding_org_provider_key"
  ON "organization_provider_binding"("organization_id", "identity_provider");

CREATE UNIQUE INDEX "organization_provider_binding_external_key"
  ON "organization_provider_binding"("identity_provider", "external_organization_id");

CREATE UNIQUE INDEX "organization_provider_binding_slug_key"
  ON "organization_provider_binding"("identity_provider", "external_slug");

CREATE UNIQUE INDEX "organization_provisioning_outbox_source_request_id_key"
  ON "organization_provisioning_outbox"("source_request_id");

CREATE UNIQUE INDEX "organization_provisioning_outbox_invitation_id_key"
  ON "organization_provisioning_outbox"("invitation_id");

CREATE INDEX "organization_provisioning_outbox_status_available_idx"
  ON "organization_provisioning_outbox"("status", "available_at");

CREATE INDEX "organization_provisioning_outbox_org_created_idx"
  ON "organization_provisioning_outbox"("organization_id", "created_at");

ALTER TABLE "organization_provider_binding"
  ADD CONSTRAINT "organization_provider_binding_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "organization_provisioning_outbox"
  ADD CONSTRAINT "organization_provisioning_outbox_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "organization_provisioning_outbox"
  ADD CONSTRAINT "organization_provisioning_outbox_source_request_id_fkey"
  FOREIGN KEY ("source_request_id") REFERENCES "company_access_request"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "organization_provisioning_outbox"
  ADD CONSTRAINT "organization_provisioning_outbox_invitation_id_fkey"
  FOREIGN KEY ("invitation_id") REFERENCES "organization_membership_invitation"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- All three records are created together for one approved bootstrap. These
-- composite foreign keys prevent a future write from cross-linking tenants.
CREATE UNIQUE INDEX "company_access_request_id_organization_key"
  ON "company_access_request"("id", "organization_id");

CREATE UNIQUE INDEX "organization_membership_invitation_id_organization_request_key"
  ON "organization_membership_invitation"("id", "organization_id", "source_request_id");

ALTER TABLE "organization_provisioning_outbox"
  ADD CONSTRAINT "organization_provisioning_outbox_request_org_fkey"
  FOREIGN KEY ("source_request_id", "organization_id")
  REFERENCES "company_access_request"("id", "organization_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "organization_provisioning_outbox"
  ADD CONSTRAINT "organization_provisioning_outbox_invitation_org_request_fkey"
  FOREIGN KEY ("invitation_id", "organization_id", "source_request_id")
  REFERENCES "organization_membership_invitation"("id", "organization_id", "source_request_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
