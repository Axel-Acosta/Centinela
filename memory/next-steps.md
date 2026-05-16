# Next steps

1. Treat candidate `59` as the first live second-review accepted enrichment match:
   second review ID `2`, accepted match ID `11`, external entity ID `12431`, and zero second-review-created external risk signals.
2. Use the DNCP release source-check lane as the first official document-linked entity evidence expansion:
   `npm run enrichment:dncp-release-source-check -- --entity-name "Entity Name" --limit 5` fetches official DNCP OCDS release packages for already-linked processes, persists `ocds_release_package` and `ocds_document_metadata` source records, and upgrades entity briefs through the `Official source records and documents` section.
3. Current DNCP release source-check live state:
   `py-dncp-release-source-check` has 10 official release package records and 1,462 official document metadata records across `MENDEZ GONZALEZ FLORIANA *`, `CONSULTORA GUARANI SA INGENIEROS CIVILES`, `PROSALUDFARMA S.A.`, `INDEX S.A.C.I.`, and `QUIMFA S.A.`.
4. Use the local internal API/console as the next operational surface:
   `npm run serve:internal-console -- --host 127.0.0.1 --port 8787` exposes overview, entity search, product-style entity dossiers, graph-ready neighborhoods with relation/type filters, graph export, source-record drilldowns, entity/process queues, external candidates, accepted matches, source-pack showcase, readable case review packets, artifact/source-document match previews, artifact/source verification checks, methodology/limits/publication-safety guidance, source-pack case shortcuts, case/source-pack workspace, and token-protected analyst notes/cases from the live database.
   Use `npm run smoke:command-center` to validate the main local console/API paths against the live DB.
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
15. Use the entity source-pack workflow for high-priority dossiers:
   `npm run database:entity-source-pack -- --entity-name "Entity Name" --source-record-limit 10 --source-index-query "search terms"` creates/reuses an analyst case, links entity source records, creates source-record evidence links, and writes evidence artifacts, source manifests, source bundles, and source-document indexes in one command. The same workflow is now available from the local API/console through `POST /api/entities/:id/source-packs` and the case workbench preview/write buttons.
16. Use the entity source-pack readiness report before widening:
   `npm run database:entity-source-pack-readiness -- --limit 25 --source-record-limit 10` ranks company entities by live queue priority and source-pack coverage, then recommends `run_dncp_release_source_check`, `build_entity_source_pack`, `consider_selective_document_content_capture`, `ready_for_internal_review`, or `ready_for_internal_review_with_document_download_limits`.
17. Treat the OpenSanctions bulk rerun path as governance-safe:
   reviewed candidates and second-review audit trails are now preserved across reruns; future reruns should verify candidate `59` still keeps accepted match ID `11`.
18. Use the improved OpenSanctions candidate evidence:
   reports now expose distinctive shared tokens, generic shared tokens, distinctive-token overlap, and name-order score. Generic company overlaps without Paraguay support should remain low-confidence diagnostics, not review leads.
19. Keep the last local identity anchor gap visible as a documented blocker:
   `MENDEZ GONZALEZ FLORIANA *` has only `PY-RUC-4070792`; DNIT bulk, DNCP OCDS JSON, DNCP supplier CSV check-digit probes, and locally parsed official PDFs did not recover a complete RUC. Revisit only when a new lawful Paraguay identity source is available.
20. Move to the next intelligence source:
   the first ownership-ready source is now live: `npm run enrichment:abogacia-beneficial-ownership-public-index` parsed 31,649 Abogacia public company-index rows and matched 899 procurement-linked companies by RUC base in source run `49`.
   The privacy-safe person-relationship staging lane is now live and widened: migration `020` plus review-governance migration `021` are applied, and source runs `53`, `54`, and `55` widened staging to all `1,776` procurement-linked redacted rows currently found by RUC base: `729` beneficial-owner leads, `749` director leads, and `298` shareholder leads.
21. Keep the DNCP legal-representative/person screening lane active, but preserve weak person-name overlaps as rejected diagnostics unless exact person-name agreement, stronger multi-token evidence, hosted matcher evidence, or source documents justify review escalation.
22. Ask OpenSanctions about higher trial limits or longer-term access if another hosted rerun is needed before the monthly quota resets; otherwise continue using the already-stored hosted comparison evidence.
23. Refine the DNCP-to-Centinela crosswalk with the best available local public red-flag descriptions and terminology.
24. Use the current progress estimate as the planning baseline:
   `docs/execution/progress-and-remaining-work.md` and `docs/execution/internal-mvp-finish-plan.md` now mark the first serious Paraguay internal MVP as useful enough for internal review, demonstration, and focused casework. Future work should be triggered by a concrete source, case, public-safety, deployment, or UI need rather than broad foundation-building momentum.
