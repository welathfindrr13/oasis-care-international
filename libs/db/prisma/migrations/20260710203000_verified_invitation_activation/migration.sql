-- Fail closed if the controlled-pilot one-active-organization invariant is
-- already violated. This migration never rewrites or deletes membership data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "organization_membership"
    WHERE "status" = 'ACTIVE' AND "revoked_at" IS NULL
    GROUP BY "identity_provider", "auth_subject"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple active organization memberships exist for one authenticated subject';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "organization_membership"
    WHERE "external_membership_id" IS NOT NULL
    GROUP BY "identity_provider", "external_membership_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate external organization membership bindings exist';
  END IF;
END $$;

-- Preserve expired/revoked invitation history while allowing one fresh
-- replacement for the same source. The existing partial unique index still
-- permits only one PENDING invitation for a tenant/provider/email identity.
DROP INDEX "organization_membership_invitation_source_request_id_key";
DROP INDEX "organization_membership_invitation_source_identity_key";

CREATE INDEX "organization_membership_invitation_source_identity_idx"
  ON "organization_membership_invitation"(
    "source_request_id",
    "organization_id",
    "normalized_email"
  );

CREATE UNIQUE INDEX "organization_membership_one_active_subject_key"
  ON "organization_membership"("identity_provider", "auth_subject")
  WHERE "status" = 'ACTIVE' AND "revoked_at" IS NULL;

CREATE UNIQUE INDEX "organization_membership_provider_external_membership_key"
  ON "organization_membership"("identity_provider", "external_membership_id");
