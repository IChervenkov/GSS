SET search_path TO app, public;

DO $$
BEGIN
  IF to_regclass('app.users_sessions') IS NOT NULL AND to_regclass('app.user_sessions') IS NULL THEN
    EXECUTE 'ALTER TABLE app.users_sessions RENAME TO user_sessions';
  END IF;

  IF to_regclass('app.users_requests') IS NOT NULL AND to_regclass('app.user_requests') IS NULL THEN
    EXECUTE 'ALTER TABLE app.users_requests RENAME TO user_requests';
  END IF;

  IF to_regclass('app.users_permission') IS NOT NULL AND to_regclass('app.user_permissions') IS NULL THEN
    EXECUTE 'ALTER TABLE app.users_permission RENAME TO user_permissions';
  END IF;

  IF to_regclass('app.permission') IS NOT NULL AND to_regclass('app.permissions') IS NULL THEN
    EXECUTE 'ALTER TABLE app.permission RENAME TO permissions';
  END IF;

  IF to_regclass('app.security_audit_log') IS NOT NULL AND to_regclass('app.security_audit_logs') IS NULL THEN
    EXECUTE 'ALTER TABLE app.security_audit_log RENAME TO security_audit_logs';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'user_requests' AND column_name = 'request_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'user_requests' AND column_name = 'type'
  ) THEN
    ALTER TABLE app.user_requests RENAME COLUMN request_type TO type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'permissions' AND column_name = 'permission_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'permissions' AND column_name = 'name'
  ) THEN
    ALTER TABLE app.permissions RENAME COLUMN permission_name TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'user_permissions' AND column_name = 'perm_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'app' AND table_name = 'user_permissions' AND column_name = 'permission_id'
  ) THEN
    ALTER TABLE app.user_permissions RENAME COLUMN perm_id TO permission_id;
  END IF;
END $$;
