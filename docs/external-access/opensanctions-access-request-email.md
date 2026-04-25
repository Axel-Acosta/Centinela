# OpenSanctions access request email

Subject: Access request for OpenSanctions API or hosted Yente matching endpoint

Hello,

I am developing Centinela, a public-integrity and corruption-risk research system focused on Paraguay. I am using it as part of my IB final monograph at Goethe Schule Asuncion, and the project is designed to use external risk data conservatively, transparently, and in a review-first manner. Although this began as part of my IB final monograph, I am developing it as a serious, practical public-integrity research system for Paraguay.

My main request is to obtain access to an authenticated OpenSanctions matching/search option so I can compare Centinela's local candidate scoring against your matcher, rather than relying solely on the public bulk files.

The ideal outcome would be access to either:

- a production OpenSanctions API key for matching/search, or
- a hosted Yente endpoint suitable for entity matching/search.

Our use case is limited to:

- sanctions, PEP, debarment, and external-risk screening
- review-only candidate comparison against our local scoring
- Paraguay public procurement and supplier/entity intelligence
- analyst review workflows where matches are treated as leads, not conclusions

We do not make automatic accusations, and weak matches are not promoted automatically. Centinela stores provenance, match method, confidence, rationale, and review status separately across accepted matches, review-only candidates, and rejected diagnostics.

Brief technical context:

- Stack: TypeScript/Node.js ingestion and enrichment pipelines, PostgreSQL 16 as the canonical database, and Markdown/JSON analyst outputs.
- Current data sources: Paraguay DNCP procurement/open-contracting data, DNCP supplier profile and sanctions/disqualification surfaces, DNIT RUC equivalence bulk files, and public OpenSanctions bulk data.
- Current screened population: about 2,500 Paraguay supplier/company entities and about 3,100 DNCP legal-representative/person entities.
- Expected initial usage: low to moderate. During testing, likely a few full screening runs over the current entity population, then mostly incremental checks. A rough initial estimate would be under 25,000 match/search requests per month unless your recommended integration pattern is different.
- Data handling: results are used for internal review and methodology validation. We do not use OpenSanctions results for automatic adverse decisions. We can follow your requirements for attribution, caching, retention, privacy, and response storage.
- Timeline: I would like to begin integration within the next 1 to 2 weeks if access is possible. There is no immediate public launch deadline; the first phase is internal validation and review workflow improvement.

Would you kindly let me know:

1. whether this use case is eligible for access,
2. whether you recommend the API or hosted Yente for it,
3. pricing or access requirements,
4. authentication method,
5. recommended base URL/endpoints,
6. rate limits and usage guidance,
7. whether batch matching is supported or recommended.

Primary technical contact:

- Name: Axel Acosta
- Role: Project lead / technical owner for Centinela
- Email: axel.d.acosta.d@gmail.com
- Location/time zone: Paraguay / America-Asuncion

If it helps, I can also provide a short private technical summary of Centinela's architecture and review workflow.

Thank you very much.

With best regards,

Axel Acosta  
Centinela  
axel.d.acosta.d@gmail.com
