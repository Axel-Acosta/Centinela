# Next steps

1. Treat candidate `59` as the first live second-review accepted enrichment match:
   second review ID `2`, accepted match ID `11`, external entity ID `12431`, and zero second-review-created external risk signals.
2. Use the local internal API/console as the next operational surface:
   `npm run serve:internal-console -- --host 127.0.0.1 --port 8787` exposes overview, entity search, entity dossiers, graph-ready neighborhoods, graph export, source-record drilldowns, entity/process queues, external candidates, accepted matches, and token-protected analyst notes/cases from the live database.
3. Keep accepted matches, external risk signals, review-only candidates, and public-facing language separate:
   `promotable` means ready for stronger second review, not accepted identity resolution or proof of wrongdoing.
4. Build on the live case timeline/workbench:
   evidence links now connect source records, optional notes, targets, field paths, explanations, limitations, and evidence roles; source-record search inside cases and field-path helpers are also live.
5. Extend analyst outputs/API requirements around candidate review:
   expose source-record evidence, review evidence history, local DNCP/DNIT identifiers, hosted comparison support, second-review status, rationale, limitations, accepted-match IDs, relationship pivots, evidence links, and case timeline context together.
6. Use the live case evidence export and public-safety review gate:
   migration `019` is applied, `GET /api/analyst-cases/:id/evidence-export` packages source-backed evidence, `POST /api/analyst-cases/:id/public-review` records append-only safety review state, and `public_only=true` is blocked unless the latest status is `approved_public`.
7. Use the case evidence export artifact command:
   `npm run database:case-evidence-export -- --case-id <id> --public-only false` writes Markdown and JSON artifacts under the local non-sync runtime folder with a source-record index; `--public-only true` still requires the case's latest public-safety review state to be `approved_public`.
8. Add the next document/source evidence ergonomic:
   build either a lightweight source-document index, source-record attachment manifest, or downloadable case bundle that can include linked source files and not only Markdown/JSON summaries.
9. Improve OpenSanctions candidate scoring before any broader matching:
   add stronger name-order scoring, source-document evidence scoring, local identifier comparison where external identifiers exist, and explicit handling for generic business terms.
10. Resolve the last remaining local identity anchor gap:
   `MENDEZ GONZALEZ FLORIANA *` has `PY-RUC-4070792` without a check digit, so recover the complete RUC from DNCP source records, official documents, or another lawful Paraguay identity source before rerunning DNIT validation.
11. Keep the DNCP legal-representative/person screening lane active, but preserve weak person-name overlaps as rejected diagnostics unless exact person-name agreement, stronger multi-token evidence, hosted matcher evidence, or source documents justify review escalation.
12. Ask OpenSanctions about higher trial limits or longer-term access if another hosted rerun is needed before the monthly quota resets; otherwise continue using the already-stored hosted comparison evidence.
13. Refine the DNCP-to-Centinela crosswalk with the best available local public red-flag descriptions and terminology.
