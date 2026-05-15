import { parse } from "csv-parse/sync";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Client } from "pg";
import { resolveOutputPath, writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";

const SOURCE_KEY = "py-abogacia-person-relationship-staging";
const COUNTRY_CODE = "PY";
const SOURCE_PAGE_URL = "https://datos.abogacia.gov.py/";

type RelationKind = "beneficial_owner" | "director" | "shareholder";

interface ConnectorOptions {
  dryRun?: boolean | undefined;
  limit?: number | undefined;
  relationKinds?: string[] | undefined;
}

interface RelationDatasetConfig {
  kind: RelationKind;
  sourceUrl: string;
  dictionaryUrl: string;
  relationType: string;
  relationLabel: string;
  companyNameFields: string[];
  personNameFields: string[];
  roleFields: string[];
}

interface LocalCompanyTarget {
  entityId: number;
  canonicalName: string;
  identifierScheme: string;
  identifierValue: string;
  rucBase: string;
}

interface ParsedRelationshipRow {
  dataset: RelationDatasetConfig;
  lineNumber: number;
  companyRucBase: string;
  companyName: string;
  personName: string;
  roleLabel: string | null;
  sourceRowHash: string;
  relationshipAttributes: Record<string, unknown>;
  raw: Record<string, string>;
}

interface StagedRelationshipLead {
  datasetKind: RelationKind;
  sourceRecordId?: number | undefined;
  target: LocalCompanyTarget;
  relationType: string;
  relationLabel: string;
  companyRucBase: string;
  companyName: string;
  relatedPersonDisplay: string;
  relatedPersonNameHash: string;
  sourceRowHash: string;
  sourceLineNumber: number;
  matchMethod: string;
  matchConfidence: number;
  reviewStatus: string;
  publicDisplayStatus: string;
  promotionStatus: string;
  rationale: string;
  relationshipAttributes: Record<string, unknown>;
  provenance: Record<string, unknown>;
  limitations: string[];
}

interface DatasetStats {
  kind: RelationKind;
  sourceUrl: string;
  rawRowCount: number;
  parsedRelationshipCount: number;
  procurementLinkedCount: number;
  stagedCount: number;
  columns: string[];
  sha256: string;
}

interface ConnectorSummary {
  sourceRunId: number | null;
  dryRun: boolean;
  limit: number;
  localTargetCount: number;
  totalRawRows: number;
  totalParsedRelationshipRows: number;
  totalProcurementLinkedRows: number;
  totalStagedRows: number;
  skippedNoLocalTarget: number;
  datasetStats: DatasetStats[];
  dictionaryPaths: string[];
  summaryPath: string;
  reportPath: string;
  sampleStagedRelationships: StagedRelationshipLead[];
}

const DATASETS: RelationDatasetConfig[] = [
  {
    kind: "beneficial_owner",
    sourceUrl: "https://datos.abogacia.gov.py/assets/docs/beneficiario-final-full.csv",
    dictionaryUrl: "https://datos.abogacia.gov.py/assets/json/diccionarioBeneficiario.json",
    relationType: "abogacia_beneficial_owner_staged",
    relationLabel: "Beneficial owner disclosure lead",
    companyNameFields: ["denominacion"],
    personNameFields: ["nombres_apellidos"],
    roleFields: ["condicion"],
  },
  {
    kind: "director",
    sourceUrl: "https://datos.abogacia.gov.py/assets/docs/directivos-full.csv",
    dictionaryUrl: "https://datos.abogacia.gov.py/assets/json/diccionarioDirectivo.json",
    relationType: "abogacia_director_staged",
    relationLabel: "Director/officer disclosure lead",
    companyNameFields: ["denominacion"],
    personNameFields: ["nombres_apellidos"],
    roleFields: ["cargo"],
  },
  {
    kind: "shareholder",
    sourceUrl: "https://datos.abogacia.gov.py/assets/docs/socios-full.csv",
    dictionaryUrl: "https://datos.abogacia.gov.py/assets/json/diccionarioSocio.json",
    relationType: "abogacia_shareholder_staged",
    relationLabel: "Shareholder disclosure lead",
    companyNameFields: ["denominacion_empresa", "denominacion"],
    personNameFields: ["denominacion_socio", "nombres_apellidos"],
    roleFields: ["categoria_acc_cuout_particip", "categoria_acc_cuot_particip"],
  },
];

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

function rucBaseFromIdentifier(value: string): string | null {
  const withoutPrefix = value.replace(/^PY-RUC-/i, "");
  const match = withoutPrefix.match(/^(\d+)(?:-(\d))?$/);
  if (!match) {
    return null;
  }

  const base = normalizeRucBase(match[1] ?? "");
  return base.length > 0 ? base : null;
}

function sha256(input: Buffer | string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function decodeSourceText(buffer: Buffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const replacementCharacters = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCharacters === 0) {
    return utf8;
  }

  return new TextDecoder("iso-8859-1").decode(buffer);
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function writeRawAsset(relativePath: string[], content: Buffer): Promise<string> {
  const targetPath = resolveOutputPath(...relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
  return targetPath;
}

function pickFirst(row: Record<string, string>, fields: string[]): string {
  for (const field of fields) {
    const value = normalizeWhitespace(String(row[field] ?? ""));
    if (value.length > 0) {
      return value;
    }
  }

  return "";
}

function parseNumber(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^0-9.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentBand(value: string): string | null {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return null;
  }

  if (parsed <= 0) {
    return "0";
  }
  if (parsed <= 5) {
    return "0-5";
  }
  if (parsed <= 10) {
    return "5-10";
  }
  if (parsed <= 25) {
    return "10-25";
  }
  if (parsed <= 50) {
    return "25-50";
  }

  return "50-plus";
}

function countBand(value: string): string | null {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return null;
  }

  if (parsed <= 1) {
    return "1-or-less";
  }
  if (parsed <= 10) {
    return "2-10";
  }
  if (parsed <= 100) {
    return "11-100";
  }

  return "100-plus";
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === "string" && value.trim().length === 0) {
        return false;
      }
      return true;
    }),
  );
}

