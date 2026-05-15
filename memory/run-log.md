# Run log

## 2026-04-16

- Initialized an empty repo into a structured Centinela workspace.
- Created the `integrity-intelligence-operator` project-local skill.
- Gathered current reference-system and Paraguay source material.
- Confirmed the available VPS runs Ubuntu 24.04, Docker, and PostgreSQL 16.
- Chose PostgreSQL as the canonical long-term store and file-backed outputs for the first slice.
- Scaffolded the architecture, research, and memory layers.
- Built the first TypeScript ingestion and risk-signal pipeline for DNCP live data.
- Ran the first live DNCP slice and wrote raw, normalized, and report artifacts under `data/`.
- Created a dedicated `centinela` database on the VPS and applied the initial schema.

## 2026-04-17

- Expanded DNCP ingestion from live API sampling to annual OCDS bulk ZIP handling for 2026.
- Added contract and payment transaction normalization for the DNCP bulk year pipeline.
- Reworked the PostgreSQL loader into a batch-oriented loader that can persist full normalized bundles over an SSH tunnel.
- Confirmed the VPS does not currently have `node` or `npm`, so the operational load path uses local Node plus an SSH tunnel into the Docker-networked PostgreSQL container.
- Applied SQL indexes and analyst views from `sql/postgres/003_analyst_views.sql` on the VPS.
- Loaded the `py-dncp-bulk-2026` bundle into the VPS database successfully.
- Generated the first database-backed analyst brief for Paraguay procurement data under `data/reports/paraguay/`.
- Added the durable `docs/execution/reference-to-component-execution-plan.md` so each major precedent now has a defined implementation role, proof artifacts, blockers, and staged next steps.
- Loaded a second full DNCP bulk year, `py-dncp-bulk-2025`, into PostgreSQL.
- Applied `sql/postgres/004_entity_intelligence.sql` on the VPS, adding `entity_source_mentions`, entity activity views, buyer-supplier edge views, and a process review queue.
- Extended the loader to preserve cross-source entity continuity and to record per-source entity mentions instead of deleting shared entities during reloads.
- Added new investigation workflows: entity briefs and a review queue, alongside the original source analyst brief.
- Generated multi-year internal outputs including `data/reports/paraguay/all-sources-review-queue.md` and `data/reports/paraguay/entities/euroquimica-s-a-entity-brief.md`.
- Confirmed the live multi-year state after reload stabilization: 12,738 DNCP 2025 processes, 791 DNCP 2026 processes, 1,360 repeated buyer-supplier edges, and 7,351 queued flagged-process reviews.
- Updated the project memory and architecture layer so the stronger synthesis mandate becomes part of Centinela's operating constitution for future runs.
- Added a formal procurement rule registry in code and PostgreSQL, plus a registry-backed rulebook report and DNCP crosswalk docs.
- Replaced the queue's hard-coded rule semantics with registry-driven review lanes, lead questions, and recommended actions.
- Refactored the repeated buyer-supplier rule so it becomes one process-level concentration signal with structured evidence instead of many duplicate per-supplier flags.
- Rebuilt and reloaded the DNCP 2025 and 2026 bundles after the registry cutover.
- Confirmed the post-registry live state: 9,612 risk signals for `py-dncp-bulk-2025`, 352 for `py-dncp-bulk-2026`, and a total review queue of 7,351 flagged processes split across 2,241 priority, 4,563 enhanced-review, and 547 triage items.

## 2026-04-18

- Read the current project memory, roadmap, methodology, investigation, and continuation docs before changing direction.
- Added `sql/postgres/006_entity_enrichment.sql`, creating `entity_enrichment_matches`, `entity_external_risk_signals`, `entity_external_match_overview`, and `entity_external_risk_overview`.
- Implemented the first live enrichment connector in `src/enrichment/opensanctions.ts`.
- Confirmed the current OpenSanctions access reality: the hosted matching API requires authentication, while the public bulk `default` dataset index and exports remain reachable.
- Screened 2,534 procurement-linked supplier companies against 1,249,767 OpenSanctions bulk targets.
- Tightened the initial matcher after a noisy first pass so the stored result now keeps only conservative company-to-company logic.
- Confirmed the current conservative production result: zero stored OpenSanctions matches for the loaded Paraguay supplier-company set.
- Upgraded entity briefs with identity, source-mention, and external-enrichment sections.
- Added a durable Paraguay entity-enrichment source plan and an OpenSanctions screening methodology note.
- Confirmed DNCP exposes official supplier and sanctions CSV endpoints that can be queried directly by procurement-linked RUC.
- Added `sql/postgres/007_local_entity_anchor.sql`, creating `entity_local_profiles`, `entity_intelligence_signals`, `entity_local_profile_overview`, `entity_intelligence_signal_overview`, and `entity_representative_overview`.
- Implemented `src/enrichment/dncpSupplierAnchor.ts`, a live DNCP supplier-anchor connector that resolves official supplier records, representative links, and sanctions history.
- Applied the local entity-anchor schema on the VPS database and ran the first supplier-anchor sweep against the top 200 procurement-linked supplier companies.
- Confirmed the first live local-anchor result: 200 official DNCP supplier matches, 166 local administrative signals, 484 representative links, and 90 suppliers with returned sanctions history.
- Upgraded entity briefs again so companies can now show official DNCP profile facts, local administrative signals, and representative links in addition to procurement activity and external screening state.
- Added a dedicated DNCP supplier-anchor methodology note and refreshed the roadmap, source plan, reference execution plan, and project memory around the new live local company layer.
- Added `sql/postgres/008_entity_intelligence_queue.sql`, creating `entity_intelligence_review_queue` and `entity_anchor_coverage_overview`.
- Reworked the DNCP supplier-anchor connector so it can widen incrementally through offset and unanchored-only batches without resetting the whole local company layer.
- Confirmed a practical official-source blocker on April 18, 2026: DNIT/SET taxpayer-profile public services exist, but the current public flow appears human-oriented and reCAPTCHA-protected from the current repo state.
- Ran the widened unanchored DNCP supplier-anchor sweep and stored 2,303 additional official supplier matches, 591 additional local administrative signals, and 3,142 additional representative links.
- Confirmed the current supplier-anchor state after the widened run: 2,503 of 2,534 procurement-linked supplier companies now have an official DNCP anchor, with 31 still unanchored.
- Generated the first company-level entity-intelligence queue report under `data/reports/paraguay/all-entities-intelligence-queue.md`.
- Refreshed the `EUROQUIMICA S.A.` dossier with the new entity-intelligence triage section driven by the company-level queue view.
- Added bounded fallback matching to the DNCP supplier-anchor connector: RUC first, then official procurement name, cleaned punctuation variants, comma-reordered person names, and consortium variants.
- Applied `sql/postgres/009_entity_anchor_gap_review.sql`, creating a dedicated `entity_anchor_gap_review` view and report command for unresolved local supplier identities.
- Ran a focused retry over the 31 remaining unanchored suppliers and resolved 18 additional official DNCP supplier anchors with zero failed lookups.
- Confirmed the new live supplier-anchor state: 2,521 of 2,534 procurement-linked supplier companies anchored, 13 still unanchored, 446 companies with local administrative signals, and 3,642 representative links.
- Added `sql/postgres/010_dncp_supplier_identifier_repair.sql` and connector-side identifier classification so DNCP registry codes such as `DNCP-002002` are no longer stored as plain RUC identifiers.
- Generated the new anchor-gap report at `data/reports/paraguay/all-entities-anchor-gaps.md` and refreshed the `CONSORCIO VEDIJ` entity dossier to show the official supplier profile, DNCP supplier code, representative links, counterparty edge, and process context.

