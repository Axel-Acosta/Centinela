import { connectToPostgres } from "./postgres";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_FIELD_SUGGESTIONS = 80;

export const analystTargetTypes = [
  "entity",
  "process",
  "external_candidate",
  "accepted_match",
  "source_record",
  "second_review",
  "other",
] as const;

export const analystCaseLinkTargetTypes = [...analystTargetTypes, "note"] as const;

export const analystNoteTypes = [
  "analyst_note",
  "evidence_note",
  "limitation",
  "follow_up",
  "source_check",
  "methodology_note",
] as const;

export const analystCaseStatuses = ["open", "monitoring", "paused", "closed"] as const;
export const analystCasePriorities = ["low", "normal", "high", "urgent"] as const;
export const analystEvidenceRoles = [
  "context",
  "supports_identity_context",
  "supports_review_lead",
  "supports_limitation",
  "contradicts_or_limits",
  "needs_follow_up",
] as const;
export const analystPublicReviewStatuses = [
  "internal_only",
  "public_candidate",
  "needs_redaction",
  "approved_public",
  "rejected_public",
] as const;

export type AnalystTargetType = (typeof analystTargetTypes)[number];
export type AnalystCaseLinkTargetType = (typeof analystCaseLinkTargetTypes)[number];
export type AnalystNoteType = (typeof analystNoteTypes)[number];
export type AnalystCaseStatus = (typeof analystCaseStatuses)[number];
export type AnalystCasePriority = (typeof analystCasePriorities)[number];
export type AnalystEvidenceRole = (typeof analystEvidenceRoles)[number];
export type AnalystPublicReviewStatus = (typeof analystPublicReviewStatuses)[number];

export interface ListAnalystNotesOptions {
  targetType?: string | undefined;
  targetId?: string | undefined;
  caseId?: number | undefined;
  limit?: number | undefined;
}

export interface CreateAnalystNoteOptions {
  targetType: string;
  targetId: string;
  noteText: string;
  analyst: string;
  noteType?: string | undefined;
  caseId?: number | undefined;
  visibility?: string | undefined;
  provenance?: Record<string, unknown> | undefined;
  dryRun?: boolean | undefined;
}

export interface ListAnalystCasesOptions {
  status?: string | undefined;
  limit?: number | undefined;
}

export interface GetAnalystCaseOptions {
  limit?: number | undefined;
}

export interface CreateAnalystCaseOptions {
  title: string;
  caseKey?: string | undefined;
  status?: string | undefined;
  priority?: string | undefined;
  summary?: string | undefined;
  createdBy?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  dryRun?: boolean | undefined;
}

export interface LinkAnalystCaseTargetOptions {
  caseId: number;
  targetType: string;
  targetId: string;
  label?: string | undefined;
  rationale?: string | undefined;
  createdBy?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  dryRun?: boolean | undefined;
}

export interface CreateAnalystEvidenceLinkOptions {
  caseId: number;
  sourceRecordId: number;
  targetType: string;
  targetId: string;
  noteId?: number | undefined;
  fieldPath?: string | undefined;
  fieldValue?: string | undefined;
  evidenceSummary: string;
  analystInterpretation?: string | undefined;
  limitations?: string | undefined;
  evidenceRole?: string | undefined;
  createdBy?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  dryRun?: boolean | undefined;
}

export interface ReviewAnalystCasePublicSafetyOptions {
  caseId: number;
  reviewStatus: string;
  publicSummary?: string | undefined;
  publicLimitations?: string | undefined;
  reviewedBy?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  dryRun?: boolean | undefined;
}

export interface GetAnalystCaseEvidenceExportOptions {
  publicOnly?: boolean | undefined;
  limit?: number | undefined;
}

export interface SourceRecordOptions {
  sourceKey?: string | undefined;
  externalId?: string | undefined;
  recordKind?: string | undefined;
  q?: string | undefined;
  limit?: number | undefined;
}

