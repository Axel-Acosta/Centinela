import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import type { NormalizedBundle } from "../integrity/bundle";
import type { NormalizedParty, NormalizedProcess } from "../integrity/model";
import { listRiskRules } from "../integrity/ruleRegistry";

function getDatabaseConfig() {
  const schema = process.env.POSTGRES_SCHEMA ?? "centinela";

  if (process.env.DATABASE_URL) {
    return {
      clientConfig: {
        connectionString: process.env.DATABASE_URL,
      },
      schema,
    };
  }

  return {
    clientConfig: {
      host: process.env.POSTGRES_HOST ?? "127.0.0.1",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB ?? "centinela",
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    },
    schema,
  };
}

export async function connectToPostgres(): Promise<{ client: Client; schema: string }> {
  const { clientConfig, schema } = getDatabaseConfig();
  const client = new Client(clientConfig);
  await client.connect();
  return { client, schema };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function identifierScheme(externalId: string): string {
  if (externalId.startsWith("PY-RUC-")) {
    return "PY-RUC";
  }

  if (externalId.startsWith("DNCP-SICP-CODE-")) {
    return "DNCP-SICP-CODE";
  }

  return "source-external-id";
}

function entityNaturalKey(party: Pick<NormalizedParty, "entityType" | "externalId" | "name">): string {
  return `${party.entityType}:${party.externalId ?? normalizeName(party.name)}`;
}

function processNaturalKey(input: {
  sourceKey: string;
  tenderId: string;
  ocid?: string | null;
}): string {
  return `${input.sourceKey}:${input.ocid ?? ""}:${input.tenderId}`;
}

function contractNaturalKey(processKey: string, contractId: string): string {
  return `${processKey}:${contractId}`;
}

function signalNaturalKey(processKey: string, signalCode: string): string {
  return `${processKey}:${signalCode}`;
}

function chunk<T>(values: T[], size: number): T[][] {
  if (values.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function syncRiskRuleRegistry(client: Client, schema: string): Promise<void> {
  const rows = listRiskRules().map((rule) => ({
    code: rule.code,
    country_code: rule.countryCode,
    family: rule.family,
    name: rule.name,
    category: rule.category,
    default_severity: rule.defaultSeverity,
    default_score: rule.defaultScore,
    review_lane: rule.reviewLane,
    review_priority_hint: rule.reviewPriorityHint,
    public_description: rule.publicDescription,
    analyst_question: rule.analystQuestion,
    rationale_template: rule.rationaleTemplate,
    recommended_action: rule.recommendedAction,
    dncp_alignment: rule.dncpAlignment,
    methodology_notes: rule.methodologyNotes,
    field_dependencies: rule.fieldDependencies,
    evidence_requirements: rule.evidenceRequirements,
    exclusions: rule.exclusions,
    limitations: rule.limitations,
    precedent_influences: rule.precedentInfluences,
  }));

  for (const batch of chunk(rows, 100)) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           code text,
           country_code text,
           family text,
           name text,
           category text,
           default_severity text,
           default_score numeric,
           review_lane text,
           review_priority_hint text,
           public_description text,
           analyst_question text,
           rationale_template text,
           recommended_action text,
           dncp_alignment text,
           methodology_notes jsonb,
           field_dependencies jsonb,
           evidence_requirements jsonb,
           exclusions jsonb,
           limitations jsonb,
           precedent_influences jsonb
         )
       )
       insert into ${schema}.risk_rule_registry (
         code,
         country_code,
         family,
         name,
         category,
         default_severity,
         default_score,
         review_lane,
         review_priority_hint,
         public_description,
         analyst_question,
         rationale_template,
         recommended_action,
         dncp_alignment,
         methodology_notes,
         field_dependencies,
         evidence_requirements,
         exclusions,
         limitations,
         precedent_influences
       )
       select
         input.code,
         input.country_code,
         input.family,
         input.name,
         input.category,
         input.default_severity,
         input.default_score,
         input.review_lane,
         input.review_priority_hint,
         input.public_description,
         input.analyst_question,
         input.rationale_template,
         input.recommended_action,
         input.dncp_alignment,
         coalesce(input.methodology_notes, '[]'::jsonb),
         coalesce(input.field_dependencies, '[]'::jsonb),
         coalesce(input.evidence_requirements, '[]'::jsonb),
         coalesce(input.exclusions, '[]'::jsonb),
         coalesce(input.limitations, '[]'::jsonb),
         coalesce(input.precedent_influences, '[]'::jsonb)
       from input
       on conflict (code)
       do update
       set
         country_code = excluded.country_code,
         family = excluded.family,
         name = excluded.name,
         category = excluded.category,
         default_severity = excluded.default_severity,
         default_score = excluded.default_score,
         review_lane = excluded.review_lane,
         review_priority_hint = excluded.review_priority_hint,
         public_description = excluded.public_description,
         analyst_question = excluded.analyst_question,
         rationale_template = excluded.rationale_template,
         recommended_action = excluded.recommended_action,
         dncp_alignment = excluded.dncp_alignment,
         methodology_notes = excluded.methodology_notes,
         field_dependencies = excluded.field_dependencies,
         evidence_requirements = excluded.evidence_requirements,
         exclusions = excluded.exclusions,
         limitations = excluded.limitations,
         precedent_influences = excluded.precedent_influences,
         updated_at = now()`,
      [JSON.stringify(batch)],
    );
  }
}

interface PartySeed {
  naturalKey: string;
  countryCode: "PY";
  entityType: NormalizedParty["entityType"];
  canonicalName: string;
  normalizedName: string;
  externalId?: string;
  sourceKey: string;
  attributes: { key: string };
}

function collectPartySeeds(bundle: NormalizedBundle): PartySeed[] {
  const seeds = new Map<string, PartySeed>();

  function register(party: NormalizedParty | undefined, sourceKey: string): void {
    if (!party) {
      return;
    }

    const naturalKey = entityNaturalKey(party);
    if (seeds.has(naturalKey)) {
      return;
    }

    const seed: PartySeed = {
      naturalKey,
      countryCode: "PY",
      entityType: party.entityType,
      canonicalName: party.name,
      normalizedName: normalizeName(party.name),
      sourceKey,
      attributes: {
        key: party.key,
      },
    };

    if (party.externalId) {
      seed.externalId = party.externalId;
    }

    seeds.set(naturalKey, seed);
  }

  for (const process of bundle.processes) {
    register(process.buyer, process.sourceKey);
    for (const supplier of process.suppliers) {
      register(supplier, process.sourceKey);
    }
  }

  return [...seeds.values()];
}

async function resolveEntities(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
): Promise<Map<string, number>> {
  const partySeeds = collectPartySeeds(bundle);
  const resolved = new Map<string, number>();

  const identifierRows = partySeeds
    .filter((party) => party.externalId)
    .map((party) => ({
      natural_key: party.naturalKey,
      scheme: identifierScheme(party.externalId ?? ""),
      value: party.externalId,
    }));

  for (const batch of chunk(identifierRows, 500)) {
    const matches = await client.query<{ natural_key: string; entity_id: number }>(
      `with input as (
         select distinct natural_key, scheme, value
         from jsonb_to_recordset($1::jsonb) as x(natural_key text, scheme text, value text)
       )
       select input.natural_key, identifiers.entity_id
       from input
       join ${schema}.entity_identifiers as identifiers
         on identifiers.scheme = input.scheme
        and identifiers.value = input.value`,
      [JSON.stringify(batch)],
    );

    for (const row of matches.rows) {
      resolved.set(row.natural_key, row.entity_id);
    }
  }

  const unresolvedByName = partySeeds
    .filter((party) => !resolved.has(party.naturalKey))
    .map((party) => ({
      natural_key: party.naturalKey,
      entity_type: party.entityType,
      normalized_name: party.normalizedName,
    }));

  for (const batch of chunk(unresolvedByName, 500)) {
    const matches = await client.query<{ natural_key: string; entity_id: number }>(
      `with input as (
         select distinct natural_key, entity_type, normalized_name
         from jsonb_to_recordset($1::jsonb) as x(natural_key text, entity_type text, normalized_name text)
       )
       select input.natural_key, entities.id as entity_id
       from input
       join ${schema}.entities
         on entities.entity_type = input.entity_type
        and entities.normalized_name = input.normalized_name`,
      [JSON.stringify(batch)],
    );

    for (const row of matches.rows) {
      resolved.set(row.natural_key, row.entity_id);
    }
  }

  const missing = partySeeds
    .filter((party) => !resolved.has(party.naturalKey))
    .map((party) => ({
      country_code: party.countryCode,
      entity_type: party.entityType,
      canonical_name: party.canonicalName,
      normalized_name: party.normalizedName,
      source_key: party.sourceKey,
      source_external_id: party.externalId ?? null,
      attributes: party.attributes,
    }));

  for (const batch of chunk(missing, 250)) {
    const inserted = await client.query<{
      id: number;
      entity_type: string;
      normalized_name: string;
      source_external_id: string | null;
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
         coalesce(input.attributes, '{}'::jsonb)
       from input
       returning id, entity_type, normalized_name, source_external_id`,
      [JSON.stringify(batch)],
    );

    for (const row of inserted.rows) {
      const naturalKey = `${row.entity_type}:${row.source_external_id ?? row.normalized_name}`;
      resolved.set(naturalKey, row.id);
    }
  }

  const identifierInserts = partySeeds
    .filter((party) => party.externalId)
    .map((party) => ({
      entity_id: resolved.get(party.naturalKey),
      scheme: identifierScheme(party.externalId ?? ""),
      value: party.externalId,
    }))
    .filter((row): row is { entity_id: number; scheme: string; value: string } => Boolean(row.entity_id && row.value));

  for (const batch of chunk(identifierInserts, 500)) {
    await client.query(
      `with input as (
         select distinct entity_id, scheme, value
         from jsonb_to_recordset($1::jsonb) as x(entity_id bigint, scheme text, value text)
       )
       insert into ${schema}.entity_identifiers (entity_id, scheme, value, is_primary)
       select input.entity_id, input.scheme, input.value, true
       from input
       on conflict (scheme, value) do nothing`,
      [JSON.stringify(batch)],
    );
  }

  for (const party of partySeeds) {
    if (!resolved.has(party.naturalKey)) {
      throw new Error(`Failed to resolve entity for ${party.canonicalName}`);
    }
  }

  return resolved;
}

