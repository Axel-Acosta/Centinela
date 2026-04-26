# VPS and PostgreSQL direction

## Current observed environment

- Host OS: Ubuntu 24.04
- Docker present
- PostgreSQL 16 present in Docker
- PostgreSQL container IP observed on 2026-04-17: `172.18.0.2`
- PostgreSQL container IP re-confirmed on 2026-04-26: `172.18.0.2`
- `node` and `npm` are not currently installed on the VPS
- Existing services already use the VPS, so Centinela should avoid reusing another project's database directly

## Safe posture

- Create a dedicated Centinela database before loading project tables
- Keep secrets in `.env`, never in committed files
- Prefer schema-managed SQL over ad hoc manual table creation

## Recommended next infrastructure step

1. Keep using the batched local loader over an SSH tunnel until there is a clear reason to add a remote runtime
2. Keep the first internal API/console local-only while it has no authentication or role-based permissions
3. Keep extending the SQL query layer for process, entity, edge, candidate-review, and second-review investigation
4. Add a remote runtime only after the analyst workspace needs remote access, saved cases, authentication, or scheduled jobs
5. Keep database credentials in `.env` and never in repo files

## Why this is the right next step

It uses the infrastructure already available, avoids spending another run debating topology, and keeps the project ready for an eventual analyst API or internal UI without forcing early public exposure.

The first analyst API/console now runs locally against the same tunneled PostgreSQL path, which gives Centinela an explorable workspace without exposing the VPS database or a public web surface.

## Current status

- Dedicated database created: `centinela`
- Initial schema applied from `sql/postgres/001_init.sql`
- Contract transaction table applied from `sql/postgres/002_contract_transactions.sql`
- Analyst indexes and views applied from `sql/postgres/003_analyst_views.sql`
- Entity intelligence and review views applied from `sql/postgres/004_entity_intelligence.sql`
- Entity enrichment tables and views applied from `sql/postgres/006_entity_enrichment.sql`
- Local entity-anchor tables and views applied from `sql/postgres/007_local_entity_anchor.sql`
- Entity-intelligence queue views applied from `sql/postgres/008_entity_intelligence_queue.sql`
- Entity anchor-gap review view applied from `sql/postgres/009_entity_anchor_gap_review.sql`
- DNCP supplier-code identifier repair applied from `sql/postgres/010_dncp_supplier_identifier_repair.sql`
- DNIT-aware anchor-gap refinement applied from `sql/postgres/011_entity_anchor_gap_dnit_resolution.sql`
- Entity enrichment candidate storage and candidate-aware queue views applied from `sql/postgres/012_entity_enrichment_candidates.sql`
- Hosted comparison storage applied from `sql/postgres/013_hosted_match_comparisons.sql`
- Manual external candidate review workflow applied from `sql/postgres/014_external_candidate_review_workflow.sql`
- External candidate second-review workflow applied from `sql/postgres/015_external_candidate_second_review.sql`
- DNCP 2025 and 2026 bulk bundles loaded successfully into PostgreSQL
- OpenSanctions bulk screening run persisted under `ext-opensanctions-default`
- OpenSanctions hosted comparison persisted under `ext-opensanctions-hosted-match`
- Official IDB Open Data source-check row persisted under `ext-idb-sanctions-open-data`
- DNCP supplier-anchor run persisted under `py-dncp-supplier-anchor`
- DNIT RUC equivalence run persisted under `py-dnit-ruc-equivalence`
- Current Paraguay local identity state: 2,533 of 2,534 procurement-linked supplier companies have a local identity anchor; 2,521 have DNCP supplier profiles, 2,518 have DNIT RUC equivalence profiles, 446 companies have local administrative signals, and 3,642 representative links are stored
- Remaining anchor gap: `MENDEZ GONZALEZ FLORIANA *`, because the procurement-side RUC lacks a check digit needed for DNIT bulk validation
- Current access pattern: dedicated local SSH key plus SSH tunnel from local machine to `172.18.0.2:5432`, then local Node/TypeScript commands. A local ignored `.env` can hold DB connection settings; never commit it.
- Current hosted-match reality: the first real hosted comparison result is already stored and exposed through analyst surfaces, but the trial API key hit a monthly `429` rate limit on a later rerun attempt
- Current manual-review reality: `centinela.entity_enrichment_candidate_review_overview` exposes 58 OpenSanctions candidate/diagnostic rows with reviewer state, suggested review status, hosted-comparison support, source-check evidence history, and next-step guidance. The current live distribution is 1 `accepted_match` second-review case, 5 `monitor`, 4 `rejected`, and 48 `unreviewed` diagnostics.
- Current second-review reality: schema, CLI, live DB, reports, and dossiers are operational. Candidate `59` has second-review decision `accepted_match`, accepted enrichment match ID `11`, accepted external entity ID `12431`, and the workflow created zero external risk signals.
