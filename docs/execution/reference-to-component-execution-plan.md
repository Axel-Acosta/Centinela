# Reference-to-Component Execution Plan

## Purpose

This document turns Centinela's comparative reference universe into implementation pressure.

It is not a passive comparison matrix.

For each major precedent, it states:

- which Centinela component it should shape
- which concrete artifacts should prove that influence
- which data inputs it needs
- which Paraguay adaptation is required
- what is blocked today
- what can be implemented now
- what belongs to a later stage
- how it interacts with the already-built DNCP/PostgreSQL foundation

## Current component backbone

- Procurement backbone
  - DNCP OCDS bulk/API ingestion
  - PostgreSQL normalized procurement store
  - process, contract, transaction, and risk-signal pipeline
- Entity intelligence
  - shared `entities` and `entity_identifiers`
  - `entity_source_mentions`
  - `entity_procurement_activity`
  - `buyer_supplier_edge_overview`
  - entity brief generator
  - `entity_local_profiles`
  - `entity_intelligence_signals`
  - `entity_representative_overview`
  - `entity_intelligence_review_queue`
  - `entity_anchor_coverage_overview`
  - `entity_anchor_gap_review`
  - `entity_enrichment_matches`
  - `entity_external_risk_signals`
  - `entity_external_match_overview`
  - DNCP supplier-anchor report
  - entity anchor-gap report
  - OpenSanctions screening report
  - entity source-pack workflow
- Review and follow-up
  - `process_review_queue`
  - analyst brief generator
  - review-lane and recommended-action heuristics
- Explainability and methodology
  - explainable risk signals with evidence
  - strong non-accusatory language
  - growing limitations discipline
- Future expansion lanes
  - formal rule registry
  - enrichment connectors
  - internal API and console
  - public transparency explorer

## 1. Bruno Cesar's br/acc

- Centinela components
  - source registry discipline
  - provenance architecture
  - relationship-aware data model
  - future graph export path
- Proof artifacts
  - `research/resource-registry.md`
  - `memory/source-status.md`
  - `sql/postgres/004_entity_intelligence.sql`
  - `entity_source_mentions`
  - `sql/postgres/006_entity_enrichment.sql`
  - `sql/postgres/007_local_entity_anchor.sql`
  - `sql/postgres/009_entity_anchor_gap_review.sql`
  - `src/enrichment/opensanctions.ts`
  - `sql/postgres/012_entity_enrichment_candidates.sql`
  - `sql/postgres/014_external_candidate_review_workflow.sql`
  - `src/storage/candidateReview.ts`
  - `src/enrichment/dncpSupplierAnchor.ts`
  - `src/enrichment/dncpReleaseSourceCheck.ts`
  - `src/enrichment/dncpDocumentContent.ts`
  - `src/storage/entitySourcePack.ts`
- Data inputs
  - all source metadata
  - entity identifiers
  - relationship observations from procurement and later enrichment
- Paraguay adaptation
  - keep Paraguay source universe primary
  - preserve br/acc's graph mindset without forcing Neo4j now
- Blocked today
  - no graph sidecar or graph export yet
  - limited non-DNCP relationship sources
- Implement now
  - keep every entity and process tied to source lineage
  - extend source registry and provenance per entity/source
  - store matched external rows in `source_records`
  - store official DNCP release packages and document metadata as source records for entity-linked casework
  - store selected official DNCP document captures, hashes, and extraction status as entity-linked source records
  - turn entity-linked source records into case evidence links, source bundles, and source-document indexes through one command
- Later stage
  - graph exports and public cross-reference explorer
- Interaction with current foundation
  - directly shapes the Postgres schema and the multi-source entity layer

## 2. OCCRP Aleph

- Centinela components
  - entity-centric investigation
  - search and case workflow
  - document-ready evidence model
- Proof artifacts
  - `docs/architecture/investigation-layer.md`
  - `docs/architecture/analyst-workflows.md`
  - `src/storage/analyst.ts`
  - entity brief report outputs
  - `docs/methodology/dncp-release-source-check.md`
  - `src/enrichment/dncpReleaseSourceCheck.ts`
  - `docs/methodology/dncp-document-content-extraction.md`
  - `src/enrichment/dncpDocumentContent.ts`
  - `docs/methodology/entity-source-pack-workflow.md`
  - `src/storage/entitySourcePack.ts`
- Data inputs
  - normalized entities
  - processes, contracts, transactions, documents later
- Paraguay adaptation
  - start with procurement intelligence and entity dossiers before full document vault features
- Blocked today
  - no document ingestion/OCR layer
  - no internal API or case-management surface
- Implement now
  - entity briefs
  - search-friendly views
  - later API contracts shaped around entity answers
  - source-record/document metadata capture for official DNCP release packages tied to selected entities
  - selected official DNCP document capture and bounded text-extraction attempts tied to entity dossiers
  - entity source packs that create cases, evidence links, source bundles, and source-document indexes from entity-linked source records
- Later stage
  - document search, timelines, network explorer, saved cases
- Interaction with current foundation
  - turns the existing process-level database into an investigator-facing system

## 3. DOZORRO + ProZorro

- Centinela components
  - review queue
  - follow-up lanes
  - oversight workflow
  - eventual internal/public split
- Proof artifacts
  - `process_review_queue`
  - `all-sources-review-queue.md`
  - review priority and review lane logic in `src/storage/analyst.ts`
- Data inputs
  - process-level risk signals
  - buyer-supplier recurrence
  - later complaint, watchdog, or oversight datasets
- Paraguay adaptation
  - use follow-up prompts rather than copying Ukrainian complaint flows
- Blocked today
  - no Paraguay-specific complaint/escalation partner flow
  - no API or UI for analyst triage
- Implement now
  - heuristic review lanes
  - analyst follow-up prompts
- Later stage
  - civil-society routing, review status tracking, institutional escalation mapping
- Interaction with current foundation
  - converts red flags into human work instead of static analytics only

## 4. Integrity Watch: Red Flags

- Centinela components
  - public explainability model
  - flag presentation rules
  - disclaimer language
- Proof artifacts
  - current report language
  - `docs/architecture/red-flag-framework.md`
  - future public explorer requirements in roadmap
- Data inputs
  - stable rule metadata
  - process- and buyer-level filters