async function insertProcesses(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
): Promise<Map<string, number>> {
  const processIds = new Map<string, number>();
  const rows = bundle.processes.map((process) => ({
    country_code: process.countryCode,
    source_key: process.sourceKey,
    ocid: process.ocid ?? null,
    tender_id: process.tenderId,
    planning_identifier: process.planningIdentifier ?? null,
    title: process.title,
    process_stage: process.stage,
    buyer_name: process.buyer?.name ?? null,
    buyer_external_id: process.buyer?.externalId ?? null,
    procurement_method: process.procurementMethod ?? null,
    procurement_method_details: process.procurementMethodDetails ?? null,
    status_details: process.statusDetails ?? null,
    published_at: process.publishedDate ?? null,
    tender_start_at: process.tenderPeriod?.startDate ?? null,
    tender_end_at: process.tenderPeriod?.endDate ?? null,
    tender_duration_days: process.tenderPeriod?.durationInDays ?? null,
    source_url: process.sourceUrls[0] ?? null,
    payload: process,
  }));

  for (const batch of chunk(rows, 200)) {
    const inserted = await client.query<{
      id: number;
      source_key: string;
      ocid: string | null;
      tender_id: string;
    }>(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           country_code text,
           source_key text,
           ocid text,
           tender_id text,
           planning_identifier text,
           title text,
           process_stage text,
           buyer_name text,
           buyer_external_id text,
           procurement_method text,
           procurement_method_details text,
           status_details text,
           published_at timestamptz,
           tender_start_at timestamptz,
           tender_end_at timestamptz,
           tender_duration_days integer,
           source_url text,
           payload jsonb
         )
       )
       insert into ${schema}.procurement_processes
         (country_code, source_key, ocid, tender_id, planning_identifier, title, process_stage, buyer_name, buyer_external_id, procurement_method, procurement_method_details, status_details, published_at, tender_start_at, tender_end_at, tender_duration_days, source_url, payload)
       select
         input.country_code,
         input.source_key,
         input.ocid,
         input.tender_id,
         input.planning_identifier,
         input.title,
         input.process_stage,
         input.buyer_name,
         input.buyer_external_id,
         input.procurement_method,
         input.procurement_method_details,
         input.status_details,
         input.published_at,
         input.tender_start_at,
         input.tender_end_at,
         input.tender_duration_days,
         input.source_url,
         coalesce(input.payload, '{}'::jsonb)
       from input
       returning id, source_key, ocid, tender_id`,
      [JSON.stringify(batch)],
    );

    for (const row of inserted.rows) {
      const processKey = processNaturalKey(
        row.ocid
          ? {
              sourceKey: row.source_key,
              ocid: row.ocid,
              tenderId: row.tender_id,
            }
          : {
              sourceKey: row.source_key,
              tenderId: row.tender_id,
            },
      );

      processIds.set(processKey, row.id);
    }
  }

  return processIds;
}

async function insertProcessParties(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
  entityIds: Map<string, number>,
  processIds: Map<string, number>,
): Promise<
  Array<{
    process_id: number;
    entity_id: number;
    role: string;
    party_name: string;
    party_external_id: string | null;
    source_key: string;
  }>
> {
  const rows: Array<{
    process_id: number;
    entity_id: number;
    role: string;
    party_name: string;
    party_external_id: string | null;
    source_key: string;
  }> = [];

  for (const process of bundle.processes) {
    const processKey = processNaturalKey(process);
    const processId = processIds.get(processKey);
    if (!processId) {
      throw new Error(`Missing process id for ${process.title}`);
    }

    if (process.buyer) {
      const entityId = entityIds.get(entityNaturalKey(process.buyer));
      if (!entityId) {
        throw new Error(`Missing buyer entity for ${process.buyer.name}`);
      }

      rows.push({
        process_id: processId,
        entity_id: entityId,
        role: "buyer",
        party_name: process.buyer.name,
        party_external_id: process.buyer.externalId ?? null,
        source_key: process.sourceKey,
      });
    }

    for (const supplier of process.suppliers) {
      const entityId = entityIds.get(entityNaturalKey(supplier));
      if (!entityId) {
        throw new Error(`Missing supplier entity for ${supplier.name}`);
      }

      rows.push({
        process_id: processId,
        entity_id: entityId,
        role: "supplier",
        party_name: supplier.name,
        party_external_id: supplier.externalId ?? null,
        source_key: process.sourceKey,
      });
    }
  }

  for (const batch of chunk(rows, 500)) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           process_id bigint,
           entity_id bigint,
           role text,
           party_name text,
           party_external_id text
         )
       )
       insert into ${schema}.process_parties
         (process_id, entity_id, role, party_name, party_external_id)
       select input.process_id, input.entity_id, input.role, input.party_name, input.party_external_id
       from input`,
      [JSON.stringify(batch)],
    );
  }

  return rows;
}