## 2026-04-19

- Re-read the live project memory, source status, roadmap, VPS notes, analyst workflows, and current continuation files before continuing the entity-anchor phase.
- Found and verified the official DNIT RUC equivalence bulk path: the DNIT page publishes `ruc0.zip` through `ruc9.zip`, observed as updated on `2026-04-01`.
- Implemented `src/enrichment/dnitRucEquivalence.ts`, a bounded Paraguay identity-validation connector that downloads official DNIT bulk ZIPs, parses RUC/name/check-digit/equivalence/status rows, and persists only matches for procurement-linked supplier companies.
- Added the `enrichment:dnit-ruc-equivalence` command and ran it against the live VPS PostgreSQL database over the existing SSH tunnel.
- Stored 2,518 DNIT identity profiles from 2,519 usable procurement RUC targets, including 2,514 accepted exact RUC/check-digit matches and 4 reviewable base-only matches.
- Improved local supplier identity coverage from 2,521 of 2,534 to 2,533 of 2,534 companies; 12 of the 13 previous anchor gaps were resolved by DNIT validation.
- Preserved status distribution for the matched DNIT profiles: 2,459 `ACTIVO`, 35 `SUSPENSION TEMPORAL`, 20 `BLOQUEADO`, and 4 `CANCELADO`.
- Added `sql/postgres/011_entity_anchor_gap_dnit_resolution.sql`, refining the anchor-gap view so the final unresolved entity is now classified as `ruc_missing_check_digit_for_dnit_bulk_validation`.
- Upgraded entity dossiers so DNIT identity validation profiles are displayed separately from DNCP supplier anchors, keeping supplier-registration status and taxpayer identity validation methodologically distinct.
- Regenerated the entity-intelligence queue, anchor-gap report, and example dossiers for `ANUF GAMARRA AGUSTIN DARIO` and `MENDEZ GONZALEZ FLORIANA *`.
- Added `docs/methodology/dnit-ruc-equivalence.md` and updated memory/docs so future runs inherit DNIT as an active identity-validation layer, not just a candidate source.
- Made the OpenSanctions screening connector use official DNCP/DNIT profile names plus comparable Paraguay RUC identifiers, while excluding source-specific DNCP/DNIT registry codes from identifier matching.
- Confirmed the final missing local identity gap could not be resolved from loaded DNCP payloads, prior DNCP supplier search results, or a name search across the official DNIT RUC equivalence ZIP files.
- Reran OpenSanctions enrichment over the strengthened local company master. The rerun screened 2,534 supplier companies against 1,249,876 OpenSanctions target rows using index version `20260419065433-yex` and still produced zero stored matches or external risk signals.
- Regenerated `opensanctions-default-company-screening.md`, `all-entities-intelligence-queue.md`, and `all-entities-anchor-gaps.md` after the rerun.
- Added conservative DNCP legal-representative/person screening to the OpenSanctions bulk connector, keeping it separate from company matching and review-only so name-only person matches do not create external risk signals.
- Reran OpenSanctions against 2,534 supplier companies plus 3,165 DNCP legal representatives using index version `20260419125302-lsx`; the run scanned 1,249,894 target rows and stored zero company matches, zero representative review candidates, and zero external risk signals.
- Upgraded entity dossiers with a `Representative external screening candidates` section so company briefs can show OpenSanctions candidates linked through DNCP legal representatives when future runs surface them.
- Regenerated the OpenSanctions entity-screening report, entity-intelligence queue, anchor-gap report, and `EUROQUIMICA S.A.` dossier after the representative-aware rerun.
- Added `sql/postgres/012_entity_enrichment_candidates.sql`, creating `entity_enrichment_candidates`, `entity_enrichment_candidate_overview`, and refreshed entity queue/anchor-gap views with external candidate counts and an `external_candidate_review` lane.
- Reworked OpenSanctions screening so near matches and rejected diagnostics are stored separately from accepted enrichment matches. Accepted matches remain zero, while candidate rows are reviewable and non-accusatory.
- Reran OpenSanctions with the candidate layer. The run stored 26 review-only candidate records, 32 rejected diagnostics, zero accepted matches, and zero external risk signals.
- Refreshed the entity intelligence queue so it now shows a dedicated `External candidate review leads` section with two company-level leads: `CONSULTORA GUARANI SA INGENIEROS CIVILES` and `CONSORCIO P&EE & ASOCIADOS`.
- Regenerated candidate-aware dossiers for `CONSULTORA GUARANI SA INGENIEROS CIVILES`, `CONSORCIO P&EE & ASOCIADOS`, and `BLUE OCEAN COMPANY S.A.` to show direct candidate rationale, rejected diagnostics, and representative-linked candidate evidence.
- Tightened OpenSanctions review-only candidate scoring so generic consortium/asociados company overlaps no longer escalate and two-token representative/person overlaps become rejected diagnostics with `partial_person_name_overlap_needs_more_evidence`.
- Added the dedicated `database:external-candidates` analyst command and generated `data/reports/paraguay/external-enrichment-candidate-review.md` with candidate status, method distribution, confidence, datasets, countries, shared-token evidence, linked companies, and rationale.
- Reran OpenSanctions after the tighter candidate policy. The live run still produced zero accepted matches and zero external risk signals, but review candidates fell from 26 to 1 while rejected diagnostics rose from 32 to 57.
- Confirmed the only current company-level external candidate review lead is `CONSULTORA GUARANI SA INGENIEROS CIVILES`; `CONSORCIO P&EE & ASOCIADOS` is no longer escalated.
- Refreshed the entity intelligence queue and regenerated candidate/diagnostic-aware dossiers for `CONSULTORA GUARANI SA INGENIEROS CIVILES`, `BLUE OCEAN COMPANY S.A.`, `CONSORCIO P&EE & ASOCIADOS`, `Medical Supply Sociedad Anonima`, and `CONSORCIO SANTA LUCIA`.
- Created a private OpenSanctions/Yente access-request packet under `docs/external-access/`, including a sendable access request email, a private Centinela technical summary, and a follow-up checklist for expected OpenSanctions questions.
- Added placeholder authenticated matching environment variables to `.env.example` without adding any real secrets.

