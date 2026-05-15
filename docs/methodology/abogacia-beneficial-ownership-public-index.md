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

Centinela now implements the first privacy-minimized staging lane in `docs/methodology/abogacia-person-relationship-staging.md`.

The staging lane:

- parses official person-relationship files in memory
- stores no raw personal CSV files
- stores no raw person names, document numbers, addresses, birth dates, phone numbers, or emails
- stores only redacted relationship leads in `entity_relationship_staging`
- keeps all rows `staged_review_only`, `blocked_personal_data`, and `not_promoted`

Before any public person-level use, still add:

- a privacy review boundary
- public-facing copy limits
- person/entity promotion governance
- legal/methodology review for any raw-source inspection workflow
- a public-safe display policy beyond the internal redacted lane

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
