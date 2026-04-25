import type { ReviewLane, ReviewPriority, RiskCategory, RiskSeverity, RiskSignal } from "./model";

export interface RuleInfluence {
  reference: string;
  contribution: string;
}

export interface RiskRuleDefinition {
  code: string;
  countryCode: "PY";
  family: string;
  name: string;
  category: RiskCategory;
  defaultSeverity: RiskSeverity;
  defaultScore: number;
  reviewLane: ReviewLane;
  reviewPriorityHint: ReviewPriority;
  publicDescription: string;
  rationaleTemplate: string;
  analystQuestion: string;
  recommendedAction: string;
  fieldDependencies: string[];
  evidenceRequirements: string[];
  exclusions: string[];
  limitations: string[];
  methodologyNotes: string[];
  dncpAlignment: string;
  precedentInfluences: RuleInfluence[];
}

const riskRules: RiskRuleDefinition[] = [
  {
    code: "PY-DNCP-T001",
    countryCode: "PY",
    family: "competition_timing",
    name: "Short submission window",
    category: "competition",
    defaultSeverity: "medium",
    defaultScore: 0.64,
    reviewLane: "competition_review",
    reviewPriorityHint: "enhanced_review",
    publicDescription: "The available submission or enquiry window is short enough to justify competition review.",
    rationaleTemplate:
      "The available submission or enquiry window is short enough to merit additional competition scrutiny.",
    analystQuestion: "Was the available tender window materially adequate for fair competition in this market and procedure?",
    recommendedAction: "Review tender timing, notice publication, and comparable competition conditions for the same buyer.",
    fieldDependencies: ["tenderPeriod.durationInDays", "tender_start_at", "tender_end_at"],
    evidenceRequirements: [
      "Tender period duration or start/end dates",
      "Source release or process URL showing the tender timetable",
    ],
    exclusions: [
      "Do not treat this as conclusive without considering emergency, framework, or market-specific context.",
    ],
    limitations: [
      "A short window can be lawful or operationally justified.",
      "This rule is only as reliable as the published timetable fields.",
    ],
    methodologyNotes: [
      "This is a timing-screening indicator, not a proof of restricted competition.",
    ],
    dncpAlignment: "Comparable to local competition and timing scrutiny, but not yet mapped one-to-one to a DNCP public flag.",
    precedentInfluences: [
      { reference: "Open Contracting/Cardinal/OCDS", contribution: "field dependency discipline for tender-period scrutiny" },
      { reference: "OpenTender/GTI", contribution: "competition-oriented tender indicator logic" },
      { reference: "Paraguay DNCP red flags", contribution: "local compatibility for procurement-warning language" },
      { reference: "Integrity Watch", contribution: "plain-language public-safe flag framing" },
      { reference: "RUBLI", contribution: "limitations-first methodology stance" },
    ],
  },
  {
    code: "PY-DNCP-T002",
    countryCode: "PY",
    family: "procedure_exception",
    name: "Exceptional or less-open procedure marker",
    category: "competition",
    defaultSeverity: "high",
    defaultScore: 0.82,
    reviewLane: "procedure_review",
    reviewPriorityHint: "priority",
    publicDescription: "The procurement method text contains language associated with exceptional or less-open procedures.",
    rationaleTemplate:
      "The procurement method text includes language associated with exceptional or potentially less-open procedures.",
    analystQuestion: "Was the procedure type justified, documented, and consistent with the applicable legal basis?",
    recommendedAction: "Review procedure justification, legal basis, and exception-related documentation.",
    fieldDependencies: ["procurementMethod", "procurementMethodDetails"],
    evidenceRequirements: [
      "Published method or method-details text",
      "Linked source release or process URL",
    ],
    exclusions: [
      "Do not treat text matching alone as a legal conclusion about misuse of an exception.",
    ],
    limitations: [
      "This rule is text-driven and can miss local wording variants or lawful uses of exceptional procedures.",
    ],
    methodologyNotes: [
      "This rule should later be strengthened with explicit legal-basis extraction rather than text patterns alone.",
    ],
    dncpAlignment: "Closest to local scrutiny of exception or less-open procedures.",
    precedentInfluences: [
      { reference: "Open Contracting/Cardinal/OCDS", contribution: "procedure-level risk logic and field dependency structure" },
      { reference: "Paraguay DNCP red flags", contribution: "local procedure-risk framing" },
      { reference: "Integrity Watch", contribution: "explainable flag wording suitable for later public browsing" },
      { reference: "RUBLI", contribution: "explicit methodological caveats for text-driven detection" },
    ],
  },
  {
    code: "PY-DNCP-T003",
    countryCode: "PY",
    family: "contextual_scrutiny",
    name: "Contextual scrutiny marker",
    category: "context",
    defaultSeverity: "low",
    defaultScore: 0.41,
    reviewLane: "context_review",
    reviewPriorityHint: "triage",
    publicDescription: "The process includes an urgency-style or ad referendum marker that should be reviewed in context.",
    rationaleTemplate:
      "The process includes an 'ad referendum' or urgency-style marker that should be reviewed in context.",
    analystQuestion: "What surrounding budget, urgency, or institutional context explains this marker, and is the explanation documented?",
    recommendedAction: "Review contextual markers, timing, and any supporting budget or urgency documentation.",
    fieldDependencies: ["title", "statusDetails", "coveredBy"],
    evidenceRequirements: [
      "Title, status details, or coveredBy markers from the source process",
    ],
    exclusions: [
      "Do not escalate on this rule alone without stronger procurement or financial concerns.",
    ],
    limitations: [
      "This rule is deliberately low-confidence and context-oriented.",
      "Keyword markers can reflect procedural language rather than substantive risk.",
    ],
    methodologyNotes: [
      "This is a triage prompt meant to push analysts toward surrounding context, not a stand-alone flag.",
    ],
    dncpAlignment: "Compatible with local Paraguay procurement language, especially for urgency-style scrutiny.",
    precedentInfluences: [
      { reference: "Paraguay DNCP red flags", contribution: "local terminology and procedural context" },
      { reference: "Rosie/Serenata", contribution: "suspicion-first but human-review-centered posture" },
      { reference: "Integrity Watch", contribution: "explainable low-severity contextual messaging" },
      { reference: "RUBLI", contribution: "transparent caution around weak-context indicators" },
    ],
  },
  {
    code: "PY-DNCP-B001",
    countryCode: "PY",
    family: "competition_outcome",
    name: "Single-bidder or single-tenderer marker",
    category: "competition",
    defaultSeverity: "medium",
    defaultScore: 0.69,
    reviewLane: "competition_review",
    reviewPriorityHint: "enhanced_review",
    publicDescription:
      "The process reached an award or publication-style stage with only one reported tenderer, which may justify competition review.",
    rationaleTemplate:
      "The process reached an award or publication-style stage with only one reported tenderer, which may warrant competition review.",
    analystQuestion: "Was there genuinely limited market participation, or do the surrounding facts suggest competition constraints worth comparing?",
    recommendedAction: "Review competition conditions, tenderer count, and comparable procedures for the same buyer.",
    fieldDependencies: ["numberOfTenderers", "statusDetails"],
    evidenceRequirements: [
      "Reported number of tenderers",
      "Process status details showing award or publication stage",
    ],
    exclusions: [
      "Do not use this rule as a guilt proxy in markets where single participation is structurally common.",
    ],
    limitations: [
      "Tenderer count quality depends on the source record.",
      "A single tenderer can reflect market structure, not necessarily buyer misconduct.",
    ],
    methodologyNotes: [
      "This rule should later be combined with buyer benchmarking and market concentration context.",
    ],
    dncpAlignment: "Likely to map well to local competition-style DNCP indicators once the formal crosswalk is built.",
    precedentInfluences: [
      { reference: "OpenTender/GTI", contribution: "competition and participation indicator logic" },
      { reference: "Open Contracting/Cardinal/OCDS", contribution: "portable procurement-rule discipline" },
      { reference: "Paraguay DNCP red flags", contribution: "local procurement compatibility" },
      { reference: "Integrity Watch", contribution: "plain-language explainability for competition warnings" },
      { reference: "RUBLI", contribution: "methodology constraints and limitations disclosure" },
    ],
  },
  {
    code: "PY-DNCP-A002",
    countryCode: "PY",
    family: "data_quality",
    name: "Awarded process without supplier detail",
    category: "data_quality",
    defaultSeverity: "medium",
    defaultScore: 0.58,
    reviewLane: "data_quality_review",
    reviewPriorityHint: "enhanced_review",
    publicDescription: "The awarded process view does not expose supplier identity, reducing interpretability.",
    rationaleTemplate:
      "The sampled awarded process does not expose supplier identity in the retrieved view, reducing interpretability.",
    analystQuestion: "Which missing or alternate source records are needed to recover the party information for this awarded process?",
    recommendedAction: "Confirm provenance, locate alternate source records, and recover missing supplier identity before deeper inference.",
    fieldDependencies: ["process_stage", "suppliers"],
    evidenceRequirements: [
      "Process stage showing awarded context",
      "Observed absence of supplier entries in the normalized record",
    ],
    exclusions: [
      "Do not infer hidden intent from missing supplier fields alone.",
    ],
    limitations: [
      "This is a transparency and interpretability rule, not a substantive corruption indicator.",
    ],
    methodologyNotes: [
      "This rule is especially important for later source-completeness diagnostics and br/acc-style provenance rigor.",
    ],
    dncpAlignment: "Supports local data-quality and transparency review rather than a direct substantive red flag.",
    precedentInfluences: [
      { reference: "Open Contracting/Cardinal/OCDS", contribution: "data completeness and field dependency discipline" },
      { reference: "br/acc", contribution: "provenance and missing-data traceability" },
      { reference: "Paraguay DNCP red flags", contribution: "local interpretability needs" },
      { reference: "RUBLI", contribution: "limitations-first methodology framing" },
    ],
  },
  {
    code: "PY-DNCP-P001",
    countryCode: "PY",
    family: "relationship_concentration",
    name: "Repeated buyer-payee or buyer-supplier pairing",
    category: "concentration",
    defaultSeverity: "medium",
    defaultScore: 0.61,
    reviewLane: "repeat_supplier_review",
    reviewPriorityHint: "enhanced_review",
    publicDescription:
      "One or more suppliers in this process appear repeatedly with the same buyer across the loaded procurement bundle.",
    rationaleTemplate:
      "The same buyer and supplier/payee pairing appears repeatedly in the loaded procurement bundle and may warrant concentration review.",
    analystQuestion:
      "How concentrated is this buyer-supplier history, and do ownership, political, or market-structure facts make the recurrence more meaningful?",
    recommendedAction: "Review repeat buyer-supplier history, concentration, and any linked ownership context.",
    fieldDependencies: ["buyer", "suppliers", "source_key", "loaded procurement history"],
    evidenceRequirements: [
      "Buyer identity",
      "Supplier identity",
      "Observed pair-occurrence count across the loaded bundle",
    ],
    exclusions: [
      "Do not infer collusion from recurrence alone.",
      "Avoid reading process-linked monetary context as clean supplier-attributed value in multi-supplier procedures.",
    ],
    limitations: [
      "The rule becomes more meaningful as more years and non-procurement enrichment are loaded.",
      "High recurrence can reflect framework, sector, or market concentration realities.",
    ],
    methodologyNotes: [
      "This rule should evolve into benchmarked concentration logic once GTI-style buyer and market baselines are available.",
    ],
    dncpAlignment: "Comparable to local concentration-style scrutiny, but should later be cross-walked explicitly against DNCP practice.",
    precedentInfluences: [
      { reference: "OpenTender/GTI", contribution: "buyer-supplier concentration and benchmarking direction" },
      { reference: "FUNES", contribution: "Latin American relationship-aware risk framing" },
      { reference: "Dozorro/ProZorro", contribution: "follow-up workflow for procurement monitoring" },
      { reference: "QuienEsQuien/TodosLosContratos", contribution: "company-contract accountability perspective" },
      { reference: "Sayari", contribution: "entity-centric relationship intelligence benchmark" },
      { reference: "RUBLI", contribution: "transparent caution around concentration scoring limits" },
    ],
  },
  {
    code: "PY-DNCP-P002",
    countryCode: "PY",
    family: "payment_value_coherence",
    name: "Observed payments exceed published contract value",
    category: "payment",
    defaultSeverity: "high",
    defaultScore: 0.86,
    reviewLane: "payment_trace",
    reviewPriorityHint: "priority",
    publicDescription:
      "The summed observed payment transactions exceed the published contract value and should be reviewed for amendments, multiple contracts, or data issues.",
    rationaleTemplate:
      "The summed observed payment transactions exceed the published contract value and should be reviewed for amendments, multiple contracts, or data issues.",
    analystQuestion:
      "Do amendments, linked contracts, disbursement timing, or data-quality issues explain the observed payment-over-value mismatch?",
    recommendedAction: "Check amendments, payment chronology, and related contracts before escalation.",
    fieldDependencies: ["contracts.amount", "contract_transactions.amount"],
    evidenceRequirements: [
      "Published contract value total",
      "Observed transaction total from loaded contract transactions",
    ],
    exclusions: [
      "Do not treat this as a final overpayment finding until amendments and contract grouping are checked.",
    ],
    limitations: [
      "Observed payment totals depend on currently loaded transaction rows.",
      "Some mismatches can reflect amendments, contract grouping, or publication delays rather than wrongdoing.",
    ],
    methodologyNotes: [
      "This rule is strongest when paired with chronology and amendment review, not as a stand-alone accusation.",
    ],
    dncpAlignment: "Well suited for later local crosswalk work around payment and contract-value coherence.",
    precedentInfluences: [
      { reference: "Open Contracting/Cardinal/OCDS", contribution: "contract and transaction coherence logic" },
      { reference: "Paraguay DNCP red flags", contribution: "local grounding for procurement-control language" },
      { reference: "Rosie/Serenata", contribution: "anomaly-to-review workflow logic" },
      { reference: "Integrity Watch", contribution: "clear explanation of why a payment mismatch matters" },
      { reference: "RUBLI", contribution: "limitations and reproducibility discipline for quantitative rules" },
    ],
  },
];

