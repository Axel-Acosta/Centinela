# Internal API and console

## Purpose

Centinela now has a first local-only analyst API and console surface.

It is not a public product yet. It is the bridge from markdown reports to an explorable investigation workspace, and now the first product-like internal interface for presenting the live intelligence system coherently.

Centinela also now has a separate public-safe web surface documented in `docs/deployment/public-web.md`. That surface is deliberately read-only and sanitized. It is the right surface to expose remotely; the internal Command Center should remain local or protected until production authentication, privacy review, and role-based access exist.

The 2026-05-12 product-surface slice turns the console into a local Command Center rather than a raw workbench. It adds:

- a navigable app shell for overview, entities, dossiers, casework, queues, and methodology
- a live workflow map that separates public records, entities, relationships, candidates, evidence links, and accepted identity context
- a source-pack showcase for the first real Paraguay entity packs
- a product-style entity dossier summary over the existing JSON profile and network endpoints
- a relationship summary over graph-ready one-hop neighborhoods
- a clearer case/source-pack workspace that keeps public-safety gates, artifacts, bundles, and source-document indexes visible
- methodology and precedent synthesis inside the interface, not only in docs

The follow-up product-surface slice adds:

- an SVG relationship graph over the existing one-hop network endpoint
- filterable entity, process, external-candidate, and source-pack readiness panels
- a read-only source-pack readiness API for the Command Center
- an artifact browser for generated evidence artifacts, manifests, source bundles, and source-document indexes
- a bounded artifact-detail reader for local case files and bundle directories

The larger case-packet product slice adds:

- graph filtering and expansion controls over the existing one-hop entity network
- a source-backed case review packet that renders public-safety state, linked targets, evidence links, and timeline events as readable cards instead of JSON-only output
- an artifact/source-document match preview that surfaces bundle/index query matches, source-record IDs, evidence-link IDs, snippets, and use limits before the raw artifact JSON

The methodology/navigation product slice adds:

- a stronger methodology, limits, and publication-safety surface inside the Command Center
- explicit allowed-claim and blocked-claim language
- an evidence ladder and source verification checklist visible in the interface
- source-pack shortcuts that open real case packets from the showcase, dossier, and case workspace

The verification/smoke product slice adds:

- artifact-detail verification checks for path containment, bundle index, source manifest, source-document index, copied assets, hashes, source URL coverage, and publication gate state
- a visible artifact/source verification panel in the Command Center
- `npm run smoke:command-center`, a repeatable live smoke harness for the main Command Center navigation paths

The impeccable-guidance product slice adds:

- `.impeccable.md`, a Centinela-local product quality contract for serious, source-first, non-accusatory interface work
- the project-local `impeccable` skill installation under `.agents/skills/impeccable`, pinned by `skills-lock.json`
- root `PRODUCT.md` and `DESIGN.md` files so the skill loads Centinela-specific product and visual context before future interface work
- a guided proof path in the Command Center that starts with a live entity dossier, opens the source-backed case packet, loads generated artifacts, and surfaces verification/methodology limits
- a first skill-guided polish pass that moves the Command Center toward OKLCH design tokens, removes decorative glass blur and side-stripe card accents, improves keyboard focus/hover states, and keeps the surface product-like rather than ornamental
- smoke-test coverage for the guided proof-path surface so future interface work cannot accidentally hide the primary demonstration trail
- smoke-test coverage for core impeccable guardrails: OKLCH token presence, no thick side-stripe accents, no gradient text, and no decorative glass blur

The surface is designed to expose:

