# External candidate review workflow

## Purpose

Centinela stores external enrichment candidates as review leads and diagnostics, not as accepted matches or accusations.

This workflow adds a human-review layer on top of `entity_enrichment_candidates` so analysts can record what should happen next without changing the underlying match provenance.

## Live database objects

- `centinela.entity_enrichment_candidates`
  - stores the original OpenSanctions bulk candidate or diagnostic row
  - now includes `reviewed_at`, `reviewed_by`, `review_notes`, and append-only `review_evidence`
- `centinela.entity_enrichment_candidate_review_overview`
  - joins candidate rows to hosted OpenSanctions comparison evidence
  - now exposes latest second-review state when a `promotable` candidate is escalated
  - adds `suggested_review_status`, `review_priority_hint`, and `review_next_step`
- `centinela.entity_intelligence_review_queue`
  - now counts active review candidates separately from manually rejected diagnostics

## Review statuses

- `unreviewed`
  - no analyst decision has been recorded
- `needs_evidence`
  - a candidate deserves follow-up, but source documents, identifiers, local context, or stronger relationship evidence are needed
- `promotable`
  - a candidate appears ready for stronger second review before any accepted-match insertion
  - this is not an accepted match
- `monitor`
  - preserve the row for future context without making it an active escalation
- `rejected`
  - reviewer determined the row should remain a rejected diagnostic unless materially new evidence appears

## Command

```bash
npm run database:review-external-candidate -- --candidate-id 59 --status needs_evidence --reviewer "Analyst Name" --notes "Review note"
```

Dry-run mode validates the target and shows the resulting state without writing:

```bash
npm run database:review-external-candidate -- --candidate-id 59 --status needs_evidence --reviewer "Analyst Name" --notes "Dry run only" --dry-run true
```

Optional evidence fields:

```bash
npm run database:review-external-candidate -- --candidate-id 59 --status needs_evidence --reviewer "Analyst Name" --notes "Needs source-record comparison" --evidence-url "https://example.org/source" --evidence-note "Source page checked"
```

## Current live state

- Total review overview rows: `58`
- High-priority company review candidates: `1`
- Rejected diagnostics: `57`
- Current reviewer state:
  - `accepted_match` second-review case: `1`
  - `monitor`: `5`
  - `rejected`: `4`
  - `unreviewed`: `48`
- First live classification:
  - candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, initially marked `needs_evidence`
  - local DNCP/DNIT identifiers exist for this company, including RUC `80016063-0`
  - the official IDB Open Data row-level source record was extracted on 2026-04-24 and candidate `59` was marked `promotable`
  - the candidate was accepted through second review on 2026-04-26 as enrichment identity context only, with the limitation that the IDB/OpenSanctions row still has no comparable external RUC identifier
  - second review ID: `2`
  - accepted enrichment match ID: `11`
  - accepted external entity ID: `12431`
  - second-review-created external risk signals: `0`
- Strongest representative diagnostics:
  - exact representative-name diagnostics with hosted same-candidate evidence but no Paraguay support were marked `monitor`
  - partial representative-name overlaps were marked `rejected`

## Safety rules

- Review status never creates an accepted match automatically.
- Hosted OpenSanctions `same_local_candidate` support strengthens a review lead, but does not prove identity or wrongdoing.
- Representative/person diagnostics require extra caution because DNCP legal-representative text alone does not prove the external person identity.
- Accepted-match insertion is handled only through the separate second-review workflow documented in `docs/methodology/external-candidate-second-review-workflow.md`.
- A second-review accepted match is identity-resolution enrichment context. It does not create an external risk signal or proof of wrongdoing.

## Accepted-match governance state

For candidate `59`, the local DNCP/DNIT identity package has now been compared against the underlying IADB sanctions/debarment source record:

- local company name: `CONSULTORA GUARANI SA INGENIEROS CIVILES`
- local RUC: `80016063-0`
- local sources: `py-dncp-supplier-anchor`, `py-dnit-ruc-equivalence`
- external candidate: `Consultora Guaraní S.A. Ingenieros Civiles`
- external source: `Inter-American Development Bank Sanctions`
- official IDB row: `76193`
- official IDB title: `Consultora Guaraní S.A. Ingenieros Civiles`
- current external identifier support: none in stored OpenSanctions payload or official IDB row
- investigation note: `docs/investigations/candidate-59-iadb-source-check.md`
- source-check methodology: `docs/methodology/idb-sanctions-open-data.md`

The second-review workflow accepted candidate `59` as source-backed identity context, not as a misconduct finding. The accepted match is now visible through the external-candidate review report, entity dossier outputs, and the local internal API/console.

Do not create future accepted matches unless the second-review workflow verifies the source evidence, local identity package, limitations, and accepted-match methodology. Do not create an external risk signal automatically from second review.
