import { writeOutputText } from "./files";
import { connectToPostgres } from "./postgres";

interface SourceSummaryRow {
  total_processes: string;
  flagged_processes: string;
  total_risk_signals: string;
  total_contract_value: string | null;
  total_paid_amount: string | null;
}

interface LeadRow {
  title: string;
  buyer_name: string | null;
  status_details: string | null;
  suppliers: string[] | null;
  risk_signal_count: string;
  max_severity: string;
  signal_codes: string[] | null;
  total_contract_value: string | null;
  total_paid_amount: string | null;
  source_url: string | null;
}

interface FlagBreakdownRow {
  signal_code: string;
  signal_name: string;
  severity: string;
  process_count: string;
  avg_score: string;
}

interface BuyerSummaryRow {
  buyer_name: string | null;
  process_count: string;
  total_risk_signals: string;
  total_paid_amount: string | null;
}

interface PairSummaryRow {
  buyer_name: string | null;
  supplier_name: string | null;
  process_count: string;
  total_risk_signals: string;
  total_contract_value: string | null;
  total_paid_amount: string | null;
}

interface EntityOverviewRow {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  source_count: string;
  source_keys: string[] | null;
  total_process_count: string;
  supplier_process_count: string;
  buyer_process_count: string;
  flagged_process_count: string;
  total_risk_signals: string;
  supplier_linked_contract_value: string | null;
  supplier_linked_paid_amount: string | null;
  buyer_linked_contract_value: string | null;
  buyer_linked_paid_amount: string | null;
  first_published_at: string | null;
  last_published_at: string | null;
}

interface EntityIdentifierRow {
  scheme: string;
  value: string;
  is_primary: boolean;
}

interface EntitySourceMentionRow {
  source_key: string;
  role: string;
  source_external_id: string;
  observed_name: string | null;
}

interface EntityEdgeRow {
  entity_role: string;
  counterparty_name: string | null;
  counterparty_role: string;
  source_count: string;
  source_keys: string[] | null;
  process_count: string;
  flagged_process_count: string;
  total_risk_signals: string;
  linked_contract_value: string | null;
  linked_paid_amount: string | null;
  signal_codes: string[] | null;
}

interface EntityProcessRow {
  title: string;
  source_key: string;
  buyer_name: string | null;
  suppliers: string[] | null;
  status_details: string | null;
  risk_signal_count: string;
  signal_codes: string[] | null;
  max_severity: string;
  total_contract_value: string | null;
  total_paid_amount: string | null;
  source_url: string | null;
}

interface EntitySourceRecordRow {
  id: string;
  source_key: string;
  external_id: string;
  record_kind: string;
  source_url: string | null;
  retrieved_at: string;
  record_title: string | null;
  process_title: string | null;
  document_type: string | null;
  field_path: string | null;
}

interface EntityEnrichmentRow {
  matched_entity_name: string;
  matched_entity_type: string;
  source_key: string;
  match_method: string;
  match_confidence: string | null;
  match_quality: string;
  review_status: string;
  rationale: string;
  external_schema: string | null;
  external_datasets: unknown;
  external_countries: unknown;
  external_program_ids: unknown;
  signal_codes: string[] | null;
  signal_names: string[] | null;
  signal_categories: string[] | null;
  max_severity: string;
  evidence: unknown;
}

interface EntityLocalProfileRow {
  source_key: string;
  profile_kind: string;
  profile_status: string;
  match_method: string;
  match_confidence: string | null;
  review_status: string;
  profile_title: string;
  summary: string | null;
  provider_slug: string | null;
  ruc: string | null;
  registry_identifier: string | null;
  registry_identifier_scheme: string | null;
  taxpayer_status: string | null;
  official_name: string | null;
  supplier_type: string | null;
  company_size: string | null;
  activity_type: string | null;
  registry_activation_at: string | null;
  sipe_activation_at: string | null;
  inscription_at: string | null;
  detail_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  country: string | null;
  adjudication_count: number;
  representatives: unknown;
}

interface EntityIntelligenceSignalRow {
  source_key: string;
  signal_code: string;
  signal_name: string;
  signal_scope: string;
  category: string;
  severity: string;
  score: string;
  rationale: string;
  evidence: unknown;
}

interface EntityRepresentativeRow {
  representative_name: string;
  source_key: string;
  confidence: string | null;
  provider_slug: string | null;
  provider_ruc: string | null;
}

interface RepresentativeExternalMatchRow {
  representative_name: string;
  representative_source_key: string;
  source_key: string;
  match_method: string;
  match_confidence: string | null;
  match_quality: string;
  review_status: string;
  rationale: string;
  external_name: string;
  external_type: string;
  external_schema: string | null;
  external_datasets: unknown;
  external_countries: unknown;
  signal_codes: string[] | null;
  max_severity: string;
}

interface EntityExternalCandidateRow {
  id: string;
  entity_name: string;
  source_key: string;
  external_name: string;
  external_entity_type: string;
  external_schema: string;
  local_screening_role: string;
  candidate_status: string;
  match_method: string;
  match_confidence: string;
  match_quality: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  review_evidence: unknown;
  second_review_id: string | null;
  second_review_decision: string | null;
  second_reviewed_at: string | null;
  second_reviewed_by: string | null;
  second_review_rationale: string | null;
  second_review_limitations: string | null;
  second_review_evidence: unknown;
  accepted_match_id: string | null;
  rejection_reason: string | null;
  rationale: string;
  external_datasets: unknown;
  external_countries: unknown;
  external_identifiers: unknown;
  evidence: unknown;
  hosted_support_category: string | null;
  hosted_top_result_name: string | null;
  hosted_top_result_score: string | null;
  hosted_top_result_datasets: unknown;
  hosted_compared_at: string | null;
  suggested_review_status: string | null;
  review_priority_hint: string | null;
  review_next_step: string | null;
  local_identifiers: string[] | null;
  local_ruc_identifiers: string[] | null;
  local_profile_sources: string[] | null;
  local_profile_names: string[] | null;
  local_profile_rucs: string[] | null;
}

interface RepresentativeExternalCandidateRow extends EntityExternalCandidateRow {
  representative_name: string;
  representative_source_key: string;
}

interface EntityHostedComparisonRow {
  local_screening_role: string;
  dataset: string;
  algorithm: string;
  threshold: string;
  result_limit: string;
  support_category: string;
  hosted_result_count: string;
  local_candidate_statuses: string[] | null;
  local_candidate_methods: string[] | null;
  local_candidate_max_confidence: string | null;
  local_external_ids: string[] | null;
  local_external_names: string[] | null;
  linked_company_names: string[] | null;
  top_result_name: string | null;
  top_result_schema: string | null;
  top_result_score: string | null;
  top_result_datasets: unknown;
  compared_at: string;
}

interface RepresentativeHostedComparisonRow extends EntityHostedComparisonRow {
  representative_name: string;
  representative_source_key: string;
}

interface EntityTriageRow {
  anchor_status: string;
  local_profile_count: string;
  local_adjudication_count: string;
  local_signal_count: string;
  local_signal_codes: string[] | null;
  max_local_severity: string;
  external_match_count: string;
  external_signal_count: string;
  max_external_severity: string;
  external_candidate_count: string;
  external_review_candidate_count: string;
  external_rejected_candidate_count: string;
  max_external_candidate_confidence: string;
  representative_count: string;
  review_priority: string;
  review_lane: string;
  lead_question: string;
  recommended_action: string;
}

interface QueueSummaryRow {
  total_items: string;
  priority_items: string;
  enhanced_review_items: string;
  triage_items: string;
}

interface QueueLaneRow {
  review_lane: string;
  item_count: string;
}

interface QueueItemRow {
  title: string;
  source_key: string;
  buyer_name: string | null;
  suppliers: string[] | null;
  status_details: string | null;
  review_priority: string;
  review_lane: string;
  risk_signal_count: string;
  signal_codes: string[] | null;
  max_pair_occurrences: string;
  total_contract_value: string | null;
  total_paid_amount: string | null;
  recommended_action: string;
  lead_question: string;
  source_url: string | null;
}

interface EntityQueueSummaryRow {
  total_supplier_entities: string;
  anchored_supplier_entities: string;
  unanchored_supplier_entities: string;
  local_signal_entities: string;
  external_signal_entities: string;
  external_candidate_entities: string;
  external_candidate_count: string;
  external_review_candidate_count: string;
  external_rejected_candidate_count: string;
  representative_link_count: string;
  hosted_same_candidate_entities: string;
  hosted_different_result_entities: string;
  hosted_no_result_entities: string;
}

interface EntityQueueLaneRow {
  review_lane: string;
  item_count: string;
}

interface EntityQueueItemRow {
  entity_name: string;
  anchor_status: string;
  source_keys: string[] | null;
  total_process_count: string;
  flagged_process_count: string;
  total_risk_signals: string;
  supplier_linked_contract_value: string | null;
  supplier_linked_paid_amount: string | null;
  local_signal_count: string;
  local_signal_codes: string[] | null;
  max_local_severity: string;
  external_match_count: string;
  external_signal_count: string;
  max_external_severity: string;
  external_candidate_count: string;
  external_review_candidate_count: string;
  external_rejected_candidate_count: string;
  max_external_candidate_confidence: string;
  representative_count: string;
  hosted_support_category: string | null;
  hosted_top_result_name: string | null;
  hosted_top_result_score: string | null;
  hosted_top_result_datasets: unknown;
  hosted_compared_at: string | null;
  review_priority: string;
  review_lane: string;
  lead_question: string;
  recommended_action: string;
}

interface ExternalCandidateSummaryRow {
  candidate_status: string;
  local_screening_role: string;
  candidate_count: string;
  local_entity_count: string;
  max_match_confidence: string;
}

interface ExternalCandidateMethodRow {
  candidate_status: string;
  match_method: string;
  candidate_count: string;
  local_entity_count: string;
  max_match_confidence: string;
}

interface ExternalCandidateReviewStatusRow {
  review_status: string;
  candidate_count: string;
  local_entity_count: string;
  max_match_confidence: string;
}

interface ExternalCandidateItemRow {
  id: string;
  entity_name: string;
  entity_type: string;
  source_key: string;
  external_name: string;
  external_entity_type: string;
  external_schema: string;
  local_screening_role: string;
  candidate_status: string;
  match_method: string;
  match_confidence: string;
  match_quality: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  review_evidence: unknown;
  second_review_id: string | null;
  second_review_decision: string | null;
  second_reviewed_at: string | null;
  second_reviewed_by: string | null;
  second_review_rationale: string | null;
  second_review_limitations: string | null;
  second_review_evidence: unknown;
  accepted_match_id: string | null;
  rejection_reason: string | null;
  rationale: string;
  external_datasets: unknown;
  external_countries: unknown;
  external_identifiers: unknown;
  evidence: unknown;
  hosted_support_category: string | null;
  hosted_top_result_name: string | null;
  hosted_top_result_score: string | null;
  hosted_top_result_datasets: unknown;
  hosted_compared_at: string | null;
  suggested_review_status: string | null;
  review_priority_hint: string | null;
  review_next_step: string | null;
  local_identifiers: string[] | null;
  local_ruc_identifiers: string[] | null;
  local_profile_sources: string[] | null;
  local_profile_names: string[] | null;
  local_profile_rucs: string[] | null;
}

interface AnchorGapSummaryRow {
  total_gaps: string;
  gaps_with_ruc: string;
  gaps_without_ruc: string;
  flagged_gap_entities: string;
  total_gap_risk_signals: string;
}

interface AnchorGapItemRow {
  entity_name: string;
  source_keys: string[] | null;
  total_process_count: string;
  flagged_process_count: string;
  total_risk_signals: string;
  supplier_linked_contract_value: string | null;
  supplier_linked_paid_amount: string | null;
  identifiers: string[] | null;
  ruc_identifiers: string[] | null;
  has_ruc_identifier: boolean;
  procurement_source_mention_count: string;
  observed_names: string[] | null;
  gap_reason: string;
  next_resolution_step: string;
  review_priority: string;
  lead_question: string;
  recommended_action: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatAmount(value: string | number | null | undefined): string {
  const numeric = toNumber(value);
  if (numeric === undefined) {
    return "n/a";
  }

  return new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function uniqueList(values: string[] | null | undefined): string[] {
  return [...new Set((values ?? []).filter(Boolean))];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  return [];
}

function findEvidenceValue(evidence: unknown, type: string): string | undefined {
  if (!Array.isArray(evidence)) {
    return undefined;
  }

  for (const item of evidence) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const candidate = item as { type?: unknown; value?: unknown };
    if (
      candidate.type === type &&
      typeof candidate.value === "string" &&
      candidate.value.length > 0 &&
      candidate.value !== "_NO_APLICA_"
    ) {
      return candidate.value;
    }
  }

  return undefined;
}

function findEvidenceValueAsText(evidence: unknown, type: string): string | undefined {
  if (!Array.isArray(evidence)) {
    return undefined;
  }

  for (const item of evidence) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const candidate = item as { type?: unknown; value?: unknown };
    if (candidate.type !== type) {
      continue;
    }

    if (Array.isArray(candidate.value)) {
      const values = candidate.value
        .map((value) => (typeof value === "string" ? value : String(value)))
        .filter((value) => value.length > 0 && value !== "_NO_APLICA_");

      return values.length > 0 ? values.join(", ") : undefined;
    }

    if (
      typeof candidate.value === "string" &&
      candidate.value.length > 0 &&
      candidate.value !== "_NO_APLICA_"
    ) {
      return candidate.value;
    }

    if (typeof candidate.value === "number" || typeof candidate.value === "boolean") {
      return String(candidate.value);
    }
  }

