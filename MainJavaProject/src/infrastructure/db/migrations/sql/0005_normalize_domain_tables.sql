SET search_path TO app, public;

DO $$
BEGIN
  IF to_regclass('app.build_rooms') IS NOT NULL AND to_regclass('app.building_rooms') IS NULL THEN
    EXECUTE 'ALTER TABLE app.build_rooms RENAME TO building_rooms';
  END IF;

  IF to_regclass('app.rooms_keys') IS NOT NULL AND to_regclass('app.room_keys') IS NULL THEN
    EXECUTE 'ALTER TABLE app.rooms_keys RENAME TO room_keys';
  END IF;

  IF to_regclass('app.bike_soldier') IS NOT NULL AND to_regclass('app.bicycle_assignments') IS NULL THEN
    EXECUTE 'ALTER TABLE app.bike_soldier RENAME TO bicycle_assignments';
  END IF;

  IF to_regclass('app.move_soldier') IS NOT NULL AND to_regclass('app.soldier_moves') IS NULL THEN
    EXECUTE 'ALTER TABLE app.move_soldier RENAME TO soldier_moves';
  END IF;

  IF to_regclass('app.users_monitoring') IS NOT NULL AND to_regclass('app.user_monitoring_events') IS NULL THEN
    EXECUTE 'ALTER TABLE app.users_monitoring RENAME TO user_monitoring_events';
  END IF;

  IF to_regclass('app.laundry_report') IS NOT NULL AND to_regclass('app.laundry_reports') IS NULL THEN
    EXECUTE 'ALTER TABLE app.laundry_report RENAME TO laundry_reports';
  END IF;

  IF to_regclass('app.assets_type') IS NOT NULL AND to_regclass('app.asset_types') IS NULL THEN
    EXECUTE 'ALTER TABLE app.assets_type RENAME TO asset_types';
  END IF;

  IF to_regclass('app.additional_item') IS NOT NULL AND to_regclass('app.additional_items') IS NULL THEN
    EXECUTE 'ALTER TABLE app.additional_item RENAME TO additional_items';
  END IF;

  IF to_regclass('app.clear_item') IS NOT NULL AND to_regclass('app.clean_items') IS NULL THEN
    EXECUTE 'ALTER TABLE app.clear_item RENAME TO clean_items';
  END IF;

  IF to_regclass('app.clean_item_traceability') IS NOT NULL AND to_regclass('app.clean_item_events') IS NULL THEN
    EXECUTE 'ALTER TABLE app.clean_item_traceability RENAME TO clean_item_events';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'camps' AND column_name = 'camp_name')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'camps' AND column_name = 'name') THEN
    ALTER TABLE app.camps RENAME COLUMN camp_name TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'buildings' AND column_name = 'name_building')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'buildings' AND column_name = 'name') THEN
    ALTER TABLE app.buildings RENAME COLUMN name_building TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'rooms' AND column_name = 'name_room')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'rooms' AND column_name = 'name') THEN
    ALTER TABLE app.rooms RENAME COLUMN name_room TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'keys' AND column_name = 'name_key')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'keys' AND column_name = 'name') THEN
    ALTER TABLE app.keys RENAME COLUMN name_key TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'soldiers' AND column_name = 'name_soldier')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'soldiers' AND column_name = 'name') THEN
    ALTER TABLE app.soldiers RENAME COLUMN name_soldier TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'bicycles' AND column_name = 'name_bike')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'bicycles' AND column_name = 'name') THEN
    ALTER TABLE app.bicycles RENAME COLUMN name_bike TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'asset_types' AND column_name = 'type_name')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'asset_types' AND column_name = 'name') THEN
    ALTER TABLE app.asset_types RENAME COLUMN type_name TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'assets' AND column_name = 'name_assets')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'assets' AND column_name = 'name') THEN
    ALTER TABLE app.assets RENAME COLUMN name_assets TO name;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'assets' AND column_name = 'create_date')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'assets' AND column_name = 'created_at') THEN
    ALTER TABLE app.assets RENAME COLUMN create_date TO created_at;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'asset_actions' AND column_name = 'date_change')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'asset_actions' AND column_name = 'changed_at') THEN
    ALTER TABLE app.asset_actions RENAME COLUMN date_change TO changed_at;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'soldier_moves' AND column_name = 'date_move')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'soldier_moves' AND column_name = 'moved_at') THEN
    ALTER TABLE app.soldier_moves RENAME COLUMN date_move TO moved_at;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'user_monitoring_events' AND column_name = 'accept_date')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'user_monitoring_events' AND column_name = 'created_at') THEN
    ALTER TABLE app.user_monitoring_events RENAME COLUMN accept_date TO created_at;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'additional_items' AND column_name = 'bag_id')
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app' AND table_name = 'additional_items' AND column_name = 'laundry_bag_id') THEN
    ALTER TABLE app.additional_items RENAME COLUMN bag_id TO laundry_bag_id;
  END IF;
END $$;