export interface SourceRecordFieldSuggestion {
  path: string;
  valuePreview: string;
  valueType: string;
  evidenceRoleHint: AnalystEvidenceRole;
  reason: string;
  priority: number;
}

type DbClient = Awaited<ReturnType<typeof connectToPostgres>>["client"];

function clampLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function normalizeRows<T extends Record<string, unknown>>(rows: T[]): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      normalized[key] = typeof value === "bigint" ? value.toString() : value;
    }

    return normalized;
  });
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function assertChoice<T extends readonly string[]>(value: string, choices: T, label: string): asserts value is T[number] {
  if (!choices.includes(value)) {
    throw new Error(`Unsupported ${label} "${value}". Use one of: ${choices.join(", ")}`);
  }
}

function assertPositiveInteger(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "centinela-case";
}

function defaultCaseKey(title: string): string {
  return `${slugify(title)}-${Date.now().toString(36)}`;
}

function jsonb(value: unknown): string {
  return JSON.stringify(value ?? {});
}

function omitInternalEvidenceFields(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...row };
  delete sanitized.internal_analyst_interpretation;
  delete sanitized.evidence_metadata;
  delete sanitized.created_by;
  delete sanitized.public_reviewed_by;
  return sanitized;
}

function valueType(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  return typeof value;
}

function previewValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 220 ? `${value.slice(0, 217)}...` : value;
  }

  const raw = JSON.stringify(value) ?? String(value);
  return raw.length > 220 ? `${raw.slice(0, 217)}...` : raw;
}

function appendPath(parent: string, key: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return `${parent}.${key}`;
  }

  return `${parent}[${JSON.stringify(key)}]`;
}

function classifyField(path: string, value: unknown): Pick<SourceRecordFieldSuggestion, "evidenceRoleHint" | "priority" | "reason"> {
  const lower = path
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const stringValue = typeof value === "string" ? value.trim() : "";

  if (/(ruc|tax|identifier|identificador|document|documento|external_id|registration|registry)/.test(lower)) {
    return {
      evidenceRoleHint: "supports_identity_context",
      priority: 95,
      reason: "Identifier-like field useful for identity-context review.",
    };
  }

  if (/(name|nombre|razon|denominacion|firm|company|supplier|proveedor|contratista)/.test(lower)) {
    return {
      evidenceRoleHint: "supports_identity_context",
      priority: 90,
      reason: "Name-like field useful for entity matching or source-backed identity context.",
    };
  }

  if (/(status|estado|sanction|sancion|debar|inhabil|eligible|eligibility|reason|causal|motivo)/.test(lower)) {
    return {
      evidenceRoleHint: "supports_review_lead",
      priority: 82,
      reason: "Status or sanction-like field useful for review-lead explanation.",
    };
  }

  if (/(from|to|date|fecha|period|vigencia|start|end|inicio|fin)/.test(lower)) {
    return {
      evidenceRoleHint: "supports_review_lead",
      priority: 76,
      reason: "Date or period field useful for timeline and limitation context.",
    };
  }

  if (/(country|pais|jurisdiction|jurisdiccion|nationality)/.test(lower)) {
    return {
      evidenceRoleHint: "context",
      priority: 66,
      reason: "Jurisdiction-like field useful as contextual source evidence.",
    };
  }

  if (stringValue.length >= 3 && stringValue.length <= 180) {
    return {
      evidenceRoleHint: "context",
      priority: 45,
      reason: "Short scalar field that may be useful for source-record citation.",
    };
  }

  return {
    evidenceRoleHint: "context",
    priority: 20,
    reason: "Scalar source-record field available for analyst review.",
  };
}