  return undefined;
}

function reviewEvidencePart(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function formatReviewEvidenceHistory(value: unknown, limit = 3): string {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) {
    return "n/a";
  }

  return items
    .slice(-limit)
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return String(item);
      }

      const record = item as Record<string, unknown>;
      const recordedAt = reviewEvidencePart(record.recordedAt);
      const status = reviewEvidencePart(record.status);
      const reviewer = reviewEvidencePart(record.reviewer);
      const notes = reviewEvidencePart(record.notes);
      const evidenceUrl = reviewEvidencePart(record.evidenceUrl);
      const evidenceNote = reviewEvidencePart(record.evidenceNote);
      const source = reviewEvidencePart(record.source);
      const type = reviewEvidencePart(record.type);
      const typedValue = reviewEvidencePart(record.value);
      const parts = [
        recordedAt ? `at ${recordedAt}` : undefined,
        status ? `status=${status}` : undefined,
        reviewer ? `reviewer=${reviewer}` : undefined,
        notes ? `notes=${notes}` : undefined,
        evidenceUrl ? `url=${evidenceUrl}` : undefined,
        evidenceNote ? `evidence=${evidenceNote}` : undefined,
        source ? `source=${source}` : undefined,
        !recordedAt && !status && type ? `type=${type}` : undefined,
        !recordedAt && !status && typedValue ? `value=${typedValue}` : undefined,
      ].filter((part): part is string => Boolean(part));

      return parts.length > 0 ? parts.join("; ") : JSON.stringify(record);
    })
    .join(" | ");
}

function formatList(values: string[] | null | undefined, limit = 12): string {
  const uniqueValues = uniqueList(values);
  if (uniqueValues.length === 0) {
    return "n/a";
  }

  if (uniqueValues.length <= limit) {
    return uniqueValues.join(", ");
  }

  const shown = uniqueValues.slice(0, limit).join(", ");
  return `${shown} (+${uniqueValues.length - limit} more)`;
}

