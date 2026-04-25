# OpenSanctions screening methodology

## Purpose

This note records how the first Centinela external-risk connector currently works.

It is intentionally conservative.

## Current scope

- Local population screened
  - procurement-linked supplier companies already present in Centinela's Paraguay entity layer
  - DNCP legal-representative person entities linked to those supplier companies
- Local names and identifiers used
  - procurement names
  - official DNCP supplier-profile names
  - official DNIT RUC-equivalence names
  - comparable Paraguay RUC identifiers only
  - official DNCP legal-representative names, screened separately from companies
- External source
  - OpenSanctions `default` bulk dataset, specifically `targets.simple.csv`
- Current storage targets
  - `entities` for matched external entities
  - `entity_relationships` for external-match edges
  - `entity_enrichment_matches` for match provenance and confidence
  - `entity_enrichment_candidates` for review-only near matches and rejected diagnostics that are not accepted matches
  - `entity_enrichment_candidate_review_overview` for manual review state, reviewer notes, suggested next steps, and hosted-comparison support
  - `entity_external_risk_signals` for sanctions, debarment, watchlist, offshore, or PEP-linked signals where applicable

## Why bulk instead of the hosted API

- As observed on 2026-04-18, the hosted OpenSanctions matching API requires authentication.
- The public bulk dataset index and exports remain reachable.
- Centinela therefore uses the public bulk path first, which preserves reproducibility and does not require new secrets.

## Current matching rules

### Accepted now

- company-to-company exact normalized name matches
- cautious company core-name matches only when the external row itself is country-linked to Paraguay

### Review-only candidates now

- company-to-company high token-overlap candidates only when the OpenSanctions row has Paraguay country or dataset support
- DNCP legal-representative person exact-name candidates only when the OpenSanctions row is a person and has Paraguay support
- DNCP legal-representative person token-overlap candidates only when there is stronger multi-token support; weak two-token overlaps are not review candidates
- candidate records are stored in `entity_enrichment_candidates`, not accepted match tables
- manual review states are stored separately from candidate status: `unreviewed`, `needs_evidence`, `promotable`, `monitor`, and `rejected`
- `promotable` means the candidate is ready for a stronger second review, not that Centinela has accepted the external identity match

### Rejected diagnostics now

- company core-name candidates with high token overlap but no Paraguay support
- DNCP legal-representative person exact-name hits with no Paraguay support
- DNCP legal-representative person partial-name overlaps with Paraguay support but too little identity evidence for review escalation
- diagnostics are kept for auditability and explanation, but they do not create queue escalation or risk signals

### Not accepted now

- company-to-person exact-name matches
- representative/person candidates without Paraguay support as accepted or review candidates
- broad fuzzy matching
- core-name matches without Paraguay support
- implicit ownership or officer inference

## Current confidence tiers

- `high`
  - identifier-backed exact matches
  - Paraguay-supported exact name matches
- `medium`
  - exact normalized name matches without stronger identifier support
- `review`
  - cautious Paraguay-supported core-name matches
  - review-only candidate rows that need analyst confirmation before any acceptance
- `diagnostic`
  - rejected candidate rows preserved to explain why a tempting external row was not queued as a review candidate

## Current risk classification

- `EXT-OS-SANCTION`
  - sanctions-linked datasets or explicit sanctions metadata
- `EXT-OS-DEBARMENT`
  - debarment, exclusion, or ineligible datasets
- `EXT-OS-PEP`
  - PEP or office-holder datasets for person matches
- `EXT-OS-OFFSHORE`
  - offshore-leaks-style datasets
- `EXT-OS-WATCHLIST`
  - wanted, notice, terrorist, or enforcement datasets

## Current limitations

- This is not the same quality as using OpenSanctions' hosted matcher or a local Yente appliance.
- Exact-name screening will miss many real matches.
- The current connector still prioritizes company screening, and now adds a separate legal-representative person lane; it does not yet screen beneficial owners.
- Legal-representative screening is now active, but it is intentionally review-only and does not create external risk signals from name-only person matches.
- Source-specific local registry codes such as DNCP supplier codes and DNIT equivalence codes are intentionally excluded from identifier-exact matching because they are not known to be comparable with OpenSanctions identifiers.
- Offshore and ownership expansion still depend on stronger local company identity and lawful ownership sources.
- Absence of a match here is not proof that no relevant external context exists.

## Current rerun result

- Rerun date: `2026-04-19`
- OpenSanctions index version: `20260419125302-lsx`
- Local supplier companies screened: 2,534
- DNCP legal representatives screened: 3,165
- OpenSanctions target rows scanned: 1,249,894
- Stored company matches: 0
- Stored accepted representative matches: 0
- Stored review-only candidate records: 1
- Stored rejected diagnostics: 57
- Supplier companies with review-only external candidates: 1
- Stored external risk signals: 0

This means the local identity layer is no longer the main blocker for this connector, and the external layer now has a safer middle state between "accepted match" and "invisible no-match." The current candidate layer is intentionally conservative and review-only. After the tighter candidate-quality pass, it surfaces one company-level review lead and keeps weak person/company overlaps as diagnostics. It still produced zero accepted matches and zero external risk signals.

## Current analyst surfaces

- OpenSanctions entity-screening summary: `data/reports/paraguay/opensanctions-default-entity-screening.md`
- Dedicated external candidate review report: `data/reports/paraguay/external-enrichment-candidate-review.md`
- Manual review command: `npm run database:review-external-candidate -- --candidate-id 59 --status needs_evidence --reviewer "Analyst Name" --notes "Review note"`
- IDB source-check command for IADB candidates: `npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --update-review true`
- Company-level queue: `data/reports/paraguay/all-entities-intelligence-queue.md`
- Candidate-aware entity dossiers under `data/reports/paraguay/entities/`

## Immediate next methodology step

- Keep this conservative baseline.
- Use the hosted OpenSanctions API trial as the first authenticated comparison path, via `POST /match/default?algorithm=logic-v2`; keep self-hosted Yente as a later architecture option if volume, sovereignty, or cost makes it worthwhile.
- Use the manual review-status workflow and row-level source-document checks for `entity_enrichment_candidates`, then improve local candidate scoring with stronger name-order, identifier, document, and representative evidence before accepting any candidate.
- Add separate ownership/person screening only when lawful owner or representative evidence supports the person link.
- Then revisit ownership edges and offshore traversal on top of the stronger local company layer.
