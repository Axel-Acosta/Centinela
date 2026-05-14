import { outputRoot } from "../config";
import { connectToPostgres } from "./postgres";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export interface ListCaseArtifactOptions {
  limit?: number | undefined;
}

export interface GetCaseArtifactDetailOptions {
  artifactPath: string;
  maxTextChars?: number | undefined;
}

interface FileDescriptor {
  path: string | null;
  relativePath: string | null;
  exists: boolean;
  modifiedAt: string | null;
  sizeBytes: number | null;
}

type VerificationStatus = "pass" | "review" | "blocked";

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

function verificationCheck(
  key: string,
  label: string,
  status: VerificationStatus,
  detail: string,
  meta?: Record<string, unknown>,
): Record<string, unknown> {
  const check: Record<string, unknown> = {
    key,
    label,
    status,
    detail,
  };

  if (meta && Object.keys(meta).length > 0) {
    check.meta = meta;
  }

  return check;
}

function verificationSummary(checks: Array<Record<string, unknown>>): Record<string, unknown> {
  const blocked = checks.filter((check) => check.status === "blocked").length;
  const review = checks.filter((check) => check.status === "review").length;
  const pass = checks.filter((check) => check.status === "pass").length;
  const status: VerificationStatus = blocked > 0 ? "blocked" : review > 0 ? "review" : "pass";

  return {
    status,
    passedChecks: pass,
    reviewChecks: review,
    blockedChecks: blocked,
    headline:
      status === "pass"
        ? "Artifact is usable for local review navigation, but still not a public finding."
        : status === "review"
          ? "Artifact is available, but analysts must review limitations before relying on it."
          : "Artifact has a blocking verification issue and should not be used until resolved.",
  };
}

function sha256File(filePath: string): string | null {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function clampTextChars(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return 12000;
  }

  return Math.max(500, Math.min(40000, Math.trunc(value)));
}

