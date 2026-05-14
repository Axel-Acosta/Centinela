# Paraguay source universe

## Procurement-first anchor

### DNCP

- Why first: official, current, structured, and already OCDS-aware.
- Live interfaces:
  - public API v3 docs
  - open-tender minimal visualizations
  - search endpoints for procurement processes
  - annual OCDS bulk ZIP files for tenders and contracts
- High-value fields already visible:
  - buyer and procuring entity
  - tender period and status
  - procurement method details
  - suppliers and awards
  - documents
  - implementation and financial progress in full releases

## Priority next-source categories

- supplier sanctions and disqualifications
- public official rosters and payroll
- company and legal-entity records
- beneficial ownership or ownership-related records, starting with the Abogacia company-level public index
- campaign finance
- court, oversight, and administrative decisions
- external enrichment: OpenSanctions, OpenOwnership/BODS-compatible sources, OpenCorporates, ICIJ Offshore Leaks

## Ownership-ready company accountability

### Abogacia del Tesoro / Personas Jurídicas y Beneficiarios Finales

- Why now: official Paraguay public open-data portal and the strongest current lawful bridge from procurement-linked suppliers toward ownership/accountability structure.
- Live interface: `https://datos.abogacia.gov.py/`.
- Current implemented slice: company-level public index only, using `ruc_nro` and `denominacion` from `beneficiario-final-publico.csv`.
- Current live result: `py-abogacia-beneficial-ownership-public-index` parsed 31,649 public company rows and matched 899 procurement-linked companies by RUC base in source run `49`.
- Centinela mapping: company RUC base and name become source-backed company context through `source_records`, `entity_local_profiles`, `entity_source_mentions`, `PY-ABOGACIA-RUC-BASE` identifiers, and source assets.
- Legal/ethical caution: presence in the public company index is not an ownership conclusion, wrongdoing signal, or sanctions signal.
- Staged but not ingested: directors, shareholders, and beneficial-owner person CSVs are discoverable but include personal fields; ingest only after privacy, minimization, relationship provenance, review queues, and public-display rules are explicit.

## Sourcing rule

Prefer official Paraguay sources first. Use global enrichment sources to link or contextualize Paraguayan entities, not to overwrite primary local facts.