async function upsertEntitySourceMentions(
  client: Client,
  schema: string,
  sourceRunId: number,
  rows: Array<{
    entity_id: number;
    role: string;
    party_name: string;
    party_external_id: string | null;
    source_key: string;
  }>,
): Promise<void> {
  const mentionMap = new Map<
    string,
    {
      entity_id: number;
      source_run_id: number;
      source_key: string;
      role: string;
      source_external_id: string;
      observed_name: string;
      attributes: { observedVia: string };
    }
  >();

  for (const row of rows) {
    const sourceExternalId = row.party_external_id ?? "";
    const mentionKey = `${row.entity_id}:${row.source_key}:${row.role}:${sourceExternalId}`;

    if (!mentionMap.has(mentionKey)) {
      mentionMap.set(mentionKey, {
        entity_id: row.entity_id,
        source_run_id: sourceRunId,
        source_key: row.source_key,
        role: row.role,
        source_external_id: sourceExternalId,
        observed_name: row.party_name,
        attributes: {
          observedVia: "process_parties",
        },
      });
    }
  }

  const mentionRows = [...mentionMap.values()];

  for (const batch of chunk(mentionRows, 500)) {
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
         coalesce(input.attributes, '{}'::jsonb)
       from input
       on conflict (entity_id, source_key, role, source_external_id)
       do update
       set
         source_run_id = excluded.source_run_id,
         observed_name = excluded.observed_name,
         last_seen_at = now(),
         attributes = ${schema}.entity_source_mentions.attributes || excluded.attributes`,
      [JSON.stringify(batch)],
    );
  }
}

async function insertContracts(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
  processIds: Map<string, number>,
): Promise<Map<string, number>> {
  const contractIds = new Map<string, number>();
  const rows: Array<{
    process_id: number;
    source_contract_id: string;
    contract_status: string | null;
    signed_at: string | null;
    amount: number | null;
    currency: string | null;
    payload: unknown;
  }> = [];

  for (const process of bundle.processes) {
    const processId = processIds.get(processNaturalKey(process));
    if (!processId) {
      throw new Error(`Missing process id for contract load on ${process.title}`);
    }

    for (const contract of process.contracts) {
      rows.push({
        process_id: processId,
        source_contract_id: contract.id,
        contract_status: contract.statusDetails ?? contract.status ?? null,
        signed_at: contract.dateSigned ?? contract.startDate ?? null,
        amount: contract.amount ?? null,
        currency: contract.currency ?? null,
        payload: contract,
      });
    }
  }

  for (const batch of chunk(rows, 250)) {
    const inserted = await client.query<{ id: number; process_id: number; source_contract_id: string }>(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           process_id bigint,
           source_contract_id text,
           contract_status text,
           signed_at timestamptz,
           amount numeric,
           currency text,
           payload jsonb
         )
       )
       insert into ${schema}.contracts
         (process_id, source_contract_id, contract_status, signed_at, amount, currency, payload)
       select
         input.process_id,
         input.source_contract_id,
         input.contract_status,
         input.signed_at,
         input.amount,
         input.currency,
         coalesce(input.payload, '{}'::jsonb)
       from input
       returning id, process_id, source_contract_id`,
      [JSON.stringify(batch)],
    );

    for (const row of inserted.rows) {
      contractIds.set(`${row.process_id}:${row.source_contract_id}`, row.id);
    }
  }

  return contractIds;
}

