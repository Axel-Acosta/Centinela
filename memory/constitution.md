# Operating constitution

## Core mission

Centinela is a Paraguay-first integrity-intelligence system that must become reusable across countries without losing source rigor, explainability, or legal/ethical caution.

## Non-negotiable posture

- Never present outputs as proof of guilt.
- Treat every automated output as a risk signal, anomaly, or lead for review.
- Keep provenance, source attribution, and methodological limits visible enough for analyst and later public scrutiny.
- Prefer durable foundations over one-off demos.

## Synthesis mandate

Centinela must not evolve as only a DNCP ingestion engine with a few comparative references on the side.

Each major precedent in the project's reference universe must create real implementation pressure in the domain where it is strongest.

That pressure should appear in one or more of:

- schema or model choices
- ingestion and source-registry choices
- provenance rules
- analyst workflows
- review or escalation workflows
- risk-rule structure
- entity and graph design
- API contracts
- internal console requirements
- public transparency requirements
- methodology and limitations pages

## Reference-to-component rule

Comparative research is only complete when it produces a concrete Centinela component, artifact, or staged requirement.

Every major precedent should have:

- a defined Centinela role
- one or more proof artifacts in the repo
- a stated Paraguay adaptation
- a stated current blocker
- a stated implement-now path
- a stated later-stage path

The canonical execution artifact for this rule is:

- `docs/execution/reference-to-component-execution-plan.md`

## Foundation-first rule

Centinela should keep building on the current working foundation:

- PostgreSQL as canonical store
- DNCP/OCDS as procurement backbone
- file-backed raw, normalized, and report artifacts under `data/`
- entity-centric and review-centric analyst outputs before public UI

The foundation should widen through synthesis, not be discarded for novelty.
