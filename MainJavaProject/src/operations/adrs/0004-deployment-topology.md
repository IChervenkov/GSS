# ADR 0004: Deployment Topology

- Status: Accepted
- Date: 2026-04-16

## Context

GSS is moving from a hardened internal application toward a platform that must remain maintainable and operational for years. The deployment model must support safe releases, observability, shared state, and recovery.

## Decision

1. Deploy the application as a containerized service with environment-only configuration.
2. Use PostgreSQL as the system of record.
3. Use Redis as required shared infrastructure for sessions, rate limiting, and realtime scaling in deployable environments.
4. Separate local, dev, staging, and production environments with distinct secrets and databases.
5. Use explicit migration gates before production application rollout.
6. Prefer restore + forward-fix over ad hoc destructive rollback of schema state.

## Consequences

- The platform can scale horizontally without inconsistent session or socket behavior.
- Production readiness depends on Redis and Postgres health, so both need runbooks and drill evidence.
- CI/CD becomes part of platform governance rather than an optional convenience.

## Guardrails

- No shared-host assumptions in long-term topology.
- No deployable environment should fall back silently to in-memory infrastructure for shared state.