- Paraguay adaptation
  - map from DNCP/OCDS structures instead of TED-specific fields
- Blocked today
  - no public UI
  - no formal rule registry yet
- Implement now
  - keep per-flag explanations and non-accusatory wording
- Later stage
  - public red-flag explorer with filters, explanations, and methodology pages
- Interaction with current foundation
  - shapes how current reports and future UI should talk about signals

## 5. OpenTender / GTI

- Centinela components
  - buyer benchmarking
  - market concentration analytics
  - authority and contract-level comparison
- Proof artifacts
  - `buyer_supplier_edge_overview`
  - `entity_procurement_activity`
  - roadmap stage for benchmark views
- Data inputs
  - multi-year procurement history
  - buyer, supplier, and contract series
- Paraguay adaptation
  - start with transparent aggregations before composite scores
- Blocked today
  - no formal benchmark dashboard
  - contract attribution is still limited in multi-supplier procedures
- Implement now
  - buyer/supplier aggregation
  - cross-year concentration review
- Later stage
  - benchmark cards, authority rankings, trend analysis
- Interaction with current foundation
  - adds analytical depth to the multi-year DNCP load

## 6. Open Contracting / Cardinal / OCDS

- Centinela components
  - procurement schema backbone
  - rule documentation discipline
  - validation and calculation staging
- Proof artifacts
  - DNCP OCDS ingestion
  - normalized procurement model
  - current risk-signal families
- Data inputs
  - OCDS releases, records, contracts, transactions
- Paraguay adaptation
  - preserve local fields and data-quality handling
- Blocked today
  - no formal rule registry with field dependencies
  - no coverage/validation layer before scoring
- Implement now
  - keep procurement logic OCDS-first in spirit
  - build the next rule registry around explicit field dependencies
- Later stage
  - direct Cardinal-style rule definitions and coverage diagnostics
- Interaction with current foundation
  - already defines the procurement core and should guide the next rule-registry refactor

## 7. OpenSanctions + Open Ownership + OpenCorporates + ICIJ Offshore Leaks

- Centinela components
  - enrichment connectors
  - sanctions/PEP screening
  - ownership and offshore expansion
- Proof artifacts
  - `entity_identifiers`
  - `entity_source_mentions`
  - `entity_enrichment_matches`
  - `entity_external_risk_signals`
  - `src/enrichment/opensanctions.ts`
  - `src/enrichment/dncpSupplierAnchor.ts`
  - `src/enrichment/dnitRucEquivalence.ts`
  - `docs/execution/paraguay-entity-enrichment-source-plan.md`
  - `docs/methodology/opensanctions-screening.md`
  - `docs/methodology/opensanctions-hosted-api.md`
  - `docs/methodology/idb-sanctions-open-data.md`
  - `docs/methodology/external-candidate-second-review-workflow.md`
  - `docs/methodology/dncp-supplier-anchor.md`
  - `docs/methodology/dnit-ruc-equivalence.md`
  - `sql/postgres/013_hosted_match_comparisons.sql`
  - `sql/postgres/015_external_candidate_second_review.sql`
  - `src/enrichment/idbSanctions.ts`
  - `src/storage/secondReview.ts`
  - `entity_hosted_match_comparison_overview`
  - `data/reports/paraguay/opensanctions-default-entity-screening.md`
  - `data/reports/paraguay/opensanctions-hosted-match-comparison.md`
  - `data/reports/paraguay/idb-sanctions-candidate-59-source-check.md`
  - `data/reports/paraguay/dncp-supplier-anchor-top-200.md`
  - `data/reports/paraguay/dncp-supplier-anchor-unanchored-offset-0-screened-31.md`
  - `data/reports/paraguay/dnit-ruc-equivalence-supplier-universe.md`
  - `data/reports/paraguay/all-entities-anchor-gaps.md`
- Data inputs
  - company identifiers
  - names and external IDs
  - later beneficial ownership statements and sanctions records
- Paraguay adaptation
  - use external sources as layered evidence, not local fact replacement
- Blocked today
  - OpenSanctions hosted matching currently requires authentication
  - broader ownership/company-control data beyond supplier registration and DNIT identity validation is still missing
  - no lawful public beneficial-ownership source has been linked yet
- Implement now
  - OpenSanctions bulk screening against procurement supplier companies and DNCP legal-representative person entities
  - separate review-only candidate and rejected-diagnostic storage for near external matches that should not be treated as accepted identity resolution
  - official DNCP supplier-profile and sanctions capture keyed by procurement-linked RUCs
  - official DNIT RUC equivalence validation for procurement-linked supplier companies
  - bounded fallback matching for messy local supplier identities and a dedicated anchor-gap review report
  - company-level entity-intelligence queue that separates local anchor gaps, local administrative history, and future external-match review
  - representative-link scaffolding through official supplier records
  - representative/person external screening kept as review-only so name-only person links do not become external risk signals
  - provenance-backed external entity storage and external-risk signals
  - row-level official IDB source checks for IADB/OpenSanctions candidates, stored as source records and review evidence rather than accepted matches
  - second-review governance for source-backed candidate promotion, with rationale, limitations, and accepted-match insertion separated from external risk-signal creation
  - durable source plan for company, sanctions, ownership, and offshore expansion
- Later stage
  - enrichment pipelines, ownership graph expansion, sanctions hit surfaces
- Interaction with current foundation
  - the live procurement entity layer now screens local supplier companies against an external-risk universe without abandoning the DNCP/PostgreSQL core

## 8. Sayari

- Centinela components
  - analyst answerability
  - entity dossier ergonomics
  - professional-grade risk taxonomy direction
- Proof artifacts
  - entity brief output
  - cross-buyer supplier edge view
  - external enrichment section in entity briefs
  - roadmap requirement for ownership-ready entity APIs
- Data inputs
  - entity identifiers
  - cross-source links
  - later ownership, sanctions, and foreign-company data
- Paraguay adaptation
  - use Sayari as a maturity benchmark, not as a product to imitate literally
- Blocked today
  - no beneficial ownership traversal yet
  - no analyst API or UI
- Implement now
  - entity-centric reports, counterparty edges, official supplier anchors, DNIT identity-validation profiles, representative links, and the first external-match dossier section
