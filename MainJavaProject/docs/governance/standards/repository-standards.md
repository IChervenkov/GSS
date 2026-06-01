# Repository Standards

## Goals

Repositories stay thin, predictable, and consistent.

## Rules

- One repository file per aggregate or feature responsibility.
- Repository methods may shape persistence results into repository entities, but must not enforce business policy.
- All SQL parameters must be bound through placeholders. Column filters and order-by inputs must be chosen from explicit allow-lists.
- Row mapping must use shared helpers so repository entities stay predictable across modules.
- Transaction boundaries are decided by use-cases or services. Repository methods may accept an injected database client for composition, but must not silently start nested transactions.
- Concurrency-sensitive writes must make locking visible in the SQL used by the repository.

## Required test coverage

Every repository with non-trivial behavior should have tests for the most relevant combinations of:

- success path mapping
- not found/null behavior
- duplicate constraint mapping through the shared DB transaction layer
- permission lookup queries
- concurrency-sensitive updates or row-lock behavior

## Query input hygiene

- Use allow-lists for filterable columns.
- Use allow-lists for sortable columns.
- Ignore unsupported filter and sort inputs rather than interpolating them.
- Keep paging placeholder generation deterministic.

## Hot paths that must be reviewed before release

- login lookup
- refresh/session rotation
- permission checks
- approval request lookup
- user list/search
- camp/resource list views
