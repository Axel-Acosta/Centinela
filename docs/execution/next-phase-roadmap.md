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
- Core outputs
  - API for process, entity, edge, flag, and review-queue queries
  - console views for process leads, entity dossiers, and follow-up lanes
  - accepted external match and second-review evidence endpoints
  - graph-ready one-hop entity network endpoint
  - saved investigation paths later
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

- Harden the local-only internal API/console into the first analyst workspace, while keeping accepted matches, review-only candidates, external risk signals, and public-facing language separate.
- Reason
  - the system now has a live OpenSanctions spine, a wide official DNCP supplier anchor, a DNIT taxpayer identity-validation layer, a conservative representative/person screening lane, a tightened review-only candidate layer, a persisted hosted matcher comparison lane, a manual review-state workflow, one official IDB row-level source check, and one accepted second-review match. The next leverage is making those layers explorable together instead of leaving them mostly in markdown reports.
- Expected carry-over
  - local API endpoints and console views that expose candidate records with durable human-review status, notes, source-backed promotion/rejection history, and second-review state
  - tighter use of hosted same-candidate confirmation versus different-result ambiguity inside analyst workflows
  - one fully explained or resolved remaining local identity gap
  - stronger OpenSanctions candidate evidence display grounded in official Paraguay names, RUCs, representative links, rejection reasons, and review state
  - first ownership, sanctions, or company-accountability pivot from the company-level queue with a better local anchor
  - stronger Sayari, OpenSanctions, Open Ownership, OpenCorporates, ICIJ, QQW, and DNCP supplier-registry protagonism
  - clearer API and console requirements around match review, source-record drilldown, graph export, and entity expansion
  - better grounding for later public accountability and methodology pages
