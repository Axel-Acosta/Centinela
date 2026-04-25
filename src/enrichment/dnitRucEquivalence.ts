import fs from "node:fs/promises";
import path from "node:path";
import unzipper from "unzipper";
import type { Client } from "pg";
import { outputRoot } from "../config";
import { ensureDir } from "../lib/fs";
import { downloadToFile } from "../lib/http";
import { writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";

const DNIT_RUC_SOURCE_KEY = "py-dnit-ruc-equivalence";
const DNIT_BASE_URL = "https://www.dnit.gov.py";
const DNIT_RUC_PAGE_URL = `${DNIT_BASE_URL}/web/portal-institucional/listado-de-ruc-con-sus-equivalencias`;
const DEFAULT_LIMIT = 10_000;
const DEFAULT_PUBLICATION_DATE = "2026-04-01";

interface LocalSupplierIdentityRow {
  entity_id: string;
  canonical_name: string;
  identifier_refs: string[] | null;
  total_process_count: string;
  supplier_process_count: string;
  total_risk_signals: string;
  anchor_status: string | null;
  review_lane: string | null;
}

interface ParsedRuc {
  base: string;
  checkDigit: string | null;
  full: string;
}

interface LocalSupplierIdentityTarget {
  entityId: number;
  canonicalName: string;
  identifierRefs: string[];
  totalProcessCount: number;
  supplierProcessCount: number;
  totalRiskSignals: number;
  anchorStatus: string;
  reviewLane: string;
  procurementRuc: string;
  rucBase: string;
  checkDigit: string | null;
  fullRuc: string;
}

interface DnitZipResource {
  digit: string;
  fileName: string;
  url: string;
  localPath: string;
}

interface DnitRucRow {
  rucBase: string;
  officialName: string;
  checkDigit: string;
  equivalenceCode: string | null;
  taxpayerStatus: string;
  sourceZipName: string;
  sourceUrl: string;
  lineNumber: number;
  rawLine: string;
}

interface DnitRucMatch {
  target: LocalSupplierIdentityTarget;
  row: DnitRucRow;
  matchMethod: string;
  matchConfidence: number;
  reviewStatus: "accepted" | "unreviewed";
}

interface DnitRucUnmatched {
  entityId: number;
  entityName: string;
  procurementRuc: string;
  reason: string;
  dnitCheckDigit?: string;
}

interface SourceAssetInput {
  assetKind: string;
  path?: string;
  sourceUrl?: string;
}

interface SourceRecordInput {
  externalId: string;
  recordKind: string;
  sourceUrl?: string;
  payload: unknown;
}

interface RunDnitRucEquivalenceOptions {
  limit: number;
  offset: number;
  onlyAnchorGaps: boolean;
  refreshRaw: boolean;
}

interface ConnectorSummary {
  sourceKey: string;
  fetchedAt: string;
  sourcePageUrl: string;
  publicationDate: string;
  availableCompanyCount: number;
  eligibleCompanyCount: number;
  screenedCompanyCount: number;
  rucTargetCount: number;
  selectionOffset: number;
  onlyAnchorGaps: boolean;
  matchedCompanyCount: number;
  unmatchedCompanyCount: number;
  acceptedMatchCount: number;
  unreviewedMatchCount: number;
  anchorGapMatches: number;
  statusCounts: Record<string, number>;
  zipResourceCount: number;
  zipResources: Array<{
    digit: string;
    fileName: string;
    url: string;
    localPath: string;
  }>;
  matchedCompanies: Array<{
    entityId: number;
    entityName: string;
    procurementRuc: string;
    officialName: string;
    taxpayerStatus: string;
    equivalenceCode: string | null;
    anchorStatusBeforeRun: string;
    matchMethod: string;
    matchConfidence: number;
    sourceZipName: string;
    lineNumber: number;
  }>;
  unmatchedCompanies: DnitRucUnmatched[];
}

function toNumber(value: string | null | undefined): number {
  return Number(value ?? 0);
}

function normalizeBlank(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRuc(value: string): ParsedRuc | null {
  const trimmed = value
    .replace(/^PY-RUC-/i, "")
    .replace(/^RUC-/i, "")
    .trim();
  const match = trimmed.match(/^(\d{4,12})(?:-(\d))?$/);

  if (!match?.[1]) {
    return null;
  }

  const base = match[1];
  const checkDigit = match[2] ?? null;

  return {
    base,
    checkDigit,
    full: checkDigit ? `${base}-${checkDigit}` : base,
  };
}

function extractRucFromIdentifierRefs(identifierRefs: string[]): ParsedRuc | null {
  for (const ref of identifierRefs) {
    const separatorIndex = ref.indexOf(":");
    const scheme = separatorIndex >= 0 ? ref.slice(0, separatorIndex) : "";
    const value = separatorIndex >= 0 ? ref.slice(separatorIndex + 1) : ref;

    if (!scheme.toUpperCase().includes("RUC") && !value.toUpperCase().startsWith("PY-RUC-")) {
      continue;
    }

    const parsed = parseRuc(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function rucSplitDigit(rucBase: string): string | null {
  const digit = rucBase.at(-1);
  return digit && /^\d$/.test(digit) ? digit : null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/");
}

async function fetchDnitPage(): Promise<string> {
  const response = await fetch(DNIT_RUC_PAGE_URL, {
    headers: {
      "user-agent": "Centinela/0.1 (+https://github.com/local/centinela)",
      accept: "text/html,application/xhtml+xml,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`DNIT RUC equivalence page request failed (${response.status})`);
  }

  return response.text();
}

function extractPublicationDate(pageHtml: string): string {
  const match = pageHtml.match(/actualizado\s+al\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!match?.[1] || !match[2] || !match[3]) {
    return DEFAULT_PUBLICATION_DATE;
  }

  return `${match[3]}-${match[2]}-${match[1]}`;
}

async function discoverZipResources(pageHtml: string, publicationDate: string): Promise<DnitZipResource[]> {
  const resourceMap = new Map<string, DnitZipResource>();
  const pattern = /href="([^"]*\/ruc([0-9])\.zip\/[^"]*)"/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(pageHtml)) !== null) {
    const href = match[1];
    const digit = match[2];
    if (!href || !digit) {
      continue;
    }

    const url = new URL(decodeHtmlEntities(href), DNIT_BASE_URL).toString();
    const fileName = `ruc${digit}.zip`;
    const localPath = path.join(
      outputRoot,
      "raw",
      "paraguay",
      "dnit",
      "ruc-equivalence",
      publicationDate,
      fileName,
    );

    resourceMap.set(digit, {
      digit,
      fileName,
      url,
      localPath,
    });
  }

  const resources = [...resourceMap.values()].sort((left, right) => left.digit.localeCompare(right.digit));
  if (resources.length === 0) {
    throw new Error("No DNIT RUC ZIP resources were found on the official page.");
  }

  return resources;
}

async function ensureZipResource(resource: DnitZipResource, refreshRaw: boolean): Promise<void> {
  await ensureDir(path.dirname(resource.localPath));

  if (!refreshRaw) {
    try {
      await fs.access(resource.localPath);
      return;
    } catch {
      // Missing raw file; download below.
    }
  }

  await downloadToFile(resource.url, resource.localPath);
}

function parseDnitLine(
  line: string,
  lineNumber: number,
  resource: DnitZipResource,
): DnitRucRow | null {
  const columns = line.split("|");
  const rucBase = columns[0]?.trim() ?? "";
  const officialName = columns[1]?.trim() ?? "";
  const checkDigit = columns[2]?.trim() ?? "";
  const equivalenceCode = normalizeBlank(columns[3]);
  const taxpayerStatus = columns[4]?.trim() ?? "";

  if (!rucBase || !officialName || !checkDigit || !taxpayerStatus) {
    return null;
  }

  return {
    rucBase,
    officialName,
    checkDigit,
    equivalenceCode,
    taxpayerStatus,
    sourceZipName: resource.fileName,
    sourceUrl: resource.url,
    lineNumber,
    rawLine: line,
  };
}

async function readZipRowsForTargets(
  resource: DnitZipResource,
  targetRucBases: Set<string>,
): Promise<Map<string, DnitRucRow>> {
  const directory = await unzipper.Open.file(resource.localPath);
  const entry = directory.files.find((file) => file.path.toLowerCase().endsWith(".txt"));

  if (!entry) {
    throw new Error(`No TXT entry found in ${resource.localPath}`);
  }

  const buffer = await entry.buffer();
  const text = buffer.toString("utf8");
  const rows = new Map<string, DnitRucRow>();

  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trim().length === 0) {
      return;
    }

    const parsed = parseDnitLine(line, index + 1, resource);
    if (parsed && targetRucBases.has(parsed.rucBase) && !rows.has(parsed.rucBase)) {
      rows.set(parsed.rucBase, parsed);
    }
  });

  return rows;
}

async function queryLocalSupplierTargets(
  client: Client,
  schema: string,
  options: RunDnitRucEquivalenceOptions,
): Promise<{
  availableCount: number;
  eligibleCount: number;
  screenedCompanyCount: number;
  targets: LocalSupplierIdentityTarget[];
}> {
  const availableResult = await client.query<{ total: string }>(
    `select count(*)::text as total
     from ${schema}.entity_procurement_activity as activity
     where activity.entity_type = 'company'
       and activity.supplier_process_count > 0`,
  );
  const eligibleResult = await client.query<{ total: string }>(
    `select count(*)::text as total
     from ${schema}.entity_procurement_activity as activity
     left join ${schema}.entity_intelligence_review_queue as queue
       on queue.entity_id = activity.entity_id
     where activity.entity_type = 'company'
       and activity.supplier_process_count > 0
       and (
         $1::boolean = false
         or coalesce(queue.anchor_status, 'unanchored') = 'unanchored'
       )`,
    [options.onlyAnchorGaps],
  );

  const entityResult = await client.query<LocalSupplierIdentityRow>(
    `select
       activity.entity_id::text,
       activity.entity_name as canonical_name,
       array_remove(
         array_agg(
           distinct case
             when identifiers.value is not null then identifiers.scheme || ':' || identifiers.value
             else null
           end
         ),
         null
       ) as identifier_refs,
       activity.total_process_count::text,
       activity.supplier_process_count::text,
       activity.total_risk_signals::text,
       queue.anchor_status,
       queue.review_lane
     from ${schema}.entity_procurement_activity as activity
     left join ${schema}.entity_identifiers as identifiers
       on identifiers.entity_id = activity.entity_id
     left join ${schema}.entity_intelligence_review_queue as queue
       on queue.entity_id = activity.entity_id
     where activity.entity_type = 'company'
       and activity.supplier_process_count > 0
       and (
         $1::boolean = false
         or coalesce(queue.anchor_status, 'unanchored') = 'unanchored'
       )
     group by
       activity.entity_id,
       activity.entity_name,
       activity.total_process_count,
       activity.supplier_process_count,
       activity.total_risk_signals,
       queue.anchor_status,
       queue.review_lane
     order by
       case when coalesce(queue.anchor_status, 'unanchored') = 'unanchored' then 0 else 1 end,
       activity.total_risk_signals desc,
       activity.total_process_count desc,
       activity.entity_name
     limit $2
     offset $3`,
    [options.onlyAnchorGaps, options.limit, options.offset],
  );

  const targets = entityResult.rows
    .map((row) => {
      const identifierRefs = row.identifier_refs ?? [];
      const parsedRuc = extractRucFromIdentifierRefs(identifierRefs);

      if (!parsedRuc) {
        return null;
      }

      return {
        entityId: Number(row.entity_id),
        canonicalName: row.canonical_name,
        identifierRefs,
        totalProcessCount: toNumber(row.total_process_count),
        supplierProcessCount: toNumber(row.supplier_process_count),
        totalRiskSignals: toNumber(row.total_risk_signals),
        anchorStatus: row.anchor_status ?? "unanchored",
        reviewLane: row.review_lane ?? "entity_triage",
        procurementRuc: parsedRuc.full,
        rucBase: parsedRuc.base,
        checkDigit: parsedRuc.checkDigit,
        fullRuc: parsedRuc.full,
      };
    })
    .filter((target): target is LocalSupplierIdentityTarget => Boolean(target));

  return {
    availableCount: toNumber(availableResult.rows[0]?.total),
    eligibleCount: toNumber(eligibleResult.rows[0]?.total),
    screenedCompanyCount: entityResult.rows.length,
    targets,
  };
}

function matchTargets(
  targets: LocalSupplierIdentityTarget[],
  rowsByRucBase: Map<string, DnitRucRow>,
): { matches: DnitRucMatch[]; unmatched: DnitRucUnmatched[] } {
  const matches: DnitRucMatch[] = [];
  const unmatched: DnitRucUnmatched[] = [];

  for (const target of targets) {
    const row = rowsByRucBase.get(target.rucBase);

    if (!row) {
      unmatched.push({
        entityId: target.entityId,
        entityName: target.canonicalName,
        procurementRuc: target.procurementRuc,
        reason: "no_dnit_bulk_row_for_ruc_base",
      });
      continue;
    }

    if (target.checkDigit && row.checkDigit !== target.checkDigit) {
      unmatched.push({
        entityId: target.entityId,
        entityName: target.canonicalName,
        procurementRuc: target.procurementRuc,
        reason: "ruc_check_digit_mismatch",
        dnitCheckDigit: row.checkDigit,
      });
      continue;
    }

    matches.push({
      target,
      row,
      matchMethod: target.checkDigit
        ? "ruc_base_and_check_digit_exact"
        : "ruc_base_exact_check_digit_missing_in_procurement_identifier",
      matchConfidence: target.checkDigit ? 0.99 : 0.92,
      reviewStatus: target.checkDigit ? "accepted" : "unreviewed",
    });
  }

  return { matches, unmatched };
}

function buildStatusCounts(matches: DnitRucMatch[]): Record<string, number> {
  return matches.reduce<Record<string, number>>((accumulator, match) => {
    const key = match.row.taxpayerStatus.toUpperCase();
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function buildOutputStem(summary: ConnectorSummary): string {
  const scope = summary.onlyAnchorGaps ? "anchor-gaps" : "supplier-universe";
  return `dnit-ruc-equivalence-${scope}`;
}

function renderReport(summary: ConnectorSummary): string {
  const lines: string[] = [];
  lines.push("# DNIT RUC equivalence identity anchor");
  lines.push("");
  lines.push("This report contains identity-validation signals and investigation leads, not proof of wrongdoing.");
  lines.push("");
  lines.push("## Source and scope");
  lines.push("");
  lines.push(`- Source key: ${summary.sourceKey}`);
  lines.push(`- Official DNIT source page: ${summary.sourcePageUrl}`);
  lines.push(`- DNIT publication date observed on source page: ${summary.publicationDate}`);
  lines.push(`- Scope: ${summary.onlyAnchorGaps ? "currently unanchored procurement-linked supplier companies" : "procurement-linked supplier companies"}`);
  lines.push(`- Available supplier companies in Centinela: ${summary.availableCompanyCount}`);
  lines.push(`- Eligible companies for this run: ${summary.eligibleCompanyCount}`);
  lines.push(`- Companies screened in this run: ${summary.screenedCompanyCount}`);
  lines.push(`- Companies with a usable RUC target: ${summary.rucTargetCount}`);
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push(`- DNIT ZIP resources discovered: ${summary.zipResourceCount}`);
  lines.push(`- Matched companies: ${summary.matchedCompanyCount}`);
  lines.push(`- Unmatched companies: ${summary.unmatchedCompanyCount}`);
  lines.push(`- Accepted exact RUC/check-digit matches: ${summary.acceptedMatchCount}`);
  lines.push(`- Matches requiring analyst review: ${summary.unreviewedMatchCount}`);
  lines.push(`- Previously unanchored companies resolved by this source: ${summary.anchorGapMatches}`);
  lines.push("");
  lines.push("## Taxpayer status distribution");
  lines.push("");
  const statuses = Object.entries(summary.statusCounts).sort((left, right) => right[1] - left[1]);
  if (statuses.length === 0) {
    lines.push("- n/a");
  } else {
    for (const [status, count] of statuses) {
      lines.push(`- ${status}: ${count}`);
    }
  }
  lines.push("");
  lines.push("## Highest-value matches for review");
  lines.push("");
  if (summary.matchedCompanies.length === 0) {
    lines.push("- No matches were stored in this run.");
  } else {
    for (const match of summary.matchedCompanies.slice(0, 25)) {
      lines.push(`### ${match.entityName}`);
      lines.push(`- Procurement RUC: ${match.procurementRuc}`);
      lines.push(`- Official DNIT name: ${match.officialName}`);
      lines.push(`- Taxpayer status: ${match.taxpayerStatus}`);
      lines.push(`- Equivalence code: ${match.equivalenceCode ?? "n/a"}`);
      lines.push(`- Prior anchor status: ${match.anchorStatusBeforeRun}`);
      lines.push(`- Match method: ${match.matchMethod}`);
      lines.push(`- Match confidence: ${match.matchConfidence}`);
      lines.push(`- Source file / line: ${match.sourceZipName}:${match.lineNumber}`);
      lines.push("");
    }
  }
  lines.push("## Unmatched or unresolved");
  lines.push("");
  if (summary.unmatchedCompanies.length === 0) {
    lines.push("- No unresolved RUC targets in this run.");
  } else {
    for (const item of summary.unmatchedCompanies.slice(0, 50)) {
      lines.push(`- ${item.entityName}: ${item.procurementRuc} (${item.reason}${item.dnitCheckDigit ? `; DNIT check digit ${item.dnitCheckDigit}` : ""})`);
    }
  }
  lines.push("");
  lines.push("## Methodology and limitations");
  lines.push("");
  lines.push("- Centinela stores DNIT rows only when they match entities already observed in loaded procurement data; this avoids mirroring the full taxpayer list.");
  lines.push("- Accepted matches require exact RUC base and check digit agreement. Base-only matches are retained as reviewable identity-validation leads, not final assertions.");
  lines.push("- The fourth DNIT column is treated cautiously as an equivalence code because the official page describes the files as RUC equivalences; Centinela does not infer ownership, control, or misconduct from it.");
  lines.push("- Taxpayer status is an administrative identity attribute. It is not a corruption-risk finding by itself.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function createSourceRun(
  client: Client,
  schema: string,
  summary: Pick<ConnectorSummary, "screenedCompanyCount" | "matchedCompanyCount" | "onlyAnchorGaps">,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [
      DNIT_RUC_SOURCE_KEY,
      "PY",
      "running",
      `DNIT RUC equivalence identity anchor started for ${summary.screenedCompanyCount} procurement-linked supplier companies (onlyAnchorGaps=${summary.onlyAnchorGaps}, matched=${summary.matchedCompanyCount}).`,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create source run for DNIT RUC equivalence.");
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

async function clearSelectedEntityState(
  client: Client,
  schema: string,
  targets: LocalSupplierIdentityTarget[],
): Promise<void> {
  const entityIds = [...new Set(targets.map((target) => target.entityId))];
  const fullRucs = [...new Set(targets.map((target) => target.fullRuc))];

  if (entityIds.length === 0) {
    return;
  }

  await client.query(
    `delete from ${schema}.entity_local_profiles
     where source_key = $1
       and profile_kind = 'dnit_ruc_equivalence'
       and entity_id = any($2::bigint[])`,
    [DNIT_RUC_SOURCE_KEY, entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_identifiers
     where entity_id = any($1::bigint[])
       and scheme = 'DNIT-RUC-EQUIVALENCE'`,
    [entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_source_mentions
     where source_key = $1
       and entity_id = any($2::bigint[])`,
    [DNIT_RUC_SOURCE_KEY, entityIds],
  );
  await client.query(
    `delete from ${schema}.source_records
     where source_key = $1
       and record_kind = 'dnit_ruc_equivalence'
       and external_id = any($2::text[])`,
    [DNIT_RUC_SOURCE_KEY, fullRucs],
  );
}

async function upsertSourceAssets(
  client: Client,
  schema: string,
  sourceRunId: number,
  assets: SourceAssetInput[],
): Promise<void> {
  for (const asset of assets) {
    await client.query(
      `insert into ${schema}.source_assets (source_run_id, asset_kind, path, source_url)
       values ($1, $2, $3, $4)`,
      [sourceRunId, asset.assetKind, asset.path ?? null, asset.sourceUrl ?? null],
    );
  }
}

async function upsertSourceRecords(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: DnitRucMatch[],
): Promise<void> {
  const records: SourceRecordInput[] = matches.map((match) => ({
    externalId: `${match.row.rucBase}-${match.row.checkDigit}`,
    recordKind: "dnit_ruc_equivalence",
    sourceUrl: match.row.sourceUrl,
    payload: {
      rucBase: match.row.rucBase,
      checkDigit: match.row.checkDigit,
      ruc: `${match.row.rucBase}-${match.row.checkDigit}`,
      officialName: match.row.officialName,
      equivalenceCode: match.row.equivalenceCode,
      taxpayerStatus: match.row.taxpayerStatus,
      sourceZipName: match.row.sourceZipName,
      lineNumber: match.row.lineNumber,
      sourcePageUrl: DNIT_RUC_PAGE_URL,
      rawLine: match.row.rawLine,
    },
  }));

  if (records.length === 0) {
    return;
  }

  for (let index = 0; index < records.length; index += 300) {
    const batch = records.slice(index, index + 300);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           external_id text,
           record_kind text,
           source_url text,
           payload jsonb
         )
       )
       insert into ${schema}.source_records
         (source_run_id, source_key, external_id, record_kind, source_url, payload)
       select
         $2,
         $3,
         input.external_id,
         input.record_kind,
         input.source_url,
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
          batch.map((record) => ({
            external_id: record.externalId,
            record_kind: record.recordKind,
            source_url: record.sourceUrl ?? null,
            payload: record.payload,
          })),
        ),
        sourceRunId,
        DNIT_RUC_SOURCE_KEY,
      ],
    );
  }
}

async function insertLocalProfiles(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: DnitRucMatch[],
  publicationDate: string,
): Promise<void> {
  if (matches.length === 0) {
    return;
  }

  for (let index = 0; index < matches.length; index += 300) {
    const batch = matches.slice(index, index + 300);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           source_run_id bigint,
           source_key text,
           profile_kind text,
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
         (
           entity_id,
           source_run_id,
           source_key,
           profile_kind,
           profile_status,
           match_method,
           match_confidence,
           review_status,
           title,
           summary,
           attributes,
           evidence
         )
       select
         input.entity_id,
         input.source_run_id,
         input.source_key,
         input.profile_kind,
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
          batch.map((match) => {
            const fullRuc = `${match.row.rucBase}-${match.row.checkDigit}`;

            return {
              entity_id: match.target.entityId,
              source_run_id: sourceRunId,
              source_key: DNIT_RUC_SOURCE_KEY,
              profile_kind: "dnit_ruc_equivalence",
              profile_status: "official_match",
              match_method: match.matchMethod,
              match_confidence: match.matchConfidence,
              review_status: match.reviewStatus,
              title: match.row.officialName,
              summary: `DNIT RUC equivalence bulk-list match for RUC ${fullRuc}; taxpayer status reported as ${match.row.taxpayerStatus}.`,
              attributes: {
                officialName: match.row.officialName,
                ruc: fullRuc,
                rucBase: match.row.rucBase,
                checkDigit: match.row.checkDigit,
                registryIdentifier: match.row.equivalenceCode,
                registryIdentifierScheme: match.row.equivalenceCode ? "DNIT-RUC-EQUIVALENCE" : null,
                taxpayerStatus: match.row.taxpayerStatus,
                sourcePageUrl: DNIT_RUC_PAGE_URL,
                detailUrl: DNIT_RUC_PAGE_URL,
                sourceZipName: match.row.sourceZipName,
                sourceUrl: match.row.sourceUrl,
                lineNumber: match.row.lineNumber,
                publicationDate,
                localProcurementName: match.target.canonicalName,
                localProcurementRuc: match.target.procurementRuc,
              },
              evidence: [
                { type: "source_page", value: DNIT_RUC_PAGE_URL },
                { type: "source_zip", value: match.row.sourceUrl },
                { type: "source_zip_line", value: `${match.row.sourceZipName}:${match.row.lineNumber}` },
                { type: "match_logic", value: match.matchMethod },
              ],
            };
          }),
        ),
      ],
    );
  }
}

async function insertLocalIdentifiers(
  client: Client,
  schema: string,
  matches: DnitRucMatch[],
): Promise<void> {
  const rows = matches.flatMap((match) => {
    const fullRuc = `${match.row.rucBase}-${match.row.checkDigit}`;
    const identifiers = [
      {
        entity_id: match.target.entityId,
        scheme: "PY-RUC-PLAIN",
        value: fullRuc,
        is_primary: true,
      },
      match.row.equivalenceCode
        ? {
            entity_id: match.target.entityId,
            scheme: "DNIT-RUC-EQUIVALENCE",
            value: match.row.equivalenceCode,
            is_primary: false,
          }
        : null,
    ];

    return identifiers.filter(
      (identifier): identifier is { entity_id: number; scheme: string; value: string; is_primary: boolean } =>
        Boolean(identifier),
    );
  });

  if (rows.length === 0) {
    return;
  }

  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(entity_id bigint, scheme text, value text, is_primary boolean)
       )
       insert into ${schema}.entity_identifiers (entity_id, scheme, value, is_primary)
       select input.entity_id, input.scheme, input.value, input.is_primary
       from input
       on conflict (scheme, value)
       do update
       set
         entity_id = excluded.entity_id,
         is_primary = excluded.is_primary`,
      [JSON.stringify(batch)],
    );
  }
}

async function insertLocalSourceMentions(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: DnitRucMatch[],
  publicationDate: string,
): Promise<void> {
  if (matches.length === 0) {
    return;
  }

  for (let index = 0; index < matches.length; index += 300) {
    const batch = matches.slice(index, index + 300);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           source_run_id bigint,
           source_key text,
           role text,
           source_external_id text,
           observed_name text,
           attributes jsonb
         )
       )
       insert into ${schema}.entity_source_mentions
         (entity_id, source_run_id, source_key, role, source_external_id, observed_name, attributes)
       select
         input.entity_id,
         input.source_run_id,
         input.source_key,
         input.role,
         input.source_external_id,
         input.observed_name,
         input.attributes
       from input
       on conflict (entity_id, source_key, role, source_external_id)
       do update
       set
         source_run_id = excluded.source_run_id,
         observed_name = excluded.observed_name,
         last_seen_at = now(),
         attributes = excluded.attributes`,
      [
        JSON.stringify(
          batch.map((match) => {
            const fullRuc = `${match.row.rucBase}-${match.row.checkDigit}`;

            return {
              entity_id: match.target.entityId,
              source_run_id: sourceRunId,
              source_key: DNIT_RUC_SOURCE_KEY,
              role: "taxpayer_registry",
              source_external_id: fullRuc,
              observed_name: match.row.officialName,
              attributes: {
                ruc: fullRuc,
                taxpayerStatus: match.row.taxpayerStatus,
                equivalenceCode: match.row.equivalenceCode,
                sourcePageUrl: DNIT_RUC_PAGE_URL,
                sourceZipName: match.row.sourceZipName,
                sourceUrl: match.row.sourceUrl,
                lineNumber: match.row.lineNumber,
                publicationDate,
              },
            };
          }),
        ),
      ],
    );
  }
}

