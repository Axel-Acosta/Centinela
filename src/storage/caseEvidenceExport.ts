import { writeOutputJson, writeOutputText } from "./files";
import { getAnalystCaseEvidenceExport } from "./analystWorkspace";
import { connectToPostgres } from "./postgres";
import fs from "node:fs";
import path from "node:path";

export interface BuildCaseEvidenceExportOptions {
  caseId: number;
  publicOnly?: boolean;
  limit?: number;
}

interface CaseEvidenceArtifactResult {
  caseId: string;
  caseKey: string;
  mode: string;
  evidenceCount: number;
  sourceCount: number;
  markdownPath: string;
  jsonPath: string;
}

interface CaseSourceAttachmentManifestResult {
  caseId: string;
  caseKey: string;
  mode: string;
  sourceRecordCount: number;
  sourceAssetCount: number;
  markdownPath: string;
  jsonPath: string;
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  return String(value);
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

  return slug || "centinela-case";
}

function timestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(record) : [];
}

function normalizeRows<T extends Record<string, unknown>>(inputRows: T[]): Array<Record<string, unknown>> {
  return inputRows.map((row) => {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      normalized[key] = typeof value === "bigint" ? value.toString() : value;
    }

    return normalized;
  });
}

function sourceIndexFromEvidence(evidence: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const sources = new Map<string, Record<string, unknown>>();

  for (const row of evidence) {
    const sourceRecordId = text(row.source_record_id);
    if (sourceRecordId === "n/a" || sources.has(sourceRecordId)) {
      continue;
    }

    sources.set(sourceRecordId, {
      sourceRecordId,
      sourceKey: row.source_key ?? null,
      externalId: row.external_id ?? null,
      recordKind: row.record_kind ?? null,
      sourceUrl: row.source_url ?? null,
      retrievedAt: row.retrieved_at ?? null,
      sourceRunStatus: row.source_run_status ?? null,
    });
  }

  return [...sources.values()].sort((left, right) =>
    text(left.sourceKey).localeCompare(text(right.sourceKey)) || text(left.externalId).localeCompare(text(right.externalId)),
  );
}

function sourceRecordIdsFromEvidence(evidence: Array<Record<string, unknown>>): number[] {
  const ids = new Set<number>();

  for (const row of evidence) {
    const rawId = Number(row.source_record_id);
    if (Number.isInteger(rawId) && rawId > 0) {
      ids.add(rawId);
    }
  }

  return [...ids].sort((left, right) => left - right);
}

function localPathStatus(assetPath: string | null): string {
  if (!assetPath) {
    return "not_applicable";
  }

  if (!path.isAbsolute(assetPath)) {
    return "not_absolute";
  }

  return fs.existsSync(assetPath) ? "exists" : "missing";
}

function groupSourceAttachments(inputRows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const recordsById = new Map<string, Record<string, unknown>>();

  for (const row of inputRows) {
    const sourceRecordId = text(row.source_record_id);
    const existing = recordsById.get(sourceRecordId);
    const sourceRecord =
      existing ??
      {
        sourceRecordId,
        sourceRun: {
          sourceRunId: row.source_run_id ?? null,
          sourceRunKey: row.source_run_key ?? null,
          countryCode: row.country_code ?? null,
          status: row.source_run_status ?? null,
          startedAt: row.source_run_started_at ?? null,
          finishedAt: row.source_run_finished_at ?? null,
          notes: row.source_run_notes ?? null,
        },
        sourceKey: row.source_key ?? null,
        externalId: row.external_id ?? null,
        recordKind: row.record_kind ?? null,
        sourceUrl: row.source_url ?? null,
        retrievedAt: row.retrieved_at ?? null,
        payloadPreview: row.payload_preview ?? null,
        assets: [],
      };

    const assets = Array.isArray(sourceRecord.assets)
      ? (sourceRecord.assets as Array<Record<string, unknown>>)
      : [];
    const sourceAssetId = row.source_asset_id;

    if (sourceAssetId !== null && sourceAssetId !== undefined) {
      const assetPath = typeof row.asset_path === "string" ? row.asset_path : null;
      assets.push({
        sourceAssetId,
        assetKind: row.asset_kind ?? null,
        path: assetPath,
        sourceUrl: row.asset_source_url ?? null,
        sha256: row.sha256 ?? null,
        retrievedAt: row.asset_retrieved_at ?? null,
        localPathStatus: localPathStatus(assetPath),
      });
      sourceRecord.assets = assets;
    }

    recordsById.set(sourceRecordId, sourceRecord);
  }

  return [...recordsById.values()].sort((left, right) =>
    text(left.sourceKey).localeCompare(text(right.sourceKey)) || text(left.externalId).localeCompare(text(right.externalId)),
  );
}

