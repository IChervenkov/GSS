BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;
SET search_path TO app, public;

CREATE TABLE IF NOT EXISTS camps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_name    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_camps_camp_name UNIQUE (camp_name)
);

CREATE TABLE IF NOT EXISTS users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username           text NOT NULL,
  password           text,
  totp_secret        text,
  temporary_password text,
  CONSTRAINT uq_users_username UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS failed_logins (
  username         text NOT NULL,
  ip_address       inet NOT NULL,
  failed_attempts  int  NOT NULL DEFAULT 0,
  block_expires_at timestamptz,
  PRIMARY KEY (username, ip_address),
  CONSTRAINT chk_failed_attempts_nonneg CHECK (failed_attempts >= 0)
);

CREATE TABLE IF NOT EXISTS users_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL UNIQUE,
  device_id     text NOT NULL,
  device_name   text,
  ip_address    inet,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked       boolean NOT NULL DEFAULT false,
  CONSTRAINT chk_session_expiry CHECK (expires_at > created_at)
);

CREATE TABLE users_requests (
    request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
	request_type text NOT NULL DEFAULT 'generic',
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	decided_at timestamptz,
	decided_by uuid,
    CONSTRAINT fk_password_change_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT status_valid
      CHECK (status IN ('pending', 'approved', 'denied', 'expired'))
);

CREATE TABLE IF NOT EXISTS app.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  req_id text,
  actor_user_id uuid,
  pending_user_id uuid,
  target_user_id uuid,
  approver_user_id uuid,
  ip_address text,
  user_agent text,
  request_method text,
  request_path text,
  status_code integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS helmets (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code    text NOT NULL,
  camp_id uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT uq_helmets_code_camp UNIQUE (code, camp_id)
);

CREATE TABLE IF NOT EXISTS buildings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_building    text NOT NULL,
  type             text,
  camp_id          uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT uq_buildings_name_camp UNIQUE (name_building, camp_id)
);

CREATE TABLE IF NOT EXISTS rooms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_room        text NOT NULL,
  camp_id          uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT uq_rooms_name_camp UNIQUE (name_room, camp_id)
);

CREATE TABLE IF NOT EXISTS keys (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key   text NOT NULL,
  soldier_id uuid,
  camp_id    uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT uq_keys_name_camp UNIQUE (name_key, camp_id)
);

CREATE TABLE IF NOT EXISTS rooms_keys (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  key_id  uuid NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, key_id)
);

CREATE TABLE IF NOT EXISTS build_rooms (
  build_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  room_id  uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  PRIMARY KEY (build_id, room_id)
);

CREATE TABLE IF NOT EXISTS soldiers (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_soldier                text NOT NULL,
  country                     text,
  date_accommodation           timestamptz,
  date_free                    timestamptz,
  meal_card                    text,
  laundry_bag_id               uuid,         -- ще го вържем след като създадем laundry_bags
  used_key                     uuid,         -- логически това е key_id (както при update-а ти)
  camp_id                      uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  upcoming_accommodation       date,
  upcoming_release             date,
  upcoming_accommodation_key   uuid,
  CONSTRAINT uq_soldiers_name_camp UNIQUE (name_soldier, camp_id)
);

ALTER TABLE keys
  ADD CONSTRAINT fk_keys_soldier
  FOREIGN KEY (soldier_id) REFERENCES soldiers(id) ON DELETE SET NULL;

ALTER TABLE soldiers
  ADD CONSTRAINT fk_soldiers_upcoming_key
  FOREIGN KEY (upcoming_accommodation_key) REFERENCES keys(id) ON DELETE SET NULL;