## 2026-04-23

- Received OpenSanctions guidance confirming Centinela is eligible for access and recommending a hosted API trial before deciding whether self-hosted Yente is necessary.
- Implemented `src/enrichment/opensanctionsHostedMatch.ts`, a hosted OpenSanctions/Yente comparison lane using `POST /match/{dataset}` with `algorithm=logic-v2`, `Authorization: ApiKey`, and no automatic candidate promotion.
- Added the `enrichment:opensanctions-hosted-match` command, with dry-run support for building exact request payloads before an API key is available.
- Ran the hosted-match connector in dry-run mode against the live candidate population: 25 local candidate/diagnostic entities prepared, 3 request batches generated, zero hosted API calls made.
- Generated `data/normalized/paraguay/opensanctions-hosted-match-comparison.json` and `data/reports/paraguay/opensanctions-hosted-match-comparison.md`.
- Added `docs/methodology/opensanctions-hosted-api.md` and `docs/external-access/opensanctions-technical-summary-reply.md`.
- Added `sql/postgres/013_hosted_match_comparisons.sql`, creating `entity_hosted_match_comparisons` and `entity_hosted_match_comparison_overview`.
- Upgraded the hosted comparison lane so live comparison results can persist into PostgreSQL-backed analyst workflows instead of remaining only a standalone markdown/json artifact.
- Imported the already-obtained live hosted comparison artifact into PostgreSQL and regenerated the queue, external-candidate review report, and company dossiers with hosted support evidence.
- Confirmed the current hosted comparison result inside live analyst outputs: 31 local entities compared, 8 same-candidate confirmations, 11 different-result alternatives, and 12 no-result cases.
- Confirmed the strongest current company-level hosted-supported lead remains `CONSULTORA GUARANI SA INGENIEROS CIVILES`, while `BLUE OCEAN COMPANY S.A.` and `CONSORCIO SANTA LUCIA` now show explicit hosted alternative-only evidence.
- Confirmed representative-linked hosted evidence now appears in company dossiers such as `BUREAU VERITAS PARAGUAY S.R.L`, where `JOSE ANTONIO FERREIRA` shows a same-candidate hosted result that still remains review-only.
- Attempted a fresh hosted API rerun with the current trial key and received an OpenSanctions `429` monthly rate-limit response, so the durable next step is review workflow and evidence handling rather than repeated hosted calls.
- Added `sql/postgres/014_external_candidate_review_workflow.sql`, extending `entity_enrichment_candidates` with `reviewed_at`, `reviewed_by`, `review_notes`, and `review_evidence`, plus the hosted-aware `entity_enrichment_candidate_review_overview`.
- Added `src/storage/candidateReview.ts` and `npm run database:review-external-candidate`, allowing analysts to set `unreviewed`, `needs_evidence`, `promotable`, `monitor`, or `rejected` on external candidates without creating accepted matches or external risk signals.
- Added `docs/methodology/external-candidate-review-workflow.md` so future runs have a single workflow reference for candidate statuses, dry-run usage, evidence fields, and safety rules.
- Applied migration 014 to the live VPS PostgreSQL database after reopening the SSH tunnel; the review overview currently exposes 58 OpenSanctions candidate/diagnostic rows.
- Dry-ran the new review command for candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, confirming the high-priority hosted-supported lead suggests `needs_evidence` without mutating the database.
- Regenerated `external-enrichment-candidate-review.md`, `all-entities-intelligence-queue.md`, and entity briefs for `CONSULTORA GUARANI SA INGENIEROS CIVILES`, `BUREAU VERITAS PARAGUAY S.R.L`, `BLUE OCEAN COMPANY S.A.`, and `CONSORCIO SANTA LUCIA` with candidate IDs, review-state fields, hosted support, suggested status, and next-step guidance.

## 2026-04-24

