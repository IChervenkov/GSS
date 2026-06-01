SET search_path TO app, public;

ALTER TABLE IF EXISTS app.helmets
  ADD COLUMN IF NOT EXISTS nfc_code text;

UPDATE app.helmets
   SET nfc_code = id::text
 WHERE nfc_code IS NULL
    OR btrim(nfc_code) = '';

ALTER TABLE IF EXISTS app.helmets
  ALTER COLUMN nfc_code SET NOT NULL;

ALTER TABLE IF EXISTS app.helmets DROP CONSTRAINT IF EXISTS chk_helmets_nfc_code;
ALTER TABLE IF EXISTS app.helmets ADD CONSTRAINT chk_helmets_nfc_code CHECK (
  nfc_code ~ '[[:alnum:]]' AND nfc_code ~ '^[[:alnum:]_:.-]{2,128}$'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_helmets_nfc_code_lower
  ON app.helmets (LOWER(nfc_code));

INSERT INTO app.permissions (name)
VALUES
  ('Add helmet'),
  ('Edit helmet'),
  ('Remove helmet')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app.permissions (name)
VALUES ('Download bicycle app')
ON CONFLICT (name) DO NOTHING;
