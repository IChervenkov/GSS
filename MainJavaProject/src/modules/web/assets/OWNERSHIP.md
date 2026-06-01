# Module Ownership: Web Assets

## Ownership

- Primary owner: Assets feature owner
- Secondary owner: Web platform backup

## Scope

Asset feature presentation and page assembly for browser users.

## Critical dependencies

- assets repository
- shared workspace layout

## Critical user flows

- load assets page

## Change risks

- future CRUD additions bypassing shared authorization and DTO discipline

## Minimum review requirement

- 1 feature reviewer

## Operational dashboards / alerts to watch

- render failures
- repository latency on assets load

## ADRs linked


- `src/operations/adrs/0003-permission-model.md`

## Runbooks linked

- `src/operations/runbooks/deployment-rollback-runbook.md`
