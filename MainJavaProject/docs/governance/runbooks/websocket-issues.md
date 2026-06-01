# Runbook: WebSocket Issues

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

Socket connections flap, users miss realtime updates, or approval/permission updates do not reach the client.

## Symptoms

- increased disconnect/reconnect rate
- missing approval updates
- room join/leave errors
- inconsistent behavior across instances

## Immediate checks

1. Check socket connection metrics
2. Check Redis adapter/pub-sub health if multi-instance
3. Review room validation warnings
4. Compare a single-instance path vs multi-instance path
5. Check auth extraction and token/session verification logs

## Mitigation

- restore Redis adapter health if multi-instance fanout is broken
- confirm clients join only required rooms
- roll back recent room/event contract changes if suspect
- restart only unhealthy instances after evidence supports it

## Verification

- approval updates reach correct user room
- permission updates reach intended listeners
- reconnect success rate stabilizes
- no unauthorized room join attempts succeed

## Follow-up

- add or update contract tests for emitted payloads
- update dashboard with room join failures if absent
