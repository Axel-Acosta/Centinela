import { resolveOutputPath, writeOutputJson, writeOutputText } from "./files";
import { getAnalystCaseEvidenceExport } from "./analystWorkspace";
import { connectToPostgres } from "./postgres";
import { outputRoot, projectRoot } from "../config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface BuildCaseEvidenceExportOptions {
  caseId: number;
  publicOnly?: boolean;
  limit?: number;
}

export interface BuildCaseSourceBundleOptions extends BuildCaseEvidenceExportOptions {
  copyAssets?: boolean;
}

export interface BuildCaseSourceIndexOptions {
  bundlePath: string;
  query?: string;
  maxTextBytes?: number;
  maxTextPreviewChars?: number;
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

interface CaseEvidenceBuild {
  artifact: Record<string, unknown>;
  caseId: string;
  caseKey: string;
  mode: string;
  evidence: Array<Record<string, unknown>>;
  sourceIndex: Array<Record<string, unknown>>;
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

interface CaseSourceAttachmentManifestBuild {
  artifact: Record<string, unknown>;
  caseId: string;
  caseKey: string;
  mode: string;
  sourceRecords: Array<Record<string, unknown>>;
  sourceAssetCount: number;
}

interface CaseSourceBundleResult {
  caseId: string;
  caseKey: string;
  mode: string;
  sourceRecordCount: number;
  sourceAssetCount: number;
  copiedAssetCount: number;
  skippedAssetCount: number;
  bundlePath: string;
  indexPath: string;
  readmePath: string;
}

interface CaseSourceIndexResult {
  bundlePath: string;
  documentCount: number;
  searchableDocumentCount: number;
  query: string | null;
  queryMatchCount: number;
  indexPath: string;
  markdownPath: string;
  jsonlPath: string;
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

function safeFileName(value: string): string {
  const baseName = path.basename(value);
  const sanitized = baseName
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  return sanitized || "source-asset";
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

function resolveLocalAssetPath(assetPath: string | null): string | null {
  if (!assetPath) {
    return null;
  }

  if (path.isAbsolute(assetPath)) {
    const projectDataRoot = path.resolve(projectRoot, "data");
    const candidates = [assetPath];

    if (assetPath.toLowerCase().startsWith(projectDataRoot.toLowerCase())) {
      candidates.push(path.resolve(outputRoot, path.relative(projectDataRoot, assetPath)));
    }

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? assetPath;
  }

  const outputRelativePath = assetPath.replace(/^data[\\/]/, "");
  const candidates = [
    path.resolve(projectRoot, assetPath),
    path.resolve(outputRoot, outputRelativePath),
    path.resolve(outputRoot, assetPath),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function resolveBundlePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  const projectCandidate = path.resolve(projectRoot, inputPath);
  if (fs.existsSync(projectCandidate)) {
    return projectCandidate;
  }

  const outputRelativePath = inputPath.replace(/^data[\\/]/, "");
  const outputCandidate = path.resolve(outputRoot, outputRelativePath);
  if (fs.existsSync(outputCandidate)) {
    return outputCandidate;
  }

  return projectCandidate;
}

function localPathStatus(assetPath: string | null): string {
  if (!assetPath) {
    return "not_applicable";
  }

  const resolvedPath = resolveLocalAssetPath(assetPath);

  if (!path.isAbsolute(assetPath)) {
    return resolvedPath ? "exists_resolved" : "missing_relative";
  }

  return resolvedPath && fs.existsSync(resolvedPath) ? "exists" : "missing";
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
        resolvedPath: resolveLocalAssetPath(assetPath),
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

function createCaseEvidenceArtifact(exportPayload: Record<string, unknown>, generatedAt: string): CaseEvidenceBuild {
  const caseRow = record(exportPayload.case);
  const evidence = rows(exportPayload.evidence);
  const sourceIndex = sourceIndexFromEvidence(evidence);
  const caseKey = text(caseRow.case_key);
  const caseId = text(caseRow.id);
  const mode = text(exportPayload.mode);
  const artifact = {
    generatedAt,
    disclaimer:
      "Case evidence artifacts are source-backed review material. They are not proof of wrongdoing or a public finding.",
    sourceIndex,
    export: exportPayload,
  };

  return {
    artifact,
    caseId,
    caseKey,
    mode,
    evidence,
    sourceIndex,
  };
}

async function createCaseSourceAttachmentManifest(
  exportPayload: Record<string, unknown>,
  generatedAt: string,
): Promise<CaseSourceAttachmentManifestBuild> {
  const caseRow = record(exportPayload.case);
  const evidence = rows(exportPayload.evidence);
  const sourceRecords = groupSourceAttachments(await loadSourceAttachmentRows(sourceRecordIdsFromEvidence(evidence)));
  const attachmentCount = sourceAssetCount(sourceRecords);
  const caseKey = text(caseRow.case_key);
  const caseId = text(caseRow.id);
  const mode = text(exportPayload.mode);
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

  return {
    artifact,
    caseId,
    caseKey,
    mode,
    sourceRecords,
    sourceAssetCount: attachmentCount,
  };
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

function collectBundleAssets(sourceRecords: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const assetsByKey = new Map<string, Record<string, unknown>>();

  for (const sourceRecord of sourceRecords) {
    const sourceRecordId = text(sourceRecord.sourceRecordId);
    const assets = rows(sourceRecord.assets);

    for (const asset of assets) {
      const key = text(asset.sourceAssetId) === "n/a" ? `${sourceRecordId}:${text(asset.path)}` : text(asset.sourceAssetId);
      const existing = assetsByKey.get(key);

      if (existing) {
        const sourceRecordIds = Array.isArray(existing.sourceRecordIds) ? existing.sourceRecordIds : [];
        if (!sourceRecordIds.includes(sourceRecordId)) {
          sourceRecordIds.push(sourceRecordId);
        }
        existing.sourceRecordIds = sourceRecordIds;
        continue;
      }

      assetsByKey.set(key, {
        ...asset,
        sourceRecordIds: [sourceRecordId],
        sourceKeys: [sourceRecord.sourceKey ?? null],
        externalIds: [sourceRecord.externalId ?? null],
      });
    }
  }

  return [...assetsByKey.values()];
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function copyBundleAssets(
  sourceRecords: Array<Record<string, unknown>>,
  bundleRoot: string,
  copyAssets: boolean,
): Array<Record<string, unknown>> {
  const assets = collectBundleAssets(sourceRecords);
  const attachmentsDir = path.join(bundleRoot, "attachments");
  const results: Array<Record<string, unknown>> = [];

  if (copyAssets && assets.length > 0) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  assets.forEach((asset, index) => {
    const sourcePath = typeof asset.path === "string" ? asset.path : null;
    const resolvedPath =
      typeof asset.resolvedPath === "string" ? asset.resolvedPath : resolveLocalAssetPath(sourcePath);
    const expectedSha256 = typeof asset.sha256 === "string" ? asset.sha256 : null;
    const result: Record<string, unknown> = {
      sourceAssetId: asset.sourceAssetId ?? null,
      assetKind: asset.assetKind ?? null,
      sourceRecordIds: asset.sourceRecordIds ?? [],
      sourceKeys: asset.sourceKeys ?? [],
      externalIds: asset.externalIds ?? [],
      sourcePath,
      resolvedPath,
      sourceUrl: asset.sourceUrl ?? null,
      expectedSha256,
      bundleRelativePath: null,
      copiedSha256: null,
      bytes: null,
      status: "not_copied",
      reason: copyAssets ? null : "copy_assets_false",
    };

    if (!copyAssets) {
      results.push(result);
      return;
    }

    if (!sourcePath) {
      result.status = "skipped_no_path";
      result.reason = "Source asset has no local path.";
      results.push(result);
      return;
    }

    if (!resolvedPath) {
      result.status = path.isAbsolute(sourcePath) ? "missing" : "missing_relative";
      result.reason = "Source asset path was not present when the bundle was generated.";
      results.push(result);
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      result.status = "missing";
      result.reason = "Source asset path was not present when the bundle was generated.";
      results.push(result);
      return;
    }

    const sourceStat = fs.statSync(resolvedPath);
    if (!sourceStat.isFile()) {
      result.status = "skipped_not_file";
      result.reason = "Source asset path exists but is not a regular file.";
      results.push(result);
      return;
    }

    const extension = path.extname(resolvedPath).slice(0, 16);
    const targetBaseName = `${String(index + 1).padStart(3, "0")}-${safeFileName(text(asset.assetKind))}-${safeFileName(
      text(asset.sourceAssetId),
    )}`;
    const targetName = `${targetBaseName}${extension && !targetBaseName.endsWith(extension) ? extension : ""}`;
    const targetPath = path.join(attachmentsDir, targetName);
    fs.copyFileSync(resolvedPath, targetPath);
    const copiedSha256 = sha256File(targetPath);

    result.bundleRelativePath = path.relative(bundleRoot, targetPath).replace(/\\/g, "/");
    result.copiedSha256 = copiedSha256;
    result.bytes = sourceStat.size;
    result.status =
      expectedSha256 && expectedSha256.toLowerCase() !== copiedSha256.toLowerCase()
        ? "copied_hash_mismatch"
        : "copied";
    result.reason =
      result.status === "copied_hash_mismatch"
        ? "Copied file hash does not match the source_assets.sha256 value."
        : null;
    results.push(result);
  });

  return results;
}

function copiedAssetCount(assets: Array<Record<string, unknown>>): number {
  return assets.filter((asset) => text(asset.status).startsWith("copied")).length;
}

function skippedAssetCount(assets: Array<Record<string, unknown>>): number {
  return assets.filter((asset) => !text(asset.status).startsWith("copied")).length;
}

function renderBundleReadme(bundleIndex: Record<string, unknown>): string {
  const caseRow = record(bundleIndex.case);
  const publicSafety = record(bundleIndex.publicSafety);
  const counts = record(bundleIndex.counts);
  const files = record(bundleIndex.files);
  const copiedAssets = rows(bundleIndex.attachments).filter((asset) => asset.status === "copied").length;
  const lines: string[] = [];

  lines.push(`# Centinela case source bundle: ${text(caseRow.title)}`);
  lines.push("");
  lines.push("This folder is a local review bundle. It is not proof of wrongdoing or a public finding.");
  lines.push("");
  lines.push("## Bundle metadata");
  lines.push("");
  lines.push(`- Generated at: ${text(bundleIndex.generatedAt)}`);
  lines.push(`- Mode: ${text(bundleIndex.mode)}`);
  lines.push(`- Public-only: ${publicSafety.publicOnly === true ? "yes" : "no"}`);
  lines.push(`- Source records: ${text(counts.sourceRecordCount)}`);
  lines.push(`- Source assets listed: ${text(counts.sourceAssetCount)}`);
  lines.push(`- Source assets copied: ${copiedAssets}`);
  lines.push("");
  lines.push("## Files");
  lines.push("");
  lines.push(`- Bundle index: ${text(files.bundleIndex)}`);
  lines.push(`- Case evidence JSON: ${text(files.caseEvidenceJson)}`);
  lines.push(`- Case evidence Markdown: ${text(files.caseEvidenceMarkdown)}`);
  lines.push(`- Source manifest JSON: ${text(files.sourceManifestJson)}`);
  lines.push(`- Source manifest Markdown: ${text(files.sourceManifestMarkdown)}`);
  lines.push(`- Source document index JSON: ${text(files.sourceDocumentIndexJson)}`);
  lines.push(`- Source document index Markdown: ${text(files.sourceDocumentIndexMarkdown)}`);
  lines.push(`- Source document index JSONL: ${text(files.sourceDocumentIndexJsonl)}`);
  lines.push(`- Attachments folder: ${text(files.attachmentsFolder)}`);
  lines.push("");
  lines.push("## Use limits");
  lines.push("");
  lines.push("- Copied files are raw source artifacts. Review them before any public reuse.");
  lines.push("- Public-approved mode means the exported metadata passed Centinela's public-safety gate; it does not automatically make copied source files public-ready.");
  lines.push("- Preserve this folder together with `bundle-index.json` so source paths, hashes, and limitations remain traceable.");
  lines.push("- Keep non-accusatory language: this bundle supports review, not legal conclusions.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function readLimitedUtf8(filePath: string, maxBytes: number): { text: string; truncated: boolean } {
  const stats = fs.statSync(filePath);
  const byteLimit = Math.max(1, Math.min(maxBytes, stats.size));
  const file = fs.openSync(filePath, "r");

  try {
    const buffer = Buffer.alloc(byteLimit);
    const bytesRead = fs.readSync(file, buffer, 0, byteLimit, 0);
    return {
      text: buffer.subarray(0, bytesRead).toString("utf8"),
      truncated: stats.size > bytesRead,
    };
  } finally {
    fs.closeSync(file);
  }
}

function extractTextForIndex(filePath: string, maxTextBytes: number): { text: string; status: string; truncated: boolean } {
  if (!fs.existsSync(filePath)) {
    return { text: "", status: "missing", truncated: false };
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    return { text: "", status: "not_file", truncated: false };
  }

  const extension = path.extname(filePath).toLowerCase();
  const textExtensions = new Set([
    ".csv",
    ".html",
    ".htm",
    ".json",
    ".jsonl",
    ".log",
    ".md",
    ".txt",
    ".tsv",
    ".xml",
    ".yaml",
    ".yml",
  ]);

  if (!textExtensions.has(extension)) {
    return { text: "", status: "unsupported_binary_or_unknown", truncated: false };
  }

  const extracted = readLimitedUtf8(filePath, maxTextBytes);
  if (extracted.text.includes("\u0000")) {
    return { text: "", status: "binary_like_content", truncated: extracted.truncated };
  }

  return {
    text: extracted.text.replace(/\r\n/g, "\n"),
    status: "indexed_text",
    truncated: extracted.truncated,
  };
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function textPreview(value: string, maxChars: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxChars ? `${compact.slice(0, Math.max(0, maxChars - 3))}...` : compact;
}

function querySnippet(searchableText: string, query: string, maxChars: number): string | null {
  const normalizedText = normalizeSearchText(searchableText);
  const normalizedQuery = normalizeSearchText(query.trim());

  if (!normalizedQuery) {
    return null;
  }

  const index = normalizedText.indexOf(normalizedQuery);
  if (index === -1) {
    return null;
  }

  const start = Math.max(0, index - Math.floor(maxChars / 3));
  return textPreview(searchableText.slice(start, start + maxChars), maxChars);
}

function sourceRecordIdsFromBundleIndex(bundleIndex: Record<string, unknown>, attachment: Record<string, unknown>): string[] {
  const directIds = Array.isArray(attachment.sourceRecordIds) ? attachment.sourceRecordIds.map(text) : [];
  if (directIds.length > 0) {
    return directIds;
  }

  const records = rows(record(bundleIndex.sourceManifest).sourceRecords);
  return records.map((sourceRecord) => text(sourceRecord.sourceRecordId)).filter((value) => value !== "n/a");
}

function evidenceRowsForSourceRecords(bundleIndex: Record<string, unknown>, sourceRecordIds: string[]): Array<Record<string, unknown>> {
  const evidence = rows(record(record(bundleIndex.caseEvidence).export).evidence);
  const idSet = new Set(sourceRecordIds);
  return evidence.filter((row) => idSet.has(text(row.source_record_id)));
}

function buildSourceDocumentIndex(
  bundleRoot: string,
  bundleIndex: Record<string, unknown>,
  options: { query?: string | undefined; maxTextBytes: number; maxTextPreviewChars: number },
): Record<string, unknown> {
  const attachments = rows(bundleIndex.attachments);
  const query = options.query?.trim() || null;
  const documents = attachments.map((attachment, index) => {
    const bundleRelativePath = typeof attachment.bundleRelativePath === "string" ? attachment.bundleRelativePath : null;
    const filePath = bundleRelativePath ? path.join(bundleRoot, bundleRelativePath) : null;
    const extracted = filePath
      ? extractTextForIndex(filePath, options.maxTextBytes)
      : { text: "", status: "not_copied", truncated: false };
    const sourceRecordIds = sourceRecordIdsFromBundleIndex(bundleIndex, attachment);
    const evidenceRows = evidenceRowsForSourceRecords(bundleIndex, sourceRecordIds);
    const searchableText = [
      extracted.text,
      text(attachment.assetKind),
      text(attachment.sourceUrl),
      sourceRecordIds.join(" "),
      evidenceRows.map((row) => `${text(row.field_path)} ${text(row.field_value)} ${text(row.evidence_summary)}`).join(" "),
    ].join("\n");
    const matchedSnippet = query ? querySnippet(searchableText, query, options.maxTextPreviewChars) : null;

    return {
      documentId: `doc-${String(index + 1).padStart(3, "0")}`,
      status: extracted.status,
      copiedStatus: attachment.status ?? null,
      bundleRelativePath,
      fileName: bundleRelativePath ? path.basename(bundleRelativePath) : null,
      bytes: attachment.bytes ?? null,
      copiedSha256: attachment.copiedSha256 ?? null,
      expectedSha256: attachment.expectedSha256 ?? null,
      assetKind: attachment.assetKind ?? null,
      sourceAssetId: attachment.sourceAssetId ?? null,
      sourceRecordIds,
      sourceKeys: attachment.sourceKeys ?? [],
      externalIds: attachment.externalIds ?? [],
      sourceUrl: attachment.sourceUrl ?? null,
      evidenceLinkIds: evidenceRows.map((row) => row.evidence_link_id ?? null).filter((value) => value !== null),
      evidenceRoles: [...new Set(evidenceRows.map((row) => text(row.evidence_role)).filter((value) => value !== "n/a"))],
      targetLabels: [...new Set(evidenceRows.map((row) => text(row.target_label)).filter((value) => value !== "n/a"))],
      indexedTextPreview: extracted.text ? textPreview(extracted.text, options.maxTextPreviewChars) : null,
      indexedTextTruncated: extracted.truncated,
      searchableText: normalizeSearchText(searchableText),
      queryMatched: matchedSnippet !== null,
      querySnippet: matchedSnippet,
      useLimit: "Indexed source text is for analyst search and traceability. Verify original files before public reuse.",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "Source document indexes support local analyst search and traceability. They are not proof of wrongdoing or public findings.",
    bundle: {
      bundlePath: bundleRoot,
      mode: bundleIndex.mode ?? null,
      case: bundleIndex.case ?? null,
      publicSafety: bundleIndex.publicSafety ?? null,
    },
    query,
    counts: {
      documentCount: documents.length,
      searchableDocumentCount: documents.filter((document) => document.status === "indexed_text").length,
      queryMatchCount: query ? documents.filter((document) => document.queryMatched === true).length : 0,
    },
    documents,
    useLimits: [
      "Use this index for local search and evidence navigation, not as a legal conclusion.",
      "Verify original source files, source URLs, and case limitations before publication.",
      "Public-only bundles still require privacy, methodology, and UX review before public release.",
    ],
  };
}

function renderSourceDocumentIndexMarkdown(index: Record<string, unknown>): string {
  const bundle = record(index.bundle);
  const caseRow = record(bundle.case);
  const counts = record(index.counts);
  const documents = rows(index.documents);
  const query = text(index.query);
  const lines: string[] = [];

  lines.push(`# Centinela source document index: ${text(caseRow.title)}`);
  lines.push("");
  lines.push("This index supports local analyst search and traceability. It is not proof of wrongdoing or a public finding.");
  lines.push("");
  lines.push("## Index metadata");
  lines.push("");
  lines.push(`- Generated at: ${text(index.generatedAt)}`);
  lines.push(`- Bundle mode: ${text(bundle.mode)}`);
  lines.push(`- Query: ${query}`);
  lines.push(`- Documents: ${text(counts.documentCount)}`);
  lines.push(`- Searchable documents: ${text(counts.searchableDocumentCount)}`);
  lines.push(`- Query matches: ${text(counts.queryMatchCount)}`);
  lines.push("");
  lines.push("## Documents");
  lines.push("");

  if (documents.length === 0) {
    lines.push("No bundled source documents were indexed.");
    lines.push("");
  }

  documents.forEach((document) => {
    lines.push(`### ${text(document.documentId)}: ${text(document.fileName)}`);
    lines.push("");
    lines.push(`- Status: ${text(document.status)}`);
    lines.push(`- Bundle path: ${text(document.bundleRelativePath)}`);
    lines.push(`- Asset kind: ${text(document.assetKind)}`);
    lines.push(`- Source asset ID: ${text(document.sourceAssetId)}`);
    lines.push(`- Source record IDs: ${Array.isArray(document.sourceRecordIds) ? document.sourceRecordIds.map(text).join(", ") : "n/a"}`);
    lines.push(`- Evidence link IDs: ${Array.isArray(document.evidenceLinkIds) ? document.evidenceLinkIds.map(text).join(", ") : "n/a"}`);
    lines.push(`- Source URL: ${text(document.sourceUrl)}`);
    lines.push(`- SHA-256: ${text(document.copiedSha256)}`);
    lines.push(`- Query matched: ${document.queryMatched === true ? "yes" : "no"}`);
    lines.push(`- Query snippet: ${text(document.querySnippet)}`);
    lines.push(`- Text preview: ${text(document.indexedTextPreview)}`);
    lines.push("");
  });

  lines.push("## Use limits");
  lines.push("");
  lines.push("- This index is an analyst navigation aid, not a legal conclusion.");
  lines.push("- Verify original source files and source URLs before public reuse.");
  lines.push("- Do not publish raw copied source files without separate privacy, methodology, and UX review.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function readJsonFileIfPresent(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return record(JSON.parse(fs.readFileSync(filePath, "utf8")));
}

function hydrateBundleIndex(bundleRoot: string, bundleIndex: Record<string, unknown>): Record<string, unknown> {
  const files = record(bundleIndex.files);
  const caseEvidencePath = path.join(bundleRoot, text(files.caseEvidenceJson));
  const sourceManifestPath = path.join(bundleRoot, text(files.sourceManifestJson));

  return {
    ...bundleIndex,
    caseEvidence: bundleIndex.caseEvidence ?? readJsonFileIfPresent(caseEvidencePath) ?? null,
    sourceManifest: bundleIndex.sourceManifest ?? readJsonFileIfPresent(sourceManifestPath) ?? null,
  };
}

function writeSourceDocumentIndexFiles(bundleRoot: string, index: Record<string, unknown>): {
  indexPath: string;
  markdownPath: string;
  jsonlPath: string;
} {
  const indexPath = path.join(bundleRoot, "source-document-index.json");
  const markdownPath = path.join(bundleRoot, "source-document-index.md");
  const jsonlPath = path.join(bundleRoot, "source-document-index.jsonl");
  const documents = rows(index.documents);

  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, renderSourceDocumentIndexMarkdown(index), "utf8");
  fs.writeFileSync(jsonlPath, documents.map((document) => JSON.stringify(document)).join("\n") + "\n", "utf8");

  return { indexPath, markdownPath, jsonlPath };
}

export async function buildCaseEvidenceExportArtifacts(
  options: BuildCaseEvidenceExportOptions,
): Promise<CaseEvidenceArtifactResult> {
  const exportPayload = await getAnalystCaseEvidenceExport(options.caseId, {
    publicOnly: options.publicOnly,
    limit: options.limit,
  });
  const generatedAt = new Date().toISOString();
  const built = createCaseEvidenceArtifact(exportPayload, generatedAt);
  const { artifact, caseId, caseKey, evidence, mode, sourceIndex } = built;
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
  const generatedAt = new Date().toISOString();
  const built = await createCaseSourceAttachmentManifest(exportPayload, generatedAt);
  const { artifact, caseId, caseKey, mode, sourceRecords, sourceAssetCount: attachmentCount } = built;
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

export async function buildCaseSourceBundleArtifacts(
  options: BuildCaseSourceBundleOptions,
): Promise<CaseSourceBundleResult> {
  const exportPayload = await getAnalystCaseEvidenceExport(options.caseId, {
    publicOnly: options.publicOnly,
    limit: options.limit,
  });
  const generatedAt = new Date().toISOString();
  const evidenceBuild = createCaseEvidenceArtifact(exportPayload, generatedAt);
  const manifestBuild = await createCaseSourceAttachmentManifest(exportPayload, generatedAt);
  const caseSlug = slugify(evidenceBuild.caseKey);
  const fileStem = `${timestampSlug(new Date(generatedAt))}-${evidenceBuild.mode}-source-bundle`;
  const bundleRelativePath = ["reports", "cases", caseSlug, fileStem];
  const bundleRoot = resolveOutputPath(...bundleRelativePath);
  const copyAssets = options.copyAssets !== false;
  fs.mkdirSync(bundleRoot, { recursive: true });

  const copiedAssets = copyBundleAssets(manifestBuild.sourceRecords, bundleRoot, copyAssets);
  const files = {
    bundleIndex: "bundle-index.json",
    readme: "README.md",
    caseEvidenceJson: "case-evidence.json",
    caseEvidenceMarkdown: "case-evidence.md",
    sourceManifestJson: "source-manifest.json",
    sourceManifestMarkdown: "source-manifest.md",
    sourceDocumentIndexJson: "source-document-index.json",
    sourceDocumentIndexMarkdown: "source-document-index.md",
    sourceDocumentIndexJsonl: "source-document-index.jsonl",
    attachmentsFolder: "attachments/",
  };
  const bundleIndex = {
    generatedAt,
    disclaimer:
      "Case source bundles are local review packets. They are not proof of wrongdoing or public findings.",
    mode: evidenceBuild.mode,
    case: record(exportPayload.case),
    publicSafety: record(exportPayload.publicSafety),
    counts: {
      evidenceCount: evidenceBuild.evidence.length,
      sourceRecordCount: manifestBuild.sourceRecords.length,
      sourceAssetCount: manifestBuild.sourceAssetCount,
      copiedAssetCount: copiedAssetCount(copiedAssets),
      skippedAssetCount: skippedAssetCount(copiedAssets),
    },
    files,
    attachments: copiedAssets,
    useLimits: [
      "Copied files are raw source artifacts and need review before public reuse.",
      "Public-only mode reuses Centinela's approved_public gate, but raw copied files still need methodology, privacy, and UX review.",
      "This bundle supports analyst review and traceability. It is not a legal conclusion.",
    ],
  };

  const indexPath = path.join(bundleRoot, files.bundleIndex);
  const readmePath = path.join(bundleRoot, files.readme);
  const evidenceJsonPath = path.join(bundleRoot, files.caseEvidenceJson);
  const evidenceMarkdownPath = path.join(bundleRoot, files.caseEvidenceMarkdown);
  const manifestJsonPath = path.join(bundleRoot, files.sourceManifestJson);
  const manifestMarkdownPath = path.join(bundleRoot, files.sourceManifestMarkdown);

  fs.writeFileSync(indexPath, `${JSON.stringify(bundleIndex, null, 2)}\n`, "utf8");
  fs.writeFileSync(readmePath, renderBundleReadme(bundleIndex), "utf8");
  fs.writeFileSync(evidenceJsonPath, `${JSON.stringify(evidenceBuild.artifact, null, 2)}\n`, "utf8");
  fs.writeFileSync(evidenceMarkdownPath, renderMarkdown(evidenceBuild.artifact), "utf8");
  fs.writeFileSync(manifestJsonPath, `${JSON.stringify(manifestBuild.artifact, null, 2)}\n`, "utf8");
  fs.writeFileSync(manifestMarkdownPath, renderSourceAttachmentManifestMarkdown(manifestBuild.artifact), "utf8");
  writeSourceDocumentIndexFiles(
    bundleRoot,
    buildSourceDocumentIndex(
      bundleRoot,
      {
        ...bundleIndex,
        caseEvidence: evidenceBuild.artifact,
        sourceManifest: manifestBuild.artifact,
      },
      {
        maxTextBytes: 250000,
        maxTextPreviewChars: 600,
      },
    ),
  );

  return {
    caseId: evidenceBuild.caseId,
    caseKey: evidenceBuild.caseKey,
    mode: evidenceBuild.mode,
    sourceRecordCount: manifestBuild.sourceRecords.length,
    sourceAssetCount: manifestBuild.sourceAssetCount,
    copiedAssetCount: copiedAssetCount(copiedAssets),
    skippedAssetCount: skippedAssetCount(copiedAssets),
    bundlePath: bundleRoot,
    indexPath,
    readmePath,
  };
}

export async function buildCaseSourceDocumentIndexArtifacts(
  options: BuildCaseSourceIndexOptions,
): Promise<CaseSourceIndexResult> {
  const bundleRoot = resolveBundlePath(options.bundlePath);
  const bundleIndexPath = path.join(bundleRoot, "bundle-index.json");

  if (!fs.existsSync(bundleIndexPath)) {
    throw new Error(`Bundle index was not found at ${bundleIndexPath}.`);
  }

  const bundleIndex = hydrateBundleIndex(bundleRoot, record(JSON.parse(fs.readFileSync(bundleIndexPath, "utf8"))));
  const index = buildSourceDocumentIndex(bundleRoot, bundleIndex, {
    query: options.query,
    maxTextBytes: options.maxTextBytes ?? 250000,
    maxTextPreviewChars: options.maxTextPreviewChars ?? 600,
  });
  const paths = writeSourceDocumentIndexFiles(bundleRoot, index);
  const counts = record(index.counts);

  return {
    bundlePath: bundleRoot,
    documentCount: Number(counts.documentCount ?? 0),
    searchableDocumentCount: Number(counts.searchableDocumentCount ?? 0),
    query: options.query?.trim() || null,
    queryMatchCount: Number(counts.queryMatchCount ?? 0),
    indexPath: paths.indexPath,
    markdownPath: paths.markdownPath,
    jsonlPath: paths.jsonlPath,
  };
}
