# System foundation

## Goal

Build a reusable integrity-intelligence system that can:

- ingest public-integrity datasets
- normalize them into a country-portable internal model
- link entities and relationships across sources
- compute explainable risk signals
- support analyst workflows first and public UX later

## Active constitutional requirement

The foundation is no longer allowed to narrow into a single-reference implementation path.

Each major precedent in Centinela's comparative universe must apply concrete implementation pressure in the domain where it is strongest. The durable execution artifact for that requirement is `docs/execution/reference-to-component-execution-plan.md`.

## Chosen baseline

### Storage

- Canonical: PostgreSQL on the VPS
- Local first-run evidence layer: JSON outputs under `data/`
- Reasoning: strong SQL, JSON, indexing, durability, easy hosting, future API fit

### Modeling

- Use a relationship-aware relational core
- Preserve identifiers, aliases, and source lineage explicitly
- Keep graph export or graph sidecar as a later phase

### Ingestion

- Bronze: raw source bundles with retrieval metadata
- Silver: normalized process and entity documents
- Gold: explainable risk-signal outputs and analyst-facing summaries

### Persistence and loading

- Local runtime handles ingestion and normalization
- PostgreSQL is loaded through a batched bundle loader
- Current operational route: local Node plus SSH tunnel into the VPS PostgreSQL container network
- Reasoning: keeps the VPS lean while still using it as the canonical store

### Search and investigation

- Current phase: file outputs plus SQL analyst views, database-backed markdown briefs, entity activity views, buyer-supplier edge views, review queues, enrichment connectors, and a first local-only internal API/console
- Next phase: saved casework, source-record drilldowns, graph export, additional ownership/offshore joins, richer entity search, and later document/evidence index inspired by Aleph, Sayari, br/acc, QQW, Dozorro, and Integrity Watch

## Why not a graph-first lock-in today

Graph workflows matter, but the first bottleneck was reliable ingestion, normalization, and explainable signals for Paraguay. PostgreSQL plus explicit link tables got us there faster, and now supports multi-year edges, provenance, and entity-centric investigation without a graph lock-in. If the project later needs graph-native traversals at scale, the relational core can publish edge exports to Neo4j or another graph engine.
