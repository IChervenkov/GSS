SET search_path TO app, public;

ALTER TABLE IF EXISTS app.laundry_bags
  ADD COLUMN IF NOT EXISTS rfid_code text;

UPDATE app.laundry_bags
   SET rfid_code = id::text
 WHERE rfid_code IS NULL
    OR btrim(rfid_code) = '';

ALTER TABLE IF EXISTS app.laundry_bags
  ALTER COLUMN rfid_code SET NOT NULL;

ALTER TABLE IF EXISTS app.laundry_bags DROP CONSTRAINT IF EXISTS chk_laundry_bags_rfid_code;
ALTER TABLE IF EXISTS app.laundry_bags ADD CONSTRAINT chk_laundry_bags_rfid_code CHECK (
  rfid_code ~ '[[:alnum:]]' AND rfid_code ~ '^[[:alnum:]_:.-]{2,128}$'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_laundry_bags_rfid_code_lower
  ON app.laundry_bags (LOWER(rfid_code));
