# OpenSanctions hosted API trial integration

## Purpose

OpenSanctions confirmed that Centinela's use case is eligible and recommended starting with the hosted API during the 30-day trial.

Centinela's first hosted integration is a comparison lane, not a production promotion lane.

It compares the authenticated OpenSanctions/Yente matcher against Centinela's local review-only candidates and rejected diagnostics. It does not create accepted matches, risk signals, accusations, or automatic adverse decisions.

## Official guidance received

- Start with the hosted API during the trial.
- Use self-hosted Yente later if volume, sovereignty, cost, or independence needs justify managing local infrastructure and data updates.
- For matching, use `POST /match/{dataset}` with `algorithm=logic-v2`.
- Hosted API authentication uses an API key. The official docs show `Authorization: ApiKey <key>` or `api_key` as a query parameter; Centinela uses the header.
- Dataset scoping matters. The `default` dataset is the recommended full OpenSanctions scope when unsure.

Reference links:

- API signup: https://www.opensanctions.org/api/
- Matching API: https://www.opensanctions.org/docs/api/matching/
- Authentication: https://www.opensanctions.org/docs/api/authentication/
- Scoping: https://www.opensanctions.org/docs/api/scoping/
- Scoring: https://www.opensanctions.org/docs/api/scoring/
- Yente self-hosting: https://yente.followthemoney.tech/

## Current implementation

Command:

```bash
npm run enrichment:opensanctions-hosted-match -- --dry-run true --limit 25 --batch-size 10
```

Real hosted call after the trial key is available:

```bash
npm run enrichment:opensanctions-hosted-match -- --limit 25 --batch-size 10
```

Environment variables:

```env
OPENSANCTIONS_API_BASE_URL=https://api.opensanctions.org
OPENSANCTIONS_API_KEY=
OPENSANCTIONS_MATCH_DATASET=default
OPENSANCTIONS_MATCH_ALGORITHM=logic-v2
OPENSANCTIONS_MATCH_THRESHOLD=0.7
OPENSANCTIONS_MATCH_RESULT_LIMIT=5
```

Outputs:

- `data/normalized/paraguay/opensanctions-hosted-match-comparison.json`
- `data/reports/paraguay/opensanctions-hosted-match-comparison.md`
- `centinela.entity_hosted_match_comparisons`
- `centinela.entity_hosted_match_comparison_overview`

## Query construction

The first hosted comparison lane queries the current `entity_enrichment_candidate_overview` population, not the entire supplier universe.

This makes the trial small and review-focused:

- current review-only company candidates
- current rejected company diagnostics
- current representative/person diagnostics

For companies:

- schema: `Company`
- properties:
  - `name`
  - `country=py`
  - `jurisdiction=py`
  - `registrationNumber` from comparable Paraguay RUC identifiers

For DNCP legal representatives:

- schema: `Person`
- properties:
  - `name`

Centinela does not assert nationality for DNCP legal representatives because representative text alone does not prove nationality.

## Interpretation rules

- Hosted scores are comparison evidence only.
- Hosted results do not automatically become accepted matches.
- Hosted results do not automatically become external risk signals.
- Any disagreement between local scoring and hosted scoring must be resolved through review status, source documents, identifiers, and methodology notes.
- Candidate promotion should wait for the manual review workflow for `entity_enrichment_candidates`.

## Hosted API vs self-hosted Yente

Hosted API is the current best next step because:

- no infrastructure setup is required;
- OpenSanctions keeps the index up to date;
- trial usage can reveal actual volume;
- Centinela is still validating methodology and review workflows.

Self-hosted Yente becomes more attractive when:

- screening becomes high-volume or frequent;
- data sovereignty becomes a hard requirement;
- Centinela needs local update scheduling and no external API dependency;
- API cost or rate limits become constraining.

## Current live result

- Live comparison run completed on `2026-04-23` against the current 31-entity candidate/diagnostic population.
- Local entities compared: `31`
- Request batches: `3`
- Entities with hosted results above threshold: `19`
- Same-candidate confirmations: `8`
- Different-result alternatives: `11`
- No-result cases: `12`
- Strongest company-level confirmation: `CONSULTORA GUARANI SA INGENIEROS CIVILES` -> `Consultora Guaraní S.A. Ingenieros Civiles` with score `1.0` in `iadb_sanctions`
- Current company-level hosted alternative cases: `BLUE OCEAN COMPANY S.A.` and `CONSORCIO SANTA LUCIA`

## Current workflow impact

- The hosted comparison is now persisted into PostgreSQL and reused by:
  - `data/reports/paraguay/all-entities-intelligence-queue.md`
  - `data/reports/paraguay/external-enrichment-candidate-review.md`
  - entity briefs under `data/reports/paraguay/entities/`
- Manual review state is now persisted through `centinela.entity_enrichment_candidates` and exposed by `centinela.entity_enrichment_candidate_review_overview`.
- Hosted comparison evidence remains review-only. It does not create accepted matches or external risk signals automatically.
- The main practical value is now investigator prioritization:
  - `same_local_candidate` raises confidence that a local review candidate deserves closer analyst attention
  - `different_hosted_result` often reveals broad-name ambiguity and argues against automatic promotion
  - `no_hosted_result` weakens already-thin name-only leads
- The first live manual-review workflow uses hosted evidence to suggest next action:
  - the current high-priority company lead, `CONSULTORA GUARANI SA INGENIEROS CIVILES`, is suggested as `needs_evidence`
  - representative/person diagnostics with hosted same-candidate evidence remain diagnostic unless Paraguay support, source documents, or stronger identity evidence justifies escalation

## Current blocker

- A later rerun attempt on `2026-04-23` hit `429` monthly rate limiting for the current trial key.
- Centinela therefore imported the already-obtained live comparison artifact into PostgreSQL instead of discarding the evidence or pretending to rerun it.

## Next step

1. Use the new manual review command to classify the current high-priority company candidate and the strongest representative diagnostics without creating accepted matches.
2. Use hosted same-candidate confirmation as stronger review evidence, not as an auto-promotion trigger.
3. Improve local person/company evidence before widening matching:
   - local identifiers
   - source documents
   - stronger name-order logic
   - explicit reviewer decisions
4. If hosted reruns are needed before the monthly limit resets, ask OpenSanctions about higher trial limits or longer-term access.
5. Revisit self-hosted Yente only if volume, sovereignty, or rate-limit pressure makes it clearly worthwhile.
