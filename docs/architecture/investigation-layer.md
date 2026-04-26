# Investigation layer

## Current state

Centinela now has a first internal investigation layer built on top of PostgreSQL rather than a UI:

- normalized bundles can be loaded into the VPS database
- SQL views summarize process-level risk, entity activity, buyer-supplier pairings, and review lanes
- CLI commands generate markdown analyst briefs, entity briefs, review queues, external screening reports, official DNCP supplier-anchor reports, and DNIT RUC equivalence identity-validation reports from those views and enrichment tables
- a local-only internal API and console now expose the live investigation layer through entity search, JSON dossiers, graph-ready neighborhoods, review queues, external candidates, and accepted matches

This is still internal, but it is now an operational investigation surface rather than a static export dump.

## Current artifacts

- `centinela.process_risk_overview`
  - process-level risk summary
  - buyer, supplier, contract, payment, and flag context in one queryable surface
- `centinela.buyer_supplier_pair_summary`
  - legacy aggregation layer for repeated buyer-supplier relationships
- `centinela.entity_procurement_activity`
  - entity-centric summary of multi-year procurement activity, signal counts, and linked process value context
- `centinela.buyer_supplier_edge_overview`
  - aggregation layer for repeated buyer-supplier relationships across loaded sources
- `centinela.process_review_queue`
  - turns process-level signals into review priority, review lane, lead question, and recommended-action outputs
- `centinela.risk_rule_registry`
  - canonical metadata layer for current procurement rules
- `centinela.risk_rule_coverage`
  - registry-backed view for live rule coverage and methodology reporting
- `centinela.entity_external_match_overview`
  - external-match surface for local entities, including datasets, countries, match method, and confidence
- `centinela.entity_external_risk_overview`
  - per-entity summary of external risk signals and match counts
- `centinela.entity_local_profile_overview`
  - official Paraguay local-profile surface for DNCP supplier facts and DNIT identity-validation facts
- `centinela.entity_intelligence_signal_overview`
  - non-process intelligence signals such as DNCP supplier administrative history
- `centinela.entity_representative_overview`
  - supplier-to-representative links for ownership-ready investigation pivots
- `centinela.entity_intelligence_review_queue`
  - company-level review surface for local anchor gaps, local administrative history, representative density, and external-risk follow-up
- `centinela.entity_anchor_coverage_overview`
  - current supplier-anchor coverage summary for Paraguay company intelligence
- `centinela.entity_anchor_gap_review`
  - dedicated backlog for unresolved Paraguay supplier identities, with RUC-like identifiers, observed names, gap reasons, and next resolution steps
- `centinela.entity_enrichment_second_reviews`
  - second-review governance table for `promotable` external candidates before accepted-match insertion
- `centinela.entity_enrichment_second_review_overview`
  - analyst-readable view of second-review decisions, rationale, limitations, and accepted-match IDs
- `npm run serve:internal-console -- --host 127.0.0.1 --port 8787`
  - serves a local analyst console and JSON API for entity search, dossiers, graph-ready networks, queues, candidates, and accepted matches
- `npm run database:analyst-brief -- --source-key ...`
  - generates an internal markdown brief from the database
- `npm run database:review-queue -- --limit ...`
  - generates a follow-up queue shaped around review lanes
- `npm run database:entity-brief -- --name "..."`
  - generates a procurement dossier for a known entity
- `npm run database:rulebook`
  - generates a registry-backed methodology and rule-coverage report
- `npm run enrichment:opensanctions`
  - screens procurement supplier companies against OpenSanctions bulk targets and persists enrichment results
- `npm run enrichment:dncp-supplier-anchor -- --limit 500 --only-unanchored true --offset 0 --concurrency 8`
  - resolves procurement-linked suppliers against official DNCP supplier and sanctions surfaces and persists local company anchors incrementally
- `npm run enrichment:dnit-ruc-equivalence -- --limit 10000 --only-anchor-gaps false`
  - validates procurement-linked supplier RUCs against official DNIT RUC equivalence bulk files and persists bounded local identity profiles
- `npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --update-review true`
  - captures official IDB Open Data row-level evidence for an OpenSanctions/IADB candidate and appends that source check to the candidate review trail
- `npm run database:second-review-external-candidate -- --candidate-id 59 --decision accepted_match --reviewer "Second Reviewer" --rationale "..." --limitations "..."`
  - records a second-review decision for a promotable candidate and can create an accepted enrichment identity match without creating an external risk signal
- `npm run database:entity-intelligence-queue -- --limit 30`
  - generates the company-level follow-up queue for local anchors, local administrative signals, representatives, and external-risk state
- `npm run database:entity-anchor-gaps -- --limit 50`
  - generates the unresolved local supplier-identity backlog for targeted validation before external enrichment escalation

## Reference-system influences

- Aleph
  - investigator-first search and review mindset
  - entity-centric question answering
  - follow-the-money orientation for later document and entity search
- br/acc
  - traceability, reproducibility, and relationship-aware system design
  - per-source entity provenance
- OpenSanctions
  - first live external-risk screening path
  - provenanced external entity records and match-review primitives
- OpenOwnership
  - ownership-readiness pressure through representative and control-style relationship scaffolding
- Dozorro / ProZorro
  - review queue and follow-up semantics
- OpenTender / GTI
  - buyer and supplier aggregation logic
- Open Contracting/Cardinal
  - explainable signal logic and procurement-centered analytical framing
- Sayari
  - entity dossier direction and professional analyst ergonomics benchmark
- QQW / TodosLosContratos
  - company-centric procurement accountability direction, now with live DNCP supplier anchors and DNIT identity-validation profiles
- Rosie
  - suspicion-first but human-review-centered explanation style
- DNCP local precedent
  - Paraguay-specific language, supplier identity, and local administrative legitimacy

## Immediate limitations

- The formal registry exists, but the DNCP public red-flag crosswalk is still incomplete
- The local identity layer now covers 2,533 of 2,534 procurement-linked supplier companies; the remaining gap is a missing-check-digit RUC data-quality issue, not a generic no-source condition
- The first interactive API/console slice is local-only and has no authentication, saved cases, or public deployment posture yet
- Payment analysis is only as complete as the currently loaded DNCP transaction data
- Entity-linked monetary context is still process-linked context, not clean attributed supplier value in all multi-supplier procedures
- Candidate `59` is now accepted through second review as enrichment identity context only. It still lacks a comparable external RUC, and that limitation is preserved in the accepted-match workflow.

## Next step

The next investigation-layer milestone should harden the internal API/console into an analyst workspace: add saved review notes/cases, document/source-record drilldowns, graph export, and public-safe field-level explanations before any public deployment.
