# Analyst workspace methodology

## Purpose

The analyst workspace turns Centinela's read-only internal console into a conservative casework surface.

It lets analysts preserve notes, case context, source-record drilldowns, and graph exports without changing the meaning of automated outputs.

Everything remains internal, reviewable, and non-accusatory.

As of the 2026-05-12 product-surface slice, the workspace also has a presentable local Command Center shell. The shell does not change evidence semantics; it makes the existing review-first workflow easier to understand through overview, entity search, dossier summary, relationship summary, source-pack showcase, case/source-pack workspace, queue panels, and methodology/limitations sections.

The follow-up Command Center slice adds visual graph exploration, filterable queues, source-pack readiness browsing, and bounded local artifact-detail previews. These features are navigation and review aids only; they do not promote leads into findings.

The case-packet Command Center slice adds graph relation/type filters, a larger network limit control, readable case review packets, and source-document match previews. These features make evidence easier to inspect, but they still sit on top of the same review-first case, source-record, artifact, and public-safety model.

The methodology/navigation Command Center slice adds allowed/blocked claim rules, an evidence ladder, source verification checklist, publication-safety guidance, and source-pack shortcuts from showcase/dossier/case workspace into real case packets. These features reduce analyst friction and make the cautious operating model visible.

## Live database objects

- `centinela.analyst_cases`
  - stores internal investigation containers with title, status, priority, summary, creator, timestamps, and metadata
- `centinela.analyst_case_links`
  - links cases to entities, processes, external candidates, accepted matches, source records, second reviews, notes, or other targets
- `centinela.analyst_notes`
  - stores internal notes on a target with note type, analyst, visibility, provenance, and timestamps
- `centinela.analyst_evidence_links`
  - links a case, optional note, source record, target, field path, field value/excerpt, explanation, limitations, and evidence role into one reviewable evidence bundle
- `centinela.analyst_case_public_reviews`
  - stores append-only public-safety review states for case evidence export decisions
- `centinela.analyst_case_overview`
  - summarizes cases with linked-target, note, evidence-link, and latest public-review state
- `centinela.analyst_note_overview`
  - exposes notes with optional case context
- `centinela.analyst_case_evidence_overview`
  - exposes source-record evidence bundles with case, note, source, target, field, explanation, and limitation context
- `centinela.analyst_case_evidence_export`
  - packages source-backed case evidence without raw note text and labels whether the latest public-safety state allows public-only export
- `centinela.analyst_case_public_review_overview`
  - exposes the latest public-safety review state per case
- `centinela.analyst_case_timeline`
  - unifies case creation, case links, case-scoped notes, evidence links, and public-safety reviews into one internal chronological review surface

## API behavior

Read endpoints:

- `GET /api/source-records`
- `GET /api/source-records/:id`
  - includes bounded `fieldSuggestions` that point to useful scalar JSON fields, likely evidence role, and why the field may matter
- `GET /api/analyst-cases`
- `GET /api/analyst-cases/:id`
  - the Command Center now renders this as a source-backed review packet with public-safety state, linked targets, evidence links, and timeline cards
- `GET /api/analyst-cases/:id/evidence-export`
  - with `public_only=true`, requires latest public-safety status `approved_public`
- `GET /api/analyst-cases/:id/artifacts`
  - summarizes generated local evidence artifacts, source manifests, source bundles, and source-document indexes for the case
- `GET /api/analyst-cases/:id/artifact-detail`
  - reads a bounded local preview for a selected artifact file or bundle directory, only when the selected path is inside the case artifact folder
  - the Command Center now summarizes source-document index query matches, source-record IDs, evidence-link IDs, snippets, and use limits before raw JSON
- `GET /api/entity-source-pack-readiness`
  - ranks next source-pack actions for the Command Center without writing report files or mutating casework
- `GET /api/analyst-notes`
- `GET /api/entities/:id/network/export?format=cytoscape`

Artifact command:

- `npm run database:case-evidence-export -- --case-id <id> --public-only false`
  - writes Markdown and JSON evidence artifacts under the local non-sync runtime folder
  - includes a source-record index for linked evidence rows
  - with `--public-only true`, requires the latest public-safety review status `approved_public`
- `npm run database:case-source-manifest -- --case-id <id> --public-only false`
  - writes Markdown and JSON source attachment manifests under the local non-sync runtime folder
  - lists linked source records, source-run metadata, source-run assets, source URLs, SHA-256 hashes, local path availability, and payload previews
  - with `--public-only true`, reuses the same `approved_public` gate and strips internal analyst interpretation through the evidence-export path
