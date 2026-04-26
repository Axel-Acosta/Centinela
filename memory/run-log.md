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