async function insertTransactions(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
  processIds: Map<string, number>,
  contractIds: Map<string, number>,
): Promise<void> {
  const rows: Array<{
    contract_id: number;
    transaction_external_id: string;
    transaction_date: string | null;
    request_date: string | null;
    amount: number | null;
    currency: string | null;
    source_system: string | null;
    financial_code: string | null;
    payer_name: string | null;
    payer_external_id: string | null;
    payee_name: string | null;
    payee_external_id: string | null;
    payload: unknown;
  }> = [];

  for (const process of bundle.processes) {
    const processId = processIds.get(processNaturalKey(process));
    if (!processId) {
      throw new Error(`Missing process id for transaction load on ${process.title}`);
    }

    for (const contract of process.contracts) {
      const contractId = contractIds.get(`${processId}:${contract.id}`);
      if (!contractId) {
        throw new Error(`Missing contract id for ${contract.id}`);
      }

      for (const transaction of contract.transactions) {
        rows.push({
          contract_id: contractId,
          transaction_external_id: transaction.id,
          transaction_date: transaction.date ?? null,
          request_date: transaction.requestDate ?? null,
          amount: transaction.amount ?? null,
          currency: transaction.currency ?? null,
          source_system: transaction.sourceSystem ?? null,
          financial_code: transaction.financialCode ?? null,
          payer_name: transaction.payer?.name ?? null,
          payer_external_id: transaction.payer?.externalId ?? null,
          payee_name: transaction.payee?.name ?? null,
          payee_external_id: transaction.payee?.externalId ?? null,
          payload: transaction,
        });
      }
    }
  }

  for (const batch of chunk(rows, 500)) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           contract_id bigint,
           transaction_external_id text,
           transaction_date timestamptz,
           request_date timestamptz,
           amount numeric,
           currency text,
           source_system text,
           financial_code text,
           payer_name text,
           payer_external_id text,
           payee_name text,
           payee_external_id text,
           payload jsonb
         )
       )
       insert into ${schema}.contract_transactions
         (contract_id, transaction_external_id, transaction_date, request_date, amount, currency, source_system, financial_code, payer_name, payer_external_id, payee_name, payee_external_id, payload)
       select
         input.contract_id,
         input.transaction_external_id,
         input.transaction_date,
         input.request_date,
         input.amount,
         input.currency,
         input.source_system,
         input.financial_code,
         input.payer_name,
         input.payer_external_id,
         input.payee_name,
         input.payee_external_id,
         coalesce(input.payload, '{}'::jsonb)
       from input
       on conflict (contract_id, transaction_external_id) do nothing`,
      [JSON.stringify(batch)],
    );
  }
}

async function insertRiskSignals(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
  processIds: Map<string, number>,
): Promise<Map<string, number>> {
  const signalIds = new Map<string, number>();
  const rows: Array<{
    process_id: number;
    signal_code: string;
    signal_name: string;
    severity: string;
    category: string;
    score: number;
    rationale: string;
  }> = [];

  for (const process of bundle.processes) {
    const processId = processIds.get(processNaturalKey(process));
    if (!processId) {
      throw new Error(`Missing process id for signal load on ${process.title}`);
    }

    for (const flag of process.flags) {
      rows.push({
        process_id: processId,
        signal_code: flag.code,
        signal_name: flag.name,
        severity: flag.severity,
        category: flag.category,
        score: flag.score,
        rationale: flag.rationale,
      });
    }
  }

  for (const batch of chunk(rows, 500)) {
    const inserted = await client.query<{ id: number; process_id: number; signal_code: string }>(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           process_id bigint,
           signal_code text,
           signal_name text,
           severity text,
           category text,
           score numeric,
           rationale text
         )
       )
       insert into ${schema}.risk_signals
         (process_id, signal_code, signal_name, severity, category, score, rationale)
       select
         input.process_id,
         input.signal_code,
         input.signal_name,
         input.severity,
         input.category,
         input.score,
         input.rationale
       from input
       returning id, process_id, signal_code`,
      [JSON.stringify(batch)],
    );

    for (const row of inserted.rows) {
      signalIds.set(`${row.process_id}:${row.signal_code}`, row.id);
    }
  }

  return signalIds;
}

