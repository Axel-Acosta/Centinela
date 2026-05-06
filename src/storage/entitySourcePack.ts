import {
  buildCaseEvidenceExportArtifacts,
  buildCaseSourceAttachmentManifestArtifacts,
  buildCaseSourceBundleArtifacts,
  buildCaseSourceDocumentIndexArtifacts,
} from "./caseEvidenceExport";
import { createAnalystCase, createAnalystEvidenceLink, linkAnalystCaseTarget } from "./analystWorkspace";
import { connectToPostgres } from "./postgres";
import { writeOutputJson, writeOutputText } from "./files";

export interface BuildEntitySourcePackOptions {
  entityId?: number | undefined;
  entityName?: string | undefined;
  caseId?: number | undefined;
  caseKey?: string | undefined;
  title?: string | undefined;
  sourceRecordLimit?: number | undefined;
  recordKinds?: string[] | undefined;
  query?: string | undefined;
  sourceIndexQuery?: string | undefined;
  publicOnly?: boolean | undefined;
  copyAssets?: boolean | undefined;
  createdBy?: string | undefined;
  dryRun?: boolean | undefined;
}

export interface EntityRow {
  id: string;
  entity_type: string;
  canonical_name: string;
  normalized_name: string;
  source_key: string | null;
  source_external_id: string | null;
}

export interface EntitySourceRecordRow {
  id: string;
  source_run_id: string | null;
  source_key: string;
  external_id: string | null;
  record_kind: string;
  source_url: string | null;
  retrieved_at: string;
  source_run_status: string | null;
  title: string | null;
  process_title: string | null;
  document_type: string | null;
  field_path: string | null;
  extraction_status: string | null;
  sha256: string | null;
  local_document_path: string | null;
  extracted_text_path: string | null;
  payload_preview: string | null;
}

export interface EntitySourcePackResult {
  entity: EntityRow;
  caseId: string | null;
  caseKey: string | null;
  dryRun: boolean;
  selectedSourceRecords: EntitySourceRecordRow[];
  linkedSourceRecordTargets: number;
  createdEvidenceLinks: number;
  skippedExistingEvidenceLinks: number;
  evidenceArtifactPath: string | null;
  sourceManifestPath: string | null;
  sourceBundlePath: string | null;
  sourceDocumentIndexPath: string | null;
  sourceDocumentIndexQueryMatches: number | null;
  reportPath: string;
  summaryPath: string;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.trunc(value);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return slug || "entity-source-pack";
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  return String(value);
}

function asCaseId(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`Could not resolve analyst case ID from value "${String(value)}".`);
  }

  return numeric;
}

function recordPriority(recordKind: string): number {
  if (recordKind === "document_content_extract") {
    return 1;
  }

  if (recordKind === "ocds_release_package") {
    return 2;
  }

  if (recordKind === "ocds_document_metadata") {
    return 3;
  }

  return 9;
}

function evidenceRole(record: EntitySourceRecordRow): string {
  if (record.record_kind === "document_content_extract") {
    return record.extraction_status === "extracted_text" ? "supports_identity_context" : "context";
  }

  if (record.record_kind === "ocds_release_package") {
    return "supports_identity_context";
  }

  return "context";
}

function evidenceFieldPath(record: EntitySourceRecordRow): string {
  if (record.field_path) {
    return record.field_path;
  }

  if (record.record_kind === "document_content_extract") {
    return "payload.extractionStatus";
  }

  if (record.record_kind === "ocds_document_metadata") {
    return "payload.document.title";
  }

  return "payload";
}

function evidenceFieldValue(record: EntitySourceRecordRow): string {
  if (record.record_kind === "document_content_extract") {
    return `${text(record.extraction_status)}; sha256=${text(record.sha256)}`;
  }

  return text(record.title ?? record.process_title ?? record.external_id);
}

function evidenceSummary(record: EntitySourceRecordRow): string {
  if (record.record_kind === "document_content_extract") {
    return [
      `Official DNCP document capture for ${text(record.title ?? record.external_id)}.`,
      `Extraction status: ${text(record.extraction_status)}.`,
      `SHA-256: ${text(record.sha256)}.`,
    ].join(" ");
  }

  if (record.record_kind === "ocds_document_metadata") {
    return [
      `Official DNCP document metadata for ${text(record.title ?? record.external_id)}.`,
      `Related process: ${text(record.process_title)}.`,
      `Document type: ${text(record.document_type)}.`,
    ].join(" ");
  }

  if (record.record_kind === "ocds_release_package") {
    return `Official DNCP OCDS release package linked to entity/process context: ${text(
      record.process_title ?? record.external_id,
    )}.`;
  }

  return `Source record linked to entity context: ${text(record.source_key)} #${text(record.external_id)}.`;
}

