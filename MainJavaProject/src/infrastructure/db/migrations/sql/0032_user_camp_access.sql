BEGIN;

CREATE TABLE IF NOT EXISTS app.user_camp_access (
  user_id    uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  camp_id    uuid NOT NULL REFERENCES app.camps(id) ON DELETE CASCADE,
  created_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, camp_id)
);

INSERT INTO app.user_camp_access (user_id, camp_id)
SELECT u.id, c.id
  FROM app.users u
 CROSS JOIN app.camps c
ON CONFLICT (user_id, camp_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_camp_access_camp_id
  ON app.user_camp_access(camp_id);

CREATE INDEX IF NOT EXISTS idx_user_camp_access_user_id
  ON app.user_camp_access(user_id);

COMMIT;
