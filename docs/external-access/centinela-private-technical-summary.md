# Centinela private technical summary

This is a short private technical summary for access review discussions with OpenSanctions/Yente.

## Project

Centinela is a Paraguay-focused public-integrity and corruption-risk research system. It began as part of Axel Acosta's IB final monograph at Goethe Schule Asuncion, but it is being developed as a serious practical research system for Paraguay public procurement and supplier/entity intelligence.

Centinela is non-accusatory by design. It surfaces risk signals, anomalies, candidate matches, and investigation leads for review. It does not present automated outputs as proof of wrongdoing.

## Current technical stack

- TypeScript / Node.js for ingestion, normalization, enrichment, and report generation.
- PostgreSQL 16 as the canonical store.
- SQL views for procurement activity, entity activity, buyer-supplier relationships, local supplier profiles, enrichment matches, enrichment candidates, risk signals, and review queues.
- Markdown and JSON outputs for internal analyst review.
- VPS-hosted PostgreSQL; local pipeline commands currently connect over SSH tunnel while the system remains internal.

## Current Paraguay data foundation

- DNCP annual OCDS bulk data for 2025 and 2026.
- DNCP supplier registry/profile and sanctions/disqualification search outputs.
- DNIT RUC equivalence bulk files for taxpayer identity validation.
- Public OpenSanctions bulk `default` dataset as the current external-risk enrichment source.

Current screened population:

- About 2,534 procurement-linked Paraguay supplier/company entities.
- About 3,165 DNCP legal-representative/person entities linked to those companies.

Current local identity state:

- 2,533 of 2,534 procurement-linked supplier companies have a local identity anchor.
- 2,521 supplier companies have DNCP supplier-profile anchors.
- 2,518 supplier companies have DNIT RUC-equivalence validation profiles.
- 3,642 representative links are stored from official DNCP supplier profiles.

## Current OpenSanctions use

Centinela currently uses the public OpenSanctions bulk `default` dataset conservatively.

The connector separates:

- accepted enrichment matches,
- review-only candidate records,
- rejected diagnostics,
- external risk signals.

Current production result after the latest conservative rerun:

- zero accepted OpenSanctions matches,
- one review-only company candidate,
- 57 rejected diagnostics,
- zero external risk signals.

This conservative result is intentional. Centinela prefers false negatives and human review over weak automated positive matches.

## Desired OpenSanctions/Yente access

Centinela wants authenticated OpenSanctions API or hosted Yente access to compare its local candidate scoring against OpenSanctions' matcher.

The intended use is:

- sanctions, PEP, debarment, watchlist, and external-risk screening;
- comparison of local review-only candidates against authenticated matcher output;
- candidate review workflow improvement;
- no automatic accusation or automatic promotion of weak matches.

## Expected usage

Initial usage should be modest:

- a few test/full screening runs over roughly 5,600 local entities during integration;
- then incremental checks as new suppliers, representatives, or external candidates are added;
- estimated under 25,000 match/search requests per month during the initial evaluation period, unless OpenSanctions recommends a different batch workflow.

Batch matching would be preferred if available and recommended.

## Data handling and safeguards

Centinela's data handling principles:

- Store source provenance, source keys, match method, confidence, rationale, and review status.
- Keep review-only candidates separate from accepted matches.
- Keep rejected diagnostics visible for auditability but out of escalation queues.
- Do not create external risk signals from name-only person matches.
- Do not use OpenSanctions results for automatic adverse decisions.
- Do not infer beneficial ownership or control from representative names alone.
- Follow OpenSanctions requirements for attribution, licensing, privacy, retention, caching, and response storage.

If raw OpenSanctions/Yente response storage is restricted, Centinela can store only permitted normalized metadata, source references, matcher scores, and review evidence.

## Integration timeline

Desired integration start: within 1 to 2 weeks after access is granted.

There is no immediate public launch deadline. The first integration phase is internal validation of match quality and review workflow design.

## Primary contact

- Axel Acosta
- Project lead / technical owner for Centinela
- axel.d.acosta.d@gmail.com
- Paraguay / America-Asuncion
