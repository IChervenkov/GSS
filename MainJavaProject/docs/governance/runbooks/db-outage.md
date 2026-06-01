# Runbook: Database Outage

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

Application cannot establish DB connections, migrations fail, or query error rate spikes.

## Symptoms

- readiness endpoint failing DB check
- connection exhaustion
- repeated repository failures
- startup failure in migration or bootstrap stage

## Immediate checks

1. Confirm whether DB is down, unreachable, or saturated
2. Check connection pool metrics
3. Check recent migrations or schema changes
4. Verify credentials and network path
5. Determine whether issue affects read, write, or both

## Mitigation

- Stop rollout if deployment is in progress
- Scale down traffic if needed to reduce thrash
- Fail fast on readiness so bad instances stop receiving traffic
- Restore DB service or network path
- If caused by migration, halt further migration attempts and execute approved rollback/recovery steps

## Recovery verification

- readiness passes
- representative queries succeed
- auth and core business actions succeed
- error rate returns to baseline

## Data safety

- Verify no partial destructive migration ran unnoticed
- Review audit logs and failed transaction logs
- If integrity risk exists, invoke restore procedures only through approved change control

## Follow-up

- run restore drill if outage revealed backup uncertainty
- add connection exhaustion alert if absent
- document compatibility rule that was violated