const riskRuleMap = new Map(riskRules.map((rule) => [rule.code, rule]));

export function listRiskRules(): RiskRuleDefinition[] {
  return riskRules.map((rule) => ({
    ...rule,
    fieldDependencies: [...rule.fieldDependencies],
    evidenceRequirements: [...rule.evidenceRequirements],
    exclusions: [...rule.exclusions],
    limitations: [...rule.limitations],
    methodologyNotes: [...rule.methodologyNotes],
    precedentInfluences: rule.precedentInfluences.map((influence) => ({ ...influence })),
  }));
}

export function getRiskRuleDefinition(code: string): RiskRuleDefinition {
  const rule = riskRuleMap.get(code);
  if (!rule) {
    throw new Error(`Unknown risk rule code: ${code}`);
  }

  return {
    ...rule,
    fieldDependencies: [...rule.fieldDependencies],
    evidenceRequirements: [...rule.evidenceRequirements],
    exclusions: [...rule.exclusions],
    limitations: [...rule.limitations],
    methodologyNotes: [...rule.methodologyNotes],
    precedentInfluences: rule.precedentInfluences.map((influence) => ({ ...influence })),
  };
}

export function buildRiskSignal(
  code: string,
  evidence: string[],
  overrides?: Partial<Pick<RiskSignal, "severity" | "score" | "rationale">>,
): RiskSignal {
  const rule = getRiskRuleDefinition(code);

  return {
    code: rule.code,
    name: rule.name,
    severity: overrides?.severity ?? rule.defaultSeverity,
    category: rule.category,
    score: overrides?.score ?? rule.defaultScore,
    rationale: overrides?.rationale ?? rule.rationaleTemplate,
    evidence,
  };
}

export function reviewPriorityRank(priority: ReviewPriority): number {
  switch (priority) {
    case "priority":
      return 3;
    case "enhanced_review":
      return 2;
    default:
      return 1;
  }
}
