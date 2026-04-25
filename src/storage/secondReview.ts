import { connectToPostgres } from "./postgres";

export const secondReviewDecisions = ["accepted_match", "needs_more_evidence", "rejected_match"] as const;

export type SecondReviewDecision = (typeof secondReviewDecisions)[number];

const SECOND_REVIEW_SOURCE_KEY = "ext-external-candidate-second-review";
const ACCEPTED_EXTERNAL_ENTITY_SOURCE_KEY = "ext-opensanctions-second-review";

interface SecondReviewCandidateRow {
  id: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  source_run_id: string | null;
  source_key: string;
  external_id: string;
  external_name: string;
  external_schema: string;
  external_entity_type: string;
  local_screening_role: string;
  candidate_status: string;
  match_method: string;
  match_confidence: string;
  match_quality: string;
  review_status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  review_evidence: unknown;
  second_review_decision: string | null;
  second_reviewed_at: string | null;
  second_reviewed_by: string | null;
  second_review_rationale: string | null;
  second_review_limitations: string | null;
  accepted_match_id: string | null;
  rejection_reason: string | null;
  rationale: string;
  evidence: unknown;
  external_datasets: unknown;
  external_countries: unknown;
  external_aliases: unknown;
  external_identifiers: unknown;
  external_payload: unknown;
  hosted_support_category: string | null;
  hosted_top_result_id: string | null;
  hosted_top_result_name: string | null;
  hosted_top_result_score: string | null;
  local_identifiers: string[] | null;
  local_ruc_identifiers: string[] | null;
  local_profile_sources: string[] | null;
  local_profile_names: string[] | null;
  local_profile_rucs: string[] | null;
}

export interface SecondReviewExternalCandidateOptions {
  candidateId: number;
  decision: string;
  reviewer: string;
  rationale: string;
  limitations?: string;
  evidenceUrl?: string;
  evidenceNote?: string;
  dryRun?: boolean;
}

export interface SecondReviewExternalCandidateResult {
  dryRun: boolean;
  candidate: SecondReviewCandidateRow;
  decision: SecondReviewDecision;
  acceptedMatchId: string | null;
  externalEntityId: string | null;
  secondReviewId: string | null;
  candidateReviewStatusAfter: string;
}

function assertSecondReviewDecision(value: string): asserts value is SecondReviewDecision {
  if (!secondReviewDecisions.includes(value as SecondReviewDecision)) {
    throw new Error(
      `Unsupported second-review decision "${value}". Use one of: ${secondReviewDecisions.join(", ")}`,
    );
  }
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item : String(item)))
    .filter((item) => item.length > 0 && item !== "_NO_APLICA_");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function candidateReviewStatusAfter(decision: SecondReviewDecision, currentStatus: string): string {
  if (decision === "needs_more_evidence") {
    return "needs_evidence";
  }

  if (decision === "rejected_match") {
    return "rejected";
  }

  return currentStatus === "promotable" ? currentStatus : "promotable";
}

