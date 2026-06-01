SET search_path TO app, public;

INSERT INTO app.permissions (name)
VALUES
  ('Add laundry bag'),
  ('Edit laundry bag'),
  ('Remove laundry bag'),
  ('Save laundry status')
ON CONFLICT (name) DO NOTHING;
