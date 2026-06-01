# ADR 0002: Realtime Model

- Status: Accepted
- Date: 2026-04-16

## Context

GSS uses realtime updates for approval flows, admin views, and room-based UI refreshes. Permission-name rooms and ungoverned event emission create security and maintainability risks.

## Decision

1. Realtime events must be defined in a central event catalog.
2. Room naming and admission rules must be governed by a central room policy.
3. Clients join the minimum rooms needed for the current UI state.
4. User identity for sockets must align with HTTP auth identity rules.
5. Payloads for outbound events must be validated before emission.
6. Redis-backed horizontal scaling is the target topology for deployable environments.

## Consequences

- Realtime behavior becomes predictable and auditable.
- Permission revocation and UI visibility can be enforced more reliably.
- Open admin screens require tests for room join/leave and permission change propagation.

## Guardrails

- No ad hoc room creation from page code.
- No direct emission of unchecked payloads.
- No permission-name rooms as the long-term primary model.
