import { Readable } from "node:stream";
import { parse } from "csv-parse";
import type { Client } from "pg";
import { fetchJson } from "../lib/http";
import {
  coreEntityName,
  normalizeEntityName,
  normalizeLooseIdentifier,
  splitSemicolonList,
} from "../lib/entityNames";
import { writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";

const OPEN_SANCTIONS_INDEX_URL = "https://data.opensanctions.org/datasets/latest/default/index.json";
const OPEN_SANCTIONS_SOURCE_KEY = "ext-opensanctions-default";
const MAX_REVIEW_CANDIDATES = 300;
const MAX_REJECTED_DIAGNOSTICS = 300;
const MAX_CANDIDATES_PER_EXTERNAL_ROW = 5;

interface OpenSanctionsResource {
  name: string;
  url: string;
  size?: number;
  title?: string;
}

interface OpenSanctionsIndex {
  updated_at: string;
  version: string;
  entity_count: number;
  target_count: number;
  resources: OpenSanctionsResource[];
  datasets?: string[];
}

interface OpenSanctionsSimpleRow {
  id: string;
  schema: string;
  name: string;
  aliases: string;
  birth_date: string;
  countries: string;
  addresses: string;
  identifiers: string;
  sanctions: string;
  phones: string;
  emails: string;
  program_ids: string;
  dataset: string;
  first_seen: string;
  last_seen: string;
  last_change: string;
}

interface LocalEntityRow {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  identifier_refs: string[] | null;
  local_profile_names: string[] | null;
  local_profile_source_keys: string[] | null;
  source_keys: string[] | null;
  total_process_count: string;
  supplier_process_count: string;
  total_risk_signals: string;
}

interface LocalRepresentativeRow {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  local_profile_source_keys: string[] | null;
  source_keys: string[] | null;
  linked_company_ids: string[] | null;
  linked_company_names: string[] | null;
  linked_company_count: string;
  total_process_count: string;
  supplier_process_count: string;
  total_risk_signals: string;
}

type LocalScreeningRole = "supplier_company" | "legal_representative";

interface LocalEntityCandidate {
  entityId: number;
  canonicalName: string;
  entityType: string;
  localScreeningRole: LocalScreeningRole;
  identifierRefs: string[];
  searchNames: string[];
  localProfileSourceKeys: string[];
  sourceKeys: string[];
  linkedCompanyIds: number[];
  linkedCompanyNames: string[];
  linkedCompanyCount: number;
  totalProcessCount: number;
  supplierProcessCount: number;
  totalRiskSignals: number;
  normalizedName: string;
  coreName: string;
  normalizedSearchNames: string[];
  coreSearchNames: string[];
  normalizedIdentifiers: string[];
}

type MatchQuality = "high" | "medium" | "review";

interface MatchCandidate {
  entityId: number;
  externalId: string;
  localScreeningRole: LocalScreeningRole;
  matchMethod: "identifier_exact" | "name_exact" | "core_name_exact" | "representative_name_exact_py_supported";
  matchConfidence: number;
  matchQuality: MatchQuality;
  matchedName: string;
  identifierOverlap: string[];
  localIdentitySourceKeys: string[];
  localSearchNames: string[];
  linkedCompanyIds: number[];
  linkedCompanyNames: string[];
}

type EnrichmentCandidateStatus = "review_candidate" | "rejected_diagnostic";

interface ReviewOnlyCandidate {
  entityId: number;
  externalId: string;
  externalName: string;
  externalSchema: string;
  externalEntityType: "company" | "person" | "institution" | "unknown";
  localScreeningRole: LocalScreeningRole;
  candidateStatus: EnrichmentCandidateStatus;
  matchMethod:
    | "company_name_token_overlap_py_supported"
    | "company_core_name_without_paraguay_support"
    | "representative_name_exact_py_supported"
    | "representative_name_token_overlap_py_supported"
    | "representative_partial_name_overlap_py_supported"
    | "representative_name_exact_without_paraguay_support";
  matchConfidence: number;
  matchQuality: "review" | "diagnostic";
  reviewStatus: "unreviewed";
  rejectionReason: string | null;
  rationale: string;
  matchedName: string;
  localSearchName: string;
  localScreeningName: string;
  tokenSimilarity: number;
  sharedTokens: string[];
  localIdentitySourceKeys: string[];
  localSearchNames: string[];
  linkedCompanyIds: number[];
  linkedCompanyNames: string[];
  datasets: string[];
  countries: string[];
  evidence: Array<Record<string, unknown>>;
  externalPayload: Record<string, unknown>;
}

interface ExternalRiskSignalSeed {
  entityId: number;
  externalId: string;
  signalCode: string;
  signalName: string;
  category: string;
  severity: "low" | "medium" | "high";
  score: number;
  rationale: string;
  evidence: Array<Record<string, unknown>>;
}

interface EnrichmentSummary {
  sourceKey: string;
  fetchedAt: string;
  indexVersion: string;
  screenedCompanyCount: number;
  screenedRepresentativeCount: number;
  openSanctionsTargetCount: number;
  matchedExternalEntityCount: number;
  localEntityMatchCount: number;
  companyMatchCount: number;
  representativeCandidateMatchCount: number;
  reviewCandidateCount: number;
  rejectedDiagnosticCount: number;
  candidateLocalEntityCount: number;
  externalRiskSignalCount: number;
  matchedEntities: Array<{
    entityId: number;
    entityName: string;
    entityType: string;
    localScreeningRole: LocalScreeningRole;
    externalId: string;
    externalName: string;
    matchMethod: string;
    matchQuality: MatchQuality;
    matchConfidence: number;
    datasets: string[];
    countries: string[];
    signalCodes: string[];
    linkedCompanyNames: string[];
  }>;
  reviewCandidates: Array<{
    entityId: number;
    entityName: string;
    entityType: string;
    localScreeningRole: LocalScreeningRole;
    externalId: string;
    externalName: string;
    candidateStatus: EnrichmentCandidateStatus;
    matchMethod: string;
    matchConfidence: number;
    rejectionReason: string | null;
    rationale: string;
    datasets: string[];
    countries: string[];
    linkedCompanyNames: string[];
  }>;
}

type EnrichmentReportMatch = EnrichmentSummary["matchedEntities"][number];
type EnrichmentReportCandidate = EnrichmentSummary["reviewCandidates"][number];

function toNumber(value: string): number {
  return Number(value);
}

function asTextArray(value: string[] | null | undefined): string[] {
  return (value ?? []).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

const CANDIDATE_STOP_TOKENS = new Set([
  "sa",
  "srl",
  "saci",
  "saeca",
  "cia",
  "ltda",
  "sociedad",
  "anonima",
  "empresa",
  "comercial",
  "importadora",
  "exportadora",
  "servicios",
  "grupo",
  "group",
  "consorcio",
  "asociados",
  "asociado",
  "asociada",
  "del",
  "los",
  "las",
  "para",
]);

function candidateNameTokens(value: string): string[] {
  return unique(
    normalizeEntityName(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !CANDIDATE_STOP_TOKENS.has(token)),
  );
}

function tokenSimilarity(leftTokens: string[], rightTokens: string[]): { score: number; sharedTokens: string[] } {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return { score: 0, sharedTokens: [] };
  }

  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const sharedTokens = [...left].filter((token) => right.has(token));
  const union = new Set([...left, ...right]);
  const jaccard = sharedTokens.length / union.size;
  const containment = Math.max(sharedTokens.length / left.size, sharedTokens.length / right.size);

  return {
    score: Math.max(jaccard, containment * 0.92),
    sharedTokens,
  };
}

function externalPayload(row: OpenSanctionsSimpleRow): Record<string, unknown> {
  return {
    id: row.id,
    schema: row.schema,
    name: row.name,
    aliases: splitSemicolonList(row.aliases),
    countries: splitSemicolonList(row.countries),
    datasets: splitSemicolonList(row.dataset),
    identifiers: splitSemicolonList(row.identifiers),
    sanctions: splitSemicolonList(row.sanctions),
    programIds: splitSemicolonList(row.program_ids),
    firstSeen: row.first_seen || null,
    lastSeen: row.last_seen || null,
    lastChange: row.last_change || null,
  };
}

function comparableLocalIdentifierValues(identifierRefs: string[]): string[] {
  return identifierRefs.flatMap((identifierRef) => {
    const separatorIndex = identifierRef.indexOf(":");
    const scheme = separatorIndex >= 0 ? identifierRef.slice(0, separatorIndex).toUpperCase() : "";
    const value = separatorIndex >= 0 ? identifierRef.slice(separatorIndex + 1) : identifierRef;

    if (!["PY-RUC", "PY-RUC-PLAIN"].includes(scheme)) {
      return [];
    }

    const normalized = value.replace(/^PY-RUC-/i, "");
    return normalized.length > 0 ? [normalized] : [];
  });
}

function hasParaguaySupport(row: OpenSanctionsSimpleRow): boolean {
  const countries = splitSemicolonList(row.countries).map((country) => country.toLowerCase());
  const datasets = splitSemicolonList(row.dataset).map((dataset) => dataset.toLowerCase());

  return (
    countries.some((country) => ["py", "pry", "paraguay"].includes(country)) ||
    datasets.some((dataset) => dataset.includes("paraguay"))
  );
}

function isScreenableRepresentativeName(value: string): boolean {
  const normalized = normalizeEntityName(value);
  const tokens = normalized.split(" ").filter((token) => token.length >= 2);

  return (
    normalized.length >= 10 &&
    tokens.length >= 2 &&
    !includesOneOf(normalized, ["NO APLICA", "SIN REPRESENTANTE", "SIN DATOS", "NO INFORMADO"])
  );
}

function formatConfidence(value: number): string {
  return value.toFixed(2);
}

function preferredQuality(left: MatchQuality, right: MatchQuality): MatchQuality {
  const order = new Map<MatchQuality, number>([
    ["high", 3],
    ["medium", 2],
    ["review", 1],
  ]);

  return (order.get(left) ?? 0) >= (order.get(right) ?? 0) ? left : right;
}

function mapExternalEntityType(schema: string): "company" | "person" | "institution" | "unknown" {
  const normalized = schema.toLowerCase();
  if (normalized.includes("company") || normalized.includes("legalentity") || normalized.includes("organization")) {
    return "company";
  }

  if (normalized.includes("person")) {
    return "person";
  }

  if (normalized.includes("publicbody")) {
    return "institution";
  }

  return "unknown";
}

function buildLocalEntityLookup(localEntities: LocalEntityCandidate[]): {
  byExactName: Map<string, LocalEntityCandidate[]>;
  byCoreName: Map<string, LocalEntityCandidate[]>;
  byIdentifier: Map<string, LocalEntityCandidate[]>;
  byCandidateToken: Map<string, LocalEntityCandidate[]>;
} {
  const byExactName = new Map<string, LocalEntityCandidate[]>();
  const byCoreName = new Map<string, LocalEntityCandidate[]>();
  const byIdentifier = new Map<string, LocalEntityCandidate[]>();
  const byCandidateToken = new Map<string, LocalEntityCandidate[]>();

  function append(map: Map<string, LocalEntityCandidate[]>, key: string, entity: LocalEntityCandidate): void {
    if (!key) {
      return;
    }

    const existing = map.get(key);
    if (existing) {
      existing.push(entity);
      return;
    }

    map.set(key, [entity]);
  }

  for (const entity of localEntities) {
    for (const normalizedName of entity.normalizedSearchNames) {
      append(byExactName, normalizedName, entity);
    }

    for (const coreName of entity.coreSearchNames) {
      if (coreName.length >= 8) {
        append(byCoreName, coreName, entity);
      }
    }

    for (const identifier of entity.normalizedIdentifiers) {
      append(byIdentifier, identifier, entity);
    }

    const candidateTokens = unique(
      entity.searchNames.flatMap((name) =>
        candidateNameTokens(entity.localScreeningRole === "supplier_company" ? coreEntityName(name) : name),
      ),
    );
    for (const token of candidateTokens) {
      append(byCandidateToken, token, entity);
    }
  }

  return {
    byExactName,
    byCoreName,
    byIdentifier,
    byCandidateToken,
  };
}

function registerCandidate(
  matches: Map<string, MatchCandidate>,
  candidate: MatchCandidate,
): void {
  const key = `${candidate.entityId}:${candidate.externalId}`;
  const existing = matches.get(key);

  if (!existing) {
    matches.set(key, candidate);
    return;
  }

  if (candidate.matchConfidence > existing.matchConfidence) {
    matches.set(key, candidate);
    return;
  }

  if (candidate.matchConfidence === existing.matchConfidence) {
    matches.set(key, {
      ...existing,
      matchQuality: preferredQuality(candidate.matchQuality, existing.matchQuality),
      identifierOverlap: unique([...existing.identifierOverlap, ...candidate.identifierOverlap]),
      matchedName: existing.matchedName.length >= candidate.matchedName.length ? existing.matchedName : candidate.matchedName,
      localIdentitySourceKeys: unique([...existing.localIdentitySourceKeys, ...candidate.localIdentitySourceKeys]),
      localSearchNames: unique([...existing.localSearchNames, ...candidate.localSearchNames]),
      linkedCompanyIds: unique([...existing.linkedCompanyIds.map(String), ...candidate.linkedCompanyIds.map(String)]).map(Number),
      linkedCompanyNames: unique([...existing.linkedCompanyNames, ...candidate.linkedCompanyNames]),
    });
  }
}

function reviewCandidateKey(candidate: ReviewOnlyCandidate): string {
  return `${candidate.entityId}:${candidate.externalId}:${candidate.localScreeningRole}:${candidate.matchMethod}`;
}

function registerReviewOnlyCandidate(
  candidates: Map<string, ReviewOnlyCandidate>,
  candidate: ReviewOnlyCandidate,
): void {
  const key = reviewCandidateKey(candidate);
  const existing = candidates.get(key);

  if (!existing || candidate.matchConfidence > existing.matchConfidence) {
    candidates.set(key, candidate);
  }
}

function pruneReviewOnlyCandidates(candidates: Map<string, ReviewOnlyCandidate>): void {
  const reviewCandidates = [...candidates.values()]
    .filter((candidate) => candidate.candidateStatus === "review_candidate")
    .sort((left, right) => right.matchConfidence - left.matchConfidence)
    .slice(0, MAX_REVIEW_CANDIDATES);
  const rejectedDiagnostics = [...candidates.values()]
    .filter((candidate) => candidate.candidateStatus === "rejected_diagnostic")
    .sort((left, right) => right.matchConfidence - left.matchConfidence)
    .slice(0, MAX_REJECTED_DIAGNOSTICS);

  candidates.clear();
  for (const candidate of [...reviewCandidates, ...rejectedDiagnostics]) {
    candidates.set(reviewCandidateKey(candidate), candidate);
  }
}

function includesOneOf(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function datasetsContainOneOf(datasets: string[], needles: string[]): boolean {
  const normalized = datasets.map((dataset) => dataset.toLowerCase());
  return normalized.some((dataset) => includesOneOf(dataset, needles));
}

function buildExternalSignals(
  entityId: number,
  externalId: string,
  row: OpenSanctionsSimpleRow,
): ExternalRiskSignalSeed[] {
  const datasets = splitSemicolonList(row.dataset);
  const sanctions = splitSemicolonList(row.sanctions);
  const signals: ExternalRiskSignalSeed[] = [];

  if (
    sanctions.length > 0 ||
    datasetsContainOneOf(datasets, [
      "sanction",
      "specially designated",
      "asset freezing",
      "financial sanctions",
      "trade consolidated screening list",
      "embargo",
      "magnitsky",
      "terrorist",
    ])
  ) {
    signals.push({
      entityId,
      externalId,
      signalCode: "EXT-OS-SANCTION",
      signalName: "OpenSanctions sanctions-linked match",
      category: "sanction",
      severity: "high",
      score: 90,
      rationale: `Matched OpenSanctions entity linked to sanctions-style datasets: ${datasets.join(", ")}.`,
      evidence: [
        { type: "datasets", value: datasets },
        { type: "sanctions", value: sanctions },
        { type: "program_ids", value: splitSemicolonList(row.program_ids) },
      ],
    });
  }

  if (datasetsContainOneOf(datasets, ["debar", "exclusion", "ineligible", "procurement exclusions", "edes"])) {
    signals.push({
      entityId,
      externalId,
      signalCode: "EXT-OS-DEBARMENT",
      signalName: "OpenSanctions procurement exclusion or debarment match",
      category: "debarment",
      severity: "high",
      score: 82,
      rationale: `Matched OpenSanctions entity linked to exclusion or debarment datasets: ${datasets.join(", ")}.`,
      evidence: [
        { type: "datasets", value: datasets },
        { type: "sanctions", value: sanctions },
      ],
    });
  }

  if (datasetsContainOneOf(datasets, ["offshore leaks", "panama papers", "paradise papers", "pandora papers", "bahamas leaks"])) {
    signals.push({
      entityId,
      externalId,
      signalCode: "EXT-OS-OFFSHORE",
      signalName: "OpenSanctions offshore-network match",
      category: "offshore",
      severity: "medium",
      score: 68,
      rationale: `Matched OpenSanctions entity linked to offshore-network datasets: ${datasets.join(", ")}.`,
      evidence: [
        { type: "datasets", value: datasets },
        { type: "countries", value: splitSemicolonList(row.countries) },
      ],
    });
  }

  if (
    mapExternalEntityType(row.schema) === "person" &&
    datasetsContainOneOf(datasets, ["pep", "legislator", "parliament", "senate", "assembly", "official", "mayor", "councillor"])
  ) {
    signals.push({
      entityId,
      externalId,
      signalCode: "EXT-OS-PEP",
      signalName: "OpenSanctions PEP-linked match",
      category: "pep",
      severity: "medium",
      score: 62,
      rationale: `Matched OpenSanctions person linked to politically exposed person or office-holder datasets: ${datasets.join(", ")}.`,
      evidence: [
        { type: "datasets", value: datasets },
        { type: "countries", value: splitSemicolonList(row.countries) },
      ],
    });
  }

  if (datasetsContainOneOf(datasets, ["wanted", "red notices", "fugitive", "terror", "enforcement"])) {
    signals.push({
      entityId,
      externalId,
      signalCode: "EXT-OS-WATCHLIST",
      signalName: "OpenSanctions watchlist or enforcement match",
      category: "watchlist",
      severity: "high",
      score: 78,
      rationale: `Matched OpenSanctions entity linked to wanted, notice, or enforcement datasets: ${datasets.join(", ")}.`,
      evidence: [
        { type: "datasets", value: datasets },
        { type: "program_ids", value: splitSemicolonList(row.program_ids) },
      ],
    });
  }

  return signals;
}

function renderEnrichmentReport(summary: EnrichmentSummary): string {
  const lines: string[] = [];
  lines.push("# OpenSanctions entity enrichment summary");
  lines.push("");
  lines.push("This report contains external matches and risk leads for review, not proof of wrongdoing.");
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Source key: ${summary.sourceKey}`);
  lines.push(`- OpenSanctions index version: ${summary.indexVersion}`);
  lines.push(`- Fetched at: ${summary.fetchedAt}`);
  lines.push(`- Paraguay supplier/company entities screened: ${summary.screenedCompanyCount}`);
  lines.push(`- DNCP legal representative/person entities screened: ${summary.screenedRepresentativeCount}`);
  lines.push(`- OpenSanctions target rows scanned: ${summary.openSanctionsTargetCount}`);
  lines.push(`- Distinct matched external entities: ${summary.matchedExternalEntityCount}`);
  lines.push(`- Local entities with at least one match: ${summary.localEntityMatchCount}`);
  lines.push(`- Company matches stored: ${summary.companyMatchCount}`);
  lines.push(`- Representative review candidates stored: ${summary.representativeCandidateMatchCount}`);
  lines.push(`- Review-only near candidates stored: ${summary.reviewCandidateCount}`);
  lines.push(`- Rejected diagnostics stored: ${summary.rejectedDiagnosticCount}`);
  lines.push(`- Local entities with candidate records: ${summary.candidateLocalEntityCount}`);
  lines.push(`- External risk signals written: ${summary.externalRiskSignalCount}`);
  lines.push("");
  lines.push("## Highest-priority matched entities");
  lines.push("");

  if (summary.matchedEntities.length === 0) {
    lines.push(
      "- No current OpenSanctions matches met Centinela's conservative company or Paraguay-supported representative/person thresholds in the screened population.",
    );
  } else {
    for (const match of summary.matchedEntities.slice(0, 20)) {
      lines.push(`- [${match.localScreeningRole}] ${match.entityName} -> ${match.externalName}`);
      lines.push(`  method=${match.matchMethod}, quality=${match.matchQuality}, confidence=${formatConfidence(match.matchConfidence)}`);
      lines.push(`  datasets=${match.datasets.join(", ") || "n/a"}, countries=${match.countries.join(", ") || "n/a"}, signals=${match.signalCodes.join(", ") || "identity-only"}`);
      if (match.linkedCompanyNames.length > 0) {
        lines.push(`  linked_companies=${match.linkedCompanyNames.slice(0, 5).join(", ")}`);
      }
    }
  }

  lines.push("");
  lines.push("## Review-only external candidates");
  lines.push("");

  if (summary.reviewCandidates.length === 0) {
    lines.push("- No near-match or rejected-diagnostic candidate records were stored in this run.");
  } else {
    for (const candidate of summary.reviewCandidates.slice(0, 30)) {
      lines.push(`- [${candidate.candidateStatus}/${candidate.localScreeningRole}] ${candidate.entityName} -> ${candidate.externalName}`);
      lines.push(`  method=${candidate.matchMethod}, confidence=${formatConfidence(candidate.matchConfidence)}, rejection=${candidate.rejectionReason ?? "n/a"}`);
      lines.push(`  datasets=${candidate.datasets.join(", ") || "n/a"}, countries=${candidate.countries.join(", ") || "n/a"}`);
      if (candidate.linkedCompanyNames.length > 0) {
        lines.push(`  linked_companies=${candidate.linkedCompanyNames.slice(0, 5).join(", ")}`);
      }
      lines.push(`  rationale=${candidate.rationale}`);
    }
  }

  lines.push("");
  lines.push("## Analyst notes");
  lines.push("");
  lines.push("- The hosted OpenSanctions matching API currently requires authentication, so this connector uses the public bulk `default` dataset instead.");
  lines.push("- Matches are intentionally conservative: exact normalized names first, then cautious core-name matches where the evidence is still reviewable.");
  lines.push("- Local screening now uses procurement names plus official DNCP/DNIT profile names and comparable Paraguay RUC identifiers, while excluding source-specific registry codes from identifier matching.");
  lines.push("- DNCP legal representatives are screened separately from companies. Exact person-name agreement with Paraguay support can become a review candidate; weaker two-token person overlaps are kept as diagnostics unless stronger source evidence is added.");
  lines.push("- Near-match candidates and rejected diagnostics are stored separately from accepted matches. They are analyst leads or audit trail, not positive identity resolution.");
  lines.push("- External matches expand context and investigation options; they do not replace Paraguayan source facts or establish legal conclusions.");
  lines.push("- OpenOwnership, OpenCorporates, and ICIJ become more valuable in the next phase once Centinela has a stable company-identity and match-review spine.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function fetchOpenSanctionsIndex(): Promise<OpenSanctionsIndex> {
  return fetchJson<OpenSanctionsIndex>(OPEN_SANCTIONS_INDEX_URL);
}

async function queryLocalCompanyEntities(client: Client, schema: string): Promise<LocalEntityCandidate[]> {
  const result = await client.query<LocalEntityRow>(
    `select
       activity.entity_id::text,
       entities.canonical_name,
       entities.entity_type,
       array_remove(
         array_agg(
           distinct case
             when identifiers.value is not null then identifiers.scheme || ':' || identifiers.value
             else null
           end
         ),
         null
       ) as identifier_refs,
       array_remove(array_agg(distinct nullif(local_profiles.official_name, '')), null) as local_profile_names,
       array_remove(array_agg(distinct local_profiles.source_key), null) as local_profile_source_keys,
       activity.source_keys,
       activity.total_process_count::text,
       activity.supplier_process_count::text,
       activity.total_risk_signals::text
     from ${schema}.entity_procurement_activity as activity
     join ${schema}.entities
       on entities.id = activity.entity_id
     left join ${schema}.entity_identifiers as identifiers
       on identifiers.entity_id = activity.entity_id
     left join ${schema}.entity_local_profile_overview as local_profiles
       on local_profiles.entity_id = activity.entity_id
     where entities.entity_type = 'company'
       and activity.supplier_process_count > 0
     group by
       activity.entity_id,
       entities.canonical_name,
       entities.entity_type,
       activity.source_keys,
       activity.total_process_count,
       activity.supplier_process_count,
       activity.total_risk_signals
     order by activity.total_risk_signals desc, activity.total_process_count desc`,
  );

  return result.rows.map((row) => {
    const identifierRefs = asTextArray(row.identifier_refs);
    const searchNames = unique([row.canonical_name, ...asTextArray(row.local_profile_names)]);
    const normalizedSearchNames = unique(searchNames.map((name) => normalizeEntityName(name)).filter(Boolean));
    const coreSearchNames = unique(searchNames.map((name) => coreEntityName(name)).filter((name) => name.length >= 8));

    return {
      entityId: Number(row.entity_id),
      canonicalName: row.canonical_name,
      entityType: row.entity_type,
      localScreeningRole: "supplier_company",
      identifierRefs,
      searchNames,
      localProfileSourceKeys: asTextArray(row.local_profile_source_keys),
      sourceKeys: asTextArray(row.source_keys),
      linkedCompanyIds: [],
      linkedCompanyNames: [],
      linkedCompanyCount: 0,
      totalProcessCount: toNumber(row.total_process_count),
      supplierProcessCount: toNumber(row.supplier_process_count),
      totalRiskSignals: toNumber(row.total_risk_signals),
      normalizedName: normalizeEntityName(row.canonical_name),
      coreName: coreEntityName(row.canonical_name),
      normalizedSearchNames,
      coreSearchNames,
      normalizedIdentifiers: unique(
        comparableLocalIdentifierValues(identifierRefs)
          .map((identifier) => normalizeLooseIdentifier(identifier))
          .filter(Boolean),
      ),
    };
  });
}

async function queryLocalRepresentativeEntities(client: Client, schema: string): Promise<LocalEntityCandidate[]> {
  const result = await client.query<LocalRepresentativeRow>(
    `with representative_company_links as (
       select distinct
         representatives.representative_entity_id,
         representatives.representative_name,
         representatives.entity_id as company_entity_id,
         representatives.entity_name as company_name,
         representatives.source_key as representative_source_key
       from ${schema}.entity_representative_overview as representatives
       where representatives.representative_entity_id is not null
         and representatives.representative_name is not null
         and length(trim(representatives.representative_name)) > 0
     ),
     company_activity as (
       select
         links.representative_entity_id,
         coalesce(sum(activity.total_process_count), 0)::text as total_process_count,
         coalesce(sum(activity.supplier_process_count), 0)::text as supplier_process_count,
         coalesce(sum(activity.total_risk_signals), 0)::text as total_risk_signals
       from (
         select distinct representative_entity_id, company_entity_id
         from representative_company_links
       ) as links
       join ${schema}.entity_procurement_activity as activity
         on activity.entity_id = links.company_entity_id
       group by links.representative_entity_id
     ),
     source_rollup as (
       select
         links.representative_entity_id,
         array_remove(array_agg(distinct activity_source.source_key), null) as source_keys
       from (
         select distinct representative_entity_id, company_entity_id
         from representative_company_links
       ) as links
       join ${schema}.entity_procurement_activity as activity
         on activity.entity_id = links.company_entity_id
       left join lateral unnest(activity.source_keys) as activity_source(source_key)
         on true
       group by links.representative_entity_id
     )
     select
       links.representative_entity_id::text as entity_id,
       min(links.representative_name) as canonical_name,
       'person' as entity_type,
       array_remove(array_agg(distinct links.representative_source_key), null) as local_profile_source_keys,
       coalesce(source_rollup.source_keys, '{}'::text[]) as source_keys,
       array_remove(array_agg(distinct links.company_entity_id::text), null) as linked_company_ids,
       array_remove(array_agg(distinct links.company_name), null) as linked_company_names,
       count(distinct links.company_entity_id)::text as linked_company_count,
       coalesce(company_activity.total_process_count, '0') as total_process_count,
       coalesce(company_activity.supplier_process_count, '0') as supplier_process_count,
       coalesce(company_activity.total_risk_signals, '0') as total_risk_signals
     from representative_company_links as links
     left join company_activity
       on company_activity.representative_entity_id = links.representative_entity_id
     left join source_rollup
       on source_rollup.representative_entity_id = links.representative_entity_id
     group by
       links.representative_entity_id,
       company_activity.total_process_count,
       company_activity.supplier_process_count,
       company_activity.total_risk_signals,
       source_rollup.source_keys
     order by count(distinct links.company_entity_id) desc, min(links.representative_name)`,
  );

  return result.rows.flatMap((row) => {
    if (!isScreenableRepresentativeName(row.canonical_name)) {
      return [];
    }

    const searchNames = unique([row.canonical_name]);
    const normalizedSearchNames = unique(searchNames.map((name) => normalizeEntityName(name)).filter(Boolean));

    return [
      {
        entityId: Number(row.entity_id),
        canonicalName: row.canonical_name,
        entityType: row.entity_type,
        localScreeningRole: "legal_representative" as const,
        identifierRefs: [],
        searchNames,
        localProfileSourceKeys: asTextArray(row.local_profile_source_keys),
        sourceKeys: asTextArray(row.source_keys),
        linkedCompanyIds: asTextArray(row.linked_company_ids).map(Number).filter((value) => Number.isFinite(value)),
        linkedCompanyNames: asTextArray(row.linked_company_names),
        linkedCompanyCount: toNumber(row.linked_company_count),
        totalProcessCount: toNumber(row.total_process_count),
        supplierProcessCount: toNumber(row.supplier_process_count),
        totalRiskSignals: toNumber(row.total_risk_signals),
        normalizedName: normalizeEntityName(row.canonical_name),
        coreName: coreEntityName(row.canonical_name),
        normalizedSearchNames,
        coreSearchNames: [],
        normalizedIdentifiers: [],
      },
    ];
  });
}

function buildCandidateMatches(
  row: OpenSanctionsSimpleRow,
  lookup: ReturnType<typeof buildLocalEntityLookup>,
): MatchCandidate[] {
  const externalEntityType = mapExternalEntityType(row.schema);
  if (!["company", "person"].includes(externalEntityType)) {
    return [];
  }

  const matches = new Map<string, MatchCandidate>();
  const externalNames = unique([row.name, ...splitSemicolonList(row.aliases)]);
  const externalNormalizedNames = unique(externalNames.map((name) => normalizeEntityName(name)).filter(Boolean));
  const externalCoreNames = unique(externalNames.map((name) => coreEntityName(name)).filter((name) => name.length >= 8));
  const externalIdentifiers = unique(
    splitSemicolonList(row.identifiers).map((identifier) => normalizeLooseIdentifier(identifier)).filter(Boolean),
  );
  const normalizedCountries = splitSemicolonList(row.countries).map((country) => country.toLowerCase());
  const hasParaguayCountryOrDataset = hasParaguaySupport(row);

  if (externalEntityType === "company") {
    for (const identifier of externalIdentifiers) {
      for (const entity of (lookup.byIdentifier.get(identifier) ?? []).filter(
        (candidate) => candidate.localScreeningRole === "supplier_company",
      )) {
        registerCandidate(matches, {
          entityId: entity.entityId,
          externalId: row.id,
          localScreeningRole: entity.localScreeningRole,
          matchMethod: "identifier_exact",
          matchConfidence: 0.99,
          matchQuality: "high",
          matchedName: row.name,
          identifierOverlap: [identifier],
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
        });
      }
    }
  }

  for (const normalizedName of externalNormalizedNames) {
    const exactEntities = lookup.byExactName.get(normalizedName) ?? [];
    if (exactEntities.length > 5) {
      continue;
    }

    for (const entity of exactEntities) {
      if (externalEntityType === "company" && entity.localScreeningRole === "supplier_company") {
        registerCandidate(matches, {
          entityId: entity.entityId,
          externalId: row.id,
          localScreeningRole: entity.localScreeningRole,
          matchMethod: "name_exact",
          matchConfidence: normalizedCountries.includes("py") ? 0.96 : 0.91,
          matchQuality: normalizedCountries.includes("py") ? "high" : "medium",
          matchedName: row.name,
          identifierOverlap: [],
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
        });
      }

    }
  }

  if (externalEntityType !== "company") {
    return [...matches.values()];
  }

  const allowCoreNameMatches = normalizedCountries.includes("py");

  if (allowCoreNameMatches) {
    for (const coreName of externalCoreNames) {
      const coreEntities = (lookup.byCoreName.get(coreName) ?? []).filter(
        (candidate) => candidate.localScreeningRole === "supplier_company",
      );
      if (coreEntities.length === 0 || coreEntities.length > 2) {
        continue;
      }

      for (const entity of coreEntities) {
        registerCandidate(matches, {
          entityId: entity.entityId,
          externalId: row.id,
          localScreeningRole: entity.localScreeningRole,
          matchMethod: "core_name_exact",
          matchConfidence: 0.76,
          matchQuality: "review",
          matchedName: row.name,
          identifierOverlap: [],
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
        });
      }
    }
  }

  return [...matches.values()];
}

function buildReviewOnlyCandidates(
  row: OpenSanctionsSimpleRow,
  lookup: ReturnType<typeof buildLocalEntityLookup>,
  acceptedMatches: MatchCandidate[],
): ReviewOnlyCandidate[] {
  const externalEntityType = mapExternalEntityType(row.schema);
  if (!["company", "person"].includes(externalEntityType)) {
    return [];
  }

  const acceptedKeys = new Set(acceptedMatches.map((match) => `${match.entityId}:${match.externalId}`));
  const hasParaguayCountryOrDataset = hasParaguaySupport(row);
  const externalNames = unique([row.name, ...splitSemicolonList(row.aliases)]);
  const datasets = splitSemicolonList(row.dataset);
  const countries = splitSemicolonList(row.countries);
  const candidates = new Map<string, ReviewOnlyCandidate>();

  for (const externalName of externalNames) {
    const normalizedExternalName = normalizeEntityName(externalName);
    const externalTokens = candidateNameTokens(externalEntityType === "company" ? coreEntityName(externalName) : externalName);
    if (externalTokens.length < 2) {
      continue;
    }

    const localCandidatePool = new Map<number, LocalEntityCandidate>();
    for (const token of externalTokens) {
      const tokenMatches = lookup.byCandidateToken.get(token) ?? [];
      if (tokenMatches.length > 80) {
        continue;
      }

      for (const entity of tokenMatches) {
        localCandidatePool.set(entity.entityId, entity);
      }
    }

    for (const entity of localCandidatePool.values()) {
      if (acceptedKeys.has(`${entity.entityId}:${row.id}`)) {
        continue;
      }

      if (externalEntityType === "company" && entity.localScreeningRole !== "supplier_company") {
        continue;
      }

      if (externalEntityType === "person" && entity.localScreeningRole !== "legal_representative") {
        continue;
      }

      const bestLocal = entity.searchNames
        .map((localName) => {
          const screeningName = entity.localScreeningRole === "supplier_company" ? coreEntityName(localName) : localName;
          const localTokens = candidateNameTokens(screeningName);
          const similarity = tokenSimilarity(localTokens, externalTokens);

          return {
            localName,
            screeningName,
            score: similarity.score,
            sharedTokens: similarity.sharedTokens,
          };
        })
        .sort((left, right) => right.score - left.score)[0];

      if (!bestLocal) {
        continue;
      }

      const exactNormalizedName = entity.normalizedSearchNames.includes(normalizedExternalName);
      const evidence = [
        { type: "local_screening_role", value: entity.localScreeningRole },
        { type: "local_search_name", value: bestLocal.localName },
        { type: "external_name", value: externalName },
        { type: "shared_tokens", value: bestLocal.sharedTokens },
        { type: "token_similarity", value: Number(bestLocal.score.toFixed(4)) },
        { type: "paraguay_support", value: hasParaguayCountryOrDataset },
        { type: "datasets", value: datasets },
        { type: "countries", value: countries },
        { type: "local_identity_sources", value: entity.localProfileSourceKeys },
        { type: "linked_company_names", value: entity.linkedCompanyNames },
      ];

      if (
        externalEntityType === "company" &&
        hasParaguayCountryOrDataset &&
        bestLocal.score >= 0.82 &&
        bestLocal.sharedTokens.length >= 2
      ) {
        registerReviewOnlyCandidate(candidates, {
          entityId: entity.entityId,
          externalId: row.id,
          externalName: row.name,
          externalSchema: row.schema,
          externalEntityType,
          localScreeningRole: entity.localScreeningRole,
          candidateStatus: "review_candidate",
          matchMethod: "company_name_token_overlap_py_supported",
          matchConfidence: Math.min(0.82, 0.58 + bestLocal.score * 0.24),
          matchQuality: "review",
          reviewStatus: "unreviewed",
          rejectionReason: null,
          rationale: `Review-only company candidate: local name "${bestLocal.localName}" and OpenSanctions name "${externalName}" have high token overlap with Paraguay support. This is not an accepted match.`,
          matchedName: externalName,
          localSearchName: bestLocal.localName,
          localScreeningName: bestLocal.screeningName,
          tokenSimilarity: bestLocal.score,
          sharedTokens: bestLocal.sharedTokens,
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
          datasets,
          countries,
          evidence,
          externalPayload: externalPayload(row),
        });
        continue;
      }

      if (
        externalEntityType === "company" &&
        !hasParaguayCountryOrDataset &&
        bestLocal.score >= 0.94 &&
        bestLocal.sharedTokens.length >= 2
      ) {
        registerReviewOnlyCandidate(candidates, {
          entityId: entity.entityId,
          externalId: row.id,
          externalName: row.name,
          externalSchema: row.schema,
          externalEntityType,
          localScreeningRole: entity.localScreeningRole,
          candidateStatus: "rejected_diagnostic",
          matchMethod: "company_core_name_without_paraguay_support",
          matchConfidence: 0.48,
          matchQuality: "diagnostic",
          reviewStatus: "unreviewed",
          rejectionReason: "missing_paraguay_support",
          rationale: `Rejected diagnostic: company-name token overlap is high, but the OpenSanctions row lacks Paraguay country or dataset support. Kept for auditability, not review escalation.`,
          matchedName: externalName,
          localSearchName: bestLocal.localName,
          localScreeningName: bestLocal.screeningName,
          tokenSimilarity: bestLocal.score,
          sharedTokens: bestLocal.sharedTokens,
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
          datasets,
          countries,
          evidence,
          externalPayload: externalPayload(row),
        });
        continue;
      }

      if (
        externalEntityType === "person" &&
        hasParaguayCountryOrDataset &&
        exactNormalizedName &&
        isScreenableRepresentativeName(bestLocal.localName)
      ) {
        registerReviewOnlyCandidate(candidates, {
          entityId: entity.entityId,
          externalId: row.id,
          externalName: row.name,
          externalSchema: row.schema,
          externalEntityType,
          localScreeningRole: entity.localScreeningRole,
          candidateStatus: "review_candidate",
          matchMethod: "representative_name_exact_py_supported",
          matchConfidence: 0.74,
          matchQuality: "review",
          reviewStatus: "unreviewed",
          rejectionReason: null,
          rationale: `Review-only representative/person candidate: DNCP representative "${bestLocal.localName}" exactly matches OpenSanctions person "${externalName}" with Paraguay support. This is not an accepted identity match.`,
          matchedName: externalName,
          localSearchName: bestLocal.localName,
          localScreeningName: bestLocal.screeningName,
          tokenSimilarity: bestLocal.score,
          sharedTokens: bestLocal.sharedTokens,
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
          datasets,
          countries,
          evidence,
          externalPayload: externalPayload(row),
        });
        continue;
      }

      if (
        externalEntityType === "person" &&
        hasParaguayCountryOrDataset &&
        bestLocal.score >= 0.86 &&
        bestLocal.sharedTokens.length >= 3
      ) {
        registerReviewOnlyCandidate(candidates, {
          entityId: entity.entityId,
          externalId: row.id,
          externalName: row.name,
          externalSchema: row.schema,
          externalEntityType,
          localScreeningRole: entity.localScreeningRole,
          candidateStatus: "review_candidate",
          matchMethod: "representative_name_token_overlap_py_supported",
          matchConfidence: Math.min(0.72, 0.5 + bestLocal.score * 0.22),
          matchQuality: "review",
          reviewStatus: "unreviewed",
          rejectionReason: null,
          rationale: `Review-only representative/person candidate: DNCP representative "${bestLocal.localName}" and OpenSanctions person "${externalName}" have high token overlap with Paraguay support. This is not an accepted identity match.`,
          matchedName: externalName,
          localSearchName: bestLocal.localName,
          localScreeningName: bestLocal.screeningName,
          tokenSimilarity: bestLocal.score,
          sharedTokens: bestLocal.sharedTokens,
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
          datasets,
          countries,
          evidence,
          externalPayload: externalPayload(row),
        });
        continue;
      }

      if (
        externalEntityType === "person" &&
        hasParaguayCountryOrDataset &&
        bestLocal.score >= 0.86 &&
        bestLocal.sharedTokens.length >= 2
      ) {
        registerReviewOnlyCandidate(candidates, {
          entityId: entity.entityId,
          externalId: row.id,
          externalName: row.name,
          externalSchema: row.schema,
          externalEntityType,
          localScreeningRole: entity.localScreeningRole,
          candidateStatus: "rejected_diagnostic",
          matchMethod: "representative_partial_name_overlap_py_supported",
          matchConfidence: Math.min(0.46, 0.34 + bestLocal.score * 0.12),
          matchQuality: "diagnostic",
          reviewStatus: "unreviewed",
          rejectionReason: "partial_person_name_overlap_needs_more_evidence",
          rationale: `Rejected diagnostic: DNCP representative "${bestLocal.localName}" and OpenSanctions person "${externalName}" share only a partial person-name overlap with Paraguay support. Kept for auditability and future source-document comparison, not review escalation.`,
          matchedName: externalName,
          localSearchName: bestLocal.localName,
          localScreeningName: bestLocal.screeningName,
          tokenSimilarity: bestLocal.score,
          sharedTokens: bestLocal.sharedTokens,
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
          datasets,
          countries,
          evidence,
          externalPayload: externalPayload(row),
        });
        continue;
      }

      if (
        externalEntityType === "person" &&
        !hasParaguayCountryOrDataset &&
        exactNormalizedName &&
        isScreenableRepresentativeName(bestLocal.localName)
      ) {
        registerReviewOnlyCandidate(candidates, {
          entityId: entity.entityId,
          externalId: row.id,
          externalName: row.name,
          externalSchema: row.schema,
          externalEntityType,
          localScreeningRole: entity.localScreeningRole,
          candidateStatus: "rejected_diagnostic",
          matchMethod: "representative_name_exact_without_paraguay_support",
          matchConfidence: 0.52,
          matchQuality: "diagnostic",
          reviewStatus: "unreviewed",
          rejectionReason: "missing_paraguay_support",
          rationale: `Rejected diagnostic: DNCP representative name exactly matches an OpenSanctions person name, but the external row lacks Paraguay support. Kept for auditability, not review escalation.`,
          matchedName: externalName,
          localSearchName: bestLocal.localName,
          localScreeningName: bestLocal.screeningName,
          tokenSimilarity: bestLocal.score,
          sharedTokens: bestLocal.sharedTokens,
          localIdentitySourceKeys: entity.localProfileSourceKeys,
          localSearchNames: entity.searchNames,
          linkedCompanyIds: entity.linkedCompanyIds,
          linkedCompanyNames: entity.linkedCompanyNames,
          datasets,
          countries,
          evidence,
          externalPayload: externalPayload(row),
        });
      }
    }
  }

  return [...candidates.values()]
    .sort((left, right) => right.matchConfidence - left.matchConfidence)
    .slice(0, MAX_CANDIDATES_PER_EXTERNAL_ROW);
}

async function streamOpenSanctionsMatches(
  csvUrl: string,
  localEntities: LocalEntityCandidate[],
): Promise<{
  scannedRows: number;
  matchedRows: Map<string, OpenSanctionsSimpleRow>;
  candidateRows: Map<string, OpenSanctionsSimpleRow>;
  matchCandidates: MatchCandidate[];
  reviewOnlyCandidates: ReviewOnlyCandidate[];
  riskSignals: ExternalRiskSignalSeed[];
}> {
  const lookup = buildLocalEntityLookup(localEntities);
  const matchedRows = new Map<string, OpenSanctionsSimpleRow>();
  const candidateRows = new Map<string, OpenSanctionsSimpleRow>();
  const matchCandidates: MatchCandidate[] = [];
  const reviewOnlyCandidateMap = new Map<string, ReviewOnlyCandidate>();
  const riskSignals: ExternalRiskSignalSeed[] = [];

  const response = await fetch(csvUrl, {
    headers: {
      "user-agent": "Centinela/0.1 (+https://github.com/local/centinela)",
      accept: "text/csv, text/plain, */*",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenSanctions CSV fetch failed (${response.status}) for ${csvUrl}`);
  }

  const parser = parse({
    columns: true,
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
  });

  const stream = Readable.fromWeb(response.body as never).pipe(parser);
  let scannedRows = 0;
  const seenSignals = new Set<string>();

  for await (const rawRow of stream as AsyncIterable<Record<string, string>>) {
    scannedRows += 1;

    const row = rawRow as unknown as OpenSanctionsSimpleRow;
    if (!row.id || !row.name) {
      continue;
    }

    const matches = buildCandidateMatches(row, lookup);
    const reviewOnlyCandidates = buildReviewOnlyCandidates(row, lookup, matches);
    if (matches.length === 0 && reviewOnlyCandidates.length === 0) {
      continue;
    }

    if (matches.length > 0) {
      matchedRows.set(row.id, row);
    }

    if (reviewOnlyCandidates.length > 0) {
      candidateRows.set(row.id, row);
      for (const candidate of reviewOnlyCandidates) {
        registerReviewOnlyCandidate(reviewOnlyCandidateMap, candidate);
      }

      if (reviewOnlyCandidateMap.size > MAX_REVIEW_CANDIDATES + MAX_REJECTED_DIAGNOSTICS + 100) {
        pruneReviewOnlyCandidates(reviewOnlyCandidateMap);
      }
    }

    for (const match of matches) {
      matchCandidates.push(match);

      if (match.localScreeningRole !== "supplier_company") {
        continue;
      }

      for (const signal of buildExternalSignals(match.entityId, row.id, row)) {
        const signalKey = `${signal.entityId}:${signal.externalId}:${signal.signalCode}`;
        if (seenSignals.has(signalKey)) {
          continue;
        }

        seenSignals.add(signalKey);
        riskSignals.push(signal);
      }
    }
  }

  pruneReviewOnlyCandidates(reviewOnlyCandidateMap);

  return {
    scannedRows,
    matchedRows,
    candidateRows,
    matchCandidates,
    reviewOnlyCandidates: [...reviewOnlyCandidateMap.values()].sort(
      (left, right) => right.matchConfidence - left.matchConfidence,
    ),
    riskSignals,
  };
}