- `npm run database:case-source-bundle -- --case-id <id> --public-only false --copy-assets true`
  - writes a local case bundle folder with `bundle-index.json`, `README.md`, evidence JSON/Markdown, source manifest JSON/Markdown, and copied source-run assets when local paths resolve
  - resolves legacy absolute repo `data/` paths into the current local runtime folder when possible
  - with `--public-only true`, reuses the same `approved_public` gate, but copied raw source files still need review before any public reuse
- `npm run database:case-source-index -- --bundle-path <bundle-path> --query "search terms"`
  - refreshes `source-document-index.json`, `source-document-index.md`, and `source-document-index.jsonl` for an existing source bundle
  - extracts bounded text from copied text-like files and links documents back to source records, evidence links, source assets, URLs, hashes, and query snippets
  - supports local analyst search only; it is not a full document search engine or public document product

Write endpoints:

- `POST /api/analyst-cases`
- `POST /api/analyst-cases/:id/links`
- `POST /api/analyst-cases/:id/evidence-links`
- `POST /api/analyst-cases/:id/public-review`
- `POST /api/analyst-cases/:id/evidence-artifacts`
- `POST /api/analyst-cases/:id/source-manifests`
- `POST /api/analyst-cases/:id/source-bundles`
- `POST /api/source-document-indexes`
- `POST /api/analyst-notes`

Write endpoints require `CENTINELA_WRITE_TOKEN` and either:

- `X-Centinela-Write-Token: <token>`
- `Authorization: Bearer <token>`

If `CENTINELA_WRITE_TOKEN` is not set, write endpoints are disabled.

The artifact and bundle POST endpoints write local runtime files rather than database evidence. They still require the write token because they create review artifacts on disk and can include internal-only material unless `publicOnly=true` is explicitly gated by `approved_public`.

## Safety rules

- Notes are internal analyst context, not findings of guilt.
- The Command Center is an internal review interface, not a public publication surface.
- Public-facing use requires later review, redaction, and methodology treatment.
- Graph exports are relationship leads for review, not proof of ownership, control, misconduct, or liability.
- Source-record drilldowns show raw/source-backed evidence, but interpretation still belongs in review notes or methodology.
- Evidence links are explanation bundles for review. They can support identity context, review leads, limitations, contradictions, or follow-up, but they are not legal findings.
- Field suggestions are convenience helpers. Analysts still decide whether a field is relevant and must preserve limitations when using it in evidence.
- Public-safety review states are gates, not publication themselves. `approved_public` allows a public-only export format, but it does not mean the material is ready for a live public product without methodology, privacy, and UX review.
- `approved_public` requires both a public-safe summary and public-safe limitations.
- Public-only evidence export strips internal analyst interpretation and internal actor metadata. It keeps source references, field paths, evidence summaries, limitations, and explicit non-accusatory language.
- Case evidence artifacts are runtime outputs, not committed source files. They belong under `CENTINELA_OUTPUT_DIR`, which defaults to `C:\Users\Axeld\AppData\Local\Centinela\data` on this machine.
- Source attachment manifests are attachment checklists, not findings. `exists` means a local file path was present when the manifest was generated; verify paths again before evidence packaging or publication.
- Source bundles are local review packets. Even in public-approved mode, copied raw source files are not automatically public-ready; they still need source, privacy, methodology, and UX review.
- Source-document indexes are local navigation aids. Snippets and searchable text must be checked against the original source file before any public reuse.
- Console/API artifact controls make bundle generation easier, but they do not change the review meaning: a generated artifact is a review packet, not a finding.
- The artifact registry is a convenience reader over local runtime files. If a file is deleted, moved, or generated under a different `CENTINELA_OUTPUT_DIR`, it will not appear.
- Artifact-detail previews are bounded local navigation aids. They should not be treated as publication-ready document excerpts.
- Graph visualization shows review pivots, not ownership, control, misconduct, or liability.
- Graph filters and case-packet cards are display aids. They do not change evidence meaning, confidence, public-review state, or source limitations.
- Methodology cards and shortcuts are internal product guidance. They are not a substitute for a full public methodology page, privacy review, source licensing review, or production authentication.
- Write-token authentication is a local hardening step, not a full production auth system.

## Current smoke-test result

On 2026-04-26, the first live analyst-workspace smoke test confirmed:

