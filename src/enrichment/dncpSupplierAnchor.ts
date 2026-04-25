import { parse as parseCsv } from "csv-parse/sync";
import type { Client } from "pg";
import { sleep } from "../lib/http";
import {
  coreEntityName,
  normalizeEntityName,
  normalizeLooseIdentifier,
} from "../lib/entityNames";
import { writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";

const DNCP_SUPPLIER_SOURCE_KEY = "py-dncp-supplier-anchor";
const DNCP_BASE_URL = "https://www.contrataciones.gov.py";
const DNCP_PROVIDER_CSV_URL = `${DNCP_BASE_URL}/buscador/proveedores.csv`;
const DNCP_SANCTIONS_CSV_URL = `${DNCP_BASE_URL}/buscador/sanciones.csv`;
const DEFAULT_LIMIT = 200;
const REQUEST_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15_000;

interface LocalSupplierEntityRow {
  entity_id: string;
  canonical_name: string;
  identifiers: string[] | null;
  total_process_count: string;
  supplier_process_count: string;
  total_risk_signals: string;
}

interface LocalSupplierEntity {
  entityId: number;
  canonicalName: string;
  identifiers: string[];
  totalProcessCount: number;
  supplierProcessCount: number;
  totalRiskSignals: number;
  normalizedName: string;
  coreName: string;
  procurementRuc: string | null;
  procurementRucNormalized: string | null;
}

interface ProviderCsvRow {
  proveedor_slug: string;
  razon_social: string;
  ruc: string;
  nombre_fantasia: string;
  direccion: string;
  telefono: string;
  correo_electronico: string;
  representante_legal: string;
  cantidad_adjudicaciones: string;
}

interface SanctionCsvRow {
  proveedor_slug: string;
  razon_social: string;
  ruc: string;
  fecha_desde: string;
  fecha_hasta: string;
  fecha_habilitacion: string;
  incisos: string;
  tipo_sancion: string;
  estado_inhabilitacion: string;
  nro_licitacion: string;
  nombre_licitacion: string;
  sancion_id: string;
}

interface ProviderDetail {
  officialName?: string;
  fantasyName?: string;
  supplierType?: string;
  companySize?: string;
  activityType?: string;
  inscriptionAt?: string;
  sipeActivationAt?: string;
  registryActivationAt?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  phone?: string;
  email?: string;
}

interface ProviderMatch {
  entityId: number;
  entityName: string;
  procurementRuc: string;
  provider: ProviderCsvRow;
  providerDetail: ProviderDetail;
  sanctions: SanctionCsvRow[];
  matchMethod: string;
  matchConfidence: number;
  selectedSearchQuery: string;
  searchQueriesTried: string[];
  queryUrl: string;
  detailUrl: string;
  sanctionsUrl: string;
  representatives: string[];
  signalCodes: string[];
}

interface ConnectorFailure {
  entityId: number;
  entityName: string;
  procurementRuc: string | null;
  message: string;
}

interface ConnectorSummary {
  sourceKey: string;
  fetchedAt: string;
  availableCompanyCount: number;
  eligibleCompanyCount: number;
  screenedCompanyCount: number;
  selectionOffset: number;
  onlyUnanchored: boolean;
  requestConcurrency: number;
  matchedCompanyCount: number;
  unmatchedCompanyCount: number;
  failedCompanyCount: number;
  localProfileCount: number;
  localSignalCount: number;
  representativeLinkCount: number;
  sanctionedCompanyCount: number;
  amonestacionCount: number;
  inhabilitacionCount: number;
  matchedCompanies: Array<{
    entityId: number;
    entityName: string;
    procurementRuc: string;
    providerSlug: string;
    officialName: string;
    matchMethod: string;
    matchConfidence: number;
    selectedSearchQuery: string;
    searchQueriesTried: string[];
    adjudicationCount: number;
    sanctionCount: number;
    signalCodes: string[];
    representatives: string[];
  }>;
  failures: ConnectorFailure[];
}

interface SupplierAnchorSelectionOptions {
  limit: number;
  offset: number;
  onlyUnanchored: boolean;
}

interface RunDncpSupplierAnchorOptions extends SupplierAnchorSelectionOptions {
  concurrency?: number;
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

interface LocalSignalSeed {
  entityId: number;
  sourceKey: string;
  signalCode: string;
  signalName: string;
  signalScope: "local";
  category: string;
  severity: "low" | "medium" | "high";
  score: number;
  rationale: string;
  evidence: Array<Record<string, unknown>>;
}

interface ProviderIdentifier {
  scheme: "PY-RUC-PLAIN" | "DNCP-SUPPLIER-CODE" | "DNCP-SUPPLIER-IDENTIFIER";
  value: string;
}

interface ProviderSearchAttempt {
  query: string;
  url: string;
  rowCount: number;
  status: "fetch_failed" | "no_preferred_match" | "matched";
  message?: string;
}

interface ProviderSearchResult {
  query: string;
  url: string;
  rows: ProviderCsvRow[];
  preferred: {
    row: ProviderCsvRow;
    matchMethod: string;
    matchConfidence: number;
  };
  attempts: ProviderSearchAttempt[];
}

function toNumber(value: string | null | undefined): number {
  return Number(value ?? 0);
}

function normalizeBlank(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "_NO_APLICA_") {
    return undefined;
  }

  return trimmed;
}

function normalizeRuc(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const extracted = value.startsWith("PY-RUC-") ? value.slice("PY-RUC-".length) : value;
  const compact = extracted.trim();
  if (compact.length === 0) {
    return null;
  }

  return compact;
}

function normalizeRucKey(value: string | null | undefined): string | null {
  const ruc = normalizeRuc(value);
  if (!ruc) {
    return null;
  }

  const normalized = normalizeLooseIdentifier(ruc);
  return normalized.length > 0 ? normalized : null;
}

function classifyProviderIdentifier(value: string | null | undefined): ProviderIdentifier | null {
  const normalized = normalizeRuc(value);
  if (!normalized) {
    return null;
  }

  if (/^DNCP-\d+$/i.test(normalized)) {
    return {
      scheme: "DNCP-SUPPLIER-CODE",
      value: normalized.toUpperCase(),
    };
  }

  if (/^\d{4,10}(?:-\d)?$/.test(normalized)) {
    return {
      scheme: "PY-RUC-PLAIN",
      value: normalized,
    };
  }

  return {
    scheme: "DNCP-SUPPLIER-IDENTIFIER",
    value: normalized,
  };
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    const named = new Map<string, string>([
      ["amp", "&"],
      ["apos", "'"],
      ["gt", ">"],
      ["lt", "<"],
      ["nbsp", " "],
      ["quot", '"'],
    ]);

    return named.get(normalized) ?? match;
  });
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toAbsoluteDncpUrl(value: string): string {
  return new URL(value, DNCP_BASE_URL).toString();
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Centinela/0.1 (+https://github.com/local/centinela)",
        accept: "text/plain, text/csv, text/html, application/xhtml+xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseDelimitedCsv<T>(value: string): T[] {
  return parseCsv(value, {
    bom: true,
    columns: true,
    delimiter: ";",
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

function splitRepresentativeNames(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => decodeHtmlEntities(item).replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0);
}

function extractDefinitionValue(sectionHtml: string, label: string): string | undefined {
  const pattern = new RegExp(
    `<div class="col-sm-4 info-label helpless">\\s*${escapeRegExp(label)}\\s*<\\/div>\\s*<div class="col-sm-12">([\\s\\S]*?)<\\/div>`,
    "i",
  );
  const match = sectionHtml.match(pattern);
  if (!match) {
    return undefined;
  }

  return normalizeBlank(stripHtml(match[1] ?? ""));
}

function extractPanel(html: string, title: string): string | undefined {
  const pattern = new RegExp(
    `<section class="info-panel"[\\s\\S]*?<h2>${escapeRegExp(title)}<\\/h2>[\\s\\S]*?<div class="info-panel-body-inner clearfix">([\\s\\S]*?)<\\/section>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1];
}

function extractProviderTab(html: string): string | undefined {
  const pattern = /<div role="tabpanel" class="tab-pane fade in active" id="datos_proveedor">[\s\S]*?<section class="info-panel" >[\s\S]*?<div class="info-panel-body-inner clearfix">([\s\S]*?)<\/section>/i;
  const match = html.match(pattern);
  return match?.[1];
}

function parseProviderDetail(html: string): ProviderDetail {
  const providerSection = extractProviderTab(html) ?? "";
  const contactSection = extractPanel(html, "Datos del Contacto") ?? "";
  const locationSection = extractPanel(html, "Datos de Ubicación") ?? "";

  const detail: ProviderDetail = {};

  const pairs: Array<[keyof ProviderDetail, string | undefined]> = [
    ["officialName", extractDefinitionValue(providerSection, "Proveedor")],
    ["fantasyName", extractDefinitionValue(providerSection, "Nombre de Fantasía")],
    ["supplierType", extractDefinitionValue(providerSection, "Tipo de Proveedor")],
    ["companySize", extractDefinitionValue(providerSection, "Tamaño de Empresa")],
    ["activityType", extractDefinitionValue(providerSection, "Tipo de Actividad")],
    ["inscriptionAt", extractDefinitionValue(providerSection, "Fecha de Inscripción")],
    ["sipeActivationAt", extractDefinitionValue(providerSection, "Fecha de Activación en el SIPE")],
    [
      "registryActivationAt",
      extractDefinitionValue(providerSection, "Fecha de Activación del Proveedor en el Registro"),
    ],
    ["address", extractDefinitionValue(locationSection, "Dirección")],
    ["city", extractDefinitionValue(locationSection, "Ciudad")],
    ["department", extractDefinitionValue(locationSection, "Departamento")],
    ["country", extractDefinitionValue(locationSection, "País")],
    ["phone", extractDefinitionValue(contactSection, "Teléfono")],
    ["email", extractDefinitionValue(contactSection, "Correo Electrónico")],
  ];

  for (const [key, value] of pairs) {
    if (!value) {
      continue;
    }

    detail[key] = value;
  }

  return detail;
}

function preferProviderRow(
  entity: LocalSupplierEntity,
  rows: ProviderCsvRow[],
): { row: ProviderCsvRow; matchMethod: string; matchConfidence: number } | null {
  if (rows.length === 0) {
    return null;
  }

  const exactRucMatches = entity.procurementRucNormalized
    ? rows.filter((row) => normalizeRucKey(row.ruc) === entity.procurementRucNormalized)
    : [];

  if (exactRucMatches.length === 1) {
    return {
      row: exactRucMatches[0] as ProviderCsvRow,
      matchMethod: "ruc_exact",
      matchConfidence: 0.99,
    };
  }

  if (exactRucMatches.length > 1) {
    const exactName = exactRucMatches.find(
      (row) => normalizeEntityName(row.razon_social) === entity.normalizedName,
    );
    return {
      row: exactName ?? exactRucMatches[0]!,
      matchMethod: exactName ? "ruc_exact_name_exact" : "ruc_exact_multi",
      matchConfidence: exactName ? 0.99 : 0.94,
    };
  }

  const exactNameMatches = rows.filter((row) => normalizeEntityName(row.razon_social) === entity.normalizedName);
  if (exactNameMatches.length === 1) {
    return {
      row: exactNameMatches[0]!,
      matchMethod: "official_name_exact",
      matchConfidence: 0.9,
    };
  }

  const coreNameMatches = rows.filter((row) => coreEntityName(row.razon_social) === entity.coreName);
  if (coreNameMatches.length === 1) {
    return {
      row: coreNameMatches[0]!,
      matchMethod: "official_core_name_review",
      matchConfidence: 0.76,
    };
  }

  return null;
}

function buildProviderSearchUrl(query: string): string {
  const params = new URLSearchParams({ proveedor: query });
  return `${DNCP_PROVIDER_CSV_URL}?${params.toString()}`;
}

function buildSanctionsUrl(query: string, providerSlug: string): string {
  const params = new URLSearchParams({
    proveedor: query,
    proveedor_slug: providerSlug,
    incluir_no_vigentes: "1",
  });
  return `${DNCP_SANCTIONS_CSV_URL}?${params.toString()}`;
}

function buildProviderDetailUrl(providerSlug: string): string {
  return `${DNCP_BASE_URL}/proveedor/${providerSlug}.html`;
}

function uniqueBy<T>(values: T[], keyBuilder: (value: T) => string): T[] {
  const unique = new Map<string, T>();
  for (const value of values) {
    unique.set(keyBuilder(value), value);
  }

  return [...unique.values()];
}

function addSearchQuery(values: string[], query: string | null | undefined): void {
  const normalized = normalizeBlank(query);
  if (!normalized) {
    return;
  }

  values.push(normalized);
}

function cleanProviderSearchName(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeSearchPunctuation(value: string): string {
  return value
    .replace(/[.,;:()"'`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCommaNameVariant(value: string): string | null {
  const cleaned = cleanProviderSearchName(value);
  const parts = cleaned
    .split(",")
    .map((part) => removeSearchPunctuation(part))
    .filter((part) => part.length > 0);

  if (parts.length < 2) {
    return null;
  }

  const [surname, ...rest] = parts;
  return [...rest, surname].join(" ");
}

function buildProviderSearchQueries(entity: LocalSupplierEntity): string[] {
  const queries: string[] = [];
  const cleanedName = cleanProviderSearchName(entity.canonicalName);
  const punctuationlessName = removeSearchPunctuation(cleanedName);
  const commaVariant = buildCommaNameVariant(entity.canonicalName);

  addSearchQuery(queries, entity.procurementRuc);
  addSearchQuery(queries, entity.canonicalName);
  addSearchQuery(queries, cleanedName);
  addSearchQuery(queries, punctuationlessName);
  addSearchQuery(queries, commaVariant);
  addSearchQuery(queries, entity.coreName.toUpperCase());

  if (/^consorcio\s+/i.test(cleanedName)) {
    addSearchQuery(queries, cleanedName.replace(/^consorcio\s+/i, ""));
    addSearchQuery(queries, punctuationlessName.replace(/^consorcio\s+/i, ""));
  }

  return uniqueBy(queries, (query) => normalizeLooseIdentifier(query));
}

function isNotFoundError(message: string | undefined): boolean {
  return Boolean(message?.includes("Request failed (404)"));
}

function findEvidenceValueFromSeed(
  evidence: Array<Record<string, unknown>>,
  type: string,
): string | undefined {
  for (const item of evidence) {
    if (item.type !== type || typeof item.value !== "string" || item.value.length === 0) {
      continue;
    }

    return item.value;
  }

  return undefined;
}

function buildLocalSignal(entityId: number, sanction: SanctionCsvRow, sourceUrl: string): LocalSignalSeed {
  const type = (normalizeBlank(sanction.tipo_sancion) ?? "").toUpperCase();
  const activeInhabilitacion =
    type === "INHA" &&
    normalizeBlank(sanction.estado_inhabilitacion) &&
    normalizeBlank(sanction.estado_inhabilitacion)?.toUpperCase() !== "_NO_APLICA_";

  const signalCode = type === "INHA" ? "PY-DNCP-SUPPLIER-INHA" : "PY-DNCP-SUPPLIER-AMO";
  const signalName =
    type === "INHA" ? "DNCP supplier inhabilitacion record" : "DNCP supplier amonestacion record";
  const severity = type === "INHA" ? "high" : "medium";
  const score = activeInhabilitacion ? 90 : type === "INHA" ? 82 : 54;
  const fromDate = normalizeBlank(sanction.fecha_desde) ?? "n/a";
  const toDate = normalizeBlank(sanction.fecha_hasta) ?? "n/a";
  const licitation = normalizeBlank(sanction.nro_licitacion);
  const licitationName = normalizeBlank(sanction.nombre_licitacion);

  return {
    entityId,
    sourceKey: DNCP_SUPPLIER_SOURCE_KEY,
    signalCode,
    signalName,
    signalScope: "local",
    category: "administrative_sanction",
    severity,
    score,
    rationale:
      type === "INHA"
        ? `DNCP sanctions search returned an inhabilitacion-linked record for this supplier covering ${fromDate} to ${toDate}.`
        : `DNCP sanctions search returned an amonestacion record for this supplier dated ${fromDate}.`,
    evidence: [
      { type: "source_url", value: sourceUrl },
      { type: "tipo_sancion", value: sanction.tipo_sancion },
      { type: "fecha_desde", value: sanction.fecha_desde },
      { type: "fecha_hasta", value: sanction.fecha_hasta },
      { type: "fecha_habilitacion", value: sanction.fecha_habilitacion },
      { type: "estado_inhabilitacion", value: sanction.estado_inhabilitacion },
      { type: "incisos", value: sanction.incisos },
      { type: "nro_licitacion", value: licitation ?? "" },
      { type: "nombre_licitacion", value: licitationName ?? "" },
      { type: "sancion_id", value: sanction.sancion_id },
    ],
  };
}

async function queryLocalSupplierEntities(
  client: Client,
  schema: string,
  options: SupplierAnchorSelectionOptions,
): Promise<{ availableCount: number; eligibleCount: number; entities: LocalSupplierEntity[] }> {
  const countResult = await client.query<{ total: string }>(
    `select count(*)::text as total
     from ${schema}.entity_procurement_activity as activity
     join ${schema}.entities
       on entities.id = activity.entity_id
     where entities.entity_type = 'company'
       and activity.supplier_process_count > 0`,
  );

  const eligibleCountResult = await client.query<{ total: string }>(
    `select count(*)::text as total
     from ${schema}.entity_procurement_activity as activity
     join ${schema}.entities
       on entities.id = activity.entity_id
     where entities.entity_type = 'company'
       and activity.supplier_process_count > 0
       and (
         $1::boolean = false or not exists (
           select 1
           from ${schema}.entity_local_profiles as profiles
           where profiles.entity_id = activity.entity_id
             and profiles.source_key = $2
             and profiles.profile_kind = 'dncp_supplier_registry'
         )
       )`,
    [options.onlyUnanchored, DNCP_SUPPLIER_SOURCE_KEY],
  );

  const entityResult = await client.query<LocalSupplierEntityRow>(
    `select
       activity.entity_id::text,
       entities.canonical_name,
       array_remove(array_agg(distinct identifiers.value), null) as identifiers,
       activity.total_process_count::text,
       activity.supplier_process_count::text,
       activity.total_risk_signals::text
     from ${schema}.entity_procurement_activity as activity
     join ${schema}.entities
       on entities.id = activity.entity_id
     left join ${schema}.entity_identifiers as identifiers
       on identifiers.entity_id = activity.entity_id
     where entities.entity_type = 'company'
       and activity.supplier_process_count > 0
       and (
         $1::boolean = false or not exists (
           select 1
           from ${schema}.entity_local_profiles as profiles
           where profiles.entity_id = activity.entity_id
             and profiles.source_key = $2
             and profiles.profile_kind = 'dncp_supplier_registry'
         )
       )
     group by
       activity.entity_id,
       entities.canonical_name,
       activity.total_process_count,
       activity.supplier_process_count,
       activity.total_risk_signals
     order by activity.total_risk_signals desc, activity.total_process_count desc, entities.canonical_name
     limit $3
     offset $4`,
    [options.onlyUnanchored, DNCP_SUPPLIER_SOURCE_KEY, options.limit, options.offset],
  );

  const entities = entityResult.rows.map((row) => {
    const identifiers = row.identifiers ?? [];
    const procurementRuc =
      identifiers
        .map((value) => normalizeRuc(value))
        .find((value): value is string => Boolean(value && value.length > 0)) ?? null;

    return {
      entityId: Number(row.entity_id),
      canonicalName: row.canonical_name,
      identifiers,
      totalProcessCount: toNumber(row.total_process_count),
      supplierProcessCount: toNumber(row.supplier_process_count),
      totalRiskSignals: toNumber(row.total_risk_signals),
      normalizedName: normalizeEntityName(row.canonical_name),
      coreName: coreEntityName(row.canonical_name),
      procurementRuc,
      procurementRucNormalized: normalizeRucKey(procurementRuc),
    };
  });

  return {
    availableCount: toNumber(countResult.rows[0]?.total),
    eligibleCount: toNumber(eligibleCountResult.rows[0]?.total),
    entities,
  };
}

async function fetchProviderRows(query: string): Promise<{ url: string; rows: ProviderCsvRow[] }> {
  const url = buildProviderSearchUrl(query);
  const text = await fetchText(url);
  return {
    url,
    rows: parseDelimitedCsv<ProviderCsvRow>(text),
  };
}

async function chooseProviderSearch(entity: LocalSupplierEntity): Promise<ProviderSearchResult | null> {
  const attempts: ProviderSearchAttempt[] = [];

  for (const query of buildProviderSearchQueries(entity)) {
    const url = buildProviderSearchUrl(query);
    try {
      const providerSearch = await fetchProviderRows(query);
      const rows = providerSearch.rows;
      const preferred = preferProviderRow(entity, rows);

      attempts.push({
        query,
        url: providerSearch.url,
        rowCount: rows.length,
        status: preferred ? "matched" : "no_preferred_match",
      });

      if (preferred) {
        return {
          query,
          url: providerSearch.url,
          rows,
          preferred,
          attempts,
        };
      }
    } catch (error) {
      attempts.push({
        query,
        url,
        rowCount: 0,
        status: "fetch_failed",
        message: error instanceof Error ? error.message : "DNCP supplier provider search failed.",
      });
    }

    await sleep(50);
  }

  const hardFailures = attempts.filter(
    (attempt) => attempt.status === "fetch_failed" && !isNotFoundError(attempt.message),
  );

  if (hardFailures.length > 0 && attempts.every((attempt) => attempt.status === "fetch_failed")) {
    throw new Error(
      `DNCP supplier provider search failed for all fallback queries: ${hardFailures
        .map((attempt) => `${attempt.query} (${attempt.message})`)
        .join("; ")}`,
    );
  }

  return null;
}

async function fetchSanctionRows(query: string, providerSlug: string): Promise<{ url: string; rows: SanctionCsvRow[] }> {
  const url = buildSanctionsUrl(query, providerSlug);
  const text = await fetchText(url);
  return {
    url,
    rows: parseDelimitedCsv<SanctionCsvRow>(text),
  };
}

async function fetchProviderDetail(providerSlug: string): Promise<{ url: string; detail: ProviderDetail }> {
  const url = buildProviderDetailUrl(providerSlug);
  const html = await fetchText(url);
  return {
    url,
    detail: parseProviderDetail(html),
  };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function runner(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) {
        return;
      }

      results[index] = await worker(values[index] as T, index);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, values.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

async function screenEntity(entity: LocalSupplierEntity): Promise<ProviderMatch | ConnectorFailure | null> {
  try {
    const providerSearch = await chooseProviderSearch(entity);

    if (!providerSearch) {
      return null;
    }

    const { preferred } = providerSearch;

    let sanctionsRows: SanctionCsvRow[] = [];
    let sanctionsUrl = buildSanctionsUrl(entity.procurementRuc ?? preferred.row.ruc, preferred.row.proveedor_slug);
    try {
      const sanctions = await fetchSanctionRows(entity.procurementRuc ?? preferred.row.ruc, preferred.row.proveedor_slug);
      sanctionsRows = sanctions.rows;
      sanctionsUrl = sanctions.url;
    } catch {
      // Keep the supplier anchor even if the sanctions subrequest fails.
    }

    let providerDetail: ProviderDetail = {};
    let detailUrl = buildProviderDetailUrl(preferred.row.proveedor_slug);
    try {
      const detail = await fetchProviderDetail(preferred.row.proveedor_slug);
      providerDetail = detail.detail;
      detailUrl = detail.url;
    } catch {
      // Keep the supplier anchor even if the detail-page subrequest fails.
    }

    const representatives = splitRepresentativeNames(preferred.row.representante_legal);
    const signalCodes = sanctionsRows.map((row) =>
      (normalizeBlank(row.tipo_sancion) ?? "").toUpperCase() === "INHA"
        ? "PY-DNCP-SUPPLIER-INHA"
        : "PY-DNCP-SUPPLIER-AMO",
    );

    await sleep(50);

    return {
      entityId: entity.entityId,
      entityName: entity.canonicalName,
      procurementRuc: entity.procurementRuc ?? preferred.row.ruc,
      provider: preferred.row,
      providerDetail,
      sanctions: sanctionsRows,
      matchMethod: preferred.matchMethod,
      matchConfidence: preferred.matchConfidence,
      selectedSearchQuery: providerSearch.query,
      searchQueriesTried: providerSearch.attempts.map((attempt) => attempt.query),
      queryUrl: providerSearch.url,
      detailUrl,
      sanctionsUrl,
      representatives,
      signalCodes,
    };
  } catch (error) {
    return {
      entityId: entity.entityId,
      entityName: entity.canonicalName,
      procurementRuc: entity.procurementRuc,
      message: error instanceof Error ? error.message : "DNCP supplier anchor fetch failed.",
    };
  }
}

async function createSourceRun(
  client: Client,
  schema: string,
  screenedCompanyCount: number,
  options: SupplierAnchorSelectionOptions,
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [
      DNCP_SUPPLIER_SOURCE_KEY,
      "PY",
      "running",
      `DNCP supplier anchor started for ${screenedCompanyCount} procurement-linked supplier companies (offset=${options.offset}, onlyUnanchored=${options.onlyUnanchored}).`,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create source run for DNCP supplier anchor.");
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
  matches: ProviderMatch[],
): Promise<void> {
  const entityIds = uniqueBy(matches.map((match) => match.entityId), (value) => `${value}`);
  const providerSlugs = uniqueBy(
    matches.map((match) => match.provider.proveedor_slug).filter((value) => value.length > 0),
    (value) => value,
  );

  if (entityIds.length === 0) {
    return;
  }

  await client.query(
    `delete from ${schema}.entity_intelligence_signals
     where source_key = $1
       and entity_id = any($2::bigint[])`,
    [DNCP_SUPPLIER_SOURCE_KEY, entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_local_profiles
     where source_key = $1
       and entity_id = any($2::bigint[])`,
    [DNCP_SUPPLIER_SOURCE_KEY, entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_identifiers
     where entity_id = any($1::bigint[])
       and scheme in ('PY-RUC-PLAIN', 'DNCP-SUPPLIER-CODE', 'DNCP-SUPPLIER-IDENTIFIER', 'DNCP-PROVEEDOR-SLUG')`,
    [entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_source_mentions
     where source_key = $1
       and entity_id = any($2::bigint[])`,
    [DNCP_SUPPLIER_SOURCE_KEY, entityIds],
  );
  await client.query(
    `delete from ${schema}.entity_relationships
     where source_key = $1
       and relation_type = 'representation_legal'
       and subject_entity_id = any($2::bigint[])`,
    [DNCP_SUPPLIER_SOURCE_KEY, entityIds],
  );

  if (providerSlugs.length === 0) {
    return;
  }

  await client.query(
    `delete from ${schema}.entity_source_mentions
     where source_key = $1
       and role = 'legal_representative'
       and split_part(source_external_id, ':', 1) = any($2::text[])`,
    [DNCP_SUPPLIER_SOURCE_KEY, providerSlugs],
  );
  await client.query(
    `delete from ${schema}.source_records
     where source_key = $1
       and (
         (record_kind in ('dncp_supplier_registry', 'dncp_supplier_detail') and external_id = any($2::text[]))
         or (record_kind = 'dncp_supplier_sanction' and split_part(external_id, ':', 1) = any($2::text[]))
       )`,
    [DNCP_SUPPLIER_SOURCE_KEY, providerSlugs],
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
  records: SourceRecordInput[],
): Promise<void> {
  const uniqueRecords = uniqueBy(records, (record) => `${record.externalId}:${record.recordKind}`);

  if (uniqueRecords.length === 0) {
    return;
  }

  for (let index = 0; index < uniqueRecords.length; index += 200) {
    const batch = uniqueRecords.slice(index, index + 200);
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
        DNCP_SUPPLIER_SOURCE_KEY,
      ],
    );
  }
}

async function insertLocalProfiles(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: ProviderMatch[],
): Promise<void> {
  const uniqueMatches = uniqueBy(matches, (match) => `${match.entityId}`);

  if (uniqueMatches.length === 0) {
    return;
  }

  for (let index = 0; index < uniqueMatches.length; index += 150) {
    const batch = uniqueMatches.slice(index, index + 150);
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
            const providerIdentifier = classifyProviderIdentifier(match.provider.ruc);
            const providerRuc = providerIdentifier?.scheme === "PY-RUC-PLAIN" ? providerIdentifier.value : null;

            return {
              entity_id: match.entityId,
              source_run_id: sourceRunId,
              source_key: DNCP_SUPPLIER_SOURCE_KEY,
              profile_kind: "dncp_supplier_registry",
              profile_status: "official_match",
              match_method: match.matchMethod,
              match_confidence: match.matchConfidence,
              review_status: match.matchConfidence >= 0.95 ? "accepted" : "unreviewed",
              title: match.providerDetail.officialName ?? match.provider.razon_social,
              summary: `DNCP supplier registry match via ${match.matchMethod}; ${match.sanctions.length} administrative history record(s) returned by the official sanctions search.`,
              attributes: {
                officialName: match.providerDetail.officialName ?? match.provider.razon_social,
                fantasyName: match.providerDetail.fantasyName ?? normalizeBlank(match.provider.nombre_fantasia) ?? null,
                ruc: providerRuc,
                registryIdentifier: providerIdentifier?.value ?? null,
                registryIdentifierScheme: providerIdentifier?.scheme ?? null,
                providerSlug: match.provider.proveedor_slug,
                supplierType: match.providerDetail.supplierType ?? null,
                companySize: match.providerDetail.companySize ?? null,
                activityType: match.providerDetail.activityType ?? null,
                inscriptionAt: match.providerDetail.inscriptionAt ?? null,
                sipeActivationAt: match.providerDetail.sipeActivationAt ?? null,
                registryActivationAt: match.providerDetail.registryActivationAt ?? null,
                address: match.providerDetail.address ?? normalizeBlank(match.provider.direccion) ?? null,
                city: match.providerDetail.city ?? null,
                department: match.providerDetail.department ?? null,
                country: match.providerDetail.country ?? "Paraguay",
                phone: match.providerDetail.phone ?? normalizeBlank(match.provider.telefono) ?? null,
                email: match.providerDetail.email ?? normalizeBlank(match.provider.correo_electronico) ?? null,
                detailUrl: match.detailUrl,
                queryUrl: match.queryUrl,
                sanctionsUrl: match.sanctionsUrl,
                adjudicationCount: toNumber(match.provider.cantidad_adjudicaciones),
                representatives: match.representatives,
              },
              evidence: [
                { type: "provider_search_url", value: match.queryUrl },
                { type: "provider_detail_url", value: match.detailUrl },
                { type: "sanctions_url", value: match.sanctionsUrl },
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
  matches: ProviderMatch[],
): Promise<void> {
  const rows = uniqueBy(
    matches.flatMap((match) => {
      const providerIdentifier = classifyProviderIdentifier(match.provider.ruc);
      const identifiers = [
        providerIdentifier
          ? {
              entity_id: match.entityId,
              scheme: providerIdentifier.scheme,
              value: providerIdentifier.value,
              is_primary: true,
            }
          : null,
        {
          entity_id: match.entityId,
          scheme: "DNCP-PROVEEDOR-SLUG",
          value: match.provider.proveedor_slug,
          is_primary: true,
        },
      ];

      return identifiers.filter(
        (identifier): identifier is { entity_id: number; scheme: string; value: string; is_primary: boolean } =>
          Boolean(identifier?.value),
      );
    }),
    (row) => `${row.scheme}:${row.value}`,
  );

  if (rows.length === 0) {
    return;
  }

  for (let index = 0; index < rows.length; index += 300) {
    const batch = rows.slice(index, index + 300);
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
  matches: ProviderMatch[],
): Promise<void> {
  const rows = uniqueBy(
    matches.map((match) => {
      const providerIdentifier = classifyProviderIdentifier(match.provider.ruc);
      const providerRuc = providerIdentifier?.scheme === "PY-RUC-PLAIN" ? providerIdentifier.value : null;

      return {
        entity_id: match.entityId,
        source_run_id: sourceRunId,
        source_key: DNCP_SUPPLIER_SOURCE_KEY,
        role: "supplier_registry",
        source_external_id: match.provider.proveedor_slug,
        observed_name: match.provider.razon_social,
        attributes: {
          providerSlug: match.provider.proveedor_slug,
          ruc: providerRuc,
          registryIdentifier: providerIdentifier?.value ?? null,
          registryIdentifierScheme: providerIdentifier?.scheme ?? null,
          queryUrl: match.queryUrl,
          detailUrl: match.detailUrl,
        },
      };
    }),
    (row) => `${row.entity_id}:${row.role}:${row.source_external_id}`,
  );

  if (rows.length === 0) {
    return;
  }

  for (let index = 0; index < rows.length; index += 200) {
    const batch = rows.slice(index, index + 200);
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
      [JSON.stringify(batch)],
    );
  }
}

async function resolveRepresentativeEntities(
  client: Client,
  schema: string,
  matches: ProviderMatch[],
): Promise<Map<string, number>> {
  const representativeMap = new Map<string, string>();

  for (const match of matches) {
    for (const representative of match.representatives) {
      const normalizedName = normalizeEntityName(representative);
      if (normalizedName.length === 0 || representativeMap.has(normalizedName)) {
        continue;
      }

      representativeMap.set(normalizedName, representative);
    }
  }

  const entries = [...representativeMap.entries()];
  const resolved = new Map<string, number>();

  if (entries.length === 0) {
    return resolved;
  }

  for (let index = 0; index < entries.length; index += 200) {
    const batch = entries.slice(index, index + 200);
    const existing = await client.query<{ normalized_name: string; id: number }>(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(normalized_name text)
       )
       select entities.normalized_name, entities.id
       from input
       join ${schema}.entities as entities
         on entities.entity_type = 'person'
        and entities.normalized_name = input.normalized_name`,
      [JSON.stringify(batch.map(([normalizedName]) => ({ normalized_name: normalizedName })))],
    );

    for (const row of existing.rows) {
      resolved.set(row.normalized_name, row.id);
    }
  }

  const missing = entries
    .filter(([normalizedName]) => !resolved.has(normalizedName))
    .map(([normalizedName, canonicalName]) => ({
      country_code: "PY",
      entity_type: "person",
      canonical_name: canonicalName,
      normalized_name: normalizedName,
      source_key: DNCP_SUPPLIER_SOURCE_KEY,
      source_external_id: null,
      attributes: {
        origin: "dncp_supplier_anchor",
        roleHint: "legal_representative",
      },
    }));

  if (missing.length > 0) {
    for (let index = 0; index < missing.length; index += 150) {
      const batch = missing.slice(index, index + 150);
      const inserted = await client.query<{ id: number; normalized_name: string }>(
        `with input as (
           select *
           from jsonb_to_recordset($1::jsonb) as x(
             country_code text,
             entity_type text,
             canonical_name text,
             normalized_name text,
             source_key text,
             source_external_id text,
             attributes jsonb
           )
         )
         insert into ${schema}.entities
           (country_code, entity_type, canonical_name, normalized_name, source_key, source_external_id, attributes)
         select
           input.country_code,
           input.entity_type,
           input.canonical_name,
           input.normalized_name,
           input.source_key,
           input.source_external_id,
           input.attributes
         from input
         returning id, normalized_name`,
        [JSON.stringify(batch)],
      );

      for (const row of inserted.rows) {
        resolved.set(row.normalized_name, row.id);
      }
    }
  }

  return resolved;
}

async function insertRepresentativeSourceMentions(
  client: Client,
  schema: string,
  sourceRunId: number,
  matches: ProviderMatch[],
  representativeIds: Map<string, number>,
): Promise<void> {
  const rows = uniqueBy(
    matches.flatMap((match) =>
      match.representatives.flatMap((representative) => {
        const normalizedName = normalizeEntityName(representative);
        const representativeId = representativeIds.get(normalizedName);
        if (!representativeId) {
          return [];
        }

        return [
          {
            entity_id: representativeId,
            source_run_id: sourceRunId,
            source_key: DNCP_SUPPLIER_SOURCE_KEY,
            role: "legal_representative",
            source_external_id: `${match.provider.proveedor_slug}:${normalizedName}`,
            observed_name: representative,
            attributes: {
              providerSlug: match.provider.proveedor_slug,
              providerRuc: normalizeRuc(match.provider.ruc),
              providerName: match.provider.razon_social,
            },
          },
        ];
      }),
    ),
    (row) => `${row.entity_id}:${row.role}:${row.source_external_id}`,
  );

  if (rows.length === 0) {
    return;
  }

  for (let index = 0; index < rows.length; index += 250) {
    const batch = rows.slice(index, index + 250);
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
      [JSON.stringify(batch)],
    );
  }
}

async function insertRepresentativeRelationships(
  client: Client,
  schema: string,
  matches: ProviderMatch[],
  representativeIds: Map<string, number>,
): Promise<number> {
  const rows = uniqueBy(
    matches.flatMap((match) =>
      match.representatives.flatMap((representative) => {
        const normalizedName = normalizeEntityName(representative);
        const representativeId = representativeIds.get(normalizedName);
        if (!representativeId) {
          return [];
        }

        const providerIdentifier = classifyProviderIdentifier(match.provider.ruc);
        const providerRuc = providerIdentifier?.scheme === "PY-RUC-PLAIN" ? providerIdentifier.value : null;

        return [
          {
            subject_entity_id: match.entityId,
            object_entity_id: representativeId,
            relation_type: "representation_legal",
            confidence: 0.84,
            source_key: DNCP_SUPPLIER_SOURCE_KEY,
            source_external_id: match.provider.proveedor_slug,
            attributes: {
              sourceRole: "legal_representative",
              providerSlug: match.provider.proveedor_slug,
              providerRuc,
              providerRegistryIdentifier: providerIdentifier?.value ?? null,
              providerRegistryIdentifierScheme: providerIdentifier?.scheme ?? null,
              evidence: [
                {
                  type: "provider_csv_representative",
                  value: representative,
                },
                {
                  type: "provider_detail_url",
                  value: match.detailUrl,
                },
              ],
            },
          },
        ];
      }),
    ),
    (row) => `${row.subject_entity_id}:${row.object_entity_id}:${row.source_external_id}`,
  );

  if (rows.length === 0) {
    return 0;
  }

  for (let index = 0; index < rows.length; index += 250) {
    const batch = rows.slice(index, index + 250);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           subject_entity_id bigint,
           object_entity_id bigint,
           relation_type text,
           confidence numeric,
           source_key text,
           source_external_id text,
           attributes jsonb
         )
       )
       insert into ${schema}.entity_relationships
         (subject_entity_id, object_entity_id, relation_type, confidence, source_key, source_external_id, attributes)
       select
         input.subject_entity_id,
         input.object_entity_id,
         input.relation_type,
         input.confidence,
         input.source_key,
         input.source_external_id,
         input.attributes
       from input`,
      [JSON.stringify(batch)],
    );
  }

  return rows.length;
}

async function insertLocalSignals(
  client: Client,
  schema: string,
  sourceRunId: number,
  signals: LocalSignalSeed[],
): Promise<void> {
  const uniqueSignals = uniqueBy(
    signals,
    (signal) =>
      `${signal.entityId}:${signal.signalCode}:${findEvidenceValueFromSeed(signal.evidence, "sancion_id") ?? signal.rationale}`,
  );

  if (uniqueSignals.length === 0) {
    return;
  }

  for (let index = 0; index < uniqueSignals.length; index += 250) {
    const batch = uniqueSignals.slice(index, index + 250);
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           source_key text,
           signal_code text,
           signal_name text,
           signal_scope text,
           category text,
           severity text,
           score numeric,
           rationale text,
           evidence jsonb
         )
       )
       insert into ${schema}.entity_intelligence_signals
         (
           entity_id,
           source_run_id,
           source_key,
           signal_code,
           signal_name,
           signal_scope,
           category,
           severity,
           score,
           rationale,
           evidence
         )
       select
         input.entity_id,
         $2,
         input.source_key,
         input.signal_code,
         input.signal_name,
         input.signal_scope,
         input.category,
         input.severity,
         input.score,
         input.rationale,
         input.evidence
       from input`,
      [
        JSON.stringify(
          batch.map((signal) => ({
            entity_id: signal.entityId,
            source_key: signal.sourceKey,
            signal_code: signal.signalCode,
            signal_name: signal.signalName,
            signal_scope: signal.signalScope,
            category: signal.category,
            severity: signal.severity,
            score: signal.score,
            rationale: signal.rationale,
            evidence: signal.evidence,
          })),
        ),
        sourceRunId,
      ],
    );
  }
}

function buildOutputStem(summary: ConnectorSummary): string {
  const parts = ["dncp-supplier-anchor"];
  if (summary.onlyUnanchored) {
    parts.push("unanchored");
  }
  parts.push(`offset-${summary.selectionOffset}`);
  parts.push(`screened-${summary.screenedCompanyCount}`);
  return parts.join("-");
}

function renderReport(summary: ConnectorSummary): string {
  const lines: string[] = [];
  lines.push("# DNCP supplier anchor summary");
  lines.push("");
  lines.push("This report contains source-backed identity anchors and administrative risk leads for review, not proof of wrongdoing.");
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Source key: ${summary.sourceKey}`);
  lines.push(`- Fetched at: ${summary.fetchedAt}`);
  lines.push(`- Procurement supplier companies available in Centinela: ${summary.availableCompanyCount}`);
  lines.push(`- Procurement supplier companies eligible in this selection mode: ${summary.eligibleCompanyCount}`);
  lines.push(`- Procurement supplier companies screened this run: ${summary.screenedCompanyCount}`);
  lines.push(`- Selection offset: ${summary.selectionOffset}`);
  lines.push(`- Only unanchored companies selected: ${summary.onlyUnanchored ? "yes" : "no"}`);
  lines.push(`- Request concurrency: ${summary.requestConcurrency}`);
  lines.push(`- Official DNCP supplier matches stored: ${summary.matchedCompanyCount}`);
  lines.push(`- Unmatched companies this run: ${summary.unmatchedCompanyCount}`);
  lines.push(`- Failed lookups this run: ${summary.failedCompanyCount}`);
  lines.push(`- Local supplier profiles written: ${summary.localProfileCount}`);
  lines.push(`- Local intelligence signals written: ${summary.localSignalCount}`);
  lines.push(`- Legal-representative links written: ${summary.representativeLinkCount}`);
  lines.push(`- Suppliers with sanctions history returned: ${summary.sanctionedCompanyCount}`);
  lines.push(`- Amonestacion records observed: ${summary.amonestacionCount}`);
  lines.push(`- Inhabilitacion records observed: ${summary.inhabilitacionCount}`);
  lines.push("");
  lines.push("## Highest-value matched companies");
  lines.push("");

  if (summary.matchedCompanies.length === 0) {
    lines.push("- No official DNCP supplier profiles were matched in this run.");
  } else {
    for (const company of summary.matchedCompanies.slice(0, 20)) {
      lines.push(`- ${company.entityName} -> ${company.officialName}`);
      lines.push(
        `  ruc=${company.procurementRuc}, slug=${company.providerSlug}, method=${company.matchMethod}, confidence=${company.matchConfidence.toFixed(2)}`,
      );
      lines.push(
        `  selected_query=${company.selectedSearchQuery}, tried_queries=${company.searchQueriesTried.length}`,
      );
      lines.push(
        `  adjudicaciones=${company.adjudicationCount}, sanctions=${company.sanctionCount}, representative_links=${company.representatives.length}, signals=${company.signalCodes.join(", ") || "identity-only"}`,
      );
    }
  }

  lines.push("");
  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- This connector uses official DNCP supplier and sanctions CSV endpoints keyed by procurement-linked RUCs, which is much stronger than name-only resolution.");
  lines.push("- The connector now tries bounded fallback searches by RUC, official procurement name, cleaned punctuation variants, comma-reordered person names, and consortium variants before leaving an entity unanchored.");
  lines.push("- Incremental widening through offset and unanchored-only selection lets Centinela grow the local Paraguay company anchor without resetting the whole layer on every run.");
  lines.push("- Legal representative links are identity leads from official supplier records. They improve relationship-aware exploration, but same-name collisions still require analyst review.");
  lines.push("- DNCP sanctions history is an administrative context signal, not a legal conclusion about current misconduct.");
  lines.push("- This run strengthens OpenSanctions usefulness indirectly by improving the local Paraguay company anchor that future enrichment depends on.");

  if (summary.failures.length > 0) {
    lines.push("");
    lines.push("## Fetch failures");
    lines.push("");
    for (const failure of summary.failures.slice(0, 20)) {
      lines.push(`- ${failure.entityName}: ${failure.message}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function runDncpSupplierAnchor(
  options: Partial<RunDncpSupplierAnchorOptions> = {},
): Promise<{
  reportPath: string;
  summaryPath: string;
}> {
  const { client: selectionClient, schema } = await connectToPostgres();
  const runOptions: RunDncpSupplierAnchorOptions = {
    limit: options.limit ?? DEFAULT_LIMIT,
    offset: options.offset ?? 0,
    onlyUnanchored: options.onlyUnanchored ?? false,
    concurrency: options.concurrency ?? REQUEST_CONCURRENCY,
  };

  try {
    const { availableCount, eligibleCount, entities } = await queryLocalSupplierEntities(
      selectionClient,
      schema,
      runOptions,
    );
    await selectionClient.end();
    const results = await mapWithConcurrency(entities, runOptions.concurrency ?? REQUEST_CONCURRENCY, async (entity) =>
      screenEntity(entity),
    );
    const matches = results.filter((result): result is ProviderMatch => Boolean(result && "provider" in result));
    const failures = results.filter(
      (result): result is ConnectorFailure => Boolean(result && "message" in result),
    );
    const unmatchedCompanyCount = entities.length - matches.length - failures.length;

    const signals = matches.flatMap((match) =>
      match.sanctions.map((sanction) => buildLocalSignal(match.entityId, sanction, match.sanctionsUrl)),
    );
    const representativeCount = matches.reduce((sum, match) => sum + match.representatives.length, 0);
    const amonestacionCount = matches.reduce(
      (sum, match) =>
        sum +
        match.sanctions.filter((row) => (normalizeBlank(row.tipo_sancion) ?? "").toUpperCase() === "AMO").length,
      0,
    );
    const inhabilitacionCount = matches.reduce(
      (sum, match) =>
        sum +
        match.sanctions.filter((row) => (normalizeBlank(row.tipo_sancion) ?? "").toUpperCase() === "INHA").length,
      0,
    );

    const summary: ConnectorSummary = {
      sourceKey: DNCP_SUPPLIER_SOURCE_KEY,
      fetchedAt: new Date().toISOString(),
      availableCompanyCount: availableCount,
      eligibleCompanyCount: eligibleCount,
      screenedCompanyCount: entities.length,
      selectionOffset: runOptions.offset,
      onlyUnanchored: runOptions.onlyUnanchored,
      requestConcurrency: runOptions.concurrency ?? REQUEST_CONCURRENCY,
      matchedCompanyCount: matches.length,
      unmatchedCompanyCount,
      failedCompanyCount: failures.length,
      localProfileCount: matches.length,
      localSignalCount: signals.length,
      representativeLinkCount: representativeCount,
      sanctionedCompanyCount: matches.filter((match) => match.sanctions.length > 0).length,
      amonestacionCount,
      inhabilitacionCount,
      matchedCompanies: matches
        .map((match) => ({
          entityId: match.entityId,
          entityName: match.entityName,
          procurementRuc: match.procurementRuc,
          providerSlug: match.provider.proveedor_slug,
          officialName: match.providerDetail.officialName ?? match.provider.razon_social,
          matchMethod: match.matchMethod,
          matchConfidence: match.matchConfidence,
          selectedSearchQuery: match.selectedSearchQuery,
          searchQueriesTried: match.searchQueriesTried,
          adjudicationCount: toNumber(match.provider.cantidad_adjudicaciones),
          sanctionCount: match.sanctions.length,
          signalCodes: match.signalCodes,
          representatives: match.representatives,
        }))
        .sort((left, right) => right.sanctionCount - left.sanctionCount || right.adjudicationCount - left.adjudicationCount)
        .slice(0, 50),
      failures,
    };
    const outputStem = buildOutputStem(summary);

    const rawManifestPath = await writeOutputJson(
      ["raw", "paraguay", "dncp", `${outputStem}-manifest.json`],
      {
        retrievedAt: summary.fetchedAt,
        sourceKey: DNCP_SUPPLIER_SOURCE_KEY,
        availableCompanyCount: availableCount,
        eligibleCompanyCount: eligibleCount,
        screenedCompanyCount: entities.length,
        offset: runOptions.offset,
        onlyUnanchored: runOptions.onlyUnanchored,
        concurrency: runOptions.concurrency ?? REQUEST_CONCURRENCY,
        failures,
        matches: matches.map((match) => ({
          entityId: match.entityId,
          entityName: match.entityName,
          procurementRuc: match.procurementRuc,
          selectedSearchQuery: match.selectedSearchQuery,
          searchQueriesTried: match.searchQueriesTried,
          queryUrl: match.queryUrl,
          detailUrl: match.detailUrl,
          sanctionsUrl: match.sanctionsUrl,
        })),
      },
    );

    const summaryPath = await writeOutputJson(
      ["normalized", "paraguay", `${outputStem}.json`],
      {
        summary,
        matches: matches.map((match) => ({
          entityId: match.entityId,
          entityName: match.entityName,
          procurementRuc: match.procurementRuc,
          provider: match.provider,
          providerDetail: match.providerDetail,
          sanctions: match.sanctions,
          matchMethod: match.matchMethod,
          matchConfidence: match.matchConfidence,
          selectedSearchQuery: match.selectedSearchQuery,
          searchQueriesTried: match.searchQueriesTried,
          representatives: match.representatives,
          signalCodes: match.signalCodes,
          queryUrl: match.queryUrl,
          detailUrl: match.detailUrl,
          sanctionsUrl: match.sanctionsUrl,
        })),
      },
    );
    const reportPath = await writeOutputText(
      ["reports", "paraguay", `${outputStem}.md`],
      renderReport(summary),
    );

    const { client: writeClient } = await connectToPostgres();
    let sourceRunId: number | undefined;

    try {
      sourceRunId = await createSourceRun(writeClient, schema, entities.length, runOptions);
      await writeClient.query("begin");
      await clearSelectedEntityState(writeClient, schema, matches);
      await upsertSourceAssets(writeClient, schema, sourceRunId, [
        { assetKind: "raw_manifest", path: rawManifestPath },
        { assetKind: "normalized_bundle", path: summaryPath },
        { assetKind: "report", path: reportPath },
        { assetKind: "source_reference", sourceUrl: DNCP_PROVIDER_CSV_URL },
        { assetKind: "source_reference", sourceUrl: DNCP_SANCTIONS_CSV_URL },
      ]);
      await upsertSourceRecords(
        writeClient,
        schema,
        sourceRunId,
        matches.flatMap((match) => {
          const providerRecord: SourceRecordInput = {
            externalId: match.provider.proveedor_slug,
            recordKind: "dncp_supplier_registry",
            sourceUrl: match.queryUrl,
            payload: match.provider,
          };
          const detailRecord: SourceRecordInput = {
            externalId: match.provider.proveedor_slug,
            recordKind: "dncp_supplier_detail",
            sourceUrl: match.detailUrl,
            payload: match.providerDetail,
          };
          const sanctionRecords = match.sanctions.map<SourceRecordInput>((sanction) => ({
            externalId: `${match.provider.proveedor_slug}:${sanction.sancion_id}`,
            recordKind: "dncp_supplier_sanction",
            sourceUrl: match.sanctionsUrl,
            payload: sanction,
          }));

          return [providerRecord, detailRecord, ...sanctionRecords];
        }),
      );
      await insertLocalProfiles(writeClient, schema, sourceRunId, matches);
      await insertLocalIdentifiers(writeClient, schema, matches);
      await insertLocalSourceMentions(writeClient, schema, sourceRunId, matches);
      const representativeIds = await resolveRepresentativeEntities(writeClient, schema, matches);
      await insertRepresentativeSourceMentions(writeClient, schema, sourceRunId, matches, representativeIds);
      const representativeLinkCount = await insertRepresentativeRelationships(
        writeClient,
        schema,
        matches,
        representativeIds,
      );
      await insertLocalSignals(writeClient, schema, sourceRunId, signals);
      await writeClient.query("commit");

      await finalizeSourceRun(
        writeClient,
        schema,
        sourceRunId,
        "completed",
        `DNCP supplier anchor completed: ${matches.length} official supplier matches, ${signals.length} local intelligence signals, ${representativeLinkCount} representative links (offset=${runOptions.offset}, onlyUnanchored=${runOptions.onlyUnanchored}).`,
      );

      return {
        reportPath,
        summaryPath,
      };
    } catch (error) {
      try {
        await writeClient.query("rollback");
      } catch {
        // Ignore rollback errors so the original failure surfaces.
      }

      if (sourceRunId) {
        await finalizeSourceRun(
          writeClient,
          schema,
          sourceRunId,
          "failed",
          error instanceof Error ? error.message.slice(0, 500) : "DNCP supplier anchor failed.",
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
      // Ignore close errors if the connection was already closed earlier.
    }
  }
}
