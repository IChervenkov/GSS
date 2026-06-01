# Naming and Consistency Conventions

## Canonical concepts

- **User request**: a user-scoped approval workflow persisted in `app.user_requests`.
  - Supported request types are defined in `shared/naming/concept-glossary.ts`.
  - QR enrollment and password change are both user requests.
- **Verification challenge**: short-lived two-factor verification material stored in session for a pending sign-in flow.
- **Pending two-factor user**: the authenticated principal who has passed username/password and is waiting for two-factor completion.
- **Pending password-change user**: the principal who has been approved to complete a password change but has not finalized it yet.

## Realtime events

Use the pattern `namespace:resource:action`.

Examples:
- `user:request:updated`
- `user:request:resolved`
- `user:record:created`
- `permission:catalog:updated`
- `room:subscription:requested`

Legacy room subscription event names are still accepted for compatibility.

## Audit events

Use the pattern `namespace:resource:action`, with typed constants from
`shared/security/audit-event-names.ts`.

Examples:
- `auth:login:succeeded`
- `auth:qr_request:requested`
- `main:user:created`

## Metrics

Metric labels are normalized to snake_case centrally in `shared/observability/metrics.ts`.

Preferred label examples:
- `event_name`
- `request_id`
- `actor_user_id`
- `target_user_id`
- `device_id`
