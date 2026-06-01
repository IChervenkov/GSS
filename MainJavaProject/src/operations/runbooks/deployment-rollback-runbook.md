# Deployment Rollback Runbook

## Trigger examples

- elevated 5xx rate after release
- auth flows broken after deploy
- websocket events or permission updates regress
- readiness or startup failures on new version

## Immediate actions

1. Confirm release id and deployment window.
2. Compare application, DB, and Redis changes shipped in the release.
3. Decide whether the rollback is:
   - application-only
   - configuration-only
   - data-impacting and requiring DB restore/failover procedure

## Rollback checklist

1. Stop progressive rollout or divert traffic from the bad version.
2. Roll back the application artifact to the last known good version.
3. Re-apply known good environment/config values if config drift is involved.
4. Do not roll schema backward casually; use the schema-change or DB restore runbook when needed.
5. Validate critical flows before restoring full traffic.

## Validation checklist

- health endpoints green
- login, verify, refresh, and logout healthy
- main admin workflows healthy
- realtime updates working on open UIs
- error rate and latency returned to baseline

## Evidence to capture

- release id
- suspected cause
- rollback type
- validation results
- follow-up corrective actions
