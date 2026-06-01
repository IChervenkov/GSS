# Runbook: Redis Outage

## Severity guide

- Sev 1: login unavailable, core business flow unavailable, data integrity at risk
- Sev 2: partial outage, degraded user flow, workaround exists
- Sev 3: minor degradation or operational noise

## Incident response pattern

1. Detect and confirm
2. Scope impact
3. Stabilize service
4. Mitigate user harm
5. Repair
6. Verify recovery
7. Write incident notes
8. Update monitoring/runbooks/tests if needed

## Common evidence to collect

- request IDs
- recent deploy ID or commit
- app logs
- DB/Redis health
- error-rate and latency graphs
- socket connection counts if relevant

## Trigger

Redis unavailable or unstable, affecting sessions, rate limits, socket adapter, or cache-backed workflows.

## Symptoms

- login/session instability
- rate limiter malfunction
- socket fanout inconsistency across instances
- readiness fails on Redis

## Immediate checks

1. Confirm Redis reachability and auth
2. Check whether impact is sessions, rate limiting, pub/sub, or all
3. Check recent config changes
4. Check resource saturation and eviction behavior

## Mitigation

- Stop rollout if config-related
- Restore Redis availability
- If operating in degraded mode is supported, preserve security first:
  - do not disable auth checks
  - do not silently bypass rate limiting without explicit decision
- Drain or restart affected app instances only if recovery requires it

## Recovery verification

- session-backed web flows succeed
- rate limiting behaves normally
- cross-instance socket broadcasts work
- readiness returns healthy

## Follow-up

- document whether high availability or failover needs improvement
- verify reconnect behavior for sockets and clients