- Later stage
  - ownership traversal, richer taxonomy, compliance-style answer surfaces
- Interaction with current foundation
  - pushes Centinela beyond process dashboards into entity intelligence

## 9. FUNES

- Centinela components
  - Latin American risk framing
  - relationship-aware scoring logic
  - journalistic-review bridge
- Proof artifacts
  - review queue language
  - multi-year recurrence analytics
  - roadmap rule-registry stage
- Data inputs
  - procurement history
  - later political, ownership, and oversight links
- Paraguay adaptation
  - keep thresholds and categories Paraguay-specific
- Blocked today
  - no political-finance or official roster data
  - no formal relationship-aware scoring registry
- Implement now
  - keep review outputs framed as leads for scrutiny
- Later stage
  - regional risk families tied to political/business relationships
- Interaction with current foundation
  - supports the move from single-rule flags toward richer Latin American risk logic

## 10. QuiénEsQuién.wiki / TodosLosContratos

- Centinela components
  - contracts-companies-actors accountability layer
  - public accountability map
  - company-centric contract transparency
- Proof artifacts
  - entity brief
  - buyer-supplier edges
  - roadmap public accountability stage
- Data inputs
  - procurement entities
  - later ownership and company-registry data
- Paraguay adaptation
  - build backend rigor first, then public accountability presentation
- Blocked today
  - no ownership join yet
  - no public contract-company UI
- Implement now
  - company-centric procurement dossiers with identifiers, official supplier anchors, DNIT identity-validation profiles, representative links, and external-enrichment sections
  - captured official contract documents and hashes for selected company dossiers
- Later stage
  - public accountability explorer linking contracts, companies, owners, and institutions
- Interaction with current foundation
  - the cross-year entity layer created in this run is the first real bridge toward this model

## 11. Rosie / Operacao Serenata de Amor

- Centinela components
  - suspicion-first framing
  - review queue handoff
  - public-readable explanation style
- Proof artifacts
  - review queue language
  - current report disclaimers
- Data inputs
  - anomaly families
  - later spending and reimbursement datasets outside procurement
- Paraguay adaptation
  - keep procurement central while borrowing the hypothesis-and-review posture
- Blocked today
  - no non-procurement spending source integrated
- Implement now
  - human-review-first queue semantics
- Later stage
  - anomaly modules for other Paraguay spending sources
- Interaction with current foundation
  - helps keep automated outputs interpretable and non-accusatory

## 12. Paraguay's DNCP red flags work

- Centinela components
  - local terminology
  - local legitimacy
  - future rule mapping
- Proof artifacts
  - DNCP-oriented flag names and caution language
  - roadmap requirement for rule-registry mapping
- Data inputs
  - DNCP public red-flag definitions
  - DNCP OCDS procurement data
- Paraguay adaptation
  - treat DNCP as institutional precedent, not as something to overwrite
- Blocked today
  - no explicit rule crosswalk yet
- Implement now
  - keep local framing in reports and queue outputs
- Later stage
  - publish crosswalk between Centinela rules and DNCP-style indicators
- Interaction with current foundation
  - grounds the entire Paraguay procurement layer in local reality

## 13. RUBLI

- Centinela components
  - methodology transparency
  - limitations disclosure
  - reproducible scoring discipline
- Proof artifacts
  - current caution language
  - roadmap requirement for formal methodology pages and rule registry
- Data inputs
  - confirmed primary RUBLI source still needed
- Paraguay adaptation
  - apply the transparency principle now even before the exact reference is confirmed
- Blocked today
  - exact intended RUBLI source is unresolved
- Implement now
  - keep limitations explicit and avoid opaque aggregate scores
- Later stage
  - once the source is confirmed, integrate any reusable methodological structure directly
- Interaction with current foundation
  - keeps Centinela's next scoring layer explainable and publicly defensible

## This run's concrete advancement

- br/acc
  - strengthened provenance through `entity_source_mentions`, `source_records`, official DNCP supplier profiles, source-backed external matching, and a first-class unresolved-anchor backlog
- Aleph
  - expanded entity briefs into stronger investigator-facing answers with local supplier, representative, external-context, and entity-triage sections
- Dozorro/ProZorro
  - added review queue lanes and follow-up prompts
- OpenTender/GTI
  - added cross-year buyer-supplier aggregation and entity activity views
- Open Contracting/Cardinal/OCDS
  - remains the procurement backbone that external screening now enriches instead of replacing
- OpenSanctions
  - implemented the first live external-risk connector through public bulk screening, expanded it from company-only matching into a conservative representative/person lane, added a separate candidate-review layer for near matches and rejected diagnostics, tightened weak overlap logic so only one strong company candidate currently escalates, completed the first hosted API comparison pass after OpenSanctions confirmed Centinela eligibility, persisted hosted comparison evidence into PostgreSQL-backed queue/dossier workflows, added manual review statuses plus reviewer-note history for external candidates, added an official IDB Open Data row-level source check for the first IADB-derived candidate, and added a repo-side second-review workflow for accepted-match governance
- OpenOwnership
  - made the model more ownership-ready through representative links, company-level relationship review, and documented source blockers
- OpenCorporates
  - incorporated it into the source plan and the stronger local-company-anchor context that future foreign-company validation will depend on
- ICIJ Offshore Leaks
  - created the concrete staging path for offshore-link expansion on top of the now-live DNCP supplier master layer
- Sayari
  - moved toward entity-centric intelligence instead of process-only review, with local company anchors, representative links, direct external-match dossier sections, representative-linked external diagnostic sections, a company-level review queue, a dedicated external-candidate review report, and a hosted matcher comparison scaffold
- QuiénEsQuién/TodosLosContratos
  - created company-centric procurement dossiers plus a company-level queue that separates supplier accountability review from process-only red-flag triage
- DNCP
  - now directly shapes a live official supplier and sanctions connector that covers 2,521 of 2,534 procurement-linked supplier companies, plus an official release/document source-record lane for high-priority entity casework, not only the procurement backbone
- DNIT
  - now contributes a live taxpayer identity-validation connector covering 2,518 procurement-linked supplier companies and resolving 12 of the 13 previous local anchor gaps without automating human-oriented profile flows
- Rosie
  - reinforced automation-to-human-review workflow language