function buildSecondReviewEvidence(options: SecondReviewExternalCandidateOptions): Array<Record<string, unknown>> {
  return [
    {
      type: "second_review_decision",
      value: options.decision,
    },
    {
      type: "second_review_rationale",
      value: options.rationale,
    },
    {
      type: "second_review_limitations",
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

async function createSecondReviewSourceRun(
  client: Awaited<ReturnType<typeof connectToPostgres>>["client"],
  schema: string,
  notes: string,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [SECOND_REVIEW_SOURCE_KEY, "PY", "running", notes],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create second-review source run.");
  }

  return row.id;
}

async function resolveOrCreateAcceptedExternalEntity(
  client: Awaited<ReturnType<typeof connectToPostgres>>["client"],
  schema: string,
  candidate: SecondReviewCandidateRow,
  sourceRunId: number,
): Promise<number> {
  const byIdentifier = await client.query<{ entity_id: string }>(
    `select entity_id::text
     from ${schema}.entity_identifiers
     where scheme = 'OpenSanctions-ID'
       and value = $1
     limit 1`,
    [candidate.external_id],
  );

  const identifierRow = byIdentifier.rows[0];
  if (identifierRow) {
    return Number(identifierRow.entity_id);
  }

  const bySource = await client.query<{ id: string }>(
    `select id::text
     from ${schema}.entities
     where source_key = $1
       and source_external_id = $2
     order by id
     limit 1`,
    [ACCEPTED_EXTERNAL_ENTITY_SOURCE_KEY, candidate.external_id],
  );

  const sourceRow = bySource.rows[0];
  if (sourceRow) {
    return Number(sourceRow.id);
  }

  const externalPayload = asRecord(candidate.external_payload);
  const countries = toStringArray(externalPayload.countries ?? candidate.external_countries).map((country) =>
    country.toUpperCase(),
  );
  const countryCode = countries.find((country) => country.length === 2) ?? null;
  const datasets = toStringArray(externalPayload.datasets ?? candidate.external_datasets);
  const identifiers = toStringArray(externalPayload.identifiers ?? candidate.external_identifiers);

  const insertResult = await client.query<{ id: number }>(
    `insert into ${schema}.entities
       (country_code, entity_type, canonical_name, normalized_name, source_key, source_external_id, attributes)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      countryCode,
      candidate.external_entity_type || "unknown",
      candidate.external_name,
      normalizeName(candidate.external_name),
      ACCEPTED_EXTERNAL_ENTITY_SOURCE_KEY,
      candidate.external_id,
      {
        externalSchema: candidate.external_schema,
        aliases: toStringArray(externalPayload.aliases ?? candidate.external_aliases),
        countries,
        datasets,
        identifiers,
        sanctions: toStringArray(externalPayload.sanctions),
        programIds: toStringArray(externalPayload.programIds ?? externalPayload.program_ids),
        sourceCandidateId: candidate.id,
        sourceCandidateKey: candidate.source_key,
        acceptedByWorkflow: SECOND_REVIEW_SOURCE_KEY,
      },
    ],
  );

  const inserted = insertResult.rows[0];
  if (!inserted) {
    throw new Error("Failed to create accepted external entity.");
  }

  await client.query(
    `insert into ${schema}.entity_identifiers (entity_id, scheme, value, is_primary)
     values ($1, 'OpenSanctions-ID', $2, true)
     on conflict (scheme, value) do nothing`,
    [inserted.id, candidate.external_id],
  );

  await client.query(
    `insert into ${schema}.entity_source_mentions
       (entity_id, source_run_id, source_key, role, source_external_id, observed_name, attributes)
     values ($1, $2, $3, 'accepted_external_target', $4, $5, $6)
     on conflict (entity_id, source_key, role, source_external_id)
     do update
     set
       source_run_id = excluded.source_run_id,
       observed_name = excluded.observed_name,
       last_seen_at = now(),
       attributes = ${schema}.entity_source_mentions.attributes || excluded.attributes`,
    [
      inserted.id,
      sourceRunId,
      ACCEPTED_EXTERNAL_ENTITY_SOURCE_KEY,
      candidate.external_id,
      candidate.external_name,
      {
        candidateId: candidate.id,
        candidateSourceKey: candidate.source_key,
        datasets,
        countries,
      },
    ],
  );

  return inserted.id;
}

async function upsertAcceptedMatch(
  client: Awaited<ReturnType<typeof connectToPostgres>>["client"],
  schema: string,
  candidate: SecondReviewCandidateRow,
  sourceRunId: number,
  externalEntityId: number,
  options: SecondReviewExternalCandidateOptions,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.entity_enrichment_matches
       (entity_id, matched_entity_id, source_run_id, source_key, match_method, match_confidence, match_quality, review_status, rationale, evidence)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (entity_id, matched_entity_id, source_key, match_method)
     do update
     set
       source_run_id = excluded.source_run_id,
       match_confidence = excluded.match_confidence,
       match_quality = excluded.match_quality,
       review_status = excluded.review_status,
       rationale = excluded.rationale,
       evidence = excluded.evidence,
       last_seen_at = now()
     returning id`,
    [
      Number(candidate.entity_id),
      externalEntityId,
      sourceRunId,
      SECOND_REVIEW_SOURCE_KEY,
      `second_review:${candidate.match_method}`,
      Number(candidate.match_confidence),
      "accepted_source_backed",
      "accepted_second_review",
      `Accepted as a source-backed identity match after second review. This is an enrichment match, not a legal conclusion or proof of wrongdoing. ${options.rationale}`,
      [
        { type: "candidate_id", value: candidate.id },
        { type: "candidate_source_key", value: candidate.source_key },
        { type: "candidate_external_id", value: candidate.external_id },
        { type: "candidate_match_method", value: candidate.match_method },
        { type: "candidate_match_confidence", value: candidate.match_confidence },
        { type: "hosted_support_category", value: candidate.hosted_support_category },
        { type: "hosted_top_result_id", value: candidate.hosted_top_result_id },
        { type: "hosted_top_result_name", value: candidate.hosted_top_result_name },
        { type: "hosted_top_result_score", value: candidate.hosted_top_result_score },
        { type: "local_identifiers", value: candidate.local_identifiers ?? [] },
        { type: "local_ruc_identifiers", value: candidate.local_ruc_identifiers ?? [] },
        { type: "local_profile_sources", value: candidate.local_profile_sources ?? [] },
        { type: "external_identifiers", value: toStringArray(candidate.external_identifiers) },
        { type: "external_datasets", value: toStringArray(candidate.external_datasets) },
        { type: "external_countries", value: toStringArray(candidate.external_countries) },
        { type: "second_review_rationale", value: options.rationale },
        { type: "second_review_limitations", value: options.limitations ?? null },
        { type: "evidence_url", value: options.evidenceUrl ?? null },
        { type: "evidence_note", value: options.evidenceNote ?? null },
      ],
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create accepted enrichment match.");
  }

  await client.query(
    `insert into ${schema}.entity_relationships
       (subject_entity_id, object_entity_id, relation_type, confidence, source_key, source_external_id, attributes)
     values ($1, $2, 'accepted_external_match', $3, $4, $5, $6)`,
    [
      Number(candidate.entity_id),
      externalEntityId,
      Number(candidate.match_confidence),
      SECOND_REVIEW_SOURCE_KEY,
      candidate.external_id,
      {
        candidateId: candidate.id,
        decision: "accepted_match",
        limitations: options.limitations ?? null,
        nonAccusatoryUse: true,
      },
    ],
  );

  return row.id;
}

export async function secondReviewExternalCandidate(
  options: SecondReviewExternalCandidateOptions,
): Promise<SecondReviewExternalCandidateResult> {
  assertSecondReviewDecision(options.decision);

  if (!Number.isInteger(options.candidateId) || options.candidateId <= 0) {
    throw new Error("candidateId must be a positive integer.");
  }

  if (!options.reviewer.trim()) {
    throw new Error("reviewer is required for second review.");
  }

  if (!options.rationale.trim()) {
    throw new Error("rationale is required for second review.");
  }

  if (options.decision === "accepted_match" && !options.limitations?.trim()) {
    throw new Error("limitations are required when accepting an external candidate as a match.");
  }

  const { client, schema } = await connectToPostgres();

  try {
    const current = await client.query<SecondReviewCandidateRow>(
      `select
         overview.id::text,
         overview.entity_id::text,
         overview.entity_name,
         overview.entity_type,
         overview.source_run_id::text,
         overview.source_key,
         overview.external_id,
         overview.external_name,
         overview.external_schema,
         overview.external_entity_type,
         overview.local_screening_role,
         overview.candidate_status,
         overview.match_method,
         overview.match_confidence::text,
         overview.match_quality,
         overview.review_status,
         overview.reviewed_at::text,
         overview.reviewed_by,
         overview.review_notes,
         overview.review_evidence,
         overview.second_review_decision,
         overview.second_reviewed_at::text,
         overview.second_reviewed_by,
         overview.second_review_rationale,
         overview.second_review_limitations,
         overview.accepted_match_id::text,
         overview.rejection_reason,
         overview.rationale,
         overview.evidence,
         overview.external_datasets,
         overview.external_countries,
         overview.external_aliases,
         overview.external_identifiers,
         candidates.external_payload,
         overview.hosted_support_category,
         overview.hosted_top_result_id,
         overview.hosted_top_result_name,
         overview.hosted_top_result_score::text,
         overview.local_identifiers,
         overview.local_ruc_identifiers,
         overview.local_profile_sources,
         overview.local_profile_names,
         overview.local_profile_rucs
       from ${schema}.entity_enrichment_candidate_review_overview as overview
       join ${schema}.entity_enrichment_candidates as candidates
         on candidates.id = overview.id
       where overview.id = $1`,
      [options.candidateId],
    );

    const candidate = current.rows[0];
    if (!candidate) {
      throw new Error(`External enrichment candidate ${options.candidateId} was not found.`);
    }

    if (candidate.second_review_decision === "accepted_match") {
      throw new Error(`Candidate ${candidate.id} already has an accepted-match second review.`);
    }

    if (options.decision === "accepted_match") {
      if (candidate.candidate_status !== "review_candidate") {
        throw new Error("Only review_candidate rows can be accepted as enrichment matches.");
      }

      if (candidate.review_status !== "promotable") {
        throw new Error("Only promotable candidates can be accepted. Mark the candidate promotable first.");
      }
    }

    const nextCandidateReviewStatus = candidateReviewStatusAfter(options.decision, candidate.review_status);

    if (options.dryRun) {
      return {
        dryRun: true,
        candidate,
        decision: options.decision,
        acceptedMatchId: options.decision === "accepted_match" ? "(dry-run)" : null,
        externalEntityId: options.decision === "accepted_match" ? "(dry-run)" : null,
        secondReviewId: "(dry-run)",
        candidateReviewStatusAfter: nextCandidateReviewStatus,
      };
    }

    await client.query("begin");
    let sourceRunId: number | undefined;

    try {
      sourceRunId = await createSecondReviewSourceRun(
        client,
        schema,
        `Second review for candidate ${candidate.id}: ${options.decision}`,
      );

      let externalEntityId: number | null = null;
      let acceptedMatchId: number | null = null;

      if (options.decision === "accepted_match") {
        externalEntityId = await resolveOrCreateAcceptedExternalEntity(client, schema, candidate, sourceRunId);
        acceptedMatchId = await upsertAcceptedMatch(client, schema, candidate, sourceRunId, externalEntityId, options);
      }

      const reviewResult = await client.query<{ id: string }>(
        `insert into ${schema}.entity_enrichment_second_reviews
           (candidate_id, reviewed_by, decision, rationale, limitations, evidence, accepted_match_id)
         values ($1, $2, $3, $4, nullif($5, ''), $6, $7)
         returning id::text`,
        [
          options.candidateId,
          options.reviewer,
          options.decision,
          options.rationale,
          options.limitations ?? "",
          buildSecondReviewEvidence(options),
          acceptedMatchId,
        ],
      );

      const secondReview = reviewResult.rows[0];
      if (!secondReview) {
        throw new Error("Failed to record second review.");
      }

      await client.query(
        `update ${schema}.entity_enrichment_candidates
         set
           review_status = $2,
           reviewed_at = now(),
           reviewed_by = $3,
           review_notes = $4,
           review_evidence = coalesce(review_evidence, '[]'::jsonb)
             || jsonb_build_array(jsonb_build_object(
               'status', $2,
               'secondReviewDecision', $5,
               'reviewer', $3,
               'notes', $4,
               'limitations', nullif($6, ''),
               'evidenceUrl', nullif($7, ''),
               'evidenceNote', nullif($8, ''),
               'acceptedMatchId', $9,
               'source', 'external_candidate_second_review_cli',
               'recordedAt', now()
             ))
         where id = $1`,
        [
          options.candidateId,
          nextCandidateReviewStatus,
          options.reviewer,
          options.rationale,
          options.decision,
          options.limitations ?? "",
          options.evidenceUrl ?? "",
          options.evidenceNote ?? "",
          acceptedMatchId,
        ],
      );

      await client.query(
        `update ${schema}.source_runs
         set finished_at = now(), status = 'completed', notes = $2
         where id = $1`,
        [
          sourceRunId,
          `Second review completed for candidate ${candidate.id}: ${options.decision}; accepted match id ${acceptedMatchId ?? "n/a"}`,
        ],
      );

      await client.query("commit");

      return {
        dryRun: false,
        candidate,
        decision: options.decision,
        acceptedMatchId: acceptedMatchId ? String(acceptedMatchId) : null,
        externalEntityId: externalEntityId ? String(externalEntityId) : null,
        secondReviewId: secondReview.id,
        candidateReviewStatusAfter: nextCandidateReviewStatus,
      };
    } catch (error) {
      await client.query("rollback");
      if (sourceRunId) {
        try {
          await client.query(
            `update ${schema}.source_runs
             set finished_at = now(), status = 'failed', notes = $2
             where id = $1`,
            [sourceRunId, error instanceof Error ? error.message.slice(0, 500) : "Second review failed"],
          );
        } catch {
          // Ignore finalization errors after rollback.
        }
      }

      throw error;
    }
  } finally {
    await client.end();
  }
}
