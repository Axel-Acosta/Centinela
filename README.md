# Centinela

Centinela is a Paraguay-first integrity intelligence system for public procurement and public-integrity research. The long-term goal is a reusable operator capability that can collect public data, normalize entities and relationships, surface explainable risk signals, preserve project memory, and later evolve into an internal analyst tool and public-facing product.

This first foundation run prioritizes:

- a reusable project-local Codex skill for integrity-intelligence operations
- durable project memory and continuation docs
- a comparative research layer across core reference systems
- a PostgreSQL-oriented architecture with file-backed local outputs
- a first real Paraguay slice using live DNCP open-contracting endpoints
- a database-backed analyst workflow for loaded Paraguay bundles
- an execution layer that turns major reference systems into concrete Centinela components

## Repository map

- `skills/integrity-intelligence-operator/` reusable Codex skill for future runs
- `memory/` durable operating memory for decisions, scope, status, and next work
- `research/` comparative system analysis and Paraguay source mapping
- `docs/` architecture, red-flag, and VPS/storage notes
- `docs/architecture/internal-api-console.md` first local analyst API and console surface
- `docs/execution/progress-and-remaining-work.md` current completion estimate and remaining milestones
- `docs/methodology/analyst-workspace.md` saved notes, cases, evidence links, case timelines, source-record drilldowns, graph export rules, evidence export gates, and public-safety review states
- `docs/methodology/external-candidate-review-workflow.md` manual external-candidate review status workflow
- `scripts/` local operational helpers, including GitHub publication
- `sql/postgres/` canonical PostgreSQL schema
- `src/` TypeScript ingestion, normalization, and risk-signal pipeline
- `data/README.md` pointer to local runtime artifact storage

Generated raw, normalized, and report outputs are intentionally not stored in the repo by default. See `docs/ops/workspace-storage.md`.

To publish or reconnect the source workspace to the public GitHub repository, see `docs/ops/github-publication.md`.

## Current architecture choice

The canonical storage target is PostgreSQL on the VPS, with generated local file outputs written outside the repo by default. This keeps the first implementation simple and reproducible while preserving a clean path to:

- relationship-aware SQL models now
- graph exports or a graph sidecar later
- search indexing later
- a safer public UI later

Default runtime artifact location on this Windows machine:

```text
C:\Users\Axeld\AppData\Local\Centinela\data
```

## First runnable command

```bash
npm install
npm run paraguay:first-slice
```

That command pulls a live sample from Paraguay DNCP's public API v3 surface, writes raw source bundles, normalizes them into a small internal model, computes initial explainable risk signals, and generates a summary report.

## Current operational commands

```bash
npm run paraguay:bulk-year -- --year 2026
npm run enrichment:opensanctions
npm run enrichment:opensanctions-hosted-match -- --dry-run true --limit 25
npm run enrichment:dncp-supplier-anchor -- --limit 500 --only-unanchored true --offset 0 --concurrency 8
npm run enrichment:dnit-ruc-equivalence -- --limit 10000 --only-anchor-gaps false
npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --update-review true
npm run enrichment:dncp-release-source-check -- --entity-name "Entity Name" --limit 5
npm run enrichment:dncp-document-content -- --entity-name "Entity Name" --query "contrato" --limit 2
npm run database:apply-sql -- --file sql/postgres/015_external_candidate_second_review.sql
npm run database:apply-sql -- --file sql/postgres/016_analyst_workspace.sql
npm run database:apply-sql -- --file sql/postgres/017_analyst_case_timeline.sql
npm run database:apply-sql -- --file sql/postgres/018_analyst_evidence_links.sql
npm run database:apply-sql -- --file sql/postgres/019_case_evidence_exports.sql
npm run database:load-bundle -- --file data/normalized/paraguay/dncp-2026-bulk-processes.json
npm run database:analyst-brief -- --source-key py-dncp-bulk-2026
npm run database:review-queue -- --source-key py-dncp-bulk-2026
npm run database:entity-brief -- --name "Entity Name"
npm run database:entity-intelligence-queue -- --limit 30
npm run database:external-candidates -- --limit 80
npm run database:review-external-candidate -- --candidate-id 59 --status needs_evidence --reviewer "Analyst Name" --notes "Review note"
npm run database:second-review-external-candidate -- --candidate-id 59 --decision accepted_match --reviewer "Second Reviewer" --rationale "Source-backed identity review" --limitations "Record what this match does not prove"
npm run database:case-evidence-export -- --case-id 1 --public-only false
npm run database:case-source-manifest -- --case-id 1 --public-only false
npm run database:case-source-bundle -- --case-id 1 --public-only false --copy-assets true
npm run database:case-source-index -- --bundle-path "C:\path\to\bundle" --query "Consultora Guarani"
npm run database:entity-anchor-gaps -- --limit 50
npm run database:rulebook -- --source-key py-dncp-bulk-2026
npm run serve:internal-console -- --host 127.0.0.1 --port 8787
```

