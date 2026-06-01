# Module Ownership: Web Bicycles

## Ownership

- Primary owner: Bicycles feature owner
- Secondary owner: Web platform backup

## Scope

Bicycle overview, status presentation, and related web page flows.

## Critical dependencies

- bicycles repository
- shared workspace shell

## Critical user flows

- load bicycles page
- fetch bicycles overview data

## Change risks

- incorrect asset status mapping
- future realtime additions bypassing room policy

## Minimum review requirement

- 1 feature reviewer

## Operational dashboards / alerts to watch

- page render failures
- repository latency on bicycles load

## ADRs linked


- `src/operations/adrs/0002-realtime-model.md`
- `src/operations/adrs/0003-permission-model.md`

## Runbooks linked

- `src/operations/runbooks/deployment-rollback-runbook.md`