function renderAnalystBrief(
  sourceKey: string,
  summary: SourceSummaryRow | undefined,
  leads: LeadRow[],
  flags: FlagBreakdownRow[],
  buyers: BuyerSummaryRow[],
  pairs: PairSummaryRow[],
): string {
  const lines: string[] = [];
  lines.push(`# Analyst brief for ${sourceKey}`);
  lines.push("");
  lines.push("This report contains risk signals and investigation leads, not proof of wrongdoing.");
  lines.push("");

  if (summary) {
    lines.push("## Coverage");
    lines.push("");
    lines.push(`- Processes loaded: ${summary.total_processes}`);
    lines.push(`- Flagged processes: ${summary.flagged_processes}`);
    lines.push(`- Total risk signals: ${summary.total_risk_signals}`);
    lines.push(`- Total published contract value: ${formatAmount(summary.total_contract_value)}`);
    lines.push(`- Observed payments: ${formatAmount(summary.total_paid_amount)}`);
    lines.push("");
  }

  lines.push("## Highest-signal process leads");
  lines.push("");

  for (const lead of leads) {
    lines.push(`### ${lead.title}`);
    lines.push(`- Buyer: ${lead.buyer_name ?? "Unknown"}`);
    lines.push(`- Status: ${lead.status_details ?? "n/a"}`);
    if (lead.suppliers && lead.suppliers.length > 0) {
      lines.push(`- Suppliers: ${formatList(lead.suppliers)}`);
    }
    lines.push(`- Max severity: ${lead.max_severity}`);
    lines.push(`- Risk signal count: ${lead.risk_signal_count}`);
    lines.push(`- Signal codes: ${formatList(lead.signal_codes, 20)}`);
    lines.push(`- Published contract value: ${formatAmount(lead.total_contract_value)}`);
    lines.push(`- Observed payments: ${formatAmount(lead.total_paid_amount)}`);
    lines.push(`- Source: ${lead.source_url ?? "n/a"}`);
    lines.push("");
  }

  lines.push("## Flag distribution");
  lines.push("");
  for (const flag of flags) {
    lines.push(
      `- ${flag.signal_code} (${flag.severity}) - ${flag.signal_name}: ${flag.process_count} processes, avg score ${flag.avg_score}`,
    );
  }
  lines.push("");

  lines.push("## Buyers with the most flagged activity in this source");
  lines.push("");
  for (const buyer of buyers) {
    lines.push(
      `- ${buyer.buyer_name ?? "Unknown"}: ${buyer.process_count} flagged processes, ${buyer.total_risk_signals} total signals, observed payments ${formatAmount(buyer.total_paid_amount)}`,
    );
  }
  lines.push("");

  lines.push("## Repeated buyer-supplier pairings");
  lines.push("");
  if (pairs.length === 0) {
    lines.push(
      "- No repeated buyer-supplier pairings were observed in the currently loaded source. This section becomes more meaningful once additional years or external enrichment are loaded.",
    );
  } else {
    for (const pair of pairs) {
      lines.push(
        `- ${pair.buyer_name ?? "Unknown"} -> ${pair.supplier_name ?? "Unknown"}: ${pair.process_count} processes, ${pair.total_risk_signals} signals, contract value ${formatAmount(pair.total_contract_value)}, observed payments ${formatAmount(pair.total_paid_amount)}`,
      );
    }
  }
  lines.push("");

  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- Use this brief to prioritize manual review, not to infer legal culpability.");
  lines.push("- The pair summary is especially useful once additional years and non-DNCP enrichment sources are added.");
  lines.push("- Payment figures reflect what was observed in loaded transaction rows and may not capture amendments or parallel contracts.");
  lines.push("- Use the companion rulebook report to inspect rule dependencies, limitations, review lanes, and precedent influences.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderEntityBrief(
  entity: EntityOverviewRow,
  identifiers: EntityIdentifierRow[],
  sourceMentions: EntitySourceMentionRow[],
  triage: EntityTriageRow | undefined,
  localProfiles: EntityLocalProfileRow[],
  localSignals: EntityIntelligenceSignalRow[],
  enrichmentMatches: EntityEnrichmentRow[],
  externalCandidates: EntityExternalCandidateRow[],
  hostedComparisons: EntityHostedComparisonRow[],
  representatives: EntityRepresentativeRow[],
  representativeExternalMatches: RepresentativeExternalMatchRow[],
  representativeExternalCandidates: RepresentativeExternalCandidateRow[],
  representativeHostedComparisons: RepresentativeHostedComparisonRow[],
  sourceRecords: EntitySourceRecordRow[],
  edges: EntityEdgeRow[],
  processes: EntityProcessRow[],
): string {
  const lines: string[] = [];
  const supplierProfiles = localProfiles.filter((profile) => profile.profile_kind === "dncp_supplier_registry");
  const identityProfiles = localProfiles.filter((profile) => profile.profile_kind !== "dncp_supplier_registry");

  lines.push(`# Entity brief for ${entity.entity_name}`);
  lines.push("");
  lines.push("This report contains risk signals and investigation leads, not proof of wrongdoing.");
  lines.push("");
  lines.push("## Identity");
  lines.push("");
  if (identifiers.length === 0) {
    lines.push("- Identifiers: n/a");
  } else {
    lines.push(
      `- Identifiers: ${identifiers
        .sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.scheme.localeCompare(right.scheme))
        .map((identifier) => {
          const value =
            identifier.scheme === "PY-RUC" && identifier.value.startsWith("PY-RUC-")
              ? identifier.value.slice("PY-RUC-".length)
              : identifier.value;
          return `${identifier.scheme}:${value}`;
        })
        .join(", ")}`,
    );
  }
  lines.push(
    `- Source mentions: ${
      sourceMentions.length === 0
        ? "n/a"
        : sourceMentions
            .map((mention) => `${mention.source_key} (${mention.role}${mention.source_external_id ? `:${mention.source_external_id}` : ""})`)
            .join(", ")
    }`,
  );
  lines.push("");

  lines.push("## Official source records and documents");
  lines.push("");
  if (sourceRecords.length === 0) {
    lines.push(
      "- No entity-linked source records have been persisted for this entity yet. Use the DNCP release source-check connector when official release/document evidence is needed for casework.",
    );
  } else {
    lines.push(
      "- These rows are source-navigation and case-evidence aids. They are not findings, accusations, or automatic validation of any risk signal.",
    );
    lines.push("");
    for (const record of sourceRecords) {
      lines.push(`### Source record ${record.id} - ${record.record_kind}`);
      lines.push(`- Source key: ${record.source_key}`);
      lines.push(`- External ID: ${record.external_id}`);
      lines.push(`- Title: ${record.record_title ?? "n/a"}`);
      lines.push(`- Related process: ${record.process_title ?? "n/a"}`);
      lines.push(`- Document type: ${record.document_type ?? "n/a"}`);
      lines.push(`- Field path: ${record.field_path ?? "n/a"}`);
      lines.push(`- Retrieved at: ${record.retrieved_at}`);
      lines.push(`- Source URL: ${record.source_url ?? "n/a"}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Entity intelligence triage");
  lines.push("");
  if (!triage) {
    lines.push("- No entity-level intelligence triage row is currently available for this entity.");
  } else {
    lines.push(`- Anchor status: ${triage.anchor_status}`);
    lines.push(`- Review priority: ${triage.review_priority}`);
    lines.push(`- Review lane: ${triage.review_lane}`);
    lines.push(`- Local profile count: ${triage.local_profile_count}`);
    lines.push(`- Local adjudication count: ${triage.local_adjudication_count}`);
    lines.push(`- Local signal count: ${triage.local_signal_count}`);
    lines.push(`- Local signal codes: ${formatList(triage.local_signal_codes, 20)}`);
    lines.push(`- Highest local severity: ${triage.max_local_severity}`);
    lines.push(`- External match count: ${triage.external_match_count}`);
    lines.push(`- External signal count: ${triage.external_signal_count}`);
    lines.push(`- Highest external severity: ${triage.max_external_severity}`);
    lines.push(`- External candidate count: ${triage.external_candidate_count}`);
    lines.push(`- External review candidates: ${triage.external_review_candidate_count}`);
    lines.push(`- Rejected external diagnostics: ${triage.external_rejected_candidate_count}`);
    lines.push(`- Highest external candidate confidence: ${triage.max_external_candidate_confidence}`);
    lines.push(`- Representative link count: ${triage.representative_count}`);
    lines.push(`- Lead question: ${triage.lead_question}`);
    lines.push(`- Recommended action: ${triage.recommended_action}`);
  }
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Entity type: ${entity.entity_type}`);
  lines.push(`- Sources observed: ${entity.source_count}`);
  lines.push(`- Source keys: ${formatList(entity.source_keys, 10)}`);
  lines.push(`- Total procurement processes: ${entity.total_process_count}`);
  lines.push(`- Supplier-side processes: ${entity.supplier_process_count}`);
  lines.push(`- Buyer-side processes: ${entity.buyer_process_count}`);
  lines.push(`- Flagged processes: ${entity.flagged_process_count}`);
  lines.push(`- Total risk signals: ${entity.total_risk_signals}`);
  lines.push(`- Supplier-linked process contract value: ${formatAmount(entity.supplier_linked_contract_value)}`);
  lines.push(`- Supplier-linked observed process payments: ${formatAmount(entity.supplier_linked_paid_amount)}`);
  lines.push(`- Buyer-linked process contract value: ${formatAmount(entity.buyer_linked_contract_value)}`);
  lines.push(`- Buyer-linked observed process payments: ${formatAmount(entity.buyer_linked_paid_amount)}`);
  lines.push(`- First published process: ${entity.first_published_at ?? "n/a"}`);
  lines.push(`- Last published process: ${entity.last_published_at ?? "n/a"}`);
  lines.push("");
  lines.push("## Paraguay identity validation profiles");
  lines.push("");

  if (identityProfiles.length === 0) {
    lines.push(
      "- No non-DNCP local identity validation profile is currently stored for this entity. This means Centinela has not yet validated the entity against the available DNIT RUC equivalence connector or another Paraguay identity source.",
    );
  } else {
    for (const profile of identityProfiles) {
      lines.push(`### ${profile.official_name ?? profile.profile_title}`);
      lines.push(`- Source key: ${profile.source_key}`);
      lines.push(`- Profile kind: ${profile.profile_kind}`);
      lines.push(`- Match method: ${profile.match_method}`);
      lines.push(`- Match confidence: ${profile.match_confidence ?? "n/a"}`);
      lines.push(`- Review status: ${profile.review_status}`);
      lines.push(`- RUC: ${profile.ruc ?? "n/a"}`);
      lines.push(`- Taxpayer status: ${profile.taxpayer_status ?? "n/a"}`);
      lines.push(
        `- Registry/equivalence identifier: ${
          profile.registry_identifier
            ? `${profile.registry_identifier_scheme ?? "registry"}:${profile.registry_identifier}`
            : "n/a"
        }`,
      );
      lines.push(`- Detail/source URL: ${profile.detail_url ?? "n/a"}`);
      if (profile.summary) {
        lines.push(`- Summary: ${profile.summary}`);
      }
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Paraguay official supplier anchor");
  lines.push("");

  if (supplierProfiles.length === 0) {
    lines.push(
      "- No official DNCP supplier anchor is currently stored for this entity. That usually means the local supplier connector has not matched it yet in the screened Paraguay slice.",
    );
  } else {
    for (const profile of supplierProfiles) {
      lines.push(`### ${profile.official_name ?? profile.profile_title}`);
      lines.push(`- Source key: ${profile.source_key}`);
      lines.push(`- Profile kind: ${profile.profile_kind}`);
      lines.push(`- Match method: ${profile.match_method}`);
      lines.push(`- Match confidence: ${profile.match_confidence ?? "n/a"}`);
      lines.push(`- Review status: ${profile.review_status}`);
      lines.push(`- RUC: ${profile.ruc ?? "n/a"}`);
      lines.push(
        `- Registry identifier: ${
          profile.registry_identifier
            ? `${profile.registry_identifier_scheme ?? "registry"}:${profile.registry_identifier}`
            : "n/a"
        }`,
      );
      lines.push(`- Provider slug: ${profile.provider_slug ?? "n/a"}`);
      lines.push(`- Supplier type: ${profile.supplier_type ?? "n/a"}`);
      lines.push(`- Company size: ${profile.company_size ?? "n/a"}`);
      lines.push(`- Activity type: ${profile.activity_type ?? "n/a"}`);
      lines.push(`- Adjudication count in DNCP supplier search: ${profile.adjudication_count}`);
      lines.push(`- Registry activation: ${profile.registry_activation_at ?? "n/a"}`);
      lines.push(`- SIPE activation: ${profile.sipe_activation_at ?? "n/a"}`);
      lines.push(`- Inscription date: ${profile.inscription_at ?? "n/a"}`);
      lines.push(`- Address: ${profile.address ?? "n/a"}`);
      lines.push(`- City / Department / Country: ${formatList([profile.city ?? "", profile.department ?? "", profile.country ?? ""], 3)}`);
      lines.push(`- Phone: ${profile.phone ?? "n/a"}`);
      lines.push(`- Email: ${profile.email ?? "n/a"}`);
      lines.push(`- Representatives named in the official supplier profile: ${formatList(toStringArray(profile.representatives), 20)}`);
      lines.push(`- Detail URL: ${profile.detail_url ?? "n/a"}`);
      if (profile.summary) {
        lines.push(`- Summary: ${profile.summary}`);
      }
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Local administrative signals");
  lines.push("");

  if (localSignals.length === 0) {
    lines.push(
      "- No local DNCP administrative signals are currently stored for this entity in Centinela. This is not proof that no historical supplier sanction or other local issue exists outside the current pull.",
    );
  } else {
    for (const signal of localSignals) {
      const fromDate = findEvidenceValue(signal.evidence, "fecha_desde");
      const toDate = findEvidenceValue(signal.evidence, "fecha_hasta");
      const sanctionType = findEvidenceValue(signal.evidence, "tipo_sancion");
      const licitationNumber = findEvidenceValue(signal.evidence, "nro_licitacion");
      const licitationName = findEvidenceValue(signal.evidence, "nombre_licitacion");
      lines.push(`### ${signal.signal_code} - ${signal.signal_name}`);
      lines.push(`- Source key: ${signal.source_key}`);
      lines.push(`- Scope: ${signal.signal_scope}`);
      lines.push(`- Category: ${signal.category}`);
      lines.push(`- Severity: ${signal.severity}`);
      lines.push(`- Score: ${signal.score}`);
      lines.push(`- Sanction type: ${sanctionType ?? "n/a"}`);
      lines.push(`- From: ${fromDate ?? "n/a"}`);
      lines.push(`- To: ${toDate ?? "n/a"}`);
      if (licitationNumber || licitationName) {
        lines.push(`- Related licitation: ${[licitationNumber, licitationName].filter(Boolean).join(" - ")}`);
      }
      lines.push(`- Rationale: ${signal.rationale}`);
      lines.push("");
    }
  }

  lines.push("## External enrichment");
  lines.push("");

  if (enrichmentMatches.length === 0) {
    lines.push(
      "- No external enrichment matches are currently stored for this entity. The current connector is OpenSanctions bulk screening with conservative exact-name and cautious core-name logic, so absence here is not proof of absence elsewhere.",
    );
  } else {
    for (const match of enrichmentMatches) {
      const datasets = formatList(toStringArray(match.external_datasets), 10);
      const countries = formatList(toStringArray(match.external_countries), 10);
      const programIds = formatList(toStringArray(match.external_program_ids), 10);
      const signalCodes = formatList(match.signal_codes, 10);
      const signalNames = formatList(match.signal_names, 10);
      const signalCategories = formatList(match.signal_categories, 10);
      lines.push(`### ${match.matched_entity_name}`);
      lines.push(`- External type: ${match.matched_entity_type}${match.external_schema ? ` (${match.external_schema})` : ""}`);
      lines.push(`- Match method: ${match.match_method}`);
      lines.push(`- Match quality: ${match.match_quality}`);
      lines.push(`- Match confidence: ${match.match_confidence ?? "n/a"}`);
      lines.push(`- Review status: ${match.review_status}`);
      lines.push(`- Datasets: ${datasets}`);
      lines.push(`- Countries: ${countries}`);
      lines.push(`- Program IDs: ${programIds}`);
      lines.push(`- External signal codes: ${signalCodes}`);
      lines.push(`- External signal names: ${signalNames}`);
      lines.push(`- External signal categories: ${signalCategories}`);
      lines.push(`- Highest external severity: ${match.max_severity}`);
      lines.push(`- Rationale: ${match.rationale}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## External candidate review");
  lines.push("");

  if (externalCandidates.length === 0) {
    lines.push(
      "- No review-only external candidate records are currently stored directly for this entity. Candidate records are separate from accepted matches and may include near matches or rejected diagnostics.",
    );
  } else {
    lines.push(
      "- Candidate records below are not accepted identity matches. They are review leads or rejection diagnostics preserved with source-backed rationale.",
    );
    lines.push("");
    for (const candidate of externalCandidates) {
      const datasets = formatList(toStringArray(candidate.external_datasets), 10);
      const countries = formatList(toStringArray(candidate.external_countries), 10);
      const externalIdentifiers = formatList(toStringArray(candidate.external_identifiers), 10);
      lines.push(`### ${candidate.external_name}`);
      lines.push(`- Candidate ID: ${candidate.id}`);
      lines.push(`- Candidate status: ${candidate.candidate_status}`);
      lines.push(`- External type: ${candidate.external_entity_type}${candidate.external_schema ? ` (${candidate.external_schema})` : ""}`);
      lines.push(`- Local screening role: ${candidate.local_screening_role}`);
      lines.push(`- Match method: ${candidate.match_method}`);
      lines.push(`- Match confidence: ${candidate.match_confidence}`);
      lines.push(`- Match quality: ${candidate.match_quality}`);
      lines.push(`- Review status: ${candidate.review_status}`);
      lines.push(`- Suggested review status: ${candidate.suggested_review_status ?? "n/a"}`);
      lines.push(`- Review priority hint: ${candidate.review_priority_hint ?? "n/a"}`);
      lines.push(`- Reviewed by / at: ${candidate.reviewed_by ?? "n/a"} / ${candidate.reviewed_at ?? "n/a"}`);
      lines.push(`- Review notes: ${candidate.review_notes ?? "n/a"}`);
      lines.push(`- Review evidence history: ${formatReviewEvidenceHistory(candidate.review_evidence)}`);
      lines.push(`- Second-review decision: ${candidate.second_review_decision ?? "n/a"}`);
      lines.push(`- Second-reviewed by / at: ${candidate.second_reviewed_by ?? "n/a"} / ${candidate.second_reviewed_at ?? "n/a"}`);
      lines.push(`- Second-review rationale: ${candidate.second_review_rationale ?? "n/a"}`);
      lines.push(`- Second-review limitations: ${candidate.second_review_limitations ?? "n/a"}`);
      lines.push(`- Second-review evidence: ${formatReviewEvidenceHistory(candidate.second_review_evidence)}`);
      lines.push(`- Accepted match ID: ${candidate.accepted_match_id ?? "n/a"}`);
      lines.push(`- Local identifiers: ${formatList(candidate.local_identifiers, 12)}`);
      lines.push(`- Local RUC identifiers: ${formatList(candidate.local_ruc_identifiers, 8)}`);
      lines.push(`- Local profile sources: ${formatList(candidate.local_profile_sources, 8)}`);
      lines.push(`- Local profile names: ${formatList(candidate.local_profile_names, 8)}`);
      lines.push(`- Latest hosted support: ${candidate.hosted_support_category ?? "n/a"}`);
      lines.push(`- Latest hosted top result: ${candidate.hosted_top_result_name ?? "n/a"}`);
      lines.push(`- Latest hosted top score: ${candidate.hosted_top_result_score ?? "n/a"}`);
      lines.push(`- Rejection reason: ${candidate.rejection_reason ?? "n/a"}`);
      lines.push(`- Datasets: ${datasets}`);
      lines.push(`- Countries: ${countries}`);
      lines.push(`- External identifiers: ${externalIdentifiers}`);
      lines.push(`- Rationale: ${candidate.rationale}`);
      lines.push(`- Review next step: ${candidate.review_next_step ?? "n/a"}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Hosted matcher comparison");
  lines.push("");

  if (hostedComparisons.length === 0) {
    lines.push(
      "- No authenticated OpenSanctions hosted comparison is currently stored for this entity. Hosted matcher evidence is separate from bulk screening and remains review-only.",
    );
  } else {
    lines.push(
      "- These rows compare Centinela's local candidate layer against the authenticated OpenSanctions matcher. They are comparison evidence, not accepted matches or legal conclusions.",
    );
    lines.push("");
    for (const comparison of hostedComparisons) {
      lines.push(`### ${comparison.top_result_name ?? entity.entity_name}`);
      lines.push(`- Local screening role: ${comparison.local_screening_role}`);
      lines.push(`- Dataset / algorithm: ${comparison.dataset} / ${comparison.algorithm}`);
      lines.push(`- Threshold / result limit: ${comparison.threshold} / ${comparison.result_limit}`);
      lines.push(`- Hosted support category: ${comparison.support_category}`);
      lines.push(`- Hosted result count: ${comparison.hosted_result_count}`);
      lines.push(`- Local candidate statuses: ${formatList(comparison.local_candidate_statuses, 10)}`);
      lines.push(`- Local candidate methods: ${formatList(comparison.local_candidate_methods, 10)}`);
      lines.push(`- Local max candidate confidence: ${comparison.local_candidate_max_confidence ?? "n/a"}`);
      lines.push(`- Local external candidate ids: ${formatList(comparison.local_external_ids, 10)}`);
      lines.push(`- Local external candidate names: ${formatList(comparison.local_external_names, 10)}`);
      lines.push(`- Hosted top result: ${comparison.top_result_name ?? "n/a"}`);
      lines.push(`- Hosted top schema: ${comparison.top_result_schema ?? "n/a"}`);
      lines.push(`- Hosted top score: ${comparison.top_result_score ?? "n/a"}`);
      lines.push(`- Hosted top datasets: ${formatList(toStringArray(comparison.top_result_datasets), 10)}`);
      lines.push(`- Compared at: ${comparison.compared_at}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Representatives and ownership-ready links");
  lines.push("");

  if (representatives.length === 0) {
    lines.push("- No representative links are currently stored for this entity.");
  } else {
    for (const representative of representatives) {
      lines.push(
        `- ${representative.representative_name}: source=${representative.source_key}, confidence=${representative.confidence ?? "n/a"}, provider_slug=${representative.provider_slug ?? "n/a"}, provider_ruc=${representative.provider_ruc ?? "n/a"}`,
      );
    }
  }

  lines.push("");
  lines.push("## Representative external screening candidates");
  lines.push("");

  if (representativeExternalMatches.length === 0) {
    lines.push(
      "- No accepted OpenSanctions person matches are currently stored for this entity's DNCP legal representatives. Review escalation requires exact person-name agreement or stronger multi-token support with Paraguay context; weaker partial overlaps stay as diagnostics.",
    );
  } else {
    lines.push(
      "- These are review-only person candidates connected through DNCP legal representative links. They are not company matches, ownership findings, or proof of wrongdoing.",
    );
    lines.push("");
    for (const match of representativeExternalMatches) {
      const datasets = formatList(toStringArray(match.external_datasets), 10);
      const countries = formatList(toStringArray(match.external_countries), 10);
      lines.push(`### ${match.representative_name} -> ${match.external_name}`);
      lines.push(`- Representative source: ${match.representative_source_key}`);
      lines.push(`- External source: ${match.source_key}`);
      lines.push(`- External type: ${match.external_type}${match.external_schema ? ` (${match.external_schema})` : ""}`);
      lines.push(`- Match method: ${match.match_method}`);
      lines.push(`- Match quality: ${match.match_quality}`);
      lines.push(`- Match confidence: ${match.match_confidence ?? "n/a"}`);
      lines.push(`- Review status: ${match.review_status}`);
      lines.push(`- Datasets: ${datasets}`);
      lines.push(`- Countries: ${countries}`);
      lines.push(`- External signal codes: ${formatList(match.signal_codes, 10)}`);
      lines.push(`- Highest external severity: ${match.max_severity}`);
      lines.push(`- Rationale: ${match.rationale}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Representative external candidate review");
  lines.push("");

  if (representativeExternalCandidates.length === 0) {
    lines.push(
      "- No review-only external candidate records are currently stored for this entity's DNCP legal representatives.",
    );
  } else {
    lines.push(
      "- These candidate records are linked through DNCP legal representatives and are not ownership findings, company matches, or proof of wrongdoing.",
    );
    lines.push("");
    for (const candidate of representativeExternalCandidates) {
      const datasets = formatList(toStringArray(candidate.external_datasets), 10);
      const countries = formatList(toStringArray(candidate.external_countries), 10);
      const externalIdentifiers = formatList(toStringArray(candidate.external_identifiers), 10);
      lines.push(`### ${candidate.representative_name} -> ${candidate.external_name}`);
      lines.push(`- Candidate ID: ${candidate.id}`);
      lines.push(`- Candidate status: ${candidate.candidate_status}`);
      lines.push(`- Representative source: ${candidate.representative_source_key}`);
      lines.push(`- External type: ${candidate.external_entity_type}${candidate.external_schema ? ` (${candidate.external_schema})` : ""}`);
      lines.push(`- Match method: ${candidate.match_method}`);
      lines.push(`- Match confidence: ${candidate.match_confidence}`);
      lines.push(`- Review status: ${candidate.review_status}`);
      lines.push(`- Suggested review status: ${candidate.suggested_review_status ?? "n/a"}`);
      lines.push(`- Review priority hint: ${candidate.review_priority_hint ?? "n/a"}`);
      lines.push(`- Reviewed by / at: ${candidate.reviewed_by ?? "n/a"} / ${candidate.reviewed_at ?? "n/a"}`);
      lines.push(`- Review notes: ${candidate.review_notes ?? "n/a"}`);
      lines.push(`- Review evidence history: ${formatReviewEvidenceHistory(candidate.review_evidence)}`);
      lines.push(`- Second-review decision: ${candidate.second_review_decision ?? "n/a"}`);
      lines.push(`- Second-reviewed by / at: ${candidate.second_reviewed_by ?? "n/a"} / ${candidate.second_reviewed_at ?? "n/a"}`);
      lines.push(`- Second-review rationale: ${candidate.second_review_rationale ?? "n/a"}`);
      lines.push(`- Second-review limitations: ${candidate.second_review_limitations ?? "n/a"}`);
      lines.push(`- Second-review evidence: ${formatReviewEvidenceHistory(candidate.second_review_evidence)}`);
      lines.push(`- Accepted match ID: ${candidate.accepted_match_id ?? "n/a"}`);
      lines.push(`- Local identifiers: ${formatList(candidate.local_identifiers, 12)}`);
      lines.push(`- Local RUC identifiers: ${formatList(candidate.local_ruc_identifiers, 8)}`);
      lines.push(`- Local profile sources: ${formatList(candidate.local_profile_sources, 8)}`);
      lines.push(`- Local profile names: ${formatList(candidate.local_profile_names, 8)}`);
      lines.push(`- Latest hosted support: ${candidate.hosted_support_category ?? "n/a"}`);
      lines.push(`- Latest hosted top result: ${candidate.hosted_top_result_name ?? "n/a"}`);
      lines.push(`- Latest hosted top score: ${candidate.hosted_top_result_score ?? "n/a"}`);
      lines.push(`- Rejection reason: ${candidate.rejection_reason ?? "n/a"}`);
      lines.push(`- Datasets: ${datasets}`);
      lines.push(`- Countries: ${countries}`);
      lines.push(`- External identifiers: ${externalIdentifiers}`);
      lines.push(`- Rationale: ${candidate.rationale}`);
      lines.push(`- Review next step: ${candidate.review_next_step ?? "n/a"}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Representative hosted matcher comparison");
  lines.push("");

  if (representativeHostedComparisons.length === 0) {
    lines.push(
      "- No authenticated hosted matcher comparison is currently stored for this entity's linked DNCP legal representatives.",
    );
  } else {
    lines.push(
      "- These rows show how the authenticated matcher scored DNCP legal-representative names linked to this company. They remain review-only because representative text alone does not prove person identity.",
    );
    lines.push("");
    for (const comparison of representativeHostedComparisons) {
      lines.push(`### ${comparison.representative_name} -> ${comparison.top_result_name ?? "no hosted result"}`);
      lines.push(`- Representative source: ${comparison.representative_source_key}`);
      lines.push(`- Dataset / algorithm: ${comparison.dataset} / ${comparison.algorithm}`);
      lines.push(`- Hosted support category: ${comparison.support_category}`);
      lines.push(`- Hosted result count: ${comparison.hosted_result_count}`);
      lines.push(`- Local candidate statuses: ${formatList(comparison.local_candidate_statuses, 10)}`);
      lines.push(`- Local candidate methods: ${formatList(comparison.local_candidate_methods, 10)}`);
      lines.push(`- Local external candidate names: ${formatList(comparison.local_external_names, 10)}`);
      lines.push(`- Hosted top schema: ${comparison.top_result_schema ?? "n/a"}`);
      lines.push(`- Hosted top score: ${comparison.top_result_score ?? "n/a"}`);
      lines.push(`- Hosted top datasets: ${formatList(toStringArray(comparison.top_result_datasets), 10)}`);
      lines.push(`- Compared at: ${comparison.compared_at}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Counterparty edges");
  lines.push("");

  if (edges.length === 0) {
    lines.push("- No counterparty edges were found for this entity in the currently loaded data.");
  } else {
    for (const edge of edges) {
      lines.push(
        `- ${edge.entity_role} -> ${edge.counterparty_name ?? "Unknown"} (${edge.counterparty_role}): ${edge.process_count} processes across ${edge.source_count} source keys, ${edge.total_risk_signals} signals, linked process contract value ${formatAmount(edge.linked_contract_value)}, linked observed process payments ${formatAmount(edge.linked_paid_amount)}, signal codes ${formatList(edge.signal_codes, 20)}`,
      );
    }
  }

  lines.push("");
  lines.push("## Highest-signal related processes");
  lines.push("");

  for (const process of processes) {
    lines.push(`### ${process.title}`);
    lines.push(`- Source key: ${process.source_key}`);
    lines.push(`- Buyer: ${process.buyer_name ?? "Unknown"}`);
    if (process.suppliers && process.suppliers.length > 0) {
      lines.push(`- Suppliers: ${formatList(process.suppliers)}`);
    }
    lines.push(`- Status: ${process.status_details ?? "n/a"}`);
    lines.push(`- Max severity: ${process.max_severity}`);
    lines.push(`- Risk signal count: ${process.risk_signal_count}`);
    lines.push(`- Signal codes: ${formatList(process.signal_codes, 20)}`);
    lines.push(`- Published contract value: ${formatAmount(process.total_contract_value)}`);
    lines.push(`- Observed payments: ${formatAmount(process.total_paid_amount)}`);
    lines.push(`- Source: ${process.source_url ?? "n/a"}`);
    lines.push("");
  }

  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- This brief is the first Aleph/Sayari-style entity answer surface inside Centinela, built from procurement process, contract, payment, and flag data.");
  lines.push("- Counterparty edges are strongest when multiple years or external enrichment sources are loaded.");
  lines.push("- Linked contract and payment values are process-linked upper-bound context, not clean supplier-attributed amounts in multi-supplier procedures.");
  lines.push("- DNCP supplier anchors and DNIT RUC equivalence profiles are the strongest current local Paraguay identity layers in Centinela and should be preferred over weaker name-only assumptions.");
  lines.push("- The entity-intelligence triage section above is the current company-level review handoff: it turns anchor gaps, local administrative history, representative density, and external screening into one follow-up lens.");
  lines.push("- Representative links are official-profile relationship leads that make future ownership-style exploration possible, but they remain text-derived and reviewable.");
  lines.push("- OpenSanctions accepted matches, review-only candidates, and rejected diagnostics are separated so analysts can see why a lead was surfaced without treating it as proof of identity or wrongdoing.");
  lines.push("- Hosted matcher comparison evidence is now stored separately so analysts can distinguish same-candidate confirmations from broad-name alternative hits before promoting any candidate.");
  lines.push("- Future enrichment should add ownership, representation, and offshore context without overwriting local Paraguayan facts.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderReviewQueueReport(
  scopeLabel: string,
  summary: QueueSummaryRow | undefined,
  lanes: QueueLaneRow[],
  items: QueueItemRow[],
): string {
  const lines: string[] = [];
  lines.push(`# Review queue for ${scopeLabel}`);
  lines.push("");
  lines.push("This queue contains risk signals and follow-up prompts, not proof of wrongdoing.");
  lines.push("");

  if (summary) {
    lines.push("## Queue summary");
    lines.push("");
    lines.push(`- Total queued processes: ${summary.total_items}`);
    lines.push(`- Priority: ${summary.priority_items}`);
    lines.push(`- Enhanced review: ${summary.enhanced_review_items}`);
    lines.push(`- Triage: ${summary.triage_items}`);
    lines.push("");
  }

  lines.push("## Review lanes");
  lines.push("");
  for (const lane of lanes) {
    lines.push(`- ${lane.review_lane}: ${lane.item_count}`);
  }
  lines.push("");
  lines.push("## Queue items");
  lines.push("");

  for (const item of items) {
    lines.push(`### ${item.title}`);
    lines.push(`- Source key: ${item.source_key}`);
    lines.push(`- Priority: ${item.review_priority}`);
    lines.push(`- Review lane: ${item.review_lane}`);
    lines.push(`- Buyer: ${item.buyer_name ?? "Unknown"}`);
    if (item.suppliers && item.suppliers.length > 0) {
      lines.push(`- Suppliers: ${formatList(item.suppliers)}`);
    }
    lines.push(`- Status: ${item.status_details ?? "n/a"}`);
    lines.push(`- Risk signal count: ${item.risk_signal_count}`);
    lines.push(`- Signal codes: ${formatList(item.signal_codes, 20)}`);
    lines.push(`- Max pair occurrences: ${item.max_pair_occurrences}`);
    lines.push(`- Published contract value: ${formatAmount(item.total_contract_value)}`);
    lines.push(`- Observed payments: ${formatAmount(item.total_paid_amount)}`);
    lines.push(`- Lead question: ${item.lead_question}`);
    lines.push(`- Recommended action: ${item.recommended_action}`);
    lines.push(`- Source: ${item.source_url ?? "n/a"}`);
    lines.push("");
  }

  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- This queue is the first Dozorro/Rosie-style human follow-up surface inside Centinela.");
  lines.push("- Queue lanes and lead questions are now driven by the formal rule registry rather than hard-coded report-only semantics.");
  lines.push("- Priority ordering still combines rule-priority hints with severity, repeat-pair context, and signal count.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderEntityIntelligenceQueueReport(
  summary: EntityQueueSummaryRow | undefined,
  lanes: EntityQueueLaneRow[],
  candidateItems: EntityQueueItemRow[],
  items: EntityQueueItemRow[],
): string {
  const lines: string[] = [];
  lines.push("# Entity intelligence queue");
  lines.push("");
  lines.push("This queue contains company-level intelligence leads and anchor gaps, not proof of wrongdoing.");
  lines.push("");

  if (summary) {
    lines.push("## Coverage");
    lines.push("");
    lines.push(`- Supplier companies tracked: ${summary.total_supplier_entities}`);
    lines.push(`- Locally identity-anchored supplier companies: ${summary.anchored_supplier_entities}`);
    lines.push(`- Supplier companies still missing a local anchor: ${summary.unanchored_supplier_entities}`);
    lines.push(`- Supplier companies with local administrative signals: ${summary.local_signal_entities}`);
    lines.push(`- Supplier companies with external risk signals: ${summary.external_signal_entities}`);
    lines.push(`- Supplier companies with review-only external candidates: ${summary.external_candidate_entities}`);
    lines.push(`- Review-only external candidates stored: ${summary.external_review_candidate_count}`);
    lines.push(`- Rejected external diagnostics stored: ${summary.external_rejected_candidate_count}`);
    lines.push(`- Supplier companies with hosted same-candidate confirmation: ${summary.hosted_same_candidate_entities}`);
    lines.push(`- Supplier companies with hosted alternative-only result: ${summary.hosted_different_result_entities}`);
    lines.push(`- Supplier companies with hosted no-result outcome: ${summary.hosted_no_result_entities}`);
    lines.push(`- Representative links currently stored: ${summary.representative_link_count}`);
    lines.push("");
  }

  lines.push("## Review lanes");
  lines.push("");
  for (const lane of lanes) {
    lines.push(`- ${lane.review_lane}: ${lane.item_count}`);
  }
  lines.push("");

  lines.push("## External candidate review leads");
  lines.push("");

  if (candidateItems.length === 0) {
    lines.push("- No company-level review candidates are currently queued from external enrichment.");
  } else {
    for (const item of candidateItems) {
      lines.push(`### ${item.entity_name}`);
      lines.push(`- Anchor status: ${item.anchor_status}`);
      lines.push(`- Review priority: ${item.review_priority}`);
      lines.push(`- Review lane: ${item.review_lane}`);
      lines.push(`- External candidate count: ${item.external_candidate_count}`);
      lines.push(`- External review candidates: ${item.external_review_candidate_count}`);
      lines.push(`- Rejected external diagnostics: ${item.external_rejected_candidate_count}`);
      lines.push(`- Highest external candidate confidence: ${item.max_external_candidate_confidence}`);
      lines.push(`- External match count: ${item.external_match_count}`);
      lines.push(`- External signal count: ${item.external_signal_count}`);
      lines.push(`- Latest hosted support: ${item.hosted_support_category ?? "n/a"}`);
      lines.push(`- Latest hosted top result: ${item.hosted_top_result_name ?? "n/a"}`);
      lines.push(`- Latest hosted top score: ${item.hosted_top_result_score ?? "n/a"}`);
      lines.push(`- Latest hosted top datasets: ${formatList(toStringArray(item.hosted_top_result_datasets), 10)}`);
      lines.push(`- Source keys: ${formatList(item.source_keys, 10)}`);
      lines.push(`- Representative links: ${item.representative_count}`);
      lines.push(`- Lead question: ${item.lead_question}`);
      lines.push(`- Recommended action: ${item.recommended_action}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("## Highest-priority entity leads");
  lines.push("");
  for (const item of items) {
    lines.push(`### ${item.entity_name}`);
    lines.push(`- Anchor status: ${item.anchor_status}`);
    lines.push(`- Review priority: ${item.review_priority}`);
    lines.push(`- Review lane: ${item.review_lane}`);
    lines.push(`- Source keys: ${formatList(item.source_keys, 10)}`);
    lines.push(`- Total supplier processes: ${item.total_process_count}`);
    lines.push(`- Flagged processes: ${item.flagged_process_count}`);
    lines.push(`- Procurement risk signals: ${item.total_risk_signals}`);
    lines.push(`- Supplier-linked process contract value: ${formatAmount(item.supplier_linked_contract_value)}`);
    lines.push(`- Supplier-linked observed payments: ${formatAmount(item.supplier_linked_paid_amount)}`);
    lines.push(`- Local signal count: ${item.local_signal_count}`);
    lines.push(`- Local signal codes: ${formatList(item.local_signal_codes, 20)}`);
    lines.push(`- Highest local severity: ${item.max_local_severity}`);
    lines.push(`- External match count: ${item.external_match_count}`);
    lines.push(`- External signal count: ${item.external_signal_count}`);
    lines.push(`- Highest external severity: ${item.max_external_severity}`);
    lines.push(`- External candidate count: ${item.external_candidate_count}`);
    lines.push(`- External review candidates: ${item.external_review_candidate_count}`);
    lines.push(`- Rejected external diagnostics: ${item.external_rejected_candidate_count}`);
    lines.push(`- Highest external candidate confidence: ${item.max_external_candidate_confidence}`);
    lines.push(`- Latest hosted support: ${item.hosted_support_category ?? "n/a"}`);
    lines.push(`- Latest hosted top result: ${item.hosted_top_result_name ?? "n/a"}`);
    lines.push(`- Latest hosted top score: ${item.hosted_top_result_score ?? "n/a"}`);
    lines.push(`- Representative links: ${item.representative_count}`);
    lines.push(`- Lead question: ${item.lead_question}`);
    lines.push(`- Recommended action: ${item.recommended_action}`);
    lines.push("");
  }

  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- This queue separates company-level intelligence review from process-level red-flag triage.");
  lines.push("- Unanchored suppliers remain investigative gaps, not negative findings.");
  lines.push("- Local DNCP administrative history, DNIT identity validation, and OpenSanctions screening should be treated as reviewable source-backed context, not legal conclusions.");
  lines.push("- External candidate counts are not matches. They preserve near-match and rejection evidence so analysts can decide whether stronger source evidence is needed.");
  lines.push("- Hosted same-candidate confirmation strengthens a lead, but it still does not by itself resolve identity or prove wrongdoing.");
  lines.push("- Representative links are relationship leads that improve future ownership-style exploration but still require human validation.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderExternalCandidateReviewReport(
  summaries: ExternalCandidateSummaryRow[],
  methods: ExternalCandidateMethodRow[],
  reviewStatuses: ExternalCandidateReviewStatusRow[],
  items: ExternalCandidateItemRow[],
): string {
  const lines: string[] = [];
  lines.push("# External enrichment candidate review");
  lines.push("");
  lines.push("This report contains review-only external candidates and rejected diagnostics, not accepted matches or proof of wrongdoing.");
  lines.push("");

  lines.push("## Coverage");
  lines.push("");
  if (summaries.length === 0) {
    lines.push("- No external enrichment candidates are currently stored.");
  } else {
    for (const summary of summaries) {
      lines.push(
        `- ${summary.candidate_status} / ${summary.local_screening_role}: ${summary.candidate_count} records across ${summary.local_entity_count} local entities; max confidence ${summary.max_match_confidence}`,
      );
    }
  }
  lines.push("");

  lines.push("## Method distribution");
  lines.push("");
  if (methods.length === 0) {
    lines.push("- n/a");
  } else {
    for (const method of methods) {
      lines.push(
        `- ${method.candidate_status} / ${method.match_method}: ${method.candidate_count} records across ${method.local_entity_count} local entities; max confidence ${method.max_match_confidence}`,
      );
    }
  }
  lines.push("");

  lines.push("## Manual review status distribution");
  lines.push("");
  if (reviewStatuses.length === 0) {
    lines.push("- n/a");
  } else {
    for (const status of reviewStatuses) {
      lines.push(
        `- ${status.review_status}: ${status.candidate_count} records across ${status.local_entity_count} local entities; max confidence ${status.max_match_confidence}`,
      );
    }
  }
  lines.push("");

  lines.push("## Candidate and diagnostic records");
  lines.push("");
  if (items.length === 0) {
    lines.push("- No records to review.");
  } else {
    for (const item of items) {
      const datasets = formatList(toStringArray(item.external_datasets), 10);
      const countries = formatList(toStringArray(item.external_countries), 10);
      const externalIdentifiers = formatList(toStringArray(item.external_identifiers), 10);
      const sharedTokens = findEvidenceValueAsText(item.evidence, "shared_tokens") ?? "n/a";
      const distinctiveSharedTokens = findEvidenceValueAsText(item.evidence, "distinctive_shared_tokens") ?? "n/a";
      const genericSharedTokens = findEvidenceValueAsText(item.evidence, "generic_shared_tokens") ?? "n/a";
      const tokenSimilarity = findEvidenceValueAsText(item.evidence, "token_similarity") ?? "n/a";
      const distinctiveTokenOverlap = findEvidenceValueAsText(item.evidence, "distinctive_token_overlap") ?? "n/a";
      const nameOrderScore = findEvidenceValueAsText(item.evidence, "name_order_score") ?? "n/a";
      const localSearchName = findEvidenceValueAsText(item.evidence, "local_search_name") ?? "n/a";
      const linkedCompanies = findEvidenceValueAsText(item.evidence, "linked_company_names") ?? "n/a";
      const reviewCommandStatuses = new Set(["needs_evidence", "promotable", "monitor", "rejected", "unreviewed"]);
      const commandStatus =
        item.suggested_review_status &&
        item.suggested_review_status !== "unreviewed" &&
        reviewCommandStatuses.has(item.suggested_review_status)
          ? item.suggested_review_status
          : item.candidate_status === "rejected_diagnostic"
            ? "rejected"
            : "needs_evidence";
      const shouldShowReviewCommand =
        !["accepted_match", "rejected_match"].includes(item.second_review_decision ?? "") &&
        reviewCommandStatuses.has(commandStatus);

      lines.push(`### ${item.entity_name} -> ${item.external_name}`);
      lines.push(`- Candidate ID: ${item.id}`);
      lines.push(`- Candidate status: ${item.candidate_status}`);
      lines.push(`- Local / external type: ${item.entity_type} (${item.local_screening_role}) -> ${item.external_entity_type}${item.external_schema ? ` (${item.external_schema})` : ""}`);
      lines.push(`- Match method: ${item.match_method}`);
      lines.push(`- Match confidence / quality: ${item.match_confidence} / ${item.match_quality}`);
      lines.push(`- Review status: ${item.review_status}`);
      lines.push(`- Suggested review status: ${item.suggested_review_status ?? "n/a"}`);
      lines.push(`- Review priority hint: ${item.review_priority_hint ?? "n/a"}`);
      lines.push(`- Reviewed by / at: ${item.reviewed_by ?? "n/a"} / ${item.reviewed_at ?? "n/a"}`);
      lines.push(`- Review notes: ${item.review_notes ?? "n/a"}`);
      lines.push(`- Review evidence history: ${formatReviewEvidenceHistory(item.review_evidence)}`);
      lines.push(`- Second-review decision: ${item.second_review_decision ?? "n/a"}`);
      lines.push(`- Second-reviewed by / at: ${item.second_reviewed_by ?? "n/a"} / ${item.second_reviewed_at ?? "n/a"}`);
      lines.push(`- Second-review rationale: ${item.second_review_rationale ?? "n/a"}`);
      lines.push(`- Second-review limitations: ${item.second_review_limitations ?? "n/a"}`);
      lines.push(`- Second-review evidence: ${formatReviewEvidenceHistory(item.second_review_evidence, 5)}`);
      lines.push(`- Accepted match ID: ${item.accepted_match_id ?? "n/a"}`);
      lines.push(`- Local identifiers: ${formatList(item.local_identifiers, 12)}`);
      lines.push(`- Local RUC identifiers: ${formatList(item.local_ruc_identifiers, 8)}`);
      lines.push(`- Local profile sources: ${formatList(item.local_profile_sources, 8)}`);
      lines.push(`- Local profile names: ${formatList(item.local_profile_names, 8)}`);
      lines.push(`- Local profile RUCs: ${formatList(item.local_profile_rucs, 8)}`);
      lines.push(`- Rejection reason: ${item.rejection_reason ?? "n/a"}`);
      lines.push(`- Latest hosted support: ${item.hosted_support_category ?? "n/a"}`);
      lines.push(`- Latest hosted top result: ${item.hosted_top_result_name ?? "n/a"}`);
      lines.push(`- Latest hosted top score: ${item.hosted_top_result_score ?? "n/a"}`);
      lines.push(`- Latest hosted top datasets: ${formatList(toStringArray(item.hosted_top_result_datasets), 10)}`);
      lines.push(`- Latest hosted compared at: ${item.hosted_compared_at ?? "n/a"}`);
      lines.push(`- Source: ${item.source_key}`);
      lines.push(`- External datasets: ${datasets}`);
      lines.push(`- External countries: ${countries}`);
      lines.push(`- External identifiers: ${externalIdentifiers}`);
      lines.push(`- Local search name: ${localSearchName}`);
      lines.push(`- Shared tokens: ${sharedTokens}`);
      lines.push(`- Distinctive shared tokens: ${distinctiveSharedTokens}`);
      lines.push(`- Generic shared tokens: ${genericSharedTokens}`);
      lines.push(`- Token similarity: ${tokenSimilarity}`);
      lines.push(`- Distinctive token overlap: ${distinctiveTokenOverlap}`);
      lines.push(`- Name order score: ${nameOrderScore}`);
      lines.push(`- Linked local companies: ${linkedCompanies}`);
      lines.push(`- Rationale: ${item.rationale}`);
      lines.push(`- Review next step: ${item.review_next_step ?? "n/a"}`);
      if (shouldShowReviewCommand) {
        lines.push(
          `- Review command: npm run database:review-external-candidate -- --candidate-id ${item.id} --status ${commandStatus} --reviewer "<name>" --notes "<short rationale>"`,
        );
      } else {
        lines.push("- Review command: n/a - this row has a closed second-review decision; use the accepted-match and limitation fields instead.");
      }
      if (item.review_status === "promotable" && item.second_review_decision !== "accepted_match") {
        lines.push(
          `- Second-review command: npm run database:second-review-external-candidate -- --candidate-id ${item.id} --decision accepted_match --reviewer "<second reviewer>" --rationale "<why the identity match is acceptable>" --limitations "<what this match does not prove>"`,
        );
      }
      lines.push("");
    }
  }

  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- Review candidates require human validation before they can become accepted matches or risk signals.");
  lines.push("- Rejected diagnostics are intentionally visible so analysts can see what was considered and why it was not escalated.");
  lines.push("- Partial person-name overlap is weak evidence unless source documents, identifiers, dates, or stronger official context support the link.");
  lines.push("- Company candidates should be reviewed with local RUC, DNCP/DNIT profile names, source documents, and procurement context before any promotion.");
  lines.push("- Hosted support is comparison evidence: `same_local_candidate` is stronger than `different_hosted_result`, and both are stronger than name-only bulk overlap alone.");
  lines.push("- Manual review statuses are operational workflow labels. `promotable` means ready for a stronger second review, not an accepted match.");
  lines.push("- Second-review `accepted_match` creates an enrichment identity match only. It does not create an external risk signal or prove misconduct.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderEntityAnchorGapReport(
  summary: AnchorGapSummaryRow | undefined,
  items: AnchorGapItemRow[],
): string {
  const lines: string[] = [];
  lines.push("# Entity anchor gap review");
  lines.push("");
  lines.push("This report lists unresolved local supplier identity anchors. A gap is an investigative data-quality lead, not a negative finding.");
  lines.push("");

  if (summary) {
    lines.push("## Coverage");
    lines.push("");
    lines.push(`- Unresolved supplier anchor gaps: ${summary.total_gaps}`);
    lines.push(`- Gaps with a RUC-like identifier: ${summary.gaps_with_ruc}`);
    lines.push(`- Gaps without a RUC-like identifier: ${summary.gaps_without_ruc}`);
    lines.push(`- Gap entities with flagged procurement activity: ${summary.flagged_gap_entities}`);
    lines.push(`- Procurement risk signals attached to gap entities: ${summary.total_gap_risk_signals}`);
    lines.push("");
  }

  lines.push("## Highest-value gaps");
  lines.push("");

  if (items.length === 0) {
    lines.push("- No supplier anchor gaps are currently visible in the live entity queue.");
  }

  for (const item of items) {
    lines.push(`### ${item.entity_name}`);
    lines.push(`- Review priority: ${item.review_priority}`);
    lines.push(`- Gap reason: ${item.gap_reason}`);
    lines.push(`- Source keys: ${formatList(item.source_keys, 10)}`);
    lines.push(`- Total supplier processes: ${item.total_process_count}`);
    lines.push(`- Flagged processes: ${item.flagged_process_count}`);
    lines.push(`- Procurement risk signals: ${item.total_risk_signals}`);
    lines.push(`- Supplier-linked process contract value: ${formatAmount(item.supplier_linked_contract_value)}`);
    lines.push(`- Supplier-linked observed payments: ${formatAmount(item.supplier_linked_paid_amount)}`);
    lines.push(`- Identifiers: ${formatList(item.identifiers, 10)}`);
    lines.push(`- RUC identifiers: ${formatList(item.ruc_identifiers, 10)}`);
    lines.push(`- Has RUC-like identifier: ${item.has_ruc_identifier ? "yes" : "no"}`);
    lines.push(`- Procurement source mentions: ${item.procurement_source_mention_count}`);
    lines.push(`- Observed names: ${formatList(item.observed_names, 8)}`);
    lines.push(`- Lead question: ${item.lead_question}`);
    lines.push(`- Next resolution step: ${item.next_resolution_step}`);
    lines.push(`- Queue action: ${item.recommended_action}`);
    lines.push("");
  }

  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- This lane operationalizes the br/acc-style source-registry discipline: unresolved company identities stay visible until a traceable local anchor or lawful external source resolves them.");
  lines.push("- RUC-like identifiers are useful resolution clues but are not treated as proof that a DNCP supplier profile still exists or is current.");
  lines.push("- These gaps should be resolved before OpenSanctions, offshore, or ownership-style enrichment is treated as strong entity intelligence.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export async function buildAnalystBrief(sourceKey: string): Promise<{ report: string; reportPath: string }> {
  const { client, schema } = await connectToPostgres();

  try {
    const summaryResult = await client.query<SourceSummaryRow>(
      `select
         count(*)::text as total_processes,
         count(*) filter (where risk_signal_count > 0)::text as flagged_processes,
         coalesce(sum(risk_signal_count), 0)::text as total_risk_signals,
         sum(total_contract_value)::text as total_contract_value,
         sum(total_paid_amount)::text as total_paid_amount
       from ${schema}.process_risk_overview
       where source_key = $1`,
      [sourceKey],
    );

    const leadsResult = await client.query<LeadRow>(
      `select
         title,
         buyer_name,
         status_details,
         suppliers,
         risk_signal_count::text,
         max_severity,
         signal_codes,
         total_contract_value::text,
         total_paid_amount::text,
         source_url
       from ${schema}.process_risk_overview as overview
       where overview.source_key = $1
       order by overview.max_severity_rank desc, overview.risk_signal_count desc, coalesce(overview.total_paid_amount, 0) desc, coalesce(overview.total_contract_value, 0) desc, overview.title
       limit 12`,
      [sourceKey],
    );

    const flagResult = await client.query<FlagBreakdownRow>(
      `select
         signals.signal_code,
         min(signals.signal_name) as signal_name,
         min(signals.severity) as severity,
         count(*)::text as process_count,
         round(avg(signals.score)::numeric, 2)::text as avg_score
       from ${schema}.risk_signals as signals
       join ${schema}.procurement_processes as processes
         on processes.id = signals.process_id
       where processes.source_key = $1
       group by signals.signal_code
       order by count(*) desc, signals.signal_code`,
      [sourceKey],
    );

    const buyerResult = await client.query<BuyerSummaryRow>(
      `select
         buyer_name,
         count(*)::text as process_count,
         coalesce(sum(risk_signal_count), 0)::text as total_risk_signals,
         sum(total_paid_amount)::text as total_paid_amount
       from ${schema}.process_risk_overview
       where source_key = $1
         and risk_signal_count > 0
       group by buyer_name
       order by sum(risk_signal_count) desc, count(*) desc, coalesce(sum(total_paid_amount), 0) desc
       limit 10`,
      [sourceKey],
    );

    const pairResult = await client.query<PairSummaryRow>(
      `select
         buyer_name,
         supplier_name,
         process_count::text,
         total_risk_signals::text,
         total_contract_value::text,
         total_paid_amount::text
       from ${schema}.buyer_supplier_pair_summary as pairs
       where pairs.source_key = $1
         and pairs.process_count > 1
       order by pairs.process_count desc, pairs.total_risk_signals desc, coalesce(pairs.total_paid_amount, 0) desc, coalesce(pairs.total_contract_value, 0) desc
       limit 10`,
      [sourceKey],
    );

    const report = renderAnalystBrief(
      sourceKey,
      summaryResult.rows[0],
      leadsResult.rows,
      flagResult.rows,
      buyerResult.rows,
      pairResult.rows,
    );
    const reportPath = await writeOutputText(["reports", "paraguay", `${sourceKey}-analyst-brief.md`], report);

    return {
      report,
      reportPath,
    };
  } finally {
    await client.end();
  }
}

export async function buildEntityBrief(
  entityName: string,
  entityType?: string,
): Promise<{ report: string; reportPath: string; entityName: string }> {
  const { client, schema } = await connectToPostgres();

  try {
    const entityResult = await client.query<EntityOverviewRow>(
      `select
         entity_id::text,
         entity_name,
         entity_type,
         source_count::text,
         source_keys,
         total_process_count::text,
         supplier_process_count::text,
         buyer_process_count::text,
         flagged_process_count::text,
         total_risk_signals::text,
         supplier_linked_contract_value::text,
         supplier_linked_paid_amount::text,
         buyer_linked_contract_value::text,
         buyer_linked_paid_amount::text,
         first_published_at::text,
         last_published_at::text
       from ${schema}.entity_procurement_activity as activity
       where
         (lower(activity.entity_name) = lower($1) or lower(activity.entity_name) like lower($2))
         and ($3::text is null or activity.entity_type = $3)
       order by
         case when lower(activity.entity_name) = lower($1) then 0 else 1 end,
         activity.total_risk_signals desc,
         activity.total_process_count desc
       limit 1`,
      [entityName, `%${entityName}%`, entityType ?? null],
    );

    const entity = entityResult.rows[0];
    if (!entity) {
      throw new Error(`No entity found for "${entityName}" in the loaded Centinela database view.`);
    }

    const identifierResult = await client.query<EntityIdentifierRow>(
      `select
         scheme,
         value,
         is_primary
       from ${schema}.entity_identifiers
       where entity_id::text = $1
       order by is_primary desc, scheme, value`,
      [entity.entity_id],
    );

    const sourceMentionResult = await client.query<EntitySourceMentionRow>(
      `select
         source_key,
         role,
         source_external_id,
         observed_name
       from ${schema}.entity_source_mentions
       where entity_id::text = $1
       order by source_key, role, source_external_id`,
      [entity.entity_id],
    );

    const triageResult = await client.query<EntityTriageRow>(
      `select
         anchor_status,
         local_profile_count::text,
         local_adjudication_count::text,
         local_signal_count::text,
         local_signal_codes,
         max_local_severity,
         external_match_count::text,
         external_signal_count::text,
         max_external_severity,
         external_candidate_count::text,
         external_review_candidate_count::text,
         external_rejected_candidate_count::text,
         max_external_candidate_confidence::text,
         representative_count::text,
         review_priority,
         review_lane,
         lead_question,
         recommended_action
       from ${schema}.entity_intelligence_review_queue
       where entity_id::text = $1`,
      [entity.entity_id],
    );

    const localProfileResult = await client.query<EntityLocalProfileRow>(
      `select
         source_key,
         profile_kind,
         profile_status,
         match_method,
         match_confidence::text,
         review_status,
         profile_title,
         summary,
         nullif(provider_slug, '') as provider_slug,
         nullif(ruc, '') as ruc,
         nullif(attributes ->> 'registryIdentifier', '') as registry_identifier,
         nullif(attributes ->> 'registryIdentifierScheme', '') as registry_identifier_scheme,
         nullif(attributes ->> 'taxpayerStatus', '') as taxpayer_status,
         nullif(official_name, '') as official_name,
         nullif(supplier_type, '') as supplier_type,
         nullif(company_size, '') as company_size,
         nullif(activity_type, '') as activity_type,
         nullif(registry_activation_at, '') as registry_activation_at,
         nullif(sipe_activation_at, '') as sipe_activation_at,
         nullif(inscription_at, '') as inscription_at,
         nullif(detail_url, '') as detail_url,
         nullif(email, '') as email,
         nullif(phone, '') as phone,
         nullif(address, '') as address,
         nullif(city, '') as city,
         nullif(department, '') as department,
         nullif(country, '') as country,
         adjudication_count,
         representatives
       from ${schema}.entity_local_profile_overview
       where entity_id::text = $1
       order by match_confidence desc nulls last, source_key`,
      [entity.entity_id],
    );

    const localSignalResult = await client.query<EntityIntelligenceSignalRow>(
      `select
         source_key,
         signal_code,
         signal_name,
         signal_scope,
         category,
         severity,
         score::text,
         rationale,
         evidence
       from ${schema}.entity_intelligence_signal_overview
       where entity_id::text = $1
       order by
         case severity
           when 'high' then 3
           when 'medium' then 2
           when 'low' then 1
           else 0
         end desc,
         score desc,
         signal_code`,
      [entity.entity_id],
    );

    const enrichmentResult = await client.query<EntityEnrichmentRow>(
      `select
         matched_entity_name,
         matched_entity_type,
         source_key,
         match_method,
         match_confidence::text,
         match_quality,
         review_status,
         rationale,
         external_schema #>> '{}' as external_schema,
         external_datasets,
         external_countries,
         external_program_ids,
         signal_codes,
         signal_names,
         signal_categories,
         max_severity,
         evidence
       from ${schema}.entity_external_match_overview
       where entity_id::text = $1
       order by
         case match_quality
           when 'high' then 3
           when 'medium' then 2
           else 1
         end desc,
         coalesce(match_confidence, 0) desc,
         case max_severity
           when 'high' then 3
           when 'medium' then 2
           when 'low' then 1
           else 0
         end desc,
         matched_entity_name
       limit 12`,
      [entity.entity_id],
    );

    const externalCandidateResult = await client.query<EntityExternalCandidateRow>(
      `select
         id::text,
         entity_name,
         source_key,
         external_name,
         external_entity_type,
         external_schema,
         local_screening_role,
         candidate_status,
         match_method,
         match_confidence::text,
         match_quality,
         review_status,
         reviewed_at::text,
         reviewed_by,
         review_notes,
         review_evidence,
         second_review_id::text,
         second_review_decision,
         second_reviewed_at::text,
         second_reviewed_by,
         second_review_rationale,
         second_review_limitations,
         second_review_evidence,
         accepted_match_id::text,
         rejection_reason,
         rationale,
         external_datasets,
         external_countries,
         external_identifiers,
         evidence,
         hosted_support_category,
         hosted_top_result_name,
         hosted_top_result_score::text,
         hosted_top_result_datasets,
         hosted_compared_at::text,
         suggested_review_status,
         review_priority_hint,
         review_next_step,
         local_identifiers,
         local_ruc_identifiers,
         local_profile_sources,
         local_profile_names,
         local_profile_rucs
       from ${schema}.entity_enrichment_candidate_review_overview
       where entity_id::text = $1
       order by
         case candidate_status
           when 'review_candidate' then 2
           else 1
         end desc,
         case review_priority_hint
           when 'high' then 4
           when 'medium' then 3
           when 'diagnostic' then 2
           else 1
         end desc,
         match_confidence desc,
         external_name
       limit 12`,
      [entity.entity_id],
    );

    const hostedComparisonResult = await client.query<EntityHostedComparisonRow>(
      `select
         local_screening_role,
         dataset,
         algorithm,
         threshold::text,
         result_limit::text,
         support_category,
         hosted_result_count::text,
         local_candidate_statuses,
         local_candidate_methods,
         local_candidate_max_confidence::text,
         local_external_ids,
         local_external_names,
         linked_company_names,
         top_result_name,
         top_result_schema,
         top_result_score::text,
         top_result_datasets,
         compared_at::text
       from ${schema}.entity_hosted_match_comparison_overview
       where entity_id::text = $1
       order by compared_at desc, local_screening_role
       limit 12`,
      [entity.entity_id],
    );

    const representativeResult = await client.query<EntityRepresentativeRow>(
      `select
         representative_name,
         source_key,
         confidence::text,
         nullif(provider_slug, '') as provider_slug,
         nullif(provider_ruc, '') as provider_ruc
       from ${schema}.entity_representative_overview
       where entity_id::text = $1
       order by representative_name`,
      [entity.entity_id],
    );

    const representativeExternalMatchResult = await client.query<RepresentativeExternalMatchRow>(
      `select
         representatives.representative_name,
         representatives.source_key as representative_source_key,
         matches.source_key,
         matches.match_method,
         matches.match_confidence::text,
         matches.match_quality,
         matches.review_status,
         matches.rationale,
         matches.matched_entity_name as external_name,
         matches.matched_entity_type as external_type,
         matches.external_schema #>> '{}' as external_schema,
         matches.external_datasets,
         matches.external_countries,
         matches.signal_codes,
         matches.max_severity
       from ${schema}.entity_representative_overview as representatives
       join ${schema}.entity_external_match_overview as matches
         on matches.entity_id = representatives.representative_entity_id
       where representatives.entity_id::text = $1
       order by
         case matches.match_quality
           when 'high' then 3
           when 'medium' then 2
           else 1
         end desc,
         coalesce(matches.match_confidence, 0) desc,
         representatives.representative_name,
         matches.matched_entity_name
       limit 12`,
      [entity.entity_id],
    );

    const representativeHostedComparisonResult = await client.query<RepresentativeHostedComparisonRow>(
      `select
         representatives.representative_name,
         representatives.source_key as representative_source_key,
         hosted.local_screening_role,
         hosted.dataset,
         hosted.algorithm,
         hosted.threshold::text,
         hosted.result_limit::text,
         hosted.support_category,
         hosted.hosted_result_count::text,
         hosted.local_candidate_statuses,
         hosted.local_candidate_methods,
         hosted.local_candidate_max_confidence::text,
         hosted.local_external_ids,
         hosted.local_external_names,
         hosted.linked_company_names,
         hosted.top_result_name,
         hosted.top_result_schema,
         hosted.top_result_score::text,
         hosted.top_result_datasets,
         hosted.compared_at::text
       from ${schema}.entity_representative_overview as representatives
       join ${schema}.entity_hosted_match_comparison_overview as hosted
         on hosted.entity_id = representatives.representative_entity_id
       where representatives.entity_id::text = $1
       order by hosted.compared_at desc, representatives.representative_name
       limit 12`,
      [entity.entity_id],
    );

    const representativeExternalCandidateResult = await client.query<RepresentativeExternalCandidateRow>(
      `select
         representatives.representative_name,
         representatives.source_key as representative_source_key,
         candidates.id::text,
         candidates.entity_name,
         candidates.source_key,
         candidates.external_name,
         candidates.external_entity_type,
         candidates.external_schema,
         candidates.local_screening_role,
         candidates.candidate_status,
         candidates.match_method,
         candidates.match_confidence::text,
         candidates.match_quality,
         candidates.review_status,
         candidates.reviewed_at::text,
         candidates.reviewed_by,
         candidates.review_notes,
         candidates.review_evidence,
         candidates.second_review_id::text,
         candidates.second_review_decision,
         candidates.second_reviewed_at::text,
         candidates.second_reviewed_by,
         candidates.second_review_rationale,
         candidates.second_review_limitations,
         candidates.second_review_evidence,
         candidates.accepted_match_id::text,
         candidates.rejection_reason,
         candidates.rationale,
         candidates.external_datasets,
         candidates.external_countries,
         candidates.external_identifiers,
         candidates.evidence,
         candidates.hosted_support_category,
         candidates.hosted_top_result_name,
         candidates.hosted_top_result_score::text,
         candidates.hosted_top_result_datasets,
         candidates.hosted_compared_at::text,
         candidates.suggested_review_status,
         candidates.review_priority_hint,
         candidates.review_next_step,
         candidates.local_identifiers,
         candidates.local_ruc_identifiers,
         candidates.local_profile_sources,
         candidates.local_profile_names,
         candidates.local_profile_rucs
       from ${schema}.entity_representative_overview as representatives
       join ${schema}.entity_enrichment_candidate_review_overview as candidates
         on candidates.entity_id = representatives.representative_entity_id
       where representatives.entity_id::text = $1
       order by
         case candidates.candidate_status
           when 'review_candidate' then 2
           else 1
         end desc,
         case candidates.review_priority_hint
           when 'high' then 4
           when 'medium' then 3
           when 'diagnostic' then 2
           else 1
         end desc,
         candidates.match_confidence desc,
         representatives.representative_name,
         candidates.external_name
       limit 12`,
      [entity.entity_id],
    );

    const sourceRecordResult = await client.query<EntitySourceRecordRow>(
      `select
         records.id::text,
         records.source_key,
         records.external_id,
         records.record_kind,
         records.source_url,
         records.retrieved_at::text,
         coalesce(
           records.payload #>> '{document,title}',
           records.payload #>> '{release,releaseId}',
           records.payload #>> '{process,title}',
           records.external_id
         ) as record_title,
         records.payload #>> '{process,title}' as process_title,
         coalesce(
           records.payload #>> '{document,documentTypeDetails}',
           records.payload #>> '{document,documentType}'
         ) as document_type,
         records.payload #>> '{fieldPath}' as field_path
       from ${schema}.source_records as records
       where coalesce(records.payload #>> '{centinelaTarget,entityId}', records.payload #>> '{centinelaTarget,entity_id}') = $1
       order by
         case records.record_kind when 'ocds_release_package' then 0 else 1 end,
         records.retrieved_at desc,
         records.id desc
       limit 12`,
      [entity.entity_id],
    );

    const edgesResult = await client.query<EntityEdgeRow>(
      `select
         case when buyer_entity_id::text = $1 then 'buyer' else 'supplier' end as entity_role,
         case when buyer_entity_id::text = $1 then supplier_name else buyer_name end as counterparty_name,
         case when buyer_entity_id::text = $1 then 'supplier' else 'buyer' end as counterparty_role,
         source_count::text,
         source_keys,
         process_count::text,
         flagged_process_count::text,
         total_risk_signals::text,
         linked_contract_value::text,
         linked_paid_amount::text,
         signal_codes
       from ${schema}.buyer_supplier_edge_overview as edges
       where edges.buyer_entity_id::text = $1
          or edges.supplier_entity_id::text = $1
       order by edges.process_count desc, edges.total_risk_signals desc, coalesce(edges.linked_paid_amount, 0) desc, coalesce(edges.linked_contract_value, 0) desc
       limit 12`,
      [entity.entity_id],
    );

    const processResult = await client.query<EntityProcessRow>(
      `select
         matches.title,
         matches.source_key,
         matches.buyer_name,
         matches.suppliers,
         matches.status_details,
         matches.risk_signal_count::text,
         matches.signal_codes,
         matches.max_severity,
         matches.total_contract_value::text,
         matches.total_paid_amount::text,
         matches.source_url
       from (
         select
           overview.process_id,
           overview.title,
           overview.source_key,
           overview.buyer_name,
           overview.suppliers,
           overview.status_details,
           overview.risk_signal_count,
           overview.signal_codes,
           overview.max_severity,
           overview.max_severity_rank,
           overview.total_contract_value,
           overview.total_paid_amount,
           overview.source_url
         from ${schema}.process_risk_overview as overview
         join ${schema}.process_parties as parties
           on parties.process_id = overview.process_id
         where parties.entity_id::text = $1
         group by
           overview.process_id,
           overview.title,
           overview.source_key,
           overview.buyer_name,
           overview.suppliers,
           overview.status_details,
           overview.risk_signal_count,
           overview.signal_codes,
           overview.max_severity,
           overview.max_severity_rank,
           overview.total_contract_value,
           overview.total_paid_amount,
           overview.source_url
       ) as matches
       order by matches.max_severity_rank desc, matches.risk_signal_count desc, coalesce(matches.total_paid_amount, 0) desc, coalesce(matches.total_contract_value, 0) desc, matches.title
       limit 12`,
      [entity.entity_id],
    );

    const report = renderEntityBrief(
      entity,
      identifierResult.rows,
      sourceMentionResult.rows,
      triageResult.rows[0],
      localProfileResult.rows,
      localSignalResult.rows,
      enrichmentResult.rows,
      externalCandidateResult.rows,
      hostedComparisonResult.rows,
      representativeResult.rows,
      representativeExternalMatchResult.rows,
      representativeExternalCandidateResult.rows,
      representativeHostedComparisonResult.rows,
      sourceRecordResult.rows,
      edgesResult.rows,
      processResult.rows,
    );
    const reportPath = await writeOutputText(
      ["reports", "paraguay", "entities", `${slugify(entity.entity_name)}-entity-brief.md`],
      report,
    );

    return {
      report,
      reportPath,
      entityName: entity.entity_name,
    };
  } finally {
    await client.end();
  }
}

export async function buildReviewQueueReport(
  limit = 20,
  sourceKey?: string,
): Promise<{ report: string; reportPath: string }> {
  const { client, schema } = await connectToPostgres();

  try {
    const summaryResult = await client.query<QueueSummaryRow>(
      `select
         count(*)::text as total_items,
         count(*) filter (where review_priority = 'priority')::text as priority_items,
         count(*) filter (where review_priority = 'enhanced_review')::text as enhanced_review_items,
         count(*) filter (where review_priority = 'triage')::text as triage_items
       from ${schema}.process_review_queue
       where ($1::text is null or source_key = $1)`,
      [sourceKey ?? null],
    );

    const lanesResult = await client.query<QueueLaneRow>(
      `select
         review_lane,
         count(*)::text as item_count
       from ${schema}.process_review_queue
       where ($1::text is null or source_key = $1)
       group by review_lane
       order by count(*) desc, review_lane`,
      [sourceKey ?? null],
    );

    const itemsResult = await client.query<QueueItemRow>(
      `select
         title,
         source_key,
         buyer_name,
         suppliers,
         status_details,
         review_priority,
         review_lane,
         risk_signal_count::text,
         signal_codes,
         max_pair_occurrences::text,
         total_contract_value::text,
         total_paid_amount::text,
         recommended_action,
         lead_question,
         source_url
        from ${schema}.process_review_queue as queue
       where ($1::text is null or queue.source_key = $1)
       order by
         case queue.review_priority
           when 'priority' then 3
           when 'enhanced_review' then 2
           else 1
         end desc,
         coalesce(queue.max_pair_occurrences, 0) desc,
         queue.risk_signal_count desc,
         coalesce(queue.total_paid_amount, 0) desc,
         coalesce(queue.total_contract_value, 0) desc,
         queue.title
       limit $2`,
      [sourceKey ?? null, limit],
    );

    const scopeLabel = sourceKey ?? "all loaded sources";
    const report = renderReviewQueueReport(scopeLabel, summaryResult.rows[0], lanesResult.rows, itemsResult.rows);
    const fileName = sourceKey ? `${sourceKey}-review-queue.md` : "all-sources-review-queue.md";
    const reportPath = await writeOutputText(["reports", "paraguay", fileName], report);

    return {
      report,
      reportPath,
    };
  } finally {
    await client.end();
  }
}

export async function buildEntityIntelligenceQueueReport(
  limit = 25,
): Promise<{ report: string; reportPath: string }> {
  const { client, schema } = await connectToPostgres();

  try {
    const summaryResult = await client.query<EntityQueueSummaryRow>(
      `with hosted_company_summary as (
         select
           count(distinct entity_id) filter (
             where local_screening_role = 'supplier_company'
               and support_category = 'same_local_candidate'
           )::text as hosted_same_candidate_entities,
           count(distinct entity_id) filter (
             where local_screening_role = 'supplier_company'
               and support_category = 'different_hosted_result'
           )::text as hosted_different_result_entities,
           count(distinct entity_id) filter (
             where local_screening_role = 'supplier_company'
               and support_category = 'no_hosted_result'
           )::text as hosted_no_result_entities
         from ${schema}.entity_hosted_match_comparison_overview
       )
       select
         coverage.total_supplier_entities::text,
         coverage.anchored_supplier_entities::text,
         coverage.unanchored_supplier_entities::text,
         coverage.local_signal_entities::text,
         coverage.external_signal_entities::text,
         coverage.external_candidate_entities::text,
         coverage.external_candidate_count::text,
         coverage.external_review_candidate_count::text,
         coverage.external_rejected_candidate_count::text,
         coverage.representative_link_count::text,
         coalesce(hosted_company_summary.hosted_same_candidate_entities, '0') as hosted_same_candidate_entities,
         coalesce(hosted_company_summary.hosted_different_result_entities, '0') as hosted_different_result_entities,
         coalesce(hosted_company_summary.hosted_no_result_entities, '0') as hosted_no_result_entities
       from ${schema}.entity_anchor_coverage_overview as coverage
       cross join hosted_company_summary`,
    );

    const lanesResult = await client.query<EntityQueueLaneRow>(
      `select
         review_lane,
         count(*)::text as item_count
       from ${schema}.entity_intelligence_review_queue
       group by review_lane
       order by count(*) desc, review_lane`,
    );

    const candidateItemsResult = await client.query<EntityQueueItemRow>(
      `with latest_hosted_company as (
         select distinct on (entity_id)
           entity_id,
           support_category as hosted_support_category,
           top_result_name as hosted_top_result_name,
           top_result_score::text as hosted_top_result_score,
           top_result_datasets as hosted_top_result_datasets,
           compared_at::text as hosted_compared_at
         from ${schema}.entity_hosted_match_comparison_overview
         where local_screening_role = 'supplier_company'
         order by entity_id, compared_at desc, id desc
       )
       select
         queue.entity_name,
         queue.anchor_status,
         queue.source_keys,
         queue.total_process_count::text,
         queue.flagged_process_count::text,
         queue.total_risk_signals::text,
         queue.supplier_linked_contract_value::text,
         queue.supplier_linked_paid_amount::text,
         queue.local_signal_count::text,
         queue.local_signal_codes,
         queue.max_local_severity,
         queue.external_match_count::text,
         queue.external_signal_count::text,
         queue.max_external_severity,
         queue.external_candidate_count::text,
         queue.external_review_candidate_count::text,
         queue.external_rejected_candidate_count::text,
         queue.max_external_candidate_confidence::text,
         queue.representative_count::text,
         latest_hosted_company.hosted_support_category,
         latest_hosted_company.hosted_top_result_name,
         latest_hosted_company.hosted_top_result_score,
         latest_hosted_company.hosted_top_result_datasets,
         latest_hosted_company.hosted_compared_at,
         queue.review_priority,
         queue.review_lane,
         queue.lead_question,
         queue.recommended_action
       from ${schema}.entity_intelligence_review_queue as queue
       left join latest_hosted_company
         on latest_hosted_company.entity_id = queue.entity_id
       where queue.external_review_candidate_count > 0
       order by queue.max_external_candidate_confidence desc, queue.external_review_candidate_count desc, queue.entity_name
       limit 12`,
    );

    const itemsResult = await client.query<EntityQueueItemRow>(
      `with latest_hosted_company as (
         select distinct on (entity_id)
           entity_id,
           support_category as hosted_support_category,
           top_result_name as hosted_top_result_name,
           top_result_score::text as hosted_top_result_score,
           top_result_datasets as hosted_top_result_datasets,
           compared_at::text as hosted_compared_at
         from ${schema}.entity_hosted_match_comparison_overview
         where local_screening_role = 'supplier_company'
         order by entity_id, compared_at desc, id desc
       )
       select
         queue.entity_name,
         queue.anchor_status,
         queue.source_keys,
         queue.total_process_count::text,
         queue.flagged_process_count::text,
         queue.total_risk_signals::text,
         queue.supplier_linked_contract_value::text,
         queue.supplier_linked_paid_amount::text,
         queue.local_signal_count::text,
         queue.local_signal_codes,
         queue.max_local_severity,
         queue.external_match_count::text,
         queue.external_signal_count::text,
         queue.max_external_severity,
         queue.external_candidate_count::text,
         queue.external_review_candidate_count::text,
         queue.external_rejected_candidate_count::text,
         queue.max_external_candidate_confidence::text,
         queue.representative_count::text,
         latest_hosted_company.hosted_support_category,
         latest_hosted_company.hosted_top_result_name,
         latest_hosted_company.hosted_top_result_score,
         latest_hosted_company.hosted_top_result_datasets,
         latest_hosted_company.hosted_compared_at,
         queue.review_priority,
         queue.review_lane,
         queue.lead_question,
         queue.recommended_action
       from ${schema}.entity_intelligence_review_queue as queue
       left join latest_hosted_company
         on latest_hosted_company.entity_id = queue.entity_id
       order by
         case queue.review_priority
           when 'priority' then 3
           when 'enhanced_review' then 2
           else 1
         end desc,
         case queue.max_external_severity
           when 'high' then 3
           when 'medium' then 2
           when 'low' then 1
           else 0
         end desc,
         case queue.max_local_severity
           when 'high' then 3
           when 'medium' then 2
           when 'low' then 1
           else 0
         end desc,
         queue.local_signal_count desc,
         queue.external_signal_count desc,
         queue.external_review_candidate_count desc,
         queue.max_external_candidate_confidence desc,
         queue.total_risk_signals desc,
         queue.representative_count desc,
         queue.entity_name
       limit $1`,
      [limit],
    );

    const report = renderEntityIntelligenceQueueReport(
      summaryResult.rows[0],
      lanesResult.rows,
      candidateItemsResult.rows,
      itemsResult.rows,
    );
    const reportPath = await writeOutputText(
      ["reports", "paraguay", "all-entities-intelligence-queue.md"],
      report,
    );

    return {
      report,
      reportPath,
    };
  } finally {
    await client.end();
  }
}

export async function buildExternalCandidateReviewReport(
  limit = 50,
): Promise<{ report: string; reportPath: string }> {
  const { client, schema } = await connectToPostgres();

  try {
    const summaryResult = await client.query<ExternalCandidateSummaryRow>(
      `select
         candidate_status,
         local_screening_role,
         count(*)::text as candidate_count,
         count(distinct entity_id)::text as local_entity_count,
         max(match_confidence)::text as max_match_confidence
       from ${schema}.entity_enrichment_candidate_review_overview
       group by candidate_status, local_screening_role
       order by
         case candidate_status
           when 'review_candidate' then 2
           else 1
         end desc,
         local_screening_role`,
    );

    const methodResult = await client.query<ExternalCandidateMethodRow>(
      `select
         candidate_status,
         match_method,
         count(*)::text as candidate_count,
         count(distinct entity_id)::text as local_entity_count,
         max(match_confidence)::text as max_match_confidence
       from ${schema}.entity_enrichment_candidate_review_overview
       group by candidate_status, match_method
       order by
         case candidate_status
           when 'review_candidate' then 2
           else 1
         end desc,
         count(*) desc,
         match_method`,
    );

    const reviewStatusResult = await client.query<ExternalCandidateReviewStatusRow>(
      `select
         review_status,
         count(*)::text as candidate_count,
         count(distinct entity_id)::text as local_entity_count,
         max(match_confidence)::text as max_match_confidence
       from ${schema}.entity_enrichment_candidate_review_overview
       group by review_status
       order by
         case review_status
           when 'promotable' then 5
           when 'needs_evidence' then 4
           when 'monitor' then 3
           when 'unreviewed' then 2
           when 'rejected' then 1
           else 0
         end desc,
         review_status`,
    );

    const itemResult = await client.query<ExternalCandidateItemRow>(
      `select
         candidates.id::text,
         candidates.entity_name,
         candidates.entity_type,
         candidates.source_key,
         candidates.external_name,
         candidates.external_entity_type,
         candidates.external_schema,
         candidates.local_screening_role,
         candidates.candidate_status,
         candidates.match_method,
         candidates.match_confidence::text,
         candidates.match_quality,
         candidates.review_status,
         candidates.reviewed_at::text,
         candidates.reviewed_by,
         candidates.review_notes,
         candidates.review_evidence,
         candidates.second_review_id::text,
         candidates.second_review_decision,
         candidates.second_reviewed_at::text,
         candidates.second_reviewed_by,
         candidates.second_review_rationale,
         candidates.second_review_limitations,
         candidates.second_review_evidence,
         candidates.accepted_match_id::text,
         candidates.rejection_reason,
         candidates.rationale,
         candidates.external_datasets,
         candidates.external_countries,
         candidates.external_identifiers,
         candidates.evidence,
         candidates.hosted_support_category,
         candidates.hosted_top_result_name,
         candidates.hosted_top_result_score::text,
         candidates.hosted_top_result_datasets,
         candidates.hosted_compared_at::text,
         candidates.suggested_review_status,
         candidates.review_priority_hint,
         candidates.review_next_step,
         candidates.local_identifiers,
         candidates.local_ruc_identifiers,
         candidates.local_profile_sources,
         candidates.local_profile_names,
         candidates.local_profile_rucs
       from ${schema}.entity_enrichment_candidate_review_overview as candidates
       order by
         case candidates.candidate_status
           when 'review_candidate' then 2
           else 1
         end desc,
         case candidates.review_priority_hint
           when 'high' then 4
           when 'medium' then 3
           when 'diagnostic' then 2
           else 1
         end desc,
         case candidates.local_screening_role
           when 'supplier_company' then 2
           else 1
         end desc,
         candidates.match_confidence desc,
         candidates.entity_name,
         candidates.external_name
       limit $1`,
      [limit],
    );

    const report = renderExternalCandidateReviewReport(
      summaryResult.rows,
      methodResult.rows,
      reviewStatusResult.rows,
      itemResult.rows,
    );
    const reportPath = await writeOutputText(
      ["reports", "paraguay", "external-enrichment-candidate-review.md"],
      report,
    );

    return {
      report,
      reportPath,
    };
  } finally {
    await client.end();
  }
}

export async function buildEntityAnchorGapReport(
  limit = 50,
): Promise<{ report: string; reportPath: string }> {
  const { client, schema } = await connectToPostgres();

  try {
    const summaryResult = await client.query<AnchorGapSummaryRow>(
      `select
         count(*)::text as total_gaps,
         count(*) filter (where has_ruc_identifier)::text as gaps_with_ruc,
         count(*) filter (where not has_ruc_identifier)::text as gaps_without_ruc,
         count(*) filter (where flagged_process_count > 0)::text as flagged_gap_entities,
         coalesce(sum(total_risk_signals), 0)::text as total_gap_risk_signals
       from ${schema}.entity_anchor_gap_review`,
    );

    const itemsResult = await client.query<AnchorGapItemRow>(
      `select
         entity_name,
         source_keys,
         total_process_count::text,
         flagged_process_count::text,
         total_risk_signals::text,
         supplier_linked_contract_value::text,
         supplier_linked_paid_amount::text,
         identifiers,
         ruc_identifiers,
         has_ruc_identifier,
         procurement_source_mention_count::text,
         observed_names,
         gap_reason,
         next_resolution_step,
         review_priority,
         lead_question,
         recommended_action
       from ${schema}.entity_anchor_gap_review
       order by
         case review_priority
           when 'priority' then 3
           when 'enhanced_review' then 2
           else 1
         end desc,
         case when has_ruc_identifier then 1 else 0 end desc,
         total_risk_signals desc,
         flagged_process_count desc,
         total_process_count desc,
         entity_name
       limit $1`,
      [limit],
    );

    const report = renderEntityAnchorGapReport(summaryResult.rows[0], itemsResult.rows);
    const reportPath = await writeOutputText(
      ["reports", "paraguay", "all-entities-anchor-gaps.md"],
      report,
    );

    return {
      report,
      reportPath,
    };
  } finally {
    await client.end();
  }
}
