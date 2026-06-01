CREATE INDEX IF NOT EXISTS idx_user_requests_pending_lookup
  ON app.user_requests(user_id, type, status, created_at DESC, expires_at)
  WHERE status = 'pending';