async function createSourceRun(client: Client, schema: string, notes: string): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [OPEN_SANCTIONS_SOURCE_KEY, "PY", "running", notes],
  );

  const sourceRun = result.rows[0];
  if (!sourceRun) {
    throw new Error("Failed to create OpenSanctions source run.");
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

async function clearExistingOpenSanctionsState(client: Client, schema: string): Promise<void> {
  await client.query(`delete from ${schema}.entity_enrichment_candidates where source_key = $1`, [OPEN_SANCTIONS_SOURCE_KEY]);
  await client.query(`delete from ${schema}.entity_external_risk_signals where source_key = $1`, [OPEN_SANCTIONS_SOURCE_KEY]);
  await client.query(`delete from ${schema}.entity_enrichment_matches where source_key = $1`, [OPEN_SANCTIONS_SOURCE_KEY]);
  await client.query(
    `delete from ${schema}.entity_relationships
     where source_key = $1
       and relation_type = 'possible_external_match'`,
    [OPEN_SANCTIONS_SOURCE_KEY],
  );
  await client.query(`delete from ${schema}.entity_source_mentions where source_key = $1`, [OPEN_SANCTIONS_SOURCE_KEY]);
  await client.query(`delete from ${schema}.entities where source_key = $1`, [OPEN_SANCTIONS_SOURCE_KEY]);
}

async function upsertSourceRecords(
  client: Client,
  schema: string,
  sourceRunId: number,
  rows: OpenSanctionsSimpleRow[],
): Promise<void> {
  for (const batch of rows.length === 0 ? [] : Array.from({ length: Math.ceil(rows.length / 250) }, (_, index) => rows.slice(index * 250, index * 250 + 250))) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           external_id text,
           payload jsonb
         )
       )
       insert into ${schema}.source_records
         (source_run_id, source_key, external_id, record_kind, payload)
       select
         $2,
         $3,
         input.external_id,
         'opensanctions_target',
         input.payload
       from input
       on conflict (source_key, external_id, record_kind)
       do update
       set
         source_run_id = excluded.source_run_id,
         payload = excluded.payload,
         retrieved_at = now()`,
      [
        JSON.stringify(
          batch.map((row) => ({
            external_id: row.id,
            payload: row,
          })),
        ),
        sourceRunId,
        OPEN_SANCTIONS_SOURCE_KEY,
      ],
    );
  }
}

async function insertExternalEntities(
  client: Client,
  schema: string,
  rows: OpenSanctionsSimpleRow[],
): Promise<Map<string, number>> {
  const entityIds = new Map<string, number>();
  if (rows.length === 0) {
    return entityIds;
  }

  for (const batch of Array.from({ length: Math.ceil(rows.length / 250) }, (_, index) => rows.slice(index * 250, index * 250 + 250))) {
    const result = await client.query<{
      id: number;
      source_external_id: string;
    }>(
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
       returning id, source_external_id`,
      [
        JSON.stringify(
          batch.map((row) => {
            const countries = splitSemicolonList(row.countries).map((country) => country.toUpperCase());
            const countryCode = countries.find((country) => country.length === 2) ?? null;

            return {
              country_code: countryCode,
              entity_type: mapExternalEntityType(row.schema),
              canonical_name: row.name,
              normalized_name: normalizeEntityName(row.name),
              source_key: OPEN_SANCTIONS_SOURCE_KEY,
              source_external_id: row.id,
              attributes: {
                externalSchema: row.schema,
                aliases: splitSemicolonList(row.aliases),
                countries,
                datasets: splitSemicolonList(row.dataset),
                identifiers: splitSemicolonList(row.identifiers),
                sanctions: splitSemicolonList(row.sanctions),
                programIds: splitSemicolonList(row.program_ids),
                addresses: splitSemicolonList(row.addresses),
                firstSeen: row.first_seen || null,
                lastSeen: row.last_seen || null,
                lastChange: row.last_change || null,
              },
            };
          }),
        ),
      ],
    );

    for (const row of result.rows) {
      entityIds.set(row.source_external_id, row.id);
    }
  }

  return entityIds;
}

