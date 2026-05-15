import { writeOutputText } from "./files";
import { connectToPostgres } from "./postgres";

export const stagedRelationshipReviewDecisions = [
  "needs_more_evidence",
  "keep_staged",
  "rejected",
  "promote_to_redacted_relationship",
] as const;

export type StagedRelationshipReviewDecision = (typeof stagedRelationshipReviewDecisions)[number];

const REVIEW_SOURCE_KEY = "py-abogacia-relationship-staging-review";
const REDACTED_PERSON_HASH_SCHEME = "PY-ABOGACIA-PERSON-HASH";

type DbClient = Awaited<ReturnType<typeof connectToPostgres>>["client"];

export interface StagedRelationshipQueueOptions {
  limit?: number;
  reviewStatus?: string;
  promotionStatus?: string;
  decision?: string;
}

export interface ReviewStagedRelationshipOptions {
  stagingId: number;
  decision: string;
  reviewer: string;
  rationale: string;
  limitations?: string;
  evidenceUrl?: string;
  evidenceNote?: string;
  dryRun?: boolean;
}

interface StagedRelationshipRow {
  id: string;
  source_record_id: string | null;
  source_key: string;
  source_record_external_id: string | null;
  company_entity_id: string;
  company_entity_name: string;
  company_ruc_base: string;
  company_name: string | null;
  relation_type: string;
  relation_label: string;
  related_entity_type: string;
  related_person_display: string;
  related_person_name_hash: string;
  source_row_hash: string;
  source_line_number: number | null;
  match_method: string;
  match_confidence: string | null;
  review_status: string;
  public_display_status: string;
  promotion_status: string;
  rationale: string;
  relationship_attributes: unknown;
  provenance: unknown;
  limitations: unknown;
  source_url: string | null;
  latest_review_decision: string | null;
  latest_review_rationale: string | null;
}

export interface ReviewStagedRelationshipResult {
  dryRun: boolean;
  staging: StagedRelationshipRow;
  decision: StagedRelationshipReviewDecision;
  reviewId: string | null;
  redactedPersonEntityId: string | null;
  relationshipId: string | null;
  reviewStatusAfter: string;
  promotionStatusAfter: string;
}

function clampLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return 50;
  }

  return Math.max(1, Math.min(250, Math.trunc(value)));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function asDecision(value: string): StagedRelationshipReviewDecision {
  const normalized = value.trim() === "promote_to_relationship" ? "promote_to_redacted_relationship" : value.trim();

  if (!stagedRelationshipReviewDecisions.includes(normalized as StagedRelationshipReviewDecision)) {
    throw new Error(
      `Unsupported staged-relationship review decision "${value}". Use one of: ${stagedRelationshipReviewDecisions.join(", ")}`,
    );
  }

  return normalized as StagedRelationshipReviewDecision;
}

function statusAfter(decision: StagedRelationshipReviewDecision): {
  reviewStatus: string;
  promotionStatus: string;
} {
  if (decision === "promote_to_redacted_relationship") {
    return {
      reviewStatus: "reviewed_promoted",
      promotionStatus: "promoted_to_redacted_relationship",
    };
  }

  if (decision === "rejected") {
    return {
      reviewStatus: "reviewed_rejected",
      promotionStatus: "not_promoted",
    };
  }

  if (decision === "needs_more_evidence") {
    return {
      reviewStatus: "needs_more_evidence",
      promotionStatus: "not_promoted",
    };
  }

  return {
    reviewStatus: "staged_review_only",
    promotionStatus: "not_promoted",
  };
}

function reviewedRelationType(relationType: string): string {
  return relationType.endsWith("_staged")
    ? `${relationType.slice(0, -"_staged".length)}_redacted_reviewed`
    : `${relationType}_redacted_reviewed`;
}

function buildEvidence(options: ReviewStagedRelationshipOptions): Array<Record<string, unknown>> {
  return [
    {
      type: "staged_relationship_review_decision",
      value: options.decision,
    },
    {
      type: "review_rationale",
      value: options.rationale,
    },
    {
      type: "review_limitations",
      value: options.limitations ?? null,
    },
    {
      type: "evidence_url",
      value: options.evidenceUrl ?? null,
    },
    {
      type: "evidence_note",
      value: options.evidenceNote ?? null,
    },
  ];
}