25. Use the DNCP document-content capture lane for selected official documents:
   `npm run enrichment:dncp-document-content -- --entity-name "Entity Name" --query "contrato" --limit 2` starts from persisted DNCP document metadata, downloads official document files when available, stores SHA-256 hashes/source assets when downloaded, attempts bounded text extraction, and persists `document_content_extract` source records. Current live state is 8 document-content records: 2 earlier captured official DNCP contract PDFs with `no_extractable_text`, plus 6 priority-company contract attempts where DNCP returned `404` and the limitation is preserved in case evidence.
26. Next best source-document move:
   do not add OCR for the latest three priority companies yet because selected DNCP contract URLs returned `404`; instead investigate alternate lawful DNCP document access only if those source packs become case-priority, or continue source-pack readiness rollout over the next ranked companies.
27. Next best product-interface move:
   only add targeted interface fixes if they unblock analysis; artifact/source verification checks, the guided proof path, `.impeccable.md`, `PRODUCT.md`, `DESIGN.md`, the project-local `impeccable` skill, and `npm run smoke:command-center` are now live.
28. Treat the 2026-05-12 Command Center as the first presentable local/internal product surface:
   it is strong enough to show the platform concept internally, now includes graph/artifact/readiness exploration, case review packets, source-document match previews, artifact/source verification checks, a guided evidence trail for Consultora Guarani/case 20, methodology/limits/publication-safety guidance, source-pack case shortcuts, and a repeatable smoke harness, but it is not a public launch surface and still needs production auth, privacy review, public-safe copy, and methodology pages before any public exposure.
29. Treat Abogacia person-level data as review-only:
   directors, shareholders, and beneficial-owner CSVs are publicly discoverable, but they include personal fields. Centinela may use the staging lane only under the documented minimization boundary: redacted display, one-way name hash, source row hash, no raw person names, no document/address fields, `blocked_personal_data`, and no non-redacted public display without separate governance.
30. Use the installed project-local `impeccable` skill before substantial product-surface work:
   load `PRODUCT.md` and `DESIGN.md` with `.agents/skills/impeccable/scripts/load-context.mjs`, then apply the product register. The active standard is dossier before dashboard, evidence trail over spectacle, review-first language, progressive disclosure, no fake proof, source-grounded humility, OKLCH/tinted-neutral design tokens, visible focus states, no thick side-stripe accents, no gradient text, no decorative glass blur, and product polish only where it clarifies real workflow.
31. Next best backend move after the first Abogacia staging pilot:
   the staging pilot is complete and widened. Use `npm run database:staged-relationships -- --limit 50` for the review queue and `npm run database:review-staged-relationship -- --staging-id <id> --decision needs_more_evidence|keep_staged|rejected|promote_to_redacted_relationship --reviewer "Name" --rationale "Source-backed rationale" --limitations "Known limits"` for governance. Promotion creates only a redacted internal graph placeholder and stays non-public by default.
32. Internal MVP stop rule:
   do not keep adding broad framework layers by default. Next work should start from a specific high-value question: review a priority staged relationship, improve a source pack, add a named Paraguay source, harden deployment/auth, or prepare public methodology/privacy review.
33. Public web surface:
   the first separate public-safe web surface is now implemented through `npm run serve:public-web -- --host 127.0.0.1 --port 8788`, with sanitized read-only endpoints under `/api/public/*`, a country-level risk-rule lens, public-safe company search, a company evidence profile, methodology boundaries, and a future verified-transparency-profile explanation. This is deliberately not the internal Command Center and must not expose analyst write routes, raw local artifact paths, private notes, or person-level staged relationship rows.
34. Public web deployment target:
   first target is `https://centinela.acostadom.space/` through Caddy reverse proxy to a `centinela-public` container on the VPS. Keep this as a public pilot surface until methodology, privacy, legal, monitoring, and source-redistribution reviews are stronger.
35. Public risk-story layer:
   the public site now has a concrete public-friendly risk explanation model: country risk story, institution/buyer search, company search, and company/institution profiles with `review intensity`. This is a triage label based on public-record signals, flagged-process share, source-pack context, and accepted identity context. It must never be described as a corruption score, legal conclusion, guilt claim, or proof of integrity.
36. Next public usefulness move:
   improve the public methodology page and add a public-safe sector/service-outcome explanation before using Centinela to discuss public-service deficiency. Procurement risk signals alone are not causal evidence that corruption caused service failure.
