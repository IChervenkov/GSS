ALTER TABLE IF EXISTS app.clean_items
  ADD COLUMN IF NOT EXISTS warehouse text NOT NULL DEFAULT 'large';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'app'
       AND table_name = 'clean_item_events'
       AND column_name = 'date_change'
  )
  AND NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'app'
       AND table_name = 'clean_item_events'
       AND column_name = 'changed_at'
  ) THEN
    ALTER TABLE app.clean_item_events RENAME COLUMN date_change TO changed_at;
  END IF;
END $$;

UPDATE app.clean_items
   SET warehouse = 'large'
 WHERE warehouse IS NULL
    OR warehouse NOT IN ('large', 'small');

ALTER TABLE IF EXISTS app.clean_items
  DROP CONSTRAINT IF EXISTS uq_clear_item_name_camp,
  DROP CONSTRAINT IF EXISTS uq_clean_items_name_camp,
  DROP CONSTRAINT IF EXISTS uq_clean_items_name_camp_warehouse,
  ADD CONSTRAINT uq_clean_items_name_camp_warehouse UNIQUE (item_name, camp_id, warehouse);

ALTER TABLE IF EXISTS app.clean_items
  DROP CONSTRAINT IF EXISTS chk_clean_items_warehouse,
  ADD CONSTRAINT chk_clean_items_warehouse CHECK (warehouse IN ('large', 'small'));

CREATE INDEX IF NOT EXISTS idx_clean_items_camp_id_warehouse_name
  ON app.clean_items(camp_id, warehouse, item_name);
