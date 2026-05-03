import crypto from "node:crypto";
import { writeOutputJson, writeOutputText } from "../storage/files";
import { connectToPostgres } from "../storage/postgres";
import { sleep } from "../lib/http";

const DNCP_RELEASE_SOURCE_CHECK_KEY = "py-dncp-release-source-check";

interface EntityRow {
  entity_id: string;
  entity_name: string;
  entity_type: string;
}

interface ProcessRow {
  process_id: string;
  ocid: string | null;
  tender_id: string;
  title: string;
  source_url: string;
  published_at: string | null;
  buyer_name: string | null;
  party_name: string;
  party_external_id: string | null;
}

interface DncpIdentifier {
  id?: string;
  scheme?: string;
  legalName?: string;
}

interface DncpParty {
  id?: string;
  name?: string;
  identifier?: DncpIdentifier;
  additionalIdentifiers?: DncpIdentifier[];
  roles?: string[];
  details?: Record<string, unknown>;
  address?: Record<string, unknown>;
  contactPoint?: Record<string, unknown>;
}

interface DncpDocument {
  id?: string;
  title?: string;
  url?: string;
  language?: string;
  documentType?: string;
  documentTypeDetails?: string;
  datePublished?: string;
  dateModified?: string;
  description?: string;
}

interface ExtractedDocument {
  fieldPath: string;
  document: DncpDocument;
}

interface ReleaseSummary {
  releaseId: string | null;
  ocid: string | null;
  date: string | null;
  tag: string[];
  matchingParties: DncpParty[];
  documentCount: number;
  documents: ExtractedDocument[];
}

interface ProcessCheckResult {
  process: ProcessRow;
  fetched: boolean;
  error?: string;
  releasePackage?: unknown;
  releases: ReleaseSummary[];
}

export interface DncpReleaseSourceCheckOptions {
  entityName?: string;
  entityId?: number;
  limit?: number;
  dryRun?: boolean;
}

