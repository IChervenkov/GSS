# Coding Standards

## 1. Naming

### General

- Use **kebab-case** for files and folders: `request-qr.use-case.ts`
- Use **camelCase** for variables and functions: `requestQrPayload`
- Use **PascalCase** for classes and constructor-like factories: `AppError`
- Use **UPPER_SNAKE_CASE** for constants and environment variables: `ACCESS_TOKEN_SECRET`
- Use **snake_case** for database columns and tables
- Prefer names that describe business meaning, not technical accidents

### Forbidden naming patterns

- No vague names: `data`, `value`, `temp`, `handler2`
- No mixed abbreviations unless standard and obvious: `req`, `res`, `id`, `url`, `jwt`
- No file names that hide responsibility: `utils.ts`, `helpers.ts`, `misc.ts`

### Examples

- Good: `save-user-permissions.use-case.ts`
- Bad: `permissionsHelper.ts`

## 2. File layout

### Standard module shape

Every module must follow one pattern only:

```text
src/<module>/
  application/
    dto/
    use-cases/
    services/
  domain/
    entities/
    policies/
    contracts/
  infrastructure/
    repositories/
    gateways/
    mappers/
  presentation/
    web/
    api/
    realtime/
  <module>.module.ts
  <module>.routes.ts
```

### Shared code

Use shared only for truly cross-module concerns:

```text
src/shared/
  core/
  errors/
  logging/
  validation/
  security/
  realtime/
  http/
```

Rules:

- Controllers and presenters must not query the database directly
- Repositories must not contain business policy
- Use-cases orchestrate business behavior
- Presentation formats output; it does not decide business rules
- Dependencies are injected once through module composition

## 3. Logging rules

### Principles

- Use structured logs only
- No raw `console.log`, `console.error`, or ad hoc logging in production code
- Every request log should include:
  - timestamp
  - level
  - service
  - reqId
  - method
  - path
  - status
  - duration_ms
- Security events should include:
  - category
  - actor identifier when safe
  - target identifier when relevant
  - outcome
- Logs must never contain:
  - plaintext passwords
  - refresh tokens
  - JWTs
  - CSRF tokens
  - QR secrets
  - database credentials
  - session secrets

### Event names

Use stable event names:

- `request_completed`
- `request_error`
- `auth_login_failed`
- `auth_login_succeeded`
- `permission_updated`
- `approval_requested`
- `approval_decided`
- `socket_connected`
- `socket_disconnected`
- `deployment_started`
- `deployment_failed`

### Log levels

- `debug`: local diagnosis only, usually disabled in production
- `info`: expected state changes and successful flow milestones
- `warn`: recoverable anomalies
- `error`: failed operation affecting one request or user flow
- `fatal`: startup or system-level failure

## 4. Error rules

### Error model

All thrown errors must be `AppError` or be mapped into `AppError`.

Canonical shape:

```js
{
  status: 403,
  code: 'UNAUTHORIZED',
  message: 'You must sign in again.',
  details: []
}
```

### Rules

- No raw database or library errors should leak to views or API clients
- Map external failures into stable application codes
- Web flows render or redirect using the web error strategy
- API flows return JSON using the API error strategy
- Realtime flows emit safe, contract-defined error payloads only
- Error codes must be documented and reused consistently

### Minimum required fields

- HTTP status
- stable error code
- user-safe message
- optional machine-readable details

## 5. Validation rules

### Entry-point validation

Validate at the boundary:

- route params
- query
- body
- headers where relevant
- socket event payloads

### Rules

- Use explicit schemas
- Reject unknown or malformed input
- Normalize after validation, not before
- Validate DTOs before they enter business logic
- Validate emitted realtime payloads before sending
- Validate config at startup

### Security-specific validation

- Passwords must satisfy the shared policy
- Room names must satisfy the shared room pattern
- IDs must use expected format only
- Never trust session, JWT, or socket claims without verification

## 6. Testing rules

### Required layers

- Unit tests for policies, services, DTO validators, helpers with business value
- Integration tests for repositories, DB transactions, middleware interactions
- End-to-end tests for critical flows:
  - login
  - QR request/approval/payload retrieval
  - 2FA verification
  - logout
  - token refresh
  - permission changes
  - approval lifecycle

### Rules

- Every bug fix must include a regression test
- Every security-sensitive path must test success and failure
- Mock only true external boundaries
- Prefer real contracts between internal layers
- Do not assert implementation trivia when behavior can be asserted instead

### Minimum expectation for PRs

- changed logic has tests
- error paths are covered
- auth boundary behavior is covered
- runtime contracts are covered if socket or HTTP payloads changed

## 7. Documentation rules

- New behavior that changes architecture, policy, or operations requires a doc update
- New cross-cutting decisions require an ADR
- Runbooks must be updated after incidents or architecture changes that affect diagnosis

## 8. Frontend-specific rules

- No inline scripts
- CSP-compatible initialization only
- Shared fetch helper only
- Shared error parser only
- Shared table pattern only
- Pages must implement loading, success, empty, error, unauthorized, and expired-session states where relevant

## 9. Database rules

- Schema uses `app` namespace
- Tables and columns use `snake_case`
- Primary keys use UUIDs unless a strong reason is documented
- Migrations must be forward-only and reversible by an explicit rollback plan
- Destructive changes require compatibility notes and rollout sequencing

## 10. Realtime rules

- Join only rooms needed by the current UI state
- Room names must satisfy the approved regex and ownership checks
- All emits must use a documented contract
- Socket auth must use verified session or verified JWT only
