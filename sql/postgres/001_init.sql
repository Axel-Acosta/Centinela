create schema if not exists centinela;

create table if not exists centinela.source_runs (
  id bigserial primary key,
  source_key text not null,
  country_code text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  notes text
);

create table if not exists centinela.source_assets (
  id bigserial primary key,
  source_run_id bigint references centinela.source_runs(id) on delete cascade,
  asset_kind text not null,
  path text,
  source_url text,
  sha256 text,
  retrieved_at timestamptz not null default now()
);

create table if not exists centinela.source_records (
  id bigserial primary key,
  source_run_id bigint references centinela.source_runs(id) on delete cascade,
  source_key text not null,
  external_id text not null,
  record_kind text not null,
  source_url text,
  retrieved_at timestamptz not null default now(),
  payload jsonb not null,
  unique (source_key, external_id, record_kind)
);

create table if not exists centinela.entities (
  id bigserial primary key,
  country_code text,
  entity_type text not null,
  canonical_name text not null,
  normalized_name text not null,
  source_key text,
  source_external_id text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists centinela.entity_identifiers (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  scheme text not null,
  value text not null,
  is_primary boolean not null default false,
  unique (scheme, value)
);

create table if not exists centinela.entity_relationships (
  id bigserial primary key,
  subject_entity_id bigint not null references centinela.entities(id) on delete cascade,
  object_entity_id bigint not null references centinela.entities(id) on delete cascade,
  relation_type text not null,
  confidence numeric(5,2),
  source_key text,
  source_external_id text,
  attributes jsonb not null default '{}'::jsonb
);

create table if not exists centinela.procurement_processes (
  id bigserial primary key,
  country_code text not null,
  source_key text not null,
  ocid text,
  tender_id text,
  planning_identifier text,
  title text not null,
  process_stage text not null,
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
  payload jsonb not null default '{}'::jsonb
);

create table if not exists centinela.process_parties (
  id bigserial primary key,
  process_id bigint not null references centinela.procurement_processes(id) on delete cascade,
  entity_id bigint references centinela.entities(id) on delete set null,
  role text not null,
  party_name text not null,
  party_external_id text
);

create table if not exists centinela.awards (
  id bigserial primary key,
  process_id bigint not null references centinela.procurement_processes(id) on delete cascade,
  source_award_id text,
  award_date timestamptz,
  award_status text,
  amount numeric,
  currency text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists centinela.contracts (
  id bigserial primary key,
  process_id bigint not null references centinela.procurement_processes(id) on delete cascade,
  source_contract_id text,
  contract_status text,
  signed_at timestamptz,
  amount numeric,
  currency text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists centinela.risk_signals (
  id bigserial primary key,
  process_id bigint references centinela.procurement_processes(id) on delete cascade,
  entity_id bigint references centinela.entities(id) on delete cascade,
  signal_code text not null,
  signal_name text not null,
  severity text not null,
  category text not null,
  score numeric(5,2) not null default 0,
  rationale text not null,
  created_at timestamptz not null default now()
);

create table if not exists centinela.risk_signal_evidence (
  id bigserial primary key,
  risk_signal_id bigint not null references centinela.risk_signals(id) on delete cascade,
  evidence_type text not null,
  evidence_key text,
  evidence_value text,
  source_url text
);
