SET search_path TO app, public;

ALTER TABLE IF EXISTS app.camps
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.users
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.buildings
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.rooms
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.keys
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.soldiers
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.bicycles
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.laundry_bags
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.assets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.user_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.asset_actions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.clean_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS app.clean_item_events
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS app.camps ALTER COLUMN name SET NOT NULL;
ALTER TABLE IF EXISTS app.users ALTER COLUMN username SET NOT NULL;
ALTER TABLE IF EXISTS app.buildings ALTER COLUMN name SET NOT NULL;
ALTER TABLE IF EXISTS app.rooms ALTER COLUMN name SET NOT NULL;
ALTER TABLE IF EXISTS app.keys ALTER COLUMN name SET NOT NULL;
ALTER TABLE IF EXISTS app.soldiers ALTER COLUMN name SET NOT NULL;
ALTER TABLE IF EXISTS app.bicycles ALTER COLUMN name SET NOT NULL;
ALTER TABLE IF EXISTS app.assets ALTER COLUMN code SET NOT NULL;
ALTER TABLE IF EXISTS app.clean_items ALTER COLUMN item_name SET NOT NULL;

ALTER TABLE IF EXISTS app.user_monitoring_events
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS app.laundry_reports
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS app.soldier_moves
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

DO $$
BEGIN
  IF to_regclass('app.user_monitoring_events') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pk_user_monitoring_events' AND conrelid = 'app.user_monitoring_events'::regclass
  ) THEN
    ALTER TABLE app.user_monitoring_events ADD CONSTRAINT pk_user_monitoring_events PRIMARY KEY (id);
  END IF;

  IF to_regclass('app.laundry_reports') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pk_laundry_reports' AND conrelid = 'app.laundry_reports'::regclass
  ) THEN
    ALTER TABLE app.laundry_reports ADD CONSTRAINT pk_laundry_reports PRIMARY KEY (id);
  END IF;

  IF to_regclass('app.soldier_moves') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pk_soldier_moves' AND conrelid = 'app.soldier_moves'::regclass
  ) THEN
    ALTER TABLE app.soldier_moves ADD CONSTRAINT pk_soldier_moves PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE IF EXISTS app.soldiers DROP CONSTRAINT IF EXISTS fk_soldiers_used_used_key_key;

DO $$
BEGIN
  IF to_regclass('app.soldiers') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_soldiers_used_key' AND conrelid = 'app.soldiers'::regclass
  ) THEN
    ALTER TABLE app.soldiers
      ADD CONSTRAINT fk_soldiers_used_key
      FOREIGN KEY (used_key) REFERENCES app.keys(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('app.camps') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app.camps'::regclass AND conname IN ('uq_camps_name', 'uq_camps_camp_name')
  ) THEN
    ALTER TABLE app.camps ADD CONSTRAINT uq_camps_name UNIQUE (name);
  END IF;

  IF to_regclass('app.buildings') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app.buildings'::regclass AND conname = 'uq_buildings_name_camp'
  ) THEN
    ALTER TABLE app.buildings ADD CONSTRAINT uq_buildings_name_camp UNIQUE (camp_id, name);
  END IF;

  IF to_regclass('app.rooms') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app.rooms'::regclass AND conname = 'uq_rooms_name_camp'
  ) THEN
    ALTER TABLE app.rooms ADD CONSTRAINT uq_rooms_name_camp UNIQUE (camp_id, name);
  END IF;

  IF to_regclass('app.keys') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app.keys'::regclass AND conname = 'uq_keys_name_camp'
  ) THEN
    ALTER TABLE app.keys ADD CONSTRAINT uq_keys_name_camp UNIQUE (camp_id, name);
  END IF;

  IF to_regclass('app.soldiers') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app.soldiers'::regclass AND conname = 'uq_soldiers_name_camp'
  ) THEN
    ALTER TABLE app.soldiers ADD CONSTRAINT uq_soldiers_name_camp UNIQUE (camp_id, name);
  END IF;

  IF to_regclass('app.bicycles') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app.bicycles'::regclass AND conname = 'uq_bicycles_name_camp'
  ) THEN
    ALTER TABLE app.bicycles ADD CONSTRAINT uq_bicycles_name_camp UNIQUE (camp_id, name);
  END IF;

  IF to_regclass('app.asset_types') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'app.asset_types'::regclass AND conname IN ('uq_asset_types_name', 'assets_type_type_name_key')
  ) THEN
    ALTER TABLE app.asset_types ADD CONSTRAINT uq_asset_types_name UNIQUE (name);
  END IF;
