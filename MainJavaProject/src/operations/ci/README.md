# Governance CI Hooks

This directory contains lightweight governance checks that keep operational documentation attached to code changes.

## Current checks

- `scripts/check-governance.mjs` verifies that every discovered module has an `OWNERSHIP.md` file with the required sections.
- `scripts/check-alert-runbook-links.mjs` verifies that alert metadata points to real runbooks and includes severity and dashboard fields.

## GitHub wiring

The main workflow is `.github/workflows/governance-check.yml`.

## Extension ideas

- fail PRs when migration changes do not include rollback notes
- require evidence artifact updates for restore or rollback behavior changes
- validate ADR front matter and status fields if you later standardize them
