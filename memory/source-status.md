# Source status

## Paraguay

### DNCP open data / OCDS

- Status: active bulk-backed procurement backbone
- Access mode: official public API v3 and bulk annual OCDS ZIPs
- Why it matters: strongest available Paraguay-first procurement backbone
- Current implementation: live API sampling, annual bulk ZIP ingestion, normalization of processes/contracts/transactions, PostgreSQL loading, entity-source provenance, formal rule registry sync, review-queue generation, entity-level analyst briefs, rulebook methodology outputs, official release/document source-record checks for entity casework, and selected official document capture/text-extraction attempts
- Current loaded state: `py-dncp-bulk-2025` and `py-dncp-bulk-2026` are loaded in PostgreSQL
- Current observed scale after the rule-registry reload: 13,529 processes total, 41,009 contracts in 2025 alone, 9,964 matched signals across all active rules, and 7,351 flagged processes in the review queue
- Current release-source-check result: `py-dncp-release-source-check` persists official DNCP OCDS release packages and document metadata as source records for entity casework. Current live state is 4 release package records and 567 document metadata records across `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`.
- Current document-content result: `py-dncp-document-content` persists captured official DNCP documents and bounded extraction attempts as source records. Current live state is 2 captured official DNCP contract PDFs across `MENDEZ GONZALEZ FLORIANA *` and `CONSULTORA GUARANI SA INGENIEROS CIVILES`; both downloaded and hashed successfully, and both are `no_extractable_text` with the current local parser.
- Next expansion: supplier histories enriched with non-DNCP sources, broader high-priority DNCP release/document source checks, selective document-content capture/OCR where lawful and useful, formal DNCP crosswalk refinement, and deepening the local analyst workspace into saved case timelines for multi-year entity intelligence

### DNCP red flags

- Status: analyzed as local precedent
- Access mode: official public site and public red-flag pages
- Why it matters: local institutional legitimacy, terminology, and explainable indicator framing
- Current implementation pressure: active rule-registry language, DNCP alignment notes, and a first working crosswalk doc
- Next expansion: map public DNCP red flags and internal-style analogs more exactly into Centinela's formal rule registry and methodology pages

### DNCP supplier registry and sanctions search

- Status: active first local company/disqualification anchor
- Access mode: official public supplier CSV search, official supplier detail pages, and official sanctions CSV search
- Why it matters: strongest currently available lawful Paraguay company anchor from the loaded supplier universe, plus first live local administrative-risk layer
- Current implementation: `py-dncp-supplier-anchor` resolves procurement-linked supplier companies by RUC, stores official supplier profiles, adds RUC/provider-slug/DNCP-supplier-code identifiers as appropriate, creates representative links, persists DNCP amonestacion/inhabilitacion signals, supports incremental widening through unanchored-only batches, and now has bounded fallback search for messy local identity tails
- Current observed result: 2,534 procurement-linked supplier companies tracked; 2,521 official supplier matches stored; 446 supplier companies with local administrative signals; 3,642 representative links; 13 supplier companies remained unresolved by DNCP supplier search before the DNIT identity-validation pass
- Current anchor-gap surface: `centinela.entity_anchor_gap_review` and `npm run database:entity-anchor-gaps -- --limit 50`
- Next expansion: keep DNCP supplier status distinct from DNIT taxpayer identity validation, and continue improving disqualification/status context for companies that have identity validation but no supplier-registry profile

### Paraguay non-procurement integrity sources

- Status: mapped, first external connector and first local company/taxpayer identity anchors live
- Candidates: payroll and officials rosters, sanctions/disqualifications, company records, political finance, asset declarations, court and oversight records, external enrichment layers
- Next step: add ownership-ready or company-accountability sources where lawful access is clear. Until that access is clear, use official DNCP release/document source records as the strongest immediate document-linked accountability layer.

### DNIT / SET taxpayer-profile public services and RUC equivalence bulk

- Status: active for bulk RUC equivalence; human taxpayer-profile flows remain blocked
- Access mode: official public DNIT RUC equivalence bulk ZIPs for `ruc0.zip` through `ruc9.zip`; separate profile/constancia flows remain human-oriented
- Why it matters: strongest lawful Paraguay identity-validation layer found so far beyond DNCP supplier registration
- Current implementation: `py-dnit-ruc-equivalence` downloads the official bulk ZIP resources, parses RUC base/name/check-digit/equivalence/status rows, and persists only matches for procurement-linked supplier companies
- Current observed result: 2,534 procurement-linked supplier companies screened; 2,519 usable RUC targets; 2,518 DNIT identity profiles stored; 2,514 exact accepted matches; 4 reviewable base-only matches; 12 of the 13 previous local identity gaps resolved; 1 supplier remains unanchored because the procurement identifier lacks a check digit and did not resolve in the DNIT split
- Current final-gap check: `MENDEZ GONZALEZ FLORIANA *` still only has `PY-RUC-4070792`; DNIT bulk does not contain base `4070792`, the official DNCP OCDS release repeats the base-only identifier, DNCP supplier CSV checks for all ten possible check digits did not resolve a provider row, and the linked official PDFs were not text-extractable with the current local parser
- Current observed blocker: the public `perfilPublicoContribIService.do` and `constanciaRucIService.do` flows still appear human-oriented/reCAPTCHA-protected, so Centinela should not automate against them blindly
- Next step: recover the missing RUC check digit for `MENDEZ GONZALEZ FLORIANA *`, then rerun DNIT validation for the one remaining anchor gap

