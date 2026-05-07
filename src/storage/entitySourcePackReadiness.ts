import { connectToPostgres } from "./postgres";
import { writeOutputJson, writeOutputText } from "./files";

export interface EntitySourcePackReadinessOptions {
  limit?: number | undefined;
  sourceRecordLimit?: number | undefined;
}

export interface EntitySourcePackReadinessRow {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  review_priority: string;
  review_lane: string;
  total_process_count: string;
  flagged_process_count: string;
  total_risk_signals: string;
  supplier_linked_contract_value: string | null;
  local_profile_sources: string[] | null;
  external_review_candidate_count: string;
  representative_count: string;
  source_record_count: string;
  release_record_count: string;
  document_metadata_count: string;
  document_content_count: string;
  document_content_downloaded_count: string;
  document_content_failed_count: string;
  document_content_extracted_count: string;
  latest_source_record_at: string | null;
  source_pack_case_count: string;
  latest_source_pack_case_id: string | null;
  latest_source_pack_case_key: string | null;
  source_pack_evidence_count: string;
}

export interface EntitySourcePackReadinessItem {
  entityId: string;
  entityName: string;
  reviewPriority: string;
  reviewLane: string;
  totalProcessCount: number;
  flaggedProcessCount: number;
  totalRiskSignals: number;
  supplierLinkedContractValue: number | null;
  localProfileSources: string[];
  externalReviewCandidateCount: number;
  representativeCount: number;
  sourceRecordCount: number;
  releaseRecordCount: number;
  documentMetadataCount: number;
  documentContentCount: number;
  documentContentDownloadedCount: number;
  documentContentFailedCount: number;
  documentContentExtractedCount: number;
  latestSourceRecordAt: string | null;
  sourcePackCaseCount: number;
  latestSourcePackCaseId: string | null;
  latestSourcePackCaseKey: string | null;
  sourcePackEvidenceCount: number;
  recommendedAction: string;
  rationale: string;
  command: string;
}

export interface EntitySourcePackReadinessResult {
  generatedAt: string;
  limit: number;
  sourceRecordLimit: number;
  items: EntitySourcePackReadinessItem[];
  summaryPath: string;
  reportPath: string;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.trunc(value);
}

