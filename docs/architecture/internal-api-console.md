# Internal API and console

## Purpose

Centinela now has a first local-only analyst API and console surface.

It is not a public product yet. It is the bridge from markdown reports to an explorable investigation workspace.

The surface is designed to expose:

- entity search
- entity dossiers as JSON
- one-hop graph-ready relationship neighborhoods
- entity and process review queues
- review-only external candidates
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

Write endpoints are disabled unless `CENTINELA_WRITE_TOKEN` is set. When enabled locally, the token must be supplied as `X-Centinela-Write-Token` or as a Bearer token.

## API endpoints

- `GET /api/overview`
  - live counts, anchor coverage, review-lane distribution, and second-review distribution
- `GET /api/entities?q=<text>&limit=25`
  - entity search across names and identifiers
- `GET /api/entities/:id`
  - dossier JSON with identifiers, source mentions, local profiles, local signals, accepted matches, review candidates, second reviews, representatives, counterparty edges, and linked processes
- `GET /api/entities/:id/network?limit=25`
  - one-hop graph-ready nodes and edges for procurement counterparties, legal representatives, accepted external matches, reviewable external candidates, and linked procurement processes
- `GET /api/entities/:id/network/export?format=node-link|cytoscape|jsonl&limit=25`
  - graph export for relationship analysis tools and future graph UI work
- `GET /api/queue/entities?lane=<lane>&priority=<priority>&limit=25`
  - company-level entity intelligence queue
- `GET /api/queue/processes?lane=<lane>&priority=<priority>&limit=25`
  - process-level procurement review queue
- `GET /api/external-candidates?review_status=<status>&second_review_decision=<decision>&limit=25`
  - review-only candidate and diagnostic layer, including second-review state
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
- `npm run database:case-evidence-export -- --case-id <id> --public-only false`
  - writes Markdown and JSON evidence artifacts to the local runtime folder, including a source-record index
- `npm run database:case-source-manifest -- --case-id <id> --public-only false`
  - writes Markdown and JSON source attachment manifests to the local runtime folder, including source-run asset paths, source URLs, hashes, and local path availability
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
  - Shapes the graph-ready neighborhood response and source-linked entity model.
- OCCRP Aleph
  - Shapes entity search, dossier-first investigation, source drilldowns, and pivotable casework.
- Sayari
  - Shapes professional entity-intelligence ergonomics and one-hop company/person exploration.
- Dozorro / ProZorro
  - Shapes review queues, follow-up lanes, and saved analyst notes.
- QuiénEsQuién / TodosLosContratos
  - Shapes company-contract-accountability views and public-product direction.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - Shape accepted external matches, review-only candidates, identifiers, and ownership/offshore-ready edges.
- Open Contracting / Cardinal / OCDS, GTI, DNCP
  - Shape process and contract review endpoints.
- Integrity Watch, Rosie, RUBLI, FUNES
  - Shape non-accusatory language, human-review boundaries, methodology visibility, cautious surfacing, and internal-note limitations.

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

## Limits

- Write-token protection is local hardening, not production authentication or role-based permissions.
- Saved cases, analyst notes, evidence links, and case timelines exist, but the console casework UI is still an internal workbench rather than a full case-management product.
- Field suggestions are heuristic helpers, not automatic evidence judgments.
- Public-safety review gates reduce accidental disclosure risk, but they are not a substitute for full public-product review, role-based authorization, privacy review, or methodology publication.
- Case evidence artifacts are generated runtime outputs and should stay out of Git.
- Source attachment manifests are generated runtime outputs and should stay out of Git. They point to source-run assets; they do not yet copy source files into a portable bundle.
- The console renders source-derived item text as text content rather than HTML, because source records can contain public-source strings.
- No full-text document index yet.
- Network output is graph-ready JSON, not a graph database.
- Public-facing use requires a separate safety, privacy, methodology, and UX layer.
