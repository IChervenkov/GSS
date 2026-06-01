# Redis Outage Runbook

## Trigger examples

- readiness fails on Redis dependency
- session creation/read fails
- rate limiting behaves inconsistently across instances
- websocket scaling or pub/sub propagation stops working

## Immediate actions

1. Confirm whether the environment treats Redis as required.
2. Check Redis connectivity, authentication, TLS settings, and instance health.
3. Check whether the outage is complete, partial, or network-path specific.
4. Stop horizontal scale changes while the outage is active.

## Triage checklist

- inspect application startup/runtime logs for Redis connection failures
- inspect infrastructure metrics for saturation, memory pressure, and failover state
- confirm whether sessions, rate limits, and socket adapter all point at the same Redis target
- confirm no recent secret rotation or config drift caused the outage

## Containment options

- restore Redis service or route traffic to the healthy node/cluster
- if deploy introduced the issue, roll back configuration or release
- if staging or production requires Redis, do not force in-memory fallback as a hidden workaround

## Recovery validation

- readiness reports healthy Redis dependency
- new sessions can be created and read
- rate limiting behaves consistently across instances
- websocket propagation resumes across connected clients

## Follow-up

- record outage window and root cause
- update alerts if detection lagged
- review whether failover rehearsal needs improvement
