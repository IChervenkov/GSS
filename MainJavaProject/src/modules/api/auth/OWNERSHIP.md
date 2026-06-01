# Module Ownership: API Auth

## Ownership

- Primary owner: Platform/Auth owner
- Secondary owner: Backend platform backup

## Scope

JWT API authentication, refresh-token rotation, token identity normalization, and refresh-session persistence for API/mobile clients.

## Critical dependencies

- `infrastructure/db/`
- `shared/security/token-identity.ts`
- `shared/errors/`
- `shared/http/api-jwt.ts`

## Critical user flows

- refresh access token
- invalidate compromised refresh session
- reject device mismatch and refresh JTI mismatch

## Change risks

- token claim drift across HTTP and realtime
- refresh-session persistence bugs causing forced logout loops
- revocation gaps after security resets

## Minimum review requirement

- 1 backend reviewer for normal changes
- security-focused review required for token, session, or revocation changes

## Operational dashboards / alerts to watch

- refresh success/failure rate
- auth failure spikes
- repeated invalid refresh token errors

## ADRs linked


- `src/operations/adrs/0001-auth-session-model.md`

## Runbooks linked

- `src/operations/runbooks/auth-incident-runbook.md`