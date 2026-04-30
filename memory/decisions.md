# Decisions

## 2026-04-16 - Canonical storage strategy

- Decision: Use PostgreSQL as the canonical long-term store, with local file outputs as the first-run development and evidence layer.
- Why: PostgreSQL fits the available VPS, supports durable relational and JSON workloads, keeps future query and API work straightforward, and can model graph-like edges without forcing an early graph-database commitment.
- Consequence: The repo includes a PostgreSQL schema and file-based first slice. A graph database remains a possible later sidecar, not a first dependency.

## 2026-04-16 - Modeling strategy

- Decision: Build a relationship-aware internal model instead of an immediate Neo4j-first product.
- Why: Paraguay-first ingestion and explainable risk logic need fast, legible, low-friction foundations first. Link tables and entity identifiers can support graph exports later.
- Consequence: The first schema uses entities, identifiers, processes, awards, contracts, and relationship tables, plus risk-signal evidence tables.

## 2026-04-16 - Initial country slice

- Decision: Start with live DNCP procurement/OCDS endpoints as the first real Paraguay implementation slice.
- Why: DNCP offers both bulk annual OCDS ZIPs and a usable API v3 surface, making it the fastest serious source to operationalize without waiting for credentials or scraping brittle HTML.
- Consequence: The first executable pipeline focuses on DNCP open tenders and recent awarded processes.

## 2026-04-16 - VPS database provisioning

- Decision: Provision a dedicated `centinela` database on the VPS and apply the initial PostgreSQL schema immediately.
- Why: The user explicitly offered the VPS, the server already runs PostgreSQL 16, and a dedicated database reduces later setup friction without interfering with existing application databases.
- Consequence: Future runs can focus on loaders and analyst/query layers instead of repeating infrastructure bootstrap.

## 2026-04-17 - Operational database load path

- Decision: Use a batched local-Node loader over an SSH tunnel into the PostgreSQL container network instead of installing Node on the VPS or keeping the original row-by-row insert path.
- Why: The VPS already exposes Docker and PostgreSQL but does not have `node` or `npm`, and the first row-by-row loader was too chatty for tunnel-based loading.
- Consequence: Centinela now has a practical, repeatable load path for annual bundles without forcing a remote application runtime onto the server.

## 2026-04-17 - First investigation layer

- Decision: Add SQL analyst views plus a markdown analyst brief generator before building any UI.
- Why: This creates a real investigation workflow now, keeps the system explainable, and avoids prematurely locking into a frontend before the data layer matures.
- Consequence: The current internal investigation surface is PostgreSQL-backed and report-driven, with a clearer path toward later API and UI work.

## 2026-04-17 - Synthesis mandate as operating constitution

- Decision: Make the "every major precedent must shape a real component" rule part of Centinela's durable operating constitution.
- Why: The project risk was not weak foundations, but narrowing too early into a DNCP/PostgreSQL/Cardinal/br/acc core with the other references reduced to commentary.
- Consequence: Comparative work now has to materialize into execution artifacts, staged requirements, schema pressure, workflow pressure, methodology pressure, or product pressure.

## 2026-04-17 - Multi-year entity intelligence before UI

- Decision: Use the next phase to deepen the investigation layer through multi-year procurement loading, entity-source provenance, edge views, entity briefs, and review queues before adding an API or console.
- Why: This advances multiple references at once: br/acc provenance, Aleph entity-centric workflow, Dozorro-style follow-up, OpenTender aggregation, Sayari-style dossiers, QQW-style company transparency, and Rosie-style human review semantics.
- Consequence: The current foundation is no longer only process-level. Centinela now has the first shared entity intelligence and follow-up layer that later API and UI work can expose.

## 2026-04-17 - Formal rule registry as shared system backbone

- Decision: Make the rule registry a shared code-plus-database backbone instead of leaving risk logic in TypeScript and review semantics in SQL case statements.
- Why: Methodology, review routing, precedent influence, and public-safe explanation should evolve together rather than drifting across separate hard-coded layers.
- Consequence: Centinela now has `src/integrity/ruleRegistry.ts`, `centinela.risk_rule_registry`, `centinela.risk_rule_coverage`, and a rulebook report artifact.

## 2026-04-17 - Process-level recurrence signal instead of duplicate per-supplier flags