- migration `sql/postgres/016_analyst_workspace.sql` applied to the VPS-backed database
- migration `sql/postgres/017_analyst_case_timeline.sql` applied to the VPS-backed database
- migration `sql/postgres/018_analyst_evidence_links.sql` applied to the VPS-backed database
- overview endpoint returned `8,376` source records, `0` analyst cases, and `0` analyst notes
- Cytoscape graph export returned `19` elements for entity `3940`
- source-record search found the IDB row-level source record for candidate `59` as source record `10117`, external ID `idb-sanctions-row-76193`
- dry-run note and case writes worked with a temporary local write token
- wrong write tokens were rejected with `401`
- no smoke notes or cases were persisted
- a later case-timeline smoke created one temporary case, linked entity `3940`, saved one temporary note, returned `3` timeline events (`note`, `case_link`, `case_created`), then deleted the smoke case and returned analyst cases/notes to `0`
- the evidence-link smoke created one temporary case, one entity link, one note, and one source-record evidence link to source record `10117`; case detail returned `1` evidence link, the note reported `1` linked source record, the timeline returned `4` events (`evidence_link`, `note`, `case_link`, `case_created`), then cleanup returned analyst cases, notes, and evidence links to `0`
- the field-helper smoke searched source records for `Consultora Guarani`, found `4` records, returned `18` field suggestions for source record `10117`, ranked `payload.centinelaExternalCandidateName` first, created one temporary evidence link from that suggested field, then cleanup returned analyst cases, notes, and evidence links to `0`
- migration `sql/postgres/019_case_evidence_exports.sql` applied to the VPS-backed database
- the public-safety gate smoke created one temporary case and one source-record evidence link to source record `10117`; public-only export was blocked before approval, internal export returned `1` evidence row, approved public export returned `1` evidence row without `internal_analyst_interpretation`, and cleanup returned analyst cases, notes, evidence links, and public reviews to `0`
- the case evidence artifact smoke created one temporary case and source-record evidence link to source record `10117`; artifact export was blocked before approval, approved public export wrote Markdown and JSON runtime artifacts, the source index contained `1` source record, no internal analyst interpretation leaked, and cleanup returned smoke cases/artifacts to `0`
- the source attachment manifest smoke created one temporary case and source-record evidence link to source record `10117`; manifest creation was blocked before approval, approved public manifest wrote Markdown and JSON runtime artifacts, the manifest contained `1` linked source record and `2` source-run assets, no internal analyst interpretation leaked, and cleanup returned smoke cases/artifacts to `0`
- the source bundle smoke created one temporary case and source-record evidence link to source record `10117`; bundle creation was blocked before approval, approved public bundle wrote `bundle-index.json`, `README.md`, evidence JSON/Markdown, source manifest JSON/Markdown, copied `2` of `2` source-run assets, did not leak internal analyst interpretation, and cleanup returned smoke cases/artifacts to `0`
- the source-document index smoke created one temporary case and source-record evidence link to source record `10117`; public bundle/index creation was blocked before approval, approved public bundle copied `2` source assets, automatic index files were written, a refreshed query for `Consultora Guarani` returned `2` searchable documents and `2` query matches, matched documents preserved source-record and evidence-link traceability, no internal analyst interpretation leaked, and cleanup returned smoke cases/artifacts to `0`
- the case artifact API/console smoke created one temporary case and source-record evidence link to source record `10117`; public bundle creation was blocked before approval, approved public POST artifact routes wrote evidence artifacts, source manifests, and a source bundle, the bundle copied `2` source assets, both immediate and refreshed source-index queries returned `2` matches, `/console` exposed the artifact controls, and cleanup removed the temporary case/artifacts
- the artifact registry smoke created one temporary case and source-record evidence link to source record `10117`; `GET /api/analyst-cases/:id/artifacts` returned `3` artifact summaries, including evidence artifact, source manifest, and source bundle, preserved the latest bundle path, and showed `2` indexed documents plus `2` query matches; cleanup removed the temporary case/artifacts
- the case-packet/source-index preview smoke confirmed the Command Center page exposes graph controls, a case review packet, and an artifact preview; case `20` returned `10` evidence links and `22` timeline events, the latest source bundle returned `8` indexed documents and `5` query matches for `Consultora Guarani`, and the served inline script parsed successfully
- the methodology/navigation smoke confirmed the Command Center page exposes the methodology/safety surface, source verification checklist, source-pack case controls, and valid shortcut target for Mendez entity `5319`; case `19` returned `8` evidence links and `18` timeline events

## Next hardening step

Add safer local file/source verification affordances where they reduce analyst friction, then return to broad cross-domain Paraguay source expansion unless the interface blocks actual analysis.