- entity search
- entity dossiers as JSON
- one-hop graph-ready relationship neighborhoods
- filtered visual graph neighborhoods with relation/type controls
- entity and process review queues
- review-only external candidates
- redacted staged Abogacia relationship leads
- accepted external enrichment matches
- second-review rationale and limitations
- source-record drilldowns
- graph exports
- internal analyst notes and cases
- internal case timeline workbench
- source-record evidence bundles with field-level explanation and limitation context
- in-case source-record search and field-path helpers for evidence links
- case evidence exports with public-safety review gates
- local case source attachment manifests with source-run asset paths, hashes, and availability checks
- local case source bundles that copy resolvable source-run assets beside evidence and manifest files
- local source-document indexes that search bundled text-like source files and trace matches back to evidence/source records
- entity source-pack generation from the case workbench, including preview mode and write mode
- a presentable local command-center interface over those workflows
- visual entity relationship exploration
- local artifact/detail browsing without moving generated files into Git or OneDrive
- case review packets that make source-backed evidence, limits, and public-safety status understandable without opening raw JSON
- source-document match previews that trace local snippets back to source records and evidence links
- methodology and publication-safety guidance in the visible product surface
- source-pack case shortcuts from entity dossiers and showcase cards
- source/artifact verification checks before analysts rely on local files
- a guided proof path for `CONSULTORA GUARANI SA INGENIEROS CIVILES`, case `20`, and the current source-bundle verification trail
- project-local `impeccable` context for future product-surface work

All outputs remain leads, identity context, or risk signals for review. They are not proof of wrongdoing.

## Command

```bash
npm run serve:internal-console -- --host 127.0.0.1 --port 8787
```

Open:

```text
http://127.0.0.1:8787/
```

The console is local-only by default. Binding to anything other than `127.0.0.1` or `localhost` requires setting:

```bash
CENTINELA_ALLOW_REMOTE_CONSOLE=true
```

Do not expose this first internal console publicly. It has no production authentication layer yet.

For public access, use:

```bash
npm run serve:public-web -- --host 0.0.0.0 --port 8788
```

The public web service exposes only `/`, `/healthz`, and `/api/public/*`.

Write endpoints are disabled unless `CENTINELA_WRITE_TOKEN` is set. When enabled locally, the token must be supplied as `X-Centinela-Write-Token` or as a Bearer token.

## API endpoints

- `GET /api/overview`
  - live counts, anchor coverage, review-lane distribution, and second-review distribution
- `GET /api/entity-source-pack-readiness?limit=25&source_record_limit=10`
  - read-only ranking of next entity source-pack actions; does not write report files or mutate cases
- `GET /api/entities?q=<text>&limit=25`
  - entity search across names and identifiers
- `GET /api/entities/:id`
  - dossier JSON with identifiers, source mentions, local profiles, local signals, accepted matches, review candidates, second reviews, representatives, counterparty edges, and linked processes
- `GET /api/entities/:id/network?limit=25`
  - one-hop graph-ready nodes and edges for procurement counterparties, legal representatives, accepted external matches, reviewable external candidates, and linked procurement processes
- `GET /api/entities/:id/network/export?format=node-link|cytoscape|jsonl&limit=25`
  - graph export for relationship analysis tools and future graph UI work
- `POST /api/entities/:id/source-packs`
  - creates or previews an entity source pack from entity-linked source records; requires local write token and writes/reuses a case, evidence links, source bundle, and source-document index unless `dryRun=true`
- `GET /api/queue/entities?lane=<lane>&priority=<priority>&limit=25`
  - company-level entity intelligence queue
- `GET /api/queue/processes?lane=<lane>&priority=<priority>&limit=25`
  - process-level procurement review queue
- `GET /api/external-candidates?review_status=<status>&second_review_decision=<decision>&limit=25`
  - review-only candidate and diagnostic layer, including second-review state
- `GET /api/staged-relationships?review_status=<status>&promotion_status=<status>&limit=25`
  - redacted Abogacia relationship review queue with source-record IDs, source-line numbers, priority, lead question, and recommended action
- `POST /api/staged-relationships/:id/reviews`
  - records staged-relationship review decisions; requires local write token. Accepted decisions are `needs_more_evidence`, `keep_staged`, `rejected`, and `promote_to_redacted_relationship`. Promotion creates only redacted internal graph context.
- `GET /api/accepted-matches?limit=25`
  - accepted second-review enrichment matches
