# IDB sanctions Open Data source checks

## Purpose

Centinela uses the official IDB Open Data sanctioned firms and individuals dataset as a row-level source-document check for OpenSanctions candidates that originate from the Inter-American Development Bank sanctions universe.

This connector is a source-evidence step, not an automatic match-acceptance or accusation step.

## Source

- Source key: `ext-idb-sanctions-open-data`
- Dataset page: `https://data.iadb.org/es/dataset/dataset-of-sanctioned-firms-and-individuals`
- API surface: `https://data.iadb.org/es/api/action/datastore_search`
- Resource ID observed on 2026-04-24: `cd0bd9ac-18c6-44bc-8592-9be468c2efd9`
- License shown on the dataset page: Creative Commons Attribution 4.0 International
- Dataset modification date observed on the dataset page: 2026-04-23

## Current command

```bash
npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --update-review true --reviewer centinela-operator
```

Dry-run mode:

```bash
npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --dry-run true
```

## What the connector does

- Loads one existing Centinela external enrichment candidate from `entity_enrichment_candidate_review_overview`.
- Fetches official IDB Open Data rows for Paraguay from the CKAN datastore API.
- Selects the best matching source row using conservative normalized name comparison.
- Writes raw source evidence under `data/raw/external/idb/`.
- Writes a source-check report under `data/reports/paraguay/`.
- Persists the selected official row into `source_records` with source key `ext-idb-sanctions-open-data`.
- Optionally updates the candidate review status and append-only review evidence history.

## Current live result

- Candidate: `59`
- Local entity: `CONSULTORA GUARANI SA INGENIEROS CIVILES`
- Local RUC: `80016063-0`
- External candidate: `Consultora Guaraní S.A. Ingenieros Civiles`
- Official IDB row selected: `76193`
- IDB title: `Consultora Guaraní S.A. Ingenieros Civiles`
- Entity type: `Firm`
- Nationality: `Paraguay`
- Country: `Paraguay`
- From: `2009-02-09 00:00:00.000000000`
- To: `Ongoing`
- Prohibited practice: `Fraud`
- IDB sanction type: `Debarment`
- IDB sanction source: `SCOM`
- Current review status after source check: `promotable`

## Interpretation rule

`promotable` means the candidate is ready for stronger second review before any accepted-match insertion.

It does not mean:

- Centinela has created an accepted OpenSanctions match.
- Centinela has created an external risk signal.
- Centinela has made a legal conclusion.
- The local Paraguay RUC has been confirmed by IDB.

The row-level IDB source confirms the external source record's name, firm type, country/nationality context, sanction category, date, and ongoing status. It does not expose a Paraguay RUC or comparable local identifier, so accepted-match insertion still needs a separate second-review workflow.

## Methodological cautions

- IDB sanctions/debarment records are administrative-source evidence and must remain source-attributed.
- Absence of a source row is not proof that no sanction exists; it may reflect source coverage, query limits, naming differences, or data refresh timing.
- A selected IDB row strengthens an external candidate, but Centinela should still show the local DNCP/DNIT identity package, OpenSanctions evidence, hosted matcher evidence, and limitations together.
- No automatic adverse decision should be made from this connector.

## Reference-system influence

- OpenSanctions: provides the initial candidate and external-risk spine.
- br/acc: source-registry discipline and row-level provenance.
- Aleph: source-document evidence attached to an entity-centric review workflow.
- Sayari: professional-grade entity intelligence requires source-backed match review.
- RUBLI: explicit limitations before scoring or public presentation.
