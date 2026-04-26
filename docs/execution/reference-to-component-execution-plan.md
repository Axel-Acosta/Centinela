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
  - now directly shapes a live official supplier and sanctions connector that covers 2,521 of 2,534 procurement-linked supplier companies, not only the procurement backbone
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

## Next extraction priority

- highest priority
  - make evidence bundles easier to create and review with source-record search inside cases, common field-path helpers, and case evidence exports
- next after that
  - recover the missing RUC check digit for the final Paraguay anchor gap and rerun DNIT validation, influenced by DNCP, QQW, Sayari, OpenOwnership, and OpenCorporates
- then
  - improve the local external-candidate scoring model and stage ownership/offshore expansion influenced by OpenOwnership, ICIJ, OpenCorporates, and Sayari

## Still pending deeper extraction

- Integrity Watch: needs a real public-safe flag metadata model and later explorer/filter contract once the rule registry exists.
- OpenSanctions / Open Ownership / OpenCorporates / ICIJ: the first live external connector, the first hosted API comparison run, the PostgreSQL-backed hosted comparison overview, the wide official Paraguay supplier anchor, the DNIT identity-validation layer, the representative/person screening lane, the candidate-review table, the manual review-state workflow, the official IDB row-level source check, the live second-review governance workflow, the accepted candidate `59` case, the analyst-workspace schema, the candidate review report, the anchor-gap review backlog, and the first company-level match-review queue now exist, but they still need better candidate scoring, ownership data, offshore traversal, source-record-to-case workflows, and either renewed hosted API quota or a longer-term Yente/paid-access decision.
- FUNES: needs relationship-aware rules that use political, financial, or oversight context beyond procurement alone.
- Paraguay DNCP red flags work: needs a formal rule crosswalk instead of only language and framing influence.
- RUBLI: needs the exact intended source confirmed, then direct methodology and limitations structure can be borrowed more concretely.