- DNCP
  - remains the grounding procurement backbone while the entity layer widens outward

## 2026-04-26 internal API and console advancement

- br/acc
  - advanced through `src/storage/internalApi.ts`, which exposes source-linked entity records and graph-ready one-hop neighborhoods without forcing an immediate graph database.
- Aleph
  - advanced through entity search, JSON dossier endpoints, and the first local investigation console at `src/server/internalConsole.ts`.
- Sayari
  - advanced through entity-centric answer surfaces that combine local profiles, representatives, accepted matches, candidates, second reviews, counterparty edges, and procurement processes.
- Dozorro/ProZorro
  - advanced through API access to entity and process review queues, preserving review lanes and recommended actions as operational workflow objects.
- Integrity Watch
  - advanced through a first internal console that keeps non-accusatory guardrail language visible before any public UI exists.
- OpenTender/GTI
  - advanced through API exposure of process queues, entity activity, buyer-supplier edges, contract values, and review-priority sorting.
- Open Contracting/Cardinal/OCDS
  - advanced because process endpoints continue to expose procurement records and signals from the DNCP/OCDS-backed rule foundation instead of bypassing it.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - advanced through endpoints for accepted external matches, review-only candidates, candidate diagnostics, identifiers, and graph-ready external-match edges that can later support ownership/offshore expansion.
- FUNES
  - advanced by making relationship-aware review lanes queryable rather than leaving regional risk logic only in reports.
- QuiénEsQuién/TodosLosContratos
  - advanced through company-search and company-profile API surfaces that connect suppliers, contracts, buyers, representatives, and accepted external context.
- Rosie / Serenata
  - advanced through a console posture that keeps suspicious leads tied to human review rather than automated conclusions.
- Paraguay DNCP red flags work
  - advanced because the API/console exposes local DNCP process and entity review surfaces without detaching them from Paraguay's institutional procurement context.
- RUBLI
  - advanced through endpoint and console disclaimers, explicit limitations in accepted-match outputs, and no opaque aggregate guilt score.

Concrete proof artifacts:

- `src/storage/internalApi.ts`
- `src/server/internalConsole.ts`
- `npm run serve:internal-console`
- `docs/architecture/internal-api-console.md`

## 2026-04-26 analyst workspace hardening advancement

- br/acc
  - advanced through `sql/postgres/016_analyst_workspace.sql`, source-record drilldowns, and graph exports that keep relationship exploration tied to provenance.
- Aleph
  - advanced through saved notes, saved cases, source-record drilldowns, and entity-centric casework primitives inside the internal console/API.
- Sayari
  - advanced through graph export and target-linked notes that start to resemble mature entity-intelligence analyst workflows.
- Dozorro/ProZorro
  - advanced through token-protected notes and cases that preserve human follow-up rather than leaving review queues as read-only lists.
- Integrity Watch
  - advanced because the workspace keeps limitations and non-accusatory language visible before anything becomes public-facing.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - advanced because accepted matches, external candidates, source records, and future ownership/offshore edges can now be linked into casework without automatically becoming risk findings.
- FUNES
  - advanced by giving future relationship-aware Latin American risk leads a saved analyst context instead of only a score or report row.
- QuiénEsQuién/TodosLosContratos
  - advanced through the caseable company-contract-accountability path: entity, process, source record, accepted match, and note can now live in one workspace model.
- Rosie / Serenata
  - advanced through human-readable notes and follow-up semantics that keep anomaly surfacing review-first.
- Paraguay DNCP red flags work
  - advanced because local DNCP process/entity context can be carried into saved review notes without detaching it from source records.
- RUBLI
  - advanced through explicit note visibility, limitations notes, reproducible source-record drilldowns, and no opaque guilt score.

Concrete proof artifacts:

- `sql/postgres/016_analyst_workspace.sql`
- `src/storage/analystWorkspace.ts`
- `/api/source-records`
- `/api/entities/:id/network/export`
- `/api/analyst-cases`
- `/api/analyst-notes`
- `docs/methodology/analyst-workspace.md`

## 2026-04-26 analyst case timeline/workbench advancement

- br/acc
  - advanced through `centinela.analyst_case_timeline`, which makes case history a source-linked database surface instead of a UI-only artifact.
- Aleph
  - advanced through `GET /api/analyst-cases/:id`, where an analyst can open a case and see linked targets, notes, and timeline events together.
- Sayari
  - advanced by making entity, source, candidate, accepted-match, and second-review links usable inside one case workbench.
- Dozorro/ProZorro
  - advanced because review follow-up can now become a durable case timeline rather than a one-time queue row.
- Integrity Watch
  - advanced by preserving non-accusatory context in the case timeline before any public-facing display is considered.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - advanced because external candidates, accepted matches, source records, and future ownership/offshore records can be linked into case history without becoming automatic risk findings.
- FUNES
  - advanced by giving future relationship-aware regional risk leads a case-history container where human interpretation and limits can be preserved.
- QuiénEsQuién/TodosLosContratos
  - advanced through a stronger company-accountability workbench: a company, its procurement context, source records, and review notes can now be assembled into one case path.
- Rosie / Serenata
  - advanced through citizen-readable anomaly posture kept behind internal analyst notes and timelines until public-safety review exists.
- Paraguay DNCP red flags work
  - advanced because DNCP process/entity review can now carry human follow-up in a timeline without detaching from Paraguay source records.
- RUBLI
  - advanced because the timeline stores rationale, provenance, note visibility, and limitations as review context rather than opaque scoring.

Concrete proof artifacts:

- `sql/postgres/017_analyst_case_timeline.sql`
- `GET /api/analyst-cases/:id`
- case timeline panel in `src/server/internalConsole.ts`
- `getAnalystCase` in `src/storage/analystWorkspace.ts`

## 2026-04-26 analyst evidence-link advancement

- br/acc
  - advanced through `analyst_evidence_links`, a source-registry-aware evidence bundle that keeps source records, case targets, and provenance explicit.
- Aleph
  - advanced by linking source records to case notes and targets so investigation work can preserve document/source evidence next to analyst interpretation.
- Sayari
  - advanced by making entity casework more evidence-oriented: a target can carry source record, field path, interpretation, limitations, and role in one reviewable object.
