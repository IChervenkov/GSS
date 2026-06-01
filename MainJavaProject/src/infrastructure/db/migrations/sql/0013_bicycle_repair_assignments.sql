SET search_path TO app, public;

ALTER TABLE IF EXISTS app.bicycle_assignments
  ALTER COLUMN soldier_id DROP NOT NULL;

ALTER TABLE IF EXISTS app.bicycle_assignments
  DROP CONSTRAINT IF EXISTS chk_bicycle_assignments_repair_soldier;

ALTER TABLE IF EXISTS app.bicycle_assignments
  ADD CONSTRAINT chk_bicycle_assignments_repair_soldier CHECK (
    soldier_id IS NOT NULL OR status_bike = 'repair'
  );

UPDATE app.bicycle_assignments ba
   SET status_bike = 'repair'
  FROM app.bicycles b
 WHERE b.id = ba.bike_id
   AND ba.date_to IS NULL
   AND COALESCE(NULLIF(b.status, ''), 'available') = 'repair';

INSERT INTO app.bicycle_assignments (bike_id, soldier_id, helmet_id, date_from, status_bike)
SELECT
  b.id,
  NULL,
  NULL,
  COALESCE(b.updated_at, b.created_at, NOW()),
  'repair'
FROM app.bicycles b
WHERE COALESCE(NULLIF(b.status, ''), 'available') = 'repair'
  AND NOT EXISTS (
    SELECT 1
      FROM app.bicycle_assignments ba
     WHERE ba.bike_id = b.id
       AND ba.date_to IS NULL
  );