export async function runDnitRucEquivalence(
  options: Partial<RunDnitRucEquivalenceOptions> = {},
): Promise<{ reportPath: string; summaryPath: string; rawManifestPath: string }> {
  const runOptions: RunDnitRucEquivalenceOptions = {
    limit: options.limit ?? DEFAULT_LIMIT,
    offset: options.offset ?? 0,
    onlyAnchorGaps: options.onlyAnchorGaps ?? false,
    refreshRaw: options.refreshRaw ?? false,
  };

  const { client: selectionClient, schema } = await connectToPostgres();

  try {
    const { availableCount, eligibleCount, screenedCompanyCount, targets } = await queryLocalSupplierTargets(
      selectionClient,
      schema,
      runOptions,
    );
    await selectionClient.end();

    const pageHtml = await fetchDnitPage();
    const publicationDate = extractPublicationDate(pageHtml);
    const resources = await discoverZipResources(pageHtml, publicationDate);
    const targetBasesByDigit = new Map<string, Set<string>>();

    for (const target of targets) {
      const digit = rucSplitDigit(target.rucBase);
      if (!digit) {
        continue;
      }

      const existing = targetBasesByDigit.get(digit) ?? new Set<string>();
      existing.add(target.rucBase);
      targetBasesByDigit.set(digit, existing);
    }

    const rowsByRucBase = new Map<string, DnitRucRow>();
    for (const resource of resources) {
      const targetBases = targetBasesByDigit.get(resource.digit);
      if (!targetBases || targetBases.size === 0) {
        continue;
      }

      await ensureZipResource(resource, runOptions.refreshRaw);
      const rows = await readZipRowsForTargets(resource, targetBases);
      for (const [rucBase, row] of rows.entries()) {
        rowsByRucBase.set(rucBase, row);
      }
    }

    const { matches, unmatched } = matchTargets(targets, rowsByRucBase);
    const summary: ConnectorSummary = {
      sourceKey: DNIT_RUC_SOURCE_KEY,
      fetchedAt: new Date().toISOString(),
      sourcePageUrl: DNIT_RUC_PAGE_URL,
      publicationDate,
      availableCompanyCount: availableCount,
      eligibleCompanyCount: eligibleCount,
      screenedCompanyCount,
      rucTargetCount: targets.length,
      selectionOffset: runOptions.offset,
      onlyAnchorGaps: runOptions.onlyAnchorGaps,
      matchedCompanyCount: matches.length,
      unmatchedCompanyCount: unmatched.length,
      acceptedMatchCount: matches.filter((match) => match.reviewStatus === "accepted").length,
      unreviewedMatchCount: matches.filter((match) => match.reviewStatus === "unreviewed").length,
      anchorGapMatches: matches.filter((match) => match.target.anchorStatus === "unanchored").length,
      statusCounts: buildStatusCounts(matches),
      zipResourceCount: resources.length,
      zipResources: resources.map((resource) => ({
        digit: resource.digit,
        fileName: resource.fileName,
        url: resource.url,
        localPath: resource.localPath,
      })),
      matchedCompanies: matches
        .map((match) => ({
          entityId: match.target.entityId,
          entityName: match.target.canonicalName,
          procurementRuc: match.target.procurementRuc,
          officialName: match.row.officialName,
          taxpayerStatus: match.row.taxpayerStatus,
          equivalenceCode: match.row.equivalenceCode,
          anchorStatusBeforeRun: match.target.anchorStatus,
          matchMethod: match.matchMethod,
          matchConfidence: match.matchConfidence,
          sourceZipName: match.row.sourceZipName,
          lineNumber: match.row.lineNumber,
        }))
        .sort((left, right) => {
          const leftAnchor = left.anchorStatusBeforeRun === "unanchored" ? 1 : 0;
          const rightAnchor = right.anchorStatusBeforeRun === "unanchored" ? 1 : 0;
          return rightAnchor - leftAnchor || left.entityName.localeCompare(right.entityName);
        })
        .slice(0, 100),
      unmatchedCompanies: unmatched,
    };

    const outputStem = buildOutputStem(summary);
    const rawManifestPath = await writeOutputJson(["raw", "paraguay", "dnit", `${outputStem}-manifest.json`], {
      retrievedAt: summary.fetchedAt,
      sourceKey: DNIT_RUC_SOURCE_KEY,
      sourcePageUrl: DNIT_RUC_PAGE_URL,
      publicationDate,
      resources: summary.zipResources,
      screenedCompanyCount,
      rucTargetCount: targets.length,
      matches: matches.map((match) => ({
        entityId: match.target.entityId,
        entityName: match.target.canonicalName,
        procurementRuc: match.target.procurementRuc,
        officialName: match.row.officialName,
        taxpayerStatus: match.row.taxpayerStatus,
        equivalenceCode: match.row.equivalenceCode,
        sourceZipName: match.row.sourceZipName,
        lineNumber: match.row.lineNumber,
        matchMethod: match.matchMethod,
        matchConfidence: match.matchConfidence,
      })),
      unmatched,
    });
    const summaryPath = await writeOutputJson(["normalized", "paraguay", `${outputStem}.json`], {
      summary,
      matches: matches.map((match) => ({
        entityId: match.target.entityId,
        entityName: match.target.canonicalName,
        procurementRuc: match.target.procurementRuc,
        identifiers: match.target.identifierRefs,
        totalProcessCount: match.target.totalProcessCount,
        supplierProcessCount: match.target.supplierProcessCount,
        totalRiskSignals: match.target.totalRiskSignals,
        anchorStatusBeforeRun: match.target.anchorStatus,
        reviewLaneBeforeRun: match.target.reviewLane,
        row: match.row,
        matchMethod: match.matchMethod,
        matchConfidence: match.matchConfidence,
        reviewStatus: match.reviewStatus,
      })),
      unmatched,
    });
    const reportPath = await writeOutputText(["reports", "paraguay", `${outputStem}.md`], renderReport(summary));

    const { client: writeClient } = await connectToPostgres();
    let sourceRunId: number | undefined;

    try {
      sourceRunId = await createSourceRun(writeClient, schema, summary);
      await writeClient.query("begin");
      await clearSelectedEntityState(writeClient, schema, targets);
      await upsertSourceAssets(writeClient, schema, sourceRunId, [
        { assetKind: "raw_manifest", path: rawManifestPath },
        { assetKind: "normalized_bundle", path: summaryPath },
        { assetKind: "report", path: reportPath },
        { assetKind: "source_reference", sourceUrl: DNIT_RUC_PAGE_URL },
        ...resources.map<SourceAssetInput>((resource) => ({
          assetKind: "source_reference",
          path: resource.localPath,
          sourceUrl: resource.url,
        })),
      ]);
      await upsertSourceRecords(writeClient, schema, sourceRunId, matches);
      await insertLocalProfiles(writeClient, schema, sourceRunId, matches, publicationDate);
      await insertLocalIdentifiers(writeClient, schema, matches);
      await insertLocalSourceMentions(writeClient, schema, sourceRunId, matches, publicationDate);
      await writeClient.query("commit");

      await finalizeSourceRun(
        writeClient,
        schema,
        sourceRunId,
        "completed",
        `DNIT RUC equivalence completed: ${matches.length} identity profiles, ${summary.anchorGapMatches} previously unanchored companies resolved, ${unmatched.length} unresolved RUC targets.`,
      );

      return { reportPath, summaryPath, rawManifestPath };
    } catch (error) {
      try {
        await writeClient.query("rollback");
      } catch {
        // Preserve the original error.
      }

      if (sourceRunId) {
        await finalizeSourceRun(
          writeClient,
          schema,
          sourceRunId,
          "failed",
          error instanceof Error ? error.message.slice(0, 500) : "DNIT RUC equivalence connector failed.",
        );
      }

      throw error;
    } finally {
      await writeClient.end();
    }
  } finally {
    try {
      await selectionClient.end();
    } catch {
      // Ignore close errors if the connection was already closed above.
    }
  }
}
