SET search_path TO app, public;

INSERT INTO app.permissions (name)
VALUES ('Download laundry app')
ON CONFLICT (name) DO NOTHING;
