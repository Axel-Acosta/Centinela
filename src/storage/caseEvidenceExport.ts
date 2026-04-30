import { writeOutputJson, writeOutputText } from "./files";
import { getAnalystCaseEvidenceExport } from "./analystWorkspace";

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
