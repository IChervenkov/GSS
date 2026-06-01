SET search_path TO app, public;

ALTER TABLE IF EXISTS app.assets
  ADD COLUMN IF NOT EXISTS rfid_code text,
  ADD COLUMN IF NOT EXISTS is_quantity boolean;

UPDATE app.assets
   SET rfid_code = id::text
 WHERE rfid_code IS NULL
    OR btrim(rfid_code) = '';

UPDATE app.assets
   SET is_quantity = CASE
     WHEN replace(COALESCE(quantity, ''), ',', '.') ~ '^[[:space:]]*[[:digit:]]+(\.[[:digit:]]+)?[[:space:]]*$'
       THEN replace(quantity, ',', '.')::numeric > 1
     ELSE false
   END
 WHERE is_quantity IS NULL;

UPDATE app.assets
   SET quantity = '1'
 WHERE COALESCE(is_quantity, false) = false;

ALTER TABLE IF EXISTS app.assets
  ALTER COLUMN rfid_code SET NOT NULL,
  ALTER COLUMN is_quantity SET NOT NULL,
  ALTER COLUMN is_quantity SET DEFAULT false;

ALTER TABLE IF EXISTS app.assets DROP CONSTRAINT IF EXISTS chk_assets_rfid_code;
ALTER TABLE IF EXISTS app.assets ADD CONSTRAINT chk_assets_rfid_code CHECK (
  rfid_code ~ '[[:alnum:]]' AND rfid_code ~ '^[[:alnum:]_:.-]{2,128}$'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_rfid_code_camp_lower
  ON app.assets (camp_id, LOWER(rfid_code));

CREATE INDEX IF NOT EXISTS idx_assets_is_quantity_camp_id
  ON app.assets(camp_id, is_quantity);
