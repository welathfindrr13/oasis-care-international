-- Add an explicit, nullable identity link without rewriting existing Carer or Visit keys.
ALTER TABLE "organization_membership"
ADD COLUMN "carer_id" TEXT;

-- The composite key allows the foreign key below to enforce tenant equality.
CREATE UNIQUE INDEX "carer_organization_id_id_key"
ON "carer"("organization_id", "id");

CREATE INDEX "organization_membership_organization_id_carer_id_idx"
ON "organization_membership"("organization_id", "carer_id");

ALTER TABLE "organization_membership"
ADD CONSTRAINT "organization_membership_organization_id_carer_id_fkey"
FOREIGN KEY ("organization_id", "carer_id")
REFERENCES "carer"("organization_id", "id")
ON DELETE RESTRICT
ON UPDATE RESTRICT;
