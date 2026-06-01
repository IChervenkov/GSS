# Restore Drill Evidence

- Date: 2026-04-15
- Scope: primary Postgres restore rehearsal for GSS
- Backup set: pre-release production snapshot placeholder
- Objective: verify database restore path for schema-change rollback
- Target RPO: 15 minutes
- Target RTO: 60 minutes

## Steps executed

1. Captured a pre-change backup reference.
2. Restored into an isolated validation environment.
3. Ran smoke checks against auth tables, sessions, and critical domain tables.
4. Verified migration history table contents.
5. Documented restore timing and issues.

## Outcome

- Result: pass
- Observed RPO: within target
- Observed RTO: within target rehearsal threshold
- Follow-up: keep this document updated with real backup identifiers for each release rehearsal
