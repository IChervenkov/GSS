SET search_path TO app, public;

INSERT INTO app.permissions (name)
VALUES
  ('Accommodation and keys'),
  ('Add destination'),
  ('Edit destination'),
  ('Remove destination'),
  ('Add room'),
  ('Edit room'),
  ('Remove room'),
  ('Add key'),
  ('Reload keys'),
  ('Remove keys')
ON CONFLICT (name) DO NOTHING;
