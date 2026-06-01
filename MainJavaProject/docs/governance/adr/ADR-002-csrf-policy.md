# ADR-002: CSRF Policy

- Status: Accepted
- Date: 2026-04-03

## Context

GSS uses session-backed browser flows and bearer-token APIs. Applying CSRF indiscriminately creates confusion and breakage.

## Decision

- CSRF protection is required for session-backed web mutations
- CSRF is not used for pure bearer-token APIs
- CSRF token is session-bound
- Token is generated or reused consistently and exposed through `res.locals.csrfToken` for web views
- CSRF failures map to a stable `EBADCSRFTOKEN` handling strategy with a safe user message and reauthentication path

## Consequences

- Web security is strengthened against browser-based cross-site request attacks
- API/mobile clients are not burdened with irrelevant CSRF requirements
- Middleware configuration becomes easier to reason about

## Enforcement

- Web POST/PUT/PATCH/DELETE routes must apply the CSRF middleware where session-backed
- API routes must not require CSRF when authenticated by bearer token
- Tests must cover valid, missing, and invalid CSRF token cases
