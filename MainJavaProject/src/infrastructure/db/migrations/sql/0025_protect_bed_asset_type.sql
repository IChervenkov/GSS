INSERT INTO app.asset_types (name)
VALUES ('Bed')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION app.prevent_bed_asset_type_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(OLD.name) = 'bed' THEN
    RAISE EXCEPTION 'The Bed asset type cannot be changed or deleted.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_bed_asset_type_change ON app.asset_types;
CREATE TRIGGER trg_prevent_bed_asset_type_change
BEFORE UPDATE OR DELETE ON app.asset_types
FOR EACH ROW
EXECUTE FUNCTION app.prevent_bed_asset_type_change();