ALTER TABLE soldiers
  ADD CONSTRAINT fk_soldiers_used_key_key
  FOREIGN KEY (used_key) REFERENCES keys(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS bicycles (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bike text NOT NULL,
  status   text,
  camp_id  uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT uq_bicycles_name_camp UNIQUE (name_bike, camp_id)
);

CREATE TABLE IF NOT EXISTS laundry_bags (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                                text NOT NULL,
  type                                text,
  status                              text,
  laundry_count                       bigint NOT NULL DEFAULT 0,
  max_count_laundry                   int    NOT NULL DEFAULT 1,
  soldier_id                          uuid REFERENCES soldiers(id) ON DELETE SET NULL,
  camp_id                             uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT uq_laundry_bags_code_camp UNIQUE (code, camp_id),
  CONSTRAINT chk_laundry_nonneg CHECK (
    laundry_count >= 0 AND
    max_count_laundry >= 1
  )
);


ALTER TABLE soldiers
  ADD CONSTRAINT fk_soldiers_laundry_bag
  FOREIGN KEY (laundry_bag_id) REFERENCES laundry_bags(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS bike_soldier (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id     uuid NOT NULL REFERENCES bicycles(id) ON DELETE CASCADE,
  soldier_id  uuid NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  date_from   timestamptz,
  date_to     timestamptz,
  status_bike text,
  helmet_id   uuid REFERENCES helmets(id) ON DELETE SET NULL,
  CONSTRAINT chk_bike_dates CHECK (date_to IS NULL OR date_from IS NULL OR date_to >= date_from)
);

CREATE TABLE IF NOT EXISTS move_soldier (
  id_new_key     uuid REFERENCES keys(id) ON DELETE SET NULL,
  id_prev_key    uuid REFERENCES keys(id) ON DELETE SET NULL,
  id_soldier     uuid REFERENCES soldiers(id) ON DELETE CASCADE,
  date_move      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users_monitoring (
  username    text NOT NULL,
  location    text,
  accept_date timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laundry_report (
  bag_id               uuid NOT NULL REFERENCES laundry_bags(id) ON DELETE CASCADE,
  date_drop_off        timestamptz,
  date_ready_to_pick_up timestamptz,
  soldier_id           uuid REFERENCES soldiers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assets_type (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               text NOT NULL,
  name_assets        text,
  type_id            uuid REFERENCES assets_type(id) ON DELETE SET NULL,
  location_room      uuid REFERENCES rooms(id) ON DELETE SET NULL,
  location_key       uuid REFERENCES keys(id) ON DELETE SET NULL,
  category           text,
  quantity           text,
  mrah               text,
  asset_owner        text,
  status             text,
  expandable         text,
  description        text,
  camp_id            uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  inventory_status   text NOT NULL DEFAULT 'undiscovered',
  create_date        timestamptz NOT NULL DEFAULT now(),
  last_inventory_date timestamptz,
  service            text,
  m2_inside          text,
  is_fixed           boolean,
  date_purchase      timestamptz,
  date_written_off   timestamptz,
  purchase_price     text,
  comments           text,
  replaced_off       text,
  year_of_life_cycle text,
  rest_of_life_cycle text,
  replaced_by        text,
  rest_value         text,
  is_quantity        boolean,
  CONSTRAINT uq_assets_code_camp UNIQUE (code, camp_id)
);

CREATE TABLE IF NOT EXISTS asset_actions (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_change                  date NOT NULL DEFAULT current_date,
  change_asset_quantity        text,
  change_remove_asset_quantity text,
  change_lost_asset_quantity   text,
  change_modificate_asset_quantity text,
  camp_id                      uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS additional_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soldier_id  uuid NOT NULL REFERENCES soldiers(id) ON DELETE CASCADE,
  description text,
  bag_id      uuid REFERENCES laundry_bags(id) ON DELETE SET NULL,
  quantity    text
);

CREATE TABLE IF NOT EXISTS clear_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     text NOT NULL,
  total_amount  numeric NOT NULL DEFAULT 0,
  count_get_item numeric NOT NULL DEFAULT 0,
  camp_id       uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  CONSTRAINT uq_clear_item_name_camp UNIQUE (item_name, camp_id),
  CONSTRAINT chk_clear_item_nonneg CHECK (total_amount >= 0 AND count_get_item >= 0)
);

CREATE TABLE IF NOT EXISTS clean_item_traceability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name   text,
  amount      numeric,
  date_change timestamptz,
  description text,
  camp_id     uuid NOT NULL REFERENCES camps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permission (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users_permission (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perm_id uuid NOT NULL REFERENCES permission(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, perm_id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE INDEX IF NOT EXISTS idx_sessions_users_id ON users_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON users_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_users_sessions_active ON users_sessions(user_id, revoked, expires_at);

CREATE INDEX IF NOT EXISTS idx_soldiers_camp_id ON soldiers(camp_id);
CREATE INDEX IF NOT EXISTS idx_soldiers_date_accommodation ON soldiers(date_accommodation);

CREATE INDEX IF NOT EXISTS idx_keys_camp_id ON keys(camp_id);
CREATE INDEX IF NOT EXISTS idx_keys_soldier_id ON keys(soldier_id);

CREATE INDEX IF NOT EXISTS idx_rooms_camp_id ON rooms(camp_id);
CREATE INDEX IF NOT EXISTS idx_buildings_camp_id ON buildings(camp_id);

CREATE INDEX IF NOT EXISTS idx_bicycles_camp_id ON bicycles(camp_id);
CREATE INDEX IF NOT EXISTS idx_bike_soldier_bike_id ON bike_soldier(bike_id);
CREATE INDEX IF NOT EXISTS idx_bike_soldier_soldier_id ON bike_soldier(soldier_id);

CREATE INDEX IF NOT EXISTS idx_laundry_bags_camp_id ON laundry_bags(camp_id);
CREATE INDEX IF NOT EXISTS idx_laundry_bags_soldier_id ON laundry_bags(soldier_id);

CREATE INDEX IF NOT EXISTS idx_assets_camp_id ON assets(camp_id);
CREATE INDEX IF NOT EXISTS idx_assets_type_id ON assets(type_id);
CREATE INDEX IF NOT EXISTS idx_assets_location_room ON assets(location_room);
CREATE INDEX IF NOT EXISTS idx_assets_location_key ON assets(location_key);

CREATE INDEX IF NOT EXISTS idx_users_requests_user_type ON users_requests(user_id, request_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_requests_status ON users_requests(status);
CREATE INDEX IF NOT EXISTS idx_users_requests_expires ON users_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON app.security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_name ON app.security_audit_log(event_name);
CREATE INDEX IF NOT EXISTS idx_security_audit_actor_user_id ON app.security_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_target_user_id ON app.security_audit_log(target_user_id);

COMMIT;