export interface DncpReleaseSourceCheckResult {
  entityId: string;
  entityName: string;
  checkedProcesses: number;
  fetchedProcesses: number;
  releaseRecordsPersisted: number;
  documentRecordsPersisted: number;
  rawPath: string;
  reportPath: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeForMatch(value: string | undefined | null): string {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toDncpParty(value: unknown): DncpParty | undefined {
  const object = asObject(value);
  if (!object) {
    return undefined;
  }

  const party: DncpParty = {};
  const id = asString(object.id);
  const name = asString(object.name);
  if (id) {
    party.id = id;
  }
  if (name) {
    party.name = name;
  }

  const identifier = asObject(object.identifier);
  if (identifier) {
    const parsedIdentifier: DncpIdentifier = {};
    const identifierId = asString(identifier.id);
    const identifierScheme = asString(identifier.scheme);
    const identifierLegalName = asString(identifier.legalName);
    if (identifierId) {
      parsedIdentifier.id = identifierId;
    }
    if (identifierScheme) {
      parsedIdentifier.scheme = identifierScheme;
    }
    if (identifierLegalName) {
      parsedIdentifier.legalName = identifierLegalName;
    }
    party.identifier = parsedIdentifier;
  }

  const additionalIdentifiers = Array.isArray(object.additionalIdentifiers)
    ? object.additionalIdentifiers
        .map((entry) => asObject(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((entry) => {
          const parsedIdentifier: DncpIdentifier = {};
          const identifierId = asString(entry.id);
          const identifierScheme = asString(entry.scheme);
          const identifierLegalName = asString(entry.legalName);
          if (identifierId) {
            parsedIdentifier.id = identifierId;
          }
          if (identifierScheme) {
            parsedIdentifier.scheme = identifierScheme;
          }
          if (identifierLegalName) {
            parsedIdentifier.legalName = identifierLegalName;
          }
          return parsedIdentifier;
        })
    : [];
  if (additionalIdentifiers.length > 0) {
    party.additionalIdentifiers = additionalIdentifiers;
  }

  const roles = asStringArray(object.roles);
  if (roles.length > 0) {
    party.roles = roles;
  }
  const details = asObject(object.details);
  if (details) {
    party.details = details;
  }
  const address = asObject(object.address);
  if (address) {
    party.address = address;
  }
  const contactPoint = asObject(object.contactPoint);
  if (contactPoint) {
    party.contactPoint = contactPoint;
  }

  return party;
}

function toDncpDocument(value: unknown): DncpDocument | undefined {
  const object = asObject(value);
  if (!object) {
    return undefined;
  }

  const url = asString(object.url);
  const title = asString(object.title);
  if (!url && !title) {
    return undefined;
  }

  const document: DncpDocument = {};
  const id = asString(object.id);
  const language = asString(object.language);
  const documentType = asString(object.documentType);
  const documentTypeDetails = asString(object.documentTypeDetails);
  const datePublished = asString(object.datePublished);
  const dateModified = asString(object.dateModified);
  const description = asString(object.description);
  if (id) {
    document.id = id;
  }
  if (title) {
    document.title = title;
  }
  if (url) {
    document.url = url;
  }
  if (language) {
    document.language = language;
  }
  if (documentType) {
    document.documentType = documentType;
  }
  if (documentTypeDetails) {
    document.documentTypeDetails = documentTypeDetails;
  }
  if (datePublished) {
    document.datePublished = datePublished;
  }
  if (dateModified) {
    document.dateModified = dateModified;
  }
  if (description) {
    document.description = description;
  }

  return document;
}

function isMatchingParty(party: DncpParty, process: ProcessRow, entity: EntityRow): boolean {
  const partyNames = [party.name, party.identifier?.legalName].map(normalizeForMatch).filter(Boolean);
  const targetNames = [process.party_name, entity.entity_name].map(normalizeForMatch).filter(Boolean);
  const partyIds = [party.id, party.identifier?.id ? `${party.identifier.scheme ?? ""}-${party.identifier.id}` : undefined]
    .map((value) => normalizeForMatch(value))
    .filter(Boolean);
  const targetExternalId = normalizeForMatch(process.party_external_id);
  const targetExternalBase = normalizeForMatch(process.party_external_id?.replace(/^PY-RUC-/i, ""));

  return (
    partyNames.some((partyName) => targetNames.includes(partyName)) ||
    (targetExternalId.length > 0 && partyIds.includes(targetExternalId)) ||
    (targetExternalBase.length > 0 && party.identifier?.scheme === "PY-RUC" && normalizeForMatch(party.identifier.id) === targetExternalBase)
  );
}

function collectDocuments(value: unknown, fieldPath = "release", depth = 0): ExtractedDocument[] {
  if (depth > 8) {
    return [];
  }

  const object = asObject(value);
  if (!object) {
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => collectDocuments(item, `${fieldPath}[${index}]`, depth + 1));
    }
    return [];
  }

  const results: ExtractedDocument[] = [];

  for (const [key, child] of Object.entries(object)) {
    const childPath = `${fieldPath}.${key}`;
    if (key === "documents" && Array.isArray(child)) {
      child.forEach((entry, index) => {
        const document = toDncpDocument(entry);
        if (document) {
          results.push({ fieldPath: `${childPath}[${index}]`, document });
        }
      });
      continue;
    }

    if (Array.isArray(child) || asObject(child)) {
      results.push(...collectDocuments(child, childPath, depth + 1));
    }
  }

  return results;
}

function extractReleases(releasePackage: unknown, process: ProcessRow, entity: EntityRow): ReleaseSummary[] {
  const packageObject = asObject(releasePackage);
  const rawReleases = Array.isArray(packageObject?.releases) ? packageObject.releases : [releasePackage];

  return rawReleases
    .map((release): ReleaseSummary | undefined => {
      const releaseObject = asObject(release);
      if (!releaseObject) {
        return undefined;
      }

      const parties = Array.isArray(releaseObject.parties)
        ? releaseObject.parties
            .map((party) => toDncpParty(party))
            .filter((party): party is DncpParty => Boolean(party))
        : [];
      const matchingParties = parties.filter((party) => isMatchingParty(party, process, entity));
      const documents = collectDocuments(releaseObject);

      return {
        releaseId: asString(releaseObject.id) ?? null,
        ocid: asString(releaseObject.ocid) ?? null,
        date: asString(releaseObject.date) ?? null,
        tag: asStringArray(releaseObject.tag),
        matchingParties,
        documentCount: documents.length,
        documents,
      };
    })
    .filter((release): release is ReleaseSummary => Boolean(release));
}

function recordExternalId(parts: string[]): string {
  const readable = parts
    .map((part) => part.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_.:-]+/g, "-"))
    .join(":")
    .slice(0, 160);
  const hash = crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
  return `${readable}:${hash}`;
}

