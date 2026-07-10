-- Generic organization invitations reuse the durable provisioning outbox but
-- are not coupled to a company access request. Existing bootstrap rows retain
-- their request foreign keys and behavior.
ALTER TABLE IF EXISTS "organization_provisioning_outbox"
  ALTER COLUMN "source_request_id" DROP NOT NULL;

ALTER TABLE IF EXISTS "organization_membership_invitation"
  ADD COLUMN "external_cleanup_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "external_cleanup_error_code" VARCHAR(100),
  ADD COLUMN "external_cleanup_completed_at" TIMESTAMP(3);

ALTER TABLE "organization_membership"
  ADD COLUMN "external_cleanup_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "external_cleanup_error_code" VARCHAR(100),
  ADD COLUMN "external_cleanup_completed_at" TIMESTAMP(3);

CREATE INDEX "organization_membership_cleanup_required_idx"
  ON "organization_membership"("updated_at")
  WHERE "external_cleanup_required" = true;

DO $$
BEGIN
  IF to_regclass('organization_membership_invitation') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "organization_membership_invitation_cleanup_required_idx"
      ON "organization_membership_invitation"("updated_at")
      WHERE "external_cleanup_required" = true';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "organization_membership_invitation_id_org_key"
      ON "organization_membership_invitation"("id", "organization_id")';
  END IF;
  IF to_regclass('organization_provisioning_outbox') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "organization_provisioning_outbox_invitation_org_key"
      ON "organization_provisioning_outbox"("invitation_id", "organization_id")';
  END IF;
END $$;

ALTER TABLE IF EXISTS "organization_provisioning_outbox"
  ADD CONSTRAINT "organization_provisioning_outbox_invitation_org_fkey"
  FOREIGN KEY ("invitation_id", "organization_id")
  REFERENCES "organization_membership_invitation"("id", "organization_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- A domain Carer must never be shared by two simultaneously active workforce
-- identities. Fail closed if legacy data violates the invariant; do not repair
-- or delete production data in a schema migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "organization_membership"
    WHERE "status" = 'ACTIVE'
      AND "revoked_at" IS NULL
      AND "carer_id" IS NOT NULL
    GROUP BY "organization_id", "carer_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple active organization memberships link the same Carer';
  END IF;
END $$;

CREATE UNIQUE INDEX "organization_membership_one_active_carer_key"
  ON "organization_membership"("organization_id", "carer_id")
  WHERE "status" = 'ACTIVE'
    AND "revoked_at" IS NULL
    AND "carer_id" IS NOT NULL;
