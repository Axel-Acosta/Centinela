import { connectToPostgres } from "./postgres";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

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

export type AnalystTargetType = (typeof analystTargetTypes)[number];
export type AnalystCaseLinkTargetType = (typeof analystCaseLinkTargetTypes)[number];
export type AnalystNoteType = (typeof analystNoteTypes)[number];
export type AnalystCaseStatus = (typeof analystCaseStatuses)[number];
export type AnalystCasePriority = (typeof analystCasePriorities)[number];

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

export interface SourceRecordOptions {
  sourceKey?: string | undefined;
  externalId?: string | undefined;
  recordKind?: string | undefined;
  q?: string | undefined;
  limit?: number | undefined;
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
         latest_note_at::text
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
         latest_note_at::text
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
         created_at::text,
         updated_at::text
       from ${schema}.analyst_note_overview
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

    return {
      disclaimer:
        "Case timelines are internal review context. They are not proof of wrongdoing or a public finding.",
      case: normalizeRows([caseRow])[0],
      links: normalizeRows(links.rows),
      notes: normalizeRows(notes.rows),
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

    return normalizeRows([row])[0] ?? {};
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
       order by records.retrieved_at desc, records.id desc
       limit $2`,
      [entityId, limit],
    );

    return normalizeRows(result.rows);
  });
}
