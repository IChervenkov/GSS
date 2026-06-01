SET search_path TO app, public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM app.additional_items
     WHERE laundry_bag_id IS NOT NULL
     GROUP BY laundry_bag_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate additional item laundry bag links exist. Resolve duplicate app.additional_items.laundry_bag_id rows before applying migration 0022.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_additional_items_laundry_bag_id
  ON app.additional_items (laundry_bag_id)
  WHERE laundry_bag_id IS NOT NULL;
