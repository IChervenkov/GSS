# Maintenance Policy

Regular maintenance must not block application boot unless explicitly required during an incident.

## Rules

- Maintenance runs are operational work, not boot-critical work.
- The app starts first, then maintenance runs after a configurable delay.
- Periodic maintenance is serialized with a Postgres advisory lock to avoid overlap across instances.
- Any failure in maintenance must be logged and metered, but must not crash the application.
- Manual incident-driven maintenance should be run separately from the main web process whenever possible.

## Boot behavior

- `DB_RUN_MAINTENANCE_ON_BOOT=false` by default.
- When enabled, the run starts only after the server is already listening.
- The recurring scheduler uses `DB_MAINTENANCE_INITIAL_DELAY_MS` before the first run.