- Decision: Collapse repeated buyer-supplier recurrence into one process-level concentration signal with structured evidence rather than emitting many duplicate rule rows inside the same process.
- Why: The previous implementation overstated signal volume, made reports noisy, and weakened methodological clarity.
- Consequence: Repeat-pair review remains strong, but the queue, entity briefs, and rule counts are now much more interpretable.

## 2026-04-18 - OpenSanctions bulk as the first external-risk connector

- Decision: Use OpenSanctions public bulk data as Centinela's first live external-risk connector, and screen the current Paraguay supplier-company set conservatively against it.
- Why: The hosted OpenSanctions matching API currently requires authentication, but the public bulk `default` dataset remains reachable and is the fastest lawful path to real external-risk, provenance, and graph-expansion pressure.
- Consequence: Centinela now has a live enrichment spine, but the next highest-value connector should be a Paraguay official company or supplier-disqualification source so the company identity layer does not remain external-only.

## 2026-04-18 - Conservative company-only matching over noisy broad matching

- Decision: Restrict the first OpenSanctions screening pass to conservative company-to-company matching instead of broad exact-name matching across people and companies.
- Why: The first live pass produced obvious false positives by matching supplier-company names against person/PEP records, which would weaken analyst trust and legal defensibility.
- Consequence: The current production result is zero stored matches, but the connector, provenance model, and dossier upgrades are now trustworthy enough to build on.

## 2026-04-18 - DNCP RUC-keyed supplier anchor before broader registry work

- Decision: Use the official DNCP supplier and sanctions search surfaces keyed by procurement-linked RUC as Centinela's first local Paraguay company anchor.
- Why: The loaded supplier universe already carries RUC identifiers, and DNCP's official CSV exports give a much stronger immediate identity/disqualification anchor than another name-only or unofficial scraping path.
- Consequence: Centinela now has official local supplier profiles, plain-RUC identifiers, representative links, and local administrative signals for the screened supplier slice, which makes the next ownership and external-enrichment stages materially stronger.

## 2026-04-18 - Incremental supplier-anchor widening before second local source automation

- Decision: Make the DNCP supplier-anchor connector incremental and widen it across the current procurement-linked supplier universe before attempting brittle automation against a second official source.
- Why: The official DNIT/SET public taxpayer-profile flows observed on April 18, 2026 appear human-oriented and reCAPTCHA-protected from the current repo state, while the official DNCP supplier anchor remains lawful, exact-RUC keyed, and immediately scalable.
- Consequence: Centinela now covers most procurement-linked supplier companies with an official local anchor, and the next local-source step can focus on validation and gap-closing rather than rebuilding the first anchor from scratch.

## 2026-04-18 - Separate company-level intelligence triage from process-level queueing

- Decision: Add a dedicated company-level entity-intelligence queue on top of the existing process review queue.
- Why: Local company anchors, local administrative history, representative links, and external enrichment state answer a different investigator question than process-level procurement flags, and collapsing them into one queue would blur follow-up semantics.
- Consequence: Centinela now has a distinct review surface for company-anchor gaps, local sanctions review, relationship review, and future external-match review.

## 2026-04-18 - Treat residual supplier-anchor gaps as a first-class workflow

- Decision: Add bounded fallback matching and a dedicated anchor-gap review view instead of treating remaining DNCP supplier misses as generic connector failures.
- Why: The unresolved tail contains messy but important local identity cases: punctuation noise, consortium names, person-name ordering, obsolete or non-supplier RUCs, and registry-code/RUC ambiguity. These need traceable review lanes, not silent no-match handling.
- Consequence: The connector resolved 18 of the 31 residual gaps, the live gap backlog fell to 13, and analysts now have `entity_anchor_gap_review` plus `database:entity-anchor-gaps` for local identity follow-up before external enrichment escalation.

## 2026-04-18 - Separate DNCP supplier codes from Paraguay RUC identifiers

- Decision: Classify DNCP supplier-registry identifiers by observed format, storing numeric RUC-like values as `PY-RUC-PLAIN` and DNCP registry codes as `DNCP-SUPPLIER-CODE`.
- Why: Some official DNCP supplier rows for consortia expose values like `DNCP-002002`, which are useful source identifiers but should not be presented as taxpayer RUCs.
- Consequence: Entity dossiers now distinguish procurement RUC, DNCP supplier slug, and DNCP supplier registry code, preserving local identity evidence without overstating identifier meaning.

