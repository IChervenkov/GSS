# Review Cadence

## Weekly

### Dependency review

- inspect newly introduced packages
- remove unused dependencies
- check security advisories
- verify version pinning strategy

### Log noise review

- identify repetitive low-value logs
- reduce duplicate stack traces
- ensure alerts are actionable

## Biweekly

### Performance review

- endpoint latency by route
- DB slow queries
- socket reconnect behavior
- frontend loading regressions on key pages

## Monthly

### Security review

- auth boundary checks
- permission enforcement spots
- CSRF/session/JWT correctness
- secret handling
- rate-limit effectiveness
- recent incident review

### Schema review

- migration quality
- index usefulness
- orphaned columns or compatibility debt
- retention and audit data growth

## Quarterly

- backup and restore drill
- disaster recovery rehearsal
- architecture drift review against ADRs
- review module shape consistency
- review stale docs and runbooks
