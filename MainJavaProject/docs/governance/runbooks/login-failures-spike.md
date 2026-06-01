# Runbook: Login Failures Spike

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

A sudden increase in login failures, invalid credentials, blocked sessions, or 2FA verification errors.

## Symptoms

- Sharp rise in `auth_login_failed`
- Increase in 401/403/409 on login-related endpoints
- User reports of valid credentials failing
- Increased QR or approval-related retries

## Likely causes

- Broken auth deployment
- CSRF issue on web login
- session store degradation
- DB lookup failure
- password comparison/runtime issue
- 2FA clock skew or QR approval flow breakage
- malicious login attempts

## Immediate checks

1. Check recent deploys
2. Check `request_error` and `auth_login_failed` logs
3. Compare web login failures vs API token failures
4. Check session store and DB readiness
5. Check whether failures are broad or user-specific
6. Inspect rate limiting behavior for false positives

## Mitigation

- Roll back last auth-affecting deploy if evidence points there
- Temporarily relax only non-security-breaking throttling if false positives are confirmed
- Restore Redis/session health if degraded
- Communicate user workaround only if safe and verified

## Verification

- Successful login rate returns to baseline
- 2FA verify path works end-to-end
- Token refresh works
- No elevated 500s on login paths

## Follow-up

- Add regression test for the exact broken step
- Update alert thresholds if noisy
- Document root cause