## 2026-04-19 - Use DNIT RUC equivalence as bounded identity validation, not a taxpayer mirror

- Decision: Operationalize the official DNIT RUC equivalence bulk ZIPs as `py-dnit-ruc-equivalence`, but persist only rows that match procurement-linked supplier entities already in Centinela.
- Why: The DNIT equivalence list is the strongest lawful bulk identity-validation source found so far for Paraguay RUC-linked suppliers, while the separate taxpayer-profile/constancia flows remain human-oriented and should not be automated blindly.
- Consequence: Centinela now has DNCP supplier-registration anchors and DNIT taxpayer identity-validation profiles as distinct local identity layers. The live local identity coverage improved from 2,521/2,534 to 2,533/2,534 supplier companies, and the final gap is now specifically a missing-RUC-check-digit data-quality lead rather than a generic supplier-anchor failure.

## 2026-04-19 - Screen DNCP legal representatives separately from companies

- Decision: Extend OpenSanctions bulk screening from company-only matching to a separate DNCP legal-representative person lane, but keep representative hits review-only and prevent name-only person matches from writing external risk signals.
- Why: The project needs to move toward br/acc/Sayari-style cross-entity intelligence without repeating the earlier false-positive problem where company names matched person records. DNCP representative links are useful relationship leads, but they are not ownership proof or identity proof against external records by themselves.
- Consequence: OpenSanctions now screens both supplier companies and representative persons. The first representative-aware rerun found zero stored candidates, which is a valid conservative result and makes the next external-enrichment step clearer: authenticated/Yente matching or a local rejected/near-candidate review index.

## 2026-04-19 - Separate accepted matches from review candidates and rejected diagnostics

- Decision: Add a dedicated `entity_enrichment_candidates` layer for OpenSanctions near matches and rejected diagnostics, instead of forcing every surfaced external row into accepted matches or hiding it as a no-match.
- Why: Centinela needs an analyst-safe middle state. Exact accepted matching was too sparse, but broad matching would be legally and methodologically weak. Candidate records let analysts see why something was surfaced, why something was rejected, and what extra evidence would be needed before escalation.
- Consequence: The entity queue now has an `external_candidate_review` lane for review-worthy company candidates, while rejected diagnostics remain visible in dossiers without becoming external risk signals or proof of identity.

## 2026-04-19 - Prefer candidate precision over broad review queue volume

- Decision: Tighten OpenSanctions candidate escalation so generic company-token overlaps and weak two-token person overlaps stay as diagnostics unless stronger Paraguay-supported evidence exists.
- Why: The first review-only candidate layer proved useful, but it over-queued short person-name overlaps and a generic consortium/asociados company overlap. A smaller queue with clearer evidence is more defensible than broad review volume.
- Consequence: The live queue now has one company-level external candidate lead and a separate external-candidate report for diagnostics. This preserves auditability while reducing false-positive pressure before any manual review or promotion workflow exists.

## 2026-04-23 - Hosted OpenSanctions API trial before self-hosted Yente

- Decision: Implement hosted OpenSanctions API comparison first, using `POST /match/default?algorithm=logic-v2`, and keep self-hosted Yente as a later architecture choice after real volume is known.
- Why: OpenSanctions explicitly recommended starting with the hosted API trial. It gives Centinela immediate matcher comparison without adding local Yente infrastructure, index updates, or operational burden.
- Consequence: Centinela now has a dry-run capable hosted-match comparison lane. Real calls only require `OPENSANCTIONS_API_KEY`; hosted results remain comparison evidence and do not automatically create accepted matches or risk signals.

## 2026-04-23 - Persist hosted matcher evidence into the core analyst workflow

- Decision: Store the latest hosted OpenSanctions comparison results in PostgreSQL and reuse them in the queue, candidate-review report, and entity dossiers instead of leaving them as a detached markdown/json artifact.
- Why: The first live hosted comparison proved useful, but its practical value would stay limited if analysts had to leave the main workflow to inspect it. Persisting comparison evidence makes hosted same-candidate confirmation and different-result ambiguity visible where review decisions already happen.
- Consequence: Centinela now has `sql/postgres/013_hosted_match_comparisons.sql`, `entity_hosted_match_comparison_overview`, hosted-aware queue and dossier output, and a clearer path toward manual candidate review states. A later `429` monthly rate-limit response on the trial key makes this persistence step even more important because the first live hosted run can still inform analyst work after direct API calls pause.