- `GET /api/source-records?source_key=<key>&external_id=<id>&q=<text>&limit=25`
  - source-record search and drilldown index
- `GET /api/source-records/:id`
  - full source-record payload, source-run context, and bounded field suggestions for evidence-link creation
- `GET /api/analyst-cases?status=open&limit=25`
  - saved internal cases
- `GET /api/analyst-cases/:id?limit=20`
  - saved case detail with linked targets, notes, evidence links, public-review history, and chronological timeline events
- `GET /api/analyst-cases/:id/evidence-export?public_only=true&limit=25`
  - source-backed case evidence export; `public_only=true` is blocked unless the latest public-safety status is `approved_public`
- `GET /api/analyst-cases/:id/artifacts?limit=25`
  - reads the local runtime artifact registry for a case by scanning `CENTINELA_OUTPUT_DIR/reports/cases/<case-key>/`; returns evidence artifact, source manifest, source bundle, and source-document index summaries without loading raw evidence text into the console response
- `GET /api/analyst-cases/:id/artifact-detail?path=<artifact-path>&max_text_chars=16000`
  - reads a bounded local artifact preview for a selected case artifact file or source-bundle directory, only when the path is inside that case artifact folder
- `POST /api/analyst-cases/:id/evidence-artifacts`
  - writes local Markdown/JSON evidence artifacts through the API; requires local write token and reuses the `approved_public` gate when `publicOnly=true`
- `POST /api/analyst-cases/:id/source-manifests`
  - writes local Markdown/JSON source attachment manifests through the API; requires local write token and reuses the `approved_public` gate when `publicOnly=true`
- `POST /api/analyst-cases/:id/source-bundles`
  - writes a local source bundle through the API, optionally copies source-run assets, and can immediately refresh a query-aware source-document index; requires local write token and reuses the `approved_public` gate when `publicOnly=true`
- `POST /api/source-document-indexes`
  - refreshes a source-document index for an existing local source bundle; requires local write token and returns document/query match counts plus output paths
- `npm run database:case-evidence-export -- --case-id <id> --public-only false`
  - writes Markdown and JSON evidence artifacts to the local runtime folder, including a source-record index
- `npm run database:case-source-manifest -- --case-id <id> --public-only false`
  - writes Markdown and JSON source attachment manifests to the local runtime folder, including source-run asset paths, source URLs, hashes, and local path availability
- `npm run database:case-source-bundle -- --case-id <id> --public-only false --copy-assets true`
  - writes a local review bundle with evidence files, source manifest files, `bundle-index.json`, `README.md`, and copied source-run assets when local paths resolve
- `npm run database:case-source-index -- --bundle-path <bundle-path> --query "search terms"`
  - refreshes a local source-document index for an existing source bundle and records query matches, source-record IDs, evidence-link IDs, snippets, and asset metadata
- `npm run database:entity-source-pack -- --entity-name "Entity Name" --source-record-limit 10 --source-index-query "search terms"`
  - creates the same entity source-pack case/evidence/bundle/index packet from the CLI
- `POST /api/analyst-cases`
  - create a case; requires local write token
- `POST /api/analyst-cases/:id/links`
  - link a case to an entity, process, candidate, source record, accepted match, or second review; requires local write token
- `POST /api/analyst-cases/:id/evidence-links`
  - link a source record to a case, optional note, target, field path/value, explanation, limitations, and evidence role; requires local write token
- `POST /api/analyst-cases/:id/public-review`
  - append a public-safety review state; `approved_public` requires public-safe summary and limitations
- `GET /api/analyst-notes?target_type=entity&target_id=3940`
  - saved notes for a target
- `POST /api/analyst-notes`
  - save an internal note; requires local write token

## Reference synthesis

- br/acc
  - Shapes the graph-ready neighborhood response, source-linked entity model, and connected exploration feel.
- OCCRP Aleph
  - Shapes entity search, dossier-first investigation, source drilldowns, pivotable casework, and the case/source-pack workspace.
- Sayari
  - Shapes professional entity-intelligence ergonomics, company/person exploration, and the product-like dossier summary.