function renderReport(input: {
  entity: EntityRow;
  results: ProcessCheckResult[];
  dryRun: boolean;
  releaseRecordsPersisted: number;
  documentRecordsPersisted: number;
}): string {
  const fetchedCount = input.results.filter((result) => result.fetched).length;
  const documentCount = input.results.reduce(
    (sum, result) => sum + result.releases.reduce((inner, release) => inner + release.documentCount, 0),
    0,
  );
  const lines: string[] = [];

  lines.push(`# DNCP release source check for ${input.entity.entity_name}`);
  lines.push("");
  lines.push("This report captures official DNCP release and document metadata as source-backed review material. It is not proof of wrongdoing.");
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Local entity ID: ${input.entity.entity_id}`);
  lines.push(`- Entity type: ${input.entity.entity_type}`);
  lines.push(`- Related processes checked: ${input.results.length}`);
  lines.push(`- Official release packages fetched: ${fetchedCount}`);
  lines.push(`- Documents observed in fetched release packages: ${documentCount}`);
  lines.push(`- Dry run: ${input.dryRun ? "yes" : "no"}`);
  lines.push(`- Release source records persisted: ${input.releaseRecordsPersisted}`);
  lines.push(`- Document metadata source records persisted: ${input.documentRecordsPersisted}`);
  lines.push("");

  for (const result of input.results) {
    lines.push(`## ${result.process.title}`);
    lines.push("");
    lines.push(`- Process ID: ${result.process.process_id}`);
    lines.push(`- OCID: ${result.process.ocid ?? "n/a"}`);
    lines.push(`- Tender ID: ${result.process.tender_id}`);
    lines.push(`- Buyer: ${result.process.buyer_name ?? "n/a"}`);
    lines.push(`- Entity-side party name: ${result.process.party_name}`);
    lines.push(`- Entity-side party external ID: ${result.process.party_external_id ?? "n/a"}`);
    lines.push(`- Source URL: ${result.process.source_url}`);

    if (!result.fetched) {
      lines.push(`- Fetch result: failed - ${result.error ?? "unknown error"}`);
      lines.push("");
      continue;
    }

    const matchingParties = result.releases.flatMap((release) => release.matchingParties);
    lines.push(`- Releases parsed: ${result.releases.length}`);
    lines.push(`- Matching party records in official release: ${matchingParties.length}`);

    if (matchingParties.length === 0) {
      lines.push("- Matching party summary: n/a");
    } else {
      for (const party of matchingParties.slice(0, 4)) {
        const identifier = party.identifier
          ? `${party.identifier.scheme ?? "unknown"}:${party.identifier.id ?? "n/a"}`
          : "n/a";
        const legalType = asString(party.details?.legalEntityTypeDetail);
        const addressBits = [asString(party.address?.streetAddress), asString(party.address?.locality), asString(party.address?.countryName)]
          .filter(Boolean)
          .join(", ");
        lines.push(
          `- Matching party: ${party.name ?? "n/a"} | identifier ${identifier} | roles ${(party.roles ?? []).join(", ") || "n/a"} | legal type ${legalType ?? "n/a"} | address ${addressBits || "n/a"}`,
        );
      }
    }

    const documents = result.releases.flatMap((release) => release.documents);
    lines.push(`- Documents observed: ${documents.length}`);
    for (const entry of documents.slice(0, 12)) {
      lines.push(
        `- Document: ${entry.document.title ?? entry.document.id ?? "untitled"} | type ${entry.document.documentTypeDetails ?? entry.document.documentType ?? "n/a"} | path ${entry.fieldPath} | url ${entry.document.url ?? "n/a"}`,
      );
    }
    if (documents.length > 12) {
      lines.push(`- Additional documents omitted from report: ${documents.length - 12}`);
    }
    lines.push("");
  }

  lines.push("## Methodology and limits");
  lines.push("");
  lines.push("- The connector uses already-loaded DNCP process links, then fetches the official DNCP OCDS release package URL stored for those processes.");
  lines.push("- It stores release packages and document metadata separately as source records so analysts can link them into cases without treating them as findings.");
  lines.push("- Contact fields may exist inside official payloads, but this report avoids reprinting them unless later analyst work specifically needs the exact source field.");
  lines.push("- If a party identifier is base-only, this source check records that fact; it does not invent a missing RUC check digit.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function fetchReleasePackage(url: string, delayMs: number, timeoutMs: number): Promise<unknown> {
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Centinela/0.1 (+https://github.com/Axel-Acosta/Centinela)",
        accept: "application/json, text/plain, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}) for ${url}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms for ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadEntity(options: DncpReleaseSourceCheckOptions): Promise<EntityRow> {
  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<EntityRow>(
      `select
         entity_id::text,
         entity_name,
         entity_type
       from ${schema}.entity_procurement_activity
       where
         ($1::bigint is null or entity_id = $1)
         and ($2::text is null or lower(entity_name) = lower($2) or lower(entity_name) like lower($3))
       order by
         case when $2::text is not null and lower(entity_name) = lower($2) then 0 else 1 end,
         total_process_count desc,
         entity_name
       limit 1`,
      [options.entityId ?? null, options.entityName ?? null, options.entityName ? `%${options.entityName}%` : null],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`No entity found for ${options.entityId ? `ID ${options.entityId}` : options.entityName ?? "n/a"}.`);
    }

    return row;
  } finally {
    await client.end();
  }
}