async function insertRiskEvidence(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
  processIds: Map<string, number>,
  signalIds: Map<string, number>,
): Promise<void> {
  const rows: Array<{
    risk_signal_id: number;
    evidence_type: string;
    evidence_value: string;
    source_url: string | null;
  }> = [];

  for (const process of bundle.processes) {
    const processId = processIds.get(processNaturalKey(process));
    if (!processId) {
      throw new Error(`Missing process id for evidence load on ${process.title}`);
    }

    for (const flag of process.flags) {
      const riskSignalId = signalIds.get(`${processId}:${flag.code}`);
      if (!riskSignalId) {
        throw new Error(`Missing risk signal id for ${flag.code}`);
      }

      for (const evidence of flag.evidence) {
        rows.push({
          risk_signal_id: riskSignalId,
          evidence_type: "text",
          evidence_value: evidence,
          source_url: process.sourceUrls[0] ?? null,
        });
      }
    }
  }

  for (const batch of chunk(rows, 500)) {
    await client.query(
      `with input as (
         select *
         from jsonb_to_recordset($1::jsonb) as x(
           risk_signal_id bigint,
           evidence_type text,
           evidence_value text,
           source_url text
         )
       )
       insert into ${schema}.risk_signal_evidence
         (risk_signal_id, evidence_type, evidence_value, source_url)
       select input.risk_signal_id, input.evidence_type, input.evidence_value, input.source_url
       from input`,
      [JSON.stringify(batch)],
    );
  }
}

