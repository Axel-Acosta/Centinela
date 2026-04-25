# Reply draft: sharing Centinela technical summary

Subject: Re: Access request for OpenSanctions API or hosted Yente matching endpoint

Hi,

Thank you very much for the helpful reply and for confirming that Centinela is eligible.

I will start with the hosted API trial as you suggested. That seems like the best first step for comparing Centinela's local review-only candidate scoring against the OpenSanctions/Yente matcher before deciding whether self-hosted Yente is necessary.

Below is a short private technical summary of Centinela's current architecture and review workflow.

Centinela is a Paraguay-focused public-integrity and corruption-risk research system. It began as part of my IB final monograph at Goethe Schule Asuncion, but I am developing it as a serious practical research system for Paraguay public procurement and supplier/entity intelligence.

Centinela is non-accusatory by design. It surfaces risk signals, anomalies, candidate matches, and investigation leads for review. It does not present automated outputs as proof of wrongdoing.

Current technical stack:

- TypeScript / Node.js for ingestion, normalization, enrichment, and report generation.
- PostgreSQL 16 as the canonical store.
- SQL views for procurement activity, entity activity, buyer-supplier relationships, local supplier profiles, enrichment matches, enrichment candidates, risk signals, and review queues.
- Markdown and JSON outputs for internal analyst review.
- VPS-hosted PostgreSQL; local pipeline commands currently connect over SSH tunnel while the system remains internal.

Current Paraguay data foundation:

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

Current OpenSanctions use:

Centinela currently uses the public OpenSanctions bulk `default` dataset conservatively. The connector separates:

- accepted enrichment matches,
- review-only candidate records,
- rejected diagnostics,
- external risk signals.

Current result after the latest conservative rerun:

- zero accepted OpenSanctions matches,
- one review-only company candidate,
- 57 rejected diagnostics,
- zero external risk signals.

This conservative result is intentional. Centinela prefers false negatives and human review over weak automated positive matches.

Desired hosted API trial use:

- compare Centinela's local review-only candidates and rejected diagnostics against `POST /match/default?algorithm=logic-v2`,
- keep hosted results as comparison evidence only,
- avoid automatic accusations or automatic promotion of weak matches,
- use the trial to estimate whether hosted API usage is enough or whether self-hosted Yente would be better later.

Data handling safeguards:

- Store source provenance, source keys, match method, confidence, rationale, and review status.
- Keep review-only candidates separate from accepted matches.
- Keep rejected diagnostics visible for auditability but out of escalation queues.
- Do not create external risk signals from name-only person matches.
- Do not use OpenSanctions results for automatic adverse decisions.
- Do not infer beneficial ownership or control from representative names alone.
- Follow OpenSanctions requirements for attribution, licensing, privacy, retention, caching, and response storage.

Thank you again for the guidance.

With best regards,

Axel Acosta  
Centinela  
axel.d.acosta.d@gmail.com
