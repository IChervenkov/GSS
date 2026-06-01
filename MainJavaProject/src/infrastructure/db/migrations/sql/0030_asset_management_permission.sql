SET search_path TO app, public;

INSERT INTO app.permissions (name)
VALUES
  ('Asset management'),
  ('Add asset'),
  ('Edit asset'),
  ('Remove asset'),
  ('Save inventory'),
  ('Add asset type'),
  ('Edit asset type'),
  ('Remove asset type'),
  ('Add clean item'),
  ('Edit clean item'),
  ('Move clean item'),
  ('Remove clean item')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app.user_permissions (user_id, permission_id)
SELECT up.user_id, asset_management.id
  FROM app.user_permissions up
  JOIN app.permissions legacy_assets ON legacy_assets.id = up.permission_id
  JOIN app.permissions asset_management ON asset_management.name = 'Asset management'
WHERE legacy_assets.name = 'Assets'
ON CONFLICT (user_id, permission_id) DO NOTHING;

WITH asset_users AS (
  SELECT DISTINCT up.user_id
    FROM app.user_permissions up
    JOIN app.permissions permission ON permission.id = up.permission_id
   WHERE permission.name IN ('Assets', 'Asset management')
),
asset_action_permissions AS (
  SELECT id
    FROM app.permissions
   WHERE name IN (
     'Add asset',
     'Edit asset',
     'Remove asset',
     'Save inventory',
     'Add asset type',
     'Edit asset type',
     'Remove asset type',
     'Add clean item',
     'Edit clean item',
     'Move clean item',
     'Remove clean item'
   )
)
INSERT INTO app.user_permissions (user_id, permission_id)
SELECT asset_users.user_id, asset_action_permissions.id
  FROM asset_users
 CROSS JOIN asset_action_permissions
ON CONFLICT (user_id, permission_id) DO NOTHING;
