# Auth Incident Runbook

## Trigger examples

- login failures spike abnormally
- refresh-token failures spike
- suspicious account takeover reports
- QR approval flow stalls or misroutes
- repeated invalid session or CSRF failures after a deploy

## Immediate actions

1. Confirm incident start time and blast radius.
2. Check health endpoints, auth dashboards, request error rates, and recent deploy history.
3. Determine whether the issue affects:
   - browser sessions
   - API/mobile JWT flows
   - both
4. Freeze risky auth-related deploys until the cause is known.

## Triage checklist

- review recent changes touching auth/session/token/realtime code
- inspect audit logs for login, logout, token refresh, password change, security reset, and permission changes
- inspect Redis health if session or rate-limit behavior looks abnormal
- inspect DB health if refresh-session lookups or approval request persistence is failing
- inspect browser-side CSP/CSRF/sign-in flow regressions if only web flows are failing

## Containment options

- revoke affected refresh sessions
- force logout all sessions for affected users if compromise is suspected
- disable risky admin actions if authorization drift is suspected
- roll back the latest deploy if the failure clearly maps to a release

## Recovery validation

- login succeeds end to end
- two-factor verification succeeds
- refresh rotation succeeds
- logout clears state correctly
- password change succeeds
- permission-revoked users lose access correctly

## Evidence to capture

- incident timeline
- affected users or modules
- audit event excerpts
- release id
- remediation performed
- follow-up code/test/runbook tasks