function relationshipAttributes(config: RelationDatasetConfig, row: Record<string, string>): Record<string, unknown> {
  if (config.kind === "beneficial_owner") {
    return compactObject({
      condition: normalizeWhitespace(row.condicion ?? ""),
      participationBand: percentBand(row.porcent_particip_sustantiva ?? ""),
      votingRightsBand: percentBand(row.porcent_derecho_votacion ?? ""),
      additionalInfoPresent: normalizeWhitespace(row.informacion_adicional ?? "").length > 0,
      controlChainPresent: normalizeWhitespace(row.cadena_control ?? "").length > 0,
      companyType: normalizeWhitespace(row.tipo_entidad ?? ""),
      procedureDescriptionPresent: normalizeWhitespace(row.tramite_descripcion ?? "").length > 0,
    });
  }

  if (config.kind === "director") {
    return compactObject({
      role: normalizeWhitespace(row.cargo ?? ""),
      termStatus: normalizeWhitespace(row.vigencia ?? ""),
      assumptionDatePresent: normalizeWhitespace(row.fecha_asuncion ?? "").length > 0,
      companyType: normalizeWhitespace(row.tipo_entidad ?? ""),
      procedureDescriptionPresent: normalizeWhitespace(row.tramite_descripcion ?? "").length > 0,
    });
  }

  return compactObject({
    participationBand: percentBand(row.porcentaje_capital ?? ""),
    shareOrQuotaCountBand: countBand(row.cantidad_acc_cuot_particip ?? ""),
    voteCountBand: countBand(row.cantidad_votos ?? ""),
    shareClass: normalizeWhitespace(row.categoria_acc_cuout_particip ?? row.categoria_acc_cuot_particip ?? ""),
    companyType: normalizeWhitespace(row.tipo_entidad ?? ""),
    procedureDescriptionPresent: normalizeWhitespace(row.tramite_descripcion ?? "").length > 0,
  });
}