## 2026-04-23 - Manual external candidate review before accepted-match promotion

- Decision: Add manual review metadata and a CLI workflow for `entity_enrichment_candidates` before building any automatic promotion path from OpenSanctions/Yente evidence.
- Why: The hosted matcher produced useful same-candidate and alternative-result evidence, but Centinela's legal/ethical standard requires a human-review boundary before any external candidate can become an accepted match or risk signal.
- Consequence: Candidate rows now carry `reviewed_at`, `reviewed_by`, `review_notes`, and append-only `review_evidence`. The valid workflow labels are `unreviewed`, `needs_evidence`, `promotable`, `monitor`, and `rejected`; `promotable` means ready for stronger second review, not accepted identity resolution.

## 2026-04-24 - Row-level source evidence before accepted-match insertion

- Decision: Add an official IDB Open Data row-level source-check connector for IADB/OpenSanctions candidates, and mark source-confirmed candidates as `promotable` rather than automatically inserting accepted matches.
- Why: Candidate `59` had OpenSanctions and hosted matcher support, but Centinela needed primary-source evidence and a visible limitation around the lack of comparable external RUC before any accepted-match governance.
- Consequence: `src/enrichment/idbSanctions.ts` now persists official IDB source rows into `source_records`, appends candidate review evidence, and leaves accepted-match insertion for a later second-review workflow.

## 2026-04-24 - Keep generated artifacts out of the repo

- Decision: Move generated raw/normalized/report artifacts to a local non-sync runtime folder by default, while keeping the workspace source-focused and GitHub-ready.
- Why: DNCP raw ZIPs and normalized JSON bundles are large and churn during runs, which creates unnecessary OneDrive/sync pressure and makes the repo feel messy.
- Consequence: `CENTINELA_OUTPUT_DIR` now defaults to the local runtime data directory, `data/` is ignored except for a README pointer, and `docs/ops/workspace-storage.md` defines what belongs in Git versus local runtime storage.

## 2026-04-24 - Publish source through a public GitHub repo

- Decision: Treat GitHub as the durable public source home for Centinela, but keep operational data in the VPS/PostgreSQL layer and local non-sync runtime storage.
- Why: This reduces OneDrive pressure, gives Centinela a clean collaboration/release surface, and avoids mixing heavy generated data or private credentials into repository history.
- Consequence: `scripts/publish-github.ps1` creates or connects public `Centinela`, pushes the clean local `main`, and records civic-tech/procurement metadata after the user completes GitHub CLI authentication.

## 2026-04-25 - Second review before accepted external matches

- Decision: Add a separate second-review governance layer for `promotable` external candidates instead of letting first-review status insert accepted matches directly.
- Why: Centinela needs a defensible boundary between source-backed candidates and accepted enrichment identity matches, especially when external records lack comparable Paraguay identifiers such as RUC.
- Consequence: `entity_enrichment_second_reviews` records reviewer, decision, rationale, limitations, evidence, and accepted-match ID. `accepted_match` creates an enrichment identity match only; it does not create an external risk signal or proof-of-wrongdoing conclusion.

## 2026-04-26 - Use SSH keys and local ignored env for live DB operations

- Decision: Use a dedicated local SSH key for VPS access and a local ignored `.env` for tunneled PostgreSQL commands instead of putting passwords into commands, docs, or committed files.
- Why: Centinela needs repeatable live database operations, but secrets should not be exposed through command history, process lists, Git history, or durable project memory.
- Consequence: Future live DB work can reopen the tunnel non-interactively and run local Node/TypeScript commands against the VPS-backed `centinela` database while keeping credentials out of the repo.

## 2026-04-26 - Accepted external matches remain identity context only

- Decision: Record candidate `59` as an accepted enrichment identity match through second review, while preserving the limitation that the external source has no comparable RUC and creating no external risk signal.
- Why: The local DNCP/DNIT identity package, hosted matcher support, and official IDB row-level source evidence are strong enough for source-backed identity context, but they are not a misconduct finding and do not erase the identifier limitation.
- Consequence: Centinela now has its first live accepted external enrichment match, but public and analyst outputs must continue to show provenance, limitations, and non-accusatory language.

## 2026-04-26 - Local internal API and console before public UI or graph database

