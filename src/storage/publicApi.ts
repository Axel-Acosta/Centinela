import { connectToPostgres } from "./postgres";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

type DbClient = Awaited<ReturnType<typeof connectToPostgres>>["client"];

export const PUBLIC_DISCLAIMER =
  "Centinela shows public-record risk signals, source context, and leads for review. It does not prove wrongdoing, corruption, legal liability, or integrity.";

export interface PublicListOptions {
  limit?: number;
}

export interface PublicEntitySearchOptions extends PublicListOptions {
  q?: string;
}

function clampLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function asOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeRows<T extends Record<string, unknown>>(rows: T[]): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "bigint") {
        normalized[key] = value.toString();
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  });
}

async function withDatabase<T>(work: (client: DbClient, schema: string) => Promise<T>): Promise<T> {
  const { client, schema } = await connectToPostgres();

  try {
    return await work(client, schema);
  } finally {
    await client.end();
  }
}

export async function getPublicOverview(): Promise<Record<string, unknown>> {
  return withDatabase(async (client, schema) => {
    const counts = await client.query<Record<string, unknown>>(
      `select
         (select count(*) from ${schema}.procurement_processes)::int as procurement_processes,
         (select count(*) from ${schema}.contracts)::int as contracts,
         (select count(*) from ${schema}.entities)::int as entities,
         (select count(*) from ${schema}.risk_signals)::int as procurement_risk_signals,
         (select count(distinct process_id) from ${schema}.risk_signals)::int as flagged_processes,
         (select count(*) from ${schema}.source_records)::int as source_records,
         (select count(*) from ${schema}.entity_local_profiles)::int as local_entity_profiles,
         (select count(*) from ${schema}.entity_enrichment_candidates)::int as external_review_candidates,
         (select count(*) from ${schema}.entity_enrichment_second_reviews where decision = 'accepted_match')::int as accepted_identity_context_matches,
         (select count(*) from ${schema}.analyst_case_overview)::int as internal_source_pack_cases,
         (select count(*) from ${schema}.analyst_evidence_links)::int as internal_evidence_links,
         (select count(*) from ${schema}.entity_relationship_staging)::int as private_staged_relationship_leads`,
    );

    const rules = await client.query<Record<string, unknown>>(
      `select
         code,
         family,
         name,
         category,
         default_severity,
         review_lane,
         public_description,
         analyst_question,
         recommended_action,
         signal_count::int,
         process_count::int
       from ${schema}.risk_rule_coverage
       where signal_count > 0
       order by signal_count desc, code`,
    );

    const sourceCoverage = await client.query<Record<string, unknown>>(
      `select
         source_key,
         count(*)::int as source_record_count,
         min(retrieved_at) as first_captured_at,
         max(retrieved_at) as last_captured_at
       from ${schema}.source_records
       group by source_key
       order by count(*) desc, source_key
       limit 12`,
    );

    const publicQueue = await client.query<Record<string, unknown>>(
      `with staged_relationship_summary as (
         select
           entity_id,
           sum(staged_relation_count)::int as staged_relationship_lead_count
         from ${schema}.entity_relationship_staging_summary
         group by entity_id
       )
       select
         queue.entity_id::text,
         queue.entity_name,
         queue.review_priority,
         queue.review_lane,
         queue.anchor_status,
         queue.total_process_count::int,
         queue.flagged_process_count::int,
         queue.total_risk_signals::int,
         queue.local_profile_count::int,
         queue.external_match_count::int,
         queue.external_review_candidate_count::int,
         coalesce(staged_relationship_summary.staged_relationship_lead_count, 0)::int as staged_relationship_lead_count
       from ${schema}.entity_intelligence_review_queue as queue
       left join staged_relationship_summary
         on staged_relationship_summary.entity_id = queue.entity_id
       where queue.entity_type = 'company'
       order by
         queue.total_risk_signals desc,
         queue.flagged_process_count desc,
         queue.total_process_count desc,
         queue.entity_name
       limit 8`,
    );

    return {
      disclaimer: PUBLIC_DISCLAIMER,
      counts: normalizeRows(counts.rows)[0] ?? {},
      ruleCoverage: normalizeRows(rules.rows),
      sourceCoverage: normalizeRows(sourceCoverage.rows),
      publicRiskLens: normalizeRows(publicQueue.rows),
      scope: {
        country: "Paraguay",
        currentBackbone: "DNCP/OCDS procurement records, local company identity anchors, source records, review queues.",
        publicBoundary:
          "This public surface shows aggregated and entity-level review context. It does not expose analyst write tools, raw local artifacts, private notes, or person-level staged relationship rows.",
      },
    };
  });
}

