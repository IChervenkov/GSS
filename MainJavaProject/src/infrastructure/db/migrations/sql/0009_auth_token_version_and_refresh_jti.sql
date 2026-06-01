SET search_path TO app, public;

ALTER TABLE IF EXISTS app.users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS app.user_sessions
  ADD COLUMN IF NOT EXISTS refresh_jti text,
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

UPDATE app.user_sessions AS sessions
   SET token_version = users.token_version,
       updated_at = NOW()
  FROM app.users AS users
 WHERE sessions.user_id = users.id
   AND COALESCE(sessions.token_version, -1) <> COALESCE(users.token_version, -1);

CREATE INDEX IF NOT EXISTS idx_users_token_version ON app.users(id, token_version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_refresh_jti ON app.user_sessions(refresh_jti)
  WHERE refresh_jti IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_token_version ON app.user_sessions(user_id, token_version);