- Dozorro/ProZorro
  - advanced because review follow-up now has source-backed evidence objects rather than only queue rows and free-text notes.
- Integrity Watch
  - advanced through explainable evidence roles and limitations that can later feed public-safe transparency views.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - advanced because external candidates, ownership/offshore records, and accepted matches can later be tied to exact source fields without automatic accusations.
- FUNES
  - advanced by creating a place for relationship-aware regional risk logic to cite exact source fields and limitations.
- QuiénEsQuién/TodosLosContratos
  - advanced because company-contract accountability cases can now assemble source-backed field explanations around companies, contracts, and relationships.
- Rosie / Serenata
  - advanced through human-readable suspicious-lead explanations that remain internal and review-first.
- Paraguay DNCP red flags work
  - advanced because DNCP source records and field-level procurement facts can be linked into case evidence without detaching from official context.
- RUBLI
  - advanced through reproducible evidence roles, field paths, limitations, and non-accusatory explanation bundles.

Concrete proof artifacts:

- `sql/postgres/018_analyst_evidence_links.sql`
- `POST /api/analyst-cases/:id/evidence-links`
- `analyst_case_evidence_overview`
- evidence-link panel controls in `src/server/internalConsole.ts`

## 2026-04-26 source-record field-helper advancement

- br/acc
  - advanced by making source-record payload fields easier to cite without detaching them from source registry provenance.
- Aleph
  - advanced through investigator ergonomics: source-record search now works inside the case workbench and source fields can flow into case evidence.
- Sayari
  - advanced because analyst-grade dossiers can now preserve exact source field paths, values, and evidence-role hints.
- Integrity Watch / RUBLI
  - advanced because future public explanations can be built from explicit field paths and limitations instead of opaque summaries.
- OpenSanctions / ICIJ / OpenOwnership / OpenCorporates
  - advanced because external/enrichment source records can later be cited at field level while remaining review-first.
- QuiénEsQuién/TodosLosContratos
  - advanced because company accountability cases can connect contracts, companies, and cited source fields in one workbench.

Concrete proof artifacts:

- `fieldSuggestions` in `GET /api/source-records/:id`
- in-case source-record search controls in `src/server/internalConsole.ts`
- field suggestion click-to-fill evidence form behavior in `src/server/internalConsole.ts`

## 2026-04-29 case evidence export and public-safety gate advancement

- br/acc
  - advanced through source-linked case evidence export that keeps provenance, source record IDs, source keys, external IDs, and field paths attached to every exported evidence row.
- Aleph
  - advanced because saved cases can now be packaged as evidence bundles and reviewed for public-safety state, moving closer to investigator casework rather than isolated search results.
- Sayari
  - advanced through analyst-grade governance around when internal evidence can become externally shareable, without collapsing accepted matches, candidates, and evidence into one risk label.
- Dozorro/ProZorro
  - advanced because human follow-up now has a review/escalation gate between internal casework and any outward-facing evidence use.
- Integrity Watch
  - advanced because explainable evidence export now has explicit public-safe summary/limitations requirements before public-only output.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - advanced because enrichment, ownership, foreign-company, and offshore source records can later flow into the same gated evidence-export path without being treated as accusations.
- FUNES
  - advanced by giving future relationship-aware risk leads a disciplined export boundary with limitations and review state.
- QuiénEsQuién/TodosLosContratos
  - advanced because company-contract accountability cases can be assembled into public-safe evidence packages later, not just internal notes.
- Rosie / Serenata
  - advanced through citizen-readable suspicious-lead posture kept behind public-safety review until approved.
- Paraguay DNCP red flags work
  - advanced because DNCP source/context can be exported with limitations and local institutional caution preserved.
- RUBLI
  - advanced through reproducible export gates, explicit limitations, and a clear separation between internal review evidence and public-ready material.

Concrete proof artifacts:

- `sql/postgres/019_case_evidence_exports.sql`
- `POST /api/analyst-cases/:id/public-review`
- `GET /api/analyst-cases/:id/evidence-export`
- public-safety controls in `src/server/internalConsole.ts`
- `reviewAnalystCasePublicSafety` and `getAnalystCaseEvidenceExport` in `src/storage/analystWorkspace.ts`

## 2026-04-30 case evidence artifact advancement

- br/acc
  - advanced because generated case artifacts carry source-record IDs, source keys, external IDs, source URLs, retrieval context, and case evidence rows as durable provenance.
- Aleph
  - advanced because an analyst can now produce a portable case evidence packet instead of relying only on a live console response.
- Integrity Watch
  - advanced because public-only artifacts reuse the explicit `approved_public` gate and preserve public-safe summary/limitations.
- RUBLI
  - advanced through reproducible Markdown/JSON artifacts with methodology warnings, use limits, source index, and non-accusatory language.
- QuiénEsQuién/TodosLosContratos
  - advanced because future company-contract accountability pages can draw from source-indexed case artifacts rather than raw notes.
- Sayari
  - advanced through more professional evidence packaging around entity/case review.

Concrete proof artifacts:

- `src/storage/caseEvidenceExport.ts`
- `npm run database:case-evidence-export`
- Markdown and JSON runtime artifacts under `CENTINELA_OUTPUT_DIR/reports/cases/<case-key>/`

## 2026-04-30 source attachment manifest advancement

- br/acc
  - advanced because source-run assets, source records, source URLs, hashes, retrieval context, and local path state are now joined into one manifest instead of staying scattered across ingestion tables.
- Aleph
  - advanced because case exports now have an attachment checklist that helps analysts move from evidence summaries toward source-document review.
- Sayari
  - advanced through more professional source-chain handling: assets, hashes, URLs, and availability are explicit before any deeper graph/entity case package is shared.
- Integrity Watch
  - advanced because public-only manifests reuse the `approved_public` gate and keep public-safe limitations visible.
- RUBLI
  - advanced through reproducible attachment manifests with explicit use limits and path-status caveats.
- QuiénEsQuién/TodosLosContratos
  - advanced because future public company-contract accountability pages can trace which source assets support a case packet without mixing source files into Git.

Concrete proof artifacts:

