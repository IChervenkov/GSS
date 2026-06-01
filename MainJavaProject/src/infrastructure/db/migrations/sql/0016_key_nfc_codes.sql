SET search_path TO app, public;

ALTER TABLE IF EXISTS app.keys
  ADD COLUMN IF NOT EXISTS nfc_code text;

UPDATE app.keys
   SET nfc_code = id::text
 WHERE nfc_code IS NULL
    OR btrim(nfc_code) = '';

ALTER TABLE IF EXISTS app.keys
  ALTER COLUMN nfc_code SET NOT NULL;

ALTER TABLE IF EXISTS app.keys DROP CONSTRAINT IF EXISTS chk_keys_nfc_code;
ALTER TABLE IF EXISTS app.keys ADD CONSTRAINT chk_keys_nfc_code CHECK (
  nfc_code ~ '[[:alnum:]]' AND nfc_code ~ '^[[:alnum:]_:.-]{2,128}$'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_keys_nfc_code_lower
  ON app.keys (LOWER(nfc_code));
