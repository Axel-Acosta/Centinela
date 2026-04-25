# External candidate second-review workflow

## Purpose

Second review is the governance boundary between a `promotable` external candidate and an accepted enrichment match.

It does not create proof of wrongdoing. It records whether a source-backed identity link is strong enough to be used as accepted enrichment context, while preserving rationale, limitations, reviewer identity, and evidence.

## Live database objects

- `centinela.entity_enrichment_second_reviews`
  - append-only second-review decisions for external enrichment candidates
  - stores reviewer, decision, rationale, limitations, evidence, and optional accepted-match ID
- `centinela.entity_enrichment_second_review_overview`
  - analyst-readable view joining second reviews to candidate and accepted-match context
- `centinela.entity_enrichment_candidate_review_overview`
  - now exposes latest second-review state beside first-review state, hosted comparison support, local identifiers, and source evidence
- `centinela.entity_enrichment_matches`
  - receives an accepted enrichment identity match only when a second reviewer chooses `accepted_match`

## Decisions

- `accepted_match`
  - creates or updates an accepted enrichment match
  - requires the candidate to already be `promotable`
  - requires explicit limitations
  - does not create an external risk signal
- `needs_more_evidence`
  - records that the candidate is not ready for accepted-match insertion
  - moves the candidate back to `needs_evidence`
- `rejected_match`
  - records that accepted-match insertion was declined
  - moves the candidate to `rejected`

## Command

Dry-run first:

```bash
npm run database:second-review-external-candidate -- --candidate-id 59 --decision accepted_match --reviewer "Second Reviewer" --rationale "Official IDB row, local DNCP/DNIT profile, and hosted matcher support point to the same company identity." --limitations "The external source row does not expose a comparable RUC, so this accepts identity context only and does not prove misconduct." --dry-run true
```

Record the second review:

```bash
npm run database:second-review-external-candidate -- --candidate-id 59 --decision accepted_match --reviewer "Second Reviewer" --rationale "Official IDB row, local DNCP/DNIT profile, and hosted matcher support point to the same company identity." --limitations "The external source row does not expose a comparable RUC, so this accepts identity context only and does not prove misconduct."
```

Useful evidence fields:

```bash
npm run database:second-review-external-candidate -- --candidate-id 59 --decision needs_more_evidence --reviewer "Second Reviewer" --rationale "Need one more primary-source identifier comparison before accepted-match insertion." --limitations "Name and country support alone are insufficient for final acceptance." --evidence-url "https://example.org/source" --evidence-note "Source reviewed but identifier still missing"
```

## Safety rules

- A second-review accepted match is an identity-resolution decision, not a corruption finding.
- `accepted_match` does not insert an `entity_external_risk_signals` row.
- Public-facing language must say source-backed match, enrichment context, risk signal, anomaly, or lead. It must not say proof of guilt.
- Limitations must remain visible, especially when external records lack local RUC or another comparable identifier.
- Rejected and deferred second reviews remain part of the audit trail.

## Current strongest candidate

Candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, is the first appropriate candidate for this workflow because it has:

- local DNCP/DNIT identity support, including RUC `80016063-0`
- hosted OpenSanctions same-candidate support from the stored comparison run
- official IDB Open Data row-level evidence, row `76193`
- a material limitation: no comparable external RUC in the stored OpenSanctions payload or IDB row

That limitation does not necessarily block identity acceptance, but it must be recorded if accepted.
