# ADR 0001: Auth and Session Model

- Status: Accepted
- Date: 2026-04-16

## Context

GSS serves both browser and API/mobile clients. Browser flows require strong session and CSRF discipline, while API/mobile flows require JWT-based access and refresh-token rotation. Earlier versions blurred these models and made policy drift likely.

## Decision

1. Browser flows use server-backed sessions.
2. CSRF applies to browser mutation flows only.
3. API/mobile flows use bearer access tokens and refresh-token rotation.
4. Refresh sessions are persisted server-side and support revocation, device binding, refresh JTI checks, and security reset invalidation.
5. Canonical identity is normalized around a stable user identifier and token identity helpers.
6. Security-sensitive changes require session rotation or invalidation according to policy.

## Consequences

- Auth logic stays split by client type instead of forcing one mechanism everywhere.
- Controllers remain thin while auth services and repositories own policy and persistence.
- Tests must explicitly cover login, 2FA, refresh rotation, logout, security reset, and session fixation protection.

## Guardrails

- Do not add CSRF to bearer-only APIs.
- Do not allow refresh tokens in access-token contexts.
- Do not silently downgrade required session backends in deployable environments.