### OpenSanctions `default`

- Status: active first external-risk connector
- Access mode: public bulk dataset index and exports; hosted matching API currently authenticated
- Why it matters: first live sanctions/PEP/debarment/offshore screening path and first external entity-expansion path beyond procurement alone
- Current implementation: bulk `targets.simple.csv` screening against procurement-linked supplier companies and DNCP legal-representative person entities. Company screening uses procurement names, official DNCP/DNIT profile names, and comparable Paraguay RUC identifiers. Representative screening is separate. Accepted matches, review-only candidates, rejected diagnostics, and external risk signals are now stored separately.
- Current observed result: the candidate-aware rerun on May 1, 2026 screened 2,534 supplier companies and 3,165 DNCP legal representatives against 1,263,600 OpenSanctions target rows using index version `20260501065427-hyu`; it stored zero accepted bulk matches, 1 review-only candidate record, 57 rejected diagnostics, and zero external risk signals.
- Current candidate queue result: the only supplier-company review candidate remains `CONSULTORA GUARANI SA INGENIEROS CIVILES`, already accepted through second review as enrichment identity context. Weak two-token person overlaps remain rejected diagnostics, and generic company overlaps such as medical/supply-style matches are downgraded to a lower-confidence `company_generic_name_overlap_without_paraguay_support` diagnostic lane.
- Current candidate-scoring state: OpenSanctions evidence now stores distinctive shared tokens, generic shared tokens, distinctive-token overlap, and name-order score. The bulk refresh path preserves reviewed candidates and second-review audit trails instead of deleting reviewed rows during reruns.
- Current analyst surface: `npm run database:external-candidates -- --limit 80` generates `data/reports/paraguay/external-enrichment-candidate-review.md`, alongside candidate-aware entity dossiers and the entity intelligence queue.
- Current manual review workflow: `npm run database:review-external-candidate -- --candidate-id 59 --status needs_evidence --reviewer "Analyst Name" --notes "Review note"` updates candidate review state, reviewer metadata, notes, and review evidence without creating accepted matches.
- Current IDB source-check workflow: `npm run enrichment:idb-sanctions-candidate -- --candidate-id 59 --update-review true` retrieves official IDB Open Data row-level evidence for IADB/OpenSanctions candidates, persists the source row in `source_records`, and appends evidence history without creating accepted matches.
- Hosted API status: OpenSanctions confirmed Centinela is eligible and recommended a hosted API trial first. The first live hosted comparison pass is complete and stored in `data/reports/paraguay/opensanctions-hosted-match-comparison.md`, `centinela.entity_hosted_match_comparisons`, and `centinela.entity_hosted_match_comparison_overview`.
- Hosted comparison result: 31 local candidate/diagnostic entities compared; 8 same-candidate confirmations, 11 different-result alternatives, and 12 no-result cases. The strongest company-level hosted-supported lead is `CONSULTORA GUARANI SA INGENIEROS CIVILES`.
- Current observed blocker: a later rerun attempt with the current trial key returned OpenSanctions `429` monthly rate limiting, so fresh hosted calls are temporarily constrained even though the current stored comparison evidence remains usable.
- Current manual-review state: 58 OpenSanctions candidate/diagnostic records are visible in `centinela.entity_enrichment_candidate_review_overview`; candidate `59` has second-review decision `accepted_match`, 5 rows are `monitor`, 4 are `rejected`, and 48 remain `unreviewed` diagnostics.
- Current accepted external enrichment match: candidate `59`, `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles`, was accepted through second review on 2026-04-26. It has local DNCP/DNIT RUC evidence including `80016063-0`, official IDB row-level evidence, and hosted same-candidate support. The accepted match is enrichment identity context only, with the explicit limitation that the external source row does not expose a comparable RUC.
- Candidate `59` source-document status: official IDB Open Data row `76193` has been extracted and persisted under `ext-idb-sanctions-open-data`; local artifacts are `data/raw/external/idb/sanctioned-firms-individuals-candidate-59.json` and `data/reports/paraguay/idb-sanctions-candidate-59-source-check.md`.
- Second-review implementation status: migration `sql/postgres/015_external_candidate_second_review.sql` is applied in the live VPS database and command `npm run database:second-review-external-candidate` is operational.
- Second-review live result: second review ID `2`, accepted enrichment match ID `11`, accepted external entity ID `12431`, and zero `entity_external_risk_signals` created by the second-review workflow.
- Interpretation: the local identity bottleneck is much weaker now, exact matching is no longer the only output path, review state is operational, source-document evidence has been captured, and accepted-match governance is now live in code, schema, database, queue, and dossier outputs.
- Current casework status: source records, second reviews, accepted matches, evidence links, and public-safety review states can now be assembled into a saved case and exported as internal evidence bundles. Public-only export is gated by `approved_public` and remains non-accusatory. The CLI and local console/API can now write Markdown/JSON case evidence artifacts with a source-record index, source attachment manifests with source-run assets/source URLs/hashes/local path availability, local source bundles that copy resolvable source-run assets beside evidence and manifest files, source-document indexes with snippets, query matches, source-record IDs, and evidence-link IDs, and a lightweight runtime-folder artifact registry for rediscovering generated case packets.
- Next expansion: use the safer candidate-scoring baseline to add the next lawful Paraguay cross-domain source, preferably company/officer/ownership-adjacent accountability data if accessible. Keep the remaining `MENDEZ GONZALEZ FLORIANA *` RUC gap visible as a documented blocker unless a new lawful source exposes the check digit.