async function loadSourceAttachmentRows(sourceRecordIds: number[]): Promise<Array<Record<string, unknown>>> {
  if (sourceRecordIds.length === 0) {
    return [];
  }

  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<Record<string, unknown>>(
      `with selected_records as (
         select unnest($1::bigint[]) as source_record_id
       )
       select
         records.id::text as source_record_id,
         records.source_run_id::text,
         runs.source_key as source_run_key,
         runs.country_code,
         runs.status as source_run_status,
         runs.started_at::text as source_run_started_at,
         runs.finished_at::text as source_run_finished_at,
         runs.notes as source_run_notes,
         records.source_key,
         records.external_id,
         records.record_kind,
         records.source_url,
         records.retrieved_at::text,
         left(records.payload::text, 1200) as payload_preview,
         assets.id::text as source_asset_id,
         assets.asset_kind,
         assets.path as asset_path,
         assets.source_url as asset_source_url,
         assets.sha256,
         assets.retrieved_at::text as asset_retrieved_at
       from selected_records
       join ${schema}.source_records as records
         on records.id = selected_records.source_record_id
       left join ${schema}.source_runs as runs
         on runs.id = records.source_run_id
       left join ${schema}.source_assets as assets
         on assets.source_run_id = records.source_run_id
       order by records.id, assets.asset_kind, assets.id`,
      [sourceRecordIds],
    );

    return normalizeRows(result.rows);
  } finally {
    await client.end();
  }
}

function renderSourceIndex(sourceIndex: Array<Record<string, unknown>>): string[] {
  if (sourceIndex.length === 0) {
    return ["No source records are linked to this export.", ""];
  }

  const lines: string[] = [];

  sourceIndex.forEach((source, index) => {
    lines.push(`${index + 1}. ${text(source.sourceKey)} #${text(source.externalId)}`);
    lines.push(`   - Source record ID: ${text(source.sourceRecordId)}`);
    lines.push(`   - Record kind: ${text(source.recordKind)}`);
    lines.push(`   - Retrieved at: ${text(source.retrievedAt)}`);
    lines.push(`   - Source URL: ${text(source.sourceUrl)}`);
  });

  lines.push("");
  return lines;
}

function renderEvidenceRows(evidence: Array<Record<string, unknown>>, publicOnly: boolean): string[] {
  if (evidence.length === 0) {
    return ["No evidence rows are linked to this case export.", ""];
  }

  const lines: string[] = [];

  evidence.forEach((row, index) => {
    lines.push(`### Evidence ${index + 1}: ${text(row.evidence_role)}`);
    lines.push("");
    lines.push(`- Source: ${text(row.source_key)} #${text(row.external_id)}`);
    lines.push(`- Source record ID: ${text(row.source_record_id)}`);
    lines.push(`- Source URL: ${text(row.source_url)}`);
    lines.push(`- Target: ${text(row.target_type)} ${text(row.target_id)} - ${text(row.target_label)}`);
    lines.push(`- Field path: ${text(row.field_path)}`);
    lines.push(`- Field value: ${text(row.field_value)}`);
    lines.push(`- Evidence summary: ${text(row.evidence_summary)}`);
    lines.push(`- Limitations: ${text(row.limitations)}`);

    if (!publicOnly) {
      lines.push(`- Internal analyst interpretation: ${text(row.internal_analyst_interpretation)}`);
    }

    lines.push("");
  });

  return lines;
}

