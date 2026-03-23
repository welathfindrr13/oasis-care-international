ALTER TABLE "medication_administration"
ADD COLUMN "instruction_snapshot" TEXT;

UPDATE "medication_administration" AS ma
SET "instruction_snapshot" = COALESCE(p."special_instructions", m."instructions")
FROM "prescription" AS p
JOIN "medication" AS m
  ON m."id" = p."medication_id"
WHERE ma."prescription_id" = p."id"
  AND ma."instruction_snapshot" IS NULL;
