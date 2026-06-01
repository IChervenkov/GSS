# Runbook: Approval Flow Stuck

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

User requests approval but request does not resolve, buttons do not appear, or client never receives approved/denied outcome.

## Symptoms

- request remains pending beyond expected TTL
- admin UI missing decision controls
- decision made but client not updated
- QR payload retrieval fails after approval

## Immediate checks

1. Check approval request persisted in DB
2. Check admin list query includes pending approval state
3. Check approval decision write succeeds
4. Check audit event and socket emit after decision
5. Check client room subscription and event handling
6. Check request expiry logic and time calculations

## Mitigation

- resolve broken stage based on evidence:
  - persistence
  - admin visibility
  - decision write
  - emit path
  - client polling/socket handling
- if necessary, temporarily use a safe fallback path such as polling only, provided authorization is preserved
- roll back recent approval contract changes if confirmed

## Verification

- request created
- admin can approve or deny
- client receives final status
- QR payload retrieval works only when approved and within policy

## Follow-up

- add end-to-end regression test for full lifecycle
- verify audit coverage for request and decision
- review timeout handling and user messaging