- `buildCaseSourceAttachmentManifestArtifacts` in `src/storage/caseEvidenceExport.ts`
- `npm run database:case-source-manifest`
- Markdown and JSON runtime manifests under `CENTINELA_OUTPUT_DIR/reports/cases/<case-key>/`

## 2026-04-30 source bundle advancement

- br/acc
  - advanced because source-run assets can now be copied into a case packet while preserving source records, source URLs, path-resolution status, hashes, and provenance.
- Aleph
  - advanced because saved cases now have a portable local bundle shape with evidence files, source manifests, and attachments, moving closer to document-centered casework.
- Sayari
  - advanced through analyst-grade packaging of source files, bundle indexes, copy status, and hash checks before any stronger entity graph workflow or public surface.
- Integrity Watch
  - advanced because public-only bundles reuse the `approved_public` gate while preserving explicit warnings that raw copied files are not automatically public-ready.
- RUBLI
  - advanced through reproducible bundle contents, use limits, and a clear distinction between evidence, source files, and findings.
- QuiénEsQuién/TodosLosContratos
  - advanced because future company-contract accountability outputs can be assembled from traceable local source packets instead of loose files or raw notes.

Concrete proof artifacts:

- `buildCaseSourceBundleArtifacts` in `src/storage/caseEvidenceExport.ts`
- `npm run database:case-source-bundle`
- local runtime source bundles under `CENTINELA_OUTPUT_DIR/reports/cases/<case-key>/<timestamp>-<mode>-source-bundle/`

## 2026-05-01 source-document index advancement

- br/acc
  - advanced because bundled source files can now be indexed with source-record IDs, evidence-link IDs, source asset metadata, hashes, and source URLs preserved.
- Aleph
  - advanced because case bundles now support local document search and snippets, moving Centinela closer to investigator document-intelligence workflows without adding a heavy search engine yet.
- Sayari
  - advanced through analyst-grade traceability from a document hit back to source records, evidence links, entities/targets, and asset provenance.
- Integrity Watch
  - advanced because indexed snippets remain behind public-safety gates and keep use-limit warnings before any public-facing display.
- RUBLI
  - advanced through reproducible JSON/Markdown/JSONL indexes and explicit limitations around source verification and public reuse.
- QuiénEsQuién/TodosLosContratos
  - advanced because future company-contract accountability pages can be backed by searchable, source-linked case bundles rather than unstructured local files.

Concrete proof artifacts:

- `buildCaseSourceDocumentIndexArtifacts` in `src/storage/caseEvidenceExport.ts`
- `npm run database:case-source-index`
- `source-document-index.json`, `source-document-index.md`, and `source-document-index.jsonl` inside local runtime source bundles

## 2026-05-01 case artifact API/console advancement

- br/acc
  - advanced because source-linked case packets, source manifests, and source-document indexes are now generated through stable local API routes without weakening source-registry provenance.
- Aleph
  - advanced because document/case packet workflows moved from CLI-only commands into the investigator console, closer to entity-centric casework and source navigation.
- Sayari
  - advanced because analysts can create and refresh source-backed case packets from one case workbench while preserving counts, paths, copied-asset status, and query-match evidence.
- Integrity Watch
  - advanced because public-only artifact generation remains gated by `approved_public` and visible limitations before any public-facing display.
- RUBLI
  - advanced through reproducible API-generated artifacts, explicit local-output boundaries, write-token protection, public-gate enforcement, and non-accusatory disclaimers.
- QuiénEsQuién/TodosLosContratos
  - advanced because future company-contract accountability pages can now draw from console-generated case packets rather than ad hoc local files.

Concrete proof artifacts:

- `POST /api/analyst-cases/:id/evidence-artifacts`
- `POST /api/analyst-cases/:id/source-manifests`
- `POST /api/analyst-cases/:id/source-bundles`
- `POST /api/source-document-indexes`
- case artifact controls in `src/server/internalConsole.ts`
- live smoke result recorded in `memory/run-log.md`

## 2026-05-01 case artifact registry advancement

- br/acc
  - advanced because generated evidence/source packets remain source-registry-linked while becoming rediscoverable through a stable case endpoint.
- Aleph
  - advanced because analysts can reopen case packet and document-index summaries after generation, closer to persistent casework rather than one-off exports.
- Sayari
  - advanced because entity/case review now has a more professional artifact-discovery surface with bundle paths, file existence, copied-asset counts, and source-index counts.
- RUBLI
  - advanced because generated artifacts remain reproducible and limitation-aware without becoming opaque scores or public findings.
- QuiénEsQuién/TodosLosContratos
  - advanced because future public accountability pages can trace from a case to the existing local bundle/index summary instead of rebuilding source context from scratch.

Concrete proof artifacts:

- `src/storage/caseArtifacts.ts`
- `GET /api/analyst-cases/:id/artifacts`
- generated-artifact loader in `src/server/internalConsole.ts`
- progress estimate in `docs/execution/progress-and-remaining-work.md`

## 2026-05-01 OpenSanctions rerun-safety and candidate-evidence advancement

- br/acc
  - advanced because baseline external-source refreshes now preserve reviewed candidate rows and second-review audit trails instead of destroying source-linked institutional memory.
- OpenSanctions
  - advanced because the 2026-05-01 bulk rerun used index `20260501065427-hyu`, refreshed local evidence, preserved accepted candidate `59`, and added distinctive-token, generic-token, distinctive-overlap, and name-order evidence to candidate rows.
- Sayari
  - advanced because entity intelligence now distinguishes strong identity-context evidence from generic name noise, making dossiers and review queues more analyst-grade.
- Aleph
  - advanced because external-candidate reports now explain why a candidate was surfaced or downgraded, and closed second-review rows no longer show invalid first-review commands.
- RUBLI
  - advanced because matching limitations became more transparent and reproducible: generic business/sector overlap is explicitly downgraded rather than hidden or over-scored.
- QuiénEsQuién/TodosLosContratos
  - advanced because company-accountability outputs now show which name evidence is locally meaningful before any public-facing company-contract narrative is built.

Concrete proof artifacts:

- `src/enrichment/opensanctions.ts`
- `src/storage/analyst.ts`
- `docs/methodology/opensanctions-screening.md`
- `docs/methodology/external-candidate-review-workflow.md`
- live rerun result recorded in `memory/run-log.md`

