# Database Schema

Generated from `src/infrastructure/db/migrations/sql/*.sql`.

## `app.additional_items`

- `id`
- `soldier_id`
- `description`
- `laundry_bag_id`
- `quantity`
- `created_at`
- `updated_at`

## `app.asset_actions`

- `id`
- `changed_at`
- `change_asset_quantity`
- `change_remove_asset_quantity`
- `change_lost_asset_quantity`
- `change_modificate_asset_quantity`
- `camp_id`
- `created_at`

## `app.asset_types`

- `id`
- `name`

## `app.assets`

- `id`
- `code`
- `name`
- `type_id`
- `location_room`
- `location_key`
- `category`
- `quantity`
- `mrah`
- `asset_owner`
- `status`
- `expandable`
- `description`
- `camp_id`
- `inventory_status`
- `created_at`
- `last_inventory_date`
- `service`
- `m2_inside`
- `is_fixed`
- `date_purchase`
- `date_written_off`
- `purchase_price`
- `comments`
- `replaced_off`
- `year_of_life_cycle`
- `rest_of_life_cycle`
- `replaced_by`
- `rest_value`
- `is_quantity`
- `updated_at`
- `rfid_code`

## `app.bicycle_assignments`

- `id`
- `bike_id`
- `soldier_id`
- `date_from`
- `date_to`
- `status_bike`
- `helmet_id`

## `app.bicycles`

- `id`
- `name`
- `status`
- `camp_id`
- `created_at`
- `updated_at`
- `nfc_code`

## `app.building_rooms`

- `build_id`
- `room_id`

## `app.buildings`

- `id`
- `name`
- `type`
- `camp_id`
- `created_at`
- `updated_at`

## `app.camps`

- `id`
- `name`
- `created_at`
- `updated_at`

## `app.clean_item_events`

- `id`
- `item_name`
- `amount`
- `changed_at`
- `description`
- `camp_id`
- `created_at`

## `app.clean_items`

- `id`
- `item_name`
- `total_amount`
- `count_get_item`
- `camp_id`
- `created_at`
- `updated_at`
- `warehouse`

## `app.database_maintenance_runs`

- `id`
- `started_at`
- `finished_at`
- `status`
- `expired_requests`
- `deleted_sessions`
- `deleted_failed_logins`
- `archived_audit_logs`
- `metadata`

## `app.failed_logins`

- `username`
- `ip_address`
- `failed_attempts`
- `block_expires_at`

## `app.helmets`

- `id`
- `code`
- `camp_id`
- `nfc_code`

## `app.keys`

- `id`
- `name`
- `soldier_id`
- `camp_id`
- `created_at`
- `updated_at`
- `nfc_code`

## `app.laundry_bags`

- `id`
- `code`
- `type`
- `status`
- `laundry_count`
- `max_count_laundry`
- `soldier_id`
- `camp_id`
- `created_at`
- `updated_at`
- `rfid_code`

## `app.laundry_reports`

- `bag_id`
- `date_drop_off`
- `date_ready_to_pick_up`
- `soldier_id`
- `id`

## `app.permissions`

- `id`
- `name`

## `app.room_keys`

- `room_id`
- `key_id`

## `app.rooms`

- `id`
- `name`
- `camp_id`
- `created_at`
- `updated_at`

## `app.schema_migrations`

- `version`
- `checksum`
- `applied_at`

## `app.security_audit_logs`

- `id`
- `event_name`
- `created_at`
- `req_id`
- `actor_user_id`
- `pending_user_id`
- `target_user_id`
- `approver_user_id`
- `ip_address`
- `user_agent`
- `request_method`
- `request_path`
- `status_code`
- `metadata`

## `app.security_audit_logs_archive`

- `id`
- `event_name`
- `created_at`
- `req_id`
- `actor_user_id`
- `pending_user_id`
- `target_user_id`
- `approver_user_id`
- `ip_address`
- `user_agent`
- `request_method`
- `request_path`
- `status_code`
- `metadata`

## `app.soldier_moves`

- `id_new_key`
- `id_prev_key`
- `id_soldier`
- `moved_at`
- `id`

## `app.soldiers`

- `id`
- `name`
- `country`
- `date_accommodation`
- `date_free`
- `meal_card`
- `laundry_bag_id`
- `used_key`
- `camp_id`
- `upcoming_accommodation`
- `upcoming_release`
- `upcoming_accommodation_key`
- `created_at`
- `updated_at`

## `app.user_messages`

- `id`
- `user_id`
- `type`
- `subject`
- `body`
- `status`
- `created_at`
- `updated_at`
- `closed_at`
- `closed_by`

## `app.user_monitoring_events`

- `username`
- `location`
- `created_at`
- `id`

## `app.user_permissions`

- `user_id`
- `permission_id`
- `created_at`

## `app.user_requests`

- `request_id`
- `user_id`
- `status`
- `expires_at`
- `created_at`
- `type`
- `metadata`
- `decided_at`
- `decided_by`
- `updated_at`

## `app.user_sessions`

- `id`
- `user_id`
- `refresh_token`
- `device_id`
- `device_name`
- `ip_address`
- `created_at`
- `expires_at`
- `revoked`
- `updated_at`
- `refresh_jti`
- `token_version`
- `user_agent`
- `last_ip_address`
- `last_user_agent`
- `client_fingerprint_hash`
- `last_used_at`
- `revoked_reason`
- `session_family_id`

## `app.users`

- `id`
- `username`
- `password`
- `totp_secret`
- `temporary_password`
- `created_at`
- `updated_at`
- `is_locked`
- `token_version`
