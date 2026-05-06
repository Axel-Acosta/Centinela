# Next-phase roadmap

## Stage 1 - Cross-year procurement intelligence

- Status
  - operational baseline achieved
  - rule-registry backing achieved; now feeding the enrichment phase
- Core outputs
  - multi-year DNCP bulk load
  - entity provenance table
  - buyer-supplier edge view
  - review queue
  - entity briefs
- Main references
  - br/acc
  - Aleph
  - Dozorro/ProZorro
  - OpenTender/GTI
  - Open Contracting/Cardinal/OCDS
  - Sayari
  - QQW/TodosLosContratos
  - DNCP
  - Rosie

## Stage 2 - Formal rule registry and transparent methodology

- Status
  - operational baseline achieved
  - DNCP crosswalk and publication refinements still pending
- Core outputs
  - structured rule registry in code and documentation
  - stable rule IDs, formulas, dependencies, exclusions, and evidence requirements
  - methodology and limitations pages
  - DNCP-to-Centinela rule crosswalk
- Main references
  - Open Contracting/Cardinal/OCDS
  - OpenTender/GTI
  - FUNES
  - DNCP
  - Integrity Watch
  - Rosie
  - RUBLI

## Stage 3 - Entity enrichment and ownership expansion

- Status
  - operational baseline expanded
  - first Paraguay official company/disqualification connector achieved through the DNCP supplier anchor
  - first Paraguay official taxpayer identity-validation connector achieved through DNIT RUC equivalence bulk files
  - wider Paraguay supplier coverage achieved through incremental unanchored anchoring
  - local identity coverage now reaches 2,533 of 2,534 procurement-linked supplier companies
  - company-level entity-intelligence queue achieved
  - representative-aware OpenSanctions screening achieved as a conservative review-only person lane
  - review-only OpenSanctions candidate layer achieved with separate accepted matches, review candidates, rejected diagnostics, queue/dossier visibility, and a dedicated external-candidate review report
  - candidate policy tightened so weak two-token person overlaps and generic consortium/asociados overlaps do not over-escalate
  - hosted OpenSanctions API comparison achieved after OpenSanctions confirmed Centinela eligibility and recommended a hosted trial before self-hosted Yente
  - hosted comparison evidence is now persisted into PostgreSQL and reused by the queue, candidate-review report, and entity dossiers
  - manual external-candidate review workflow achieved through `sql/postgres/014_external_candidate_review_workflow.sql`, `centinela.entity_enrichment_candidate_review_overview`, `src/storage/candidateReview.ts`, and `npm run database:review-external-candidate`
  - official IDB Open Data row-level source checking achieved for IADB/OpenSanctions candidates through `src/enrichment/idbSanctions.ts` and `npm run enrichment:idb-sanctions-candidate`
  - official DNCP release/document source-record checking achieved through `src/enrichment/dncpReleaseSourceCheck.ts` and `npm run enrichment:dncp-release-source-check`
  - current `py-dncp-release-source-check` state: 4 official release package source records and 567 official document metadata records across two high-priority entities
  - selected official DNCP document capture achieved through `src/enrichment/dncpDocumentContent.ts`, `scripts/extract_pdf_text.py`, and `npm run enrichment:dncp-document-content`
  - current `py-dncp-document-content` state: 2 captured official contract PDFs, both downloaded and hashed, both `no_extractable_text` with the current parser
  - repo-side second-review accepted-match workflow achieved through `sql/postgres/015_external_candidate_second_review.sql`, `src/storage/secondReview.ts`, `npm run database:second-review-external-candidate`, and the second-review methodology note
  - live second-review accepted-match case achieved for candidate `59`, with accepted enrichment match ID `11` and zero external risk signals created by the second-review workflow
  - current blocker: the trial key hit a monthly `429` rate limit after the first live comparison pass
  - still needs recovery of the final missing RUC check digit and the next ownership-ready/company-accountability source
- Core outputs
  - first live external-risk connector through OpenSanctions bulk screening
  - first Paraguay company or registry connector
  - first Paraguay RUC/taxpayer identity-validation connector
  - first official supplier sanctions/disqualification connector
  - enrichment match review workflow
  - external candidate review workflow
  - hosted matcher comparison workflow
  - row-level source-document evidence workflow for selected external candidates
  - official DNCP release/document metadata source-record workflow for selected entity dossiers
  - selected official DNCP document capture and bounded text-extraction attempt workflow
  - ownership-ready relationship model
- Main references
  - OpenSanctions
  - Open Ownership
  - OpenCorporates
  - ICIJ Offshore Leaks
  - Sayari
  - br/acc
  - QQW/TodosLosContratos