function toJsonb(value: unknown): string {
  return JSON.stringify(value);
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

async function findStagedRelationship(
  client: DbClient,
  schema: string,
  stagingId: number,
): Promise<StagedRelationshipRow> {
  const result = await client.query<StagedRelationshipRow>(
    `select
       id::text,
       source_record_id::text,
       source_key,
       source_record_external_id,
       company_entity_id::text,
       company_entity_name,
       company_ruc_base,
       company_name,
       relation_type,
       relation_label,
       related_entity_type,
       related_person_display,
       related_person_name_hash,
       source_row_hash,
       source_line_number::int,
       match_method,
       match_confidence::text,
       review_status,
       public_display_status,
       promotion_status,
       rationale,
       relationship_attributes,
       provenance,
       limitations,
       source_url,
       latest_review_decision,
       latest_review_rationale
     from ${schema}.entity_relationship_staging_overview
     where id = $1`,
    [stagingId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Staged relationship ${stagingId} was not found.`);
  }

  return row;
}

async function resolveOrCreateRedactedPerson(
  client: DbClient,
  schema: string,
  staging: StagedRelationshipRow,
): Promise<number> {
  const existingIdentifier = await client.query<{ entity_id: string }>(
    `select entity_id::text
     from ${schema}.entity_identifiers
     where scheme = $1
       and value = $2
     limit 1`,
    [REDACTED_PERSON_HASH_SCHEME, staging.related_person_name_hash],
  );

  const identifierRow = existingIdentifier.rows[0];
  if (identifierRow) {
    return Number(identifierRow.entity_id);
  }

  const existingSourceEntity = await client.query<{ id: string }>(
    `select id::text
     from ${schema}.entities
     where source_key = $1
       and source_external_id = $2
     order by id
     limit 1`,
    [REVIEW_SOURCE_KEY, staging.related_person_name_hash],
  );

  const sourceRow = existingSourceEntity.rows[0];
  if (sourceRow) {
    return Number(sourceRow.id);
  }

  const inserted = await client.query<{ id: number }>(
    `insert into ${schema}.entities
       (country_code, entity_type, canonical_name, normalized_name, source_key, source_external_id, attributes)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning id`,
    [
      "PY",
      "person",
      staging.related_person_display,
      normalizeName(staging.related_person_display),
      REVIEW_SOURCE_KEY,
      staging.related_person_name_hash,
      toJsonb({
        redacted: true,
        publicDisplayStatus: "blocked_personal_data",
        source: staging.source_key,
        sourceRelationType: staging.relation_type,
        sourceRowHash: staging.source_row_hash,
        nonAccusatoryUse: true,
        limitations:
          "This is a redacted internal person placeholder derived from an official source row hash. It is not public person identity and not proof of ownership control or wrongdoing.",
      }),
    ],
  );

  const insertedRow = inserted.rows[0];
  if (!insertedRow) {
    throw new Error("Failed to create redacted person placeholder.");
  }

  await client.query(
    `insert into ${schema}.entity_identifiers (entity_id, scheme, value, is_primary)
     values ($1, $2, $3, true)
     on conflict (scheme, value) do nothing`,
    [insertedRow.id, REDACTED_PERSON_HASH_SCHEME, staging.related_person_name_hash],
  );

  return insertedRow.id;
}

async function upsertPromotedRelationship(
  client: DbClient,
  schema: string,
  staging: StagedRelationshipRow,
  redactedPersonEntityId: number,
  options: ReviewStagedRelationshipOptions,
  decision: StagedRelationshipReviewDecision,
): Promise<number> {
  const relationType = reviewedRelationType(staging.relation_type);
  const existing = await client.query<{ id: string }>(
    `select id::text
     from ${schema}.entity_relationships
     where subject_entity_id = $1
       and object_entity_id = $2
       and relation_type = $3
       and source_key = $4
       and source_external_id = $5
     order by id
     limit 1`,
    [
      Number(staging.company_entity_id),
      redactedPersonEntityId,
      relationType,
      REVIEW_SOURCE_KEY,
      staging.source_row_hash,
    ],
  );

  const existingRow = existing.rows[0];
  if (existingRow) {
    return Number(existingRow.id);
  }

  const inserted = await client.query<{ id: number }>(
    `insert into ${schema}.entity_relationships
       (subject_entity_id, object_entity_id, relation_type, confidence, source_key, source_external_id, attributes)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning id`,
    [
      Number(staging.company_entity_id),
      redactedPersonEntityId,
      relationType,
      staging.match_confidence ? Number(staging.match_confidence) : null,
      REVIEW_SOURCE_KEY,
      staging.source_row_hash,
      toJsonb({
        stagingId: staging.id,
        sourceRecordId: staging.source_record_id,
        sourceRecordExternalId: staging.source_record_external_id,
        sourceKey: staging.source_key,
        originalRelationType: staging.relation_type,
        relationLabel: staging.relation_label,
        reviewDecision: decision,
        reviewRationale: options.rationale,
        reviewLimitations: options.limitations ?? null,
        evidenceUrl: options.evidenceUrl ?? null,
        evidenceNote: options.evidenceNote ?? null,
        sourceLineNumber: staging.source_line_number,
        sourceRowHash: staging.source_row_hash,
        publicDisplayStatus: "blocked_personal_data",
        redactedPersonPlaceholder: true,
        nonAccusatoryUse: true,
        useLimit:
          "Internal graph context only. Do not publish or treat as proof of ownership control, influence, or wrongdoing without lawful source review.",
      }),
    ],
  );

  const insertedRow = inserted.rows[0];
  if (!insertedRow) {
    throw new Error("Failed to create promoted redacted relationship.");
  }

  await client.query(
    `insert into ${schema}.entity_source_mentions
       (entity_id, source_key, role, source_external_id, observed_name, attributes)
     values ($1, $2, $3, $4, $5, $6::jsonb)
     on conflict (entity_id, source_key, role, source_external_id)
     do update
     set
       observed_name = excluded.observed_name,
       last_seen_at = now(),
       attributes = ${schema}.entity_source_mentions.attributes || excluded.attributes`,
    [
      redactedPersonEntityId,
      REVIEW_SOURCE_KEY,
      "redacted_abogacia_relationship_review",
      staging.related_person_name_hash,
      staging.related_person_display,
      toJsonb({
        stagingId: staging.id,
        companyEntityId: staging.company_entity_id,
        companyEntityName: staging.company_entity_name,
        relationType,
        redacted: true,
        publicDisplayStatus: "blocked_personal_data",
      }),
    ],
  );

  return insertedRow.id;
}

export async function getStagedRelationshipQueue(
  options: StagedRelationshipQueueOptions = {},
): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const reviewStatus = options.reviewStatus?.trim() || null;
  const promotionStatus = options.promotionStatus?.trim() || null;
  const decision = options.decision?.trim() || null;
  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_relationship_staging_review_queue
       where ($1::text is null or review_status = $1)
         and ($2::text is null or promotion_status = $2)
         and ($3::text is null or latest_review_decision = $3)
       order by
         case review_priority
           when 'high' then 4
           when 'needs_more_evidence' then 3
           when 'triage' then 2
           when 'normal' then 1
           else 0
         end desc,
         total_risk_signals desc,
         total_process_count desc,
         company_entity_name,
         relation_type,
         source_line_number
       limit $4`,
      [reviewStatus, promotionStatus, decision, limit],
    );

    return normalizeRows(result.rows);
  } finally {
    await client.end();
  }
}

export async function buildStagedRelationshipReviewReport(
  options: StagedRelationshipQueueOptions = {},
): Promise<{ reportPath: string; itemCount: number }> {
  const items = await getStagedRelationshipQueue(options);
  const lines: string[] = [];

  lines.push("# Staged relationship review queue");
  lines.push("");
  lines.push("This queue contains redacted relationship leads for internal review. It is not proof of ownership, influence, control, or wrongdoing.");
  lines.push("");
  lines.push(`- Rows shown: ${items.length}`);
  lines.push(`- Review-status filter: ${options.reviewStatus ?? "all"}`);
  lines.push(`- Promotion-status filter: ${options.promotionStatus ?? "all"}`);
  lines.push("");
  lines.push("## Review lanes");
  lines.push("");

  for (const item of items) {
    lines.push(`### #${item.id} ${item.company_entity_name ?? "Unknown company"}`);
    lines.push(`- Relationship lead: ${item.relation_label ?? item.relation_type} -> ${item.related_person_display}`);
    lines.push(`- Status: ${item.review_status} / ${item.promotion_status}`);
    lines.push(`- Priority: ${item.review_priority}`);
    lines.push(`- Source: ${item.source_key}; source record #${item.source_record_id ?? "n/a"}; line ${item.source_line_number ?? "n/a"}`);
    lines.push(`- Procurement context: ${item.total_process_count ?? 0} processes; ${item.total_risk_signals ?? 0} risk signals`);
    lines.push(`- Lead question: ${item.lead_question}`);
    lines.push(`- Recommended action: ${item.recommended_action}`);
    lines.push("");
  }

  const reportPath = await writeOutputText(
    ["reports", "paraguay", "staged-relationship-review-queue.md"],
    `${lines.join("\n")}\n`,
  );

  return {
    reportPath,
    itemCount: items.length,
  };
}

export async function reviewStagedRelationship(
  options: ReviewStagedRelationshipOptions,
): Promise<ReviewStagedRelationshipResult> {
  if (!Number.isInteger(options.stagingId) || options.stagingId <= 0) {
    throw new Error("stagingId must be a positive integer.");
  }

  const decision = asDecision(options.decision);
  if (!options.reviewer.trim()) {
    throw new Error("reviewer is required for staged-relationship review.");
  }

  if (!options.rationale.trim()) {
    throw new Error("rationale is required for staged-relationship review.");
  }

  if (decision === "promote_to_redacted_relationship" && !options.limitations?.trim()) {
    throw new Error("limitations are required when promoting a staged relationship into the redacted graph.");
  }

  const { client, schema } = await connectToPostgres();

  try {
    const staging = await findStagedRelationship(client, schema, options.stagingId);
    if (staging.promotion_status === "promoted_to_redacted_relationship") {
      throw new Error(`Staged relationship ${staging.id} was already promoted.`);
    }

    const nextStatus = statusAfter(decision);
    if (options.dryRun) {
      return {
        dryRun: true,
        staging,
        decision,
        reviewId: "(dry-run)",
        redactedPersonEntityId: decision === "promote_to_redacted_relationship" ? "(dry-run)" : null,
        relationshipId: decision === "promote_to_redacted_relationship" ? "(dry-run)" : null,
        reviewStatusAfter: nextStatus.reviewStatus,
        promotionStatusAfter: nextStatus.promotionStatus,
      };
    }

    await client.query("begin");

    try {
      let redactedPersonEntityId: number | null = null;
      let relationshipId: number | null = null;

      if (decision === "promote_to_redacted_relationship") {
        redactedPersonEntityId = await resolveOrCreateRedactedPerson(client, schema, staging);
        relationshipId = await upsertPromotedRelationship(
          client,
          schema,
          staging,
          redactedPersonEntityId,
          options,
          decision,
        );
      }

      const review = await client.query<{ id: string }>(
        `insert into ${schema}.entity_relationship_staging_reviews
           (
             staging_id,
             reviewed_by,
             decision,
             rationale,
             limitations,
             evidence,
             promoted_subject_entity_id,
             promoted_object_entity_id,
             promoted_relationship_id
           )
         values ($1, $2, $3, $4, nullif($5::text, ''), $6::jsonb, $7, $8, $9)
         returning id::text`,
        [
          options.stagingId,
          options.reviewer,
          decision,
          options.rationale,
          options.limitations ?? "",
          toJsonb(buildEvidence({ ...options, decision })),
          Number(staging.company_entity_id),
          redactedPersonEntityId,
          relationshipId,
        ],
      );

      const reviewRow = review.rows[0];
      if (!reviewRow) {
        throw new Error("Failed to record staged-relationship review.");
      }

      await client.query(
        `update ${schema}.entity_relationship_staging
         set
           review_status = $2,
           promotion_status = $3,
           last_reviewed_at = now(),
           last_reviewed_by = $4,
           last_review_decision = $5,
           last_review_rationale = $6,
           last_seen_at = now()
         where id = $1`,
        [
          options.stagingId,
          nextStatus.reviewStatus,
          nextStatus.promotionStatus,
          options.reviewer,
          decision,
          options.rationale,
        ],
      );

      await client.query("commit");

      return {
        dryRun: false,
        staging,
        decision,
        reviewId: reviewRow.id,
        redactedPersonEntityId: redactedPersonEntityId ? String(redactedPersonEntityId) : null,
        relationshipId: relationshipId ? String(relationshipId) : null,
        reviewStatusAfter: nextStatus.reviewStatus,
        promotionStatusAfter: nextStatus.promotionStatus,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}
