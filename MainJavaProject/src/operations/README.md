# Operations and Governance Index

This directory contains the governance material that keeps GSS maintainable as it grows from a hardened internal application into a long-lived platform.

## Contents

- `ownership/` module ownership, escalation paths, and change expectations
- `adrs/` architecture decision records for core long-lived platform decisions
- `runbooks/` operational response procedures
- `roadmaps/` future extraction guidance for shared concerns
- `alerts/` alert metadata that links production alerts to runbooks and dashboards
- `ci/` release gate examples
- `evidence/` rehearsal and proof artifacts

## Operating principle

Code structure alone is not enough at this stage. Every important module and platform capability must have:

- an explicit owner
- a decision record for core architecture choices
- an incident or recovery runbook where operational risk exists
- evidence for critical drills and governance checks

## Update cadence

- Ownership docs: review quarterly and on team/org changes
- ADRs: add when a decision becomes durable or costly to reverse
- Runbooks: rehearse at least every 6 months
- Roadmaps: review when duplication appears in 3 or more places

## Pull request and release discipline

- Pull requests must reference affected module ownership records.
- Durable architectural changes must cite an ADR or introduce a new ADR.
- Operationally significant changes must review the linked runbooks and alert metadata.
- Governance checks in CI fail when core ownership, ADR, runbook, or alert metadata files are missing.
