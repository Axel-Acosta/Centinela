# Next steps

1. Treat candidate `59` as the first live second-review accepted enrichment match:
   second review ID `2`, accepted match ID `11`, external entity ID `12431`, and zero second-review-created external risk signals.
2. Use the local internal API/console as the next operational surface:
   `npm run serve:internal-console -- --host 127.0.0.1 --port 8787` exposes overview, entity search, entity dossiers, graph-ready neighborhoods, entity/process queues, external candidates, and accepted matches from the live database.
3. Keep accepted matches, external risk signals, review-only candidates, and public-facing language separate:
   `promotable` means ready for stronger second review, not accepted identity resolution or proof of wrongdoing.
4. Harden the internal API/console into a first analyst workspace:
   add saved review notes, source-record drilldowns, second-review history views, graph export, field-level methodology explanations, and safe local authentication before any remote exposure.
5. Extend analyst outputs/API requirements around candidate review:
   expose source-record evidence, review evidence history, local DNCP/DNIT identifiers, hosted comparison support, second-review status, rationale, limitations, accepted-match IDs, and relationship pivots together.
6. Improve OpenSanctions candidate scoring before any broader matching:
   add stronger name-order scoring, source-document evidence scoring, local identifier comparison where external identifiers exist, and explicit handling for generic business terms.
7. Resolve the last remaining local identity anchor gap:
   `MENDEZ GONZALEZ FLORIANA *` has `PY-RUC-4070792` without a check digit, so recover the complete RUC from DNCP source records, official documents, or another lawful Paraguay identity source before rerunning DNIT validation.
8. Keep the DNCP legal-representative/person screening lane active, but preserve weak person-name overlaps as rejected diagnostics unless exact person-name agreement, stronger multi-token evidence, hosted matcher evidence, or source documents justify review escalation.
9. Ask OpenSanctions about higher trial limits or longer-term access if another hosted rerun is needed before the monthly quota resets; otherwise continue using the already-stored hosted comparison evidence.
10. Refine the DNCP-to-Centinela crosswalk with the best available local public red-flag descriptions and terminology.