## Stage 4 - Internal API and analyst console

- Status
  - first local-only slice operational
  - case artifact and source-bundle controls now exposed through local API/console
  - generated case artifacts are now rediscoverable through a lightweight runtime-folder registry
  - entity source-pack CLI now bridges entity-linked source records into cases, evidence links, source bundles, and source-document indexes in one command
  - first live entity source packs created for `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`
  - first analyst-workspace hardening slice operational
  - first case timeline/workbench slice operational
  - first source-record evidence-link slice operational
  - first in-case source-record search and field-path helper slice operational
  - first case evidence export and public-safety review gate operational
- Core outputs
  - API for process, entity, edge, flag, and review-queue queries
  - console views for process leads, entity dossiers, and follow-up lanes
  - accepted external match and second-review evidence endpoints
  - graph-ready one-hop entity network endpoint
  - source-record drilldowns
  - graph exports
  - token-protected saved notes, cases, and case links
  - saved case timelines that unify case creation, linked targets, and case-scoped notes
  - source-record evidence bundles with field-level explanation, interpretation, limitations, and evidence role
  - bounded field suggestions from source-record JSON payloads to help analysts cite exact source fields
  - append-only public-safety review states and gated evidence export
  - local Markdown/JSON case evidence export artifacts with source-record indexes
  - local Markdown/JSON source attachment manifests with source-run asset paths, source URLs, hashes, and local path availability
  - local case source bundles with evidence files, source manifest files, copied source-run assets, and bundle indexes
  - local source-document indexes over case bundles with snippets, query matches, source-record IDs, evidence-link IDs, and JSONL output
  - token-protected console/API controls for writing evidence artifacts, source manifests, source bundles, and source-document indexes
  - read-only artifact registry endpoint for generated case packets and bundle/index summaries
  - entity source-pack command that starts from an entity and writes the case/evidence/source-bundle/index packet directly
  - richer saved investigation paths later
- Main references
  - Aleph
  - Sayari
  - Dozorro/ProZorro
  - Integrity Watch
  - QQW/TodosLosContratos
  - br/acc

## Stage 5 - Public transparency layer

- Status
  - later publication/product stage
- Core outputs
  - public flag explorer
  - company-contract accountability pages
  - methodology and limitations pages
  - public-safe explanations of provenance and uncertainty
- Main references
  - Integrity Watch
  - Dozorro/ProZorro
  - QQW/TodosLosContratos
  - Rosie
  - DNCP
  - RUBLI

## Immediate next best step

- Use the new entity source-pack workflow on high-priority companies and candidate-review entities, then widen official DNCP release/document source checks where the resulting packs expose real casework value. Add OCR only where a specific source pack needs it.
- Reason
  - the system now has a live OpenSanctions spine, a wide official DNCP supplier anchor, a DNIT taxpayer identity-validation layer, a conservative representative/person screening lane, a tightened review-only candidate layer, a persisted hosted matcher comparison lane, a manual review-state workflow, one official IDB row-level source check, official DNCP release/document source records, selected official document captures, one accepted second-review match, a local console/API, source-record drilldowns, graph exports, token-protected notes/cases, a live case timeline view, source-record evidence links, in-case source-record search, source field helpers, gated case evidence export, source-indexed Markdown/JSON case artifacts, source attachment manifests, source bundles that copy resolvable source-run assets, source-document indexes that search bundled files with evidence/source traceability, console/API controls to generate those artifacts, a local artifact registry to rediscover them, and now a one-command entity source-pack bridge. The casework layer is ready to be used against real entity-intelligence questions instead of extended abstractly.
- Expected carry-over
  - local API endpoints and console views that expose candidate records with durable human-review status, notes, source-backed promotion/rejection history, second-review state, source-record links, document capture/extraction status, explanation bundles, evidence-export posture, and recent generated artifact paths
  - tighter use of hosted same-candidate confirmation versus different-result ambiguity inside analyst workflows
  - one fully explained or resolved remaining local identity gap if a lawful source exposes the missing check digit
  - selected official DNCP document contents brought into source bundles/indexes only where casework needs them; scanned PDFs stay clearly marked as parser/OCR limits rather than missing evidence
  - stronger OpenSanctions candidate evidence display grounded in official Paraguay names, RUCs, representative links, rejection reasons, and review state
  - first ownership, sanctions, or company-accountability pivot from the company-level queue with a better local anchor
  - stronger Sayari, OpenSanctions, Open Ownership, OpenCorporates, ICIJ, QQW, and DNCP supplier-registry protagonism
  - clearer API and console requirements around match review, source-record drilldown, graph export, and entity expansion
  - better grounding for later public accountability and methodology pages
