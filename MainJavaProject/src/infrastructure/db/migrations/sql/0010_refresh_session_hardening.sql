SET search_path TO app, public;

ALTER TABLE IF EXISTS app.user_sessions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS last_ip_address inet,
  ADD COLUMN IF NOT EXISTS last_user_agent text,
  ADD COLUMN IF NOT EXISTS client_fingerprint_hash text,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS session_family_id uuid NOT NULL DEFAULT gen_random_uuid();

UPDATE app.user_sessions
   SET last_used_at = COALESCE(last_used_at, updated_at, created_at, NOW()),
       last_ip_address = COALESCE(last_ip_address, ip_address),
       revoked_reason = CASE
         WHEN revoked = TRUE AND COALESCE(revoked_reason, '') = '' THEN 'revoked'
         ELSE revoked_reason
       END,
       session_family_id = COALESCE(session_family_id, gen_random_uuid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chk_user_sessions_revoked_reason'
       AND conrelid = 'app.user_sessions'::regclass
  ) THEN
    ALTER TABLE app.user_sessions
      ADD CONSTRAINT chk_user_sessions_revoked_reason CHECK (
        revoked_reason IS NULL OR revoked_reason IN (
          'expired',
          'revoked',
          'hash_mismatch',
          'device_mismatch',
          'fingerprint_mismatch',
          'token_version_mismatch',
          'user_revoked',
          'admin_revoked',
          'current_device_revoked',
          'concurrency_limit'
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_session_family_id
  ON app.user_sessions(session_family_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_device_lookup
  ON app.user_sessions(user_id, device_id, revoked, expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_used_at
  ON app.user_sessions(user_id, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_family_lookup
  ON app.user_sessions(user_id, session_family_id)
  WHERE revoked = FALSE;
