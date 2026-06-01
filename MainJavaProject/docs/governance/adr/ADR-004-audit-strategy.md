# ADR-004: Audit Strategy

- Status: Accepted
- Date: 2026-04-03

## Context

Privilege changes, auth events, approval decisions, and destructive actions must be reconstructable after the fact.

## Decision

Create an audit strategy covering:

- authentication events
- session lifecycle events
- permission changes
- approval creation/approval decision/expiry
- destructive admin actions
- schema migrations and deployment events

Audit records should capture:

- actor
- action
- target
- outcome
- timestamp
- request correlation ID
- relevant metadata without secrets

## Consequences

- Better incident investigation
- Better accountability
- Easier compliance and root-cause analysis

## Enforcement

- High-risk use-cases must emit audit events
- Audit event schema must be stable
- Audit logs must not contain secrets or sensitive raw payloads
- Retention and access policy must be defined operationally
