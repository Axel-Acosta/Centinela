# DNCP supplier anchor methodology

## Purpose

This note explains how Centinela currently builds its first official Paraguay company anchor.

It is a local identity and administrative-context layer, not a guilt engine.

## Current scope

- Screened slice
  - now widened across the current procurement-linked supplier universe through incremental unanchored batches
- Country
  - Paraguay
- Source key
  - `py-dncp-supplier-anchor`

## Official source surfaces used

- `https://www.contrataciones.gov.py/buscador/proveedores.csv`
  - official supplier search export
  - used to resolve supplier slug, RUC, representatives, contact fields, and adjudication count
- `https://www.contrataciones.gov.py/proveedor/<slug>.html`
  - official supplier detail page
  - used to enrich supplier type, company size, activity type, activation dates, and location data where present
- `https://www.contrataciones.gov.py/buscador/sanciones.csv`
  - official supplier sanctions history export
  - used to capture administrative amonestacion and inhabilitacion records

## Match logic

- Primary strategy
  - exact RUC match using the procurement-linked `PY-RUC` identifier already present in Centinela's entity layer
- Fallbacks
  - exact official supplier name
  - cleaned punctuation and asterisk variants
  - comma-reordered person-name variants where the procurement name is surname-first
  - consortium variants when the RUC lookup fails but the official supplier search can resolve the name
  - cautious core-name review when a search result is not a direct exact-RUC match
- Current production posture
  - exact RUC matches are accepted automatically into the current local anchor
  - name/punctuation/consortium fallback matches currently enter as `unreviewed` when confidence is below the exact-RUC threshold
  - the connector now supports `--only-unanchored`, `--offset`, and configurable concurrency so Centinela can widen the official Paraguay company anchor without resetting the whole local layer every time
  - all public DNCP requests are bounded by a timeout so endpoint slowness becomes a traceable connector failure rather than a stalled run

## Current persisted outputs

- `entity_local_profiles`
  - official supplier profile
  - provider slug
  - plain RUC
  - adjudication count
  - activity, company-size, registration, contact, and location fields when present
- `entity_identifiers`
  - `PY-RUC-PLAIN`
  - `DNCP-SUPPLIER-CODE`
  - `DNCP-SUPPLIER-IDENTIFIER`
  - `DNCP-PROVEEDOR-SLUG`
- `entity_source_mentions`
  - official supplier-registry observations
  - representative observations
- `entity_relationships`
  - `representation_legal` links from supplier entities to representative person entities
- `entity_intelligence_signals`
  - local administrative signals backed by official DNCP sanctions rows
- `entity_anchor_gap_review`
  - unresolved supplier identity backlog with RUC-like identifiers, source mentions, gap reasons, and next resolution steps

## Current signal mapping

- `PY-DNCP-SUPPLIER-AMO`
  - DNCP supplier amonestacion record
  - severity: medium
  - default score: 54
- `PY-DNCP-SUPPLIER-INHA`
  - DNCP supplier inhabilitacion record
  - severity: high
  - default score: 82
  - raised to 90 when the returned row indicates active inhabilitacion context

## Explainability rules

- DNCP supplier matches are identity anchors, not accusations.
- DNCP sanctions rows are administrative history and review context, not proof of current misconduct.
- Representative links are official-profile relationship leads.
- Representative links remain reviewable because same-name collisions are possible across different people.

## Current limitations

- The live DNCP supplier anchor covers most procurement-linked supplier companies, but DNCP supplier registration is distinct from DNIT taxpayer identity validation.
- The combined DNCP plus DNIT local identity layer now leaves only one supplier without a local identity anchor, and that gap is specifically a missing-check-digit RUC issue.
- Some official supplier rows expose DNCP registry codes rather than taxpayer RUCs; Centinela stores those as source identifiers and keeps them separate from RUC evidence.
- Representative identity still relies on full-name text, not civil-registry or ownership identifiers.
- DNCP supplier profile data does not equal beneficial ownership data.
- The current signal layer captures official supplier sanctions history, not every possible court, oversight, or market-ban source.

## Next strengthening move

- Recover the missing check digit for the final `database:entity-anchor-gaps` item and rerun DNIT validation for that entity.
- Use DNCP supplier profiles and DNIT identity profiles together to improve future ownership, offshore, and external-risk review workflows.
