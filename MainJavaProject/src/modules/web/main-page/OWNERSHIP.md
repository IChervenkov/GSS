# Module Ownership: Web Main Page

## Ownership

- Primary owner: Core business workflow owner
- Secondary owner: Backend platform backup

## Scope

Main workspace flows: camps, users, permissions, approval resolution, security resets, and main dashboard data used by privileged browser users.

## Critical dependencies

- `modules/web/main-page/infrastructure/repositories/`
- `modules/web/main-page/infrastructure/realtime/`
- `shared/http/permission-guard.ts`
- `shared/security/audit-log.ts`

## Critical user flows

- load main page
- manage users
- manage camps
- save permissions
- resolve user requests
- perform security reset

## Change risks

- authorization regression
- user/permission cache drift across UI and realtime
- high-blast-radius bugs affecting many admin workflows

## Minimum review requirement

- 1 backend reviewer
- 1 reviewer familiar with permission policy for authorization changes

## Operational dashboards / alerts to watch

- permission save errors
- user management errors
- approval resolution latency
- websocket update failures impacting open admin UIs

## ADRs linked


- `src/operations/adrs/0002-realtime-model.md`
- `src/operations/adrs/0003-permission-model.md`

## Runbooks linked

- `src/operations/runbooks/auth-incident-runbook.md`