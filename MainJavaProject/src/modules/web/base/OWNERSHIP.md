# Module Ownership: Web Base

## Ownership

- Primary owner: Web platform owner
- Secondary owner: Frontend/shared UI backup

## Scope

Public entry routes and shared login-page presentation bootstrapping that connects page rendering to the auth flow.

## Critical dependencies

- `shared/views/`
- `shared/public/`
- `modules/web/auth/`

## Critical user flows

- render login entry page
- hand off into auth flow without CSP violations or shared-shell regressions

## Change risks

- broken entry navigation
- mismatched shared view contracts
- asset initialization drift

## Minimum review requirement

- 1 web reviewer

## Operational dashboards / alerts to watch

- login page render failures
- CSP violations reported by browser logs

## ADRs linked


- `src/operations/adrs/0001-auth-session-model.md`

## Runbooks linked

- `src/operations/runbooks/auth-incident-runbook.md`
- `src/operations/runbooks/deployment-rollback-runbook.md`