function buildFieldSuggestions(payload: unknown, limit = MAX_FIELD_SUGGESTIONS): SourceRecordFieldSuggestion[] {
  const suggestions: SourceRecordFieldSuggestion[] = [];
  const seen = new Set<string>();

  function visit(value: unknown, path: string, depth: number): void {
    if (suggestions.length >= limit * 3 || depth > 6 || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.slice(0, 8).forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }

    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
        visit(child, appendPath(path, key), depth + 1);
      }
      return;
    }

    const preview = previewValue(value);
    if (!preview || seen.has(path)) {
      return;
    }

    seen.add(path);
    const classification = classifyField(path, value);
    suggestions.push({
      path,
      valuePreview: preview,
      valueType: valueType(value),
      ...classification,
    });
  }

  visit(payload, "payload", 0);

  return suggestions
    .sort((left, right) => right.priority - left.priority || left.path.localeCompare(right.path))
    .slice(0, limit);
}

async function withDatabase<T>(work: (client: DbClient, schema: string) => Promise<T>): Promise<T> {
  const { client, schema } = await connectToPostgres();

  try {
    return await work(client, schema);
  } finally {
    await client.end();
  }
}

export async function listAnalystCases(
  options: ListAnalystCasesOptions = {},
): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const status = optionalText(options.status);

  if (status !== null) {
    assertChoice(status, analystCaseStatuses, "case status");
  }

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_key,
         title,
         status,
         priority,
         summary,
         created_by,
         created_at::text,
         updated_at::text,
         metadata,
         linked_target_count,
         note_count,
         evidence_link_count,
         latest_note_at::text,
         latest_evidence_at::text,
         public_review_status,
         public_reviewed_at::text
       from ${schema}.analyst_case_overview
       where ($1::text is null or status = $1)
       order by
         case priority
           when 'urgent' then 4
           when 'high' then 3
           when 'normal' then 2
           else 1
         end desc,
         updated_at desc
       limit $2`,
      [status, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function getAnalystCase(
  caseId: number,
  options: GetAnalystCaseOptions = {},
): Promise<Record<string, unknown>> {
  assertPositiveInteger(caseId, "caseId");
  const limit = clampLimit(options.limit);

  return withDatabase(async (client, schema) => {
    const caseResult = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_key,
         title,
         status,
         priority,
         summary,
         created_by,
         created_at::text,
         updated_at::text,
         metadata,
         linked_target_count,
         note_count,
         evidence_link_count,
         latest_note_at::text,
         latest_evidence_at::text,
         public_review_status,
         public_reviewed_at::text
       from ${schema}.analyst_case_overview
       where id = $1`,
      [caseId],
    );

    const caseRow = caseResult.rows[0];
    if (!caseRow) {
      throw new Error(`Analyst case ${caseId} was not found.`);
    }

    const links = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         target_type,
         target_id,
         label,
         rationale,
         created_by,
         created_at::text,
         metadata
       from ${schema}.analyst_case_links
       where case_id = $1
       order by created_at desc, id desc
       limit $2`,
      [caseId, limit],
    );

    const notes = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         case_key,
         case_title,
         target_type,
         target_id,
         note_type,
         note_text,
         analyst,
         visibility,
         provenance,
         linked_source_record_count,
         created_at::text,
         updated_at::text
       from ${schema}.analyst_note_overview
       where case_id = $1
       order by created_at desc, id desc
       limit $2`,
      [caseId, limit],
    );

    const evidenceLinks = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         case_key,
         case_title,
         note_id::text,
         note_type,
         note_text,
         source_record_id::text,
         source_key,
         external_id,
         record_kind,
         source_url,
         retrieved_at::text,
         source_run_status,
         target_type,
         target_id,
         target_label,
         field_path,
         field_value,
         evidence_summary,
         analyst_interpretation,
         limitations,
         evidence_role,
         created_by,
         created_at::text,
         metadata
       from ${schema}.analyst_case_evidence_overview
       where case_id = $1
       order by created_at desc, id desc
       limit $2`,
      [caseId, limit],
    );

    const timeline = await client.query<Record<string, unknown>>(
      `select
         case_id::text,
         case_key,
         event_type,
         target_type,
         target_id,
         event_at::text,
         actor,
         title,
         body,
         metadata
       from ${schema}.analyst_case_timeline
       where case_id = $1
       order by event_at desc, event_type desc, target_type, target_id
       limit $2`,
      [caseId, limit],
    );

    const publicReviews = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         review_status,
         public_summary,
         public_limitations,
         reviewed_by,
         reviewed_at::text,
         metadata
       from ${schema}.analyst_case_public_reviews
       where case_id = $1
       order by reviewed_at desc, id desc
       limit $2`,
      [caseId, limit],
    );

    return {
      disclaimer:
        "Case timelines are internal review context. They are not proof of wrongdoing or a public finding.",
      case: normalizeRows([caseRow])[0],
      links: normalizeRows(links.rows),
      notes: normalizeRows(notes.rows),
      evidenceLinks: normalizeRows(evidenceLinks.rows),
      publicReviews: normalizeRows(publicReviews.rows),
      timeline: normalizeRows(timeline.rows),
    };
  });
}