END $$;


ALTER TABLE IF EXISTS app.user_requests DROP CONSTRAINT IF EXISTS chk_user_requests_expiry;
ALTER TABLE IF EXISTS app.user_requests ADD CONSTRAINT chk_user_requests_expiry CHECK (expires_at > created_at);

ALTER TABLE IF EXISTS app.soldiers DROP CONSTRAINT IF EXISTS chk_soldiers_schedule;
ALTER TABLE IF EXISTS app.soldiers ADD CONSTRAINT chk_soldiers_schedule CHECK (
  date_free IS NULL OR date_accommodation IS NULL OR date_free >= date_accommodation
);

ALTER TABLE IF EXISTS app.assets DROP CONSTRAINT IF EXISTS chk_assets_inventory_status;
ALTER TABLE IF EXISTS app.assets ADD CONSTRAINT chk_assets_inventory_status CHECK (inventory_status IN ('undiscovered', 'completed', 'written_off'));
ALTER TABLE IF EXISTS app.bicycles DROP CONSTRAINT IF EXISTS chk_bicycles_status;
ALTER TABLE IF EXISTS app.bicycles ADD CONSTRAINT chk_bicycles_status CHECK (status IS NULL OR status IN ('rented', 'available', 'repair', 'late', 'long_term'));
ALTER TABLE IF EXISTS app.laundry_bags DROP CONSTRAINT IF EXISTS chk_laundry_bags_status;
ALTER TABLE IF EXISTS app.laundry_bags ADD CONSTRAINT chk_laundry_bags_status CHECK (status IS NULL OR status IN ('drop_off', 'laundry_facility', 'ready_to_pick_up', 'pick_up'));

CREATE INDEX IF NOT EXISTS idx_failed_logins_block_expires_at ON app.failed_logins(block_expires_at);
CREATE INDEX IF NOT EXISTS idx_camps_name ON app.camps(name);
CREATE INDEX IF NOT EXISTS idx_buildings_camp_id_name ON app.buildings(camp_id, name);
CREATE INDEX IF NOT EXISTS idx_rooms_camp_id_name ON app.rooms(camp_id, name);
CREATE INDEX IF NOT EXISTS idx_keys_camp_id_name ON app.keys(camp_id, name);
CREATE INDEX IF NOT EXISTS idx_soldiers_camp_id_name ON app.soldiers(camp_id, name);
CREATE INDEX IF NOT EXISTS idx_soldiers_used_key ON app.soldiers(used_key);
CREATE INDEX IF NOT EXISTS idx_soldiers_upcoming_key ON app.soldiers(upcoming_accommodation_key);
CREATE INDEX IF NOT EXISTS idx_laundry_bags_status_camp_id ON app.laundry_bags(camp_id, status);
CREATE INDEX IF NOT EXISTS idx_bicycle_assignments_soldier_id_date_from ON app.bicycle_assignments(soldier_id, date_from DESC);
CREATE INDEX IF NOT EXISTS idx_bicycle_assignments_bike_id_date_from ON app.bicycle_assignments(bike_id, date_from DESC);
CREATE INDEX IF NOT EXISTS idx_laundry_reports_bag_id ON app.laundry_reports(bag_id);
CREATE INDEX IF NOT EXISTS idx_assets_code_camp_id ON app.assets(camp_id, code);
CREATE INDEX IF NOT EXISTS idx_assets_inventory_status_camp_id ON app.assets(camp_id, inventory_status);
CREATE INDEX IF NOT EXISTS idx_assets_last_inventory_date ON app.assets(last_inventory_date);
CREATE INDEX IF NOT EXISTS idx_clean_items_camp_id_name ON app.clean_items(camp_id, item_name);
CREATE INDEX IF NOT EXISTS idx_clean_item_events_camp_id_created_at ON app.clean_item_events(camp_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_status_code ON app.security_audit_logs(status_code);