Those commands fetch annual DNCP OCDS bulk slices, persist them into PostgreSQL, and then generate database-backed internal investigation artifacts including analyst briefs, review queues, entity dossiers, external-candidate review, manual candidate-review status updates, and rulebook methodology outputs.
The IDB command is a source-document evidence check for OpenSanctions/IADB candidates; it does not create accepted matches or risk signals.
The DNCP release source-check command fetches official DNCP OCDS release packages for already-linked entity/process records and stores release/document metadata as source records for casework.
The DNCP document-content command captures selected official DNCP document files from persisted document metadata, stores hashes and source assets, attempts bounded text extraction, and records parser/OCR limits without treating them as findings.
The internal console command serves a local-only analyst surface and JSON API for entity search, dossiers, graph-ready network neighborhoods, graph export, source-record drilldowns, source field suggestions, review queues, external candidates, accepted matches, token-protected analyst notes/cases, evidence links, case timelines, evidence export, public-safety review gates, token-protected case artifact/source-bundle/source-index generation, and generated-artifact rediscovery.
The case evidence export command writes Markdown and JSON artifacts to the local runtime folder with a source-record index; public-only artifacts require `approved_public`.
The case source manifest command writes Markdown and JSON attachment manifests with linked source records, source-run assets, source URLs, hashes, and local path availability; public-only manifests require `approved_public`.
The case source bundle command writes a local review folder with evidence files, source manifest files, `bundle-index.json`, `README.md`, and copied source-run assets when local paths resolve; public-only bundles require `approved_public`, but copied raw files still need review before public reuse.
The case source index command refreshes/searches a source bundle's `source-document-index.json`, Markdown, and JSONL files so analysts can trace document hits back to source records and evidence links.
Generated output paths are controlled by `CENTINELA_OUTPUT_DIR`; leave it blank to use the non-sync local runtime folder.

## Current working state

- PostgreSQL on the VPS is the canonical store.
- DNCP bulk years 2025 and 2026 are loaded.
- The internal investigation layer now includes source analyst briefs, process review queues, a company-level entity-intelligence queue, external-candidate review, manual candidate-review status handling, entity activity views, buyer-supplier edge views, entity dossiers, a public-bulk OpenSanctions screening connector, an authenticated OpenSanctions hosted-match comparison scaffold, a live DNCP supplier-anchor connector for Paraguay company identity/sanctions history, and a live DNIT RUC equivalence connector for taxpayer identity validation.
- The first row-level external source-document connector now checks the official IDB Open Data sanctioned firms and individuals dataset for OpenSanctions/IADB candidates and stores source-record evidence separately from accepted matches.
- The first official DNCP release/document source-record connector is live. It currently stores 4 official release package records and 567 official document metadata records for high-priority entity casework.
- The first selected official DNCP document-content capture lane is live. It currently stores 2 captured official contract PDFs with SHA-256 hashes and `no_extractable_text` extraction status for high-priority entity dossiers.
- The second-review governance workflow is live. Candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, is the first accepted external enrichment match; it created accepted identity context, not an external risk signal.
- The first internal API/console slice is live locally through `npm run serve:internal-console`, exposing entity search, entity profiles, graph-ready networks, queues, candidates, and accepted matches.
- The first analyst-workspace hardening slice is live in schema, API, console, and CLI: source-record drilldowns, field suggestions, graph exports, saved cases, case links, saved analyst notes, source-record evidence links, case timelines, evidence exports, public-safety review states, Markdown/JSON case export artifacts, source attachment manifests, local source bundles, source-document indexes, console/API controls to generate those local artifacts, and a lightweight artifact registry for rediscovering generated case packets. Write endpoints require `CENTINELA_WRITE_TOKEN`.
- The current local Paraguay identity anchor now covers 2,533 of 2,534 procurement-linked supplier companies, with 1 missing-check-digit gap still unanchored, alongside 446 supplier companies with local administrative signals, 3,642 representative links, and 2,518 DNIT identity-validation profiles.
- The anchor-gap backlog is now first-class through `centinela.entity_anchor_gap_review` and `npm run database:entity-anchor-gaps -- --limit 50`.
- The next implementation phase is defined by `docs/execution/reference-to-component-execution-plan.md` and `docs/execution/next-phase-roadmap.md`, which turn the major reference systems into real component pressure instead of passive inspiration.

## Operating principles

- Treat outputs as risk signals and investigation leads, never proof of guilt.
- Preserve provenance and source URLs wherever possible.
- Prefer adaptable, country-portable abstractions over Paraguay-only shortcuts.
- Reuse the strongest patterns from existing systems without copying them blindly.
- Keep future Codex runs coherent by updating the project memory after each significant change.
