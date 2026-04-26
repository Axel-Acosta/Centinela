# Analyst workflows

## Current internal workflows

### 1. Source-specific analyst brief

- Command
  - `npm run database:analyst-brief -- --source-key ...`
- Purpose
  - summarize one loaded source into high-signal leads, buyer patterns, and flag distribution
- Main reference pressure
  - Aleph
  - OpenTender/GTI
  - DNCP
  - Integrity Watch

### 2. Review queue

- Command
  - `npm run database:review-queue -- --limit 25`
- Purpose
  - convert risk signals into human follow-up lanes and recommended actions
- Main reference pressure
  - Dozorro/ProZorro
  - Rosie
  - DNCP
  - Cardinal

### 3. Entity brief

- Command
  - `npm run database:entity-brief -- --name "EUROQUIMICA S.A."`
- Purpose
  - answer the investigator question "what do we know about this entity in the currently loaded procurement graph?"
- Main reference pressure
  - Aleph
  - Sayari
  - br/acc
  - QQW/TodosLosContratos

### 4. Rulebook

- Command
  - `npm run database:rulebook`
- Purpose
  - expose the active rule registry, live rule coverage, precedent influences, limitations, and review semantics in one analyst-facing artifact
- Main reference pressure
  - Open Contracting/Cardinal/OCDS
  - OpenTender/GTI
  - DNCP
  - Integrity Watch
  - FUNES
  - Rosie
  - RUBLI

### 5. External screening pass

- Command
  - `npm run enrichment:opensanctions`
- Purpose
  - screen procurement-linked supplier companies and DNCP legal representatives against a live external-risk universe, then persist provenance-backed matches or no-match results
  - keep accepted matches, review-only candidates, rejected diagnostics, representative/person candidates, and external risk signals separate
- Main reference pressure
  - OpenSanctions
  - br/acc
  - Sayari
  - QQW/TodosLosContratos
  - OpenCorporates
  - OpenOwnership
  - ICIJ

### 6. External candidate review report

- Command
  - `npm run database:external-candidates -- --limit 80`
- Purpose
  - expose review-only external candidates and rejected diagnostics with match method, confidence, source datasets, countries, local search name, shared tokens, linked companies, rationale, candidate IDs, suggested review state, reviewer notes, and hosted matcher support
  - keep candidate triage separate from accepted external matches and from process-level red flags
- Main reference pressure
  - OpenSanctions
  - Aleph
  - Sayari
  - br/acc
  - RUBLI

### 7. Manual external candidate review

- Command
  - `npm run database:review-external-candidate -- --candidate-id 59 --status needs_evidence --reviewer "Analyst Name" --notes "Review note"`
- Purpose
  - attach durable human-review state, reviewer metadata, notes, and evidence history to `entity_enrichment_candidates`
  - keep `unreviewed`, `needs_evidence`, `promotable`, `monitor`, and `rejected` as workflow labels, not legal conclusions
  - ensure `promotable` still means "ready for a stronger second review," not an accepted match
- Methodology note
  - `docs/methodology/external-candidate-review-workflow.md`
- Main reference pressure
  - Aleph
  - Sayari
  - OpenSanctions
  - Dozorro/ProZorro
  - RUBLI

### 8. OpenSanctions hosted match comparison

- Command
  - `npm run enrichment:opensanctions-hosted-match -- --dry-run true --limit 25 --batch-size 10`
- Purpose
  - compare Centinela local review-only candidates and rejected diagnostics against the authenticated OpenSanctions/Yente matcher once a trial API key is available
  - build exact hosted API payloads in dry-run mode before sending any data externally
  - preserve hosted scores as comparison evidence only, not accepted matches or risk signals
- Main reference pressure
  - OpenSanctions
  - Sayari
  - Aleph
  - RUBLI
  - br/acc

### 8a. IDB sanctions source check

- Command
  - `npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --update-review true`
- Purpose
  - retrieve row-level official IDB Open Data evidence for an OpenSanctions/IADB external candidate
  - persist the official source row into `source_records`
  - append the source check to candidate review evidence without creating an accepted match or risk signal
- Methodology note
  - `docs/methodology/idb-sanctions-open-data.md`
- Main reference pressure
  - OpenSanctions
  - br/acc
  - Aleph
  - Sayari
  - RUBLI

### 8b. External candidate second review

- Command
  - `npm run database:second-review-external-candidate -- --candidate-id 59 --decision accepted_match --reviewer "Second Reviewer" --rationale "Source-backed identity review" --limitations "Record what the match does not prove"`
- Purpose
  - decide whether a `promotable` external candidate should become an accepted enrichment identity match
  - preserve reviewer, rationale, limitations, evidence, accepted-match ID, and non-accusatory boundaries
  - avoid creating external risk signals automatically
- Methodology note
  - `docs/methodology/external-candidate-second-review-workflow.md`
- Main reference pressure
  - OpenSanctions
  - Aleph
  - Sayari
  - br/acc
  - RUBLI
  - Dozorro/ProZorro

### 9. Paraguay supplier anchor pass

- Command
  - `npm run enrichment:dncp-supplier-anchor -- --limit 500 --only-unanchored true --offset 0 --concurrency 8`
- Purpose
  - resolve procurement-linked companies against official DNCP supplier and sanctions surfaces, then persist local company anchors, representative links, and local administrative signals without resetting the full local company layer
