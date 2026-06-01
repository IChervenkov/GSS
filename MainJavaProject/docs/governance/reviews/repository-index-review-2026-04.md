# Repository hot-path index review

## Covered query paths

### Login lookup
- Query shape: `app.users WHERE username = $1`
- Existing support: `idx_users_username`
- Status: acceptable for exact-match login.

### Session rotation
- Query shape: `app.user_sessions` by `user_id + refresh_token|refresh_jti`, active-session cleanup, device/session-family lookups.
- Existing support:
  - `idx_user_sessions_refresh_token`
  - `idx_user_sessions_refresh_jti`
  - `idx_user_sessions_active_lookup`
  - `idx_user_sessions_active_device_lookup`
  - `idx_user_sessions_active_family_lookup`
  - `idx_user_sessions_last_used_at`
- Status: strong.

### Permission checks
- Query shape: `app.user_permissions JOIN app.permissions` by `user_id + permission name`
- Existing support:
  - `idx_user_permissions_user_id`
  - `idx_user_permissions_permission_id`
  - `idx_permissions_name`
  - primary-key uniqueness on `(user_id, permission_id)`
- Status: acceptable.

### Approval request lookup
- Query shape: pending request lookup by `user_id + type + status + expires_at`, plus latest-request lookups by `user_id` ordered by `created_at DESC`.
- Existing support:
  - `idx_user_requests_user_type_created_at`
  - `idx_user_requests_status`
  - `idx_user_requests_expires_at`
  - `uq_user_requests_one_pending_per_user_type`
- Gap: the pending-request path benefits from a covering index that starts with `user_id, type, status` and supports the created-at ordering.

### User list/search
- Query shape: paged list ordered by username, optional contains-filter on username, lateral latest-request lookups.
- Existing support:
  - `idx_users_username`
  - request indexes above
- Gap: `%value%` contains-search does not fully benefit from a plain btree index. If user search volume grows, add `pg_trgm` and a trigram index on `users.username`.

### Camp/resource views
- Query shape: list camps by name and optional contains-filter on name.
- Existing support:
  - `idx_camps_name`
- Gap: `%value%` contains-search has the same trigram caveat as usernames.

## Actions added in this change set

- Added a composite pending-request lookup index for active approval-request queries.
- Kept username/name contains-search unchanged for now because adding trigram search would expand the operational footprint with `pg_trgm`.