- Dozorro / ProZorro
  - Shapes review queues, follow-up lanes, and saved analyst notes.
- QuiénEsQuién / TodosLosContratos
  - Shapes company-contract-accountability views, source-pack showcase, and public-product direction.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - Shape accepted external matches, review-only candidates, identifiers, and ownership/offshore-ready edges.
- Open Contracting / Cardinal / OCDS, GTI, DNCP
  - Shape process and contract review endpoints.
- Integrity Watch, Rosie, RUBLI, FUNES
  - Shape non-accusatory language, human-review boundaries, methodology visibility, cautious surfacing, limitations, and public-safety gates.

## Product-surface direction

The local console should now be treated as Centinela's first internal product surface. Future interface work should improve this surface before introducing a separate public website unless a separate stack becomes clearly higher leverage.

Near-term interface work should prioritize:

- only targeted interface fixes that unblock real analysis
- later visual expansion for larger graph neighborhoods beyond the current one-hop API
- return to Paraguay source expansion and person-relationship staging

Future product-surface changes should follow `.impeccable.md`: dossier before dashboard, evidence trail over spectacle, review-first language everywhere, progressive disclosure, no fake proof, and visible source limitations.

## Current smoke-test result

On 2026-04-26, the first live smoke test against the VPS-backed database returned:

- `8,716` entities
- `13,529` procurement processes
- `1` accepted second review
- `CONSULTORA GUARANI SA INGENIEROS CIVILES` as the top search result for `CONSULTORA GUARANI`
- `1` accepted match in that entity profile
- `11` graph nodes and `10` graph edges in the entity network sample

On the later analyst-workspace hardening smoke test, the API also returned:

- `8,376` source records
- `0` analyst cases and `0` analyst notes before any real saved casework
- a Cytoscape export with `19` elements for entity `3940`
- source-record drilldown for IDB source record `10117`, external ID `idb-sanctions-row-76193`
- dry-run note/case writes with a temporary local token
- wrong-token rejection with `401`

On the case-timeline smoke test, the API also confirmed:

- `sql/postgres/017_analyst_case_timeline.sql` applied to the live VPS-backed database
- one temporary case plus one entity link and one note returned `3` timeline events: `note`, `case_link`, and `case_created`
- the temporary case was deleted after the smoke test and live analyst case/note counts returned to `0`

On the evidence-link smoke test, the API also confirmed:

- `sql/postgres/018_analyst_evidence_links.sql` applied to the live VPS-backed database
- one temporary source-record evidence bundle linked source record `10117` to entity `3940`, a case, and a note with evidence role `supports_identity_context`
- the case detail returned `1` evidence link and `4` timeline events: `evidence_link`, `note`, `case_link`, and `case_created`
- cleanup returned analyst case, note, and evidence-link counts to `0`

On the field-helper smoke test, the API/console path also confirmed:

- source-record search for `Consultora Guarani` returned `4` records
- `GET /api/source-records/10117` returned `18` field suggestions
- the top suggestion was `payload.centinelaExternalCandidateName`, with role hint `supports_identity_context`
- a temporary evidence link used that suggested field successfully, then cleanup returned case, note, and evidence-link counts to `0`

On the evidence-export/public-safety smoke test, the API/console path also confirmed:

- `sql/postgres/019_case_evidence_exports.sql` applied to the live VPS-backed database
- one temporary source-record evidence bundle used source record `10117`
- `public_only=true` export was blocked before `approved_public`
- internal evidence export returned `1` evidence row
- approved public export returned `1` public row and did not expose `internal_analyst_interpretation`
- cleanup returned analyst cases, notes, evidence links, and public reviews to `0`

On the case export artifact smoke test, the CLI path also confirmed:

- a temporary case and evidence link using source record `10117` could not write a public artifact before `approved_public`
- after public-safety approval, Markdown and JSON artifacts were written under the local runtime folder
- the JSON artifact included a one-row `sourceIndex`
- public-only artifacts did not expose `internal_analyst_interpretation`
- cleanup returned smoke cases and artifacts to `0`

