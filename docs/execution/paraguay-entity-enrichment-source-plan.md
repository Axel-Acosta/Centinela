# Paraguay entity and enrichment source plan

## Purpose

This document turns the next-stage entity-intelligence universe into a practical source plan.

It is not a generic wishlist.

It records which company, sanctions, ownership, offshore, and accountability sources Centinela should use now, which are staged later, and why.

## Current active connector choices

- Already implemented
  - OpenSanctions `default` bulk dataset via the public `targets.simple.csv` export
  - DNCP supplier anchor through official `proveedores.csv`, supplier detail pages, and `sanciones.csv`
  - DNIT RUC equivalence bulk identity validation through official `ruc0.zip` through `ruc9.zip` resources
  - IDB Open Data sanctioned firms and individuals dataset as a row-level source check for IADB/OpenSanctions candidates
- Why
  - publicly reachable in bulk without waiting for credentials
  - DNCP's supplier and sanctions surfaces are the strongest available local Paraguay company/disqualification anchor from the current repo state
  - DNIT's RUC equivalence bulk files provide the strongest lawful taxpayer identity-validation layer found so far beyond supplier registration
  - together they advance OpenSanctions, DNCP, br/acc, Sayari, QQW, OpenCorporates, OpenOwnership, and ICIJ roles through a live local-plus-external spine
  - they provide external-risk screening, official supplier/disqualification context, official taxpayer identity validation, and first primary-source external candidate evidence now
- Important access reality observed on 2026-04-18
  - the hosted OpenSanctions matching API currently returns `401 Unauthorized` without an API key
  - the public bulk index and exports remain reachable, so Centinela currently uses the bulk route instead of the hosted API

## Candidate sources

### 1. OpenSanctions `default` bulk

- Contains
  - sanctions, debarment, enforcement, PEP, offshore-linked, and adjacent company/person identity records aggregated into one public collection
- Access
  - public bulk
  - hosted API is authenticated
- Key fields
  - `id`, `schema`, `name`, `aliases`, `countries`, `identifiers`, `sanctions`, `program_ids`, `dataset`
- Maps to
  - `entities`
  - `entity_relationships`
  - `entity_enrichment_matches`
  - `entity_external_risk_signals`
- Legal and ethical cautions
  - match results are screening leads, not identity proof
  - dataset origin varies and must remain visible in Centinela outputs
- Immediate value
  - high
- Use timing
  - now

### 2. DNCP inhabilitated providers search

- Contains
  - officially surfaced supplier disqualification or inhabilitación records tied to public procurement reality
- Access
  - public search page
  - likely scrape-only unless a stable structured endpoint is found
- Key fields
  - supplier name, sanction/disqualification status, period, resolution context
- Maps to
  - `entities`
  - `entity_external_risk_signals`
  - later local match-review queue
- Legal and ethical cautions
  - local administrative status should remain time-bounded and source-linked
  - scraped records should preserve the exact page URL and retrieval date
- Immediate value
  - very high
- Use timing
  - now, implemented as part of the DNCP supplier anchor through the official sanctions CSV search

### 2a. IDB Open Data sanctioned firms and individuals

- Contains
  - IDB Group sanctioned firms and individuals, including debarment periods, country/nationality context, prohibited-practice category, source, and sanction source fields
- Access
  - official public CKAN-style Open Data dataset and datastore API
- Key fields
  - `Title`, `Entity`, `Nationality`, `Country`, `From`, `To`, `Prohibited Practice`, `Source`, `Tipo de sancion del BID`, `IDB Sanction Source`
- Maps to
  - `source_records`
  - `entity_enrichment_candidates.review_evidence`
  - external candidate review reports and entity dossiers
- Legal and ethical cautions
  - source rows are administrative-source evidence, not legal conclusions by Centinela
  - the current row-level source does not expose Paraguay RUCs, so second review remains required before accepted-match insertion
- Immediate value
  - high for OpenSanctions candidates whose upstream dataset is `iadb_sanctions`
- Use timing
  - now, implemented as `npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --update-review true`
- Current implementation on April 24, 2026
  - candidate `59` was checked against official IDB Open Data row `76193`
  - the row confirms the external candidate name, firm type, Paraguay context, debarment type, date, and ongoing status
  - candidate `59` is now `promotable`, meaning ready for second review, not accepted

### 3. DNCP Registro de Proveedores del Estado

- Contains
  - state supplier identity and registration context
- Access
  - official public portal and guidance
  - structured bulk/API access still unclear
- Key fields
  - supplier identity, registry status, personería, contact and registration metadata where exposed
- Maps to
  - `entities`
  - `entity_identifiers`
  - `entity_source_mentions`
  - later representative/owner placeholders
- Legal and ethical cautions
  - preserve exactly what is public in the portal and avoid over-collecting personal data
- Immediate value
  - high
- Use timing
  - now, implemented for the current top-risk supplier slice through official provider search CSV and supplier detail pages

### 4. DNIT / SET RUC and taxpayer-status sources

- Contains
  - taxpayer identity, constancia, equivalence lists, and some RUC-linked company facts
