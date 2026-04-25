# Next steps

1. Complete GitHub publication after user-controlled authentication:
   run `.\scripts\publish-github.ps1 -Owner Axel-Acosta` from the repo root once `gh auth login` is complete, then verify `origin` and public visibility.
2. Build a second-review workflow for `promotable` external candidates before any accepted-match insertion:
   candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, now has hosted same-candidate support and official IDB Open Data row `76193`, but no comparable external RUC.
3. Keep accepted matches, external risk signals, review-only candidates, and public-facing language separate:
   `promotable` means ready for stronger second review, not accepted identity resolution or proof of wrongdoing.
4. Extend analyst outputs/API requirements around candidate review:
   expose source-record evidence, review evidence history, local DNCP/DNIT identifiers, hosted comparison support, second-review status, and rationale together.
5. Improve OpenSanctions candidate scoring before any broader matching:
   add stronger name-order scoring, source-document evidence scoring, local identifier comparison where external identifiers exist, and explicit handling for generic business terms.
6. Resolve the last remaining local identity anchor gap:
   `MENDEZ GONZALEZ FLORIANA *` has `PY-RUC-4070792` without a check digit, so recover the complete RUC from DNCP source records, official documents, or another lawful Paraguay identity source before rerunning DNIT validation.
7. Keep the DNCP legal-representative/person screening lane active, but preserve weak person-name overlaps as rejected diagnostics unless exact person-name agreement, stronger multi-token evidence, hosted matcher evidence, or source documents justify review escalation.
8. Ask OpenSanctions about higher trial limits or longer-term access if another hosted rerun is needed before the monthly quota resets; otherwise continue using the already-stored hosted comparison evidence.
9. Refine the DNCP-to-Centinela crosswalk with the best available local public red-flag descriptions and terminology.
10. Expose the current multi-year investigation surfaces through an internal API contract designed around entity dossiers, process leads, company-level intelligence queues, external-candidate review, hosted-match comparison, IDB source checks, anchor-gap review, rulebook metadata, provenance-aware drilldowns, DNCP supplier facts, DNIT identity-validation facts, and representative/person screening state.
