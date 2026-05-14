# Abogacia beneficial-ownership public company index

## Purpose

Centinela now uses the public Abogacia del Tesoro open-data portal as the first Paraguay ownership-ready company-accountability source beyond DNCP and DNIT.

This connector is intentionally conservative. It ingests only the company-level public index from:

```text
https://datos.abogacia.gov.py/assets/docs/beneficiario-final-publico.csv
```

It does not ingest personal beneficial-owner, shareholder, director, address, birth-date, or document-number fields yet.

## Command

```bash
npm run enrichment:abogacia-beneficial-ownership-public-index
```

Dry-run mode:

```bash
npm run enrichment:abogacia-beneficial-ownership-public-index -- --dry-run true
```

## Current Live Result

Latest live run:

- source key: `py-abogacia-beneficial-ownership-public-index`
- source run ID: `49`
- public company rows parsed: `31,649`
- procurement-linked RUC targets considered: `5,040`
- procurement-linked companies matched by RUC base: `899`
- stored data: company-level public-index presence only

Runtime report:

```text
C:\Users\Axeld\AppData\Local\Centinela\data\reports\paraguay\abogacia-beneficial-ownership-public-index-2026-05-14T21-55-35-238Z.md
```

## What It Writes

For matched procurement-linked companies, the connector writes:

- `source_records` with record kind `abogacia_beneficial_ownership_public_company_index`
- `entity_local_profiles` with profile kind `abogacia_beneficial_ownership_public_company_index`
- `entity_source_mentions` with role `beneficial_ownership_public_company_index`
- `entity_identifiers` with scheme `PY-ABOGACIA-RUC-BASE`
- `source_assets` pointing to the downloaded CSV, dictionary, and parsed match artifact

## Matching Logic

Matching is by RUC base from the Abogacia public company index against existing procurement-linked company identifiers in Centinela.

- `ruc_base_and_name_match`: RUC base matches and normalized names agree.
- `ruc_base_match_name_review`: RUC base matches but names differ enough to preserve review caution.

The match is company/accountability context only. It is not an ownership conclusion, sanctions signal, corruption signal, or proof of wrongdoing.

## Why Personal Relationship Data Is Staged

The same portal exposes richer director, shareholder, and beneficial-owner CSVs. These are high-value, but they include personal fields. Centinela should not ingest them casually.

Before person-level ingestion, add:

- a privacy review boundary
- person-field minimization rules
- relationship-specific provenance and time-bounding
- public-copy limits
- a person/entity relationship review queue
- a public-safe display policy

## Reference Influence

- OpenOwnership shapes the staged ownership-readiness discipline.
- br/acc shapes the source registry and cross-source entity-link approach.
- Sayari shapes the long-term company/person relationship intelligence direction.
- QuiénEsQuién/TodosLosContratos shapes the company-contract accountability use case.
- RUBLI and Integrity Watch shape the explicit limitations and public-safe language.

## Use Limits

- Public-index presence is not evidence of misconduct.
- Company-level public-index presence is not a statement about a specific beneficial owner.
- RUC-base matching should be used as source-backed context for review.
- Public use still requires privacy, source, methodology, and UX review.
