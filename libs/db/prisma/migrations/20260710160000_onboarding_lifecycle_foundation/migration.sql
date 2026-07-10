-- Expand-only onboarding foundation. Existing verified organization membership
-- columns, defaults and status values remain unchanged for rolling compatibility.

CREATE TYPE "CompanyAccessRequestStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'DISABLED'
);

CREATE TYPE "OrganizationMembershipInvitationStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED'
);

CREATE TABLE "company_access_request" (
  "id" TEXT NOT NULL,
  "company_name" VARCHAR(200) NOT NULL,
  "contact_name" VARCHAR(200) NOT NULL,
  "business_email" VARCHAR(320) NOT NULL,
  "normalized_business_email" VARCHAR(320) NOT NULL,
  "phone" VARCHAR(50),
  "operational_note" VARCHAR(1000),
  "status" "CompanyAccessRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "organization_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_subject" VARCHAR(191),
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "expired_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_access_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_access_request_names_check" CHECK (
    length(btrim("company_name")) > 0
    AND length(btrim("contact_name")) > 0
  ),
  CONSTRAINT "company_access_request_email_check" CHECK (
    length("normalized_business_email") > 0
    AND "normalized_business_email" = lower(btrim("normalized_business_email"))
    AND "normalized_business_email" = lower(btrim("business_email"))
  ),
  CONSTRAINT "company_access_request_state_check" CHECK (
    (
      "status" = 'PENDING_APPROVAL'
      AND "organization_id" IS NULL
      AND "approved_at" IS NULL
      AND "rejected_at" IS NULL
      AND "expired_at" IS NULL
      AND "disabled_at" IS NULL
    )
    OR (
      "status" = 'APPROVED'
      AND "organization_id" IS NOT NULL
      AND "approved_at" IS NOT NULL
      AND "rejected_at" IS NULL
      AND "expired_at" IS NULL
      AND "disabled_at" IS NULL
    )
    OR (
      "status" = 'REJECTED'
      AND "organization_id" IS NULL
      AND "approved_at" IS NULL
      AND "rejected_at" IS NOT NULL
      AND "expired_at" IS NULL
      AND "disabled_at" IS NULL
    )
    OR (
      "status" = 'EXPIRED'
      AND "organization_id" IS NULL
      AND "approved_at" IS NULL
      AND "rejected_at" IS NULL
      AND "expired_at" IS NOT NULL
      AND "disabled_at" IS NULL
    )
    OR (
      "status" = 'DISABLED'
      AND "disabled_at" IS NOT NULL
      AND "rejected_at" IS NULL
      AND "expired_at" IS NULL
      AND (
        ("organization_id" IS NULL AND "approved_at" IS NULL)
        OR ("organization_id" IS NOT NULL AND "approved_at" IS NOT NULL)
      )
    )
  )
);

CREATE TABLE "organization_membership_invitation" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "source_request_id" TEXT,
  "activated_membership_id" TEXT,
  "identity_provider" VARCHAR(50) NOT NULL,
  "intended_email" VARCHAR(320) NOT NULL,
  "normalized_email" VARCHAR(320) NOT NULL,
  "intended_role" VARCHAR(50) NOT NULL,
  "status" "OrganizationMembershipInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "external_invitation_id" VARCHAR(191),
  "created_by_subject" VARCHAR(191),
  "bound_auth_subject" VARCHAR(191),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "expired_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organization_membership_invitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_membership_invitation_identity_check" CHECK (
    length(btrim("identity_provider")) > 0
    AND "identity_provider" = lower(btrim("identity_provider"))
    AND length(btrim("intended_email")) > 0
    AND length("normalized_email") > 0
    AND "normalized_email" = lower(btrim("normalized_email"))
    AND "normalized_email" = lower(btrim("intended_email"))
    AND length(btrim("intended_role")) > 0
    AND "intended_role" = lower(btrim("intended_role"))
  ),
  CONSTRAINT "organization_membership_invitation_expiry_check" CHECK (
    "expires_at" > "created_at"
  ),
  CONSTRAINT "organization_membership_invitation_state_check" CHECK (
    (
      "status" = 'PENDING'
      AND "activated_membership_id" IS NULL
      AND "bound_auth_subject" IS NULL
      AND "accepted_at" IS NULL
      AND "expired_at" IS NULL
      AND "revoked_at" IS NULL
    )
    OR (
      "status" = 'ACCEPTED'
      AND "activated_membership_id" IS NOT NULL
      AND "bound_auth_subject" IS NOT NULL
      AND "accepted_at" IS NOT NULL
      AND "accepted_at" >= "created_at"
      AND "accepted_at" <= "expires_at"
      AND "expired_at" IS NULL
      AND "revoked_at" IS NULL
    )
    OR (
      "status" = 'EXPIRED'
      AND "activated_membership_id" IS NULL
      AND "bound_auth_subject" IS NULL
      AND "accepted_at" IS NULL
      AND "expired_at" IS NOT NULL
      AND "expired_at" >= "expires_at"
      AND "revoked_at" IS NULL
    )
    OR (
      "status" = 'REVOKED'
      AND "activated_membership_id" IS NULL
      AND "bound_auth_subject" IS NULL
      AND "accepted_at" IS NULL
      AND "expired_at" IS NULL
      AND "revoked_at" IS NOT NULL
    )
  )
);

