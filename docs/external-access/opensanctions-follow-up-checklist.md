# OpenSanctions/Yente follow-up checklist

## Before sending

- Use `opensanctions-access-request-email.md` as the message body.
- Attach or offer `centinela-private-technical-summary.md` only if useful.
- Do not share repo secrets, VPS credentials, `.env` files, or raw local database access.

## If OpenSanctions asks for expected volume

Suggested answer:

Centinela's current screened population is about 2,534 supplier/company entities and 3,165 DNCP legal-representative/person entities. During initial integration, expected use is a few full test runs plus incremental checks, likely under 25,000 match/search requests per month unless OpenSanctions recommends a different batch workflow.

## If OpenSanctions asks for integration language/framework

Suggested answer:

Centinela uses TypeScript/Node.js for ingestion and enrichment pipelines, PostgreSQL 16 for storage, and SQL-backed review/reporting views. The API or Yente endpoint would be called from the existing TypeScript enrichment pipeline.

## If OpenSanctions asks about privacy/data handling

Suggested answer:

Centinela stores provenance, match method, confidence, rationale, and review status. It separates accepted matches, review-only candidates, and rejected diagnostics. It does not use OpenSanctions results for automatic adverse decisions and does not treat name-only matches as proof. It can comply with OpenSanctions' attribution, caching, retention, privacy, and raw-response storage requirements.

## If access is granted

Add credentials only to local/private environment storage:

- `OPENSANCTIONS_API_KEY`
- `OPENSANCTIONS_API_BASE_URL`
- `YENTE_BASE_URL`
- `YENTE_API_KEY`

Do not commit real values.

## First implementation after access

1. Add `OPENSANCTIONS_API_KEY` to local/private environment storage.
2. Run `npm run enrichment:opensanctions-hosted-match -- --limit 25 --batch-size 10`.
3. Review `data/reports/paraguay/opensanctions-hosted-match-comparison.md`.
4. Compare hosted/Yente scores against existing local candidate scores.
5. Do not promote any candidate automatically.
6. Update methodology docs with authentication, endpoint, rate-limit, and data-handling constraints.

## Current response from OpenSanctions

- Centinela's use case is eligible.
- Recommended first step: hosted API trial.
- Matching endpoint: `POST /match/{dataset}` with `algorithm=logic-v2`.
- Hosted API is best for moderate analyst-triggered use.
- Self-hosted Yente is better if screening becomes high-volume, frequent, or requires full data sovereignty.

## Current implementation status

- Hosted API comparison scaffold exists: `npm run enrichment:opensanctions-hosted-match`.
- Dry-run mode works without a key: `npm run enrichment:opensanctions-hosted-match -- --dry-run true --limit 25 --batch-size 10`.
- Dry-run output exists at `data/reports/paraguay/opensanctions-hosted-match-comparison.md`.