- Reopened the SSH tunnel to the live VPS PostgreSQL database and confirmed the external candidate review state.
- Recorded the first real review-state decisions under `centinela-operator` rather than impersonating the user as reviewer.
- Marked candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, as `needs_evidence`. This remains a review lead, not an accepted match or risk signal.
- Marked exact representative-name diagnostics with hosted same-candidate evidence but missing Paraguay support as `monitor`: candidates `60`, `61`, `62`, `63`, and `64`.
- Marked partial representative-name overlaps as `rejected`: candidates `104`, `107`, `108`, and `113`.
- Added local identifier and profile context to `centinela.entity_enrichment_candidate_review_overview` and report outputs. Candidate `59` now shows local DNCP/DNIT RUC evidence including `80016063-0`, while the stored OpenSanctions/IADB payload has no comparable external identifier.
- Regenerated `external-enrichment-candidate-review.md`, `all-entities-intelligence-queue.md`, and affected entity dossiers so the live reports show review decisions, local identifiers, and evidence gaps.
- Identified the official IDB sanctioned firms and individuals page as the next source-document path for candidate `59` and recorded it in candidate review evidence without treating it as row-level confirmation.
- Added `docs/investigations/candidate-59-iadb-source-check.md`, documenting the local DNCP/DNIT identity package, OpenSanctions/IADB candidate package, unresolved row-level source gap, and exact next extraction fields.
- Added `src/enrichment/idbSanctions.ts` and `npm run enrichment:idb-sanctions-candidate`, a reusable official IDB Open Data row-level source-check connector for IADB/OpenSanctions candidates.
- Ran the IDB source-check connector for candidate `59`; it retrieved official IDB row `76193`, `Consultora Guaraní S.A. Ingenieros Civiles`, a Paraguay firm debarment row with `From` `2009-02-09 00:00:00.000000000` and `To` `Ongoing`.
- Persisted the IDB source row under `ext-idb-sanctions-open-data` in `source_records` and wrote source artifacts to `data/raw/external/idb/sanctioned-firms-individuals-candidate-59.json` and `data/reports/paraguay/idb-sanctions-candidate-59-source-check.md`.
- Updated candidate `59` from `needs_evidence` to `promotable`, meaning ready for second review, not an accepted match or external risk signal.
- Updated `src/storage/analyst.ts` so external candidate reports and entity dossiers show append-only review evidence history.
- Regenerated `external-enrichment-candidate-review.md`, `all-entities-intelligence-queue.md`, and the `CONSULTORA GUARANI SA INGENIEROS CIVILES` entity brief after the IDB source check.
- Reworked local storage so generated artifacts default to `C:\Users\Axeld\AppData\Local\Centinela\data` instead of the repo `data/` folder.
- Added `docs/ops/workspace-storage.md`, expanded `.gitignore`, and kept only a lightweight `data/README.md` pointer in the workspace.
- Initialized the local Git history on `main` with source-only commits and verified that generated `dist/` and `node_modules/` remain ignored.
- Installed GitHub CLI locally, confirmed GitHub authentication is still required, and added `scripts/publish-github.ps1` plus `docs/ops/github-publication.md` to publish public `Centinela` once the authenticated GitHub session exists.
- Published the public GitHub repository at `https://github.com/Axel-Acosta/Centinela`, set `origin`, pushed `main`, and hardened the publication helper.

## 2026-04-25

- Added `sql/postgres/015_external_candidate_second_review.sql`, introducing `entity_enrichment_second_reviews`, `entity_enrichment_second_review_overview`, and second-review fields in the candidate-review overview.
- Implemented `src/storage/secondReview.ts` and `npm run database:second-review-external-candidate`, allowing `promotable` candidates to be second-reviewed as `accepted_match`, `needs_more_evidence`, or `rejected_match`.
- Designed `accepted_match` to create an accepted enrichment identity match without creating an external risk signal or proof-of-wrongdoing language.
- Added `database:apply-sql`, a Node-based SQL application helper so migrations can be applied over the existing tunnel without requiring local `psql`.
- Updated entity dossiers and external-candidate review reports to show second-review decision, reviewer, rationale, limitations, evidence, and accepted-match ID.
- Added `docs/methodology/external-candidate-second-review-workflow.md` and refreshed analyst/investigation docs around the new governance boundary.
- Validation passed locally with `npm run check`, `npm run build`, and `git diff --check`.
- Live VPS application is still pending because the local SSH tunnel to PostgreSQL was closed and no non-interactive SSH session was available without exposing credentials.

## 2026-04-26

