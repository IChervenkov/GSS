SET search_path TO app, public;

ALTER TABLE IF EXISTS app.additional_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO app.permissions (name)
VALUES
  ('Add soldier'),
  ('Edit soldier'),
  ('Remove soldier'),
  ('Manage accommodation'),
  ('Add additional item'),
  ('Edit additional item'),
  ('Remove additional item')
ON CONFLICT (name) DO NOTHING;