function renderMarkdown(artifact: Record<string, unknown>): string {
  const exportPayload = record(artifact.export);
  const caseRow = record(exportPayload.case);
  const publicSafety = record(exportPayload.publicSafety);
  const latestReview = record(publicSafety.latestReview);
  const sourceIndex = rows(artifact.sourceIndex);
  const evidence = rows(exportPayload.evidence);
  const publicOnly = publicSafety.publicOnly === true;

  const lines: string[] = [];
  lines.push(`# Centinela case evidence export: ${text(caseRow.title)}`);
  lines.push("");
  lines.push("This export is source-backed review material. It is not proof of wrongdoing or a public finding.");
  lines.push("");
  lines.push("## Export metadata");
  lines.push("");
  lines.push(`- Generated at: ${text(artifact.generatedAt)}`);
  lines.push(`- Mode: ${text(exportPayload.mode)}`);
  lines.push(`- Public-only: ${publicOnly ? "yes" : "no"}`);
  lines.push(`- Evidence rows: ${evidence.length}`);
  lines.push(`- Source records: ${sourceIndex.length}`);
  lines.push("");
  lines.push("## Case");
  lines.push("");
  lines.push(`- Case ID: ${text(caseRow.id)}`);
  lines.push(`- Case key: ${text(caseRow.case_key)}`);
  lines.push(`- Status: ${text(caseRow.status)}`);
  lines.push(`- Priority: ${text(caseRow.priority)}`);
  lines.push(`- Summary: ${text(caseRow.summary)}`);
  lines.push("");
  lines.push("## Public-safety gate");
  lines.push("");
  lines.push(`- Current status: ${text(publicSafety.status)}`);
  lines.push(`- Public export allowed: ${publicSafety.publicExportAllowed === true ? "yes" : "no"}`);
  lines.push(`- Latest public summary: ${text(latestReview.public_summary)}`);
  lines.push(`- Latest public limitations: ${text(latestReview.public_limitations)}`);
  lines.push(`- Gate rule: ${text(publicSafety.gate)}`);
  lines.push("");
  lines.push("## Source index");
  lines.push("");
  lines.push(...renderSourceIndex(sourceIndex));
  lines.push("## Evidence");
  lines.push("");
  lines.push(...renderEvidenceRows(evidence, publicOnly));
  lines.push("## Use limits");
  lines.push("");
  lines.push("- Treat this as review evidence and source context, not a legal conclusion.");
  lines.push("- Verify source URLs and source-record fields before any public reuse.");
  lines.push("- Public-facing use still needs methodology, privacy, and UX review even when the export is public-approved.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function sourceAssetCount(sourceRecords: Array<Record<string, unknown>>): number {
  return sourceRecords.reduce((sum, sourceRecord) => {
    const assets = sourceRecord.assets;
    return sum + (Array.isArray(assets) ? assets.length : 0);
  }, 0);
}

function sourceAssetStatusCounts(sourceRecords: Array<Record<string, unknown>>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const sourceRecord of sourceRecords) {
    const assets = Array.isArray(sourceRecord.assets) ? sourceRecord.assets : [];
    for (const asset of assets) {
      const status = text(record(asset).localPathStatus);
      counts[status] = (counts[status] ?? 0) + 1;
    }
  }

  return counts;
}