- Decision: Build the first local-only internal API/console on top of the live PostgreSQL views before adding a public dashboard, saved-case product layer, or separate graph database.
- Why: The live foundation already has procurement rules, local identity anchors, external candidates, hosted comparison evidence, source-record checks, and second-review state. The highest leverage now is to make those layers explorable together through entity search, dossiers, queues, and graph-ready relationship neighborhoods.
- Consequence: Centinela now has a reusable local analyst surface that advances Aleph/Sayari-style investigation, br/acc-style graph-ready provenance, Dozorro-style review queues, QQW-style company-contract accountability, and RUBLI/Integrity-Watch-style cautious explanation without prematurely exposing anything publicly.

## 2026-04-26 - Analyst workspace primitives before public case management

- Decision: Add saved analyst cases, case links, analyst notes, source-record drilldowns, and graph export to the local API/console before building a full UI, public case pages, or a graph database.
- Why: Centinela needs durable human-review context, but analyst notes must stay separate from automated risk signals and public-facing conclusions. A small local write-token boundary is enough for the current local-only workspace without pretending to be production authentication.
- Consequence: `sql/postgres/016_analyst_workspace.sql`, `src/storage/analystWorkspace.ts`, source-record endpoints, graph export, and token-protected note/case endpoints are now the first casework layer. Analyst notes are internal context, not accusations.

## 2026-04-26 - Case timeline view before full case-management product

- Decision: Add a database-backed `analyst_case_timeline` view and `GET /api/analyst-cases/:id` workbench endpoint before building a richer public UI, graph database, or production case-management system.
- Why: Centinela needs case history to be queryable, source-linked, and reusable across SQL, API, console, and future UI layers. A database view keeps the case timeline close to provenance and avoids hiding important review history inside client-side UI state.
- Consequence: `sql/postgres/017_analyst_case_timeline.sql`, `getAnalystCase`, and the console case panel now expose case creation, linked targets, and case-scoped notes as one internal timeline. The next layer should attach source-record-to-note links and field-level explanations into that timeline.

## 2026-04-26 - Evidence links before public explanations

- Decision: Add `analyst_evidence_links` and `POST /api/analyst-cases/:id/evidence-links` before attempting public explanations or a document index.
- Why: Source records need to be carried through casework with field paths, evidence roles, interpretations, and limitations. This gives analysts provenance-backed explanation bundles without turning notes or source records into accusations.
- Consequence: Case timelines now include `evidence_link` events, notes can show linked source-record counts, and future public/product layers can draw from explicit evidence roles and limitations instead of free-text notes alone.

## 2026-04-26 - Field helpers before a document index

- Decision: Add bounded source-record field suggestions and in-case source-record search before building a full document index or document UI.
- Why: Centinela already has useful `source_records.payload` data, but analysts need a faster way to cite exact fields when building evidence links. A small helper over existing JSON payloads gives immediate value without adding search infrastructure too early.
- Consequence: `GET /api/source-records/:id` now returns `fieldSuggestions`, and the console can search source records inside a case, open a record, and click suggested fields into the evidence-link form.

## 2026-04-29 - Public-safety review gates before any outward evidence export

- Decision: Add append-only case public-safety review states and require `approved_public` before `public_only=true` evidence export.
- Why: Centinela now has enough source-linked case evidence to be packaged, but packaging evidence must not accidentally expose analyst notes, internal interpretation, weak candidates, or language that reads like a public finding.
- Consequence: `sql/postgres/019_case_evidence_exports.sql`, `POST /api/analyst-cases/:id/public-review`, and `GET /api/analyst-cases/:id/evidence-export` now separate internal evidence bundles from public-approved exports. `approved_public` requires public-safe summary and limitations, and public-only export strips internal analyst interpretation and internal actor metadata.

## 2026-04-30 - Export artifacts before full document index

- Decision: Add a Markdown/JSON case evidence artifact writer before building a full document index, OCR pipeline, or public case page.
- Why: Analysts already have source-record evidence links and public-safety gates. The next useful step is portable, reviewable case packets in the local runtime folder, not new indexing infrastructure that would be premature without more document sources.
- Consequence: `npm run database:case-evidence-export` now writes source-indexed case evidence artifacts. This advances Aleph-style case packaging while keeping the public-only gate, source provenance, limitations, and non-accusatory language intact.