export async function createAnalystCase(options: CreateAnalystCaseOptions): Promise<Record<string, unknown>> {
  const title = optionalText(options.title);
  if (!title) {
    throw new Error("title is required.");
  }

  const caseKey = optionalText(options.caseKey) ?? defaultCaseKey(title);
  const status = optionalText(options.status) ?? "open";
  const priority = optionalText(options.priority) ?? "normal";
  const createdBy = optionalText(options.createdBy) ?? "centinela-operator";

  assertChoice(status, analystCaseStatuses, "case status");
  assertChoice(priority, analystCasePriorities, "case priority");

  const preview = {
    id: "(dry-run)",
    case_key: caseKey,
    title,
    status,
    priority,
    summary: options.summary ?? null,
    created_by: createdBy,
    metadata: options.metadata ?? {},
  };

  if (options.dryRun) {
    return preview;
  }

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `insert into ${schema}.analyst_cases
         (case_key, title, status, priority, summary, created_by, metadata)
       values ($1, $2, $3, $4, nullif($5, ''), $6, $7::jsonb)
       on conflict (case_key)
       do update
       set updated_at = now()
       returning
         id::text,
         case_key,
         title,
         status,
         priority,
         summary,
         created_by,
         created_at::text,
         updated_at::text,
         metadata`,
      [caseKey, title, status, priority, options.summary ?? "", createdBy, jsonb(options.metadata ?? {})],
    );

    return normalizeRows(result.rows)[0] ?? preview;
  });
}

export async function linkAnalystCaseTarget(
  options: LinkAnalystCaseTargetOptions,
): Promise<Record<string, unknown>> {
  assertPositiveInteger(options.caseId, "caseId");

  const targetType = optionalText(options.targetType);
  const targetId = optionalText(options.targetId);
  if (!targetType || !targetId) {
    throw new Error("targetType and targetId are required.");
  }

  assertChoice(targetType, analystCaseLinkTargetTypes, "target type");

  const preview = {
    id: "(dry-run)",
    case_id: String(options.caseId),
    target_type: targetType,
    target_id: targetId,
    label: options.label ?? null,
    rationale: options.rationale ?? null,
    created_by: options.createdBy ?? "centinela-operator",
    metadata: options.metadata ?? {},
  };

  if (options.dryRun) {
    return preview;
  }

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `insert into ${schema}.analyst_case_links
         (case_id, target_type, target_id, label, rationale, created_by, metadata)
       values ($1::bigint, $2, $3, nullif($4, ''), nullif($5, ''), $6, $7::jsonb)
       on conflict (case_id, target_type, target_id)
       do update
       set
         label = excluded.label,
         rationale = excluded.rationale,
         metadata = ${schema}.analyst_case_links.metadata || excluded.metadata
       returning
         id::text,
         case_id::text,
         target_type,
         target_id,
         label,
         rationale,
         created_by,
         created_at::text,
         metadata`,
      [
        options.caseId,
        targetType,
        targetId,
        options.label ?? "",
        options.rationale ?? "",
        options.createdBy ?? "centinela-operator",
        jsonb(options.metadata ?? {}),
      ],
    );

    await client.query(
      `update ${schema}.analyst_cases
       set updated_at = now()
       where id = $1`,
      [options.caseId],
    );

    return normalizeRows(result.rows)[0] ?? preview;
  });
}

