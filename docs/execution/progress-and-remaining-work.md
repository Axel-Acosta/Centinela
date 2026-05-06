# Centinela progress and remaining work

This is a working estimate, not a promise of exact dates. Centinela is being built as a serious long-term public-integrity intelligence system, so "complete" has more than one level.

## Current completion estimate

- Phase A - Skill, memory, reference universe: about 90-95% of the foundation is done.
- Phase B - System foundation and internal storage: about 75-85% of the internal foundation is done.
- Phase C - Paraguay internal implementation: about 45-55% of the first serious internal Paraguay implementation is done.
- Phase D - Public/product publication layer: about 10-15% is done.
- Overall long-term product: about 35-45% done, because the internal evidence spine is strong but the public product and more cross-domain Paraguay sources are still early.

## What is already solid

- DNCP/Postgres procurement foundation with 2025 and 2026 loaded.
- Rule registry, review queue, methodology outputs, and non-accusatory language discipline.
- DNCP plus DNIT local company identity anchor, with only one known local anchor gap remaining.
- OpenSanctions bulk and hosted comparison workflows, candidate review, source-backed second review, safer rerun preservation for reviewed candidates, stronger candidate-name evidence, and the first accepted external identity-context match.
- Local internal console/API with entity dossiers, graph-ready networks, queues, source-record drilldowns, saved cases, notes, evidence links, timelines, public-safety gates, artifact generation, source bundles, source-document indexes, and artifact rediscovery.
- DNCP release source-check connector that persists official OCDS release packages and document metadata as source records for entity casework; current live state is 4 release package records and 567 document metadata records across two high-priority entities.
- Entity source-pack workflow that turns entity-linked source records into analyst cases, evidence links, source manifests, source bundles, and source-document indexes; first live packs now exist for Mendez and Consultora Guarani.
- Runtime storage kept outside OneDrive/Git by default.

## What is still missing for the internal Paraguay MVP

- Resolve the final RUC/check-digit anchor gap if a new lawful source exposes it; current DNIT, DNCP OCDS, DNCP supplier search, and text-extractable official-document checks did not recover it.
- Continue improving external-candidate scoring with source-document evidence and identifier comparisons where available; name-order, generic-term handling, and distinctive-token evidence are now live.
- Add at least one more lawful Paraguay cross-domain source beyond procurement/taxpayer identity, preferably ownership/officer/accountability data if accessible.
- Widen official DNCP release/document source checks across the highest-priority company/candidate dossiers while broader registry access remains blocked or unclear, then turn the strongest ones into entity source packs.
- Add selected document-content extraction/OCR for source records that analysts actually need, instead of bulk-downloading every public PDF.
- Expand entity relationship types enough to support ownership-ready and foreign/offshore-ready graph paths.
- Add bounded artifact-detail reading only if analysts need to inspect selected bundle/index summaries directly in the console.
- Add more automated tests around casework and enrichment flows.

## What is still missing before public release

- Production authentication and role-based access.
- Privacy, legal, and publication review.
- Public methodology and limitations pages.
- Public-safe UX for risk signals, evidence, and source provenance.
- Public deployment architecture, monitoring, backups, and data-refresh policy.
- Stronger source licensing and redistribution decisions for copied artifacts.

## Practical timeline estimate

- Current analyst/casework phase: likely 0-1 more focused runs to feel complete enough for internal use; entity source-pack generation now has console/API access, so the remaining useful work is selective OCR or bounded artifact-detail reading only where real analysis demands it.
- First serious Paraguay internal MVP: likely 6-10 more focused implementation runs.
- First public pilot: likely 10-16 more focused runs after the internal MVP, depending on source access and public-safety requirements.

The next best work should usually prioritize intelligence value over more console polish, unless the console is blocking actual analysis.
