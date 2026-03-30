DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        prescription_id,
        scheduled_time
      FROM medication_administration
      WHERE deleted_at IS NULL
      GROUP BY prescription_id, scheduled_time
      HAVING COUNT(*) > 1
        AND (
          COUNT(*) FILTER (WHERE status <> 'SCHEDULED') > 0
          OR COUNT(*) FILTER (
            WHERE notes IS NOT NULL
              AND btrim(notes) <> ''
          ) > 0
          OR COUNT(*) FILTER (WHERE administered_time IS NOT NULL) > 0
          OR COUNT(*) FILTER (WHERE administered_by IS NOT NULL) > 0
          OR COUNT(DISTINCT COALESCE(visit_id::text, '')) > 1
        )
    ) conflicting_duplicates
  ) THEN
    RAISE EXCEPTION
      'Conflicting duplicate medication_administration rows exist for the same prescription and scheduled_time. Resolve manually before applying this migration.';
  END IF;
END $$;

WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY prescription_id, scheduled_time
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM medication_administration
  WHERE deleted_at IS NULL
    AND status = 'SCHEDULED'
)
DELETE FROM medication_administration
WHERE id IN (
  SELECT id
  FROM ranked_duplicates
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS medication_administration_prescription_scheduled_active_key
  ON medication_administration (prescription_id, scheduled_time)
  WHERE deleted_at IS NULL;