On the source attachment manifest smoke test, the CLI path also confirmed:

- a temporary case and evidence link using source record `10117` could not write a public manifest before `approved_public`
- after public-safety approval, Markdown and JSON manifests were written under the local runtime folder
- the manifest included `1` linked source record and `2` source-run assets
- public-only manifests did not expose `internal_analyst_interpretation`
- cleanup returned smoke cases and artifacts to `0`

On the source bundle smoke test, the CLI path also confirmed:

- a temporary case and evidence link using source record `10117` could not write a public bundle before `approved_public`
- after public-safety approval, the bundle wrote `bundle-index.json`, `README.md`, evidence JSON/Markdown, source manifest JSON/Markdown, and `attachments/`
- the bundle copied `2` of `2` source-run assets by resolving old repo `data/` paths into the current runtime folder
- public-only bundle metadata did not expose `internal_analyst_interpretation`
- cleanup returned smoke cases and artifacts to `0`

On the source-document index smoke test, the CLI path also confirmed:

- a temporary case and evidence link using source record `10117` could not write a public bundle/index before `approved_public`
- after public-safety approval, the source bundle copied `2` source assets and wrote automatic source-document index files
- refreshing the index with query `Consultora Guarani` returned `2` searchable documents and `2` query matches
- matched documents preserved source-record and evidence-link traceability
- public-only index files did not expose `internal_analyst_interpretation`
- cleanup returned smoke cases and artifacts to `0`

On the case artifact API/console smoke test, the local API path also confirmed:

- a temporary case and evidence link using source record `10117` could not write a public source bundle before `approved_public`
- after public-safety approval, `POST /api/analyst-cases/:id/evidence-artifacts`, `/source-manifests`, and `/source-bundles` wrote public-approved local artifacts
- the bundle copied `2` source assets, the immediate bundle query index returned `2` matches, and `POST /api/source-document-indexes` refreshed the same bundle with `2` query matches
- `/console` included the new artifact/source-bundle/source-index controls
- cleanup removed the temporary case and smoke artifacts

On the case artifact registry smoke test, the local API path also confirmed:

- a temporary case generated one public-approved evidence artifact, one source manifest, and one source bundle
- `GET /api/analyst-cases/:id/artifacts` returned `3` artifacts with evidence artifact, source manifest, and source bundle kinds
- the registry returned the latest bundle path, `2` indexed documents, and `2` query matches from the bundle's source-document index
- `/console` included the generated-artifact loading control
- cleanup removed the temporary case and smoke artifacts

On the entity source-pack API/console smoke test, the local API path also confirmed:

- `POST /api/entities/3940/source-packs` returned a dry-run source pack for `CONSULTORA GUARANI SA INGENIEROS CIVILES`
- the dry-run selected `3` entity-linked source records and did not create a case
- `/console` included the entity source-pack preview/write controls and the source-pack API route

On the Command Center graph/artifact/readiness smoke test, the local API path also confirmed:

- the Command Center page returned `200` and included graph, artifact browser, and source-pack readiness surfaces
- `GET /api/entities/3940/network?limit=8` returned graph edges
- `GET /api/entity-source-pack-readiness?limit=3&source_record_limit=10` returned readiness items
- `GET /api/queue/processes?limit=3` returned process queue rows
- `GET /api/analyst-cases/20/artifacts?limit=5` returned a source bundle path
- `GET /api/analyst-cases/20/artifact-detail?path=<latestBundlePath>` returned `200`

On the case packet / source-index preview smoke test, the local API path also confirmed:

- the Command Center page returned `200` and included `graph-relation-filter`, `case-review-packet`, and `artifact-detail-preview`
- `GET /api/entities/3940/network?limit=24` returned `11` nodes and `10` edges
- `GET /api/analyst-cases/20?limit=50` returned `10` evidence links and `22` timeline events
- `GET /api/analyst-cases/20/artifacts?limit=5` returned `3` artifacts
- `GET /api/analyst-cases/20/artifact-detail?path=<latestBundlePath>` returned an artifact directory with a bundle index, a source-document index, `8` indexed documents, and `5` query matches for `Consultora Guarani`
- the rendered inline script parsed successfully from the served Command Center HTML

