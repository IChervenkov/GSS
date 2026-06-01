SET search_path TO app, public;

INSERT INTO app.camps (name)
VALUES ('Demo Camp')
ON CONFLICT (name) DO NOTHING;
