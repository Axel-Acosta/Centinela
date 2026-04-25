# Next steps

1. Apply the second-review migration once the local SSH tunnel to VPS PostgreSQL is open:
   `npm run database:apply-sql -- --file sql/postgres/015_external_candidate_second_review.sql`.
2. Dry-run candidate `59` through second review:
   `npm run database:second-review-external-candidate -- --candidate-id 59 --decision accepted_match --reviewer "centinela-operator" --rationale "Official IDB row, local DNCP/DNIT profile, and hosted matcher support point to the same company identity." --limitations "The external source row does not expose a comparable RUC, so this accepts identity context only and does not prove misconduct." --dry-run true`.
3. If the dry-run output is coherent, record the second review for candidate `59` or keep it in `needs_more_evidence`.
4. Keep accepted matches, external risk signals, review-only candidates, and public-facing language separate:
   `promotable` means ready for stronger second review, not accepted identity resolution or proof of wrongdoing.
5. Extend analyst outputs/API requirements around candidate review:
   expose source-record evidence, review evidence history, local DNCP/DNIT identifiers, hosted comparison support, second-review status, rationale, limitations, and accepted-match IDs together.
6. Improve OpenSanctions candidate scoring before any broader matching:
   add stronger name-order scoring, source-document evidence scoring, local identifier comparison where external identifiers exist, and explicit handling for generic business terms.
7. Resolve the last remaining local identity anchor gap:
   `MENDEZ GONZALEZ FLORIANA *` has `PY-RUC-4070792` without a check digit, so recover the complete RUC from DNCP source records, official documents, or another lawful Paraguay identity source before rerunning DNIT validation.
8. Keep the DNCP legal-representative/person screening lane active, but preserve weak person-name overlaps as rejected diagnostics unless exact person-name agreement, stronger multi-token evidence, hosted matcher evidence, or source documents justify review escalation.
9. Ask OpenSanctions about higher trial limits or longer-term access if another hosted rerun is needed before the monthly quota resets; otherwise continue using the already-stored hosted comparison evidence.
10. Refine the DNCP-to-Centinela crosswalk with the best available local public red-flag descriptions and terminology.
11. Expose the current multi-year investigation surfaces through an internal API contract designed around entity dossiers, process leads, company-level intelligence queues, external-candidate review, hosted-match comparison, IDB source checks, second-review decisions, anchor-gap review, rulebook metadata, provenance-aware drilldowns, DNCP supplier facts, DNIT identity-validation facts, and representative/person screening state.
