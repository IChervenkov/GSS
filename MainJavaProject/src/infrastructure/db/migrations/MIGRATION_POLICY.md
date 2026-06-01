# Migration Policy

This project uses a strict migration policy. Every schema change must be classified and rehearsed before production rollout.

## Allowed migration phases

### 1. Expand
Additive, backwards-compatible changes only.
Examples:
- add nullable columns
- add new tables
- add new indexes
- add new code paths that can work with both old and new schema

### 2. Backfill
Populate or normalize newly introduced structures without breaking existing readers.
Examples:
- copy legacy column data into a new column
- populate derived rows or indexes
- mark rows for later switchover

### 3. Switch
Move reads or writes to the new structure only after expand and backfill are complete.
Examples:
- rename tables or columns consumed by the app
- flip the application to read a new column/table only
- enable new constraints once code compatibility is proven

### 4. Contract
Remove deprecated structures only after a safe soak period.
Examples:
- drop old columns
- drop legacy indexes
- remove compatibility triggers or views

## Production policy

- High-risk, `switch`, and `contract` migrations must never run automatically at runtime in staging or production.
- Runtime migrations require both:
  - `ALLOW_RUNTIME_MIGRATIONS=true`
  - `DB_MIGRATION_GATE_TOKEN=<release gate token>`
- New migrations are treated as manual-gate-only until classified in `migration-manifest.ts`.
- Applied migrations must never be edited. Create a new forward migration instead.

## CI/CD migration gate

Before deploy, the pipeline must run an explicit migration step with a release identifier and operator identity.

Required inputs:
- `DB_MIGRATION_GATE_TOKEN`
- `DB_MIGRATION_RELEASE_ID`
- `DB_MIGRATION_APPLIED_BY`

The pipeline should fail fast if:
- the migration gate token is missing
- a migration is unclassified
- a migration is marked unsafe for automatic execution
- a checksum mismatch is detected

See `src/operations/ci/migration-gate.example.yml` for an example gate stage.

## Rollback policy

Rollback is handled in this order:

1. Prefer a forward fix when the schema is still compatible.
2. If a rollout caused incompatible data or structural damage, restore the database from the pre-deploy backup.
3. Validate restore time against RTO and data loss against RPO.
4. Record the outcome in the restore-drill evidence and runbook completion records.

Direct down-migrations are not the default strategy for production because they are often harder to trust than restore + forward-fix.