## 2026-05-03 DNCP release source-record advancement

- br/acc
  - advanced because official DNCP release packages and document metadata now become first-class `source_records` linked back to local entities, source URLs, process IDs, and field paths.
- Aleph
  - advanced because entity dossiers now expose official source-record/document metadata that can be linked into cases and source bundles.
- Sayari
  - advanced because high-priority company dossiers now carry source-backed document-navigation evidence instead of relying only on summary procurement rows.
- QuiénEsQuién/TodosLosContratos
  - advanced because company-contract accountability can now cite official process-document metadata and release packages for selected companies.
- DNCP local precedent / OCDS / Cardinal
  - advanced because the connector uses official DNCP OCDS release packages as the document/source spine rather than a detached scrape.
- Integrity Watch / RUBLI
  - advanced because the methodology explicitly separates source evidence from findings, preserves field paths/source URLs, and states limitations around missing RUC check digits and public reuse.

Concrete proof artifacts:

- `src/enrichment/dncpReleaseSourceCheck.ts`
- `npm run enrichment:dncp-release-source-check`
- `docs/methodology/dncp-release-source-check.md`
- entity brief `Official source records and documents` section
- live source key `py-dncp-release-source-check`
- current live state: 4 official release package records and 567 official document metadata records across `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`

## 2026-05-04 DNCP document content-capture advancement

- br/acc
  - advanced because selected official DNCP documents are now captured as source assets with source URLs, hashes, parent source-record IDs, local entity links, and `document_content_extract` records.
- Aleph
  - advanced because entity dossiers now move from document metadata to captured official files that can feed case bundles and later document search/OCR.
- Sayari
  - advanced because analyst-grade entity briefs now show source-document capture state, hash evidence, extraction status, and limitations in one place.
- QuiénEsQuién/TodosLosContratos
  - advanced because company-contract accountability can now cite captured official contract PDFs, not only procurement summaries or metadata rows.
- DNCP local precedent / OCDS / Cardinal
  - advanced because the connector starts from official DNCP OCDS document metadata and preserves field paths back to the source release.
- Integrity Watch / RUBLI
  - advanced because `no_extractable_text` is exposed as a parser/OCR limitation, not hidden or treated as absence of evidence, and the output repeats non-accusatory use limits.

Concrete proof artifacts:

- `src/enrichment/dncpDocumentContent.ts`
- `scripts/extract_pdf_text.py`
- `npm run enrichment:dncp-document-content`
- `docs/methodology/dncp-document-content-extraction.md`
- entity brief source-record capture fields
- live source key `py-dncp-document-content`
- current live state: 2 captured official contract PDFs across `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`; both downloaded and hashed, both `no_extractable_text` with the current parser

## 2026-05-06 entity source-pack advancement

- br/acc
  - advanced because entity-linked source records now become a reusable source-registry-driven case packet with source keys, record IDs, source URLs, record kinds, retrieval context, and generated evidence metadata preserved.
- Aleph
  - advanced because an analyst can start from an entity and produce a case, evidence links, source bundle, and document index without manually wiring each source record.
- Sayari
  - advanced because company/person dossiers can now move into analyst-grade source packets that preserve identity context, evidence roles, limitations, and source-document traceability.
- QuiénEsQuién/TodosLosContratos
  - advanced because contracts-plus-company accountability can now be assembled from official DNCP release/document records and captured files at the entity level.
- DNCP local precedent / OCDS / Cardinal
  - advanced because the first live use case starts from official DNCP OCDS release packages, document metadata, and captured official documents.
- Integrity Watch / RUBLI
  - advanced because the workflow repeats public-safety gates, limitations, parser/OCR caveats, and non-accusatory wording while producing reproducible Markdown/JSON outputs.

Concrete proof artifacts:

- `src/storage/entitySourcePack.ts`
- `npm run database:entity-source-pack`
- `POST /api/entities/:id/source-packs`
- case workbench source-pack preview/write controls in `src/server/internalConsole.ts`
- `docs/methodology/entity-source-pack-workflow.md`
- local runtime reports under `reports/paraguay/entity-source-packs/`
- live cases `19` and `20` for the first two DNCP-covered high-priority entities

## 2026-05-06 source-pack readiness and rollout advancement

- br/acc
  - advanced because the source-pack rollout now has a source-registry coverage report instead of relying on ad hoc memory, and every recommended action is tied to entity IDs, source-record counts, source-pack cases, and evidence-link counts.
- Aleph
  - advanced because more high-priority entities now have actual case packets, evidence links, source bundles, and source-document indexes that analysts can open and review.
- Sayari
  - advanced because high-volume company dossiers now move closer to mature entity-intelligence workflows: source coverage, representatives, local profile sources, document attempts, and case evidence are visible together.
- QuiénEsQuién/TodosLosContratos
  - advanced because company-contract accountability now covers three more major supplier entities with official DNCP release/document metadata and traceable case packets.
- DNCP local precedent / OCDS / Cardinal
  - advanced because the widening stayed grounded in official DNCP release packages and document metadata, not scraped summaries or unsupported claims.
- Integrity Watch / RUBLI
  - advanced because the readiness report separates `ready_for_internal_review_with_document_download_limits` from successful document capture, preserving transparent limitations when DNCP document URLs return `404`.

Concrete proof artifacts:

- `src/storage/entitySourcePackReadiness.ts`
- `npm run database:entity-source-pack-readiness`
- live `py-dncp-release-source-check` state: 10 official release package records and 1,462 official document metadata records
- live `py-dncp-document-content` state: 8 document-content records, including 6 priority-company DNCP `404` limitation records
- live source-pack cases `22`, `23`, and `24` for `PROSALUDFARMA S.A.`, `INDEX S.A.C.I.`, and `QUIMFA S.A.`
- latest readiness report under local runtime `reports/paraguay/entity-source-pack-readiness.md`

## 2026-05-12 Command Center product-surface advancement

- br/acc
  - advanced because the visible interface now foregrounds source-linked entities, relationship neighborhoods, source records, and graph-ready exploration instead of hiding them behind JSON-only endpoints.
- Aleph
  - advanced because entity search, dossier-first investigation, source-record drilldowns, source packs, case timelines, and evidence artifacts now sit in one navigable analyst workspace.