export async function searchPublicEntities(
  options: PublicEntitySearchOptions = {},
): Promise<Array<Record<string, unknown>>> {
  const q = asOptionalText(options.q);
  const limit = clampLimit(options.limit);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `with staged_relationship_summary as (
         select
           entity_id,
           sum(staged_relation_count)::int as staged_relationship_lead_count
         from ${schema}.entity_relationship_staging_summary
         group by entity_id
       )
       select
         queue.entity_id::text,
         queue.entity_name,
         queue.entity_type,
         queue.anchor_status,
         queue.review_priority,
         queue.review_lane,
         queue.total_process_count::int,
         queue.flagged_process_count::int,
         queue.total_risk_signals::int,
         queue.local_profile_count::int,
         queue.external_match_count::int,
         queue.external_review_candidate_count::int,
         coalesce(staged_relationship_summary.staged_relationship_lead_count, 0)::int as staged_relationship_lead_count,
         queue.lead_question,
         queue.recommended_action
       from ${schema}.entity_intelligence_review_queue as queue
       left join staged_relationship_summary
         on staged_relationship_summary.entity_id = queue.entity_id
       where queue.entity_type = 'company'
         and (
           $1::text is null
           or queue.entity_name ilike '%' || $1::text || '%'
           or exists (
             select 1
             from ${schema}.entity_identifiers as identifiers
             where identifiers.entity_id = queue.entity_id
               and identifiers.value ilike '%' || $1::text || '%'
           )
         )
       order by
         case
           when $1::text is not null and lower(queue.entity_name) = lower($1::text) then 4
           when $1::text is not null and queue.entity_name ilike $1::text || '%' then 3
           when queue.review_priority = 'priority' then 2
           else 1
         end desc,
         queue.total_risk_signals desc,
         queue.total_process_count desc,
         queue.entity_name
       limit $2`,
      [q, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function getPublicEntityProfile(entityId: number): Promise<Record<string, unknown>> {
  return withDatabase(async (client, schema) => {
    const entity = await client.query<Record<string, unknown>>(
      `with staged_relationship_summary as (
         select
           entity_id,
           sum(staged_relation_count)::int as staged_relationship_lead_count
         from ${schema}.entity_relationship_staging_summary
         group by entity_id
       )
       select
         entities.id::text as entity_id,
         entities.canonical_name as entity_name,
         entities.entity_type,
         entities.country_code,
         activity.total_process_count::int,
         activity.supplier_process_count::int,
         activity.flagged_process_count::int,
         activity.total_risk_signals::int,
         activity.supplier_linked_contract_value,
         activity.supplier_linked_paid_amount,
         activity.first_published_at,
         activity.last_published_at,
         queue.anchor_status,
         queue.review_priority,
         queue.review_lane,
         queue.lead_question,
         queue.recommended_action,
         queue.local_profile_count::int,
         queue.local_signal_count::int,
         queue.external_match_count::int,
         queue.external_review_candidate_count::int,
         queue.representative_count::int,
         coalesce(staged_relationship_summary.staged_relationship_lead_count, 0)::int as staged_relationship_lead_count
       from ${schema}.entities as entities
       left join ${schema}.entity_procurement_activity as activity
         on activity.entity_id = entities.id
       left join ${schema}.entity_intelligence_review_queue as queue
         on queue.entity_id = entities.id
       left join staged_relationship_summary
         on staged_relationship_summary.entity_id = entities.id
       where entities.id = $1
         and entities.entity_type = 'company'
       limit 1`,
      [entityId],
    );

    const entityRow = normalizeRows(entity.rows)[0];
    if (!entityRow) {
      const error = new Error("Public entity profile not found.");
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const identifiers = await client.query<Record<string, unknown>>(
      `select
         scheme,
         value
       from ${schema}.entity_identifiers
       where entity_id = $1
         and (
           scheme ilike '%RUC%'
           or scheme in ('DNCP-SICP-CODE', 'DNCP-SUPPLIER-CODE', 'PY-ABOGACIA-RUC-BASE')
         )
       order by scheme, value
       limit 20`,
      [entityId],
    );

    const riskRules = await client.query<Record<string, unknown>>(
      `select
         registry.code,
         registry.family,
         registry.name,
         registry.category,
         registry.default_severity,
         registry.review_lane,
         registry.public_description,
         registry.analyst_question,
         registry.recommended_action,
         count(signals.id)::int as signal_count,
         count(distinct signals.process_id)::int as process_count
       from ${schema}.risk_signals as signals
       join ${schema}.process_parties as parties
         on parties.process_id = signals.process_id
        and parties.entity_id = $1
       left join ${schema}.risk_rule_registry as registry
         on registry.code = signals.signal_code
       group by
         registry.code,
         registry.family,
         registry.name,
         registry.category,
         registry.default_severity,
         registry.review_lane,
         registry.public_description,
         registry.analyst_question,
         registry.recommended_action
       order by count(signals.id) desc, registry.code
       limit 12`,
      [entityId],
    );

    const localProfiles = await client.query<Record<string, unknown>>(
      `select
         source_key,
         profile_kind,
         profile_status,
         match_method,
         match_confidence,
         review_status,
         profile_title,
         ruc,
         official_name,
         supplier_type,
         company_size,
         activity_type,
         adjudication_count::int,
         first_seen_at,
         last_seen_at
       from ${schema}.entity_local_profile_overview
       where entity_id = $1
       order by source_key, profile_kind
       limit 12`,
      [entityId],
    );

    const sourceMentions = await client.query<Record<string, unknown>>(
      `select
         source_key,
         role,
         count(*)::int as mention_count,
         min(first_seen_at) as first_seen_at,
         max(last_seen_at) as last_seen_at
       from ${schema}.entity_source_mentions
       where entity_id = $1
       group by source_key, role
       order by count(*) desc, source_key, role
       limit 12`,
      [entityId],
    );

    const acceptedMatches = await client.query<Record<string, unknown>>(
      `select
         id::text as second_review_id,
         candidate_id::text,
         candidate_source_key,
         external_name,
         external_schema,
         external_entity_type,
         decision,
         rationale,
         limitations,
         accepted_match_method,
         accepted_match_quality,
         reviewed_at
       from ${schema}.entity_enrichment_second_review_overview
       where entity_id = $1
         and decision = 'accepted_match'
       order by reviewed_at desc, id desc
       limit 5`,
      [entityId],
    );

    const stagedRelationships = await client.query<Record<string, unknown>>(
      `select
         relation_type,
         relation_label,
         review_status,
         public_display_status,
         promotion_status,
         count(*)::int as lead_count
       from ${schema}.entity_relationship_staging_summary
       where entity_id = $1
       group by relation_type, relation_label, review_status, public_display_status, promotion_status
       order by count(*) desc, relation_type
       limit 10`,
      [entityId],
    );

    const cases = await client.query<Record<string, unknown>>(
      `select
         cases.id::text as case_id,
         cases.case_key,
         cases.title,
         cases.status,
         cases.priority,
         cases.summary,
         cases.evidence_link_count::int,
         cases.public_review_status,
         cases.updated_at
       from ${schema}.analyst_case_overview as cases
       where exists (
         select 1
         from ${schema}.analyst_case_links as links
         where links.case_id = cases.id
           and links.target_type = 'entity'
           and links.target_id = $1::text
       )
       order by cases.updated_at desc, cases.id desc
       limit 6`,
      [entityId],
    );

    return {
      disclaimer: PUBLIC_DISCLAIMER,
      entity: entityRow,
      identifiers: normalizeRows(identifiers.rows),
      procurementRiskRules: normalizeRows(riskRules.rows),
      localProfiles: normalizeRows(localProfiles.rows),
      sourceMentions: normalizeRows(sourceMentions.rows),
      acceptedIdentityContext: normalizeRows(acceptedMatches.rows),
      privateRelationshipLeadSummary: normalizeRows(stagedRelationships.rows),
      sourcePackCases: normalizeRows(cases.rows),
      publicBoundary: {
        relationshipLeads:
          "Counts are shown only as privacy-protective review context. Person-level rows, names, document numbers, and addresses are not exposed here.",
        sourcePacks:
          "Cases and source packs may still be internal-only. This page shows their existence and evidence counts, not raw local artifacts.",
        interpretation:
          "Risk signals and identity context are review leads. They are not legal findings or allegations.",
      },
    };
  });
}