CREATE INDEX "company_access_request_status_requested_at_idx"
  ON "company_access_request"("status", "requested_at");

CREATE INDEX "company_access_request_normalized_business_email_idx"
  ON "company_access_request"("normalized_business_email");

CREATE INDEX "company_access_request_organization_id_idx"
  ON "company_access_request"("organization_id");

CREATE UNIQUE INDEX "company_access_request_one_pending_email_key"
  ON "company_access_request"("normalized_business_email")
  WHERE "status" = 'PENDING_APPROVAL';

CREATE INDEX "organization_membership_invitation_org_status_created_idx"
  ON "organization_membership_invitation"("organization_id", "status", "created_at");

CREATE INDEX "organization_membership_invitation_status_expires_at_idx"
  ON "organization_membership_invitation"("status", "expires_at");

CREATE INDEX "organization_membership_invitation_normalized_email_idx"
  ON "organization_membership_invitation"("normalized_email");

CREATE UNIQUE INDEX "company_access_request_bootstrap_identity_key"
  ON "company_access_request"(
    "id",
    "organization_id",
    "normalized_business_email"
  );

CREATE UNIQUE INDEX "organization_membership_invitation_source_request_id_key"
  ON "organization_membership_invitation"("source_request_id");

CREATE UNIQUE INDEX "organization_membership_invitation_source_identity_key"
  ON "organization_membership_invitation"(
    "source_request_id",
    "organization_id",
    "normalized_email"
  );

CREATE UNIQUE INDEX "organization_membership_invitation_activated_membership_id_key"
  ON "organization_membership_invitation"("activated_membership_id");

CREATE UNIQUE INDEX "organization_membership_invitation_provider_external_id_key"
  ON "organization_membership_invitation"("identity_provider", "external_invitation_id");

CREATE UNIQUE INDEX "organization_membership_invitation_one_pending_key"
  ON "organization_membership_invitation"(
    "organization_id",
    "identity_provider",
    "normalized_email"
  )
  WHERE "status" = 'PENDING';

-- The composite key lets the activation foreign key enforce the complete
-- tenant, provider, subject, email and role binding.
CREATE UNIQUE INDEX "organization_membership_activation_identity_key"
  ON "organization_membership"(
    "organization_id",
    "id",
    "identity_provider",
    "auth_subject",
    "normalized_email",
    "role"
  );

ALTER TABLE "company_access_request"
  ADD CONSTRAINT "company_access_request_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_membership_invitation"
  ADD CONSTRAINT "organization_membership_invitation_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "organization_membership_invitation"
  ADD CONSTRAINT "organization_membership_invitation_source_request_fkey"
  FOREIGN KEY (
    "source_request_id",
    "organization_id",
    "normalized_email"
  )
  REFERENCES "company_access_request"(
    "id",
    "organization_id",
    "normalized_business_email"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "organization_membership_invitation"
  ADD CONSTRAINT "organization_membership_invitation_activated_membership_fkey"
  FOREIGN KEY (
    "organization_id",
    "activated_membership_id",
    "identity_provider",
    "bound_auth_subject",
    "normalized_email",
    "intended_role"
  )
  REFERENCES "organization_membership"(
    "organization_id",
    "id",
    "identity_provider",
    "auth_subject",
    "normalized_email",
    "role"
  )
  ON DELETE RESTRICT ON UPDATE RESTRICT;
