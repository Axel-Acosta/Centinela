# Red-flag framework

## Framing

Risk signals are investigative prompts, not legal conclusions. A signal should answer three questions:

1. What was observed?
2. Why might it matter?
3. Which source facts support the observation?

## First implemented signal families

### Competition and timing

- `PY-DNCP-T001`: short submission window
- `PY-DNCP-T002`: potentially non-open or exceptional procedure marker
- `PY-DNCP-B001`: single-bidder or single-tenderer marker in an awarded/publication-style context

### Contextual scrutiny

- `PY-DNCP-T003`: "ad referendum" or urgency-style marker in title or status

### Concentration and repetition

- `PY-DNCP-P001`: repeated buyer-payee or buyer-supplier pairing within the loaded procurement bundle

### Payments and value coherence

- `PY-DNCP-P002`: observed payment transactions exceed published contract value

### Data quality and interpretability

- `PY-DNCP-A002`: awarded process missing supplier identity detail in the sampled view

## Current implementation limits

- `PY-DNCP-P001` is currently bundle-relative and becomes more meaningful as additional years are loaded.
- Large multi-supplier procedures can overstate entity-linked monetary context if analysts misread process-level totals as supplier-attributed amounts.
- The current registry is still procurement-only and not yet connected to ownership, sanctions, or political-finance context.

## Scoring stance

- Keep scoring lightweight and legible in the first phase.
- Prefer per-flag severity and evidence over a single opaque integrity score.
- Revisit weighted scoring only after the formal rule registry exists and multiple source types are integrated.

## Registry backbone

The formal registry is now operational across:

- `src/integrity/ruleRegistry.ts`
- `centinela.risk_rule_registry`
- `centinela.risk_rule_coverage`
- `centinela.process_review_queue`
- `data/reports/paraguay/all-sources-rulebook.md`

It currently reflects:

- Open Contracting/Cardinal/OCDS for rule structure and field dependency discipline
- OpenTender/GTI for competition and concentration indicators
- Paraguay DNCP red-flag work for local compatibility
- FUNES for relationship-aware concentration pressure
- Integrity Watch and Rosie for explainable public-safe framing and follow-up questions
- RUBLI for methodology and limitations transparency

## Next framework step

- Add the first enrichment connector so registry-backed review can pivot into ownership, sanctions, or accountability context.
- Deepen the explicit DNCP crosswalk for each active rule.
