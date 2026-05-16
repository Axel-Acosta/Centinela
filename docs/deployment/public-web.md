# Public web surface

Centinela now has a separate public web surface.

It is intentionally not the internal Command Center.

## Purpose

The public web surface gives a public-safe explanation of Centinela and a read-only view over selected live database summaries:

- Paraguay country procurement snapshot
- country-level public risk story
- high-signal buyer/institution lens
- explainable procurement risk-rule coverage
- public-safe company search
- one company profile with procurement signals, identity anchors, source context, source-pack status, and limitations
- methodology boundaries and future transparency-profile direction

Every page and API response keeps the same boundary:

Centinela shows public-record risk signals, source context, and leads for review. It does not prove wrongdoing, corruption, legal liability, or integrity.

## Command

Local:

```bash
npm run serve:public-web -- --host 127.0.0.1 --port 8788
```

Remote/container:

```bash
node dist/cli.js serve public-web --host 0.0.0.0 --port 8788
```

Smoke test:

```bash
npm run smoke:public-web
```

## Public endpoints

- `GET /`
  - public web page
- `GET /healthz`
  - lightweight service health
- `GET /api/public/overview`
  - public-safe counts, rule coverage, source coverage, and company risk lens
- `GET /api/public/risk-story`
  - public-safe country story with top rule, institution lens, company lens, and limitations
- `GET /api/public/institutions?q=<text>&limit=8`
  - public-safe buyer/institution search
- `GET /api/public/entities?q=<text>&limit=8`
  - public-safe company search
- `GET /api/public/entities/:id`
  - public-safe company or institution profile

## Public risk story model

The public site now has one concrete public-friendly way to show corruption-risk context:

- Country level:
  - counts public procurement processes, contracts, signals, rules, identity profiles, and source records
  - shows the most common active procurement signal
  - shows high-signal institution and company examples
  - explains that counts are review leads and must be compared with procurement volume
- Institution level:
  - shows buyer-process count, flagged-process count, risk-signal count, contract value, rule families, and review intensity
  - warns that large institutions can trigger more signals because they buy more
- Company level:
  - shows supplier procurement activity, risk-signal families, identity anchors, accepted identity context, source mentions, source-pack status, and private relationship-lead counts without exposing person-level rows

The visible label is `review intensity`, not `corruption score`.

Review intensity is a triage label based on linked public-record signals. It is not a legal conclusion, guilt claim, or integrity certificate.

## Deliberately not exposed

- analyst write routes
- internal notes
- raw local artifacts
- local file paths
- person-level staged relationship rows
- document numbers, addresses, phone numbers, emails, or raw person names from relationship staging
- public claims of guilt, corruption, legal liability, hidden ownership, or integrity

## Deployment target

The first remote target is:

```text
https://centinela.acostadom.space/
```

The expected reverse proxy shape is:

```text
centinela.acostadom.space -> Caddy -> centinela-public:8788
```

The public container should join the VPS `services_web` and `services_internal` Docker networks so it can receive HTTPS traffic from Caddy and reach the existing PostgreSQL container on the internal network.

## Current public-product status

This is a public web pilot, not a final public launch.

Before wider promotion, Centinela still needs:

- public methodology page expansion
- privacy and legal review
- source licensing and redistribution review
- monitoring and backup policy
- abuse/rate-limit hardening beyond the current lightweight in-memory limiter
- a formal policy for any future transparency profile, seal, or review package
- sector/service-outcome context if Centinela is used to discuss public-service deficiency rather than only procurement integrity
