SET search_path TO app, public;

INSERT INTO app.permissions (name)
VALUES
  ('Asset management'),
  ('Assets'),
  ('Add asset'),
  ('Edit asset'),
  ('Remove asset'),
  ('Save inventory'),
  ('Add asset type'),
  ('Edit asset type'),
  ('Remove asset type'),
  ('Add clean item'),
  ('Edit clean item'),
  ('Move clean item'),
  ('Remove clean item'),
  ('Laundry'),
  ('Add laundry bag'),
  ('Edit laundry bag'),
  ('Remove laundry bag'),
  ('Save laundry status'),
  ('Download laundry app'),
  ('Download bicycle app'),
  ('Download assets app')
ON CONFLICT (name) DO NOTHING;