- Installed and verified a dedicated local SSH key for `axel@89.167.97.56`, allowing future VPS tunnel work without exposing the VPS password in commands or files.
- Opened the local SSH tunnel to the VPS PostgreSQL container at `172.18.0.2:5432` and confirmed `127.0.0.1:5432` connectivity.
- Applied `sql/postgres/015_external_candidate_second_review.sql` to the live `centinela` database through VPS-side `psql`.
- Created a local ignored `.env` from the VPS Postgres container environment so local Node/TypeScript commands can use the live DB over the SSH tunnel without committing credentials.
- Fixed the second-review writer so JSONB evidence arrays are serialized as JSON instead of PostgreSQL arrays, and added explicit casts for the candidate review update parameters.
- Dry-ran and then recorded candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, as `accepted_match` through second review.
- Live result: second review ID `2`, accepted enrichment match ID `11`, accepted external entity ID `12431`, and zero `entity_external_risk_signals` created by the second-review workflow.
- Regenerated `external-enrichment-candidate-review.md`, `all-entities-intelligence-queue.md`, and the `CONSULTORA GUARANI SA INGENIEROS CIVILES` entity brief under the local runtime data folder.
- Reassessed the next phase after the live second-review milestone and chose a local-only internal API/console as the highest-leverage synthesis step before a public UI or separate graph database.
- Added `src/storage/internalApi.ts`, exposing reusable query functions for overview counts, entity search, entity profiles, graph-ready entity neighborhoods, entity/process review queues, external candidates, and accepted external matches.
- Added `src/server/internalConsole.ts` and `npm run serve:internal-console`, a native Node local HTTP server with JSON endpoints and a first analyst console at `http://127.0.0.1:8787/`.
- Kept the console local-only by default; non-local binding requires `CENTINELA_ALLOW_REMOTE_CONSOLE=true` and should not be used publicly until authentication and public-safety controls exist.
- Smoke-tested the console against the VPS-backed live database: `8,716` entities, `13,529` processes, `1` accepted second review, top search hit for `CONSULTORA GUARANI`, `1` accepted match in the entity profile, and an `11` node / `10` edge graph-ready neighborhood sample.
- Added `docs/architecture/internal-api-console.md` and updated the roadmap, investigation layer, analyst workflow docs, system foundation, data model, README, and reference execution plan so the API/console becomes the next operational surface rather than a detached experiment.
- Added `sql/postgres/016_analyst_workspace.sql`, creating `analyst_cases`, `analyst_case_links`, `analyst_notes`, `analyst_case_overview`, and `analyst_note_overview`.
- Implemented `src/storage/analystWorkspace.ts` plus API routes for source-record search/drilldown, graph export, saved cases, case links, and token-protected saved analyst notes.
- Expanded the local console with source-record, analyst-note, and graph-export panels.
- Applied migration 016 to the live VPS-backed database.
- Smoke-tested the analyst-workspace slice: overview returned `8,376` source records, `0` analyst cases, and `0` analyst notes; Cytoscape graph export returned `19` elements for entity `3940`; source-record drilldown found IDB source record `10117`; dry-run note/case writes worked with a temporary token; wrong tokens returned `401`; no smoke notes or cases were persisted.
- Added `sql/postgres/017_analyst_case_timeline.sql`, creating `centinela.analyst_case_timeline` as a chronological internal casework view for case creation, linked targets, and case-scoped notes.
- Added `GET /api/analyst-cases/:id` through `getAnalystCase`, returning a case, links, notes, timeline events, and the non-accusatory internal-use disclaimer.
- Expanded the local console with a case timeline workbench that can create cases, open timelines, and link the current entity into a case.
- Applied migration 017 to the live VPS-backed database over the SSH tunnel.
- Smoke-tested the case timeline slice: one temporary case, one entity link to entity `3940`, and one temporary note returned `3` timeline events (`note`, `case_link`, `case_created`); cleanup deleted the smoke case/note and returned analyst cases and notes to `0`.
- Added `sql/postgres/018_analyst_evidence_links.sql`, creating `centinela.analyst_evidence_links` and `centinela.analyst_case_evidence_overview` for source-record evidence bundles with optional note linkage, field paths, field values, interpretations, limitations, and evidence roles.
- Added `POST /api/analyst-cases/:id/evidence-links`, evidence-link counts in overview, evidence links in `GET /api/analyst-cases/:id`, and evidence-link controls in the local console.
- Applied migration 018 to the live VPS-backed database over the SSH tunnel.
- Smoke-tested the evidence-link slice: one temporary case, one entity link to entity `3940`, one note, and one source-record evidence link to source record `10117` returned `1` evidence link, `1` linked source record on the note, and `4` timeline events (`evidence_link`, `note`, `case_link`, `case_created`); cleanup returned analyst cases, notes, and evidence links to `0`.
- Added bounded source-record field suggestions to `GET /api/source-records/:id`, plus in-case source-record search and click-to-fill field helpers in the local console.
- Smoke-tested the field-helper slice: source-record search for `Consultora Guarani` returned `4` records; source record `10117` returned `18` field suggestions; the top suggestion was `payload.centinelaExternalCandidateName` with role hint `supports_identity_context`; a temporary evidence link used that suggested field and cleanup returned cases, notes, and evidence links to `0`.
- Hardened the console item renderer so public-source text is inserted as text content instead of HTML while displaying source-record and field-suggestion values.
- Added `sql/postgres/019_case_evidence_exports.sql`, creating append-only public-safety review state, a latest public-review overview, a source-backed evidence export view, public review status on case overview, and `public_safety_review` events in the case timeline.
- Added `reviewAnalystCasePublicSafety` and `getAnalystCaseEvidenceExport` in `src/storage/analystWorkspace.ts`, with `approved_public` requiring both public summary and public limitations.
- Added internal API/console support for `POST /api/analyst-cases/:id/public-review` and `GET /api/analyst-cases/:id/evidence-export`, including console controls for public-safety status, public-safe summary/limitations, internal export, and public-approved export.
- Applied migration 019 to the live VPS-backed database over the SSH tunnel.
- Smoke-tested the public-safety gate: one temporary case and source-record evidence link used source record `10117`; `public_only=true` export was blocked before approval, internal export returned `1` evidence row, `approved_public` export returned `1` public row without `internal_analyst_interpretation`, and cleanup returned analyst cases, notes, evidence links, and public reviews to `0`.

## 2026-04-30

- Added `src/storage/caseEvidenceExport.ts`, a case evidence artifact writer that reuses the gated export path and writes Markdown plus JSON to the local non-sync runtime folder.
- Added `npm run database:case-evidence-export -- --case-id <id> --public-only false`, with `--public-only true` still enforced by the latest `approved_public` case review state.
- The JSON artifact includes a `sourceIndex` derived from linked evidence rows so analysts can see source record IDs, source keys, external IDs, URLs, retrieval times, and record kinds without opening raw source payloads first.
- Smoke-tested the artifact writer against the live VPS-backed database with a temporary case and source record `10117`: public export was blocked before approval, approved public export wrote Markdown and JSON artifacts, the source index contained `1` source record, no `internal_analyst_interpretation` leaked, and cleanup returned smoke cases/artifacts to `0`.
- Extended the case artifact writer with source attachment manifests that list linked source records, source-run context, source-run assets, source URLs, SHA-256 hashes, local path availability, and payload previews.
- Added `npm run database:case-source-manifest -- --case-id <id> --public-only false`, with `--public-only true` still enforced by the same `approved_public` gate.
- Smoke-tested the source manifest writer against the live VPS-backed database with a temporary case and source record `10117`: public manifest creation was blocked before approval, approved public manifest wrote Markdown and JSON artifacts, the manifest contained `1` linked source record and `2` source-run assets, no internal analyst interpretation leaked, and cleanup returned smoke cases/artifacts to `0`.
- Added `npm run database:case-source-bundle -- --case-id <id> --public-only false --copy-assets true`, a local case bundle writer that creates `bundle-index.json`, `README.md`, case evidence JSON/Markdown, source manifest JSON/Markdown, and an `attachments/` folder for copied source-run assets.
- Added compatibility resolution for source assets that still point at the old repo `data/` path, so the bundle writer can copy matching files from the current local runtime data folder.
- Smoke-tested the source bundle writer against the live VPS-backed database with a temporary case and source record `10117`: public bundle creation was blocked before approval, approved public bundle wrote all expected files, copied `2` of `2` source-run assets, did not leak internal analyst interpretation, and cleanup returned smoke cases/artifacts to `0`.

## 2026-05-01

