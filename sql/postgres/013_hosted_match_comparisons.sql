create table if not exists centinela.entity_hosted_match_comparisons (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_key text not null,
  local_screening_role text not null,
  api_base_url text not null,
  dataset text not null,
  algorithm text not null,
  threshold numeric(8,4) not null default 0.7,
  result_limit integer not null default 5,
  batch_size integer not null default 20,
  dry_run boolean not null default false,
  support_category text not null,
  hosted_result_count integer not null default 0,
  local_candidate_statuses text[] not null default '{}'::text[],
  local_candidate_methods text[] not null default '{}'::text[],
  local_candidate_max_confidence numeric(5,2),
  local_external_ids text[] not null default '{}'::text[],
  local_external_names text[] not null default '{}'::text[],
  linked_company_names text[] not null default '{}'::text[],
  query_payload jsonb not null default '{}'::jsonb,
  top_results jsonb not null default '[]'::jsonb,
  top_result_id text,
  top_result_name text,
  top_result_schema text,
  top_result_score numeric(12,8),
  top_result_datasets text[] not null default '{}'::text[],
  compared_at timestamptz not null default now()
);

create index if not exists entity_hosted_match_comparisons_entity_idx
  on centinela.entity_hosted_match_comparisons (entity_id, local_screening_role, compared_at desc);

create index if not exists entity_hosted_match_comparisons_source_idx
  on centinela.entity_hosted_match_comparisons (source_key, support_category, compared_at desc);

drop view if exists centinela.entity_hosted_match_comparison_overview;

create view centinela.entity_hosted_match_comparison_overview as
select
  comparisons.id,
  comparisons.entity_id,
  entities.canonical_name as entity_name,
  entities.entity_type,
  comparisons.source_run_id,
  comparisons.source_key,
  comparisons.local_screening_role,
  comparisons.api_base_url,
  comparisons.dataset,
  comparisons.algorithm,
  comparisons.threshold,
  comparisons.result_limit,
  comparisons.batch_size,
  comparisons.dry_run,
  comparisons.support_category,
  comparisons.hosted_result_count,
  comparisons.local_candidate_statuses,
  comparisons.local_candidate_methods,
  comparisons.local_candidate_max_confidence,
  comparisons.local_external_ids,
  comparisons.local_external_names,
  comparisons.linked_company_names,
  comparisons.query_payload,
  comparisons.top_results,
  comparisons.top_result_id,
  comparisons.top_result_name,
  comparisons.top_result_schema,
  comparisons.top_result_score,
  comparisons.top_result_datasets,
  comparisons.compared_at
from centinela.entity_hosted_match_comparisons as comparisons
join centinela.entities
  on entities.id = comparisons.entity_id;
