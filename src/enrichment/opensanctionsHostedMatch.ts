import type { Client } from "pg";
import { writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";

const DEFAULT_API_BASE_URL = "https://api.opensanctions.org";
const HOSTED_MATCH_SOURCE_KEY = "ext-opensanctions-hosted-match";
const DEFAULT_DATASET = "default";
const DEFAULT_ALGORITHM = "logic-v2";
const DEFAULT_THRESHOLD = 0.7;
const DEFAULT_RESULT_LIMIT = 5;
const DEFAULT_BATCH_SIZE = 20;

interface HostedMatchOptions {
  limit: number;
  batchSize: number;
  dryRun: boolean;
  dataset: string;
  algorithm: string;
  threshold: number;
  resultLimit: number;
}

interface LocalComparisonEntityRow {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  local_screening_role: "supplier_company" | "legal_representative";
  candidate_statuses: string[] | null;
  local_candidate_methods: string[] | null;
  max_local_candidate_confidence: string | null;
  local_candidate_count: string;
  local_external_ids: string[] | null;
  local_external_names: string[] | null;
  identifiers: string[] | null;
  profile_names: string[] | null;
  linked_company_names: string[] | null;
}

interface MatchQueryEntity {
  schema: "Company" | "Person";
  properties: Record<string, string[]>;
}

interface MatchQueryPayload {
  queries: Record<string, MatchQueryEntity>;
}

interface HostedMatchResult {
  id?: string;
  schema?: string;
  caption?: string;
  score?: number;
  datasets?: string[];
  properties?: Record<string, unknown>;
  features?: Record<string, unknown>;
  match?: boolean;
}

interface HostedMatchResponseItem {
  query?: unknown;
  results?: HostedMatchResult[];
}

interface HostedMatchResponse {
  responses?: Record<string, HostedMatchResponseItem>;
  limit?: number;
}

interface HostedComparisonItem {
  queryId: string;
  localEntity: LocalComparisonEntityRow;
  query: MatchQueryEntity;
  hostedResultCount: number;
  supportCategory: "same_local_candidate" | "different_hosted_result" | "no_hosted_result";
  topResults: HostedMatchResult[];
}

interface HostedComparisonSummary {
  generatedAt: string;
  sourceKey: string;
  apiBaseUrl: string;
  dataset: string;
  algorithm: string;
  threshold: number;
  resultLimit: number;
  dryRun: boolean;
  localEntityCount: number;
  requestBatchCount: number;
  hostedMatchedEntityCount: number;
  sameLocalCandidateCount: number;
  differentHostedResultCount: number;
  noHostedResultCount: number;
  note: string;
}

interface HostedComparisonOutput {
  summary: HostedComparisonSummary;
  items: HostedComparisonItem[];
  requestPayloads: MatchQueryPayload[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function asTextArray(value: string[] | null | undefined): string[] {
  return (value ?? []).filter(Boolean);
}

function toNumericOrNull(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function safeQueryId(row: LocalComparisonEntityRow): string {
  return `${row.local_screening_role}_${row.entity_id}`;
}

function registrationNumbers(identifiers: string[]): string[] {
  return unique(
    identifiers
      .filter((identifier) => /^PY-RUC/i.test(identifier))
      .map((identifier) => identifier.replace(/^PY-RUC(?:-PLAIN|-BASE)?[:,-]?/i, ""))
      .map((identifier) => identifier.replace(/^PY-RUC-/i, ""))
      .filter((identifier) => /\d/.test(identifier)),
  );
}

function buildMatchQuery(row: LocalComparisonEntityRow): MatchQueryEntity {
  const schema = row.local_screening_role === "legal_representative" ? "Person" : "Company";
  const names = unique([row.entity_name, ...asTextArray(row.profile_names)]);
  const properties: Record<string, string[]> = {
    name: names,
  };

  if (schema === "Company") {
    const registrations = registrationNumbers(asTextArray(row.identifiers));
    properties.country = ["py"];
    properties.jurisdiction = ["py"];
    if (registrations.length > 0) {
      properties.registrationNumber = registrations;
    }
  }

  return {
    schema,
    properties,
  };
}

async function queryLocalComparisonEntities(
  client: Client,
  schema: string,
  limit: number,
): Promise<LocalComparisonEntityRow[]> {
  const result = await client.query<LocalComparisonEntityRow>(
    `with candidate_entities as (
       select
         candidates.entity_id,
         candidates.entity_name,
         candidates.entity_type,
         candidates.local_screening_role,
         array_agg(distinct candidates.candidate_status order by candidates.candidate_status) as candidate_statuses,
         array_agg(distinct candidates.match_method order by candidates.match_method) as local_candidate_methods,
         max(candidates.match_confidence)::text as max_local_candidate_confidence,
         count(*)::text as local_candidate_count,
         array_agg(distinct candidates.external_id order by candidates.external_id) as local_external_ids,
         array_agg(distinct candidates.external_name order by candidates.external_name) as local_external_names
       from ${schema}.entity_enrichment_candidate_overview as candidates
       group by
         candidates.entity_id,
         candidates.entity_name,
         candidates.entity_type,
         candidates.local_screening_role
     ),
     identifier_summary as (
       select
         entity_id,
         array_agg(distinct concat(scheme, ':', value) order by concat(scheme, ':', value)) as identifiers
       from ${schema}.entity_identifiers
       group by entity_id
     ),
     profile_summary as (
       select
         entity_id,
         array_remove(array_agg(distinct nullif(official_name, '') order by nullif(official_name, '')), null) as profile_names
       from ${schema}.entity_local_profile_overview
       group by entity_id
     ),
     representative_company_summary as (
       select
         representative_entity_id as entity_id,
         array_remove(array_agg(distinct entity_name order by entity_name), null) as linked_company_names
       from ${schema}.entity_representative_overview
       where representative_entity_id is not null
       group by representative_entity_id
     )
     select
       candidate_entities.entity_id::text,
       candidate_entities.entity_name,
       candidate_entities.entity_type,
       candidate_entities.local_screening_role,
       candidate_entities.candidate_statuses,
       candidate_entities.local_candidate_methods,
       candidate_entities.max_local_candidate_confidence,
       candidate_entities.local_candidate_count,
       candidate_entities.local_external_ids,
       candidate_entities.local_external_names,
       coalesce(identifier_summary.identifiers, '{}'::text[]) as identifiers,
       coalesce(profile_summary.profile_names, '{}'::text[]) as profile_names,
       coalesce(representative_company_summary.linked_company_names, '{}'::text[]) as linked_company_names
     from candidate_entities
     left join identifier_summary
       on identifier_summary.entity_id = candidate_entities.entity_id
     left join profile_summary
       on profile_summary.entity_id = candidate_entities.entity_id
     left join representative_company_summary
       on representative_company_summary.entity_id = candidate_entities.entity_id
     order by
       case when 'review_candidate' = any(candidate_entities.candidate_statuses) then 2 else 1 end desc,
       case candidate_entities.local_screening_role when 'supplier_company' then 2 else 1 end desc,
       candidate_entities.max_local_candidate_confidence::numeric desc,
       candidate_entities.entity_name
     limit $1`,
    [limit],
  );

  return result.rows;
}

async function postMatchBatch(
  apiBaseUrl: string,
  apiKey: string,
  options: HostedMatchOptions,
  payload: MatchQueryPayload,
): Promise<HostedMatchResponse> {
  const url = new URL(`/match/${encodeURIComponent(options.dataset)}`, apiBaseUrl);
  url.searchParams.set("algorithm", options.algorithm);
  url.searchParams.set("threshold", String(options.threshold));
  url.searchParams.set("limit", String(options.resultLimit));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "user-agent": "Centinela/0.1",
      accept: "application/json",
      "content-type": "application/json",
      authorization: `ApiKey ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenSanctions hosted match request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return (await response.json()) as HostedMatchResponse;
}

function renderHostedComparisonReport(output: HostedComparisonOutput): string {
  const lines: string[] = [];
  lines.push("# OpenSanctions hosted match comparison");
  lines.push("");
  lines.push("This report compares Centinela local review-only candidate scoring against the authenticated OpenSanctions/Yente matcher. It is not an accusation and does not promote any match automatically.");
  lines.push("");
  lines.push("## Run summary");
  lines.push("");
  lines.push(`- Generated at: ${output.summary.generatedAt}`);
  lines.push(`- API base URL: ${output.summary.apiBaseUrl}`);
  lines.push(`- Dataset: ${output.summary.dataset}`);
  lines.push(`- Algorithm: ${output.summary.algorithm}`);
  lines.push(`- Threshold: ${output.summary.threshold}`);
  lines.push(`- Result limit per query: ${output.summary.resultLimit}`);
  lines.push(`- Dry run: ${output.summary.dryRun}`);
  lines.push(`- Local entities prepared: ${output.summary.localEntityCount}`);
  lines.push(`- Request batches prepared: ${output.summary.requestBatchCount}`);
  lines.push(`- Entities with hosted results above threshold: ${output.summary.hostedMatchedEntityCount}`);
  lines.push(`- Hosted same-candidate confirmations: ${output.summary.sameLocalCandidateCount}`);
  lines.push(`- Hosted different-result alternatives: ${output.summary.differentHostedResultCount}`);
  lines.push(`- Hosted no-result cases: ${output.summary.noHostedResultCount}`);
  lines.push(`- Note: ${output.summary.note}`);
  lines.push("");

  lines.push("## Prepared or returned comparisons");
  lines.push("");
  for (const item of output.items) {
    const row = item.localEntity;
    const queryNames = item.query.properties.name ?? [];
    lines.push(`### ${row.entity_name}`);
    lines.push(`- Query id: ${item.queryId}`);
    lines.push(`- Local screening role: ${row.local_screening_role}`);
    lines.push(`- Query schema: ${item.query.schema}`);
    lines.push(`- Query names: ${queryNames.join(", ")}`);
    lines.push(`- Query registration numbers: ${(item.query.properties.registrationNumber ?? []).join(", ") || "n/a"}`);
    lines.push(`- Local candidate statuses: ${asTextArray(row.candidate_statuses).join(", ") || "n/a"}`);
    lines.push(`- Local candidate methods: ${asTextArray(row.local_candidate_methods).join(", ") || "n/a"}`);
    lines.push(`- Local max confidence: ${row.max_local_candidate_confidence ?? "n/a"}`);
    lines.push(`- Local external candidate ids: ${asTextArray(row.local_external_ids).join(", ") || "n/a"}`);
    lines.push(`- Local external candidate names: ${asTextArray(row.local_external_names).join(", ") || "n/a"}`);
    lines.push(`- Linked local companies: ${asTextArray(row.linked_company_names).join(", ") || "n/a"}`);
    lines.push(`- Hosted results above threshold: ${item.hostedResultCount}`);
    lines.push(`- Hosted support category: ${item.supportCategory}`);

    if (item.topResults.length > 0) {
      for (const result of item.topResults.slice(0, 5)) {
        const datasets = Array.isArray(result.datasets) ? result.datasets.join(", ") : "n/a";
        lines.push(`- Hosted result: ${result.caption ?? result.id ?? "unknown"} (${result.schema ?? "unknown"}), score=${result.score ?? "n/a"}, id=${result.id ?? "n/a"}, datasets=${datasets}`);
      }
    }
    lines.push("");
  }

  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- Hosted scores are comparison evidence only. They do not by themselves create accepted matches, risk signals, or legal conclusions.");
  lines.push("- `same_local_candidate` means the hosted matcher returned the same OpenSanctions entity already present in Centinela's local candidate layer.");
  lines.push("- `different_hosted_result` means the hosted matcher returned some above-threshold result, but not the same candidate Centinela had already surfaced. These cases need extra scrutiny because they often reflect broad-name ambiguity.");
  lines.push("- If hosted results disagree with Centinela local candidates, keep both pieces of evidence and resolve through review status, source documents, identifiers, and methodology notes.");
  lines.push("- The latest hosted comparison state is also persisted to PostgreSQL so entity dossiers, candidate review, and queue outputs can reuse the same evidence.");
  lines.push("- For moderate analyst-triggered use, hosted API is the fastest path. If screening volume grows, self-hosted Yente should be evaluated for sovereignty, cost, and update-control reasons.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function createSourceRun(client: Client, schema: string, notes: string): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [HOSTED_MATCH_SOURCE_KEY, "PY", "running", notes],
  );

  const sourceRun = result.rows[0];
  if (!sourceRun) {
    throw new Error("Failed to create OpenSanctions hosted-match source run.");
  }

  return sourceRun.id;
}

async function upsertSourceAssets(
  client: Client,
  schema: string,
  sourceRunId: number,
  assets: Array<{ assetKind: string; path?: string; sourceUrl?: string }>,
): Promise<void> {
  for (const asset of assets) {
    await client.query(
      `insert into ${schema}.source_assets (source_run_id, asset_kind, path, source_url)
       values ($1, $2, $3, $4)`,
      [sourceRunId, asset.assetKind, asset.path ?? null, asset.sourceUrl ?? null],
    );
  }
}

async function clearExistingHostedMatchState(client: Client, schema: string): Promise<void> {
  await client.query(`delete from ${schema}.entity_hosted_match_comparisons where source_key = $1`, [
    HOSTED_MATCH_SOURCE_KEY,
  ]);
}

async function insertHostedComparisons(
  client: Client,
  schema: string,
  sourceRunId: number,
  output: HostedComparisonOutput,
  batchSize: number,
): Promise<void> {
  if (output.items.length === 0) {
    return;
  }

  for (const batch of chunk(output.items, 200)) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           source_run_id bigint,
           source_key text,
           local_screening_role text,
           api_base_url text,
           dataset text,
           algorithm text,
           threshold numeric,
           result_limit integer,
           batch_size integer,
           dry_run boolean,
           support_category text,
           hosted_result_count integer,
           local_candidate_statuses text[],
           local_candidate_methods text[],
           local_candidate_max_confidence numeric,
           local_external_ids text[],
           local_external_names text[],
           linked_company_names text[],
           query_payload jsonb,
           top_results jsonb,
           top_result_id text,
           top_result_name text,
           top_result_schema text,
           top_result_score numeric,
           top_result_datasets text[],
           compared_at timestamptz
         )
       )
       insert into ${schema}.entity_hosted_match_comparisons (
         entity_id,
         source_run_id,
         source_key,
         local_screening_role,
         api_base_url,
         dataset,
         algorithm,
         threshold,
         result_limit,
         batch_size,
         dry_run,
         support_category,
         hosted_result_count,
         local_candidate_statuses,
         local_candidate_methods,
         local_candidate_max_confidence,
         local_external_ids,
         local_external_names,
         linked_company_names,
         query_payload,
         top_results,
         top_result_id,
         top_result_name,
         top_result_schema,
         top_result_score,
         top_result_datasets,
         compared_at
       )
       select
         input.entity_id,
         input.source_run_id,
         input.source_key,
         input.local_screening_role,
         input.api_base_url,
         input.dataset,
         input.algorithm,
         input.threshold,
         input.result_limit,
         input.batch_size,
         input.dry_run,
         input.support_category,
         input.hosted_result_count,
         coalesce(input.local_candidate_statuses, '{}'::text[]),
         coalesce(input.local_candidate_methods, '{}'::text[]),
         input.local_candidate_max_confidence,
         coalesce(input.local_external_ids, '{}'::text[]),
         coalesce(input.local_external_names, '{}'::text[]),
         coalesce(input.linked_company_names, '{}'::text[]),
         coalesce(input.query_payload, '{}'::jsonb),
         coalesce(input.top_results, '[]'::jsonb),
         input.top_result_id,
         input.top_result_name,
         input.top_result_schema,
         input.top_result_score,
         coalesce(input.top_result_datasets, '{}'::text[]),
         input.compared_at
       from input`,
      [
        JSON.stringify(
          batch.map((item) => {
            const topResult = item.topResults[0];
            return {
              entity_id: Number(item.localEntity.entity_id),
              source_run_id: sourceRunId,
              source_key: HOSTED_MATCH_SOURCE_KEY,
              local_screening_role: item.localEntity.local_screening_role,
              api_base_url: output.summary.apiBaseUrl,
              dataset: output.summary.dataset,
              algorithm: output.summary.algorithm,
              threshold: output.summary.threshold,
              result_limit: output.summary.resultLimit,
              batch_size: batchSize,
              dry_run: output.summary.dryRun,
              support_category: item.supportCategory,
              hosted_result_count: item.hostedResultCount,
              local_candidate_statuses: asTextArray(item.localEntity.candidate_statuses),
              local_candidate_methods: asTextArray(item.localEntity.local_candidate_methods),
              local_candidate_max_confidence: toNumericOrNull(item.localEntity.max_local_candidate_confidence),
              local_external_ids: asTextArray(item.localEntity.local_external_ids),
              local_external_names: asTextArray(item.localEntity.local_external_names),
              linked_company_names: asTextArray(item.localEntity.linked_company_names),
              query_payload: item.query,
              top_results: item.topResults,
              top_result_id: topResult?.id ?? null,
              top_result_name: topResult?.caption ?? topResult?.id ?? null,
              top_result_schema: topResult?.schema ?? null,
              top_result_score: typeof topResult?.score === "number" ? topResult.score : null,
              top_result_datasets: Array.isArray(topResult?.datasets) ? topResult.datasets : [],
              compared_at: output.summary.generatedAt,
            };
          }),
        ),
      ],
    );
  }
}

async function finalizeSourceRun(
  client: Client,
  schema: string,
  sourceRunId: number,
  status: "completed" | "failed",
  notes: string,
): Promise<void> {
  await client.query(
    `update ${schema}.source_runs
     set finished_at = now(), status = $2, notes = $3
     where id = $1`,
    [sourceRunId, status, notes],
  );
}

export async function runOpenSanctionsHostedMatchComparison(
  options: Partial<HostedMatchOptions> = {},
): Promise<{ summaryPath: string; reportPath: string }> {
  const resolved: HostedMatchOptions = {
    limit: options.limit ?? 25,
    batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
    dryRun: options.dryRun ?? false,
    dataset: options.dataset ?? process.env.OPENSANCTIONS_MATCH_DATASET ?? DEFAULT_DATASET,
    algorithm: options.algorithm ?? process.env.OPENSANCTIONS_MATCH_ALGORITHM ?? DEFAULT_ALGORITHM,
    threshold: options.threshold ?? Number(process.env.OPENSANCTIONS_MATCH_THRESHOLD ?? DEFAULT_THRESHOLD),
    resultLimit: options.resultLimit ?? Number(process.env.OPENSANCTIONS_MATCH_RESULT_LIMIT ?? DEFAULT_RESULT_LIMIT),
  };
  const apiBaseUrl = process.env.OPENSANCTIONS_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const apiKey = process.env.OPENSANCTIONS_API_KEY;

  if (!resolved.dryRun && !apiKey) {
    throw new Error("Missing OPENSANCTIONS_API_KEY. Use --dry-run true to build request payloads without calling the hosted API.");
  }

  const { client, schema } = await connectToPostgres();
  let sourceRunId: number | undefined;
  try {
    const localEntities = await queryLocalComparisonEntities(client, schema, resolved.limit);
    const requestPayloads = chunk(localEntities, resolved.batchSize).map((batch) => {
      const queries = Object.fromEntries(batch.map((row) => [safeQueryId(row), buildMatchQuery(row)]));
      return { queries };
    });

    const responses = new Map<string, HostedMatchResponseItem>();
    if (!resolved.dryRun && apiKey) {
      for (const payload of requestPayloads) {
        const response = await postMatchBatch(apiBaseUrl, apiKey, resolved, payload);
        for (const [queryId, item] of Object.entries(response.responses ?? {})) {
          responses.set(queryId, item);
        }
      }
    }

    const items = localEntities.map((row) => {
      const queryId = safeQueryId(row);
      const topResults = responses.get(queryId)?.results ?? [];
      const localExternalIds = new Set(asTextArray(row.local_external_ids));
      const supportCategory: HostedComparisonItem["supportCategory"] =
        topResults.length === 0
          ? "no_hosted_result"
          : topResults.some((result) => result.id && localExternalIds.has(result.id))
            ? "same_local_candidate"
            : "different_hosted_result";
      return {
        queryId,
        localEntity: row,
        query: buildMatchQuery(row),
        hostedResultCount: topResults.length,
        supportCategory,
        topResults,
      };
    });

    const output: HostedComparisonOutput = {
      summary: {
        generatedAt: new Date().toISOString(),
        sourceKey: HOSTED_MATCH_SOURCE_KEY,
        apiBaseUrl,
        dataset: resolved.dataset,
        algorithm: resolved.algorithm,
        threshold: resolved.threshold,
        resultLimit: resolved.resultLimit,
        dryRun: resolved.dryRun,
        localEntityCount: localEntities.length,
        requestBatchCount: requestPayloads.length,
        hostedMatchedEntityCount: items.filter((item) => item.hostedResultCount > 0).length,
        sameLocalCandidateCount: items.filter((item) => item.supportCategory === "same_local_candidate").length,
        differentHostedResultCount: items.filter((item) => item.supportCategory === "different_hosted_result").length,
        noHostedResultCount: items.filter((item) => item.supportCategory === "no_hosted_result").length,
        note: resolved.dryRun
          ? "Dry run only: request payloads were built but not sent because hosted API credentials were not used."
          : "Hosted API was called. Results are comparison evidence only and require human review.",
      },
      items,
      requestPayloads,
    };

    const summaryPath = await writeOutputJson(
      ["normalized", "paraguay", "opensanctions-hosted-match-comparison.json"],
      output,
    );
    const reportPath = await writeOutputText(
      ["reports", "paraguay", "opensanctions-hosted-match-comparison.md"],
      renderHostedComparisonReport(output),
    );

    if (!resolved.dryRun) {
      sourceRunId = await createSourceRun(
        client,
        schema,
        `OpenSanctions hosted comparison started for ${output.summary.localEntityCount} local candidate or diagnostic entities.`,
      );

      try {
        await client.query("begin");
        await clearExistingHostedMatchState(client, schema);
        await upsertSourceAssets(client, schema, sourceRunId, [
          {
            assetKind: "source_api",
            sourceUrl: `${apiBaseUrl}/match/${encodeURIComponent(resolved.dataset)}`,
          },
          { assetKind: "normalized_bundle", path: summaryPath },
          { assetKind: "report", path: reportPath },
        ]);
        await insertHostedComparisons(client, schema, sourceRunId, output, resolved.batchSize);
        await client.query("commit");

        await finalizeSourceRun(
          client,
          schema,
          sourceRunId,
          "completed",
          `OpenSanctions hosted comparison completed: ${output.summary.localEntityCount} entities compared, ${output.summary.sameLocalCandidateCount} same-candidate confirmations, ${output.summary.differentHostedResultCount} different-result alternatives, ${output.summary.noHostedResultCount} no-result cases.`,
        );
      } catch (error) {
        try {
          await client.query("rollback");
        } catch {
          // Ignore rollback errors so the original failure surfaces.
        }

        if (sourceRunId) {
          await finalizeSourceRun(
            client,
            schema,
            sourceRunId,
            "failed",
            error instanceof Error ? error.message.slice(0, 500) : "OpenSanctions hosted comparison failed.",
          );
        }

        throw error;
      }
    }

    return { summaryPath, reportPath };
  } finally {
    await client.end();
  }
}
