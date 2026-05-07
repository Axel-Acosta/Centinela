# DNCP release source-check methodology

## Purpose

The DNCP release source-check connector turns already-loaded procurement/entity links into official source-record evidence.

It fetches the official DNCP OCDS release package URL stored on linked procurement processes, extracts the target entity's party record and all document metadata found inside the release, and persists both release packages and document metadata as `source_records`.

This is source navigation and case evidence support. It is not proof of wrongdoing, identity guilt, or an automated risk conclusion.

## Command

```bash
npm run enrichment:dncp-release-source-check -- --entity-name "Entity Name" --limit 5
```

Alternative:

```bash
npm run enrichment:dncp-release-source-check -- --entity-id 3940 --limit 5
```

Use `--dry-run true` to fetch and write local artifacts without persisting source records.

## What It Stores

- `source_runs` with source key `py-dncp-release-source-check`.
- `source_assets` for the local raw JSON artifact and Markdown report.
- `source_records` with `record_kind = ocds_release_package` for each fetched official release package.
- `source_records` with `record_kind = ocds_document_metadata` for each document metadata entry extracted from the release package.

The payload keeps:

- local target entity ID, name, and type
- related process ID, OCID, tender ID, buyer, party name, and party external ID
- official release summary and matching party observations
- document title, URL, type/detail, field path, and release context
- explicit limitations

## Matching Logic

The connector does not perform new entity resolution. It starts from an existing local entity and its existing `process_parties` links.

Inside each official release, a party is considered target-related when:

- the official party name or legal name matches the loaded entity/process party name, or
- the official party ID matches the loaded party external ID, or
- a `PY-RUC` party identifier matches the RUC base/value already attached to the procurement party.

The connector records what DNCP published. If a RUC is missing a check digit, it stays missing; Centinela does not infer it.

## Current Live Use

On 2026-05-03, this connector was run for:

- `MENDEZ GONZALEZ FLORIANA *`, the remaining local identity-anchor gap.
- `CONSULTORA GUARANI SA INGENIEROS CIVILES`, the first accepted second-review external identity-context match.

On 2026-05-06, this connector was widened through the source-pack readiness queue for:

- `PROSALUDFARMA S.A.`
- `INDEX S.A.C.I.`
- `QUIMFA S.A.`

Current live `py-dncp-release-source-check` records:

- 10 official DNCP release package source records.
- 1,462 official DNCP document metadata source records.
- 5 linked local entities.

## Analyst Use

Entity briefs now include an `Official source records and documents` section for source records where the payload links to the entity.

Analysts can use these records to:

- link exact official DNCP source packages or document metadata into cases
- cite source-record IDs in evidence links
- build source bundles and source-document indexes from saved cases
- review official process documents before escalating candidate or risk-signal interpretation

When document content itself is needed, use the companion content-capture command:

```bash
npm run enrichment:dncp-document-content -- --entity-name "Entity Name" --query "contrato" --limit 2
```

## Limits

- The connector extracts document metadata. It does not download or OCR document contents itself; use `py-dncp-document-content` for selected document capture and bounded text extraction attempts.
- Some DNCP release URLs can be slow or temporarily unavailable; the connector bounds each fetch with a timeout and records failed fetches in the local report.
- Contact fields may exist inside official payloads, but generated reports avoid reprinting them unless a later analyst workflow explicitly needs a field-level citation.
- Source records are internal review material. Public use still requires case public-safety review, methodology review, privacy review, and source-license review.