async function insertExternalIdentifiers(
  client: Client,
  schema: string,
  externalEntityIds: Map<string, number>,
): Promise<void> {
  if (externalEntityIds.size === 0) {
    return;
  }

  await client.query(
    `with input as (
       select *
       from jsonb_to_recordset($1::jsonb) as x(entity_id bigint, scheme text, value text, is_primary boolean)
     )
     insert into ${schema}.entity_identifiers (entity_id, scheme, value, is_primary)
     select input.entity_id, input.scheme, input.value, input.is_primary
     from input
     on conflict (scheme, value) do nothing`,
    [
      JSON.stringify(
        [...externalEntityIds.entries()].map(([externalId, entityId]) => ({
          entity_id: entityId,
          scheme: "OpenSanctions-ID",
          value: externalId,
          is_primary: true,
        })),
      ),
    ],
  );
}

async function insertExternalSourceMentions(
  client: Client,
  schema: string,
  sourceRunId: number,
  rows: OpenSanctionsSimpleRow[],
  externalEntityIds: Map<string, number>,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  for (const batch of Array.from({ length: Math.ceil(rows.length / 250) }, (_, index) => rows.slice(index * 250, index * 250 + 250))) {
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
       from input`,
      [
        JSON.stringify(
          batch.flatMap((row) => {
            const entityId = externalEntityIds.get(row.id);
            if (!entityId) {
              return [];
            }

            return [
              {
                entity_id: entityId,
                source_run_id: sourceRunId,
                source_key: OPEN_SANCTIONS_SOURCE_KEY,
                role: "external_target",
                source_external_id: row.id,
                observed_name: row.name,
                attributes: {
                  datasets: splitSemicolonList(row.dataset),
                  countries: splitSemicolonList(row.countries),
                },
              },
            ];
          }),
        ),
      ],
    );
  }
}

async function insertEntityRelationships(
  client: Client,
  schema: string,
  candidates: MatchCandidate[],
  externalRows: Map<string, OpenSanctionsSimpleRow>,
  externalEntityIds: Map<string, number>,
): Promise<void> {
  if (candidates.length === 0) {
    return;
  }

  for (const batch of Array.from({ length: Math.ceil(candidates.length / 250) }, (_, index) =>
    candidates.slice(index * 250, index * 250 + 250),
  )) {
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
      [
        JSON.stringify(
          batch.flatMap((candidate) => {
            const externalEntityId = externalEntityIds.get(candidate.externalId);
            const externalRow = externalRows.get(candidate.externalId);
            if (!externalEntityId || !externalRow) {
              return [];
            }

            return [
              {
                subject_entity_id: candidate.entityId,
                object_entity_id: externalEntityId,
                relation_type: "possible_external_match",
                confidence: candidate.matchConfidence,
                source_key: OPEN_SANCTIONS_SOURCE_KEY,
                source_external_id: candidate.externalId,
                attributes: {
                  localScreeningRole: candidate.localScreeningRole,
                  matchMethod: candidate.matchMethod,
                  matchQuality: candidate.matchQuality,
                  matchedName: candidate.matchedName,
                  linkedCompanyIds: candidate.linkedCompanyIds,
                  linkedCompanyNames: candidate.linkedCompanyNames,
                  datasets: splitSemicolonList(externalRow.dataset),
                  countries: splitSemicolonList(externalRow.countries),
                },
              },
            ];
          }),
        ),
      ],
    );
  }
}

async function insertEnrichmentMatches(
  client: Client,
  schema: string,
  sourceRunId: number,
  candidates: MatchCandidate[],
  externalRows: Map<string, OpenSanctionsSimpleRow>,
  externalEntityIds: Map<string, number>,
): Promise<void> {
  if (candidates.length === 0) {
    return;
  }

  for (const batch of Array.from({ length: Math.ceil(candidates.length / 250) }, (_, index) =>
    candidates.slice(index * 250, index * 250 + 250),
  )) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           matched_entity_id bigint,
           source_run_id bigint,
           source_key text,
           match_method text,
           match_confidence numeric,
           match_quality text,
           review_status text,
           rationale text,
           evidence jsonb
         )
       )
       insert into ${schema}.entity_enrichment_matches
         (entity_id, matched_entity_id, source_run_id, source_key, match_method, match_confidence, match_quality, review_status, rationale, evidence)
       select
         input.entity_id,
         input.matched_entity_id,
         input.source_run_id,
         input.source_key,
         input.match_method,
         input.match_confidence,
         input.match_quality,
         input.review_status,
         input.rationale,
         input.evidence
       from input`,
      [
        JSON.stringify(
          batch.flatMap((candidate) => {
            const externalEntityId = externalEntityIds.get(candidate.externalId);
            const externalRow = externalRows.get(candidate.externalId);
            if (!externalEntityId || !externalRow) {
              return [];
            }

            const datasets = splitSemicolonList(externalRow.dataset);
            const countries = splitSemicolonList(externalRow.countries);
            const rationale =
              candidate.localScreeningRole === "legal_representative"
                ? `Review-only DNCP legal representative/person candidate matched against OpenSanctions bulk target "${externalRow.name}" using ${candidate.matchMethod}.`
                : `Matched against OpenSanctions bulk target "${externalRow.name}" using ${candidate.matchMethod}.`;

            return [
              {
                entity_id: candidate.entityId,
                matched_entity_id: externalEntityId,
                source_run_id: sourceRunId,
                source_key: OPEN_SANCTIONS_SOURCE_KEY,
                match_method: candidate.matchMethod,
                match_confidence: candidate.matchConfidence,
                match_quality: candidate.matchQuality,
                review_status: "unreviewed",
                rationale,
                evidence: [
                  { type: "local_screening_role", value: candidate.localScreeningRole },
                  { type: "matched_name", value: candidate.matchedName },
                  { type: "identifier_overlap", value: candidate.identifierOverlap },
                  { type: "datasets", value: datasets },
                  { type: "countries", value: countries },
                  { type: "local_identity_sources", value: candidate.localIdentitySourceKeys },
                  { type: "local_search_names", value: candidate.localSearchNames },
                  { type: "linked_company_ids", value: candidate.linkedCompanyIds },
                  { type: "linked_company_names", value: candidate.linkedCompanyNames },
                ],
              },
            ];
          }),
        ),
      ],
    );
  }
}

