---
name: integrity-intelligence-operator
description: Build, extend, and operate the Centinela public-integrity intelligence system. Use when Codex needs to collect project context, update durable project memory, analyze corruption-risk or procurement-intelligence references, ingest or normalize Paraguay public data, design explainable risk signals, link entities across datasets, or prepare the system for analyst-facing or public-facing integrity workflows.
---

# Integrity Intelligence Operator

Operate Centinela as a Paraguay-first integrity-intelligence capability with durable memory, traceable sources, and explainable risk outputs.

## Working order

1. Read the project memory before making major decisions:
   - `memory/mission.md`
   - `memory/decisions.md`
   - `memory/source-status.md`
   - `memory/run-log.md`
   - `memory/next-steps.md`
2. Read the comparative layer that is relevant to the task:
   - `research/comparative/index.md`
   - specific reference files under `research/comparative/`
3. Prefer the architecture already chosen in `docs/architecture/system-foundation.md` unless new evidence justifies a change.
4. When extending risk logic, update both:
   - `docs/architecture/red-flag-framework.md`
   - `memory/decisions.md`
5. When adding or changing sources, update both:
   - `research/paraguay/source-universe.md`
   - `memory/source-status.md`
6. Leave behind concrete repo artifacts, not chat-only analysis.

## Operating rules

- Frame all findings as leads, anomalies, or risk indicators.
- Preserve source attribution, retrieval date, and transformation notes when possible.
- Favor modular components that can survive a later move from Paraguay to multi-country coverage.
- Treat DNCP as a local institutional predecessor, not as an empty field waiting to be invented.
- Borrow patterns from reference systems explicitly: document what is adopted, rejected, or deferred.
- Prefer relationship-aware modeling even when using relational storage.

## Default execution flow

### Research and architecture work

- Inspect current repo state and recent memory entries first.
- Use `research/resource-registry.md` and the comparative files to anchor decisions.
- Record new architecture choices in `memory/decisions.md` with date, rationale, and consequences.

### Data-source work

- Prefer official and primary sources.
- Distinguish between:
  - raw source acquisition
  - normalized internal model
  - enrichment or inferred relationships
- Keep a clear boundary between raw facts and analytical signals.

### Risk-signal work

- Implement explainable rules first.
- Store enough evidence to show why a signal fired later.
- Avoid monolithic opaque scoring in early phases.
- Separate contextual markers from stronger competition, concentration, ownership, or sanctions signals.

## What to read on demand

- `references/project-map.md` when you need a quick map of the repo and operating layers.
- `references/operating-protocol.md` when you are about to extend memory, sources, risk rules, or Paraguay pipelines.

## Success condition

Complete the requested work and leave the repo more reusable than before: updated memory, updated research where relevant, concrete code or docs, and a clear continuation path.