function evidenceLimitations(record: EntitySourceRecordRow): string {
  const limits = [
    "This source record is review context and does not prove wrongdoing.",
    "Verify the official source URL and source fields before public reuse.",
  ];

  if (record.record_kind === "document_content_extract" && record.extraction_status !== "extracted_text") {
    limits.push("The captured document did not yield searchable text with the current local parser.");
  }

  if (record.record_kind === "ocds_document_metadata") {
    limits.push("Document metadata can describe a file without confirming the contents of the downloaded document.");
  }

  return limits.join(" ");
}

function renderMarkdown(result: EntitySourcePackResult): string {
  const lines: string[] = [];
  lines.push(`# Centinela entity source pack: ${result.entity.canonical_name}`);
  lines.push("");
  lines.push("This packet organizes source-backed review material. It is not proof of wrongdoing or a public finding.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Entity ID: ${result.entity.id}`);
  lines.push(`- Entity type: ${result.entity.entity_type}`);
  lines.push(`- Case ID: ${result.caseId ?? "n/a"}`);
  lines.push(`- Case key: ${result.caseKey ?? "n/a"}`);
  lines.push(`- Dry run: ${result.dryRun ? "yes" : "no"}`);
  lines.push(`- Selected source records: ${result.selectedSourceRecords.length}`);
  lines.push(`- Created evidence links: ${result.createdEvidenceLinks}`);
  lines.push(`- Existing evidence links skipped: ${result.skippedExistingEvidenceLinks}`);
  lines.push("");
  lines.push("## Generated artifacts");
  lines.push("");
  lines.push(`- Evidence artifact: ${result.evidenceArtifactPath ?? "n/a"}`);
  lines.push(`- Source manifest: ${result.sourceManifestPath ?? "n/a"}`);
  lines.push(`- Source bundle: ${result.sourceBundlePath ?? "n/a"}`);
  lines.push(`- Source-document index: ${result.sourceDocumentIndexPath ?? "n/a"}`);
  lines.push(`- Source-document query matches: ${result.sourceDocumentIndexQueryMatches ?? "n/a"}`);
  lines.push("");
  lines.push("## Source records selected");
  lines.push("");

  if (result.selectedSourceRecords.length === 0) {
    lines.push("No entity-linked source records were selected.");
    lines.push("");
  }

  result.selectedSourceRecords.forEach((record, index) => {
    lines.push(`### ${index + 1}. ${record.source_key} #${record.id}`);
    lines.push("");
    lines.push(`- Record kind: ${record.record_kind}`);
    lines.push(`- External ID: ${text(record.external_id)}`);
    lines.push(`- Title: ${text(record.title)}`);
    lines.push(`- Process: ${text(record.process_title)}`);
    lines.push(`- Document type: ${text(record.document_type)}`);
    lines.push(`- Extraction status: ${text(record.extraction_status)}`);
    lines.push(`- SHA-256: ${text(record.sha256)}`);
    lines.push(`- Source URL: ${text(record.source_url)}`);
    lines.push(`- Retrieved at: ${text(record.retrieved_at)}`);
    lines.push("");
  });

  lines.push("## Use limits");
  lines.push("");
  lines.push("- Treat this as internal analyst navigation, not a legal conclusion.");
  lines.push("- Public reuse requires source verification, privacy review, methodology review, and non-accusatory language.");
  lines.push("- Captured official files may be scanned or image-only; lack of extracted text is a parser/source-format limitation, not evidence about the entity.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function resolveEntity(options: BuildEntitySourcePackOptions): Promise<EntityRow> {
  if (!options.entityId && !options.entityName) {
    throw new Error("Missing entity filter. Use --entity-id or --entity-name.");
  }

  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<EntityRow>(
      `select
         id::text,
         entity_type,
         canonical_name,
         normalized_name,
         source_key,
         source_external_id
       from ${schema}.entities
       where ($1::bigint is null or id = $1)
         and ($2::text is null or normalized_name = $2 or canonical_name ilike $3)
       order by
         case when $1::bigint is not null and id = $1 then 0 else 1 end,
         case when $2::text is not null and normalized_name = $2 then 0 else 1 end,
         id
       limit 1`,
      [
        options.entityId ?? null,
        options.entityName ? normalizeName(options.entityName) : null,
        options.entityName ? `%${options.entityName.trim()}%` : null,
      ],
    );

    const entity = result.rows[0];
    if (!entity) {
      throw new Error(`No entity found for ${options.entityId ?? options.entityName}.`);
    }

    return entity;
  } finally {
    await client.end();
  }
}

async function loadEntitySourceRecords(
  entityId: string,
  options: BuildEntitySourcePackOptions,
): Promise<EntitySourceRecordRow[]> {
  const limit = positiveInteger(options.sourceRecordLimit, 25);
  const kinds = options.recordKinds?.map((kind) => kind.trim()).filter((kind) => kind.length > 0) ?? [];
  const query = options.query?.trim() || null;
  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<EntitySourceRecordRow>(
      `select
         records.id::text,
         records.source_run_id::text,
         records.source_key,
         records.external_id,
         records.record_kind,
         records.source_url,
         records.retrieved_at::text,
         runs.status as source_run_status,
         coalesce(
           records.payload #>> '{document,title}',
           records.payload #>> '{release,releaseId}',
           records.payload #>> '{process,title}',
           records.external_id
         ) as title,
         records.payload #>> '{process,title}' as process_title,
         coalesce(
           records.payload #>> '{document,documentTypeDetails}',
           records.payload #>> '{document,documentType}'
         ) as document_type,
         records.payload #>> '{fieldPath}' as field_path,
         records.payload #>> '{extractionStatus}' as extraction_status,
         records.payload #>> '{sha256}' as sha256,
         records.payload #>> '{localDocumentPath}' as local_document_path,
         records.payload #>> '{extractedTextPath}' as extracted_text_path,
         left(records.payload::text, 1200) as payload_preview
       from ${schema}.source_records as records
       left join ${schema}.source_runs as runs
         on runs.id = records.source_run_id
       where coalesce(
           records.payload #>> '{centinelaTarget,entity_id}',
           records.payload #>> '{centinelaTarget,entityId}'
         ) = $1
         and (cardinality($2::text[]) = 0 or records.record_kind = any($2::text[]))
         and ($3::text is null or records.payload::text ilike '%' || $3 || '%')
       order by
         case records.record_kind
           when 'document_content_extract' then 1
           when 'ocds_release_package' then 2
           when 'ocds_document_metadata' then 3
           else 9
         end,
         records.retrieved_at desc,
         records.id desc
       limit $4`,
      [entityId, kinds, query, limit],
    );

    return [...result.rows].sort(
      (left, right) =>
        recordPriority(left.record_kind) - recordPriority(right.record_kind) ||
        String(right.retrieved_at).localeCompare(String(left.retrieved_at)) ||
        Number(right.id) - Number(left.id),
    );
  } finally {
    await client.end();
  }
}

