SET search_path TO app, public;

ALTER TABLE IF EXISTS app.bicycles
  ADD COLUMN IF NOT EXISTS nfc_code text;

UPDATE app.bicycles
   SET nfc_code = id::text
 WHERE nfc_code IS NULL
    OR btrim(nfc_code) = '';

ALTER TABLE IF EXISTS app.bicycles
  ALTER COLUMN nfc_code SET NOT NULL;

ALTER TABLE IF EXISTS app.bicycles DROP CONSTRAINT IF EXISTS chk_bicycles_nfc_code;
ALTER TABLE IF EXISTS app.bicycles ADD CONSTRAINT chk_bicycles_nfc_code CHECK (
  nfc_code ~ '[[:alnum:]]' AND nfc_code ~ '^[[:alnum:]_:.-]{2,128}$'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bicycles_nfc_code_lower
  ON app.bicycles (LOWER(nfc_code));

CREATE INDEX IF NOT EXISTS idx_bicycles_camp_status
  ON app.bicycles(camp_id, status);

CREATE INDEX IF NOT EXISTS idx_bicycle_assignments_active_bike
  ON app.bicycle_assignments(bike_id)
  WHERE date_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_bicycle_assignments_active_helmet
  ON app.bicycle_assignments(helmet_id)
  WHERE date_to IS NULL AND helmet_id IS NOT NULL;

INSERT INTO app.permissions (name)
VALUES
  ('Bicycles'),
  ('Add bike'),
  ('Edit bike'),
  ('Remove bike'),
  ('Save bike status')
ON CONFLICT (name) DO NOTHING;
