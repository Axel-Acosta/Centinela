import { outputRoot } from "../config";
import { connectToPostgres } from "./postgres";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface ListCaseArtifactOptions {
  limit?: number | undefined;
}

interface FileDescriptor {
  path: string | null;
  relativePath: string | null;
  exists: boolean;
  modifiedAt: string | null;
  sizeBytes: number | null;
}

type DbClient = Awaited<ReturnType<typeof connectToPostgres>>["client"];

function clampLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
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

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  return String(value);
}

function relativeToOutputRoot(filePath: string): string {
  return path.relative(outputRoot, filePath).replace(/\\/g, "/");
}

function fileDescriptor(filePath: string | null): FileDescriptor {
  if (!filePath) {
    return {
      path: null,
      relativePath: null,
      exists: false,
      modifiedAt: null,
      sizeBytes: null,
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      path: filePath,
      relativePath: relativeToOutputRoot(filePath),
      exists: false,
      modifiedAt: null,
      sizeBytes: null,
    };
  }

  const stat = fs.statSync(filePath);
  return {
    path: filePath,
    relativePath: relativeToOutputRoot(filePath),
    exists: true,
    modifiedAt: stat.mtime.toISOString(),
    sizeBytes: stat.isFile() ? stat.size : null,
  };
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return record(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
}

function normalizeCaseRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = typeof value === "bigint" ? value.toString() : value;
  }
  return normalized;
}

async function withDatabase<T>(work: (client: DbClient, schema: string) => Promise<T>): Promise<T> {
  const { client, schema } = await connectToPostgres();

  try {
    return await work(client, schema);
  } finally {
    await client.end();
  }
}

async function loadCase(caseId: number): Promise<Record<string, unknown>> {
  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_key,
         title,
         status,
         priority,
         summary,
         public_review_status,
         public_reviewed_at::text
       from ${schema}.analyst_case_overview
       where id = $1`,
      [caseId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Analyst case ${caseId} was not found.`);
    }

    return normalizeCaseRow(row);
  });
}

function buildEvidenceArtifactSummary(filePath: string, artifact: Record<string, unknown>): Record<string, unknown> {
  const exportPayload = record(artifact.export);
  const publicSafety = record(exportPayload.publicSafety);
  const markdownPath = filePath.replace(/\.json$/i, ".md");

  return {
    kind: "case_evidence_artifact",
    generatedAt: artifact.generatedAt ?? fileDescriptor(filePath).modifiedAt,
    mode: exportPayload.mode ?? null,
    publicSafetyStatus: publicSafety.status ?? null,
    publicOnly: publicSafety.publicOnly === true,
    counts: {
      evidenceCount: rows(exportPayload.evidence).length,
      sourceCount: rows(artifact.sourceIndex).length,
    },
    files: {
      json: fileDescriptor(filePath),
      markdown: fileDescriptor(markdownPath),
    },
    useLimit: "Evidence artifacts are local review packets, not public findings or proof of wrongdoing.",
  };
}

function buildSourceManifestSummary(filePath: string, artifact: Record<string, unknown>): Record<string, unknown> {
  const exportPayload = record(artifact.export);
  const publicSafety = record(exportPayload.publicSafety);
  const attachmentSummary = record(artifact.attachmentSummary);
  const markdownPath = filePath.replace(/\.json$/i, ".md");

  return {
    kind: "source_manifest",
    generatedAt: artifact.generatedAt ?? fileDescriptor(filePath).modifiedAt,
    mode: exportPayload.mode ?? null,
    publicSafetyStatus: publicSafety.status ?? null,
    publicOnly: publicSafety.publicOnly === true,
    counts: {
      sourceRecordCount: Number(attachmentSummary.sourceRecordCount ?? rows(artifact.sourceRecords).length),
      sourceAssetCount: Number(attachmentSummary.sourceAssetCount ?? 0),
      assetPathStatusCounts: attachmentSummary.assetPathStatusCounts ?? {},
    },
    files: {
      json: fileDescriptor(filePath),
      markdown: fileDescriptor(markdownPath),
    },
    useLimit: "Source manifests are attachment checklists for review; path availability is not a publication decision.",
  };
}