async function loadProcesses(entityId: string, limit: number): Promise<ProcessRow[]> {
  const { client, schema } = await connectToPostgres();

  try {
    const result = await client.query<ProcessRow>(
      `with matches as (
         select distinct
           processes.id::text as process_id,
           processes.ocid,
           processes.tender_id,
           processes.title,
           processes.source_url,
           processes.published_at::text,
           processes.buyer_name,
           parties.party_name,
           parties.party_external_id
         from ${schema}.process_parties as parties
         join ${schema}.procurement_processes as processes
           on processes.id = parties.process_id
         where parties.entity_id::text = $1
           and processes.source_url is not null
       )
       select *
       from matches
       order by published_at desc nulls last, process_id::bigint desc
       limit $2`,
      [entityId, limit],
    );

    return result.rows;
  } finally {
    await client.end();
  }
}

async function persistSourceRecords(input: {
  entity: EntityRow;
  results: ProcessCheckResult[];
  rawPath: string;
  reportPath: string;
}): Promise<{ releaseRecordsPersisted: number; documentRecordsPersisted: number }> {
  const { client, schema } = await connectToPostgres();
  let releaseRecordsPersisted = 0;
  let documentRecordsPersisted = 0;

  try {
    await client.query("begin");

    const runResult = await client.query<{ id: string }>(
      `insert into ${schema}.source_runs (source_key, country_code, status, notes)
       values ($1, $2, $3, $4)
       returning id`,
      [
        DNCP_RELEASE_SOURCE_CHECK_KEY,
        "PY",
        "running",
        `DNCP release source check for entity ${input.entity.entity_id} (${input.entity.entity_name})`,
      ],
    );
    const sourceRunId = runResult.rows[0]?.id;
    if (!sourceRunId) {
      throw new Error("Failed to create DNCP release source-check run.");
    }

    await client.query(
      `insert into ${schema}.source_assets (source_run_id, asset_kind, path)
       values ($1, $2, $3), ($1, $4, $5)`,
      [sourceRunId, "dncp_release_source_check_raw", input.rawPath, "dncp_release_source_check_report", input.reportPath],
    );

    for (const result of input.results) {
      if (!result.fetched || !result.releasePackage) {
        continue;
      }

      const releaseExternalId = recordExternalId([
        input.entity.entity_id,
        result.process.process_id,
        result.process.ocid ?? result.process.tender_id,
        "release-package",
      ]);

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
          DNCP_RELEASE_SOURCE_CHECK_KEY,
          releaseExternalId,
          "ocds_release_package",
          result.process.source_url,
          JSON.stringify({
            centinelaTarget: input.entity,
            process: result.process,
            releaseSummaries: result.releases.map((release) => ({
              releaseId: release.releaseId,
              ocid: release.ocid,
              date: release.date,
              tag: release.tag,
              matchingParties: release.matchingParties,
              documentCount: release.documentCount,
            })),
            releasePackage: result.releasePackage,
            limitations: [
              "Official DNCP release payload is source evidence, not a finding.",
              "Party identifiers are preserved as published; missing RUC check digits are not inferred.",
            ],
          }),
        ],
      );
      releaseRecordsPersisted += 1;

      for (const release of result.releases) {
        for (const documentEntry of release.documents) {
          const documentExternalId = recordExternalId([
            input.entity.entity_id,
            result.process.process_id,
            release.releaseId ?? result.process.ocid ?? result.process.tender_id,
            documentEntry.fieldPath,
            documentEntry.document.id ?? documentEntry.document.url ?? documentEntry.document.title ?? "document",
          ]);

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
              DNCP_RELEASE_SOURCE_CHECK_KEY,
              documentExternalId,
              "ocds_document_metadata",
              documentEntry.document.url ?? result.process.source_url,
              JSON.stringify({
                centinelaTarget: input.entity,
                process: result.process,
                release: {
                  releaseId: release.releaseId,
                  ocid: release.ocid,
                  date: release.date,
                  tag: release.tag,
                },
                fieldPath: documentEntry.fieldPath,
                document: documentEntry.document,
                limitations: [
                  "Document metadata points to an official DNCP source document; the document content is not downloaded or interpreted by this connector.",
                  "This row supports source navigation and case evidence linking, not an automated conclusion.",
                ],
              }),
            ],
          );
          documentRecordsPersisted += 1;
        }
      }
    }

    await client.query(
      `update ${schema}.source_runs
       set finished_at = now(), status = $2, notes = $3
       where id = $1`,
      [
        sourceRunId,
        "completed",
        `DNCP release source check completed: ${releaseRecordsPersisted} release records, ${documentRecordsPersisted} document metadata records`,
      ],
    );

    await client.query("commit");
    return { releaseRecordsPersisted, documentRecordsPersisted };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

