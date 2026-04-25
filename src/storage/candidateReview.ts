import { connectToPostgres } from "./postgres";

export const candidateReviewStatuses = [
  "unreviewed",
  "needs_evidence",
  "promotable",
  "monitor",
  "rejected",
] as const;

export type CandidateReviewStatus = (typeof candidateReviewStatuses)[number];

interface CandidateReviewRow {
  id: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  source_key: string;
  external_id: string;
  external_name: string;
  external_entity_type: string;
  local_screening_role: string;
  candidate_status: string;
  match_method: string;
  match_confidence: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  suggested_review_status: string | null;
  review_priority_hint: string | null;
  review_next_step: string | null;
  hosted_support_category: string | null;
  hosted_top_result_name: string | null;
  hosted_top_result_score: string | null;
}

export interface UpdateExternalCandidateReviewOptions {
  candidateId: number;
  reviewStatus: string;
  reviewer: string;
  notes?: string;
  evidenceUrl?: string;
  evidenceNote?: string;
  dryRun?: boolean;
}

export interface ExternalCandidateReviewUpdateResult {
  dryRun: boolean;
  candidate: CandidateReviewRow;
}

function assertReviewStatus(value: string): asserts value is CandidateReviewStatus {
  if (!candidateReviewStatuses.includes(value as CandidateReviewStatus)) {
    throw new Error(
      `Unsupported review status "${value}". Use one of: ${candidateReviewStatuses.join(", ")}`,
    );
  }
}

export async function updateExternalCandidateReview(
  options: UpdateExternalCandidateReviewOptions,
): Promise<ExternalCandidateReviewUpdateResult> {
  assertReviewStatus(options.reviewStatus);

  if (!Number.isInteger(options.candidateId) || options.candidateId <= 0) {
    throw new Error("candidateId must be a positive integer.");
  }

  const { client, schema } = await connectToPostgres();

  try {
    const current = await client.query<CandidateReviewRow>(
      `select
         id::text,
         entity_id::text,
         entity_name,
         entity_type,
         source_key,
         external_id,
         external_name,
         external_entity_type,
         local_screening_role,
         candidate_status,
         match_method,
         match_confidence::text,
         review_status,
         reviewed_at::text,
         reviewed_by,
         review_notes,
         suggested_review_status,
         review_priority_hint,
         review_next_step,
         hosted_support_category,
         hosted_top_result_name,
         hosted_top_result_score::text
       from ${schema}.entity_enrichment_candidate_review_overview
       where id = $1`,
      [options.candidateId],
    );

    const existing = current.rows[0];
    if (!existing) {
      throw new Error(`External enrichment candidate ${options.candidateId} was not found.`);
    }

    if (options.dryRun) {
      return {
        dryRun: true,
        candidate: {
          ...existing,
          review_status: options.reviewStatus,
          reviewed_by: options.reviewStatus === "unreviewed" ? null : options.reviewer,
          review_notes: options.notes ?? existing.review_notes,
        },
      };
    }

    await client.query(
      `update ${schema}.entity_enrichment_candidates
       set
         review_status = $2,
         reviewed_at = case when $2 = 'unreviewed' then null else now() end,
         reviewed_by = case when $2 = 'unreviewed' then null else $3 end,
         review_notes = nullif($4, ''),
         review_evidence = coalesce(review_evidence, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
             'status', $2,
             'reviewer', $3,
             'notes', nullif($4, ''),
             'evidenceUrl', nullif($5, ''),
             'evidenceNote', nullif($6, ''),
             'source', 'manual_candidate_review_cli',
             'recordedAt', now()
           ))
       where id = $1`,
      [
        options.candidateId,
        options.reviewStatus,
        options.reviewer,
        options.notes ?? "",
        options.evidenceUrl ?? "",
        options.evidenceNote ?? "",
      ],
    );

    const updated = await client.query<CandidateReviewRow>(
      `select
         id::text,
         entity_id::text,
         entity_name,
         entity_type,
         source_key,
         external_id,
         external_name,
         external_entity_type,
         local_screening_role,
         candidate_status,
         match_method,
         match_confidence::text,
         review_status,
         reviewed_at::text,
         reviewed_by,
         review_notes,
         suggested_review_status,
         review_priority_hint,
         review_next_step,
         hosted_support_category,
         hosted_top_result_name,
         hosted_top_result_score::text
       from ${schema}.entity_enrichment_candidate_review_overview
       where id = $1`,
      [options.candidateId],
    );

    const row = updated.rows[0];
    if (!row) {
      throw new Error(`External enrichment candidate ${options.candidateId} disappeared after update.`);
    }

    return {
      dryRun: false,
      candidate: row,
    };
  } finally {
    await client.end();
  }
}
