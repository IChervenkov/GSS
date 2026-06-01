# Module Ownership: Web Accommodation

## Ownership

- Primary owner: Accommodation feature owner
- Secondary owner: Web platform backup

## Scope

Accommodation overview and upcoming accommodation visibility for browser users.

## Critical dependencies

- repository queries for accommodation windows
- shared workspace view shell

## Critical user flows

- load accommodation page
- view upcoming accommodation state

## Change risks

- stale or incomplete availability windows
- permission leakage if future mutations are added without guard discipline

## Minimum review requirement

- 1 backend or feature reviewer

## Operational dashboards / alerts to watch

- page render errors
- abnormal query latency for accommodation fetches

## ADRs linked


- `src/operations/adrs/0003-permission-model.md`

## Runbooks linked

- `src/operations/runbooks/deployment-rollback-runbook.md`