async function loadExistingEvidenceSourceRecordIds(
  caseId: number,
  entityId: string,
  sourceRecordIds: number[],
): Promise<Set<number>> {
  if (sourceRecordIds.length === 0) {
    return new Set();
  }

  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<{ source_record_id: string }>(
      `select distinct source_record_id::text
       from ${schema}.analyst_evidence_links
       where case_id = $1
         and target_type = 'entity'
         and target_id = $2
         and source_record_id = any($3::bigint[])
         and metadata ->> 'generatedBy' = 'entity-source-pack'`,
      [caseId, entityId, sourceRecordIds],
    );

    return new Set(result.rows.map((row) => Number(row.source_record_id)).filter((id) => Number.isInteger(id)));
  } finally {
    await client.end();
  }
}

export async function buildEntitySourcePackArtifacts(
  options: BuildEntitySourcePackOptions,
): Promise<EntitySourcePackResult> {
  const entity = await resolveEntity(options);
  const selectedSourceRecords = await loadEntitySourceRecords(entity.id, options);
  const generatedAt = new Date().toISOString();
  const createdBy = options.createdBy?.trim() || "centinela-operator";
  const caseKey = options.caseKey?.trim() || `entity-source-pack-${slugify(entity.canonical_name)}`;
  const title = options.title?.trim() || `Entity source pack: ${entity.canonical_name}`;
  const sourceIndexQuery = options.sourceIndexQuery?.trim() || entity.canonical_name;
  let caseId: number | null = options.caseId ?? null;
  let createdEvidenceLinks = 0;
  let skippedExistingEvidenceLinks = 0;
  let linkedSourceRecordTargets = 0;
  let evidenceArtifactPath: string | null = null;
  let sourceManifestPath: string | null = null;
  let sourceBundlePath: string | null = null;
  let sourceDocumentIndexPath: string | null = null;
  let sourceDocumentIndexQueryMatches: number | null = null;

  if (!options.dryRun) {
    if (!caseId) {
      const createdCase = await createAnalystCase({
        caseKey,
        title,
        status: "open",
        priority: "normal",
        summary: `Internal source pack for official source records linked to ${entity.canonical_name}. This is review context, not a finding.`,
        createdBy,
        metadata: {
          generatedBy: "entity-source-pack",
          generatedAt,
          entityId: entity.id,
          entityName: entity.canonical_name,
          sourceRecordCount: selectedSourceRecords.length,
          useLimit: "Non-accusatory internal review packet.",
        },
      });
      caseId = asCaseId(createdCase.id);
    }

    await linkAnalystCaseTarget({
      caseId,
      targetType: "entity",
      targetId: entity.id,
      label: entity.canonical_name,
      rationale: "Entity at the center of this source pack.",
      createdBy,
      metadata: {
        generatedBy: "entity-source-pack",
        generatedAt,
      },
    });

    const numericSourceRecordIds = selectedSourceRecords
      .map((record) => Number(record.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const existingEvidence = await loadExistingEvidenceSourceRecordIds(caseId, entity.id, numericSourceRecordIds);

    for (const sourceRecord of selectedSourceRecords) {
      const sourceRecordId = Number(sourceRecord.id);
      await linkAnalystCaseTarget({
        caseId,
        targetType: "source_record",
        targetId: sourceRecord.id,
        label: `${sourceRecord.source_key} ${sourceRecord.record_kind}`,
        rationale: `Source record selected for ${entity.canonical_name} entity source pack.`,
        createdBy,
        metadata: {
          generatedBy: "entity-source-pack",
          generatedAt,
          entityId: entity.id,
          recordKind: sourceRecord.record_kind,
        },
      });
      linkedSourceRecordTargets += 1;

      if (existingEvidence.has(sourceRecordId)) {
        skippedExistingEvidenceLinks += 1;
        continue;
      }

      await createAnalystEvidenceLink({
        caseId,
        sourceRecordId,
        targetType: "entity",
        targetId: entity.id,
        fieldPath: evidenceFieldPath(sourceRecord),
        fieldValue: evidenceFieldValue(sourceRecord),
        evidenceSummary: evidenceSummary(sourceRecord),
        analystInterpretation:
          "Source record included for entity-context review and traceability. This is not a finding or allegation.",
        limitations: evidenceLimitations(sourceRecord),
        evidenceRole: evidenceRole(sourceRecord),
        createdBy,
        metadata: {
          generatedBy: "entity-source-pack",
          generatedAt,
          entityId: entity.id,
          sourceKey: sourceRecord.source_key,
          recordKind: sourceRecord.record_kind,
          sourceUrl: sourceRecord.source_url,
          extractionStatus: sourceRecord.extraction_status,
        },
      });
      createdEvidenceLinks += 1;
    }

    const evidenceArtifact = await buildCaseEvidenceExportArtifacts({
      caseId,
      publicOnly: options.publicOnly === true,
      limit: positiveInteger(options.sourceRecordLimit, 25),
    });
    evidenceArtifactPath = evidenceArtifact.markdownPath;

    const sourceManifest = await buildCaseSourceAttachmentManifestArtifacts({
      caseId,
      publicOnly: options.publicOnly === true,
      limit: positiveInteger(options.sourceRecordLimit, 25),
    });
    sourceManifestPath = sourceManifest.markdownPath;

    const sourceBundle = await buildCaseSourceBundleArtifacts({
      caseId,
      publicOnly: options.publicOnly === true,
      copyAssets: options.copyAssets !== false,
      limit: positiveInteger(options.sourceRecordLimit, 25),
    });
    sourceBundlePath = sourceBundle.bundlePath;

    const sourceDocumentIndex = await buildCaseSourceDocumentIndexArtifacts({
      bundlePath: sourceBundle.bundlePath,
      query: sourceIndexQuery,
    });
    sourceDocumentIndexPath = sourceDocumentIndex.markdownPath;
    sourceDocumentIndexQueryMatches = sourceDocumentIndex.queryMatchCount;
  }

  const result: EntitySourcePackResult = {
    entity,
    caseId: caseId === null ? null : String(caseId),
    caseKey: options.dryRun ? null : caseKey,
    dryRun: options.dryRun === true,
    selectedSourceRecords,
    linkedSourceRecordTargets,
    createdEvidenceLinks,
    skippedExistingEvidenceLinks,
    evidenceArtifactPath,
    sourceManifestPath,
    sourceBundlePath,
    sourceDocumentIndexPath,
    sourceDocumentIndexQueryMatches,
    reportPath: "",
    summaryPath: "",
  };
  const entitySlug = slugify(entity.canonical_name);
  const fileStem = options.dryRun ? `${entitySlug}-source-pack-dry-run` : `${entitySlug}-source-pack`;
  const summaryPath = await writeOutputJson(["normalized", "paraguay", "entity-source-packs", `${fileStem}.json`], {
    ...result,
    generatedAt,
    disclaimer: "Entity source packs are source-backed review material, not proof of wrongdoing.",
  });
  const reportPath = await writeOutputText(
    ["reports", "paraguay", "entity-source-packs", `${fileStem}.md`],
    renderMarkdown({
      ...result,
      summaryPath,
      reportPath: "",
    }),
  );

  return {
    ...result,
    reportPath,
    summaryPath,
  };
}
