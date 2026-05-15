# Centinela useful internal MVP finish plan

This document defines the finish line for the current internal Centinela phase.

The goal is not to stop the project forever. The goal is to stop open-ended foundation building and declare the first useful internal Paraguay MVP complete when the system can support real analyst-style exploration without pretending to be public-ready.

## Finish definition

Centinela is useful as an internal MVP when it can:

- query the live VPS-backed Paraguay procurement/entity database
- search companies and open dossiers
- show procurement activity, risk signals, source records, cases, evidence links, and generated source packs
- separate accepted external matches from review-only candidates and rejected diagnostics
- preserve rationale, limitations, provenance, and review state for identity/enrichment decisions
- show graph-ready relationships without overclaiming ownership, influence, wrongdoing, or public publishability
- provide a local product-like Command Center that can be shown as an internal demonstration
- keep runtime artifacts out of Git and OneDrive

## Current result

As of 2026-05-15, the internal MVP finish line is met for internal use.

The remaining work is no longer foundation work. Future work should be triggered by specific analytical, source-expansion, public-safety, or presentation needs.

## Included in this finish line

- DNCP 2025 and 2026 bulk data loaded into PostgreSQL.
- Rule registry, process review queue, and methodology-backed risk signals.
- DNCP/DNIT company identity anchor and local company master.
- OpenSanctions bulk, hosted comparison evidence, review-only candidate lane, second-review governance, and one accepted external identity-context match.
- DNCP official release/source-record spine, source packs, source bundles, source-document indexes, and case evidence artifacts.
- Internal API and Command Center with overview, search, dossiers, network view, cases, queues, source packs, artifact browser, verification checks, methodology, and proof path.
- Abogacia company index and full procurement-linked redacted person-relationship staging lane.
- Staged relationship review governance with `needs_more_evidence`, `keep_staged`, `rejected`, and `promote_to_redacted_relationship` decisions.

## Deliberately excluded from this finish line

- Public launch.
- Production authentication and role-based access.
- Public display of person-level relationship data.
- Legal claims about corruption, guilt, beneficial ownership control, or wrongdoing.
- Bulk OCR of all official documents.
- Complete Paraguay public-record universe.
- Full graph database migration.
- Remote web deployment.

## Stop rule

After this finish line, do not continue building broad framework layers by default.

Future Centinela work should start from one of these concrete prompts:

- a specific source to add
- a specific analyst question to support
- a specific dossier or case to improve
- a specific public-safety/publication requirement
- a specific performance or deployment bottleneck
- a specific UI path that blocks explanation or review

## What remains next, if the project continues

Highest-value next moves are:

- Review a small number of high-priority Abogacia staged rows using source packs, then decide whether any should become redacted internal graph edges.
- Add a small relationship-review UI form behind the existing write token if CLI/API review becomes cumbersome.
- Improve source-pack evidence for the entities with the strongest staged relationship plus procurement-risk overlap.
- Add production auth only if a second person needs access.
- Prepare public methodology and privacy review only when public pilot scope is concrete.

## Safety language

Every output remains a risk signal, anomaly, identity context, relationship lead, or source-backed review artifact.

Centinela does not produce proof of wrongdoing.
