SET search_path TO app, public;

CREATE TABLE IF NOT EXISTS app.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL UNIQUE,
  device_id text NOT NULL,
  device_name text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  CONSTRAINT chk_user_sessions_expiry CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS app.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS app.user_permissions (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES app.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS app.user_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  type text NOT NULL DEFAULT 'generic',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_user_requests_status CHECK (status IN ('pending', 'approved', 'denied', 'expired'))
);

CREATE TABLE IF NOT EXISTS app.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  req_id text,
  actor_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  pending_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  approver_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  ip_address inet,
  user_agent text,
  request_method text,
  request_path text,
  status_code integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE IF EXISTS app.user_sessions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS app.user_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS app.user_permissions
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_user_requests_decided_by'
      AND conrelid = 'app.user_requests'::regclass
  ) THEN
    ALTER TABLE app.user_requests
      ADD CONSTRAINT fk_user_requests_decided_by
      FOREIGN KEY (decided_by) REFERENCES app.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE IF EXISTS app.user_requests
  DROP CONSTRAINT IF EXISTS status_valid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_user_requests_status'
      AND conrelid = 'app.user_requests'::regclass
  ) THEN
    ALTER TABLE app.user_requests DROP CONSTRAINT chk_user_requests_status;
  END IF;
END $$;

ALTER TABLE IF EXISTS app.user_requests
  ADD CONSTRAINT chk_user_requests_status CHECK (status IN ('pending', 'approved', 'denied', 'expired'));

ALTER TABLE IF EXISTS app.user_sessions
  DROP CONSTRAINT IF EXISTS chk_session_expiry;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_user_sessions_expiry'
      AND conrelid = 'app.user_sessions'::regclass
  ) THEN
    ALTER TABLE app.user_sessions DROP CONSTRAINT chk_user_sessions_expiry;
  END IF;
END $$;

ALTER TABLE IF EXISTS app.user_sessions
  ADD CONSTRAINT chk_user_sessions_expiry CHECK (expires_at > created_at);