- Main reference pressure
  - DNCP
  - br/acc
  - QQW/TodosLosContratos
  - Sayari
  - OpenOwnership
  - Aleph

### 10. Paraguay RUC equivalence validation

- Command
  - `npm run enrichment:dnit-ruc-equivalence -- --limit 10000 --only-anchor-gaps false`
- Purpose
  - validate procurement-linked supplier RUCs against the official DNIT RUC equivalence bulk files, then persist taxpayer identity profiles without mirroring the full taxpayer list
- Main reference pressure
  - br/acc
  - Sayari
  - OpenSanctions
  - OpenOwnership
  - OpenCorporates
  - ICIJ
  - QQW/TodosLosContratos

### 11. Entity intelligence queue

- Command
  - `npm run database:entity-intelligence-queue -- --limit 30`
- Purpose
  - turn company anchor coverage, local administrative history, representative density, and external screening state into a dedicated company-level review workflow
  - expose `External candidate review leads` even when candidate items are not high enough to dominate the main priority list
- Main reference pressure
  - Aleph
  - Sayari
  - OpenSanctions
  - br/acc
  - QQW/TodosLosContratos
  - Dozorro/ProZorro

### 12. Entity anchor-gap review

- Command
  - `npm run database:entity-anchor-gaps -- --limit 50`
- Purpose
  - isolate unresolved local supplier identities after the DNCP supplier-anchor pass, including RUC-like identifiers, observed source names, gap reasons, and next resolution steps
- Main reference pressure
  - br/acc
  - Aleph
  - Sayari
  - QQW/TodosLosContratos
  - OpenSanctions

### 13. Internal API and console

- Command
  - `npm run serve:internal-console -- --host 127.0.0.1 --port 8787`
- Purpose
  - expose current investigation surfaces through a local analyst console and JSON API instead of markdown reports only
  - support entity search, dossier drilldown, graph-ready one-hop networks, entity queues, process queues, external-candidate review, and accepted-match review
  - keep the first interactive surface local-only and non-public until authentication, saved casework, and public-safety review exist
- Methodology note
  - `docs/architecture/internal-api-console.md`
- Main reference pressure
  - Aleph
  - Sayari
  - br/acc
  - Dozorro/ProZorro
  - Integrity Watch
  - QQW/TodosLosContratos
  - RUBLI

### 14. Analyst workspace notes, cases, source records, graph export, case timelines, and evidence links

- Commands
  - `npm run database:apply-sql -- --file sql/postgres/016_analyst_workspace.sql`
  - `npm run database:apply-sql -- --file sql/postgres/017_analyst_case_timeline.sql`
  - `npm run database:apply-sql -- --file sql/postgres/018_analyst_evidence_links.sql`
  - `npm run serve:internal-console -- --host 127.0.0.1 --port 8787`
- Purpose
  - preserve internal notes and cases without treating notes as accusations
  - open a saved case as a timeline of case creation, linked targets, and case-scoped notes
  - link source records to notes and targets with field-level explanation, interpretation, limitations, and evidence-role metadata
  - search source records from inside the case panel and use field-path suggestions to speed up evidence-link creation
  - drill into source records from the console/API
  - export entity networks for graph-oriented review
  - require a local write token before saved notes or cases can be written through the API
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - Aleph
  - Sayari
  - br/acc
  - Dozorro/ProZorro
  - RUBLI
  - Integrity Watch

## Current workflow design principles

- Start from explainable leads, not accusations
- Move from process signal to human review
- Support entity-centric follow-up, not only buyer or tender dashboards
- Keep provenance visible enough for later public explanation

## Current limits

- The first API and interactive console slice is local-only and operational. It now has token-protected saved notes/cases, evidence links, case timelines, source-record drilldowns, and graph export, but it still has no production authentication, role-based permissions, or public deployment posture.
- The rule registry exists, but the DNCP crosswalk and public methodology layer are still incomplete
- Entity briefs now include external enrichment, DNIT identity validation, and official DNCP supplier-anchor sections, and the company-level queue plus anchor-gap report now make local identity gaps and local administrative history visible; 1 procurement-linked supplier company still remains without a local identity anchor because the procurement-side RUC is missing a check digit
- OpenSanctions candidate review is active. The current queue has one company-level external candidate lead and keeps weak representative/person overlaps visible as rejected diagnostics rather than treating them as accepted matches.
- Hosted OpenSanctions API comparison is live, persisted into PostgreSQL, and now visible inside the company queue, external-candidate review report, and selected entity dossiers.
- Manual external-candidate review is now operational through `sql/postgres/014_external_candidate_review_workflow.sql`, `centinela.entity_enrichment_candidate_review_overview`, and `npm run database:review-external-candidate`. Candidate `59` has moved through second review into accepted identity context; 5 rows are `monitor`, 4 are `rejected`, and 48 remain `unreviewed` diagnostics.
- Candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, is the first accepted external enrichment match. It has row-level official IDB Open Data evidence and hosted same-candidate support, but no comparable external RUC identifier, so the accepted-match limitation remains visible.
- The current hosted API trial key has already hit a monthly `429` rate limit after the first live comparison pass, so the strongest immediate work is review workflow and local evidence quality, not brute-force rerunning.
- Large multi-supplier processes can overstate entity-linked monetary context if read without the built-in caveats

## Next workflow milestone

- Harden the internal API/console with case evidence exports, public-safety review states, and eventually production-grade authentication if remote access becomes necessary.
