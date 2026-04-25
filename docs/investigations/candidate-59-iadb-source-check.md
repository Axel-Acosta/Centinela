# Candidate 59 IADB source check

## Status

- Candidate ID: `59`
- Local entity: `CONSULTORA GUARANI SA INGENIEROS CIVILES`
- External candidate: `Consultora Guaraní S.A. Ingenieros Civiles`
- Current review status: `promotable`
- This is a review lead, not an accepted match or legal conclusion.

## Local identity package

- Local RUC: `80016063-0`
- Local profile sources:
  - `py-dncp-supplier-anchor`
  - `py-dnit-ruc-equivalence`
- Local identifiers visible in Centinela:
  - `PY-RUC:PY-RUC-80016063-0`
  - `PY-RUC-PLAIN:80016063-0`
  - `DNCP-PROVEEDOR-SLUG:consultora-guarani-sa-ingenieros-civiles`
  - `DNIT-RUC-EQUIVALENCE:CGUA968350X`

## External candidate package

- OpenSanctions source key: `ext-opensanctions-default`
- OpenSanctions external ID: `iadb-firm-consultora-guarani-s-a-ingenieros-civiles`
- OpenSanctions dataset label: `Inter-American Development Bank Sanctions`
- Stored external countries: `py`
- Stored external sanction text: `Debarment - Fraud - 2009-02-09`
- Stored external identifiers: none

## Source-document lead

Official IDB page:

- https://www.iadb.org/en/who-we-are/transparency/sanctions-system/sanctioned-firms-and-individuals

What the page establishes:

- IDB publishes a sanctioned firms and individuals dataset.
- The page describes sanctions as applying to firms or individuals found to have engaged in prohibited practices under IDB Group procedures.
- The page says the dataset has download options.

What remains unresolved:

- The static page did not expose the row-level Consultora Guarani record in plain HTML during the earlier source check.
- The official IDB Open Data dataset was then found and queried through its datastore API.
- The external candidate has no stored identifier comparable to Paraguay RUC `80016063-0`.
- The official IDB row also does not expose a Paraguay RUC or comparable local identifier.
- No accepted-match insertion should happen until a second-review workflow verifies the row-level source evidence, local DNCP/DNIT identity package, and methodology limits.

## Row-level source extracted

- Dataset page: https://data.iadb.org/es/dataset/dataset-of-sanctioned-firms-and-individuals
- API resource ID: `cd0bd9ac-18c6-44bc-8592-9be468c2efd9`
- Centinela source key: `ext-idb-sanctions-open-data`
- Persisted source record: `idb-sanctions-row-76193`
- Row ID: `76193`
- Title: `Consultora Guaraní S.A. Ingenieros Civiles`
- Entity type: `Firm`
- Nationality: `Paraguay`
- Country: `Paraguay`
- From: `2009-02-09 00:00:00.000000000`
- To: `Ongoing`
- Prohibited practice: `Fraud`
- Source: `IDB`
- IDB sanction type: `Debarment`
- IDB sanction source: `SCOM`
- Other name/source label: `Sanctions Committee`
- Raw local artifact: `data/raw/external/idb/sanctioned-firms-individuals-candidate-59.json`
- Report artifact: `data/reports/paraguay/idb-sanctions-candidate-59-source-check.md`

## Next action

Build the second-review workflow for `promotable` candidates.

That workflow should decide whether source-backed candidates can be inserted into accepted external-match tables, while preserving:

- no automatic accusation
- source-row provenance
- local DNCP/DNIT identity package
- explicit lack of comparable external RUC
- reviewer identity and review notes
- separation between accepted match, external risk signal, and public-facing language
