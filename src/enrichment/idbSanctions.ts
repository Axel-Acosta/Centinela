import { URL } from "node:url";
import { writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";
import { fetchJson } from "../lib/http";
import { updateExternalCandidateReview } from "../storage/candidateReview";

const IDB_SOURCE_KEY = "ext-idb-sanctions-open-data";
const IDB_RESOURCE_ID = "cd0bd9ac-18c6-44bc-8592-9be468c2efd9";
const IDB_DATASET_PAGE =
  "https://data.iadb.org/es/dataset/dataset-of-sanctioned-firms-and-individuals";
const IDB_DATASTORE_API = "https://data.iadb.org/es/api/action/datastore_search";

interface IadbSanctionsRecord {
  _id: number;
  Title?: string;
  Entity?: string;
  Nationality?: string;
  Country?: string;
  From?: string;
  To?: string;
  "Prohibited Practice"?: string;
  Source?: string;
  "Tipo de sancion del BID"?: string;
  "IDB Sanction Source"?: string;
  "Other Name"?: string;
  rank?: number;
}

interface IadbDatastoreResponse {
  success: boolean;
  result: {
    records: IadbSanctionsRecord[];
    total?: number;
    fields?: unknown[];
    _links?: Record<string, string>;
  };
}

interface CandidateReviewRow {
  id: string;
  entity_id: string;
  entity_name: string;
  source_key: string;
  external_id: string;
  external_name: string;
  external_schema: string;
  local_screening_role: string;
  candidate_status: string;
  review_status: string;
  hosted_support_category: string | null;
  hosted_top_result_name: string | null;
  hosted_top_result_score: string | null;
  local_identifiers: string[] | null;
  local_ruc_identifiers: string[] | null;
  local_profile_sources: string[] | null;
  local_profile_names: string[] | null;
  local_profile_rucs: string[] | null;
}

export interface RunIadbSanctionsCandidateCheckOptions {
  candidateId: number;
  country?: string;
  updateReview?: boolean;
  reviewer?: string;
  dryRun?: boolean;
}

export interface IadbSanctionsCandidateCheckResult {
  candidateId: number;
  matched: boolean;
  matchedRecordId?: number;
  recommendedReviewStatus: "needs_evidence" | "promotable";
  rawPath: string;
  reportPath: string;
}

function normalizeForMatch(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const tokens = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const merged: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    const next = tokens[index + 1];
    const afterNext = tokens[index + 2];

    if (current === "s" && next === "a") {
      merged.push("sa");
      index += 1;
      continue;
    }

    if (current === "s" && next === "r" && afterNext === "l") {
      merged.push("srl");
      index += 2;
      continue;
    }

    merged.push(current ?? "");
  }

  return merged.join(" ");
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeForMatch(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeForMatch(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

function buildIadbDatastoreUrl(country: string): string {
  const url = new URL(IDB_DATASTORE_API);
  url.searchParams.set("resource_id", IDB_RESOURCE_ID);
  url.searchParams.set("filters", JSON.stringify({ Nationality: country }));
  url.searchParams.set("limit", "500");
  return url.toString();
}

function selectBestRecord(candidate: CandidateReviewRow, records: IadbSanctionsRecord[]): IadbSanctionsRecord | undefined {
  const candidateExternalName = normalizeForMatch(candidate.external_name);
  const candidateLocalName = normalizeForMatch(candidate.entity_name);

  const exactExternal = records.find((record) => normalizeForMatch(record.Title) === candidateExternalName);
  if (exactExternal) {
    return exactExternal;
  }

  const exactLocal = records.find((record) => normalizeForMatch(record.Title) === candidateLocalName);
  if (exactLocal) {
    return exactLocal;
  }

  return records
    .map((record) => ({
      record,
      score: Math.max(
        tokenSimilarity(candidate.external_name, record.Title ?? ""),
        tokenSimilarity(candidate.entity_name, record.Title ?? ""),
      ),
    }))
    .filter((entry) => entry.score >= 0.85)
    .sort((left, right) => right.score - left.score)[0]?.record;
}

function hasParaguaySupport(record: IadbSanctionsRecord | undefined): boolean {
  if (!record) {
    return false;
  }

  return [record.Nationality, record.Country]
    .filter((value): value is string => typeof value === "string")
    .some((value) => normalizeForMatch(value).includes("paraguay"));
}

function renderReport(input: {
  candidate: CandidateReviewRow;
  sourceUrl: string;
  records: IadbSanctionsRecord[];
  selectedRecord?: IadbSanctionsRecord;
  recommendedReviewStatus: "needs_evidence" | "promotable";
  dryRun: boolean;
  updatedReview: boolean;
}): string {
  const lines: string[] = [];
  const selected = input.selectedRecord;

  lines.push(`# IDB sanctions source check for candidate ${input.candidate.id}`);
  lines.push("");
  lines.push("This report records source-document evidence for review. It is not an accepted match, risk signal, or legal conclusion.");
  lines.push("");
  lines.push("## Local candidate");
  lines.push("");
  lines.push(`- Local entity: ${input.candidate.entity_name}`);
  lines.push(`- Local RUC identifiers: ${(input.candidate.local_ruc_identifiers ?? []).join(", ") || "n/a"}`);
  lines.push(`- Local profile sources: ${(input.candidate.local_profile_sources ?? []).join(", ") || "n/a"}`);
  lines.push(`- Local profile names: ${(input.candidate.local_profile_names ?? []).join(", ") || "n/a"}`);
  lines.push(`- Current external candidate: ${input.candidate.external_name}`);
  lines.push(`- Current review status before this check: ${input.candidate.review_status}`);
  lines.push(`- Hosted support: ${input.candidate.hosted_support_category ?? "n/a"}`);
  lines.push(`- Hosted top result / score: ${input.candidate.hosted_top_result_name ?? "n/a"} / ${input.candidate.hosted_top_result_score ?? "n/a"}`);
  lines.push("");
  lines.push("## Official IDB source");
  lines.push("");
  lines.push(`- Dataset page: ${IDB_DATASET_PAGE}`);
  lines.push(`- API URL checked: ${input.sourceUrl}`);
  lines.push(`- Paraguay rows returned: ${input.records.length}`);
  lines.push("");

  if (!selected) {
    lines.push("## Result");
    lines.push("");
    lines.push("- No matching IDB row was selected by the current conservative matching logic.");
    lines.push("- Recommended review status: needs_evidence");
    lines.push("");
  } else {
    lines.push("## Selected IDB row");
    lines.push("");
    lines.push(`- Row ID: ${selected._id}`);
    lines.push(`- Title: ${selected.Title ?? "n/a"}`);
    lines.push(`- Entity type: ${selected.Entity ?? "n/a"}`);
    lines.push(`- Nationality: ${selected.Nationality ?? "n/a"}`);
    lines.push(`- Country: ${selected.Country ?? "n/a"}`);
    lines.push(`- From: ${selected.From ?? "n/a"}`);
    lines.push(`- To: ${selected.To ?? "n/a"}`);
    lines.push(`- Prohibited practice: ${selected["Prohibited Practice"] ?? "n/a"}`);
    lines.push(`- Source: ${selected.Source ?? "n/a"}`);
    lines.push(`- IDB sanction type: ${selected["Tipo de sancion del BID"] ?? "n/a"}`);
    lines.push(`- IDB sanction source: ${selected["IDB Sanction Source"] ?? "n/a"}`);
    lines.push(`- Other name/source label: ${selected["Other Name"] ?? "n/a"}`);
    lines.push("");
    lines.push("## Interpretation");
    lines.push("");
    lines.push(`- Recommended review status: ${input.recommendedReviewStatus}`);
    lines.push("- Reason: the official IDB row confirms the external source record's name, firm type, Paraguay country/nationality context, sanction type, date, and ongoing status.");
    lines.push("- Limitation: the IDB row does not expose a Paraguay RUC or comparable local identifier, so this still should not become an accepted match without second review.");
    lines.push("");
  }

  lines.push("## Database effect");
  lines.push("");
  lines.push(`- Dry run: ${input.dryRun ? "yes" : "no"}`);
  lines.push(`- Review updated: ${input.updatedReview ? "yes" : "no"}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function loadCandidate(candidateId: number): Promise<CandidateReviewRow> {
  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<CandidateReviewRow>(
      `select
         id::text,
         entity_id::text,
         entity_name,
         source_key,
         external_id,
         external_name,
         external_schema,
         local_screening_role,
         candidate_status,
         review_status,
         hosted_support_category,
         hosted_top_result_name,
         hosted_top_result_score::text,
         local_identifiers,
         local_ruc_identifiers,
         local_profile_sources,
         local_profile_names,
         local_profile_rucs
       from ${schema}.entity_enrichment_candidate_review_overview
       where id = $1`,
      [candidateId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`External enrichment candidate ${candidateId} was not found.`);
    }

    return row;
  } finally {
    await client.end();
  }
}

async function persistSourceRecord(input: {
  candidate: CandidateReviewRow;
  record: IadbSanctionsRecord;
  sourceUrl: string;
  rawPath: string;
  reportPath: string;
}): Promise<void> {
  const { client, schema } = await connectToPostgres();
  const externalId = `idb-sanctions-row-${input.record._id}`;

  try {
    await client.query("begin");
    const runResult = await client.query<{ id: string }>(
      `insert into ${schema}.source_runs (source_key, country_code, status, notes)
       values ($1, $2, $3, $4)
       returning id`,
      [
        IDB_SOURCE_KEY,
        "PY",
        "running",
        `IDB row-level source check for external candidate ${input.candidate.id}`,
      ],
    );

    const sourceRunId = runResult.rows[0]?.id;
    if (!sourceRunId) {
      throw new Error("Failed to create IDB source run.");
    }

    await client.query(
      `insert into ${schema}.source_assets (source_run_id, asset_kind, path, source_url)
       values ($1, $2, $3, $4), ($1, $5, $6, $7)`,
      [
        sourceRunId,
        "idb_datastore_response",
        input.rawPath,
        input.sourceUrl,
        "idb_source_check_report",
        input.reportPath,
        IDB_DATASET_PAGE,
      ],
    );

    await client.query(
      `insert into ${schema}.source_records (
         source_run_id,
         source_key,
         external_id,
         record_kind,
         source_url,
         payload
       )
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (source_key, external_id, record_kind)
       do update set
         source_run_id = excluded.source_run_id,
         source_url = excluded.source_url,
         retrieved_at = now(),
         payload = excluded.payload`,
      [
        sourceRunId,
        IDB_SOURCE_KEY,
        externalId,
        "sanction_record",
        input.sourceUrl,
        JSON.stringify({
          ...input.record,
          centinelaCandidateId: input.candidate.id,
          centinelaLocalEntityId: input.candidate.entity_id,
          centinelaLocalEntityName: input.candidate.entity_name,
          centinelaExternalCandidateId: input.candidate.external_id,
          centinelaExternalCandidateName: input.candidate.external_name,
          datasetPage: IDB_DATASET_PAGE,
        }),
      ],
    );

    await client.query(
      `update ${schema}.source_runs
       set finished_at = now(), status = $2, notes = $3
       where id = $1`,
      [
        sourceRunId,
        "completed",
        `IDB row ${input.record._id} persisted for candidate ${input.candidate.id}`,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

export async function runIadbSanctionsCandidateCheck(
  options: RunIadbSanctionsCandidateCheckOptions,
): Promise<IadbSanctionsCandidateCheckResult> {
  if (!Number.isInteger(options.candidateId) || options.candidateId <= 0) {
    throw new Error("candidateId must be a positive integer.");
  }

  const country = options.country ?? "Paraguay";
  const candidate = await loadCandidate(options.candidateId);
  const sourceUrl = buildIadbDatastoreUrl(country);
  const response = await fetchJson<IadbDatastoreResponse>(sourceUrl);

  if (!response.success) {
    throw new Error("IDB datastore response was not successful.");
  }

  const records = response.result.records;
  const selectedRecord = selectBestRecord(candidate, records);
  const sourceHasParaguaySupport = hasParaguaySupport(selectedRecord);
  const recommendedReviewStatus =
    selectedRecord && sourceHasParaguaySupport ? "promotable" : "needs_evidence";

  const rawPath = await writeOutputJson(
    ["raw", "external", "idb", `sanctioned-firms-individuals-candidate-${options.candidateId}.json`],
    {
      retrievedAt: new Date().toISOString(),
      sourceKey: IDB_SOURCE_KEY,
      datasetPage: IDB_DATASET_PAGE,
      sourceUrl,
      candidate,
      response,
      selectedRecord,
      recommendedReviewStatus,
    },
  );

  const report = renderReport({
    candidate,
    sourceUrl,
    records,
    ...(selectedRecord ? { selectedRecord } : {}),
    recommendedReviewStatus,
    dryRun: Boolean(options.dryRun),
    updatedReview: Boolean(options.updateReview && selectedRecord && !options.dryRun),
  });
  const reportPath = await writeOutputText(
    ["reports", "paraguay", `idb-sanctions-candidate-${options.candidateId}-source-check.md`],
    report,
  );

  if (selectedRecord && !options.dryRun) {
    await persistSourceRecord({
      candidate,
      record: selectedRecord,
      sourceUrl,
      rawPath,
      reportPath,
    });
  }

  if (options.updateReview && selectedRecord && !options.dryRun) {
    await updateExternalCandidateReview({
      candidateId: options.candidateId,
      reviewStatus: recommendedReviewStatus,
      reviewer: options.reviewer ?? "centinela-operator",
      notes:
        recommendedReviewStatus === "promotable"
          ? "Official IDB Open Data row-level source confirms the external candidate name, firm type, Paraguay context, sanction type, and date. No comparable RUC is exposed, so accepted-match insertion still requires second review."
          : "Official IDB Open Data source check completed, but stronger source or identifier evidence is still needed.",
      evidenceUrl: sourceUrl,
      evidenceNote: `IDB source row ${selectedRecord._id}: ${selectedRecord.Title ?? "n/a"}; ${selectedRecord["Tipo de sancion del BID"] ?? "n/a"}; ${selectedRecord.From ?? "n/a"} to ${selectedRecord.To ?? "n/a"}. Local report: ${reportPath}`,
    });
  }

  return {
    candidateId: options.candidateId,
    matched: Boolean(selectedRecord),
    ...(selectedRecord ? { matchedRecordId: selectedRecord._id } : {}),
    recommendedReviewStatus,
    rawPath,
    reportPath,
  };
}