function redactedPersonDisplay(personName: string, hash: string): string {
  const tokens = normalizeWhitespace(personName)
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .slice(0, 4);
  const initials = tokens
    .map((token) => token[0]?.toUpperCase())
    .filter((token): token is string => Boolean(token))
    .join(".");

  return initials ? `${initials}. [hash:${hash.slice(0, 8)}]` : `Person [hash:${hash.slice(0, 8)}]`;
}

function parseRelationshipRows(config: RelationDatasetConfig, csvText: string): ParsedRelationshipRow[] {
  const records = parse(csvText, {
    columns: true,
    delimiter: ";",
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Array<Record<string, string>>;

  return records.flatMap((row, index) => {
    const companyRucBase = normalizeRucBase(row.ruc_nro ?? "");
    const companyName = pickFirst(row, config.companyNameFields);
    const personName = pickFirst(row, config.personNameFields);
    if (!companyRucBase || !companyName || !personName) {
      return [];
    }

    const roleLabel = pickFirst(row, config.roleFields);
    return [
      {
        dataset: config,
        lineNumber: index + 2,
        companyRucBase,
        companyName,
        personName,
        roleLabel: roleLabel || null,
        sourceRowHash: sha256(`${config.kind}:${JSON.stringify(row)}`),
        relationshipAttributes: relationshipAttributes(config, row),
        raw: row,
      },
    ];
  });
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
       and identifiers.scheme in ('PY-RUC', 'PY-RUC-PLAIN', 'PY-ABOGACIA-RUC-BASE')
     order by entity_id`,
  );

  return result.rows.flatMap((row) => {
    const rucBase = rucBaseFromIdentifier(String(row.value ?? ""));
    if (!rucBase) {
      return [];
    }

    return [
      {
        entityId: Number(row.entity_id),
        canonicalName: String(row.canonical_name ?? ""),
        identifierScheme: String(row.scheme ?? ""),
        identifierValue: String(row.value ?? ""),
        rucBase,
      },
    ];
  });
}

function buildTargetMap(targets: LocalCompanyTarget[]): Map<string, LocalCompanyTarget> {
  const map = new Map<string, LocalCompanyTarget>();
  for (const target of targets) {
    if (!map.has(target.rucBase)) {
      map.set(target.rucBase, target);
    }
  }

  return map;
}

function buildLead(row: ParsedRelationshipRow, target: LocalCompanyTarget): StagedRelationshipLead {
  const normalizedPersonName = normalizeName(row.personName);
  const personHash = sha256(`${row.dataset.relationType}:${normalizedPersonName}`);
  const display = redactedPersonDisplay(row.personName, personHash);
  const namesAgree = normalizeName(row.companyName) === normalizeName(target.canonicalName);
  const confidence = namesAgree ? 0.94 : 0.88;

  return {
    datasetKind: row.dataset.kind,
    target,
    relationType: row.dataset.relationType,
    relationLabel: row.dataset.relationLabel,
    companyRucBase: row.companyRucBase,
    companyName: row.companyName,
    relatedPersonDisplay: display,
    relatedPersonNameHash: personHash,
    sourceRowHash: row.sourceRowHash,
    sourceLineNumber: row.lineNumber,
    matchMethod: namesAgree ? "abogacia_ruc_base_and_company_name_match" : "abogacia_ruc_base_match_company_name_review",
    matchConfidence: confidence,
    reviewStatus: "staged_review_only",
    publicDisplayStatus: "blocked_personal_data",
    promotionStatus: "not_promoted",
    rationale:
      "Official Abogacia open-data relationship row matched an existing Centinela company by RUC base. Person identity is redacted and not promoted to an entity until a separate privacy and evidence review is completed.",
    relationshipAttributes: row.relationshipAttributes,
    provenance: {
      sourcePageUrl: SOURCE_PAGE_URL,
      sourceDatasetUrl: row.dataset.sourceUrl,
      dictionaryUrl: row.dataset.dictionaryUrl,
      sourceLineNumber: row.lineNumber,
      sourceRowHash: row.sourceRowHash,
      localEntityId: target.entityId,
      localEntityName: target.canonicalName,
      localIdentifierScheme: target.identifierScheme,
      localIdentifierValue: target.identifierValue,
      rawPersonalFieldsStored: false,
      rawDatasetPersistedLocally: false,
    },
    limitations: [
      "This is a review-only relationship lead, not a finding of control, ownership, influence, misconduct, or sanctions exposure.",
      "Centinela stores a redacted display token and one-way name hash; it does not store document numbers, addresses, birth dates, phone numbers, emails, or raw person names from this connector.",
      "The source asset is reachable from the official portal, but Centinela treats personal relationship rows as internal, non-public review material pending legal and methodology review.",
      "Hashing a public name is a minimization measure, not a guarantee of anonymity.",
    ],
  };
}

async function createSourceRun(client: Client, schema: string, dryRun: boolean): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [
      SOURCE_KEY,
      COUNTRY_CODE,
      "running",
      `Abogacia person relationship staging started. dryRun=${dryRun}. Raw personal source rows are parsed in memory and not persisted locally.`,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create source run for Abogacia person relationship staging.");
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

async function insertSourceAsset(
  client: Client,
  schema: string,
  sourceRunId: number,
  asset: { kind: string; path: string | null; sourceUrl: string; sha256?: string | undefined },
): Promise<void> {
  await client.query(
    `insert into ${schema}.source_assets (source_run_id, asset_kind, path, source_url, sha256)
     values ($1, $2, $3, $4, $5)`,
    [sourceRunId, asset.kind, asset.path, asset.sourceUrl, asset.sha256 ?? null],
  );
}

async function upsertRedactedSourceRecord(
  client: Client,
  schema: string,
  sourceRunId: number,
  lead: StagedRelationshipLead,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_records
       (source_run_id, source_key, external_id, record_kind, source_url, payload)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (source_key, external_id, record_kind)
     do update
     set
       source_run_id = excluded.source_run_id,
       source_url = excluded.source_url,
       payload = excluded.payload,
       retrieved_at = now()
     returning id`,
    [
      sourceRunId,
      SOURCE_KEY,
      lead.sourceRowHash,
      "abogacia_person_relationship_staging_redacted",
      lead.provenance.sourceDatasetUrl,
      JSON.stringify({
        company: {
          entityId: lead.target.entityId,
          entityName: lead.target.canonicalName,
          sourceCompanyName: lead.companyName,
          rucBase: lead.companyRucBase,
        },
        relationship: {
          relationType: lead.relationType,
          relationLabel: lead.relationLabel,
          relatedEntityType: "person",
          relatedPersonDisplay: lead.relatedPersonDisplay,
          relatedPersonNameHash: lead.relatedPersonNameHash,
          personNameStored: false,
          sourceLineNumber: lead.sourceLineNumber,
          relationshipAttributes: lead.relationshipAttributes,
        },
        match: {
          matchMethod: lead.matchMethod,
          matchConfidence: lead.matchConfidence,
          reviewStatus: lead.reviewStatus,
          publicDisplayStatus: lead.publicDisplayStatus,
          promotionStatus: lead.promotionStatus,
          rationale: lead.rationale,
        },
        provenance: lead.provenance,
        limitations: lead.limitations,
      }),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to upsert redacted Abogacia source record.");
  }

  return row.id;
}

async function upsertStagedRelationship(
  client: Client,
  schema: string,
  sourceRunId: number,
  lead: StagedRelationshipLead,
): Promise<void> {
  await client.query(
    `insert into ${schema}.entity_relationship_staging (
       source_run_id,
       source_record_id,
       source_key,
       company_entity_id,
       company_ruc_base,
       company_name,
       relation_type,
       relation_label,
       related_entity_type,
       related_person_display,
       related_person_name_hash,
       source_row_hash,
       source_line_number,
       match_method,
       match_confidence,
       review_status,
       public_display_status,
       promotion_status,
       rationale,
       relationship_attributes,
       provenance,
       limitations
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'person', $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     on conflict (source_key, relation_type, company_entity_id, related_person_name_hash, source_row_hash)
     do update
     set
       source_run_id = excluded.source_run_id,
       source_record_id = excluded.source_record_id,
       company_name = excluded.company_name,
       relation_label = excluded.relation_label,
       related_person_display = excluded.related_person_display,
       source_line_number = excluded.source_line_number,
       match_method = excluded.match_method,
       match_confidence = excluded.match_confidence,
       review_status = excluded.review_status,
       public_display_status = excluded.public_display_status,
       promotion_status = excluded.promotion_status,
       rationale = excluded.rationale,
       relationship_attributes = excluded.relationship_attributes,
       provenance = excluded.provenance,
       limitations = excluded.limitations,
       last_seen_at = now()`,
    [
      sourceRunId,
      lead.sourceRecordId ?? null,
      SOURCE_KEY,
      lead.target.entityId,
      lead.companyRucBase,
      lead.companyName,
      lead.relationType,
      lead.relationLabel,
      lead.relatedPersonDisplay,
      lead.relatedPersonNameHash,
      lead.sourceRowHash,
      lead.sourceLineNumber,
      lead.matchMethod,
      lead.matchConfidence,
      lead.reviewStatus,
      lead.publicDisplayStatus,
      lead.promotionStatus,
      lead.rationale,
      JSON.stringify(lead.relationshipAttributes),
      JSON.stringify(lead.provenance),
      JSON.stringify(lead.limitations),
    ],
  );
}

function sanitizeLeadForOutput(lead: StagedRelationshipLead): Record<string, unknown> {
  return {
    companyEntityId: lead.target.entityId,
    companyEntityName: lead.target.canonicalName,
    sourceCompanyName: lead.companyName,
    companyRucBase: lead.companyRucBase,
    relationType: lead.relationType,
    relationLabel: lead.relationLabel,
    relatedPersonDisplay: lead.relatedPersonDisplay,
    relatedPersonNameHash: lead.relatedPersonNameHash,
    sourceRowHash: lead.sourceRowHash,
    sourceLineNumber: lead.sourceLineNumber,
    matchMethod: lead.matchMethod,
    matchConfidence: lead.matchConfidence,
    reviewStatus: lead.reviewStatus,
    publicDisplayStatus: lead.publicDisplayStatus,
    relationshipAttributes: lead.relationshipAttributes,
    provenance: lead.provenance,
    limitations: lead.limitations,
  };
}

function buildReport(summary: ConnectorSummary): string {
  const lines: string[] = [];
  lines.push("# Abogacia person relationship staging");
  lines.push("");
  lines.push("This report contains relationship leads for review, not proof of wrongdoing, ownership control, political influence, sanctions exposure, or legal culpability.");
  lines.push("");
  lines.push("## Result");
  lines.push("");
  lines.push(`- Dry run: ${summary.dryRun}`);
  lines.push(`- Source run ID: ${summary.sourceRunId ?? "n/a"}`);
  lines.push(`- Local company targets: ${summary.localTargetCount}`);
  lines.push(`- Raw rows observed across selected datasets: ${summary.totalRawRows}`);
  lines.push(`- Parsed relationship rows: ${summary.totalParsedRelationshipRows}`);
  lines.push(`- Procurement-linked relationship rows: ${summary.totalProcurementLinkedRows}`);
  lines.push(`- Staged review-only rows: ${summary.totalStagedRows}`);
  lines.push(`- Rows skipped because no local Centinela company target matched by RUC base: ${summary.skippedNoLocalTarget}`);
  lines.push(`- Pilot limit: ${summary.limit}`);
  lines.push("");
  lines.push("## Dataset coverage");
  lines.push("");
  for (const stat of summary.datasetStats) {
    lines.push(`- ${stat.kind}: ${stat.stagedCount} staged of ${stat.procurementLinkedCount} procurement-linked rows; ${stat.rawRowCount} raw rows; source ${stat.sourceUrl}`);
  }
  lines.push("");
  lines.push("## Privacy and review boundary");
  lines.push("");
  lines.push("- Centinela did not persist raw personal CSV files from this connector.");
  lines.push("- Staged rows store redacted display initials, a one-way name hash, source line number, source row hash, company RUC base, relation type, and non-sensitive relationship attributes.");
  lines.push("- The connector intentionally excludes document numbers, addresses, birth dates, phone numbers, emails, and raw person names.");
  lines.push("- Staged rows are blocked from public display and are not promoted into person entities or graph edges without a separate review step.");
  lines.push("- The source files are reachable from Paraguay's official Abogacia open-data portal, but Centinela treats person relationship rows as internal review material until legal and methodology review says otherwise.");
  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  lines.push(`- Redacted summary JSON: ${summary.summaryPath}`);
  lines.push(`- Report: ${summary.reportPath}`);
  for (const dictionaryPath of summary.dictionaryPaths) {
    lines.push(`- Dictionary asset: ${dictionaryPath}`);
  }
  lines.push("");
  lines.push("## Sample staged rows");
  lines.push("");
  if (summary.sampleStagedRelationships.length === 0) {
    lines.push("- No rows were staged.");
  } else {
    for (const lead of summary.sampleStagedRelationships.slice(0, 20)) {
      lines.push(
        `- Entity ${lead.target.entityId}: ${lead.target.canonicalName} -> ${lead.relatedPersonDisplay} (${lead.relationType}; line ${lead.sourceLineNumber}; ${lead.matchMethod}; confidence ${lead.matchConfidence})`,
      );
    }
  }
  lines.push("");
  lines.push("## Precedent contribution");
  lines.push("");
  lines.push("- br/acc: adds source-backed cross-dataset relationship staging without collapsing every public row into a final graph claim.");
  lines.push("- OpenOwnership/Sayari: introduces ownership-ready relationship roles while keeping beneficial-owner review separate from accepted identity facts.");
  lines.push("- QuiénEsQuién/TodosLosContratos: links contracts and companies to accountability relationship leads that can later power public explanations.");
  lines.push("- Aleph: gives entity briefs a document/source-backed lead path for analysts.");
  lines.push("- RUBLI: preserves methodology limits and public-display constraints beside the data.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export async function runAbogaciaPersonRelationshipStaging(
  options: ConnectorOptions = {},
): Promise<ConnectorSummary> {
  const selectedKinds = new Set((options.relationKinds ?? DATASETS.map((dataset) => dataset.kind)).map((kind) => kind.trim()));
  const datasets = DATASETS.filter((dataset) => selectedKinds.has(dataset.kind));
  const limit = Math.max(1, Math.trunc(options.limit ?? 250));
  const dryRun = options.dryRun === true;
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dictionaryPaths: string[] = [];
  const datasetStats: DatasetStats[] = [];
  const { client, schema } = await connectToPostgres();
  let sourceRunId: number | null = null;

  try {
    const targets = await loadLocalCompanyTargets(client, schema);
    const targetByRuc = buildTargetMap(targets);
    const stagedLeads: StagedRelationshipLead[] = [];
    const perDatasetLimit = Math.max(1, Math.ceil(limit / Math.max(1, datasets.length)));
    let totalRawRows = 0;
    let totalParsedRelationshipRows = 0;
    let totalProcurementLinkedRows = 0;

    for (const dataset of datasets) {
      const csvBuffer = await fetchBuffer(dataset.sourceUrl);
      const dictionaryBuffer = await fetchBuffer(dataset.dictionaryUrl);
      const dictionaryPath = await writeRawAsset(
        ["raw", "paraguay", "abogacia", `person-relationship-${dataset.kind}-dictionary-${runStamp}.json`],
        dictionaryBuffer,
      );
      dictionaryPaths.push(dictionaryPath);

      const records = parse(decodeSourceText(csvBuffer), {
        columns: true,
        delimiter: ";",
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as Array<Record<string, string>>;
      const columns = Object.keys(records[0] ?? {});
      const parsedRows = parseRelationshipRows(dataset, decodeSourceText(csvBuffer));
      const linkedRows = parsedRows.filter((row) => targetByRuc.has(row.companyRucBase));
      const datasetLimit = Math.min(perDatasetLimit, Math.max(0, limit - stagedLeads.length));
      const leadsForDataset = linkedRows.slice(0, datasetLimit).map((row) => {
        const target = targetByRuc.get(row.companyRucBase);
        if (!target) {
          throw new Error("Expected linked Abogacia relationship row to have a local target.");
        }
        return buildLead(row, target);
      });

      totalRawRows += records.length;
      totalParsedRelationshipRows += parsedRows.length;
      totalProcurementLinkedRows += linkedRows.length;
      stagedLeads.push(...leadsForDataset);
      datasetStats.push({
        kind: dataset.kind,
        sourceUrl: dataset.sourceUrl,
        rawRowCount: records.length,
        parsedRelationshipCount: parsedRows.length,
        procurementLinkedCount: linkedRows.length,
        stagedCount: leadsForDataset.length,
        columns,
        sha256: sha256(csvBuffer),
      });
    }

    const skippedNoLocalTarget = Math.max(0, totalParsedRelationshipRows - totalProcurementLinkedRows);
    const summaryPath = await writeOutputJson(
      ["raw", "paraguay", "abogacia", `person-relationship-staging-summary-${runStamp}.json`],
      {
        sourceKey: SOURCE_KEY,
        sourcePageUrl: SOURCE_PAGE_URL,
        generatedAt: new Date().toISOString(),
        dryRun,
        limit,
        localTargetCount: targets.length,
        totalRawRows,
        totalParsedRelationshipRows,
        totalProcurementLinkedRows,
        totalStagedRows: stagedLeads.length,
        skippedNoLocalTarget,
        datasetStats,
        sampleStagedRelationships: stagedLeads.slice(0, 50).map(sanitizeLeadForOutput),
        privacyBoundary: {
          rawFullCsvPersisted: false,
          rawPersonNamesPersisted: false,
          personalDocumentNumbersPersisted: false,
          addressesPersisted: false,
          publicDisplayStatus: "blocked_personal_data",
        },
      },
    );
    const reportPath = resolveOutputPath("reports", "paraguay", `abogacia-person-relationship-staging-${runStamp}.md`);
    const summary: ConnectorSummary = {
      sourceRunId: null,
      dryRun,
      limit,
      localTargetCount: targets.length,
      totalRawRows,
      totalParsedRelationshipRows,
      totalProcurementLinkedRows,
      totalStagedRows: stagedLeads.length,
      skippedNoLocalTarget,
      datasetStats,
      dictionaryPaths,
      summaryPath,
      reportPath,
      sampleStagedRelationships: stagedLeads.slice(0, 25),
    };

    if (!dryRun) {
      sourceRunId = await createSourceRun(client, schema, dryRun);
      summary.sourceRunId = sourceRunId;
      await client.query("begin");
      for (const stat of datasetStats) {
        await insertSourceAsset(client, schema, sourceRunId, {
          kind: `abogacia_${stat.kind}_csv_not_persisted_privacy_minimized`,
          path: null,
          sourceUrl: stat.sourceUrl,
          sha256: stat.sha256,
        });
      }
      for (const dictionaryPath of dictionaryPaths) {
        await insertSourceAsset(client, schema, sourceRunId, {
          kind: "abogacia_relationship_dictionary",
          path: dictionaryPath,
          sourceUrl: SOURCE_PAGE_URL,
        });
      }
      await insertSourceAsset(client, schema, sourceRunId, {
        kind: "abogacia_person_relationship_staging_summary",
        path: summaryPath,
        sourceUrl: SOURCE_PAGE_URL,
      });

      for (const lead of stagedLeads) {
        lead.sourceRecordId = await upsertRedactedSourceRecord(client, schema, sourceRunId, lead);
        await upsertStagedRelationship(client, schema, sourceRunId, lead);
      }

      await client.query("commit");
      await finalizeSourceRun(
        client,
        schema,
        sourceRunId,
        "completed",
        `Abogacia person relationship staging completed: ${stagedLeads.length} redacted review-only rows staged from ${totalProcurementLinkedRows} procurement-linked relationship rows. Raw personal CSV rows were not persisted.`,
      );
    }

    await writeOutputText(["reports", "paraguay", `abogacia-person-relationship-staging-${runStamp}.md`], buildReport(summary));
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
        error instanceof Error ? error.message.slice(0, 500) : "Abogacia person relationship staging failed.",
      );
    }

    throw error;
  } finally {
    await client.end();
  }
}
