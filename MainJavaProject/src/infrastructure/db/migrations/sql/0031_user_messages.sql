CREATE TABLE IF NOT EXISTS app.user_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'suggestion',
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_user_messages_type CHECK (type IN ('suggestion', 'message', 'issue', 'other')),
  CONSTRAINT chk_user_messages_status CHECK (status IN ('open', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_user_messages_status_created_at
  ON app.user_messages(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_messages_user_created_at
  ON app.user_messages(user_id, created_at DESC);