- Extended source bundles so they automatically write `source-document-index.json`, `source-document-index.md`, and `source-document-index.jsonl` beside the evidence files, source manifest, and attachments.
- Added `npm run database:case-source-index -- --bundle-path <bundle-path> --query <text>`, a standalone refresh/search command for existing case source bundles.
- The source-document index extracts bounded text from copied text-like source files, stores searchable text, query snippets, source-record IDs, evidence-link IDs, asset metadata, hashes, and non-accusatory use limits.
- Smoke-tested the source-document index against the live VPS-backed database with a temporary case and source record `10117`: public bundle/index creation was blocked before approval, approved public bundle copied `2` source assets, automatic index files were written, a refreshed query for `Consultora Guarani` returned `2` searchable documents and `2` query matches, matched documents preserved source-record and evidence-link traceability, no internal analyst interpretation leaked, and cleanup returned smoke cases/artifacts to `0`.
- Added token-protected local API routes for case artifact generation: `POST /api/analyst-cases/:id/evidence-artifacts`, `POST /api/analyst-cases/:id/source-manifests`, `POST /api/analyst-cases/:id/source-bundles`, and `POST /api/source-document-indexes`.
- Expanded the case timeline workbench in `src/server/internalConsole.ts` with local controls for artifact public-only mode, evidence limit, source-index query, bundle path, evidence artifact creation, source manifest creation, source bundle creation, and source-index refresh.
- Smoke-tested the artifact API/console path against the live VPS-backed database with a temporary case and source record `10117`: public-only bundle creation was blocked before approval, approved public API routes wrote evidence artifacts, source manifests, and a source bundle, the bundle copied `2` source assets, both immediate and refreshed `Consultora Guarani` index queries returned `2` matches, the console exposed the new controls, and cleanup removed the temporary case/artifacts.
- Added `src/storage/caseArtifacts.ts`, a lightweight artifact registry reader that scans local runtime case folders and summarizes evidence artifacts, source manifests, source bundles, and source-document indexes without introducing a database artifact table yet.
- Added `GET /api/analyst-cases/:id/artifacts` and a `Load generated artifacts` case-workbench control so analysts can reopen generated bundle/index summaries after the initial creation response is gone.
- Smoke-tested the artifact registry against the live VPS-backed database with a temporary case and source record `10117`: the registry returned `3` artifact summaries, found evidence artifact/source manifest/source bundle kinds, preserved the latest bundle path, showed `2` indexed documents and `2` query matches, verified the console button, and cleanup removed the temporary case/artifacts.
- Reopened the VPS PostgreSQL SSH tunnel and reassessed the final local identity anchor gap.
- Confirmed `MENDEZ GONZALEZ FLORIANA *` still has only `PY-RUC-4070792`; the official DNIT RUC equivalence bulk files do not contain RUC base `4070792`, the DNCP OCDS release exposes the same base-only identifier, DNCP supplier CSV lookups for `4070792-0` through `4070792-9` did not resolve a provider row, and linked official PDFs were not text-extractable with the installed parser.
- Hardened the OpenSanctions bulk rerun path so reviewed candidates and second-review audit trails are not deleted by a baseline refresh.
- Updated OpenSanctions candidate scoring with distinctive shared tokens, generic shared tokens, distinctive-token overlap, and name-order scoring. Paraguay-supported company review candidates now need strong distinctive-token evidence; generic business/sector overlaps without Paraguay support are downgraded to diagnostic confidence `0.32`.
- Fixed external-candidate reports so closed second-review rows no longer show an invalid first-review command, and second-review evidence now renders type/value rationale and limitations clearly.
- Reran OpenSanctions bulk against index `20260501065427-hyu`: 2,534 supplier companies and 3,165 DNCP legal representatives screened against 1,263,600 target rows; zero accepted bulk matches, one review candidate, 57 rejected diagnostics, and zero external risk signals.
- Verified candidate `59` survived the rerun with second-review decision `accepted_match`, accepted match ID `11`, and enriched evidence showing distinctive tokens `guarani, civiles`, generic tokens `consultora, ingenieros`, distinctive overlap `1`, and name-order score `1`.
- Regenerated `external-enrichment-candidate-review.md`, `all-entities-intelligence-queue.md`, and entity briefs for `CONSULTORA GUARANI SA INGENIEROS CIVILES` and `MENDEZ GONZALEZ FLORIANA *` under the local runtime data folder.

## 2026-05-03

- Re-read the current Centinela memory/docs and confirmed the next bottleneck remains lawful Paraguay cross-domain/company accountability source depth, with DNCP release/document source-record ingestion as the strongest practical fallback while ownership/officer registry access remains unclear.
- Added `src/enrichment/dncpReleaseSourceCheck.ts` and `npm run enrichment:dncp-release-source-check`, a connector that starts from an existing local entity, fetches official DNCP OCDS release packages for linked procurement processes, extracts matching party records and document metadata, and persists `ocds_release_package` plus `ocds_document_metadata` source records.
- Added bounded per-release fetch timeouts so slow DNCP release URLs produce recorded fetch errors instead of freezing the run.
- Upgraded entity briefs with an `Official source records and documents` section showing entity-linked source-record IDs, record kinds, titles, related process, document type, field path, retrieval time, and source URLs.
- Ran the connector for `MENDEZ GONZALEZ FLORIANA *`, the remaining local identity anchor gap: 1 process checked, 1 official release fetched, 1 release package source record persisted, and 18 document metadata records persisted. The official release still shows only base RUC `4070792`, so the missing check digit remains unresolved.
- Ran the connector for `CONSULTORA GUARANI SA INGENIEROS CIVILES`, the accepted second-review external identity-context entity: source records are now available for official DNCP process-document navigation around this company.
- Confirmed the live `py-dncp-release-source-check` state: 4 official release package source records and 567 official document metadata source records across `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`.
- Added `docs/methodology/dncp-release-source-check.md` and refreshed source status, source plan, progress estimate, data model, reference execution plan, and next steps so future runs inherit this source-record/document-intelligence lane.

## 2026-05-04

