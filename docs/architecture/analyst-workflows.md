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

### 15. Case evidence export and public-safety review gate

- Commands
  - `npm run database:apply-sql -- --file sql/postgres/019_case_evidence_exports.sql`
  - `npm run serve:internal-console -- --host 127.0.0.1 --port 8787`
- API
  - `POST /api/analyst-cases/:id/public-review`
  - `GET /api/analyst-cases/:id/evidence-export`
  - `GET /api/analyst-cases/:id/evidence-export?public_only=true`
- Purpose
  - package source-backed case evidence without exposing raw analyst notes by default
  - preserve append-only public-safety review states before any public-facing use
  - block public-only export unless the latest review status is `approved_public`
  - require public-safe summary and limitations before approval
  - strip internal analyst interpretation and internal actor metadata from public-only export rows
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - Aleph
  - Integrity Watch
  - RUBLI
  - Dozorro/ProZorro
  - QQW/TodosLosContratos
  - br/acc

### 16. Case evidence export artifact

- Command
  - `npm run database:case-evidence-export -- --case-id <id> --public-only false`
  - `npm run database:case-evidence-export -- --case-id <id> --public-only true`
- Purpose
  - write portable Markdown and JSON evidence packets to the local runtime folder
  - include a source-record index so analysts can quickly see which source records support the evidence package
  - keep public-only artifact creation behind the same `approved_public` gate as the API export
  - avoid committing generated case packets to Git or syncing them through OneDrive
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - Aleph
  - br/acc
  - Integrity Watch
  - RUBLI
  - QQW/TodosLosContratos

### 17. Case source attachment manifest

- Command
  - `npm run database:case-source-manifest -- --case-id <id> --public-only false`
  - `npm run database:case-source-manifest -- --case-id <id> --public-only true`
- Purpose
  - write Markdown and JSON source attachment manifests to the local runtime folder
  - list linked source records, source-run metadata, source-run assets, source URLs, SHA-256 hashes, local path availability, and payload previews
  - keep public-only manifest creation behind the same `approved_public` gate as evidence export artifacts
  - give analysts an attachment checklist before any later source-file bundle, document index, or public case page
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - br/acc
  - Aleph
  - Sayari
  - RUBLI
  - Integrity Watch
  - QQW/TodosLosContratos

### 18. Case source bundle

- Command
  - `npm run database:case-source-bundle -- --case-id <id> --public-only false --copy-assets true`
  - `npm run database:case-source-bundle -- --case-id <id> --public-only true --copy-assets true`
- Purpose
  - write a local review bundle with `bundle-index.json`, `README.md`, case evidence JSON/Markdown, source manifest JSON/Markdown, and copied source-run assets when paths resolve
  - preserve copied-file hashes and copy status beside source-record provenance
  - keep public-only bundle creation behind `approved_public`
  - preserve the warning that copied raw source files need separate review before public reuse
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - Aleph
  - br/acc
  - Sayari
  - RUBLI
  - Integrity Watch
  - QQW/TodosLosContratos

### 19. Case source-document index

- Command
  - `npm run database:case-source-index -- --bundle-path <bundle-path> --query "search terms"`
- Purpose
  - refresh a bundle's `source-document-index.json`, `source-document-index.md`, and `source-document-index.jsonl`
  - extract bounded text from copied text-like source files
  - preserve source-record IDs, evidence-link IDs, source asset metadata, source URLs, hashes, snippets, and query matches
  - give analysts a local search/navigation aid before any full document search engine or public document product
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - Aleph
  - br/acc
  - Sayari
  - RUBLI
  - Integrity Watch
  - QuiénEsQuién/TodosLosContratos

### 20. Case artifact API/console controls

- API
  - `POST /api/analyst-cases/:id/evidence-artifacts`
  - `POST /api/analyst-cases/:id/source-manifests`
  - `POST /api/analyst-cases/:id/source-bundles`
  - `POST /api/source-document-indexes`
- Console
  - case workbench buttons for evidence artifact, source manifest, source bundle plus index, and source-index refresh
- Purpose
  - make the artifact, bundle, and source-index workflow usable from the local console instead of CLI-only commands
  - keep public-only generation behind `approved_public`
  - preserve generated paths, counts, copied-asset counts, and query-match counts in the response visible to analysts
  - require the local write token because these routes create local review files
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - Aleph
  - br/acc
  - Sayari
  - RUBLI
  - Integrity Watch
  - QuiénEsQuién/TodosLosContratos

### 21. Case artifact registry

- API
  - `GET /api/analyst-cases/:id/artifacts`
- Console
  - case workbench button for loading generated artifacts
- Purpose
  - rediscover existing local case evidence artifacts, source manifests, source bundles, and source-document index summaries after generation
  - show local runtime paths, relative paths, public-safety mode, artifact counts, copied-asset counts, indexed-document counts, and query-match counts without opening raw evidence content
  - keep generated files outside Git and OneDrive while making them reachable from the analyst surface
- Methodology note
  - `docs/methodology/analyst-workspace.md`
- Main reference pressure
  - Aleph
  - br/acc
  - Sayari
  - RUBLI
  - QuiénEsQuién/TodosLosContratos

## Current workflow design principles

- Start from explainable leads, not accusations
- Move from process signal to human review
- Support entity-centric follow-up, not only buyer or tender dashboards
- Keep provenance visible enough for later public explanation

## Current limits

- The first API and interactive console slice is local-only and operational. It now has token-protected saved notes/cases, evidence links, case timelines, source-record drilldowns, graph export, evidence exports, public-safety review states, local Markdown/JSON case export artifacts, source attachment manifests, local source bundles, local source-document indexes, console/API controls to generate those case artifacts, and a lightweight artifact registry to reopen generated bundle/index summaries, but it still has no production authentication, role-based permissions, or public deployment posture.
- The rule registry exists, but the DNCP crosswalk and public methodology layer are still incomplete
- Entity briefs now include external enrichment, DNIT identity validation, and official DNCP supplier-anchor sections, and the company-level queue plus anchor-gap report now make local identity gaps and local administrative history visible; 1 procurement-linked supplier company still remains without a local identity anchor because the procurement-side RUC is missing a check digit
- OpenSanctions candidate review is active. The current queue has one company-level external candidate lead and keeps weak representative/person overlaps visible as rejected diagnostics rather than treating them as accepted matches.
- Hosted OpenSanctions API comparison is live, persisted into PostgreSQL, and now visible inside the company queue, external-candidate review report, and selected entity dossiers.
- Manual external-candidate review is now operational through `sql/postgres/014_external_candidate_review_workflow.sql`, `centinela.entity_enrichment_candidate_review_overview`, and `npm run database:review-external-candidate`. Candidate `59` has moved through second review into accepted identity context; 5 rows are `monitor`, 4 are `rejected`, and 48 remain `unreviewed` diagnostics.
- Candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, is the first accepted external enrichment match. It has row-level official IDB Open Data evidence and hosted same-candidate support, but no comparable external RUC identifier, so the accepted-match limitation remains visible.
- The current hosted API trial key has already hit a monthly `429` rate limit after the first live comparison pass, so the strongest immediate work is review workflow and local evidence quality, not brute-force rerunning.
- Large multi-supplier processes can overstate entity-linked monetary context if read without the built-in caveats

## Next workflow milestone

- Either add bounded artifact-detail reading for selected bundle/index files, or return to the higher-value intelligence backlog: stronger candidate scoring, the final RUC anchor gap, and the next lawful Paraguay cross-domain source.
