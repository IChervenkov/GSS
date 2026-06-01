SET search_path TO app, public;

INSERT INTO app.permissions (name)
VALUES ('Download assets app')
ON CONFLICT (name) DO NOTHING;