function numberFrom(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nullableNumberFrom(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function quoteCommandValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function chooseAction(row: EntitySourcePackReadinessRow, sourceRecordLimit: number): Pick<
  EntitySourcePackReadinessItem,
  "recommendedAction" | "rationale" | "command"
> {
  const entityId = row.entity_id;
  const entityName = row.entity_name;
  const sourceRecordCount = numberFrom(row.source_record_count);
  const releaseRecordCount = numberFrom(row.release_record_count);
  const documentMetadataCount = numberFrom(row.document_metadata_count);
  const documentContentCount = numberFrom(row.document_content_count);
  const documentContentDownloadedCount = numberFrom(row.document_content_downloaded_count);
  const documentContentFailedCount = numberFrom(row.document_content_failed_count);
  const sourcePackCaseCount = numberFrom(row.source_pack_case_count);
  const sourcePackEvidenceCount = numberFrom(row.source_pack_evidence_count);

  if (releaseRecordCount === 0) {
    return {
      recommendedAction: "run_dncp_release_source_check",
      rationale: "No official DNCP OCDS release/package source records are linked to this entity yet.",
      command: `npm run enrichment:dncp-release-source-check -- --entity-id ${entityId} --limit 2`,
    };
  }

  if (sourcePackCaseCount === 0 || sourcePackEvidenceCount === 0) {
    return {
      recommendedAction: "build_entity_source_pack",
      rationale: "Official source records exist, but no source-pack case/evidence layer is visible yet.",
      command: `npm run database:entity-source-pack -- --entity-id ${entityId} --source-record-limit ${sourceRecordLimit} --source-index-query ${quoteCommandValue(entityName)}`,
    };
  }

  if (sourceRecordCount > sourcePackEvidenceCount && sourcePackEvidenceCount < sourceRecordLimit) {
    return {
      recommendedAction: "refresh_or_expand_entity_source_pack",
      rationale: "The entity has more source records than source-pack evidence links in the current case layer.",
      command: `npm run database:entity-source-pack -- --entity-id ${entityId} --source-record-limit ${sourceRecordLimit} --source-index-query ${quoteCommandValue(entityName)}`,
    };
  }

  if (documentMetadataCount > 0 && documentContentCount === 0) {
    return {
      recommendedAction: "consider_selective_document_content_capture",
      rationale: "The source pack has official document metadata, but no captured/hash-checked document-content records yet.",
      command: `npm run enrichment:dncp-document-content -- --entity-id ${entityId} --query contrato --limit 2`,
    };
  }

  if (documentContentCount > 0 && documentContentDownloadedCount === 0 && documentContentFailedCount > 0) {
    return {
      recommendedAction: "ready_for_internal_review_with_document_download_limits",
      rationale:
        "The entity has official source records and source-pack evidence, but selected document-content attempts recorded DNCP download failures that analysts should treat as source-access limitations.",
      command: `npm run database:entity-brief -- --name ${quoteCommandValue(entityName)}`,
    };
  }

  return {
    recommendedAction: "ready_for_internal_review",
    rationale: "The entity has official source records and a source-pack case/evidence layer.",
    command: `npm run database:entity-brief -- --name ${quoteCommandValue(entityName)}`,
  };
}

function toReadinessItem(row: EntitySourcePackReadinessRow, sourceRecordLimit: number): EntitySourcePackReadinessItem {
  const action = chooseAction(row, sourceRecordLimit);

  return {
    entityId: row.entity_id,
    entityName: row.entity_name,
    reviewPriority: row.review_priority,
    reviewLane: row.review_lane,
    totalProcessCount: numberFrom(row.total_process_count),
    flaggedProcessCount: numberFrom(row.flagged_process_count),
    totalRiskSignals: numberFrom(row.total_risk_signals),
    supplierLinkedContractValue: nullableNumberFrom(row.supplier_linked_contract_value),
    localProfileSources: row.local_profile_sources ?? [],
    externalReviewCandidateCount: numberFrom(row.external_review_candidate_count),
    representativeCount: numberFrom(row.representative_count),
    sourceRecordCount: numberFrom(row.source_record_count),
    releaseRecordCount: numberFrom(row.release_record_count),
    documentMetadataCount: numberFrom(row.document_metadata_count),
    documentContentCount: numberFrom(row.document_content_count),
    documentContentDownloadedCount: numberFrom(row.document_content_downloaded_count),
    documentContentFailedCount: numberFrom(row.document_content_failed_count),
    documentContentExtractedCount: numberFrom(row.document_content_extracted_count),
    latestSourceRecordAt: row.latest_source_record_at,
    sourcePackCaseCount: numberFrom(row.source_pack_case_count),
    latestSourcePackCaseId: row.latest_source_pack_case_id,
    latestSourcePackCaseKey: row.latest_source_pack_case_key,
    sourcePackEvidenceCount: numberFrom(row.source_pack_evidence_count),
    ...action,
  };
}

function money(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function renderMarkdown(input: {
  generatedAt: string;
  limit: number;
  sourceRecordLimit: number;
  items: EntitySourcePackReadinessItem[];
}): string {
  const actionCounts = input.items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.recommendedAction] = (accumulator[item.recommendedAction] ?? 0) + 1;
    return accumulator;
  }, {});

  const lines: string[] = [];
  lines.push("# Entity source-pack readiness");
  lines.push("");
  lines.push("This report ranks source-pack rollout needs. It is an internal planning artifact, not a finding or allegation.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Generated at: ${input.generatedAt}`);
  lines.push(`- Entities ranked: ${input.items.length}`);
  lines.push(`- Entity query limit: ${input.limit}`);
  lines.push(`- Suggested source-record limit per pack: ${input.sourceRecordLimit}`);
  lines.push("");
  lines.push("## Recommended action counts");
  lines.push("");

  for (const [action, count] of Object.entries(actionCounts).sort((left, right) => right[1] - left[1])) {
    lines.push(`- ${action}: ${count}`);
  }

  lines.push("");
  lines.push("## Ranked entities");
  lines.push("");

  input.items.forEach((item, index) => {
    lines.push(`### ${index + 1}. ${item.entityName}`);
    lines.push("");
    lines.push(`- Entity ID: ${item.entityId}`);
    lines.push(`- Review lane: ${item.reviewLane} (${item.reviewPriority})`);
    lines.push(`- Processes / flagged / signals: ${item.totalProcessCount} / ${item.flaggedProcessCount} / ${item.totalRiskSignals}`);
    lines.push(`- Supplier-linked contract value: ${money(item.supplierLinkedContractValue)}`);
    lines.push(`- Local profile sources: ${item.localProfileSources.join(", ") || "n/a"}`);
    lines.push(`- External review candidates: ${item.externalReviewCandidateCount}`);
    lines.push(`- Representatives: ${item.representativeCount}`);
    lines.push(
      `- Source records: ${item.sourceRecordCount} total, ${item.releaseRecordCount} release, ${item.documentMetadataCount} metadata, ${item.documentContentCount} content-attempt records`,
    );
    lines.push(
      `- Document-content status: ${item.documentContentDownloadedCount} downloaded, ${item.documentContentFailedCount} failed downloads, ${item.documentContentExtractedCount} with text`,
    );
    lines.push(`- Source-pack cases/evidence links: ${item.sourcePackCaseCount} / ${item.sourcePackEvidenceCount}`);
    lines.push(`- Latest source record: ${item.latestSourceRecordAt ?? "n/a"}`);
    lines.push(`- Latest source-pack case: ${item.latestSourcePackCaseKey ?? "n/a"} (#${item.latestSourcePackCaseId ?? "n/a"})`);
    lines.push(`- Recommended action: ${item.recommendedAction}`);
    lines.push(`- Rationale: ${item.rationale}`);
    lines.push(`- Command: \`${item.command}\``);
    lines.push("");
  });

  lines.push("## Use limits");
  lines.push("");
  lines.push("- This report prioritizes internal source-pack rollout. It does not rank guilt, illegality, or culpability.");
  lines.push("- Commands should be run selectively. Official document fetches may be slow, scanned, duplicated, or not text-extractable.");
  lines.push("- Public reuse still requires source verification, legal/privacy review, methodology review, and non-accusatory language.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export async function buildEntitySourcePackReadinessReport(
  options: EntitySourcePackReadinessOptions = {},
): Promise<EntitySourcePackReadinessResult> {
  const limit = positiveInteger(options.limit, 25);
  const sourceRecordLimit = positiveInteger(options.sourceRecordLimit, 10);
  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<EntitySourcePackReadinessRow>(
      `with ranked_entities as (
         select *
         from ${schema}.entity_intelligence_review_queue
         where entity_type = 'company'
         order by
           case when external_review_candidate_count > 0 then 0 else 1 end,
           case when review_priority = 'urgent' then 0
                when review_priority = 'high' then 1
                when review_priority = 'triage' then 2
                else 3 end,
           total_risk_signals desc nulls last,
           flagged_process_count desc nulls last,
           supplier_linked_contract_value desc nulls last,
           total_process_count desc nulls last,
           entity_id
         limit $1
       )
       select
         ranked_entities.entity_id::text,
         ranked_entities.entity_name,
         ranked_entities.entity_type,
         ranked_entities.review_priority,
         ranked_entities.review_lane,
         ranked_entities.total_process_count::text,
         ranked_entities.flagged_process_count::text,
         ranked_entities.total_risk_signals::text,
         ranked_entities.supplier_linked_contract_value::text,
         ranked_entities.local_profile_sources,
         ranked_entities.external_review_candidate_count::text,
         ranked_entities.representative_count::text,
         coalesce(source_counts.source_record_count, 0)::text as source_record_count,
         coalesce(source_counts.release_record_count, 0)::text as release_record_count,
         coalesce(source_counts.document_metadata_count, 0)::text as document_metadata_count,
         coalesce(source_counts.document_content_count, 0)::text as document_content_count,
         coalesce(source_counts.document_content_downloaded_count, 0)::text as document_content_downloaded_count,
         coalesce(source_counts.document_content_failed_count, 0)::text as document_content_failed_count,
         coalesce(source_counts.document_content_extracted_count, 0)::text as document_content_extracted_count,
         source_counts.latest_source_record_at::text,
         coalesce(source_pack_case_counts.source_pack_case_count, 0)::text as source_pack_case_count,
         latest_source_pack_case.latest_source_pack_case_id,
         latest_source_pack_case.latest_source_pack_case_key,
         coalesce(source_pack_evidence_counts.source_pack_evidence_count, 0)::text as source_pack_evidence_count
       from ranked_entities
       left join lateral (
         select
           count(*) as source_record_count,
           count(*) filter (where source_records.record_kind = 'ocds_release_package') as release_record_count,
           count(*) filter (where source_records.record_kind = 'ocds_document_metadata') as document_metadata_count,
           count(*) filter (where source_records.record_kind = 'document_content_extract') as document_content_count,
           count(*) filter (
             where source_records.record_kind = 'document_content_extract'
               and source_records.payload ->> 'downloadStatus' = 'downloaded'
           ) as document_content_downloaded_count,
           count(*) filter (
             where source_records.record_kind = 'document_content_extract'
               and source_records.payload ->> 'downloadStatus' = 'download_failed'
           ) as document_content_failed_count,
           count(*) filter (
             where source_records.record_kind = 'document_content_extract'
               and source_records.payload ->> 'extractionStatus' in ('extracted_text', 'copied_text')
           ) as document_content_extracted_count,
           max(source_records.retrieved_at) as latest_source_record_at
         from ${schema}.source_records as source_records
         where coalesce(
             source_records.payload #>> '{centinelaTarget,entity_id}',
             source_records.payload #>> '{centinelaTarget,entityId}'
           ) = ranked_entities.entity_id::text
       ) as source_counts on true
       left join lateral (
         select count(distinct cases.id) as source_pack_case_count
         from ${schema}.analyst_case_links as links
         join ${schema}.analyst_cases as cases
           on cases.id = links.case_id
         where links.target_type = 'entity'
           and links.target_id = ranked_entities.entity_id::text
           and (
             cases.metadata ->> 'generatedBy' = 'entity-source-pack'
             or cases.case_key like 'entity-source-pack-%'
           )
       ) as source_pack_case_counts on true
       left join lateral (
         select
           cases.id::text as latest_source_pack_case_id,
           cases.case_key as latest_source_pack_case_key
         from ${schema}.analyst_case_links as links
         join ${schema}.analyst_cases as cases
           on cases.id = links.case_id
         where links.target_type = 'entity'
           and links.target_id = ranked_entities.entity_id::text
           and (
             cases.metadata ->> 'generatedBy' = 'entity-source-pack'
             or cases.case_key like 'entity-source-pack-%'
           )
         order by cases.updated_at desc, cases.id desc
         limit 1
       ) as latest_source_pack_case on true
       left join lateral (
         select count(*) as source_pack_evidence_count
         from ${schema}.analyst_evidence_links as evidence_links
         where evidence_links.target_type = 'entity'
           and evidence_links.target_id = ranked_entities.entity_id::text
           and evidence_links.metadata ->> 'generatedBy' = 'entity-source-pack'
       ) as source_pack_evidence_counts on true`,
      [limit],
    );

    const generatedAt = new Date().toISOString();
    const items = result.rows.map((row) => toReadinessItem(row, sourceRecordLimit));
    const summaryPath = await writeOutputJson(["normalized", "paraguay", "entity-source-pack-readiness.json"], {
      generatedAt,
      limit,
      sourceRecordLimit,
      items,
      disclaimer: "Source-pack readiness ranks internal evidence-building actions, not wrongdoing.",
    });
    const reportPath = await writeOutputText(
      ["reports", "paraguay", "entity-source-pack-readiness.md"],
      renderMarkdown({
        generatedAt,
        limit,
        sourceRecordLimit,
        items,
      }),
    );

    return {
      generatedAt,
      limit,
      sourceRecordLimit,
      items,
      summaryPath,
      reportPath,
    };
  } finally {
    await client.end();
  }
}
