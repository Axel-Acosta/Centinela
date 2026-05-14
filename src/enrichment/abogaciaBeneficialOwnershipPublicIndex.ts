import { parse } from "csv-parse/sync";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Client } from "pg";
import { resolveOutputPath, writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";

const SOURCE_KEY = "py-abogacia-beneficial-ownership-public-index";
const COUNTRY_CODE = "PY";
const SOURCE_PAGE_URL = "https://datos.abogacia.gov.py/";
const DATASET_CSV_URL = "https://datos.abogacia.gov.py/assets/docs/beneficiario-final-publico.csv";
const DICTIONARY_URL = "https://datos.abogacia.gov.py/assets/json/diccionarioBeneficiarioPublico.json";

interface ConnectorOptions {
  dryRun?: boolean | undefined;
  limit?: number | undefined;
}

interface PublicCompanyRow {
  rucBase: string;
  companyName: string;
  lineNumber: number;
  raw: Record<string, string>;
}

interface LocalCompanyTarget {
  entityId: number;
  canonicalName: string;
  identifierScheme: string;
  identifierValue: string;
  rucBase: string;
  fullRuc: string | null;
}

interface PublicIndexMatch {
  row: PublicCompanyRow;
  target: LocalCompanyTarget;
  matchConfidence: number;
  matchMethod: string;
  reviewStatus: string;
}

interface ConnectorSummary {
  sourceRunId: number | null;
  dryRun: boolean;
  downloadedRowCount: number;
  localTargetCount: number;
  matchedCompanyCount: number;
  unmatchedPublicRowCount: number;
  duplicatePublicRucCount: number;
  rawCsvPath: string;
  rawJsonPath: string;
  reportPath: string;
  sampleMatches: PublicIndexMatch[];
  sampleUnmatchedRows: PublicCompanyRow[];
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeRucBase(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function rucBaseFromIdentifier(value: string): { rucBase: string; fullRuc: string | null } | null {
  const withoutPrefix = value.replace(/^PY-RUC-/i, "");
  const match = withoutPrefix.match(/^(\d+)(?:-(\d))?$/);
  if (!match) {
    return null;
  }

  const base = normalizeRucBase(match[1] ?? "");
  if (!base) {
    return null;
  }

  return {
    rucBase: base,
    fullRuc: match[2] ? `${base}-${match[2]}` : null,
  };
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function decodeSourceText(buffer: Buffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const replacementCharacters = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCharacters === 0) {
    return utf8;
  }

  return new TextDecoder("iso-8859-1").decode(buffer);
}

async function writeRawAsset(relativePath: string[], content: Buffer): Promise<string> {
  const targetPath = resolveOutputPath(...relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
  return targetPath;
}

function parsePublicCompanyCsv(csvText: string): PublicCompanyRow[] {
  const records = parse(csvText, {
    columns: true,
    delimiter: ";",
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Array<Record<string, string>>;

  return records
    .map((row, index) => ({
      rucBase: normalizeRucBase(row.ruc_nro ?? ""),
      companyName: normalizeWhitespace(row.denominacion ?? ""),
      lineNumber: index + 2,
      raw: row,
    }))
    .filter((row) => row.rucBase.length > 0 && row.companyName.length > 0);
}

async function loadLocalCompanyTargets(client: Client, schema: string): Promise<LocalCompanyTarget[]> {
  const result = await client.query<Record<string, unknown>>(
    `select distinct
       entities.id::int as entity_id,
       entities.canonical_name,
       identifiers.scheme,
       identifiers.value
     from ${schema}.entities
     join ${schema}.entity_identifiers as identifiers
       on identifiers.entity_id = entities.id
     where entities.entity_type = 'company'
       and identifiers.scheme in ('PY-RUC', 'PY-RUC-PLAIN')
     order by entity_id`,
  );

  return result.rows.flatMap((row) => {
    const parsed = rucBaseFromIdentifier(String(row.value ?? ""));
    if (!parsed) {
      return [];
    }

    return [
      {
        entityId: Number(row.entity_id),
        canonicalName: String(row.canonical_name ?? ""),
        identifierScheme: String(row.scheme ?? ""),
        identifierValue: String(row.value ?? ""),
        rucBase: parsed.rucBase,
        fullRuc: parsed.fullRuc,
      },
    ];
  });
}

function buildMatches(publicRows: PublicCompanyRow[], targets: LocalCompanyTarget[], limit?: number): {
  matches: PublicIndexMatch[];
  unmatchedRows: PublicCompanyRow[];
  duplicatePublicRucCount: number;
} {
  const targetByRuc = new Map<string, LocalCompanyTarget>();
  for (const target of targets) {
    if (!targetByRuc.has(target.rucBase)) {
      targetByRuc.set(target.rucBase, target);
    }
  }

  const seenPublicRucs = new Set<string>();
  let duplicatePublicRucCount = 0;
  const matches: PublicIndexMatch[] = [];
  const unmatchedRows: PublicCompanyRow[] = [];

  for (const row of publicRows) {
    if (seenPublicRucs.has(row.rucBase)) {
      duplicatePublicRucCount += 1;
    }
    seenPublicRucs.add(row.rucBase);

    const target = targetByRuc.get(row.rucBase);
    if (!target) {
      if (unmatchedRows.length < 50) {
        unmatchedRows.push(row);
      }
      continue;
    }

    if (limit && matches.length >= limit) {
      continue;
    }

    const namesAgree = normalizeName(row.companyName) === normalizeName(target.canonicalName);
    matches.push({
      row,
      target,
      matchConfidence: namesAgree ? 0.94 : 0.88,
      matchMethod: namesAgree ? "ruc_base_and_name_match" : "ruc_base_match_name_review",
      reviewStatus: namesAgree ? "accepted" : "reviewable",
    });
  }

  return { matches, unmatchedRows, duplicatePublicRucCount };
}

async function createSourceRun(
  client: Client,
  schema: string,
  summary: Pick<ConnectorSummary, "downloadedRowCount" | "matchedCompanyCount" | "dryRun">,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [
      SOURCE_KEY,
      COUNTRY_CODE,
      "running",
      `Abogacia beneficial-ownership public company index started: ${summary.downloadedRowCount} public rows, ${summary.matchedCompanyCount} procurement-linked matches, dryRun=${summary.dryRun}.`,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create source run for Abogacia public index.");
  }

  return row.id;
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

async function insertSourceAssets(
  client: Client,
  schema: string,
  sourceRunId: number,
  assets: Array<{ kind: string; path: string; sourceUrl: string; sha256?: string | undefined }>,
): Promise<void> {
  for (const asset of assets) {
    await client.query(
      `insert into ${schema}.source_assets (source_run_id, asset_kind, path, source_url, sha256)
       values ($1, $2, $3, $4, $5)`,
      [sourceRunId, asset.kind, asset.path, asset.sourceUrl, asset.sha256 ?? null],
    );
  }
}

async function clearMatchedEntityState(
  client: Client,
  schema: string,
  matches: PublicIndexMatch[],
): Promise<void> {
  const entityIds = [...new Set(matches.map((match) => match.target.entityId))];
  const rucBases = [...new Set(matches.map((match) => match.row.rucBase))];

  if (entityIds.length === 0) {
    return;
  }

  await client.query(
    `delete from ${schema}.entity_local_profiles
     where source_key = $1
       and profile_kind = 'abogacia_beneficial_ownership_public_company_index'
       and entity_id = any($2::bigint[])`,
    [SOURCE_KEY, entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_source_mentions
     where source_key = $1
       and entity_id = any($2::bigint[])`,
    [SOURCE_KEY, entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_identifiers
     where scheme = 'PY-ABOGACIA-RUC-BASE'
       and entity_id = any($1::bigint[])`,
    [entityIds],
  );
  await client.query(
    `delete from ${schema}.source_records
     where source_key = $1
       and record_kind = 'abogacia_beneficial_ownership_public_company_index'
       and external_id = any($2::text[])`,
    [SOURCE_KEY, rucBases],
  );
}

async function upsertSourceRecords(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: PublicIndexMatch[],
): Promise<void> {
  for (let index = 0; index < matches.length; index += 300) {
    const batch = matches.slice(index, index + 300);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           external_id text,
           payload jsonb
         )
       )
       insert into ${schema}.source_records
         (source_run_id, source_key, external_id, record_kind, source_url, payload)
       select
         $2,
         $3,
         input.external_id,
         'abogacia_beneficial_ownership_public_company_index',
         $4,
         input.payload
       from input
       on conflict (source_key, external_id, record_kind)
       do update
       set
         source_run_id = excluded.source_run_id,
         source_url = excluded.source_url,
         payload = excluded.payload,
         retrieved_at = now()`,
      [
        JSON.stringify(
          batch.map((match) => ({
            external_id: match.row.rucBase,
            payload: {
              rucBase: match.row.rucBase,
              publicCompanyName: match.row.companyName,
              sourceDatasetUrl: DATASET_CSV_URL,
              sourcePageUrl: SOURCE_PAGE_URL,
              lineNumber: match.row.lineNumber,
              localEntityId: match.target.entityId,
              localEntityName: match.target.canonicalName,
              localIdentifierScheme: match.target.identifierScheme,
              localIdentifierValue: match.target.identifierValue,
              matchMethod: match.matchMethod,
              matchConfidence: match.matchConfidence,
              limitations: [
                "This connector uses the public company-level index only; it does not ingest personal beneficial-owner, director, shareholder, address, birth-date, or document-number fields.",
                "RUC base agreement is identity context for review, not an ownership conclusion or wrongdoing signal.",
                "Public reuse still requires privacy, source, methodology, and UX review.",
              ],
            },
          })),
        ),
        sourceRunId,
        SOURCE_KEY,
        DATASET_CSV_URL,
      ],
    );
  }
}

async function upsertLocalProfiles(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: PublicIndexMatch[],
): Promise<void> {
  for (let index = 0; index < matches.length; index += 300) {
    const batch = matches.slice(index, index + 300);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           profile_status text,
           match_method text,
           match_confidence numeric,
           review_status text,
           title text,
           summary text,
           attributes jsonb,
           evidence jsonb
         )
       )
       insert into ${schema}.entity_local_profiles
         (entity_id, source_run_id, source_key, profile_kind, profile_status, match_method, match_confidence, review_status, title, summary, attributes, evidence)
       select
         input.entity_id,
         $2,
         $3,
         'abogacia_beneficial_ownership_public_company_index',
         input.profile_status,
         input.match_method,
         input.match_confidence,
         input.review_status,
         input.title,
         input.summary,
         input.attributes,
         input.evidence
       from input
       on conflict (entity_id, source_key, profile_kind)
       do update
       set
         source_run_id = excluded.source_run_id,
         profile_status = excluded.profile_status,
         match_method = excluded.match_method,
         match_confidence = excluded.match_confidence,
         review_status = excluded.review_status,
         title = excluded.title,
         summary = excluded.summary,
         attributes = excluded.attributes,
         evidence = excluded.evidence,
         last_seen_at = now()`,
      [
        JSON.stringify(
          batch.map((match) => ({
            entity_id: match.target.entityId,
            profile_status: "public_index_observed",
            match_method: match.matchMethod,
            match_confidence: match.matchConfidence,
            review_status: match.reviewStatus,
            title: match.row.companyName,
            summary:
              `Abogacia open-data beneficial-ownership portal lists this company RUC base (${match.row.rucBase}) in the public company index. This is company-level source context, not an ownership conclusion.`,
            attributes: {
              rucBase: match.row.rucBase,
              localFullRuc: match.target.fullRuc,
              publicCompanyName: match.row.companyName,
              localEntityName: match.target.canonicalName,
              lineNumber: match.row.lineNumber,
              sourceDatasetUrl: DATASET_CSV_URL,
              sourcePageUrl: SOURCE_PAGE_URL,
              detailUrl: SOURCE_PAGE_URL,
              personalDataIngestion: "not_ingested_in_this_connector",
            },
            evidence: [
              { type: "source_page", value: SOURCE_PAGE_URL },
              { type: "source_csv", value: DATASET_CSV_URL },
              { type: "source_csv_line", value: String(match.row.lineNumber) },
              { type: "match_logic", value: match.matchMethod },
            ],
          })),
        ),
        sourceRunId,
        SOURCE_KEY,
      ],
    );
  }
}

async function upsertIdentifiersAndMentions(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: PublicIndexMatch[],
): Promise<void> {
  for (let index = 0; index < matches.length; index += 500) {
    const batch = matches.slice(index, index + 500);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(entity_id bigint, ruc_base text)
       )
       insert into ${schema}.entity_identifiers (entity_id, scheme, value, is_primary)
       select input.entity_id, 'PY-ABOGACIA-RUC-BASE', input.ruc_base, false
       from input
       on conflict (scheme, value)
       do update
       set entity_id = excluded.entity_id,
           is_primary = false`,
      [
        JSON.stringify(
          batch.map((match) => ({
            entity_id: match.target.entityId,
            ruc_base: match.row.rucBase,
          })),
        ),
      ],
    );

    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           source_external_id text,
           observed_name text,
           attributes jsonb
         )
       )
       insert into ${schema}.entity_source_mentions
         (entity_id, source_run_id, source_key, role, source_external_id, observed_name, attributes)
       select
         input.entity_id,
         $2,
         $3,
         'beneficial_ownership_public_company_index',
         input.source_external_id,
         input.observed_name,
         input.attributes
       from input
       on conflict (entity_id, source_key, role, source_external_id)
       do update
       set
         source_run_id = excluded.source_run_id,
         observed_name = excluded.observed_name,
         attributes = excluded.attributes,
         last_seen_at = now()`,
      [
        JSON.stringify(
          batch.map((match) => ({
            entity_id: match.target.entityId,
            source_external_id: match.row.rucBase,
            observed_name: match.row.companyName,
            attributes: {
              sourceDatasetUrl: DATASET_CSV_URL,
              sourcePageUrl: SOURCE_PAGE_URL,
              lineNumber: match.row.lineNumber,
              matchMethod: match.matchMethod,
              matchConfidence: match.matchConfidence,
              useLimit: "Company-level public index presence only; no personal beneficial-owner fields ingested.",
            },
          })),
        ),
        sourceRunId,
        SOURCE_KEY,
      ],
    );
  }
}

function buildReport(summary: ConnectorSummary): string {
  const lines: string[] = [];
  lines.push("# Abogacia beneficial-ownership public company index");
  lines.push("");
  lines.push("This report records Centinela's cautious first use of Paraguay's public Abogacia del Tesoro open-data portal for companies linked to beneficial-ownership disclosures.");
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push(`- Dry run: ${summary.dryRun}`);
  lines.push(`- Source run ID: ${summary.sourceRunId ?? "n/a"}`);
  lines.push(`- Public company rows parsed: ${summary.downloadedRowCount}`);
  lines.push(`- Local procurement-linked RUC targets: ${summary.localTargetCount}`);
  lines.push(`- Procurement-linked companies matched by RUC base: ${summary.matchedCompanyCount}`);
  lines.push(`- Sample unmatched public rows retained for diagnostics: ${summary.sampleUnmatchedRows.length}`);
  lines.push(`- Duplicate public RUC bases observed: ${summary.duplicatePublicRucCount}`);
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  lines.push(`- Raw CSV: ${summary.rawCsvPath}`);
  lines.push(`- Raw parsed JSON: ${summary.rawJsonPath}`);
  lines.push(`- Report: ${summary.reportPath}`);
  lines.push("");
  lines.push("## Sample matches");
  lines.push("");
  for (const match of summary.sampleMatches.slice(0, 25)) {
    lines.push(`- Entity ${match.target.entityId}: ${match.target.canonicalName} -> ${match.row.companyName} (RUC base ${match.row.rucBase}; ${match.matchMethod}; confidence ${match.matchConfidence})`);
  }
  if (summary.sampleMatches.length === 0) {
    lines.push("- No matches in this run.");
  }
  lines.push("");
  lines.push("## Methodology and limitations");
  lines.push("");
  lines.push("- This first connector ingests only the company-level public index: `ruc_nro` and `denominacion`.");
  lines.push("- It intentionally does not ingest personal beneficial-owner, shareholder, director, address, birth-date, or document-number fields yet.");
  lines.push("- Matching is by RUC base against already procurement-linked company entities. This is source-backed company/accountability context, not an ownership conclusion.");
  lines.push("- Later director/shareholder/beneficial-owner ingestion must add stronger privacy review, public-copy limits, and person-relationship staging.");
  lines.push("- No output is proof of wrongdoing.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function runAbogaciaBeneficialOwnershipPublicIndex(
  options: ConnectorOptions = {},
): Promise<ConnectorSummary> {
  const csvBuffer = await fetchBuffer(DATASET_CSV_URL);
  const dictionaryBuffer = await fetchBuffer(DICTIONARY_URL);
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rawCsvPath = await writeRawAsset(
    ["raw", "paraguay", "abogacia", `beneficial-ownership-public-index-${runStamp}.csv`],
    csvBuffer,
  );
  const dictionaryPath = await writeRawAsset(
    ["raw", "paraguay", "abogacia", `beneficial-ownership-public-index-dictionary-${runStamp}.json`],
    dictionaryBuffer,
  );
  const csvText = decodeSourceText(csvBuffer);
  const publicRows = parsePublicCompanyCsv(csvText);
  const { client, schema } = await connectToPostgres();
  let sourceRunId: number | null = null;

  try {
    const localTargets = await loadLocalCompanyTargets(client, schema);
    const matchResult = buildMatches(publicRows, localTargets, options.limit);
    const rawJsonPath = await writeOutputJson(
      ["raw", "paraguay", "abogacia", `beneficial-ownership-public-index-matches-${runStamp}.json`],
      {
        sourceKey: SOURCE_KEY,
        sourcePageUrl: SOURCE_PAGE_URL,
        datasetCsvUrl: DATASET_CSV_URL,
        dictionaryUrl: DICTIONARY_URL,
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun === true,
        rowCount: publicRows.length,
        localTargetCount: localTargets.length,
        matchedCompanyCount: matchResult.matches.length,
        matches: matchResult.matches,
        unmatchedSample: matchResult.unmatchedRows,
        limitations: [
          "Company-level public index only.",
          "Personal relationship datasets are discovered but not ingested by this connector.",
          "RUC-base matches are review context, not wrongdoing signals.",
        ],
      },
    );
    const reportPath = resolveOutputPath(
      "reports",
      "paraguay",
      `abogacia-beneficial-ownership-public-index-${runStamp}.md`,
    );
    const summary: ConnectorSummary = {
      sourceRunId: null,
      dryRun: options.dryRun === true,
      downloadedRowCount: publicRows.length,
      localTargetCount: localTargets.length,
      matchedCompanyCount: matchResult.matches.length,
      unmatchedPublicRowCount: Math.max(0, publicRows.length - matchResult.matches.length),
      duplicatePublicRucCount: matchResult.duplicatePublicRucCount,
      rawCsvPath,
      rawJsonPath,
      reportPath,
      sampleMatches: matchResult.matches.slice(0, 25),
      sampleUnmatchedRows: matchResult.unmatchedRows,
    };

    if (options.dryRun !== true) {
      sourceRunId = await createSourceRun(client, schema, summary);
      summary.sourceRunId = sourceRunId;
      await client.query("begin");
      await insertSourceAssets(client, schema, sourceRunId, [
        { kind: "abogacia_beneficial_ownership_public_index_csv", path: rawCsvPath, sourceUrl: DATASET_CSV_URL, sha256: sha256(csvBuffer) },
        { kind: "abogacia_beneficial_ownership_public_index_dictionary", path: dictionaryPath, sourceUrl: DICTIONARY_URL, sha256: sha256(dictionaryBuffer) },
        { kind: "abogacia_beneficial_ownership_public_index_matches", path: rawJsonPath, sourceUrl: DATASET_CSV_URL },
      ]);
      await clearMatchedEntityState(client, schema, matchResult.matches);
      await upsertSourceRecords(client, schema, sourceRunId, matchResult.matches);
      await upsertLocalProfiles(client, schema, sourceRunId, matchResult.matches);
      await upsertIdentifiersAndMentions(client, schema, sourceRunId, matchResult.matches);
      await client.query("commit");
      await finalizeSourceRun(
        client,
        schema,
        sourceRunId,
        "completed",
        `Abogacia public company index completed: ${matchResult.matches.length} procurement-linked company matches from ${publicRows.length} public rows.`,
      );
    }

    await writeOutputText(
      ["reports", "paraguay", `abogacia-beneficial-ownership-public-index-${runStamp}.md`],
      buildReport(summary),
    );
    return summary;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original failure.
    }

    if (sourceRunId !== null) {
      await finalizeSourceRun(
        client,
        schema,
        sourceRunId,
        "failed",
        error instanceof Error ? error.message.slice(0, 500) : "Abogacia public index connector failed.",
      );
    }

    throw error;
  } finally {
    await client.end();
  }
}
