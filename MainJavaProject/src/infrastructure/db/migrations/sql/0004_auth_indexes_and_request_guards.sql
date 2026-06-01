SET search_path TO app, public;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON app.user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active_lookup ON app.user_sessions(user_id, revoked, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_cleanup ON app.user_sessions(expires_at) WHERE revoked = FALSE;

CREATE INDEX IF NOT EXISTS idx_user_requests_user_type_created_at ON app.user_requests(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_requests_status ON app.user_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_requests_expires_at ON app.user_requests(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_requests_one_pending_per_user_type
  ON app.user_requests(user_id, type)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON app.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON app.user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON app.permissions(name);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON app.security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_name ON app.security_audit_logs(event_name);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor_user_id ON app.security_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_target_user_id ON app.security_audit_logs(target_user_id);