async function insertEnrichmentCandidates(
  client: Client,
  schema: string,
  sourceRunId: number,
  candidates: ReviewOnlyCandidate[],
): Promise<void> {
  if (candidates.length === 0) {
    return;
  }

  for (const batch of Array.from({ length: Math.ceil(candidates.length / 250) }, (_, index) =>
    candidates.slice(index * 250, index * 250 + 250),
  )) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           source_run_id bigint,
           source_key text,
           external_id text,
           external_name text,
           external_schema text,
           external_entity_type text,
           local_screening_role text,
           candidate_status text,
           match_method text,
           match_confidence numeric,
           match_quality text,
           review_status text,
           rejection_reason text,
           rationale text,
           evidence jsonb,
           external_payload jsonb
         )
       )
       insert into ${schema}.entity_enrichment_candidates
         (entity_id, source_run_id, source_key, external_id, external_name, external_schema, external_entity_type, local_screening_role, candidate_status, match_method, match_confidence, match_quality, review_status, rejection_reason, rationale, evidence, external_payload)
       select
         input.entity_id,
         input.source_run_id,
         input.source_key,
         input.external_id,
         input.external_name,
         input.external_schema,
         input.external_entity_type,
         input.local_screening_role,
         input.candidate_status,
         input.match_method,
         input.match_confidence,
         input.match_quality,
         input.review_status,
         input.rejection_reason,
         input.rationale,
         coalesce(input.evidence, '[]'::jsonb),
         coalesce(input.external_payload, '{}'::jsonb)
       from input
       on conflict (entity_id, source_key, external_id, local_screening_role, match_method)
       do update
       set
         source_run_id = excluded.source_run_id,
         external_name = excluded.external_name,
         external_schema = excluded.external_schema,
         external_entity_type = excluded.external_entity_type,
         candidate_status = excluded.candidate_status,
         match_confidence = excluded.match_confidence,
         match_quality = excluded.match_quality,
         review_status = excluded.review_status,
         rejection_reason = excluded.rejection_reason,
         rationale = excluded.rationale,
         evidence = excluded.evidence,
         external_payload = excluded.external_payload,
         last_seen_at = now()`,
      [
        JSON.stringify(
          batch.map((candidate) => ({
            entity_id: candidate.entityId,
            source_run_id: sourceRunId,
            source_key: OPEN_SANCTIONS_SOURCE_KEY,
            external_id: candidate.externalId,
            external_name: candidate.externalName,
            external_schema: candidate.externalSchema,
            external_entity_type: candidate.externalEntityType,
            local_screening_role: candidate.localScreeningRole,
            candidate_status: candidate.candidateStatus,
            match_method: candidate.matchMethod,
            match_confidence: candidate.matchConfidence,
            match_quality: candidate.matchQuality,
            review_status: candidate.reviewStatus,
            rejection_reason: candidate.rejectionReason,
            rationale: candidate.rationale,
            evidence: candidate.evidence,
            external_payload: candidate.externalPayload,
          })),
        ),
      ],
    );
  }
}

async function insertExternalRiskSignals(
  client: Client,
  schema: string,
  sourceRunId: number,
  signals: ExternalRiskSignalSeed[],
  externalEntityIds: Map<string, number>,
): Promise<void> {
  if (signals.length === 0) {
    return;
  }

  for (const batch of Array.from({ length: Math.ceil(signals.length / 250) }, (_, index) => signals.slice(index * 250, index * 250 + 250))) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           entity_id bigint,
           matched_entity_id bigint,
           source_run_id bigint,
           source_key text,
           signal_code text,
           signal_name text,
           category text,
           severity text,
           score numeric,
           rationale text,
           evidence jsonb
         )
       )
       insert into ${schema}.entity_external_risk_signals
         (entity_id, matched_entity_id, source_run_id, source_key, signal_code, signal_name, category, severity, score, rationale, evidence)
       select
         input.entity_id,
         input.matched_entity_id,
         input.source_run_id,
         input.source_key,
         input.signal_code,
         input.signal_name,
         input.category,
         input.severity,
         input.score,
         input.rationale,
         input.evidence
       from input`,
      [
        JSON.stringify(
          batch.flatMap((signal) => {
            const matchedEntityId = externalEntityIds.get(signal.externalId);
            if (!matchedEntityId) {
              return [];
            }

            return [
              {
                entity_id: signal.entityId,
                matched_entity_id: matchedEntityId,
                source_run_id: sourceRunId,
                source_key: OPEN_SANCTIONS_SOURCE_KEY,
                signal_code: signal.signalCode,
                signal_name: signal.signalName,
                category: signal.category,
                severity: signal.severity,
                score: signal.score,
                rationale: signal.rationale,
                evidence: signal.evidence,
              },
            ];
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

export async function runOpenSanctionsEnrichment(): Promise<{
  reportPath: string;
  summaryPath: string;
}> {
  const index = await fetchOpenSanctionsIndex();
  const resource = index.resources.find((entry) => entry.name === "targets.simple.csv");
  if (!resource) {
    throw new Error("OpenSanctions default index did not expose targets.simple.csv.");
  }

  const { client, schema } = await connectToPostgres();
  let sourceRunId: number | undefined;

  try {
    const localCompanyEntities = await queryLocalCompanyEntities(client, schema);
    const localRepresentativeEntities = await queryLocalRepresentativeEntities(client, schema);
    const localEntities = [...localCompanyEntities, ...localRepresentativeEntities];
    sourceRunId = await createSourceRun(
      client,
      schema,
      `OpenSanctions enrichment started for ${localCompanyEntities.length} procurement company entities and ${localRepresentativeEntities.length} DNCP legal representative person entities.`,
    );

    const screening = await streamOpenSanctionsMatches(resource.url, localEntities);
    const matchedRows = [...screening.matchedRows.values()].sort((left, right) => left.name.localeCompare(right.name));
    const sourceRecordRows = [
      ...new Map(
        [...screening.matchedRows.values(), ...screening.candidateRows.values()].map((row) => [row.id, row]),
      ).values(),
    ].sort((left, right) => left.name.localeCompare(right.name));
    const localEntityById = new Map(localEntities.map((entity) => [entity.entityId, entity]));

    const summary: EnrichmentSummary = {
      sourceKey: OPEN_SANCTIONS_SOURCE_KEY,
      fetchedAt: new Date().toISOString(),
      indexVersion: index.version,
      screenedCompanyCount: localCompanyEntities.length,
      screenedRepresentativeCount: localRepresentativeEntities.length,
      openSanctionsTargetCount: screening.scannedRows,
      matchedExternalEntityCount: matchedRows.length,
      localEntityMatchCount: unique(screening.matchCandidates.map((candidate) => `${candidate.entityId}`)).length,
      companyMatchCount: screening.matchCandidates.filter((candidate) => candidate.localScreeningRole === "supplier_company").length,
      representativeCandidateMatchCount: screening.matchCandidates.filter(
        (candidate) => candidate.localScreeningRole === "legal_representative",
      ).length,
      reviewCandidateCount: screening.reviewOnlyCandidates.filter(
        (candidate) => candidate.candidateStatus === "review_candidate",
      ).length,
      rejectedDiagnosticCount: screening.reviewOnlyCandidates.filter(
        (candidate) => candidate.candidateStatus === "rejected_diagnostic",
      ).length,
      candidateLocalEntityCount: unique(screening.reviewOnlyCandidates.map((candidate) => `${candidate.entityId}`)).length,
      externalRiskSignalCount: screening.riskSignals.length,
      matchedEntities: screening.matchCandidates
        .reduce<EnrichmentReportMatch[]>((accumulator, candidate) => {
          const localEntity = localEntityById.get(candidate.entityId);
          const externalRow = screening.matchedRows.get(candidate.externalId);
          if (!localEntity || !externalRow) {
            return accumulator;
          }

          accumulator.push({
            entityId: candidate.entityId,
            entityName: localEntity.canonicalName,
            entityType: localEntity.entityType,
            localScreeningRole: candidate.localScreeningRole,
            externalId: candidate.externalId,
            externalName: externalRow.name,
            matchMethod: candidate.matchMethod,
            matchQuality: candidate.matchQuality,
            matchConfidence: candidate.matchConfidence,
            datasets: splitSemicolonList(externalRow.dataset),
            countries: splitSemicolonList(externalRow.countries),
            signalCodes: screening.riskSignals
              .filter((signal) => signal.entityId === candidate.entityId && signal.externalId === candidate.externalId)
              .map((signal) => signal.signalCode),
            linkedCompanyNames: candidate.linkedCompanyNames,
          });

          return accumulator;
        }, [])
        .sort((left, right) => right.matchConfidence - left.matchConfidence || right.signalCodes.length - left.signalCodes.length)
        .slice(0, 50),
      reviewCandidates: screening.reviewOnlyCandidates
        .reduce<EnrichmentReportCandidate[]>((accumulator, candidate) => {
          const localEntity = localEntityById.get(candidate.entityId);
          if (!localEntity) {
            return accumulator;
          }

          accumulator.push({
            entityId: candidate.entityId,
            entityName: localEntity.canonicalName,
            entityType: localEntity.entityType,
            localScreeningRole: candidate.localScreeningRole,
            externalId: candidate.externalId,
            externalName: candidate.externalName,
            candidateStatus: candidate.candidateStatus,
            matchMethod: candidate.matchMethod,
            matchConfidence: candidate.matchConfidence,
            rejectionReason: candidate.rejectionReason,
            rationale: candidate.rationale,
            datasets: candidate.datasets,
            countries: candidate.countries,
            linkedCompanyNames: candidate.linkedCompanyNames,
          });

          return accumulator;
        }, [])
        .sort(
          (left, right) =>
            (left.candidateStatus === "review_candidate" ? -1 : 1) -
              (right.candidateStatus === "review_candidate" ? -1 : 1) ||
            right.matchConfidence - left.matchConfidence,
        )
        .slice(0, 80),
    };

    const rawIndexPath = await writeOutputJson(
      ["raw", "enrichment", "opensanctions", "default-index.json"],
      index,
    );
    const summaryPath = await writeOutputJson(
      ["normalized", "paraguay", "opensanctions-default-entity-screening.json"],
      {
        summary,
        matches: summary.matchedEntities,
        candidates: summary.reviewCandidates,
      },
    );
    const reportPath = await writeOutputText(
      ["reports", "paraguay", "opensanctions-default-entity-screening.md"],
      renderEnrichmentReport(summary),
    );

    await client.query("begin");
    await clearExistingOpenSanctionsState(client, schema);
    await upsertSourceAssets(client, schema, sourceRunId, [
      { assetKind: "source_index", path: rawIndexPath, sourceUrl: OPEN_SANCTIONS_INDEX_URL },
      { assetKind: "source_export", sourceUrl: resource.url },
      { assetKind: "normalized_bundle", path: summaryPath },
      { assetKind: "report", path: reportPath },
    ]);
    await upsertSourceRecords(client, schema, sourceRunId, sourceRecordRows);
    const externalEntityIds = await insertExternalEntities(client, schema, matchedRows);
    await insertExternalIdentifiers(client, schema, externalEntityIds);
    await insertExternalSourceMentions(client, schema, sourceRunId, matchedRows, externalEntityIds);
    await insertEntityRelationships(client, schema, screening.matchCandidates, screening.matchedRows, externalEntityIds);
    await insertEnrichmentMatches(client, schema, sourceRunId, screening.matchCandidates, screening.matchedRows, externalEntityIds);
    await insertEnrichmentCandidates(client, schema, sourceRunId, screening.reviewOnlyCandidates);
    await insertExternalRiskSignals(client, schema, sourceRunId, screening.riskSignals, externalEntityIds);
    await client.query("commit");

    await finalizeSourceRun(
      client,
      schema,
      sourceRunId,
      "completed",
      `OpenSanctions enrichment completed: screened ${summary.screenedCompanyCount} companies and ${summary.screenedRepresentativeCount} representatives, ${summary.localEntityMatchCount} accepted local entities matched, ${summary.reviewCandidateCount} review candidates, ${summary.rejectedDiagnosticCount} rejected diagnostics, ${summary.externalRiskSignalCount} external risk signals.`,
    );

    return {
      reportPath,
      summaryPath,
    };
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
        error instanceof Error ? error.message.slice(0, 500) : "OpenSanctions enrichment failed.",
      );
    }

    throw error;
  } finally {
    await client.end();
  }
}
