create table if not exists centinela.entity_relationship_staging (
  id bigserial primary key,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_record_id bigint references centinela.source_records(id) on delete set null,
  source_key text not null,
  company_entity_id bigint not null references centinela.entities(id) on delete cascade,
  company_ruc_base text not null,
  company_name text,
  relation_type text not null,
  relation_label text not null,
  related_entity_type text not null default 'person',
  related_person_display text not null,
  related_person_name_hash text not null,
  source_row_hash text not null,
  source_line_number integer,
  match_method text not null,
  match_confidence numeric(5,2),
  review_status text not null default 'staged_review_only',
  public_display_status text not null default 'blocked_personal_data',
  promotion_status text not null default 'not_promoted',
  rationale text not null,
  relationship_attributes jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source_key, relation_type, company_entity_id, related_person_name_hash, source_row_hash)
);

create index if not exists entity_relationship_staging_company_idx
  on centinela.entity_relationship_staging (company_entity_id, relation_type, review_status);

create index if not exists entity_relationship_staging_source_idx
  on centinela.entity_relationship_staging (source_key, relation_type, public_display_status);

create index if not exists entity_relationship_staging_hash_idx
  on centinela.entity_relationship_staging (related_person_name_hash, relation_type);

drop view if exists centinela.entity_relationship_staging_summary;
drop view if exists centinela.entity_relationship_staging_overview;

create view centinela.entity_relationship_staging_overview as
select
  staging.id,
  staging.source_run_id,
  staging.source_record_id,
  staging.source_key,
  staging.company_entity_id,
  company.canonical_name as company_entity_name,
  staging.company_ruc_base,
  staging.company_name,
  staging.relation_type,
  staging.relation_label,
  staging.related_entity_type,
  staging.related_person_display,
  staging.related_person_name_hash,
  staging.source_row_hash,
  staging.source_line_number,
  staging.match_method,
  staging.match_confidence,
  staging.review_status,
  staging.public_display_status,
  staging.promotion_status,
  staging.rationale,
  staging.relationship_attributes,
  staging.provenance,
  staging.limitations,
  staging.first_seen_at,
  staging.last_seen_at,
  records.source_url,
  records.external_id as source_record_external_id
from centinela.entity_relationship_staging as staging
join centinela.entities as company
  on company.id = staging.company_entity_id
left join centinela.source_records as records
  on records.id = staging.source_record_id;

create view centinela.entity_relationship_staging_summary as
select
  company_entity_id as entity_id,
  company_entity_name as entity_name,
  source_key,
  relation_type,
  relation_label,
  review_status,
  public_display_status,
  count(*) as staged_relation_count,
  min(first_seen_at) as first_seen_at,
  max(last_seen_at) as last_seen_at
from centinela.entity_relationship_staging_overview
group by
  company_entity_id,
  company_entity_name,
  source_key,
  relation_type,
  relation_label,
  review_status,
  public_display_status;
