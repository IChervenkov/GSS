SET search_path TO app, public;

DO $$
BEGIN
  IF to_regclass('app.soldiers') IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'app.soldiers'::regclass
       AND conname = 'chk_soldiers_upcoming_schedule'
  ) THEN
    ALTER TABLE app.soldiers
      ADD CONSTRAINT chk_soldiers_upcoming_schedule CHECK (
        upcoming_release IS NULL
        OR upcoming_accommodation IS NULL
        OR upcoming_release >= upcoming_accommodation
      ) NOT VALID;
  END IF;
END $$;