export async function runDncpReleaseSourceCheck(
  options: DncpReleaseSourceCheckOptions,
): Promise<DncpReleaseSourceCheckResult> {
  if (!options.entityName && !options.entityId) {
    throw new Error("Provide --entity-name or --entity-id for DNCP release source check.");
  }

  const limit = options.limit ?? 5;
  const entity = await loadEntity(options);
  const processes = await loadProcesses(entity.entity_id, limit);
  const results: ProcessCheckResult[] = [];

  for (const process of processes) {
    try {
      const releasePackage = await fetchReleasePackage(process.source_url, 150, 20000);
      results.push({
        process,
        fetched: true,
        releasePackage,
        releases: extractReleases(releasePackage, process, entity),
      });
    } catch (error) {
      results.push({
        process,
        fetched: false,
        error: error instanceof Error ? error.message : "unknown fetch error",
        releases: [],
      });
    }
  }

  const rawPath = await writeOutputJson(
    ["raw", "paraguay", "dncp", `release-source-check-${slugify(entity.entity_name)}.json`],
    {
      retrievedAt: new Date().toISOString(),
      sourceKey: DNCP_RELEASE_SOURCE_CHECK_KEY,
      entity,
      dryRun: Boolean(options.dryRun),
      results,
    },
  );

  let releaseRecordsPersisted = 0;
  let documentRecordsPersisted = 0;
  const initialReport = renderReport({
    entity,
    results,
    dryRun: Boolean(options.dryRun),
    releaseRecordsPersisted,
    documentRecordsPersisted,
  });
  const reportPath = await writeOutputText(
    ["reports", "paraguay", `dncp-release-source-check-${slugify(entity.entity_name)}.md`],
    initialReport,
  );

  if (!options.dryRun) {
    const persisted = await persistSourceRecords({
      entity,
      results,
      rawPath,
      reportPath,
    });
    releaseRecordsPersisted = persisted.releaseRecordsPersisted;
    documentRecordsPersisted = persisted.documentRecordsPersisted;

    await writeOutputText(
      ["reports", "paraguay", `dncp-release-source-check-${slugify(entity.entity_name)}.md`],
      renderReport({
        entity,
        results,
        dryRun: false,
        releaseRecordsPersisted,
        documentRecordsPersisted,
      }),
    );
  }

  return {
    entityId: entity.entity_id,
    entityName: entity.entity_name,
    checkedProcesses: processes.length,
    fetchedProcesses: results.filter((result) => result.fetched).length,
    releaseRecordsPersisted,
    documentRecordsPersisted,
    rawPath,
    reportPath,
  };
}
