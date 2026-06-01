# Module Ownership: Web Auth

## Ownership

- Primary owner: Platform/Auth owner
- Secondary owner: Web platform backup

## Scope

Username/password login, pending sign-in state, QR request approval flow, two-factor verification, password change lifecycle, and logout/session cleanup for browser clients.

## Critical dependencies

- `shared/session/web-session-state.ts`
- `core/config/csrf.ts`
- `infrastructure/realtime/`
- `shared/security/audit-log.ts`

## Critical user flows

- login
- request QR approval
- retrieve approved QR payload
- verify two-factor code
- change password
- logout

## Change risks

- session fixation regression
- stale pending-auth state
- CSRF bypass or over-application
- approval flow getting stuck in an unresolved UI state

## Minimum review requirement

- 1 backend reviewer
- 1 frontend reviewer for changes that alter login, verify, or password-change UX
- security review for session lifecycle changes

## Operational dashboards / alerts to watch

- login failure spikes
- pending approval expiration rate
- password-change success/failure

## ADRs linked


- `src/operations/adrs/0001-auth-session-model.md`
- `src/operations/adrs/0002-realtime-model.md`

## Runbooks linked

- `src/operations/runbooks/auth-incident-runbook.md`