import { connectToPostgres } from "./postgres";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type DbClient = Awaited<ReturnType<typeof connectToPostgres>>["client"];

export interface ListOptions {
  limit?: number;
}

export interface SearchEntitiesOptions extends ListOptions {
  q?: string;
}

export interface QueueOptions extends ListOptions {
  lane?: string;
  priority?: string;
}

export interface ExternalCandidateOptions extends ListOptions {
  reviewStatus?: string;
  secondReviewDecision?: string;
}

export interface NetworkExportOptions extends ListOptions {
  format?: string;
}

export interface ApiNode {
  id: string;
  label: string;
  kind: string;
  metadata?: Record<string, unknown>;
}

export interface ApiEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

function clampLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(value)));
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function withConfidence(edge: Omit<ApiEdge, "confidence">, value: unknown): ApiEdge {
  const confidence = toNumber(value);
  if (confidence === null) {
    return edge;
  }

  return {
    ...edge,
    confidence,
  };
}

async function withDatabase<T>(work: (client: DbClient, schema: string) => Promise<T>): Promise<T> {
  const { client, schema } = await connectToPostgres();

  try {
    return await work(client, schema);
  } finally {
    await client.end();
  }
}

export async function getInternalOverview(): Promise<Record<string, unknown>> {
  return withDatabase(async (client, schema) => {
    const counts = await client.query<Record<string, unknown>>(
      `select
         (select count(*) from ${schema}.procurement_processes)::int as procurement_processes,
         (select count(*) from ${schema}.contracts)::int as contracts,
         (select count(*) from ${schema}.entities)::int as entities,
         (select count(*) from ${schema}.risk_signals)::int as procurement_risk_signals,
         (select count(*) from ${schema}.entity_intelligence_signals)::int as entity_intelligence_signals,
         (select count(*) from ${schema}.entity_enrichment_matches)::int as accepted_enrichment_matches,
         (select count(*) from ${schema}.entity_enrichment_second_reviews where decision = 'accepted_match')::int as accepted_second_reviews,
         (select count(*) from ${schema}.entity_external_risk_signals)::int as external_risk_signals,
         (select count(*) from ${schema}.entity_enrichment_candidate_review_overview)::int as external_candidate_records,
         (select count(*) from ${schema}.entity_relationships)::int as relationship_edges,
         (select count(*) from ${schema}.source_records)::int as source_records,
         (select count(*) from ${schema}.analyst_case_overview)::int as analyst_cases,
         (select count(*) from ${schema}.analyst_note_overview)::int as analyst_notes,
         (select count(*) from ${schema}.analyst_evidence_links)::int as analyst_evidence_links,
         (select count(*) from ${schema}.analyst_case_public_reviews)::int as analyst_public_reviews`,
    );

    const coverage = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_anchor_coverage_overview
       limit 1`,
    );

    const entityLanes = await client.query<Record<string, unknown>>(
      `select review_lane, count(*)::int as count
       from ${schema}.entity_intelligence_review_queue
       group by review_lane
       order by count(*) desc, review_lane`,
    );

    const processLanes = await client.query<Record<string, unknown>>(
      `select review_lane, count(*)::int as count
       from ${schema}.process_review_queue
       group by review_lane
       order by count(*) desc, review_lane`,
    );

    const secondReviews = await client.query<Record<string, unknown>>(
      `select decision, count(*)::int as count
       from ${schema}.entity_enrichment_second_reviews
       group by decision
       order by decision`,
    );

    return {
      disclaimer:
        "Centinela outputs are risk signals, anomalies, identity context, or leads for review. They are not proof of wrongdoing.",
      counts: normalizeRows(counts.rows)[0] ?? {},
      anchorCoverage: normalizeRows(coverage.rows)[0] ?? {},
      entityReviewLanes: normalizeRows(entityLanes.rows),
      processReviewLanes: normalizeRows(processLanes.rows),
      secondReviews: normalizeRows(secondReviews.rows),
    };
  });
}

export async function searchEntities(options: SearchEntitiesOptions = {}): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const q = asOptionalText(options.q);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `with identifier_summary as (
         select
           entity_id,
           array_agg(distinct concat(scheme, ':', value) order by concat(scheme, ':', value)) as identifiers
         from ${schema}.entity_identifiers
         group by entity_id
       )
       select
         entities.id::text as entity_id,
         entities.canonical_name as entity_name,
         entities.entity_type,
         entities.country_code,
         entities.source_key,
         entities.source_external_id,
         coalesce(identifier_summary.identifiers, '{}'::text[]) as identifiers,
         coalesce(activity.total_process_count, 0)::int as total_process_count,
         coalesce(activity.flagged_process_count, 0)::int as flagged_process_count,
         coalesce(activity.total_risk_signals, 0)::int as total_risk_signals,
         queue.anchor_status,
         queue.review_priority,
         queue.review_lane,
         queue.lead_question,
         queue.recommended_action,
         coalesce(queue.external_match_count, 0)::int as external_match_count,
         coalesce(queue.external_review_candidate_count, 0)::int as external_review_candidate_count,
         coalesce(queue.representative_count, 0)::int as representative_count
       from ${schema}.entities as entities
       left join identifier_summary
         on identifier_summary.entity_id = entities.id
       left join ${schema}.entity_procurement_activity as activity
         on activity.entity_id = entities.id
       left join ${schema}.entity_intelligence_review_queue as queue
         on queue.entity_id = entities.id
       where
         $1::text is null
         or entities.normalized_name ilike '%' || lower($1::text) || '%'
         or entities.canonical_name ilike '%' || $1::text || '%'
         or exists (
           select 1
           from ${schema}.entity_identifiers as identifiers
           where identifiers.entity_id = entities.id
             and identifiers.value ilike '%' || $1::text || '%'
         )
       order by
         case
           when $1::text is not null and lower(entities.canonical_name) = lower($1::text) then 4
           when $1::text is not null and entities.canonical_name ilike $1::text || '%' then 3
           when queue.review_priority = 'priority' then 2
           else 1
         end desc,
         coalesce(queue.external_match_count, 0) desc,
         coalesce(activity.total_risk_signals, 0) desc,
         coalesce(activity.total_process_count, 0) desc,
         entities.canonical_name
       limit $2`,
      [q, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function getEntityProfile(entityId: number): Promise<Record<string, unknown>> {
  return withDatabase(async (client, schema) => {
    const entity = await client.query<Record<string, unknown>>(
      `select
         entities.id::text as entity_id,
         entities.canonical_name as entity_name,
         entities.normalized_name,
         entities.entity_type,
         entities.country_code,
         entities.source_key,
         entities.source_external_id,
         entities.attributes,
         activity.source_keys,
         activity.total_process_count::int,
         activity.supplier_process_count::int,
         activity.buyer_process_count::int,
         activity.flagged_process_count::int,
         activity.total_risk_signals::int,
         activity.supplier_linked_contract_value::text,
         activity.supplier_linked_paid_amount::text,
         queue.anchor_status,
         queue.review_priority,
         queue.review_lane,
         queue.lead_question,
         queue.recommended_action,
         queue.local_profile_count::int,
         queue.local_signal_count::int,
         queue.external_match_count::int,
         queue.external_signal_count::int,
         queue.external_candidate_count::int,
         queue.external_review_candidate_count::int,
         queue.representative_count::int
       from ${schema}.entities as entities
       left join ${schema}.entity_procurement_activity as activity
         on activity.entity_id = entities.id
       left join ${schema}.entity_intelligence_review_queue as queue
         on queue.entity_id = entities.id
       where entities.id = $1`,
      [entityId],
    );

    const entityRow = entity.rows[0];
    if (!entityRow) {
      throw new Error(`Entity ${entityId} not found.`);
    }

    const identifiers = await client.query<Record<string, unknown>>(
      `select scheme, value, is_primary
       from ${schema}.entity_identifiers
       where entity_id = $1
       order by is_primary desc, scheme, value`,
      [entityId],
    );

    const sourceMentions = await client.query<Record<string, unknown>>(
      `select source_key, role, source_external_id, observed_name, first_seen_at, last_seen_at
       from ${schema}.entity_source_mentions
       where entity_id = $1
       order by last_seen_at desc, source_key, role
       limit 50`,
      [entityId],
    );

    const localProfiles = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_local_profile_overview
       where entity_id = $1
       order by
         case review_status when 'accepted' then 2 else 1 end desc,
         match_confidence desc,
         source_key
       limit 20`,
      [entityId],
    );

    const localSignals = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_intelligence_signal_overview
       where entity_id = $1
       order by score desc, severity desc, signal_code
       limit 20`,
      [entityId],
    );

    const acceptedMatches = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_external_match_overview
       where entity_id = $1
       order by match_confidence desc nulls last, source_key, matched_entity_name
       limit 20`,
      [entityId],
    );

    const externalCandidates = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_enrichment_candidate_review_overview
       where entity_id = $1
       order by
         case suggested_review_status
           when 'accepted_match' then 5
           when 'needs_evidence' then 4
           when 'monitor' then 3
           when 'rejected' then 2
           else 1
         end desc,
         match_confidence desc,
         external_name
       limit 20`,
      [entityId],
    );

    const secondReviews = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_enrichment_second_review_overview
       where entity_id = $1
       order by reviewed_at desc, id desc
       limit 20`,
      [entityId],
    );

    const representatives = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_representative_overview
       where entity_id = $1
       order by representative_name
       limit 50`,
      [entityId],
    );

    const counterpartyEdges = await client.query<Record<string, unknown>>(
      `select
         buyer_entity_id::text,
         buyer_name,
         supplier_entity_id::text,
         supplier_name,
         source_count::int,
         source_keys,
         process_count::int,
         flagged_process_count::int,
         total_risk_signals::int,
         linked_contract_value::text,
         linked_paid_amount::text,
         signal_codes
       from ${schema}.buyer_supplier_edge_overview
       where buyer_entity_id = $1
          or supplier_entity_id = $1
       order by process_count desc, total_risk_signals desc, coalesce(linked_paid_amount, 0) desc
       limit 25`,
      [entityId],
    );

    const processes = await client.query<Record<string, unknown>>(
      `select
         overview.process_id::text,
         overview.title,
         overview.source_key,
         overview.buyer_name,
         overview.suppliers,
         overview.status_details,
         overview.risk_signal_count::int,
         overview.signal_codes,
         overview.max_severity,
         overview.total_contract_value::text,
         overview.total_paid_amount::text,
         overview.source_url
       from ${schema}.process_risk_overview as overview
       join ${schema}.process_parties as parties
         on parties.process_id = overview.process_id
       where parties.entity_id = $1
       group by
         overview.process_id,
         overview.title,
         overview.source_key,
         overview.buyer_name,
         overview.suppliers,
         overview.status_details,
         overview.risk_signal_count,
         overview.signal_codes,
         overview.max_severity,
         overview.max_severity_rank,
         overview.total_contract_value,
         overview.total_paid_amount,
         overview.source_url
       order by overview.max_severity_rank desc, overview.risk_signal_count desc, overview.title
       limit 25`,
      [entityId],
    );

    const sourceRecords = await client.query<Record<string, unknown>>(
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
       limit 20`,
      [entityId],
    );

    const analystNotes = await client.query<Record<string, unknown>>(
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
       where target_type = 'entity'
         and target_id = $1::text
       order by created_at desc, id desc
       limit 20`,
      [entityId],
    );

    return {
      disclaimer:
        "This entity profile contains identity context, risk signals, and investigation leads for review. It is not proof of wrongdoing.",
      entity: normalizeRows(entity.rows)[0],
      identifiers: normalizeRows(identifiers.rows),
      sourceMentions: normalizeRows(sourceMentions.rows),
      localProfiles: normalizeRows(localProfiles.rows),
      localSignals: normalizeRows(localSignals.rows),
      acceptedMatches: normalizeRows(acceptedMatches.rows),
      externalCandidates: normalizeRows(externalCandidates.rows),
      secondReviews: normalizeRows(secondReviews.rows),
      representatives: normalizeRows(representatives.rows),
      counterpartyEdges: normalizeRows(counterpartyEdges.rows),
      processes: normalizeRows(processes.rows),
      sourceRecords: normalizeRows(sourceRecords.rows),
      analystNotes: normalizeRows(analystNotes.rows),
    };
  });
}

export async function getEntityNetwork(entityId: number, options: ListOptions = {}): Promise<{
  nodes: ApiNode[];
  edges: ApiEdge[];
}> {
  const limit = clampLimit(options.limit);

  return withDatabase(async (client, schema) => {
    const nodeMap = new Map<string, ApiNode>();
    const edges: ApiEdge[] = [];

    function addNode(node: ApiNode): void {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node);
      }
    }

    function addEdge(edge: ApiEdge): void {
      edges.push(edge);
    }

    const entity = await client.query<Record<string, unknown>>(
      `select id::text, canonical_name, entity_type, source_key
       from ${schema}.entities
       where id = $1`,
      [entityId],
    );

    const entityRow = entity.rows[0];
    if (!entityRow) {
      throw new Error(`Entity ${entityId} not found.`);
    }

    const centerId = `entity:${entityRow.id as string}`;
    addNode({
      id: centerId,
      label: entityRow.canonical_name as string,
      kind: entityRow.entity_type as string,
      metadata: {
        sourceKey: entityRow.source_key,
        role: "focus",
      },
    });

    const counterpartyEdges = await client.query<Record<string, unknown>>(
      `select
         buyer_entity_id::text,
         buyer_name,
         supplier_entity_id::text,
         supplier_name,
         source_count::int,
         source_keys,
         process_count::int,
         flagged_process_count::int,
         total_risk_signals::int,
         linked_contract_value::text,
         linked_paid_amount::text,
         signal_codes
       from ${schema}.buyer_supplier_edge_overview
       where buyer_entity_id = $1
          or supplier_entity_id = $1
       order by process_count desc, total_risk_signals desc, coalesce(linked_paid_amount, 0) desc
       limit $2`,
      [entityId, limit],
    );

    for (const row of counterpartyEdges.rows) {
      const buyerId = `entity:${row.buyer_entity_id as string}`;
      const supplierId = `entity:${row.supplier_entity_id as string}`;
      addNode({ id: buyerId, label: row.buyer_name as string, kind: "buyer_or_institution" });
      addNode({ id: supplierId, label: row.supplier_name as string, kind: "supplier_company" });
      addEdge({
        id: `buyer-supplier:${row.buyer_entity_id as string}:${row.supplier_entity_id as string}`,
        source: buyerId,
        target: supplierId,
        relation: "buyer_supplier_procurement_edge",
        metadata: {
          processCount: row.process_count,
          flaggedProcessCount: row.flagged_process_count,
          totalRiskSignals: row.total_risk_signals,
          linkedContractValue: row.linked_contract_value,
          linkedPaidAmount: row.linked_paid_amount,
          signalCodes: row.signal_codes,
          sourceKeys: row.source_keys,
        },
      });
    }

    const representatives = await client.query<Record<string, unknown>>(
      `select
         representative_entity_id::text,
         representative_name,
         source_key,
         confidence::text,
         provider_slug,
         provider_ruc
       from ${schema}.entity_representative_overview
       where entity_id = $1
       order by representative_name
       limit $2`,
      [entityId, limit],
    );

    for (const row of representatives.rows) {
      const representativeId = `entity:${row.representative_entity_id as string}`;
      addNode({
        id: representativeId,
        label: row.representative_name as string,
        kind: "representative_person",
        metadata: {
          sourceKey: row.source_key,
          providerSlug: row.provider_slug,
          providerRuc: row.provider_ruc,
        },
      });
      addEdge(
        withConfidence(
          {
            id: `representation:${entityId}:${row.representative_entity_id as string}`,
            source: centerId,
            target: representativeId,
            relation: "representation_legal",
            metadata: {
              sourceKey: row.source_key,
            },
          },
          row.confidence,
        ),
      );
    }

    const acceptedMatches = await client.query<Record<string, unknown>>(
      `select
         matched_entity_id::text,
         matched_entity_name,
         matched_entity_type,
         source_key,
         match_method,
         match_confidence::text,
         match_quality,
         review_status,
         signal_count::int,
         max_severity
       from ${schema}.entity_external_match_overview
       where entity_id = $1
       order by match_confidence desc nulls last, matched_entity_name
       limit $2`,
      [entityId, limit],
    );

    for (const row of acceptedMatches.rows) {
      const externalId = `entity:${row.matched_entity_id as string}`;
      addNode({
        id: externalId,
        label: row.matched_entity_name as string,
        kind: `external_${row.matched_entity_type as string}`,
        metadata: {
          sourceKey: row.source_key,
          reviewStatus: row.review_status,
        },
      });
      addEdge(
        withConfidence(
          {
            id: `accepted-external-match:${entityId}:${row.matched_entity_id as string}`,
            source: centerId,
            target: externalId,
            relation: "accepted_external_match",
            metadata: {
              sourceKey: row.source_key,
              matchMethod: row.match_method,
              matchQuality: row.match_quality,
              signalCount: row.signal_count,
              maxSeverity: row.max_severity,
              nonAccusatoryUse: true,
            },
          },
          row.match_confidence,
        ),
      );
    }

    const candidates = await client.query<Record<string, unknown>>(
      `select
         id::text,
         external_id,
         external_name,
         external_entity_type,
         local_screening_role,
         candidate_status,
         match_confidence::text,
         review_status,
         second_review_decision,
         accepted_match_id::text,
         hosted_support_category
       from ${schema}.entity_enrichment_candidate_review_overview
       where entity_id = $1
       order by match_confidence desc, external_name
       limit $2`,
      [entityId, limit],
    );

    for (const row of candidates.rows) {
      const candidateNodeId = `external-candidate:${row.id as string}`;
      addNode({
        id: candidateNodeId,
        label: row.external_name as string,
        kind: `external_candidate_${row.external_entity_type as string}`,
        metadata: {
          externalId: row.external_id,
          candidateStatus: row.candidate_status,
          reviewStatus: row.review_status,
          secondReviewDecision: row.second_review_decision,
          acceptedMatchId: row.accepted_match_id,
        },
      });
      addEdge(
        withConfidence(
          {
            id: `candidate:${entityId}:${row.id as string}`,
            source: centerId,
            target: candidateNodeId,
            relation: "reviewable_external_candidate",
            metadata: {
              localScreeningRole: row.local_screening_role,
              hostedSupportCategory: row.hosted_support_category,
              nonAccusatoryUse: true,
            },
          },
          row.match_confidence,
        ),
      );
    }

    const processes = await client.query<Record<string, unknown>>(
      `select distinct on (processes.id)
         processes.id::text,
         processes.title,
         processes.source_key,
         parties.role,
         overview.risk_signal_count::int,
         overview.max_severity,
         overview.total_contract_value::text
       from ${schema}.process_parties as parties
       join ${schema}.procurement_processes as processes
         on processes.id = parties.process_id
       left join ${schema}.process_risk_overview as overview
         on overview.process_id = processes.id
       where parties.entity_id = $1
       order by processes.id, overview.risk_signal_count desc nulls last
       limit $2`,
      [entityId, limit],
    );

    for (const row of processes.rows) {
      const processId = `process:${row.id as string}`;
      addNode({
        id: processId,
        label: row.title as string,
        kind: "procurement_process",
        metadata: {
          sourceKey: row.source_key,
          riskSignalCount: row.risk_signal_count,
          maxSeverity: row.max_severity,
          totalContractValue: row.total_contract_value,
        },
      });
      addEdge({
        id: `process-party:${entityId}:${row.id as string}`,
        source: centerId,
        target: processId,
        relation: `participates_as_${row.role as string}`,
        metadata: {
          sourceKey: row.source_key,
        },
      });
    }

    return {
      nodes: [...nodeMap.values()],
      edges,
    };
  });
}

export async function getEntityNetworkExport(
  entityId: number,
  options: NetworkExportOptions = {},
): Promise<Record<string, unknown>> {
  const network = await getEntityNetwork(entityId, options);
  const format = options.format?.trim().toLowerCase() || "node-link";

  if (format === "cytoscape") {
    return {
      format,
      disclaimer:
        "Graph exports are relationship leads for review. They are not proof of wrongdoing or ownership control.",
      elements: [
        ...network.nodes.map((node) => ({
          group: "nodes",
          data: {
            id: node.id,
            label: node.label,
            kind: node.kind,
            ...node.metadata,
          },
        })),
        ...network.edges.map((edge) => ({
          group: "edges",
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            relation: edge.relation,
            confidence: edge.confidence ?? null,
            ...edge.metadata,
          },
        })),
      ],
    };
  }

  if (format === "jsonl") {
    return {
      format,
      disclaimer:
        "Graph exports are relationship leads for review. They are not proof of wrongdoing or ownership control.",
      lines: [
        ...network.nodes.map((node) => JSON.stringify({ type: "node", ...node })),
        ...network.edges.map((edge) => JSON.stringify({ type: "edge", ...edge })),
      ],
    };
  }

  if (format !== "node-link" && format !== "json") {
    throw new Error('Unsupported graph export format. Use "node-link", "cytoscape", or "jsonl".');
  }

  return {
    format: "node-link",
    disclaimer:
      "Graph exports are relationship leads for review. They are not proof of wrongdoing or ownership control.",
    ...network,
  };
}

export async function getEntityReviewQueue(options: QueueOptions = {}): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const lane = asOptionalText(options.lane);
  const priority = asOptionalText(options.priority);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_intelligence_review_queue
       where ($1::text is null or review_lane = $1)
         and ($2::text is null or review_priority = $2)
       order by
         case review_priority
           when 'priority' then 3
           when 'enhanced_review' then 2
           else 1
         end desc,
         external_signal_count desc,
         local_signal_count desc,
         external_review_candidate_count desc,
         total_risk_signals desc,
         representative_count desc,
         entity_name
       limit $3`,
      [lane, priority, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function getProcessReviewQueue(options: QueueOptions = {}): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const lane = asOptionalText(options.lane);
  const priority = asOptionalText(options.priority);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.process_review_queue
       where ($1::text is null or review_lane = $1)
         and ($2::text is null or review_priority = $2)
       order by
         case review_priority
           when 'priority' then 3
           when 'enhanced_review' then 2
           else 1
         end desc,
         risk_signal_count desc,
         coalesce(total_paid_amount, 0) desc,
         coalesce(total_contract_value, 0) desc,
         title
       limit $3`,
      [lane, priority, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function getExternalCandidates(
  options: ExternalCandidateOptions = {},
): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);
  const reviewStatus = asOptionalText(options.reviewStatus);
  const secondReviewDecision = asOptionalText(options.secondReviewDecision);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_enrichment_candidate_review_overview
       where ($1::text is null or review_status = $1)
         and ($2::text is null or second_review_decision = $2)
       order by
         case suggested_review_status
           when 'accepted_match' then 5
           when 'needs_evidence' then 4
           when 'monitor' then 3
           when 'rejected' then 2
           else 1
         end desc,
         match_confidence desc,
         entity_name,
         external_name
       limit $3`,
      [reviewStatus, secondReviewDecision, limit],
    );

    return normalizeRows(result.rows);
  });
}

export async function getAcceptedExternalMatches(options: ListOptions = {}): Promise<Array<Record<string, unknown>>> {
  const limit = clampLimit(options.limit);

  return withDatabase(async (client, schema) => {
    const result = await client.query<Record<string, unknown>>(
      `select *
       from ${schema}.entity_enrichment_second_review_overview
       where decision = 'accepted_match'
       order by reviewed_at desc, id desc
       limit $1`,
      [limit],
    );

    return normalizeRows(result.rows);
  });
}