function buildBundleSummary(bundleRoot: string, bundleIndex: Record<string, unknown>): Record<string, unknown> {
  const counts = record(bundleIndex.counts);
  const files = record(bundleIndex.files);
  const sourceDocumentIndexPath = path.join(bundleRoot, text(files.sourceDocumentIndexJson));
  const sourceDocumentIndex = readJsonFile(sourceDocumentIndexPath);
  const sourceDocumentCounts = sourceDocumentIndex ? record(sourceDocumentIndex.counts) : {};

  return {
    kind: "source_bundle",
    generatedAt: bundleIndex.generatedAt ?? fileDescriptor(path.join(bundleRoot, "bundle-index.json")).modifiedAt,
    mode: bundleIndex.mode ?? null,
    bundlePath: bundleRoot,
    bundleRelativePath: relativeToOutputRoot(bundleRoot),
    publicSafetyStatus: record(bundleIndex.publicSafety).status ?? null,
    publicOnly: record(bundleIndex.publicSafety).publicOnly === true,
    counts: {
      evidenceCount: Number(counts.evidenceCount ?? 0),
      sourceRecordCount: Number(counts.sourceRecordCount ?? 0),
      sourceAssetCount: Number(counts.sourceAssetCount ?? 0),
      copiedAssetCount: Number(counts.copiedAssetCount ?? 0),
      skippedAssetCount: Number(counts.skippedAssetCount ?? 0),
      indexedDocumentCount: Number(sourceDocumentCounts.documentCount ?? 0),
      searchableDocumentCount: Number(sourceDocumentCounts.searchableDocumentCount ?? 0),
      queryMatchCount: Number(sourceDocumentCounts.queryMatchCount ?? 0),
    },
    files: {
      bundleIndex: fileDescriptor(path.join(bundleRoot, text(files.bundleIndex))),
      readme: fileDescriptor(path.join(bundleRoot, text(files.readme))),
      caseEvidenceJson: fileDescriptor(path.join(bundleRoot, text(files.caseEvidenceJson))),
      caseEvidenceMarkdown: fileDescriptor(path.join(bundleRoot, text(files.caseEvidenceMarkdown))),
      sourceManifestJson: fileDescriptor(path.join(bundleRoot, text(files.sourceManifestJson))),
      sourceManifestMarkdown: fileDescriptor(path.join(bundleRoot, text(files.sourceManifestMarkdown))),
      sourceDocumentIndexJson: fileDescriptor(sourceDocumentIndexPath),
      sourceDocumentIndexMarkdown: fileDescriptor(path.join(bundleRoot, text(files.sourceDocumentIndexMarkdown))),
      sourceDocumentIndexJsonl: fileDescriptor(path.join(bundleRoot, text(files.sourceDocumentIndexJsonl))),
    },
    sourceDocumentIndex: sourceDocumentIndex
      ? {
          generatedAt: sourceDocumentIndex.generatedAt ?? null,
          query: sourceDocumentIndex.query ?? null,
          counts: sourceDocumentCounts,
        }
      : null,
    useLimit: "Source bundles are local review packets. Copied files still need source, privacy, methodology, and UX review before public reuse.",
  };
}

function generatedAtValue(artifact: Record<string, unknown>): string {
  const value = artifact.generatedAt;
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  const files = record(artifact.files);
  const bundleIndex = record(files.bundleIndex);
  const json = record(files.json);
  return text(bundleIndex.modifiedAt ?? json.modifiedAt ?? "");
}

function discoverCaseArtifacts(caseRoot: string): Array<Record<string, unknown>> {
  if (!fs.existsSync(caseRoot)) {
    return [];
  }

  const artifacts: Array<Record<string, unknown>> = [];

  for (const entry of fs.readdirSync(caseRoot, { withFileTypes: true })) {
    const entryPath = path.join(caseRoot, entry.name);

    if (entry.isFile() && entry.name.endsWith(".json")) {
      const artifact = readJsonFile(entryPath);
      if (!artifact) {
        continue;
      }

      if (entry.name.endsWith("-source-manifest.json")) {
        artifacts.push(buildSourceManifestSummary(entryPath, artifact));
        continue;
      }

      if (record(artifact.export).mode !== undefined && Array.isArray(record(artifact.export).evidence)) {
        artifacts.push(buildEvidenceArtifactSummary(entryPath, artifact));
      }
      continue;
    }

    if (entry.isDirectory()) {
      const bundleIndexPath = path.join(entryPath, "bundle-index.json");
      const bundleIndex = readJsonFile(bundleIndexPath);
      if (bundleIndex) {
        artifacts.push(buildBundleSummary(entryPath, bundleIndex));
      }
    }
  }

  return artifacts.sort((left, right) => generatedAtValue(right).localeCompare(generatedAtValue(left)));
}

export async function listCaseArtifacts(
  caseId: number,
  options: ListCaseArtifactOptions = {},
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    throw new Error("caseId must be a positive integer.");
  }

  const limit = clampLimit(options.limit);
  const caseRow = await loadCase(caseId);
  const caseKey = text(caseRow.case_key);
  const caseRoot = path.join(outputRoot, "reports", "cases", slugify(caseKey));
  const artifacts = discoverCaseArtifacts(caseRoot);
  const limitedArtifacts = artifacts.slice(0, limit);
  const latestBundle = limitedArtifacts.find((artifact) => artifact.kind === "source_bundle");

  return {
    disclaimer:
      "Case artifact registry entries summarize local review files. They are not findings, accusations, or public-ready publication packages.",
    case: caseRow,
    artifactRoot: caseRoot,
    artifactRootRelativePath: relativeToOutputRoot(caseRoot),
    artifactRootExists: fs.existsSync(caseRoot),
    counts: {
      totalArtifacts: artifacts.length,
      returnedArtifacts: limitedArtifacts.length,
      evidenceArtifacts: artifacts.filter((artifact) => artifact.kind === "case_evidence_artifact").length,
      sourceManifests: artifacts.filter((artifact) => artifact.kind === "source_manifest").length,
      sourceBundles: artifacts.filter((artifact) => artifact.kind === "source_bundle").length,
    },
    latestBundlePath:
      latestBundle && typeof latestBundle.bundlePath === "string" ? latestBundle.bundlePath : null,
    artifacts: limitedArtifacts,
    useLimits: [
      "Generated artifacts stay outside Git and OneDrive by default.",
      "Public-only artifact mode means Centinela's approved_public gate passed for metadata; copied raw files still need separate review.",
      "Use artifact paths for local analyst navigation, not as public conclusions.",
    ],
  };
}
