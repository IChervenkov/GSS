# ADR-003: Realtime Room Naming Policy

- Status: Accepted
- Date: 2026-04-03

## Context

Uncontrolled room joins cause data leakage risk, noisy fanout, and fragile UI behavior.

## Decision

Approved room pattern:

```js
/^(?:user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|permission:list|user:list)$/;
```

Rules:

- A user may join only their own `user:<uuid>` room
- Shared rooms are opt-in and tied to active UI context
- Permission-based visibility must not rely on arbitrary room names
- Emits must use documented event names and validated payload schemas

## Consequences

- Lower blast radius for misrouted events
- Easier contract testing
- Cleaner horizontal scaling with Redis adapter

## Enforcement

- All requested rooms are normalized and validated server-side
- Invalid room requests are rejected and logged as security-relevant warnings
- UI code must join and leave rooms as pages or modals open and close
