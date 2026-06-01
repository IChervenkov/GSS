SET search_path TO app, public;

CREATE TABLE IF NOT EXISTS app.database_maintenance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  expired_requests integer NOT NULL DEFAULT 0,
  deleted_sessions integer NOT NULL DEFAULT 0,
  deleted_failed_logins integer NOT NULL DEFAULT 0,
  archived_audit_logs integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_database_maintenance_runs_status CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS app.security_audit_logs_archive (
  LIKE app.security_audit_logs INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING STORAGE INCLUDING COMMENTS
);

DO $$
BEGIN
  IF to_regclass('app.security_audit_logs_archive') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pk_security_audit_logs_archive' AND conrelid = 'app.security_audit_logs_archive'::regclass
  ) THEN
    ALTER TABLE app.security_audit_logs_archive ADD CONSTRAINT pk_security_audit_logs_archive PRIMARY KEY (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_archive_created_at ON app.security_audit_logs_archive(created_at DESC);

CREATE OR REPLACE FUNCTION app.run_database_maintenance(
  p_failed_logins_retention interval DEFAULT interval '7 days',
  p_audit_archive_before interval DEFAULT interval '180 days'
)
RETURNS TABLE (
  expired_requests integer,
  deleted_sessions integer,
  deleted_failed_logins integer,
  archived_audit_logs integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_expired_requests integer := 0;
  v_deleted_sessions integer := 0;
  v_deleted_failed_logins integer := 0;
  v_archived_audit_logs integer := 0;
  v_run_id uuid;
BEGIN
  INSERT INTO app.database_maintenance_runs (metadata)
  VALUES (jsonb_build_object(
    'failedLoginsRetention', p_failed_logins_retention::text,
    'auditArchiveBefore', p_audit_archive_before::text
  ))
  RETURNING id INTO v_run_id;

  UPDATE app.user_requests
     SET status = 'expired',
         updated_at = NOW()
   WHERE status = 'pending'
     AND expires_at <= NOW();
  GET DIAGNOSTICS v_expired_requests = ROW_COUNT;

  DELETE FROM app.user_sessions
   WHERE revoked = TRUE
      OR expires_at <= NOW();
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  DELETE FROM app.failed_logins
   WHERE block_expires_at IS NOT NULL
     AND block_expires_at < NOW() - p_failed_logins_retention;
  GET DIAGNOSTICS v_deleted_failed_logins = ROW_COUNT;

  WITH moved AS (
    DELETE FROM app.security_audit_logs
     WHERE created_at < NOW() - p_audit_archive_before
    RETURNING *
  )
  INSERT INTO app.security_audit_logs_archive
  SELECT * FROM moved;
  GET DIAGNOSTICS v_archived_audit_logs = ROW_COUNT;

  UPDATE app.database_maintenance_runs
     SET finished_at = NOW(),
         status = 'completed',
         expired_requests = v_expired_requests,
         deleted_sessions = v_deleted_sessions,
         deleted_failed_logins = v_deleted_failed_logins,
         archived_audit_logs = v_archived_audit_logs
   WHERE id = v_run_id;

  RETURN QUERY SELECT v_expired_requests, v_deleted_sessions, v_deleted_failed_logins, v_archived_audit_logs;
EXCEPTION WHEN OTHERS THEN
  IF v_run_id IS NOT NULL THEN
    UPDATE app.database_maintenance_runs
       SET finished_at = NOW(),
           status = 'failed',
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('error', SQLERRM)
     WHERE id = v_run_id;
  END IF;
  RAISE;
END;
$$;
