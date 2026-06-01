SET search_path TO app, public;

INSERT INTO app.permissions (name)
VALUES ('Laundry')
ON CONFLICT (name) DO NOTHING;
