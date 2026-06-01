# Alert Metadata

This directory keeps operational alert metadata close to the runbooks that responders need.

## Purpose

Every production-facing alert should point to:

- a severity
- an owning dashboard
- the runbook to execute first
- the module or platform area involved

## Usage

- Update `alert-catalog.yml` when new alerts are added or existing ones are renamed.
- Keep runbook paths stable or update the catalog in the same PR.
- Review alert metadata whenever module ownership or deployment topology changes.
