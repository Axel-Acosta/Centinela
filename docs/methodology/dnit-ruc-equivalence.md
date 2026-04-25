# DNIT RUC equivalence identity validation

## Purpose

The DNIT RUC equivalence connector gives Centinela a Paraguay official identity-validation layer beyond DNCP supplier registration.

It is used to validate procurement-linked supplier identities by RUC, not to create a full taxpayer mirror.

## Source

- Source key: `py-dnit-ruc-equivalence`
- Official page: `https://www.dnit.gov.py/web/portal-institucional/listado-de-ruc-con-sus-equivalencias`
- Observed publication date: `2026-04-01`
- Files used: official `ruc0.zip` through `ruc9.zip` resources linked from the DNIT page

## Ingestion boundary

Centinela downloads the official bulk ZIP files but persists only rows that match entities already observed in the loaded procurement supplier universe.

This bounded strategy keeps the connector useful for public-integrity investigation while avoiding unnecessary replication of a full taxpayer dataset.

## Fields interpreted

- RUC base
- Official name
- Check digit
- Equivalence code
- Taxpayer status
- Source ZIP name and line number

The fourth source column is stored as an equivalence code because the official page describes the files as RUC equivalences. Centinela does not infer ownership, control, risk, or misconduct from this value.

## Match logic

- Accepted match: exact RUC base and exact check digit.
- Reviewable match: exact RUC base when the procurement-side identifier lacks a check digit.
- No match: no source row for the procurement-side RUC base, or a source row with a conflicting check digit.

The connector writes source records, source mentions, local identity profiles, and `PY-RUC-PLAIN` / `DNIT-RUC-EQUIVALENCE` identifiers where available.

## Current live result

- Procurement-linked supplier companies screened: 2,534
- Companies with usable RUC targets: 2,519
- DNIT identity profiles stored: 2,518
- Accepted exact RUC/check-digit matches: 2,514
- Reviewable base-only matches: 4
- Previously unanchored companies resolved: 12
- Remaining local identity anchor gaps: 1

Status distribution in the current stored DNIT profiles:

- `ACTIVO`: 2,459
- `SUSPENSION TEMPORAL`: 35
- `BLOQUEADO`: 20
- `CANCELADO`: 4

## Ethical and analytical cautions

- A DNIT identity validation is not a corruption-risk finding.
- Taxpayer status is an administrative identity attribute, not evidence of wrongdoing.
- A match strengthens local entity resolution, but it does not replace DNCP supplier status, sanctions context, ownership evidence, or analyst review.
- Absence from this connector is not proof that an entity does not exist; remaining gaps may involve missing check digits, malformed procurement identifiers, stale records, or source coverage limits.

## Component influence

- br/acc: strengthens source-registry discipline and cross-dataset identity linking.
- OpenSanctions: makes future external-risk matching more useful by improving the local Paraguay identity anchor.
- OpenOwnership / OpenCorporates / ICIJ: prepares cleaner company identifiers for later ownership, foreign-company, and offshore expansion.
- Sayari: moves Centinela toward entity-centric, provenance-backed identity intelligence.
- QuiénEsQuién / TodosLosContratos: improves company-contract accountability dossiers with official local identity facts.
- Aleph: improves entity briefs and investigation pivots with a separate identity-validation section.
