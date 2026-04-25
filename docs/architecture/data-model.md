# Data model

## Core entities

- `source_runs`: when and how a source pull happened
- `source_assets`: raw source bundles or documents
- `source_records`: retrieved records keyed by source and external ID
- `entities`: normalized people, companies, institutions, documents, and other nodes
- `entity_identifiers`: RUCs, registry numbers, platform IDs, and external identifiers
- `entity_source_mentions`: where and how an entity was observed in each source
- `entity_relationships`: ownership, management, buyer-supplier, official-entity, and other links
- `entity_local_profiles`: official local-source company or entity profiles with match method, confidence, and evidence
- `entity_enrichment_matches`: provenance-backed external-match rows with method, confidence, and review status
- `entity_intelligence_signals`: entity-level local or cross-entity intelligence signals outside pure process scoring
- `entity_external_risk_signals`: sanctions, debarment, offshore, PEP, or watchlist-style external signals tied to a local entity
- `procurement_processes`: tender and process-level normalized records
- `process_parties`: party roles within a process
- `awards`: award-level normalized records
- `contracts`: contract-level normalized records
- `risk_signals`: explainable risk outputs
- `risk_signal_evidence`: URLs, fields, or records supporting each signal

## Design principles

- Keep every normalized object tied back to source system, source record ID, and retrieval time.
- Preserve per-entity source lineage even when the same entity appears across multiple years or sources.
- Support both country-specific fields and a portable common core.
- Avoid losing source semantics while still giving downstream analysts a clean shape.
- Store link confidence and derivation notes for inferred relationships later.
- Keep `entity_relationships` broad enough for future `ownership_beneficial`, `ownership_direct`, `representation_legal`, `possible_external_match`, and offshore-link edges.

## Current derived investigation surfaces

- `process_risk_overview`
  - one-row process summary for risk, parties, values, and source links
- `entity_procurement_activity`
  - entity-centric multi-source procurement activity summary
- `buyer_supplier_edge_overview`
  - relationship summary for repeated buyer-supplier activity
- `process_review_queue`
  - review-priority and follow-up lane surface for human triage
- `entity_external_match_overview`
  - local-entity to external-entity match surface with datasets, countries, signal codes, and match quality
- `entity_external_risk_overview`
  - per-entity summary of external matches and external risk signals
- `entity_local_profile_overview`
  - official Paraguay company-anchor surface for matched supplier profiles, identifiers, activation dates, and representatives
- `entity_intelligence_signal_overview`
  - per-entity non-process intelligence signals, including local administrative supplier history
- `entity_representative_overview`
  - supplier-to-representative relationship surface for ownership-ready or control-ready exploration
- `entity_intelligence_review_queue`
  - company-level triage surface combining local anchors, local administrative history, representative density, external screening state, and recommended next action
- `entity_anchor_coverage_overview`
  - summary surface for anchored vs. unanchored supplier companies and current local/external intelligence coverage