- Continued from the live DNCP/Postgres/entity-intelligence foundation and chose selected official DNCP document content capture as the next highest-leverage slice.
- Added `scripts/extract_pdf_text.py`, a bounded local PDF text-extraction helper using the bundled Python runtime and `pypdf`.
- Added `src/enrichment/dncpDocumentContent.ts` and `npm run enrichment:dncp-document-content`, a connector that starts from persisted `py-dncp-release-source-check` document metadata, downloads selected official DNCP documents, stores local source assets and SHA-256 hashes, attempts bounded text extraction, and persists `document_content_extract` source records under `py-dncp-document-content`.
- Upgraded entity briefs so `document_content_extract` records show extraction status, extracted character count, SHA-256 hash, local captured document path, and extracted text path inside `Official source records and documents`.
- Ran dry-run checks against official DNCP contract PDFs for `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`; both downloaded successfully and both returned `no_extractable_text` with the current local parser.
- Persisted the two selected official DNCP contract captures live: source record `10785` for Mendez parent metadata record `10178`, and source record `10786` for Consultora Guarani parent metadata record `10226`.
- Regenerated the two entity briefs so the captured official PDFs, hashes, extraction status, and local file paths are visible to analysts.
- Added `docs/methodology/dncp-document-content-extraction.md` and refreshed source status, roadmap, analyst workflow docs, release-source methodology, reference execution tracking, and next steps around the new document-capture lane.

## 2026-05-06