function isWithinDirectory(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

function buildFileVerification(filePath: string, parsedJson: Record<string, unknown> | null): Record<string, unknown> {
  const descriptor = fileDescriptor(filePath);
  const checks = [
    verificationCheck(
      "path_containment",
      "Path containment",
      "pass",
      "The API only returned this artifact after resolving it inside the selected case artifact folder.",
      { relativePath: descriptor.relativePath },
    ),
    verificationCheck(
      "file_exists",
      "File exists",
      descriptor.exists ? "pass" : "blocked",
      descriptor.exists
        ? `Local file exists with ${descriptor.sizeBytes ?? "unknown"} bytes.`
        : "Local file is missing from the runtime artifact folder.",
      { sizeBytes: descriptor.sizeBytes, modifiedAt: descriptor.modifiedAt },
    ),
    verificationCheck(
      "bounded_preview",
      "Bounded preview",
      "review",
      "The console shows a bounded local preview. Analysts should open the source record and original source URL before public reuse.",
    ),
    verificationCheck(
      "parsed_json",
      "Parsed JSON",
      parsedJson ? "pass" : "review",
      parsedJson
        ? "The JSON parsed successfully for structured preview."
        : "This file is not structured JSON or could not be parsed; treat text preview as navigation only.",
    ),
  ];

  return {
    summary: verificationSummary(checks),
    checks,
    nextSteps: [
      "Use source-record IDs and evidence-link IDs to verify provenance before citing a file.",
      "Do not treat a readable preview as publication clearance.",
    ],
  };
}

function buildBundleVerification(
  bundleRoot: string,
  bundleIndex: Record<string, unknown> | null,
  sourceManifest: Record<string, unknown> | null,
  sourceDocumentIndex: Record<string, unknown> | null,
): Record<string, unknown> {
  const bundleCounts = record(bundleIndex?.counts);
  const manifestRecords = rows(sourceManifest?.sourceRecords);
  const bundleAttachments = rows(bundleIndex?.attachments);
  const copiedAttachments = bundleAttachments.filter((attachment) => attachment.status === "copied");
  const skippedAttachments = bundleAttachments.filter((attachment) => attachment.status !== "copied");
  const sourceRecordsWithUrls = manifestRecords.filter((sourceRecord) => {
    const sourceUrl = sourceRecord.sourceUrl;
    return typeof sourceUrl === "string" && sourceUrl.trim().length > 0;
  });
  const sourceRecordCount = Number(bundleCounts.sourceRecordCount ?? manifestRecords.length);
  const sourceAssetCount = Number(bundleCounts.sourceAssetCount ?? bundleAttachments.length);
  const copiedAssetCount = Number(bundleCounts.copiedAssetCount ?? copiedAttachments.length);
  const queryMatchCount = Number(record(sourceDocumentIndex?.counts).queryMatchCount ?? 0);
  const hashChecks = copiedAttachments.map((attachment) => {
    const relativePath = typeof attachment.bundleRelativePath === "string" ? attachment.bundleRelativePath : "";
    const copiedPath = path.join(bundleRoot, relativePath);
    const actualSha256 = relativePath ? sha256File(copiedPath) : null;
    const copiedSha256 = typeof attachment.copiedSha256 === "string" ? attachment.copiedSha256 : null;
    const expectedSha256 = typeof attachment.expectedSha256 === "string" ? attachment.expectedSha256 : null;
    return {
      sourceAssetId: attachment.sourceAssetId ?? null,
      bundleRelativePath: relativePath || null,
      copiedSha256,
      expectedSha256,
      actualSha256,
      copiedHashMatches: copiedSha256 !== null && actualSha256 !== null && copiedSha256 === actualSha256,
      expectedHashMatches:
        !expectedSha256 || (actualSha256 !== null && expectedSha256.toLowerCase() === actualSha256.toLowerCase()),
    };
  });
  const copiedHashMismatches = hashChecks.filter((check) => check.copiedHashMatches === false);
  const expectedHashMismatches = hashChecks.filter((check) => check.expectedHashMatches === false);
  const publicSafety = record(bundleIndex?.publicSafety);
  const publicStatus = text(publicSafety.status ?? "internal_only");
  const publicOnly = publicSafety.publicOnly === true;

  const checks = [
    verificationCheck(
      "path_containment",
      "Path containment",
      "pass",
      "The API resolved this bundle inside the selected case artifact folder before reading it.",
      { relativePath: relativeToOutputRoot(bundleRoot) },
    ),
    verificationCheck(
      "bundle_index",
      "Bundle index",
      bundleIndex ? "pass" : "blocked",
      bundleIndex ? "bundle-index.json is present and parseable." : "bundle-index.json is missing or unreadable.",
    ),
    verificationCheck(
      "source_manifest",
      "Source manifest",
      sourceManifest ? "pass" : "review",
      sourceManifest
        ? `${sourceRecordCount} source records are listed for provenance review.`
        : "source-manifest.json is missing or unreadable; provenance should be checked from case evidence instead.",
      { sourceRecordCount },
    ),
    verificationCheck(
      "source_document_index",
      "Source-document index",
      sourceDocumentIndex ? "pass" : "review",
      sourceDocumentIndex
        ? `source-document-index.json is present with ${queryMatchCount} query matches.`
        : "No source-document index is present; search/navigation may be weaker.",
      { queryMatchCount },
    ),
    verificationCheck(
      "asset_copy_coverage",
      "Asset copy coverage",
      sourceAssetCount > 0 && copiedAssetCount === sourceAssetCount ? "pass" : "review",
      `${copiedAssetCount} of ${sourceAssetCount} source-run assets are copied in the local bundle.`,
      { copiedAssetCount, sourceAssetCount, skippedAssetCount: skippedAttachments.length },
    ),
    verificationCheck(
      "hash_verification",
      "Hash verification",
      copiedHashMismatches.length === 0 && expectedHashMismatches.length === 0 ? "pass" : "blocked",
      copiedHashMismatches.length === 0 && expectedHashMismatches.length === 0
        ? `${hashChecks.length} copied assets were hash-checked when local files were available.`
        : "One or more copied assets failed copied or expected SHA-256 verification.",
      {
        checkedAssetCount: hashChecks.length,
        copiedHashMismatchCount: copiedHashMismatches.length,
        expectedHashMismatchCount: expectedHashMismatches.length,
      },
    ),
    verificationCheck(
      "source_url_coverage",
      "Source URL coverage",
      sourceRecordsWithUrls.length > 0 ? "pass" : "review",
      `${sourceRecordsWithUrls.length} of ${sourceRecordCount} source records include an original source URL.`,
      { sourceRecordsWithUrls: sourceRecordsWithUrls.length, sourceRecordCount },
    ),
    verificationCheck(
      "publication_gate",
      "Publication gate",
      publicOnly && publicStatus === "approved_public" ? "review" : "review",
      publicOnly && publicStatus === "approved_public"
        ? "The public-only artifact gate passed, but copied raw files still need separate privacy, source, methodology, and UX review."
        : "This bundle is for internal review only and is not publication-ready.",
      { publicOnly, publicStatus },
    ),
  ];

  return {
    summary: verificationSummary(checks),
    checks,
    hashChecks: hashChecks.slice(0, 20),
    nextSteps: [
      "Open source records before relying on snippets or copied attachments.",
      "Verify original source URLs and source-record retrieval times for any cited claim.",
      "Treat downloaded files, OCR gaps, empty text extracts, and DNCP 404s as source limitations, not as evidence about wrongdoing.",
      "Run public methodology, privacy, licensing, and UX review before any outward-facing reuse.",
    ],
  };
}

function resolveArtifactPath(caseRoot: string, requestedPath: string): string {
  const requested = requestedPath.trim();
  if (!requested) {
    throw new Error("artifactPath is required.");
  }

  const candidatePaths = path.isAbsolute(requested)
    ? [requested]
    : [path.join(outputRoot, requested), path.join(caseRoot, requested)];
  const resolvedRoot = path.resolve(caseRoot);

  for (const candidatePath of candidatePaths) {
    const resolved = path.resolve(candidatePath);
    if (isWithinDirectory(resolvedRoot, resolved) && fs.existsSync(resolved)) {
      return resolved;
    }
  }

  const safeCandidate = path.resolve(path.isAbsolute(requested) ? requested : path.join(outputRoot, requested));
  if (!isWithinDirectory(resolvedRoot, safeCandidate)) {
    throw new Error("Requested artifact path is outside the selected case artifact folder.");
  }

  throw new Error(`Artifact path was not found: ${requested}`);
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
    verification: {
      summary: {
        status:
          Number(counts.sourceAssetCount ?? 0) > 0 &&
          Number(counts.copiedAssetCount ?? 0) < Number(counts.sourceAssetCount ?? 0)
            ? "review"
            : "pass",
        headline:
          "Open bundle detail to verify path containment, copied assets, hashes, source URLs, and publication limits.",
      },
    },
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

export async function getCaseArtifactDetail(
  caseId: number,
  options: GetCaseArtifactDetailOptions,
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(caseId) || caseId <= 0) {
    throw new Error("caseId must be a positive integer.");
  }

  const caseRow = await loadCase(caseId);
  const caseKey = text(caseRow.case_key);
  const caseRoot = path.join(outputRoot, "reports", "cases", slugify(caseKey));
  const artifactPath = resolveArtifactPath(caseRoot, options.artifactPath);
  const descriptor = fileDescriptor(artifactPath);
  const maxTextChars = clampTextChars(options.maxTextChars);

  if (fs.statSync(artifactPath).isDirectory()) {
    const bundleIndexPath = path.join(artifactPath, "bundle-index.json");
    const sourceDocumentIndexPath = path.join(artifactPath, "source-document-index.json");
    const readmePath = path.join(artifactPath, "README.md");

    return {
      disclaimer:
        "Artifact details are local review aids. They are not findings, accusations, or public-ready publication packages.",
      case: caseRow,
      kind: "artifact_directory",
      file: descriptor,
      bundleIndex: readJsonFile(bundleIndexPath),
      sourceManifest: readJsonFile(path.join(artifactPath, "source-manifest.json")),
      sourceDocumentIndex: readJsonFile(sourceDocumentIndexPath),
      readmePreview: fs.existsSync(readmePath)
        ? fs.readFileSync(readmePath, "utf8").slice(0, maxTextChars)
        : null,
      verification: buildBundleVerification(
        artifactPath,
        readJsonFile(bundleIndexPath),
        readJsonFile(path.join(artifactPath, "source-manifest.json")),
        readJsonFile(sourceDocumentIndexPath),
      ),
      useLimit:
        "Directory details summarize local bundle files. Copied source files still need separate source, privacy, methodology, and UX review before any public use.",
    };
  }

  const extension = path.extname(artifactPath).toLowerCase();
  const textPreview = fs.readFileSync(artifactPath, "utf8").slice(0, maxTextChars);

  return {
    disclaimer:
      "Artifact details are local review aids. They are not findings, accusations, or public-ready publication packages.",
    case: caseRow,
    kind: "artifact_file",
    file: descriptor,
    parsedJson: extension === ".json" ? readJsonFile(artifactPath) : null,
    textPreview,
    textPreviewTruncated: descriptor.sizeBytes !== null && descriptor.sizeBytes > maxTextChars,
    verification: buildFileVerification(artifactPath, extension === ".json" ? readJsonFile(artifactPath) : null),
    useLimit:
      "File previews are bounded for local navigation. Analysts should verify source context before relying on any excerpt.",
  };
}
