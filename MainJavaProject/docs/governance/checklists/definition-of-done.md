# Definition of Done

A feature is not done unless all items below are satisfied.

## 1. Validation

- Request input is validated at the boundary
- Realtime payloads are validated if applicable
- Invalid input returns the correct stable error shape

## 2. Authentication and authorization

- Auth path is explicit
- Permission checks are present
- Deny-by-default behavior is preserved
- Session vs JWT boundary is correct

## 3. Logging and auditability

- Structured logs added where behavior changed
- Security-sensitive actions create audit records where required
- No secrets are logged

## 4. Tests

- Unit tests added for changed business logic
- Integration tests cover persistence or middleware interaction
- E2E coverage exists for user-visible critical flow changes
- Regression tests exist for fixed bugs

## 5. Documentation

- User/developer docs updated
- ADR added if architecture or policy changed
- Runbook updated if operations changed

## 6. Error paths

- Success and failure paths both handled
- Error codes documented or reused consistently
- Web/API/realtime error strategies are correct

## 7. Monitoring impact

- Logging/metrics impact reviewed
- Dashboard or alert impact reviewed
- New failure mode considered

## 8. Operational readiness

- Migration compatibility considered if schema changed
- Rollback path noted if runtime behavior changed
- Config changes documented

## PR checklist

- [ ] Validation done
- [ ] Auth check done
- [ ] Logs and audit done
- [ ] Tests done
- [ ] Docs done
- [ ] Error paths done
- [ ] Monitoring impact reviewed
- [ ] Migration/rollback reviewed
