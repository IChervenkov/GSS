# ADR 0003: Permission Model

- Status: Accepted
- Date: 2026-04-16

## Context

The platform has privileged user-management flows and multiple feature modules with different visibility and action requirements. Authorization must stay consistent across HTTP, views, and realtime updates.

## Decision

1. Authorization is deny-by-default.
2. Permission checks belong in shared guards, application policy, or both, not in views alone.
3. Views may use permission flags for rendering, but server-side enforcement remains mandatory.
4. Permission mutations must be audited.
5. Realtime updates triggered by permission changes must update relevant open UIs and invalidate stale access where needed.

## Consequences

- Feature pages can stay simple while permission discipline is centralized.
- Admin flows carry a higher review bar because they affect platform-wide trust boundaries.
- Test coverage must include permission grant, revoke, and revoked-while-open cases.

## Guardrails

- Never rely on hidden-button UI as authorization.
- Never introduce module-specific permission semantics without central registration and naming review.
