create table if not exists centinela.entity_local_profiles (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_key text not null,
  profile_kind text not null,
  profile_status text not null default 'observed',
  match_method text not null,
  match_confidence numeric(5,2),
  review_status text not null default 'unreviewed',
  title text not null,
  summary text,
  attributes jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (entity_id, source_key, profile_kind)
);

create index if not exists entity_local_profiles_entity_idx
  on centinela.entity_local_profiles (entity_id, source_key, profile_kind);

create index if not exists entity_local_profiles_source_idx
  on centinela.entity_local_profiles (source_key, profile_status);

create table if not exists centinela.entity_intelligence_signals (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  related_entity_id bigint references centinela.entities(id) on delete set null,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_key text not null,
  signal_code text not null,
  signal_name text not null,
  signal_scope text not null default 'local',
  category text not null,
  severity text not null,
  score numeric(5,2) not null default 0,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists entity_intelligence_signals_entity_idx
  on centinela.entity_intelligence_signals (entity_id, severity, category, source_key);

create index if not exists entity_intelligence_signals_related_idx
  on centinela.entity_intelligence_signals (related_entity_id, source_key);

drop view if exists centinela.entity_representative_overview;
drop view if exists centinela.entity_intelligence_signal_overview;
drop view if exists centinela.entity_local_profile_overview;

create view centinela.entity_local_profile_overview as
select
  profiles.entity_id,
  entities.canonical_name as entity_name,
  entities.entity_type,
  profiles.source_run_id,
  profiles.source_key,
  profiles.profile_kind,
  profiles.profile_status,
  profiles.match_method,
  profiles.match_confidence,
  profiles.review_status,
  profiles.title as profile_title,
  profiles.summary,
  profiles.attributes,
  profiles.evidence,
  coalesce(profiles.attributes ->> 'providerSlug', '') as provider_slug,
  coalesce(profiles.attributes ->> 'ruc', '') as ruc,
  coalesce(profiles.attributes ->> 'officialName', profiles.title) as official_name,
  coalesce(profiles.attributes ->> 'supplierType', '') as supplier_type,
  coalesce(profiles.attributes ->> 'companySize', '') as company_size,
  coalesce(profiles.attributes ->> 'activityType', '') as activity_type,
  coalesce(profiles.attributes ->> 'registryActivationAt', '') as registry_activation_at,
  coalesce(profiles.attributes ->> 'sipeActivationAt', '') as sipe_activation_at,
  coalesce(profiles.attributes ->> 'inscriptionAt', '') as inscription_at,
  coalesce(profiles.attributes ->> 'detailUrl', '') as detail_url,
  coalesce(profiles.attributes ->> 'email', '') as email,
  coalesce(profiles.attributes ->> 'phone', '') as phone,
  coalesce(profiles.attributes ->> 'address', '') as address,
  coalesce(profiles.attributes ->> 'city', '') as city,
  coalesce(profiles.attributes ->> 'department', '') as department,
  coalesce(profiles.attributes ->> 'country', '') as country,
  coalesce(profiles.attributes ->> 'fantasyName', '') as fantasy_name,
  coalesce(profiles.attributes ->> 'adjudicationCount', '0')::integer as adjudication_count,
  coalesce(profiles.attributes -> 'representatives', '[]'::jsonb) as representatives,
  profiles.first_seen_at,
  profiles.last_seen_at
from centinela.entity_local_profiles as profiles
join centinela.entities
  on entities.id = profiles.entity_id;

create view centinela.entity_intelligence_signal_overview as
select
  signals.id,
  signals.entity_id,
  entities.canonical_name as entity_name,
  signals.related_entity_id,
  related_entities.canonical_name as related_entity_name,
  signals.source_run_id,
  signals.source_key,
  signals.signal_code,
  signals.signal_name,
  signals.signal_scope,
  signals.category,
  signals.severity,
  signals.score,
  signals.rationale,
  signals.evidence,
  signals.first_seen_at,
  signals.last_seen_at
from centinela.entity_intelligence_signals as signals
join centinela.entities
  on entities.id = signals.entity_id
left join centinela.entities as related_entities
  on related_entities.id = signals.related_entity_id;

create view centinela.entity_representative_overview as
select
  relationships.subject_entity_id as entity_id,
  company.canonical_name as entity_name,
  relationships.object_entity_id as representative_entity_id,
  representative.canonical_name as representative_name,
  relationships.confidence,
  relationships.source_key,
  coalesce(relationships.attributes ->> 'sourceRole', 'legal_representative') as source_role,
  coalesce(relationships.attributes ->> 'providerSlug', '') as provider_slug,
  coalesce(relationships.attributes ->> 'providerRuc', '') as provider_ruc,
  coalesce(relationships.attributes -> 'evidence', '[]'::jsonb) as evidence
from centinela.entity_relationships as relationships
join centinela.entities as company
  on company.id = relationships.subject_entity_id
join centinela.entities as representative
  on representative.id = relationships.object_entity_id
where relationships.relation_type = 'representation_legal';