async function createSourceRun(
  client: Client,
  schema: string,
  bundle: NormalizedBundle,
  bundlePath?: string,
): Promise<number> {
  const sourceRun = await client.query<{ id: number }>(
    `insert into ${schema}.source_runs (source_key, country_code, status, notes)
     values ($1, $2, $3, $4)
     returning id`,
    [bundle.sourceKey, bundle.countryCode, "running", `${bundle.bundleKind} bundle load started`],
  );

  const sourceRunRow = sourceRun.rows[0];
  if (!sourceRunRow) {
    throw new Error(`Failed to create source run for ${bundle.sourceKey}`);
  }

  const sourceRunId = sourceRunRow.id;
  const sourceAssets = new Set<string>();

  if (bundlePath) {
    sourceAssets.add(path.resolve(bundlePath));
  }

  for (const sourceAsset of bundle.sourceAssets ?? []) {
    sourceAssets.add(path.resolve(sourceAsset));
  }

  for (const sourceAsset of sourceAssets) {
    await client.query(
      `insert into ${schema}.source_assets (source_run_id, asset_kind, path)
       values ($1, $2, $3)`,
      [sourceRunId, sourceAsset === bundlePath ? "normalized_bundle" : "source_asset", sourceAsset],
    );
  }

  return sourceRunId;
}

