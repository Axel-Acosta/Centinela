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

Do not expose this first internal console publicly. It has no authentication layer yet.

## API endpoints

- `GET /api/overview`
  - live counts, anchor coverage, review-lane distribution, and second-review distribution
- `GET /api/entities?q=<text>&limit=25`
  - entity search across names and identifiers
- `GET /api/entities/:id`
  - dossier JSON with identifiers, source mentions, local profiles, local signals, accepted matches, review candidates, second reviews, representatives, counterparty edges, and linked processes
- `GET /api/entities/:id/network?limit=25`
  - one-hop graph-ready nodes and edges for procurement counterparties, legal representatives, accepted external matches, reviewable external candidates, and linked procurement processes
- `GET /api/queue/entities?lane=<lane>&priority=<priority>&limit=25`
  - company-level entity intelligence queue
- `GET /api/queue/processes?lane=<lane>&priority=<priority>&limit=25`
  - process-level procurement review queue
- `GET /api/external-candidates?review_status=<status>&second_review_decision=<decision>&limit=25`
  - review-only candidate and diagnostic layer, including second-review state
- `GET /api/accepted-matches?limit=25`
  - accepted second-review enrichment matches

## Reference synthesis

- br/acc
  - Shapes the graph-ready neighborhood response and source-linked entity model.
- OCCRP Aleph
  - Shapes entity search, dossier-first investigation, and pivotable casework.
- Sayari
  - Shapes professional entity-intelligence ergonomics and one-hop company/person exploration.
- Dozorro / ProZorro
  - Shapes review queues and follow-up lanes.
- QuiénEsQuién / TodosLosContratos
  - Shapes company-contract-accountability views and public-product direction.
- OpenSanctions / OpenOwnership / OpenCorporates / ICIJ
  - Shape accepted external matches, review-only candidates, identifiers, and ownership/offshore-ready edges.
- Open Contracting / Cardinal / OCDS, GTI, DNCP
  - Shape process and contract review endpoints.
- Integrity Watch, Rosie, RUBLI, FUNES
  - Shape non-accusatory language, human-review boundaries, methodology visibility, and cautious surfacing.

## Current smoke-test result

On 2026-04-26, the first live smoke test against the VPS-backed database returned:

- `8,716` entities
- `13,529` procurement processes
- `1` accepted second review
- `CONSULTORA GUARANI SA INGENIEROS CIVILES` as the top search result for `CONSULTORA GUARANI`
- `1` accepted match in that entity profile
- `11` graph nodes and `10` graph edges in the entity network sample

## Limits

- No authentication or role-based permissions yet.
- No saved cases or analyst notes through the API yet.
- No full-text document index yet.
- Network output is graph-ready JSON, not a graph database.
- Public-facing use requires a separate safety, privacy, methodology, and UX layer.
