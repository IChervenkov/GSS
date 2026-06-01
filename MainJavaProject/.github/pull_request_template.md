## Summary

Describe the change in business and technical terms.

## Modules touched

List each affected module path.

- [ ] `src/modules/...`

## Ownership review

- [ ] I reviewed the `OWNERSHIP.md` file for every affected module.
- [ ] I updated the ownership file when scope, dependencies, risks, or dashboards changed.
- [ ] I notified the current primary/backup owner when the change crosses module boundaries.

## ADR impact

- [ ] No durable architecture decision changed.
- [ ] This PR follows an existing ADR.
- [ ] A new ADR was added or an existing ADR was updated.

ADR references:

- `src/operations/adrs/0001-auth-session-model.md`
- `src/operations/adrs/0002-realtime-model.md`
- `src/operations/adrs/0003-permission-model.md`
- `src/operations/adrs/0004-deployment-topology.md`
- Other:

## Runbook and operational impact

- [ ] No operational behavior changed.
- [ ] Relevant runbook(s) were reviewed.
- [ ] Relevant runbook(s) were updated.
- [ ] Alert metadata was reviewed or updated in `src/operations/alerts/alert-catalog.yml`.

Runbook references:

- `src/operations/runbooks/auth-incident-runbook.md`
- `src/operations/runbooks/redis-outage-runbook.md`
- `src/operations/runbooks/db-failover-restore-runbook.md`
- `src/operations/runbooks/deployment-rollback-runbook.md`
- Other:

## Testing and evidence

- [ ] Unit tests added or updated where behavior changed.
- [ ] Integration/E2E tests added or updated where flow boundaries changed.
- [ ] Restore/rollback/operational evidence was updated if this PR changed deployment, migration, or recovery behavior.

Evidence links or paths:

- 

## Release and migration safety

- [ ] No migration involved.
- [ ] Migration is backward compatible for rolling deploys.
- [ ] Rollback path was documented.
- [ ] Feature flags or staged rollout notes were added when needed.

## Security and permissions

- [ ] Auth/session impact reviewed.
- [ ] Permission checks reviewed.
- [ ] Audit/metrics/logging impact reviewed.

## Reviewer notes

Anything that reviewers should verify manually.