export async function createAnalystEvidenceLink(
  options: CreateAnalystEvidenceLinkOptions,
): Promise<Record<string, unknown>> {
  assertPositiveInteger(options.caseId, "caseId");
  assertPositiveInteger(options.sourceRecordId, "sourceRecordId");
  assertPositiveInteger(options.noteId, "noteId");

  const targetType = optionalText(options.targetType);
  const targetId = optionalText(options.targetId);
  const evidenceSummary = optionalText(options.evidenceSummary);
  const evidenceRole = optionalText(options.evidenceRole) ?? "context";
  const createdBy = optionalText(options.createdBy) ?? "centinela-operator";

  if (!targetType || !targetId || !evidenceSummary) {
    throw new Error("targetType, targetId, sourceRecordId, and evidenceSummary are required.");
  }

  assertChoice(targetType, analystTargetTypes, "target type");
  assertChoice(evidenceRole, analystEvidenceRoles, "evidence role");

  const preview = {
    id: "(dry-run)",
    case_id: String(options.caseId),
    note_id: options.noteId ? String(options.noteId) : null,
    source_record_id: String(options.sourceRecordId),
    target_type: targetType,
    target_id: targetId,
    field_path: options.fieldPath ?? null,
    field_value: options.fieldValue ?? null,
    evidence_summary: evidenceSummary,
    analyst_interpretation: options.analystInterpretation ?? null,
    limitations: options.limitations ?? null,
    evidence_role: evidenceRole,
    created_by: createdBy,
    metadata: options.metadata ?? {},
  };

  if (options.dryRun) {
    return preview;
  }

  return withDatabase(async (client, schema) => {
    if (options.noteId !== undefined) {
      const noteCheck = await client.query(
        `select 1
         from ${schema}.analyst_notes
         where id = $1
           and case_id = $2
         limit 1`,
        [options.noteId, options.caseId],
      );

      if (noteCheck.rowCount === 0) {
        throw new Error(`Analyst note ${options.noteId} is not linked to case ${options.caseId}.`);
      }
    }

    const inserted = await client.query<{ id: string }>(
      `insert into ${schema}.analyst_evidence_links
         (
           case_id,
           note_id,
           source_record_id,
           target_type,
           target_id,
           field_path,
           field_value,
           evidence_summary,
           analyst_interpretation,
           limitations,
           evidence_role,
           created_by,
           metadata
         )
       values (
         $1::bigint,
         $2::bigint,
         $3::bigint,
         $4,
         $5,
         nullif($6, ''),
         nullif($7, ''),
         $8,
         nullif($9, ''),
         nullif($10, ''),
         $11,
         $12,
         $13::jsonb
       )
       returning id::text`,
      [
        options.caseId,
        options.noteId ?? null,
        options.sourceRecordId,
        targetType,
        targetId,
        options.fieldPath ?? "",
        options.fieldValue ?? "",
        evidenceSummary,
        options.analystInterpretation ?? "",
        options.limitations ?? "",
        evidenceRole,
        createdBy,
        jsonb(options.metadata ?? {}),
      ],
    );

    const insertedId = inserted.rows[0]?.id;
    await client.query(
      `update ${schema}.analyst_cases
       set updated_at = now()
       where id = $1`,
      [options.caseId],
    );

    const result = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         case_key,
         case_title,
         note_id::text,
         note_type,
         note_text,
         source_record_id::text,
         source_key,
         external_id,
         record_kind,
         source_url,
         retrieved_at::text,
         source_run_status,
         target_type,
         target_id,
         target_label,
         field_path,
         field_value,
         evidence_summary,
         analyst_interpretation,
         limitations,
         evidence_role,
         created_by,
         created_at::text,
         metadata
       from ${schema}.analyst_case_evidence_overview
       where id = $1`,
      [insertedId],
    );

    return normalizeRows(result.rows)[0] ?? preview;
  });
}

export async function reviewAnalystCasePublicSafety(
  options: ReviewAnalystCasePublicSafetyOptions,
): Promise<Record<string, unknown>> {
  assertPositiveInteger(options.caseId, "caseId");

  const reviewStatus = optionalText(options.reviewStatus);
  const reviewedBy = optionalText(options.reviewedBy) ?? "centinela-operator";
  const publicSummary = optionalText(options.publicSummary);
  const publicLimitations = optionalText(options.publicLimitations);

  if (!reviewStatus) {
    throw new Error("reviewStatus is required.");
  }

  assertChoice(reviewStatus, analystPublicReviewStatuses, "public review status");

  if (reviewStatus === "approved_public" && (!publicSummary || !publicLimitations)) {
    throw new Error("approved_public requires publicSummary and publicLimitations.");
  }

  const preview = {
    id: "(dry-run)",
    case_id: String(options.caseId),
    review_status: reviewStatus,
    public_summary: publicSummary,
    public_limitations: publicLimitations,
    reviewed_by: reviewedBy,
    metadata: options.metadata ?? {},
  };

  if (options.dryRun) {
    return preview;
  }

  return withDatabase(async (client, schema) => {
    const inserted = await client.query<{ id: string }>(
      `insert into ${schema}.analyst_case_public_reviews
         (case_id, review_status, public_summary, public_limitations, reviewed_by, metadata)
       values ($1::bigint, $2, $3, $4, $5, $6::jsonb)
       returning id::text`,
      [options.caseId, reviewStatus, publicSummary, publicLimitations, reviewedBy, jsonb(options.metadata ?? {})],
    );

    await client.query(
      `update ${schema}.analyst_cases
       set updated_at = now()
       where id = $1`,
      [options.caseId],
    );

    const result = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         case_key,
         case_title,
         review_status,
         public_summary,
         public_limitations,
         reviewed_by,
         reviewed_at::text,
         metadata,
         review_history_count
       from ${schema}.analyst_case_public_review_overview
       where id = $1`,
      [inserted.rows[0]?.id],
    );

    return normalizeRows(result.rows)[0] ?? preview;
  });
}

