# Abogacia person relationship staging

## Purpose

Centinela now has a privacy-minimized staging lane for Paraguay Abogacia del Tesoro director, shareholder, and beneficial-owner relationship rows.

This is not a public ownership graph yet.

The lane exists to test whether official relationship rows can strengthen company/entity intelligence without turning sensitive person data into broad Centinela storage or public-facing claims.

## Source

Official portal:

```text
https://datos.abogacia.gov.py/
```

Official source files parsed in memory:

```text
https://datos.abogacia.gov.py/assets/docs/beneficiario-final-full.csv
https://datos.abogacia.gov.py/assets/docs/directivos-full.csv
https://datos.abogacia.gov.py/assets/docs/socios-full.csv
```

Companion dictionaries:

```text
https://datos.abogacia.gov.py/assets/json/diccionarioBeneficiario.json
https://datos.abogacia.gov.py/assets/json/diccionarioDirectivo.json
https://datos.abogacia.gov.py/assets/json/diccionarioSocio.json
```

## Command

```bash
npm run enrichment:abogacia-person-relationship-staging -- --limit 250
```

Dry run:

```bash
npm run enrichment:abogacia-person-relationship-staging -- --dry-run true --limit 250
```

Subset run:

```bash
npm run enrichment:abogacia-person-relationship-staging -- --relation-kinds beneficial_owner,director --limit 100
```

## What It Writes

The migration `sql/postgres/020_abogacia_relationship_staging.sql` adds:

- `entity_relationship_staging`
- `entity_relationship_staging_overview`
- `entity_relationship_staging_summary`

The migration `sql/postgres/021_relationship_staging_review_workflow.sql` adds:

- `entity_relationship_staging_reviews`
- `entity_relationship_staging_review_queue`
- latest-review fields on `entity_relationship_staging_overview`

The connector writes:

- a `source_runs` row with source key `py-abogacia-person-relationship-staging`
- `source_assets` for dictionaries and source-file hashes
- redacted `source_records` with record kind `abogacia_person_relationship_staging_redacted`
- `entity_relationship_staging` rows linked to existing procurement/DNIT/DNCP company entities by RUC base
- runtime reports under the local non-sync Centinela data folder

## Current Live Result

Latest pilot run:

- pilot source run ID: `52`
- widening source runs: `53`, `54`, `55`
- raw source rows observed across selected official files during the pilot: `59,584`
- parsed relationship rows during the pilot: `58,613`
- procurement-linked rows matched by RUC base: `1,776`
- staged review-only rows now stored: `1,776`
- beneficial-owner staged rows: `729`
- director staged rows: `749`
- shareholder staged rows: `298`

Runtime report:

```text
C:\Users\Axeld\AppData\Local\Centinela\data\reports\paraguay\abogacia-person-relationship-staging-2026-05-15T12-31-31-079Z.md
```

Staged review queue report:

```bash
npm run database:staged-relationships -- --limit 50
```

## Data Minimization

Centinela does not persist raw full personal CSV files from this connector.

Centinela does not persist:

- raw person names
- document numbers
- addresses
- birth dates
- phone numbers
- emails

Staged rows store:

- company entity ID
- company RUC base
- source company name
- relation type
- redacted person display initials
- one-way person-name hash
- source row hash
- source line number
- non-sensitive relationship attributes such as relation role, participation band, voting-rights band, term status, and company type
- source URLs, dictionary URLs, and limitations

Hashing a public name is only a minimization measure. It is not a guarantee of anonymity.

## Review Boundary

Every row is stored as:

- `review_status = staged_review_only`
- `public_display_status = blocked_personal_data`
- `promotion_status = not_promoted`

The staging lane does not create person entities by default.

The staging lane does not create accepted graph edges in `entity_relationships` by default.

The staging lane does not create external risk signals.

Promotion requires the separate review-governance workflow in migration `021`.

Allowed review decisions are:

- `needs_more_evidence`
- `keep_staged`
- `rejected`
- `promote_to_redacted_relationship`

Promotion creates only a redacted internal person placeholder and a redacted internal graph edge. It does not expose raw person identity and does not authorize public display.

CLI review command:

```bash
npm run database:review-staged-relationship -- --staging-id <id> --decision needs_more_evidence --reviewer "Analyst Name" --rationale "Source-backed rationale"
```

Dry-run promotion check:

```bash
npm run database:review-staged-relationship -- --staging-id <id> --decision promote_to_redacted_relationship --reviewer "Analyst Name" --rationale "Governance test" --limitations "Raw person identity remains redacted; public display blocked." --dry-run true
```

## Matching Logic

Matching is by Abogacia `ruc_nro` base against existing Centinela company identifiers:

- `PY-RUC`
- `PY-RUC-PLAIN`
- `PY-ABOGACIA-RUC-BASE`

Company-name agreement raises confidence, but RUC-base agreement is the identity anchor.

This is source-backed relationship context for review, not proof of ownership control, misconduct, sanctions exposure, or legal culpability.

## Analyst Surface

Entity briefs now include an `Abogacia staged person relationship leads` section.

The internal API entity profile now returns `stagedRelationships`.

The graph-ready entity network now includes redacted staged-person nodes and review-only edges where staged rows exist.

The internal API now exposes:

- `GET /api/staged-relationships`
- `POST /api/staged-relationships/:id/reviews`

The Command Center now includes a staged-relationships review panel.

These surfaces are internal review aids only.

## Precedent Influence

- br/acc: source-backed relationship staging and provenance-first public-data graph discipline.
- OpenOwnership: ownership-ready role modeling without overclaiming beneficial ownership.
- Sayari: company/person relationship exploration as an analyst workflow, not a flat score.
- QuiénEsQuién/TodosLosContratos: contracts-plus-company accountability path for later public explanation.
- Aleph: entity-centric dossier and source-record traceability.
- RUBLI and Integrity Watch: explicit limitations, public-display gates, and non-accusatory language.

## Limits

- Official source-file reachability does not mean all fields should be republished by Centinela.
- The connector intentionally avoids broad raw personal-data persistence.
- Staged rows are internal relationship leads, not final facts.
- Public use needs a separate privacy, legal, UX, and methodology review.
