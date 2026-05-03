# Next steps

1. Treat candidate `59` as the first live second-review accepted enrichment match:
   second review ID `2`, accepted match ID `11`, external entity ID `12431`, and zero second-review-created external risk signals.
2. Use the DNCP release source-check lane as the first official document-linked entity evidence expansion:
   `npm run enrichment:dncp-release-source-check -- --entity-name "Entity Name" --limit 5` fetches official DNCP OCDS release packages for already-linked processes, persists `ocds_release_package` and `ocds_document_metadata` source records, and upgrades entity briefs through the `Official source records and documents` section.
3. Current DNCP release source-check live state:
   `py-dncp-release-source-check` has 4 official release package records and 567 official document metadata records across `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`.
4. Use the local internal API/console as the next operational surface:
   `npm run serve:internal-console -- --host 127.0.0.1 --port 8787` exposes overview, entity search, entity dossiers, graph-ready neighborhoods, graph export, source-record drilldowns, entity/process queues, external candidates, accepted matches, and token-protected analyst notes/cases from the live database.
5. Keep accepted matches, external risk signals, review-only candidates, and public-facing language separate:
   `promotable` means ready for stronger second review, not accepted identity resolution or proof of wrongdoing.
6. Build on the live case timeline/workbench:
   evidence links now connect source records, optional notes, targets, field paths, explanations, limitations, and evidence roles; source-record search inside cases and field-path helpers are also live.
7. Extend analyst outputs/API requirements around candidate review:
   expose source-record evidence, review evidence history, local DNCP/DNIT identifiers, hosted comparison support, second-review status, rationale, limitations, accepted-match IDs, relationship pivots, evidence links, and case timeline context together.
8. Use the live case evidence export and public-safety review gate:
   migration `019` is applied, `GET /api/analyst-cases/:id/evidence-export` packages source-backed evidence, `POST /api/analyst-cases/:id/public-review` records append-only safety review state, and `public_only=true` is blocked unless the latest status is `approved_public`.
9. Use the case evidence export artifact command:
   `npm run database:case-evidence-export -- --case-id <id> --public-only false` writes Markdown and JSON artifacts under the local non-sync runtime folder with a source-record index; `--public-only true` still requires the case's latest public-safety review state to be `approved_public`.
10. Use the source attachment manifest command as the next casework evidence layer:
   `npm run database:case-source-manifest -- --case-id <id> --public-only false` writes Markdown and JSON manifests that list linked source records, source-run assets, source URLs, hashes, local path availability, and payload previews under the local non-sync runtime folder; `--public-only true` still requires `approved_public`.
11. Use the case source bundle command as the first downloadable local case packet:
   `npm run database:case-source-bundle -- --case-id <id> --public-only false --copy-assets true` writes a local runtime bundle with evidence JSON/Markdown, source manifest JSON/Markdown, `bundle-index.json`, `README.md`, and copied source-run assets where local paths can be resolved.
12. Use the case source index command as the first searchable bundle layer:
   `npm run database:case-source-index -- --bundle-path <bundle-path> --query "Consultora Guarani"` refreshes `source-document-index.json`, `source-document-index.md`, and `source-document-index.jsonl` for an existing source bundle and shows document/query matches with source-record and evidence-link traceability.
13. Use the local console/API artifact controls:
   `POST /api/analyst-cases/:id/evidence-artifacts`, `/source-manifests`, `/source-bundles`, and `POST /api/source-document-indexes` are live behind the local write token; the case workbench now has buttons to write evidence artifacts, source manifests, source bundles, and query-aware source indexes without manually running CLI commands.
14. Use the lightweight case artifact registry:
   `GET /api/analyst-cases/:id/artifacts` is live and scans the local runtime case folder for evidence artifacts, source manifests, source bundles, and source-document index summaries; the case workbench can load generated artifacts after the initial creation response is gone.
15. Treat the OpenSanctions bulk rerun path as governance-safe:
   reviewed candidates and second-review audit trails are now preserved across reruns; future reruns should verify candidate `59` still keeps accepted match ID `11`.
16. Use the improved OpenSanctions candidate evidence:
   reports now expose distinctive shared tokens, generic shared tokens, distinctive-token overlap, and name-order score. Generic company overlaps without Paraguay support should remain low-confidence diagnostics, not review leads.
17. Keep the last local identity anchor gap visible as a documented blocker:
   `MENDEZ GONZALEZ FLORIANA *` has only `PY-RUC-4070792`; DNIT bulk, DNCP OCDS JSON, DNCP supplier CSV check-digit probes, and locally parsed official PDFs did not recover a complete RUC. Revisit only when a new lawful Paraguay identity source is available.
18. Move to the next intelligence source:
   add the next lawful Paraguay cross-domain company/accountability source, preferably ownership/officer/registry-adjacent data if accessible. If that remains blocked, widen `py-dncp-release-source-check` over the highest-priority companies/candidates and add document-content extraction for selected official PDFs.
19. Keep the DNCP legal-representative/person screening lane active, but preserve weak person-name overlaps as rejected diagnostics unless exact person-name agreement, stronger multi-token evidence, hosted matcher evidence, or source documents justify review escalation.
20. Ask OpenSanctions about higher trial limits or longer-term access if another hosted rerun is needed before the monthly quota resets; otherwise continue using the already-stored hosted comparison evidence.
21. Refine the DNCP-to-Centinela crosswalk with the best available local public red-flag descriptions and terminology.
22. Use the current progress estimate as the planning baseline:
   `docs/execution/progress-and-remaining-work.md` estimates the current analyst/casework phase needs about 1-2 more focused runs, the first serious Paraguay internal MVP needs about 6-10 more focused implementation runs, and the public pilot remains a later phase after methodology, privacy, UX, auth, and deployment work.
