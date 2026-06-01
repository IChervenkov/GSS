SET search_path TO app, public;

ALTER TABLE IF EXISTS app.users
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