- Continued from the live DNCP/Postgres/entity-intelligence foundation and chose entity source packs as the next larger self-contained slice.
- Added `src/storage/entitySourcePack.ts`, a workflow that starts from an entity, selects entity-linked source records, creates/reuses an analyst case, links source records, creates non-accusatory evidence links, and writes evidence artifacts, source manifests, source bundles, and source-document indexes.
- Added `npm run database:entity-source-pack`, with entity-name/entity-ID selection, stable case-key support, source-record kind filters, payload query filters, source-index query support, dry-run mode, public-only gating, and asset-copy controls.
- Added `docs/methodology/entity-source-pack-workflow.md` and updated analyst workflow docs, source status, roadmap, reference execution tracking, and next steps so future runs treat source packs as the bridge from entity dossiers to casework.
- Ran the workflow live for `MENDEZ GONZALEZ FLORIANA *`: created/reused case `19` with case key `entity-source-pack-mendez-gonzalez-floriana`, linked 8 source records, created 8 evidence links on the first run, verified rerun idempotency with 0 new evidence links and 8 skipped existing links, and wrote local evidence/source-bundle/index artifacts. The source-index query returned 0 matches, consistent with the known scanned/no-extractable-text limitation.
- Ran the workflow live for `CONSULTORA GUARANI SA INGENIEROS CIVILES`: created/reused case `20` with case key `entity-source-pack-consultora-guarani`, linked 10 source records, created 10 evidence links, wrote local evidence/source-bundle/index artifacts, and produced 5 source-document index query matches for `Consultora Guarani`.
- Added `POST /api/entities/:id/source-packs` and case-workbench preview/write buttons so the local internal console can generate entity source packs without using the CLI.
- Smoke-tested the API/console route with a temporary local write token: `POST /api/entities/3940/source-packs` returned a dry-run source pack for `CONSULTORA GUARANI SA INGENIEROS CIVILES`, selected 3 source records, created no case, and `/console` exposed both source-pack buttons plus the source-pack endpoint.
- Added `src/storage/entitySourcePackReadiness.ts` and `npm run database:entity-source-pack-readiness`, a live rollout report that ranks company entities by review-queue priority plus source-record/source-pack coverage and recommends the next source-pack action without making accusations.
- Ran the readiness report against the live database with `--limit 15 --source-record-limit 10`; the initial result showed all top 15 high-priority companies needed `py-dncp-release-source-check`.
- Widened official DNCP release/document source checks for the top three readiness entities: `PROSALUDFARMA S.A.` (#224), `INDEX S.A.C.I.` (#261), and `QUIMFA S.A.` (#237). Live result: 6 new official release package records and 895 new official document metadata records, bringing `py-dncp-release-source-check` to 10 release package records and 1,462 document metadata records.
- Built live source packs for those three entities: case `22` for `PROSALUDFARMA S.A.`, case `23` for `INDEX S.A.C.I.`, and case `24` for `QUIMFA S.A.`, initially with 10 evidence links each and source-document query matches.
- Ran selected `py-dncp-document-content` attempts for two `contrato` documents per new priority entity. DNCP returned `404` for all 6 selected contract URLs, so Centinela stored `document_content_extract` limitation records rather than treating the documents as captured.
- Refreshed the three new source packs after document-content attempts. Each case now has 12 source-pack evidence links, and the source-document index query returned 3 matches per refreshed pack.
- Regenerated entity briefs for `PROSALUDFARMA S.A.`, `INDEX S.A.C.I.`, and `QUIMFA S.A.` so the latest official source records and document-access limitations are visible in analyst-facing dossiers.
- Refined source-pack readiness to distinguish successful document downloads from `download_failed` content attempts. Latest readiness result: 3 entities are `ready_for_internal_review_with_document_download_limits`; the next 12 ranked entities still need `py-dncp-release-source-check`.

## 2026-05-12

- Re-read the current project memory, roadmap, internal API/console docs, analyst-workspace docs, source-pack workflow, source status, and run log before shifting from backend/source expansion to the presentable-interface phase.
- Chose the existing native Node local console as the highest-leverage product surface instead of introducing a separate frontend stack, because it already reaches the live PostgreSQL-backed evidence spine, entity dossiers, graph-ready neighborhoods, source records, cases, public-safety gates, source packs, and artifact registry.
- Upgraded `src/server/internalConsole.ts` into the first product-like local Command Center with a sticky navigation shell, live system overview, workflow map, review-first guardrail, source-pack showcase, product-style entity dossier summary, relationship summary, case/source-pack workspace, review queues, and methodology/precedent synthesis.
- Fixed the entity source-record queries in `src/storage/internalApi.ts` and `src/storage/analystWorkspace.ts` so profile/source-record endpoints no longer fail on PostgreSQL's `SELECT DISTINCT` / `ORDER BY` expression rule.
- Kept the interface local-only and non-accusatory; accepted matches remain second-reviewed identity context, review candidates remain separate, and source limitations remain visible.
- Updated `docs/architecture/internal-api-console.md`, `docs/execution/next-phase-roadmap.md`, `docs/execution/progress-and-remaining-work.md`, `docs/execution/reference-to-component-execution-plan.md`, and `memory/next-steps.md` so future runs treat this as the first internal product-surface milestone.
- Validation: `npm run check`, `npm run build`, and `git diff --check` passed. A live local console smoke test against the VPS-backed database returned `200` for the Command Center page, overview, entity search, entity profile `3940`, and entity network, and confirmed the page contains the source-pack showcase and methodology section.
- Continued the Command Center phase with the next self-contained product slice: SVG entity graph visualization, filterable entity/process/external-candidate queues, read-only source-pack readiness API and panel, artifact browser, and bounded artifact-detail endpoint for local case artifacts.
- Added `GET /api/entity-source-pack-readiness`, which reuses source-pack readiness logic without writing report files during interface browsing.
- Added `GET /api/analyst-cases/:id/artifact-detail`, which validates that selected artifact paths stay inside the case artifact folder before returning bounded local previews.
- Updated product/interface docs and memory so the next interface milestone is case pages as source-backed review packets, richer source-document index previews, and graph filtering/expansion.
- Validation: `npm run check` passed. Live local console smoke against the VPS-backed database returned `200` for the Command Center page, entity network, source-pack readiness API, process queue, artifact registry for case `20`, and artifact detail for the latest case `20` source bundle.
- Continued the Command Center phase with a larger internal-product slice: graph relation/type filters with a larger network limit, readable source-backed case review packets, and artifact/source-document match previews.
- The case review packet renders public-safety gate state, linked targets, source-record evidence rows, limitations, and timeline cards from `GET /api/analyst-cases/:id`, while keeping the raw JSON fallback.
- The artifact preview renders source-document index query, match counts, source-record IDs, evidence-link IDs, snippets, and use limits from `GET /api/analyst-cases/:id/artifact-detail`.
- Updated internal API/console docs, analyst-workspace docs, roadmap, progress estimate, source status, reference execution tracking, and next steps so future runs treat this as an achieved product-surface milestone.
- Validation: `npm run check` passed. Live local console smoke against the VPS-backed database returned page `200`, confirmed `graph-relation-filter`, `case-review-packet`, and `artifact-detail-preview` are present, confirmed entity `3940` network returned `11` nodes and `10` edges at limit `24`, confirmed case `20` returned `10` evidence links and `22` timeline events, confirmed case `20` artifact registry returned `3` artifacts, confirmed the latest source bundle artifact detail returned `8` indexed documents and `5` `Consultora Guarani` query matches, and confirmed the served inline script parsed successfully.

## 2026-05-13

- Continued without waiting for per-step approval and chose the next Command Center internal-MVP slice: visible methodology/limits/publication-safety guidance plus source-pack case navigation.
- Added allowed-claim and blocked-claim cards, an evidence ladder, external matching caution, source limitation guidance, public-gate guidance, and a source verification checklist to the Command Center methodology section.
- Added source-pack shortcuts for the current live entity source-pack cases, including direct case-packet opening from showcase cards, entity dossier shortcut cards, and the case workspace.
- Verified the uncertain Mendez shortcut against the live API: `MENDEZ GONZALEZ FLORIANA *` is entity `5319`, case `19`.
- Validation: `npm run check`, `npm run build`, and `git diff --check` passed. Live local console smoke against the VPS-backed database returned page `200`, confirmed the methodology/safety surface and source-pack controls are present, confirmed the served inline script parsed successfully, confirmed case `19` returned `8` evidence links and `18` timeline events, and confirmed case `20` still returned `3` generated artifacts.

## 2026-05-14

- Continued autonomously from the live Command Center/product-surface state and closed the remaining internal-MVP hardening slice.
- Added artifact/source verification checks to `src/storage/caseArtifacts.ts`, covering path containment, bundle index, source manifest, source-document index, copied asset coverage, SHA-256 verification, source URL coverage, and publication-gate state.
- Added an artifact/source verification panel to the Command Center artifact preview and added `src/quality/commandCenterSmoke.ts` plus `npm run smoke:command-center`.
- Smoke-tested the Command Center against the live VPS-backed DB: overview returned `8,716` entities and `10,757` source records after source expansion; entity search, dossier, network, case `20`, artifact registry, artifact detail, and source-pack readiness all passed; case `20` bundle detail returned `8` verification checks.
- Found and validated a stronger next Paraguay cross-domain source: the Abogacia del Tesoro public open-data portal for Personas Jurídicas y Beneficiarios Finales.
- Added `src/enrichment/abogaciaBeneficialOwnershipPublicIndex.ts` and `npm run enrichment:abogacia-beneficial-ownership-public-index`, a company-only connector that intentionally ingests only `ruc_nro` and `denominacion` from the public company index.
- Ran the Abogacia connector live after a dry run. Latest clean UTF-8 run: source run `49`, `31,649` public company rows parsed, `5,040` local procurement-linked RUC targets considered, and `899` procurement-linked companies matched by RUC base.
- Regenerated the `CONSULTORA GUARANI SA INGENIEROS CIVILES` entity brief; it now shows `PY-ABOGACIA-RUC-BASE:80016063` and the Abogacia company-level public-index profile.
- Added `docs/methodology/abogacia-beneficial-ownership-public-index.md` and updated source status, roadmap, progress estimates, analyst workflow docs, reference execution tracking, and next steps.
- Privacy boundary: person-level Abogacia director/shareholder/beneficial-owner CSVs are discovered but not ingested. Next run should design a privacy-safe person relationship staging lane before touching those fields.
- The requested `impeccable` skill was not installed as a Codex skill in this environment, so Centinela now has its own `.impeccable.md` product quality contract adapted from the existing impeccable-style guidance: dossier before dashboard, evidence trail over spectacle, review-first language, progressive disclosure, no fake proof, and visible source limitations.
- Upgraded the Command Center with a guided proof path that opens the canonical live Consultora Guarani dossier, source-pack case `20`, generated artifact/source verification trail, and methodology limits.
- Extended `npm run smoke:command-center` so the guided proof-path surface is part of the repeatable local interface gate.
- Validation passed with `npm run check`, `npm run build`, `git diff --check`, and `npm run smoke:command-center`. Browser verification clicked the guided proof path: `Open case packet` loaded case `20`, and `Open evidence trail` loaded artifact/source verification with source-document matches, hash verification, and publication-gate checks.