export async function readBundleFromFile(bundlePath: string): Promise<NormalizedBundle> {
  const content = await fs.readFile(bundlePath, "utf8");
  return JSON.parse(content) as NormalizedBundle;
}

export async function loadBundleToPostgres(bundle: NormalizedBundle, bundlePath?: string): Promise<void> {
  const { client, schema } = await connectToPostgres();
  let sourceRunId: number | undefined;
  const totalRiskSignals = bundle.processes.reduce((sum, process) => sum + process.flags.length, 0);

  try {
    sourceRunId = await createSourceRun(client, schema, bundle, bundlePath);
    await client.query("begin");

    await syncRiskRuleRegistry(client, schema);
    await client.query(`delete from ${schema}.procurement_processes where source_key = $1`, [bundle.sourceKey]);
    await client.query(`delete from ${schema}.entity_source_mentions where source_key = $1`, [bundle.sourceKey]);

    const entityIds = await resolveEntities(client, schema, bundle);
    const processIds = await insertProcesses(client, schema, bundle);
    const processPartyRows = await insertProcessParties(client, schema, bundle, entityIds, processIds);
    await upsertEntitySourceMentions(client, schema, sourceRunId, processPartyRows);
    const contractIds = await insertContracts(client, schema, bundle, processIds);
    await insertTransactions(client, schema, bundle, processIds, contractIds);
    const signalIds = await insertRiskSignals(client, schema, bundle, processIds);
    await insertRiskEvidence(client, schema, bundle, processIds, signalIds);

    await client.query("commit");

    if (sourceRunId) {
      await client.query(
        `update ${schema}.source_runs
         set finished_at = now(), status = $2, notes = $3
         where id = $1`,
        [
          sourceRunId,
          "completed",
          `${bundle.bundleKind} bundle load completed: ${bundle.processes.length} processes, ${totalRiskSignals} risk signals`,
        ],
      );
    }
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Ignore rollback errors so the original failure surfaces.
    }

    if (sourceRunId) {
      await client.query(
        `update ${schema}.source_runs
         set finished_at = now(), status = $2, notes = $3
         where id = $1`,
        [
          sourceRunId,
          "failed",
          error instanceof Error ? error.message.slice(0, 500) : "Bundle load failed",
        ],
      );
    }

    throw error;
  } finally {
    await client.end();
  }
}