- Sayari
  - advanced because Centinela now has a more mature entity-intelligence feel: company/person dossiers summarize identity, relationships, local anchors, candidates, accepted context, and limitations before raw JSON.
- QuiénEsQuién/TodosLosContratos
  - advanced because source-pack showcase cards and company-contract dossiers make accountability paths visible around real Paraguay companies instead of abstract architecture.
- Integrity Watch / Dozorro / RUBLI
  - advanced because the interface includes review-first language, workflow separation, queue surfacing, public-safety gates, methodology visibility, and explicit limitations.
- DNCP / OCDS / Cardinal / GTI
  - advanced because official DNCP source-records, procurement processes, source packs, and rule-derived review lanes are now visible in a coherent product shell.

Concrete proof artifacts:

- `src/server/internalConsole.ts`
- `docs/architecture/internal-api-console.md`
- `docs/execution/next-phase-roadmap.md`
- `docs/execution/progress-and-remaining-work.md`
- `memory/run-log.md`

Current interface state:

- local-only Command Center shell
- navigable product sections: overview, entities, dossier, casework, review queues, methodology
- source-pack showcase for `CONSULTORA GUARANI SA INGENIEROS CIVILES`, `PROSALUDFARMA S.A.`, `INDEX S.A.C.I.`, and `QUIMFA S.A.`
- product-style dossier summary plus raw JSON fallback
- relationship summary over graph-ready network output
- source-pack/case artifact controls preserved in the same safety model

## 2026-05-12 Graph/artifact/readiness product-surface advancement

- br/acc
  - advanced because graph-ready relationship data is now visible as an SVG exploration surface, not only as JSON or export payloads.
- Aleph
  - advanced because local case artifacts, source bundles, manifests, and source-document indexes are now browsable from the case workspace with bounded detail previews.
- Sayari
  - advanced because entity intelligence now has visual relationship exploration and filtered review surfaces closer to a mature analyst product.
- QuiénEsQuién/TodosLosContratos
  - advanced because company-contract source packs and readiness actions are now visible in the product layer as accountability workflows.
- Dozorro / ProZorro / Integrity Watch
  - advanced because review queues are filterable and more usable for follow-up routing.
- RUBLI
  - advanced because artifact previews and readiness panels keep limitations and non-public use boundaries visible while making the system easier to inspect.

Concrete proof artifacts:

- `src/server/internalConsole.ts`
- `src/storage/caseArtifacts.ts`
- `src/storage/entitySourcePackReadiness.ts`
- `GET /api/entity-source-pack-readiness`
- `GET /api/analyst-cases/:id/artifact-detail`
- updated internal API/console and roadmap docs

## 2026-05-12 Case-packet/source-index product-surface advancement

- br/acc
  - advanced because case packets and artifact previews make source-record IDs, source keys, evidence-link IDs, local bundle paths, and graph relationships visible as navigable provenance rather than hidden runtime detail.
- Aleph
  - advanced because saved cases now read like investigator review packets: linked targets, source-backed evidence, public-safety state, timeline events, and local document-index matches are visible in one place.
- Sayari
  - advanced because the entity/case surface now feels closer to analyst-grade entity intelligence, with graph filters, dossier-to-case pivots, source match snippets, and limits displayed before raw data.
- QuienEsQuien / TodosLosContratos
  - advanced because company-contract accountability packs are easier to explain: an entity source pack can be opened as a case, its source documents can be previewed, and source records can be reopened from match rows.
- Integrity Watch / Dozorro / RUBLI
  - advanced because the visible case workflow keeps public-safety gate status, review-only language, and limitations attached to every packet and preview rather than hiding them in exports.
- DNCP / OCDS / Cardinal / GTI
  - advanced because official DNCP release/document source records remain the backbone of the current source packs, while procurement review evidence is now easier to inspect from the interface.

Concrete proof artifacts:

- graph relation/type filters and network limit controls in `src/server/internalConsole.ts`
- readable case review packet in `src/server/internalConsole.ts`
- artifact/source-document match preview in `src/server/internalConsole.ts`
- live smoke result recorded in `memory/run-log.md`

## Next extraction priority

- highest priority
  - finish the next internal-product MVP slice: public-methodology/limitations pages inside the local interface, smoother entity-to-case/source-pack navigation, and safer artifact/source verification affordances
- next after that
  - move to the next lawful Paraguay cross-domain source, preferably company/officer/ownership-adjacent accountability data if access is lawful and practical
  - continue readiness-ranked DNCP release/document source-record checks across the highest-priority companies/candidates and use `py-dncp-document-content` only for source records that need captured official files or explicit source-access limitation records
  - add OCR only for case-priority scanned PDFs after weighing dependency cost, privacy/source-review burden, and concrete analyst value
  - revisit the final RUC anchor gap only when a new lawful source can expose the missing check digit; DNIT bulk, DNCP OCDS JSON, DNCP supplier search, and locally parsed official PDFs did not resolve it
- then
  - stage ownership/offshore expansion influenced by OpenOwnership, ICIJ, OpenCorporates, and Sayari on top of the safer candidate-evidence and review-preservation baseline

## Still pending deeper extraction

- Integrity Watch: needs a real public-safe flag metadata model and later explorer/filter contract once the rule registry exists.
- OpenSanctions / Open Ownership / OpenCorporates / ICIJ: the first live external connector, the first hosted API comparison run, the PostgreSQL-backed hosted comparison overview, the wide official Paraguay supplier anchor, the DNIT identity-validation layer, the representative/person screening lane, the candidate-review table, the manual review-state workflow, the official IDB row-level source check, the live second-review governance workflow, the accepted candidate `59` case, the analyst-workspace schema, the candidate review report, the anchor-gap review backlog, the first company-level match-review queue, safer rerun preservation, and stronger candidate-name evidence now exist, but they still need ownership data, offshore traversal, deeper source-record-to-case workflows, and either renewed hosted API quota or a longer-term Yente/paid-access decision.
- FUNES: needs relationship-aware rules that use political, financial, or oversight context beyond procurement alone.
- Paraguay DNCP red flags work: needs a formal rule crosswalk instead of only language and framing influence.
- RUBLI: needs the exact intended source confirmed, then direct methodology and limitations structure can be borrowed more concretely.
