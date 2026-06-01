# Realtime Room Governance Standard

## Purpose

Make the realtime layer policy-driven instead of convention-driven.

## Core rules

- Every client and server event must be registered in `src/infrastructure/realtime/event-catalog.ts`.
- Every subscribable room must be registered in `src/infrastructure/realtime/room-policy.ts`.
- Room access is evaluated against policy, not inferred from naming conventions alone.
- Default rooms are limited to:
  - `user:<self>`
  - `presence:authenticated`
- Shared UI rooms are never granted only because a user is authenticated.
- Shared UI rooms must be capability-gated through live permission checks.
- Every outbound emit must pass payload validation and room-kind compatibility checks.
- Every join or leave request must pass payload validation and room authorization checks.
- Session and JWT socket principals must normalize to the same principal shape.
- Socket access may be downgraded when permissions change and must be disconnected when authentication becomes invalid.

## Registered room kinds

- `user`
- `presence`
- `ui.user.list`
- `ui.permission.list`
- `ui.camp.list`

## Default room policy

On connect the socket may only join:

- `user:<principal.id>`
- `presence:authenticated`

Any other room requires an explicit subscription request and a live authorization check.

## Subscription policy

Client requests are handled only through:

- `rooms:subscribe`
- `rooms:unsubscribe`

The runtime must:

1. validate the event name
2. validate and normalize the payload
3. resolve room descriptors from the registry
4. authorize each room against the current principal
5. reject forbidden rooms with explicit machine-readable codes
6. join or leave only approved rooms
7. emit metrics and audit records for denied attempts

## Invalidation policy

The runtime must support reevaluation for:

- permission changes
- token version changes
- session invalidation
- user deletion or disablement

Outcomes:

- invalid base authentication => force disconnect
- lost authorization for optional rooms => leave those rooms and emit self-refresh

## Required tests

- unauthorized room join attempts
- malformed subscription payload rejection
- stale token disconnect after reevaluation
- session invalidation disconnect
- permission downgrade removes UI rooms without dropping authenticated base rooms
- outbound event rejected when room kind does not match event contract