- Access
  - official RUC equivalence bulk ZIPs are public and operationalized
  - separate profile/constancia services exist but remain human-oriented and may involve reCAPTCHA
- Key fields
  - RUC base, legal name, check digit, equivalence code, taxpayer status, official source file and line
- Maps to
  - `entity_local_profiles`
  - `entity_identifiers`
  - `entity_source_mentions`
  - `source_records`
  - company identity normalization and later external-match evidence display
- Legal and ethical cautions
  - do not bypass access controls or human-only systems
  - only use lawful public outputs or explicit authorized access
  - do not replicate the full taxpayer list unnecessarily; persist only procurement-linked matches
- Immediate value
  - high
- Use timing
  - now for RUC equivalence bulk; staged for profile/constancia flows
- Current implementation on April 19, 2026
  - `py-dnit-ruc-equivalence` validates procurement-linked supplier RUCs against official DNIT bulk files and stores source-backed local identity profiles
  - current live result: 2,518 stored DNIT profiles, 12 previous anchor gaps resolved, 1 remaining missing-check-digit gap
- Current observed blocker for profile/constancia flows
  - the public `perfilPublicoContribIService.do` and `constanciaRucIService.do` flows exist, but the current public-facing implementation appears human-oriented and reCAPTCHA-protected, so Centinela should not automate against it blindly from the current repo state

### 5. OpenCorporates

- Contains
  - foreign company identity, registry numbers, officers, and provenance-rich company records
- Access
  - public website and API/data products
  - usage constraints and authentication/rate conditions may apply depending on route
- Key fields
  - company number, jurisdiction, company name, officers, source provenance
- Maps to
  - external company identity normalization
  - foreign-company linkage
  - later company-to-company and company-to-person edges
- Legal and ethical cautions
  - respect licensing and access limits
  - keep OpenCorporates-derived facts clearly distinguished from local official Paraguay facts
- Immediate value
  - medium-high
- Use timing
  - staged after the local company identity layer is stronger

### 6. Open Ownership republished BODS data

- Contains
  - republished beneficial ownership datasets in BODS-compatible structure
- Access
  - public downloadable republished data
  - the original Open Ownership Register was closed in November 2024
- Key fields
  - statements about entities, interests, beneficial owners, controlling persons
- Maps to
  - ownership-ready relationship model
  - future `ownership_beneficial`, `ownership_direct`, and `representation_legal` edges
- Legal and ethical cautions
  - ownership data quality varies sharply by source jurisdiction
  - do not imply current beneficial ownership if the underlying source is historical or incomplete
- Immediate value
  - medium
- Use timing
  - staged after Centinela has a stronger Paraguay company identity base

### 7. ICIJ Offshore Leaks

- Contains
  - offshore entities, officers, beneficiaries, intermediaries, and relationships
- Access
  - public bulk CSV and Neo4j exports
- Key fields
  - offshore entity names, related people/companies, jurisdictions, link roles
- Maps to
  - offshore-network enrichment
  - company-to-company and company-to-person cross-border edges
- Legal and ethical cautions
  - presence in the database is not proof of wrongdoing
  - role, date, and context must stay visible
- Immediate value
  - medium
- Use timing
  - later, after the company registry and match-review spine is stronger

### 8. Paraguay beneficial ownership / final beneficiary sources

- Contains
  - potentially high-value owner and controller information
- Access
  - public access path still unclear from the current repo state
- Key fields
  - owner name, controller role, legal entity, effective dates, filing provenance
- Maps to
  - `entity_relationships`
  - ownership traversal
  - Sayari/OpenOwnership-style beneficial ownership exploration
- Legal and ethical cautions
  - only use lawful public or explicitly authorized access
  - preserve time-bounded ownership context
- Immediate value
  - very high if accessible
- Use timing
  - blocked pending a clear lawful source path

## Current staging decision

- Implement now
  - OpenSanctions bulk screening for procurement supplier companies
  - DNCP supplier anchor keyed by procurement-linked RUCs, including official supplier profile and sanctions history capture
  - incremental widening of the DNCP supplier anchor through unanchored-only batches
  - DNIT RUC equivalence bulk validation for procurement-linked supplier companies
  - bounded fallback matching for residual supplier identities and a dedicated `entity_anchor_gap_review` backlog
  - company-level entity-intelligence review queue for local anchor gaps, local administrative history, representative density, and external-risk state
- Queue next
  - recover the missing RUC check digit for the last unresolved anchor gap in `database:entity-anchor-gaps`
  - rerun OpenSanctions/external screening with DNIT-validated names and identifiers
- Stage after that
  - OpenCorporates foreign-company expansion
  - Open Ownership BODS and ICIJ offshore layers

## Why this order is right

- It gives Centinela a real external-risk connector now without waiting for new credentials.
- It now gives Centinela a real external-risk connector, a Paraguay official supplier/disqualification anchor, and a Paraguay official taxpayer identity-validation anchor, so the system no longer drifts into a foreign-enrichment-only shape.
- It preserves a clean path toward ownership and offshore expansion once the local company identity layer is stronger.