function renderSourceAttachmentManifestMarkdown(artifact: Record<string, unknown>): string {
  const exportPayload = record(artifact.export);
  const caseRow = record(exportPayload.case);
  const publicSafety = record(exportPayload.publicSafety);
  const latestReview = record(publicSafety.latestReview);
  const sourceRecords = rows(artifact.sourceRecords);
  const attachmentSummary = record(artifact.attachmentSummary);
  const publicOnly = publicSafety.publicOnly === true;
  const lines: string[] = [];

  lines.push(`# Centinela source attachment manifest: ${text(caseRow.title)}`);
  lines.push("");
  lines.push("This manifest lists source records and available source-run assets for review. It is not proof of wrongdoing or a public finding.");
  lines.push("");
  lines.push("## Manifest metadata");
  lines.push("");
  lines.push(`- Generated at: ${text(artifact.generatedAt)}`);
  lines.push(`- Mode: ${text(exportPayload.mode)}`);
  lines.push(`- Public-only: ${publicOnly ? "yes" : "no"}`);
  lines.push(`- Source records: ${text(attachmentSummary.sourceRecordCount)}`);
  lines.push(`- Source assets: ${text(attachmentSummary.sourceAssetCount)}`);
  lines.push(`- Asset path statuses: ${JSON.stringify(attachmentSummary.assetPathStatusCounts ?? {})}`);
  lines.push("");
  lines.push("## Case");
  lines.push("");
  lines.push(`- Case ID: ${text(caseRow.id)}`);
  lines.push(`- Case key: ${text(caseRow.case_key)}`);
  lines.push(`- Status: ${text(caseRow.status)}`);
  lines.push(`- Priority: ${text(caseRow.priority)}`);
  lines.push(`- Summary: ${text(caseRow.summary)}`);
  lines.push("");
  lines.push("## Public-safety gate");
  lines.push("");
  lines.push(`- Current status: ${text(publicSafety.status)}`);
  lines.push(`- Public export allowed: ${publicSafety.publicExportAllowed === true ? "yes" : "no"}`);
  lines.push(`- Latest public summary: ${text(latestReview.public_summary)}`);
  lines.push(`- Latest public limitations: ${text(latestReview.public_limitations)}`);
  lines.push(`- Gate rule: ${text(publicSafety.gate)}`);
  lines.push("");
  lines.push("## Source records and assets");
  lines.push("");

  if (sourceRecords.length === 0) {
    lines.push("No linked source records were found for this case export.");
    lines.push("");
  }

  sourceRecords.forEach((sourceRecord, index) => {
    const sourceRun = record(sourceRecord.sourceRun);
    const assets = rows(sourceRecord.assets);
    lines.push(`### ${index + 1}. ${text(sourceRecord.sourceKey)} #${text(sourceRecord.externalId)}`);
    lines.push("");
    lines.push(`- Source record ID: ${text(sourceRecord.sourceRecordId)}`);
    lines.push(`- Record kind: ${text(sourceRecord.recordKind)}`);
    lines.push(`- Source URL: ${text(sourceRecord.sourceUrl)}`);
    lines.push(`- Retrieved at: ${text(sourceRecord.retrievedAt)}`);
    lines.push(`- Source run: ${text(sourceRun.sourceRunKey)} #${text(sourceRun.sourceRunId)} (${text(sourceRun.status)})`);
    lines.push(`- Source run started: ${text(sourceRun.startedAt)}`);
    lines.push(`- Source run finished: ${text(sourceRun.finishedAt)}`);
    lines.push(`- Source run notes: ${text(sourceRun.notes)}`);
    lines.push(`- Payload preview: ${text(sourceRecord.payloadPreview)}`);
    lines.push("");

    if (assets.length === 0) {
      lines.push("- Source-run assets: none recorded.");
      lines.push("");
      return;
    }

    lines.push("Source-run assets:");
    assets.forEach((asset, assetIndex) => {
      lines.push(`${assetIndex + 1}. ${text(asset.assetKind)} #${text(asset.sourceAssetId)}`);
      lines.push(`   - Path: ${text(asset.path)}`);
      lines.push(`   - Local path status: ${text(asset.localPathStatus)}`);
      lines.push(`   - SHA-256: ${text(asset.sha256)}`);
      lines.push(`   - Source URL: ${text(asset.sourceUrl)}`);
      lines.push(`   - Retrieved at: ${text(asset.retrievedAt)}`);
    });
    lines.push("");
  });

  lines.push("## Use limits");
  lines.push("");
  lines.push("- This manifest is an attachment checklist, not a claim about the entities or source contents.");
  lines.push("- `exists` means the local path was present when the manifest was generated; verify again before publication or evidence packaging.");
  lines.push("- `missing` can mean the artifact was moved, cleaned, never downloaded locally, or lives on another machine.");
  lines.push("- Public reuse still requires source verification, privacy review, methodology notes, and careful non-accusatory language.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export async function buildCaseEvidenceExportArtifacts(
  options: BuildCaseEvidenceExportOptions,
): Promise<CaseEvidenceArtifactResult> {
  const exportPayload = await getAnalystCaseEvidenceExport(options.caseId, {
    publicOnly: options.publicOnly,
    limit: options.limit,
  });
  const caseRow = record(exportPayload.case);
  const evidence = rows(exportPayload.evidence);
  const sourceIndex = sourceIndexFromEvidence(evidence);
  const caseKey = text(caseRow.case_key);
  const caseId = text(caseRow.id);
  const mode = text(exportPayload.mode);
  const generatedAt = new Date().toISOString();
  const artifact = {
    generatedAt,
    disclaimer:
      "Case evidence artifacts are source-backed review material. They are not proof of wrongdoing or a public finding.",
    sourceIndex,
    export: exportPayload,
  };
  const caseSlug = slugify(caseKey);
  const fileStem = `${timestampSlug(new Date(generatedAt))}-${mode}`;
  const basePath = ["reports", "cases", caseSlug];
  const jsonPath = await writeOutputJson([...basePath, `${fileStem}.json`], artifact);
  const markdownPath = await writeOutputText([...basePath, `${fileStem}.md`], renderMarkdown(artifact));

  return {
    caseId,
    caseKey,
    mode,
    evidenceCount: evidence.length,
    sourceCount: sourceIndex.length,
    markdownPath,
    jsonPath,
  };
}

export async function buildCaseSourceAttachmentManifestArtifacts(
  options: BuildCaseEvidenceExportOptions,
): Promise<CaseSourceAttachmentManifestResult> {
  const exportPayload = await getAnalystCaseEvidenceExport(options.caseId, {
    publicOnly: options.publicOnly,
    limit: options.limit,
  });
  const caseRow = record(exportPayload.case);
  const evidence = rows(exportPayload.evidence);
  const sourceRecords = groupSourceAttachments(await loadSourceAttachmentRows(sourceRecordIdsFromEvidence(evidence)));
  const attachmentCount = sourceAssetCount(sourceRecords);
  const caseKey = text(caseRow.case_key);
  const caseId = text(caseRow.id);
  const mode = text(exportPayload.mode);
  const generatedAt = new Date().toISOString();
  const artifact = {
    generatedAt,
    disclaimer:
      "Source attachment manifests list source records and source-run assets for review. They are not proof of wrongdoing or a public finding.",
    attachmentSummary: {
      sourceRecordCount: sourceRecords.length,
      sourceAssetCount: attachmentCount,
      assetPathStatusCounts: sourceAssetStatusCounts(sourceRecords),
    },
    sourceRecords,
    export: exportPayload,
  };
  const caseSlug = slugify(caseKey);
  const fileStem = `${timestampSlug(new Date(generatedAt))}-${mode}-source-manifest`;
  const basePath = ["reports", "cases", caseSlug];
  const jsonPath = await writeOutputJson([...basePath, `${fileStem}.json`], artifact);
  const markdownPath = await writeOutputText(
    [...basePath, `${fileStem}.md`],
    renderSourceAttachmentManifestMarkdown(artifact),
  );

  return {
    caseId,
    caseKey,
    mode,
    sourceRecordCount: sourceRecords.length,
    sourceAssetCount: attachmentCount,
    markdownPath,
    jsonPath,
  };
}
