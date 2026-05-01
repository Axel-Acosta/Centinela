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
8. Use the source attachment manifest command as the next casework evidence layer:
   `npm run database:case-source-manifest -- --case-id <id> --public-only false` writes Markdown and JSON manifests that list linked source records, source-run assets, source URLs, hashes, local path availability, and payload previews under the local non-sync runtime folder; `--public-only true` still requires `approved_public`.
9. Use the case source bundle command as the first downloadable local case packet:
   `npm run database:case-source-bundle -- --case-id <id> --public-only false --copy-assets true` writes a local runtime bundle with evidence JSON/Markdown, source manifest JSON/Markdown, `bundle-index.json`, `README.md`, and copied source-run assets where local paths can be resolved.
10. Use the case source index command as the first searchable bundle layer:
   `npm run database:case-source-index -- --bundle-path <bundle-path> --query "Consultora Guarani"` refreshes `source-document-index.json`, `source-document-index.md`, and `source-document-index.jsonl` for an existing source bundle and shows document/query matches with source-record and evidence-link traceability.
11. Use the local console/API artifact controls:
   `POST /api/analyst-cases/:id/evidence-artifacts`, `/source-manifests`, `/source-bundles`, and `POST /api/source-document-indexes` are live behind the local write token; the case workbench now has buttons to write evidence artifacts, source manifests, source bundles, and query-aware source indexes without manually running CLI commands.
12. Use the lightweight case artifact registry:
   `GET /api/analyst-cases/:id/artifacts` is live and scans the local runtime case folder for evidence artifacts, source manifests, source bundles, and source-document index summaries; the case workbench can load generated artifacts after the initial creation response is gone.
13. Choose between one more casework polish step and the next intelligence step:
   add bounded artifact-detail reading for selected bundle/index files only if needed; otherwise return to stronger OpenSanctions candidate scoring, the final RUC anchor gap, and the next lawful Paraguay cross-domain source.
14. Improve OpenSanctions candidate scoring before any broader matching:
   add stronger name-order scoring, source-document evidence scoring, local identifier comparison where external identifiers exist, and explicit handling for generic business terms.
15. Resolve the last remaining local identity anchor gap:
   `MENDEZ GONZALEZ FLORIANA *` has `PY-RUC-4070792` without a check digit, so recover the complete RUC from DNCP source records, official documents, or another lawful Paraguay identity source before rerunning DNIT validation.
16. Keep the DNCP legal-representative/person screening lane active, but preserve weak person-name overlaps as rejected diagnostics unless exact person-name agreement, stronger multi-token evidence, hosted matcher evidence, or source documents justify review escalation.
17. Ask OpenSanctions about higher trial limits or longer-term access if another hosted rerun is needed before the monthly quota resets; otherwise continue using the already-stored hosted comparison evidence.
18. Refine the DNCP-to-Centinela crosswalk with the best available local public red-flag descriptions and terminology.
19. Use the current progress estimate as the planning baseline:
   `docs/execution/progress-and-remaining-work.md` estimates the current analyst/casework phase needs about 1-2 more focused runs, the first serious Paraguay internal MVP needs about 6-10 more focused implementation runs, and the public pilot remains a later phase after methodology, privacy, UX, auth, and deployment work.
