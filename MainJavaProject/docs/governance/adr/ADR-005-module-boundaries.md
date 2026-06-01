# ADR-005: Module Boundaries

- Status: Accepted
- Date: 2026-04-03

## Context

Industrial maintainability requires predictable module structure and strict layer rules.

## Decision

Every module uses this shape:

- `application/`
- `domain/`
- `infrastructure/`
- `presentation/`
- composition entry files only at module root

Boundary rules:

- presentation depends on application, never on DB directly
- application depends on domain contracts, not infrastructure details
- infrastructure implements contracts
- domain contains business concepts and policies, not framework code
- shared/core stays framework-agnostic where possible

## Consequences

- Easier replacement and testing
- Less hidden coupling
- Faster onboarding

## Enforcement

- Code review rejects direct DB access outside infrastructure
- New modules must start with the standard shape
- Legacy compatibility files should be removed instead of preserved indefinitely
