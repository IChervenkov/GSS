# Test Coverage Map

This map turns the test suite from a collection of good tests into an explicit confidence model.

## Module coverage

| Module | Unit | Integration | E2E/Smoke | Primary risks covered |
|---|---:|---:|---:|---|
| `web/auth` | Yes | Yes | Yes | login, 2FA, QR approval, password change, session fixation, duplicate submit, deny/expiry paths |
| `api/auth` | Yes | Yes | Partial | refresh rotation, JWT/token-version checks, DTO/presenter contracts |
| `web/base` | Partial | Yes | Yes | health/readiness/metrics protection and smoke checks |
| `web/main-page` | Yes | Yes | Partial | camp selection, permission changes, admin flows |
| `web/accommodation` | Yes | Yes | Partial | presenter/DTO normalization, route access |
| `realtime` | Yes | Yes | Partial | socket auth, room policy, permission revocation while UI is open |
| `shared/http` | Yes | Yes | Partial | validation, error mapping, route discipline |
| `shared/session` | Yes | Partial | Partial | pending auth state, fixation prevention, password-change cleanup |
| `db/repositories` | Yes | Partial | No | row mapping, transaction handling, approval request idempotency, password-change persistence |
| `bootstrap/runtime` | Partial | Yes | Smoke | redis-required boot, environment validation, startup safety |

## Risk-area coverage

| Risk area | Current tests |
|---|---|
| Session fixation prevention | `tests/unit/web/auth/auth.session-fixation.test.ts` |
| Password change full lifecycle | `tests/e2e/password-change-lifecycle.e2e.test.ts` |
| QR request expiration | `tests/unit/web/auth/approval-qr-expiration.test.ts` |
| Approval deny flow | `tests/unit/web/auth/approval-deny-flow.test.ts` |
| Permission revocation while UI/socket is open | `tests/realtime/permission-revocation-open-ui.test.ts` |
| Duplicate submit / idempotency | `tests/integration/db/approval-request.repository.integration.test.ts` and `tests/unit/web/auth/approval-request.idempotency.test.ts` |
| DB failure mapping | `tests/unit/db/db-error-mapping.test.ts` |
| Redis unavailable boot behavior | `tests/integration/http/redis-required-boot.test.ts` |
| Staging / production env validation failure | `tests/integration/config/env-production.validation.test.ts` |
| Presenter + DTO contracts | `tests/unit/contracts/**/*.test.ts` |
| Real Postgres repository integration | `tests/integration/db/**/*.integration.test.ts` |
| Health / readiness smoke tests | `tests/smoke/health-endpoints.smoke.test.ts` |

## Confidence thresholds

A change is not “done” until:
1. it lands in the correct module row above,
2. it is mapped to a risk area above,
3. CI passes lint, unit, integration, E2E, smoke, migration gate, secret scan, and dependency audit policy.
