# ADR-001: Session vs JWT Boundaries

- Status: Accepted
- Date: 2026-04-03

## Context

GSS serves both web/EJS flows and API/mobile/realtime flows. Mixing session assumptions with bearer-token assumptions creates security and runtime inconsistency.

## Decision

- Web/browser flows use server sessions
- API/mobile flows use JWT bearer tokens
- Socket authentication may use shared web session or verified JWT, depending on entry path
- Web controllers must not assume JWT auth
- API controllers must not assume session state
- CSRF applies to session-backed web mutations only

## Consequences

### Positive

- Cleaner security model
- Clearer middleware ownership
- Easier auditing and testing
- Lower risk of accidental auth bypass

### Negative

- Some duplication in presentation layer adapters
- Clear translation needed between web and API response patterns

## Enforcement

- Separate web and API route trees
- Separate middleware stacks
- Shared business use-cases may be reused only through explicit adapters
