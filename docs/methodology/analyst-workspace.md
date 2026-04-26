# Analyst workspace methodology

## Purpose

The analyst workspace turns Centinela's read-only internal console into a conservative casework surface.

It lets analysts preserve notes, case context, source-record drilldowns, and graph exports without changing the meaning of automated outputs.

Everything remains internal, reviewable, and non-accusatory.

## Live database objects

- `centinela.analyst_cases`
  - stores internal investigation containers with title, status, priority, summary, creator, timestamps, and metadata
- `centinela.analyst_case_links`
  - links cases to entities, processes, external candidates, accepted matches, source records, second reviews, notes, or other targets
- `centinela.analyst_notes`
  - stores internal notes on a target with note type, analyst, visibility, provenance, and timestamps
- `centinela.analyst_evidence_links`
  - links a case, optional note, source record, target, field path, field value/excerpt, explanation, limitations, and evidence role into one reviewable evidence bundle
- `centinela.analyst_case_overview`
  - summarizes cases with linked-target and note counts
- `centinela.analyst_note_overview`
  - exposes notes with optional case context
- `centinela.analyst_case_evidence_overview`
  - exposes source-record evidence bundles with case, note, source, target, field, explanation, and limitation context
- `centinela.analyst_case_timeline`
  - unifies case creation, case links, case-scoped notes, and evidence links into one internal chronological review surface

## API behavior

Read endpoints:

- `GET /api/source-records`
- `GET /api/source-records/:id`
- `GET /api/analyst-cases`
- `GET /api/analyst-cases/:id`
- `GET /api/analyst-notes`
- `GET /api/entities/:id/network/export?format=cytoscape`

Write endpoints:

- `POST /api/analyst-cases`
- `POST /api/analyst-cases/:id/links`
- `POST /api/analyst-cases/:id/evidence-links`
- `POST /api/analyst-notes`

Write endpoints require `CENTINELA_WRITE_TOKEN` and either:

- `X-Centinela-Write-Token: <token>`
- `Authorization: Bearer <token>`

If `CENTINELA_WRITE_TOKEN` is not set, write endpoints are disabled.

## Safety rules

- Notes are internal analyst context, not findings of guilt.
- Public-facing use requires later review, redaction, and methodology treatment.
- Graph exports are relationship leads for review, not proof of ownership, control, misconduct, or liability.
- Source-record drilldowns show raw/source-backed evidence, but interpretation still belongs in review notes or methodology.
- Evidence links are explanation bundles for review. They can support identity context, review leads, limitations, contradictions, or follow-up, but they are not legal findings.
- Write-token authentication is a local hardening step, not a full production auth system.

## Current smoke-test result

On 2026-04-26, the first live analyst-workspace smoke test confirmed:

- migration `sql/postgres/016_analyst_workspace.sql` applied to the VPS-backed database
- migration `sql/postgres/017_analyst_case_timeline.sql` applied to the VPS-backed database
- migration `sql/postgres/018_analyst_evidence_links.sql` applied to the VPS-backed database
- overview endpoint returned `8,376` source records, `0` analyst cases, and `0` analyst notes
- Cytoscape graph export returned `19` elements for entity `3940`
- source-record search found the IDB row-level source record for candidate `59` as source record `10117`, external ID `idb-sanctions-row-76193`
- dry-run note and case writes worked with a temporary local write token
- wrong write tokens were rejected with `401`
- no smoke notes or cases were persisted
- a later case-timeline smoke created one temporary case, linked entity `3940`, saved one temporary note, returned `3` timeline events (`note`, `case_link`, `case_created`), then deleted the smoke case and returned analyst cases/notes to `0`
- the evidence-link smoke created one temporary case, one entity link, one note, and one source-record evidence link to source record `10117`; case detail returned `1` evidence link, the note reported `1` linked source record, the timeline returned `4` events (`evidence_link`, `note`, `case_link`, `case_created`), then cleanup returned analyst cases, notes, and evidence links to `0`

## Next hardening step

Add richer evidence-bundle ergonomics: source-record search inside the case panel, field-path helpers for common source types, and public-safety review states for any later outward-facing explanation.
