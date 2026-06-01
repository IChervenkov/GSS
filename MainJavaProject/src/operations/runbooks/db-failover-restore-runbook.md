# Database Failover and Restore Runbook

## Trigger examples

- primary DB unavailable
- unacceptable replication lag
- data corruption or incompatible migration rollout
- restore required after failed schema change

## Immediate actions

1. Determine whether failover or restore is required.
2. Freeze schema changes and risky writes until the path is chosen.
3. Identify the release id and last known good backup.
4. Notify stakeholders of possible RPO/RTO impact.

## Failover path

1. Confirm standby health and replication status.
2. Promote the approved standby according to infrastructure procedure.
3. repoint application configuration and confirm connection health.
4. validate core business flows, especially auth, permissions, and approval request persistence.

## Restore path

1. Select the correct backup and recovery point.
2. Restore into the approved target environment.
3. Validate schema state and key tables before reopening traffic.
4. Re-run smoke tests and critical auth/business checks.
5. Record actual RTO and observed data loss against target RPO.

## Validation checklist

- health/readiness green
- migrations table/schema state correct
- login and refresh flows healthy
- permission and user-management queries succeed
- no unexplained lock or latency anomalies

## Evidence to capture

- backup identifier
- restore point / failover target
- operator
- start/end time
- validation results
- remaining risks and follow-ups