export async function getAnalystCaseEvidenceExport(
  caseId: number,
  options: GetAnalystCaseEvidenceExportOptions = {},
): Promise<Record<string, unknown>> {
  assertPositiveInteger(caseId, "caseId");
  const limit = clampLimit(options.limit);
  const publicOnly = options.publicOnly === true;

  return withDatabase(async (client, schema) => {
    const caseResult = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_key,
         title,
         status,
         priority,
         summary,
         created_by,
         created_at::text,
         updated_at::text,
         metadata,
         linked_target_count,
         note_count,
         evidence_link_count,
         latest_note_at::text,
         latest_evidence_at::text,
         public_review_status,
         public_reviewed_at::text
       from ${schema}.analyst_case_overview
       where id = $1`,
      [caseId],
    );

    const caseRow = caseResult.rows[0];
    if (!caseRow) {
      throw new Error(`Analyst case ${caseId} was not found.`);
    }

    const publicReviewStatus = String(caseRow.public_review_status ?? "internal_only");
    if (publicOnly && publicReviewStatus !== "approved_public") {
      throw new Error(
        `Case ${caseId} is not approved for public export. Current public review status: ${publicReviewStatus}.`,
      );
    }

    const reviewResult = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         case_key,
         case_title,
         review_status,
         public_summary,
         public_limitations,
         reviewed_by,
         reviewed_at::text,
         metadata,
         review_history_count
       from ${schema}.analyst_case_public_review_overview
       where case_id = $1`,
      [caseId],
    );

    const evidenceResult = await client.query<Record<string, unknown>>(
      `select
         evidence_link_id::text,
         case_id::text,
         case_key,
         case_title,
         case_status,
         case_priority,
         public_review_status,
         public_summary,
         public_limitations,
         public_reviewed_by,
         public_reviewed_at::text,
         source_record_id::text,
         source_key,
         external_id,
         record_kind,
         source_url,
         retrieved_at::text,
         source_run_status,
         target_type,
         target_id,
         target_label,
         field_path,
         field_value,
         evidence_summary,
         internal_analyst_interpretation,
         limitations,
         evidence_role,
         created_by,
         created_at::text,
         evidence_metadata,
         export_disclaimer
       from ${schema}.analyst_case_evidence_export
       where case_id = $1
       order by created_at desc, evidence_link_id desc
       limit $2`,
      [caseId, limit],
    );

    const evidenceRows = normalizeRows(evidenceResult.rows);
    const evidence = publicOnly ? evidenceRows.map(omitInternalEvidenceFields) : evidenceRows;

    return {
      disclaimer:
        "Evidence exports package source-backed review material. They are not proof of wrongdoing or a public finding.",
      mode: publicOnly ? "public_approved" : "internal_review",
      publicSafety: {
        status: publicReviewStatus,
        publicOnly,
        publicExportAllowed: publicReviewStatus === "approved_public",
        latestReview: normalizeRows(reviewResult.rows)[0] ?? null,
        gate:
          "Public-only export requires an explicit approved_public review. Internal exports may contain analyst interpretation.",
      },
      case: normalizeRows([caseRow])[0],
      evidence,
    };
  });
}

