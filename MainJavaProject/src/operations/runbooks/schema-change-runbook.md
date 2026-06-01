# Schema Change Runbook

## Preconditions

- Staging rehearsal completed with the same migration set.
- Fresh backup captured before production migration.
- Release id assigned.
- Operator assigned and recorded.
- Restore path validated.

## Execution checklist

1. Confirm release window and expected blast radius.
2. Confirm `DB_MIGRATION_GATE_TOKEN`, `DB_MIGRATION_RELEASE_ID`, and `DB_MIGRATION_APPLIED_BY` are set.
3. Run the migration gate stage before application deploy.
4. Review `app.schema_migrations` for phase, risk, execution mode, and release id.
5. Deploy application code only after migration gate success.
6. Verify health, auth, and critical business flows.
7. Monitor DB latency, errors, and lock contention.

## Rollback decision tree

- If the migration is additive and application-compatible, prefer a forward fix.
- If compatibility is broken, restore from the pre-deploy backup.
- If data backfill partially succeeded, freeze writes, restore, and re-run the corrected release.

## Evidence to record

- release id
- operator
- migration versions applied
- backup reference
- validation checks passed
- rollback decision if any
