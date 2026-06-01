DO $$
DECLARE
  constraint_record record;
BEGIN
  IF to_regclass('app.assets') IS NULL OR to_regclass('app.asset_types') IS NULL THEN
    RETURN;
  END IF;

  FOR constraint_record IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace rel_ns ON rel_ns.oid = rel.relnamespace
      JOIN pg_class ref ON ref.oid = con.confrelid
      JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
     WHERE con.contype = 'f'
       AND rel_ns.nspname = 'app'
       AND rel.relname = 'assets'
       AND ref_ns.nspname = 'app'
       AND ref.relname = 'asset_types'
       AND EXISTS (
         SELECT 1
           FROM unnest(con.conkey) WITH ORDINALITY AS key(attnum, ordinality)
           JOIN pg_attribute attr
             ON attr.attrelid = con.conrelid
            AND attr.attnum = key.attnum
          WHERE attr.attname = 'type_id'
       )
  LOOP
    EXECUTE format('ALTER TABLE app.assets DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;

  ALTER TABLE app.assets
    ADD CONSTRAINT fk_assets_type_id_asset_types
    FOREIGN KEY (type_id)
    REFERENCES app.asset_types(id)
    ON DELETE RESTRICT;
END;
$$;