export async function listAnalystNotes(
  options: ListAnalystNotesOptions = {},
): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const targetType = optionalText(options.targetType);
  const targetId = optionalText(options.targetId);

  if (targetType !== null) {
    assertChoice(targetType, analystTargetTypes, "target type");
  }

  assertPositiveInteger(options.caseId, "caseId");

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select
         id::text,
         case_id::text,
         case_key,
         case_title,
         target_type,
         target_id,
         note_type,
         note_text,
         analyst,
         visibility,
         provenance,
         linked_source_record_count,
         created_at::text,
         updated_at::text
       from ${schema}.analyst_note_overview
       where ($1::text is null or target_type = $1)
         and ($2::text is null or target_id = $2)
         and ($3::bigint is null or case_id = $3)
       order by created_at desc, id desc
       limit $4`,
      [targetType, targetId, options.caseId ?? null, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function createAnalystNote(options: CreateAnalystNoteOptions): Promise<Record<string, unknown>> {
  const targetType = optionalText(options.targetType);
  const targetId = optionalText(options.targetId);
  const noteText = optionalText(options.noteText);
  const analyst = optionalText(options.analyst) ?? "centinela-operator";
  const noteType = optionalText(options.noteType) ?? "analyst_note";
  const visibility = optionalText(options.visibility) ?? "internal";

  if (!targetType || !targetId || !noteText) {
    throw new Error("targetType, targetId, and noteText are required.");
  }

  assertChoice(targetType, analystTargetTypes, "target type");
  assertChoice(noteType, analystNoteTypes, "note type");

  if (!["internal", "methodology", "public_candidate"].includes(visibility)) {
    throw new Error('Unsupported visibility. Use one of: internal, methodology, public_candidate');
  }

  assertPositiveInteger(options.caseId, "caseId");

  const preview = {
    id: "(dry-run)",
    case_id: options.caseId ? String(options.caseId) : null,
    target_type: targetType,
    target_id: targetId,
    note_type: noteType,
    note_text: noteText,
    analyst,
    visibility,
    provenance: options.provenance ?? {},
  };

  if (options.dryRun) {
    return preview;
  }

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `insert into ${schema}.analyst_notes
         (case_id, target_type, target_id, note_type, note_text, analyst, visibility, provenance)
       values ($1::bigint, $2, $3, $4, $5, $6, $7, $8::jsonb)
       returning
         id::text,
         case_id::text,
         target_type,
         target_id,
         note_type,
         note_text,
         analyst,
         visibility,
         provenance,
         created_at::text,
         updated_at::text`,
      [
        options.caseId ?? null,
        targetType,
        targetId,
        noteType,
        noteText,
        analyst,
        visibility,
        jsonb(options.provenance ?? {}),
      ],
    );

    if (options.caseId !== undefined) {
      await client.query(
        `update ${schema}.analyst_cases
         set updated_at = now()
         where id = $1`,
        [options.caseId],
      );
    }

    return normalizeRows(result.rows)[0] ?? preview;
  });
}

export async function listSourceRecords(
  options: SourceRecordOptions = {},
): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const sourceKey = optionalText(options.sourceKey);
  const externalId = optionalText(options.externalId);
  const recordKind = optionalText(options.recordKind);
  const q = optionalText(options.q);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select
         records.id::text,
         records.source_run_id::text,
         runs.status as source_run_status,
         records.source_key,
         records.external_id,
         records.record_kind,
         records.source_url,
         records.retrieved_at::text,
         left(records.payload::text, 800) as payload_preview
       from ${schema}.source_records as records
       left join ${schema}.source_runs as runs
         on runs.id = records.source_run_id
       where ($1::text is null or records.source_key = $1)
         and ($2::text is null or records.external_id = $2)
         and ($3::text is null or records.record_kind = $3)
         and ($4::text is null or records.payload::text ilike '%' || $4 || '%')
       order by records.retrieved_at desc, records.id desc
       limit $5`,
      [sourceKey, externalId, recordKind, q, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function getSourceRecord(recordId: number): Promise<Record<string, unknown>> {
  assertPositiveInteger(recordId, "recordId");

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select
         records.id::text,
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
         records.payload
       from ${schema}.source_records as records
       left join ${schema}.source_runs as runs
         on runs.id = records.source_run_id
       where records.id = $1`,
      [recordId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Source record ${recordId} was not found.`);
    }

    const normalized = normalizeRows([row])[0] ?? {};
    return {
      ...normalized,
      fieldSuggestions: buildFieldSuggestions(row.payload),
    };
  });
}

export async function listEntitySourceRecords(
  entityId: number,
  options: { limit?: number } = {},
): Promise<Array<Record<string, unknown>>> {
  assertPositiveInteger(entityId, "entityId");
  const limit = clampLimit(options.limit);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `with refs as (
         select source_key, source_external_id as external_id
         from ${schema}.entities
         where id = $1
           and source_key is not null
           and source_external_id is not null

         union

         select source_key, source_external_id as external_id
         from ${schema}.entity_source_mentions
         where entity_id = $1
           and source_key is not null
           and source_external_id is not null

         union

         select source_key, external_id
         from ${schema}.entity_enrichment_candidate_review_overview
         where entity_id = $1
           and source_key is not null
           and external_id is not null
       )
       select distinct
         records.id::text,
         records.source_run_id::text,
         records.source_key,
         records.external_id,
         records.record_kind,
         records.source_url,
         records.retrieved_at::text,
         left(records.payload::text, 800) as payload_preview
       from refs
       join ${schema}.source_records as records
         on records.source_key = refs.source_key
        and records.external_id = refs.external_id
       order by retrieved_at desc, id desc
       limit $2`,
      [entityId, limit],
    );

    return normalizeRows(result.rows);
  });
}
