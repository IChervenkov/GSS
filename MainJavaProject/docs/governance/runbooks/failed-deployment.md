# Runbook: Failed Deployment

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

Deployment does not complete, new version fails readiness, or post-deploy error rate spikes.

## Immediate checks

1. Identify stage of failure:
   - build
   - test
   - migration gate
   - app startup
   - readiness
   - post-cutover traffic
2. Compare current and prior release
3. Check environment validation output
4. Check migration compatibility assumptions

## Mitigation

- stop rollout immediately
- route traffic back to last healthy version if possible
- do not force traffic to unready instances
- revert config only if confirmed as the cause
- avoid manual hotfixes on prod nodes without change tracking

## Verification

- previous healthy version is serving traffic
- readiness and health pass
- key user journeys pass smoke tests
- no pending incompatible migration step remains unresolved

## Follow-up

- add missing release gate
- record rollback time and pain points
- update deployment checklist
