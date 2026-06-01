# Roadmap: Extract Shared Concerns into Internal Libraries Only When Duplication Is Real

## Goal

Keep the codebase simple now, while defining a controlled path for extracting internal libraries later if the platform grows and repeated patterns become expensive to maintain inside the monorepo.

## Extraction rule

Do not extract a shared internal library until all of the following are true:

1. The same concern exists in at least 3 places.
2. The concern has stabilized enough that churn is lower than duplication cost.
3. The extracted API can be kept narrow and opinionated.
4. Ownership of the extracted library is explicit.

## Candidate concerns to watch

### 1. Shared HTTP contracts and route building
Potential extraction targets:
- DTO helpers
- response-contract helpers
- route builders
- permission guard wrappers

### 2. Shared auth and token identity utilities
Potential extraction targets:
- token identity normalization
- auth error mapping helpers
- refresh-session conventions

### 3. Shared realtime governance
Potential extraction targets:
- event catalog utilities
- room policy validation
- emit/subscribe contract helpers

### 4. Shared workspace UI primitives
Potential extraction targets:
- modal
- confirm dialog
- page state helpers
- request client
- socket client wrappers

### 5. Shared observability helpers
Potential extraction targets:
- metric-name registry
- audit event registry
- request context propagation
- health/readiness utilities

## Non-goals

- extracting libraries just to look enterprise
- creating package boundaries before ownership exists
- moving unstable feature logic into shared space too early

## Review cadence

Review this roadmap quarterly or when a new feature family is added.
