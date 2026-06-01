# Module Ownership: Web Laundry

## Ownership

- Primary owner: Laundry feature owner
- Secondary owner: Web platform backup

## Scope

Laundry page assembly and related read-model presentation for browser users.

## Critical dependencies

- laundry repository
- shared workspace layout

## Critical user flows

- load laundry page

## Change risks

- future workflow expansion without shared DTO/auth/routing standards

## Minimum review requirement

- 1 feature reviewer

## Operational dashboards / alerts to watch

- render failures
- query latency for laundry page data

## ADRs linked


- `src/operations/adrs/0003-permission-model.md`

## Runbooks linked

- `src/operations/runbooks/deployment-rollback-runbook.md`