On the methodology/navigation smoke test, the local API path also confirmed:

- the Command Center page returned `200` and included `Methodology, Limits, and Publication Safety`, `Allowed claims`, `Source verification checklist`, `Open case packet`, and the `open-entity-source-pack-case` control
- the served inline script parsed successfully
- entity search for `MENDEZ GONZALEZ FLORIANA` returned entity `5319`, confirming the source-pack shortcut target
- `GET /api/analyst-cases/19?limit=20` returned `8` evidence links and `18` timeline events
- `GET /api/analyst-cases/20/artifacts?limit=5` still returned `3` artifacts

On the verification/smoke-harness test, the local API path also confirmed:

- `npm run smoke:command-center` starts the local console on a non-default port and closes it after checks
- the Command Center HTML includes the artifact verification panel hook
- overview returned `8,716` entities and `10,757` source records after Abogacia source expansion
- entity search, dossier, network, case packet, artifact registry, artifact-detail, and source-pack readiness endpoints all returned expected live data
- case `20` source-bundle artifact detail returned `8` verification checks, including path containment, hash verification, and publication gate checks

On the impeccable-guided proof-path test, the local browser path also confirmed:

- the Command Center page includes `Start with a Real Evidence Trail` and the `guided-proof-path` controls
- `Open case packet` loads case `20` with review packet, source-backed evidence, and public-safety gate sections
- `Open evidence trail` loads the latest case `20` source bundle detail with artifact/source verification, source-document matches, hash verification, and publication-gate checks
- the path remains internal review context and does not convert source evidence into public findings

## Limits

- Write-token protection is local hardening, not production authentication or role-based permissions.
- Saved cases, analyst notes, evidence links, and case timelines exist, but the console casework UI is still an internal workbench rather than a full case-management product.
- The command-center shell is presentable for local/internal review, but it is still not a production public UI.
- The installed `impeccable` skill is project-local. If Codex does not show it in a fresh session, restart Codex or open a new session so `.agents/skills/impeccable` is picked up by the harness.
- The case review packet is a readable internal surface over existing case data; it does not replace raw JSON, source verification, or analyst judgment.
- The methodology and limits section is product guidance for internal review; it is not a complete public methodology page yet.
- Artifact verification checks improve local review safety, but they do not convert generated bundles into public-ready packages.
- Field suggestions are heuristic helpers, not automatic evidence judgments.
- Public-safety review gates reduce accidental disclosure risk, but they are not a substitute for full public-product review, role-based authorization, privacy review, or methodology publication.
- Case evidence artifacts are generated runtime outputs and should stay out of Git.
- Source attachment manifests are generated runtime outputs and should stay out of Git. They point to source-run assets; they do not yet copy source files into a portable bundle.
- Source bundles are generated runtime outputs and should stay out of Git. They copy raw source artifacts for local review only; public reuse still requires source, privacy, methodology, and UX review.
- Source-document indexes are generated runtime outputs and should stay out of Git. They are local navigation aids, not a substitute for source verification or full public-product review.
- Artifact and bundle POST endpoints generate local files, so they require the local write token even though they do not mutate PostgreSQL case evidence.
- The artifact registry is a lightweight runtime-folder reader, not a durable database audit table. It summarizes local files that currently exist under `CENTINELA_OUTPUT_DIR`.
- Entity source-pack generation writes local runtime artifacts and may create/reuse cases, links, and evidence links; use preview mode first when unsure.
- The console renders source-derived item text as text content rather than HTML, because source records can contain public-source strings.
- No full-text document index yet.
- Network output is graph-ready JSON, not a graph database.
- Graph filters hide/show visible review pivots; they do not change underlying evidence, relationship meaning, or confidence.
- Public-facing use requires a separate safety, privacy, methodology, and UX layer.
