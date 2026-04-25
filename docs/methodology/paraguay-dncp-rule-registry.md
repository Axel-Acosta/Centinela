# Paraguay DNCP rule registry

## Purpose

Centinela now has a formal rule registry for the Paraguay DNCP procurement layer.

The registry is the bridge between:

- executable risk logic in code
- review and follow-up logic in PostgreSQL
- methodology and limitations language
- precedent influence tracking
- later API, console, and public transparency outputs

## Operational artifacts

- Code registry: `src/integrity/ruleRegistry.ts`
- PostgreSQL migration: `sql/postgres/005_rule_registry.sql`
- Canonical table: `centinela.risk_rule_registry`
- Coverage view: `centinela.risk_rule_coverage`
- Queue integration: `centinela.process_review_queue`
- Analyst-facing artifact: `data/reports/paraguay/all-sources-rulebook.md`

## What the registry stores

Each rule now carries:

- stable rule code and name
- family, category, default severity, and default score
- review lane and review-priority hint
- public-safe description
- analyst question and recommended action
- field dependencies and evidence requirements
- exclusions and limitations
- methodology notes
- DNCP alignment note
- precedent influences and their concrete contribution

## Why this matters

This shifts Centinela from:

- hard-coded pattern checks with separate hard-coded queue semantics

to:

- a reusable rule system where methodology, analyst workflow, and review routing can evolve together

## Current scope

The current registry covers the first seven Paraguay procurement rules:

- `PY-DNCP-T001`
- `PY-DNCP-T002`
- `PY-DNCP-T003`
- `PY-DNCP-B001`
- `PY-DNCP-A002`
- `PY-DNCP-P001`
- `PY-DNCP-P002`

## Current limits

- The rule set is still procurement-only.
- The DNCP crosswalk is still interpretive rather than institutionally validated.
- The registry is not yet connected to non-DNCP enrichment or ownership logic.
- Public methodology pages and API responses are still future layers.

## Next methodology step

- Keep the registry as the canonical rule backbone.
- Add the first enrichment connector so rule review can pivot into ownership, sanctions, or company accountability context.
- Deepen the DNCP crosswalk and later expose this registry through API and public-safe explanation layers.
