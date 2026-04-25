# br/acc

## Snapshot

br/acc is Bruno Cesar's open-source graph infrastructure for cross-referencing Brazilian public databases. The current public repo exposes a full stack with ETL pipelines, Neo4j, API, frontend, source registry, and explicit legal and ethics documentation.

## Strong ideas

- Treat scattered public data as one intelligence surface rather than isolated portals.
- Maintain a source registry with explicit implementation status.
- Make legal, privacy, and abuse-response posture part of the product, not an afterthought.
- Keep ingestion reproducible and audit-friendly.
- Use a graph mindset for relationships even when the user experience stays simple.

## Limits for Paraguay

- A Brazil-specific source universe and legal framing cannot be copied directly.
- Immediate Neo4j adoption would add complexity before Paraguay ingestion and rule design are mature.
- br/acc intentionally avoids scoring and ranking; Centinela needs explainable risk signals in addition to relationship surfacing.

## Adopt now

- source registry discipline
- explicit ethics and legal caution
- modular ETL architecture
- relationship-first internal model
- public-safe defaults as a design principle

## Defer or adapt

- Neo4j as the primary store
- full public graph explorer before the Paraguay core is stable

## Role in Centinela

br/acc is the most important architecture reference for the long-term operator shape: an open-data intelligence infrastructure with durable ingestion, traceability, and relationship awareness.

