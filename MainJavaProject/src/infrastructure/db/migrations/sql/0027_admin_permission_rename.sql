SET search_path TO app, public;

INSERT INTO app.permissions (name)
SELECT 'Admin permission'
WHERE NOT EXISTS (
  SELECT 1 FROM app.permissions WHERE name = 'Admin permission'
);

WITH old_permission AS (
  SELECT id FROM app.permissions WHERE name = 'Add system permission'
),
admin_permission AS (
  SELECT id FROM app.permissions WHERE name = 'Admin permission'
)
INSERT INTO app.user_permissions (user_id, permission_id)
SELECT up.user_id, admin_permission.id
FROM app.user_permissions up
CROSS JOIN admin_permission
WHERE up.permission_id IN (SELECT id FROM old_permission)
ON CONFLICT (user_id, permission_id) DO NOTHING;

DELETE FROM app.user_permissions
WHERE permission_id IN (
  SELECT id FROM app.permissions WHERE name = 'Add system permission'
);

DELETE FROM app.permissions
WHERE name = 'Add system permission';
