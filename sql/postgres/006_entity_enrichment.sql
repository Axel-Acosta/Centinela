create table if not exists centinela.entity_enrichment_matches (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  matched_entity_id bigint not null references centinela.entities(id) on delete cascade,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_key text not null,
  match_method text not null,
  match_confidence numeric(5,2),
  match_quality text not null,
  review_status text not null default 'unreviewed',
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (entity_id, matched_entity_id, source_key, match_method)
);

create index if not exists entity_enrichment_matches_entity_idx
  on centinela.entity_enrichment_matches (entity_id, match_quality, source_key);

create index if not exists entity_enrichment_matches_matched_idx
  on centinela.entity_enrichment_matches (matched_entity_id, source_key);

create table if not exists centinela.entity_external_risk_signals (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  matched_entity_id bigint references centinela.entities(id) on delete cascade,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_key text not null,
  signal_code text not null,
  signal_name text not null,
  category text not null,
  severity text not null,
  score numeric(5,2) not null default 0,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (entity_id, matched_entity_id, source_key, signal_code)
);

create index if not exists entity_external_risk_signals_entity_idx
  on centinela.entity_external_risk_signals (entity_id, severity, category);

create index if not exists entity_external_risk_signals_match_idx
  on centinela.entity_external_risk_signals (matched_entity_id, signal_code);

drop view if exists centinela.entity_external_risk_overview;
drop view if exists centinela.entity_external_match_overview;

create view centinela.entity_external_match_overview as
with signal_summary as (
  select
    signals.entity_id,
    signals.matched_entity_id,
    array_agg(signals.signal_code order by signals.score desc, signals.signal_code) as signal_codes,
    array_agg(signals.signal_name order by signals.score desc, signals.signal_code) as signal_names,
    array_agg(distinct signals.category order by signals.category) as signal_categories,
    count(*) as signal_count,
    sum(signals.score) as total_score,
    max(
      case signals.severity
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 0
      end
    ) as max_severity_rank
  from centinela.entity_external_risk_signals as signals
  group by signals.entity_id, signals.matched_entity_id
)
select
  matches.entity_id,
  local_entities.canonical_name as entity_name,
  local_entities.entity_type,
  matches.matched_entity_id,
  external_entities.canonical_name as matched_entity_name,
  external_entities.entity_type as matched_entity_type,
  matches.source_key,
  matches.match_method,
  matches.match_confidence,
  matches.match_quality,
  matches.review_status,
  matches.rationale,
  matches.evidence,
  coalesce(external_entities.attributes -> 'externalSchema', 'null'::jsonb) as external_schema,
  coalesce(external_entities.attributes -> 'datasets', '[]'::jsonb) as external_datasets,
  coalesce(external_entities.attributes -> 'countries', '[]'::jsonb) as external_countries,
  coalesce(external_entities.attributes -> 'programIds', '[]'::jsonb) as external_program_ids,
  coalesce(external_entities.attributes -> 'sanctions', '[]'::jsonb) as external_sanctions,
  coalesce(signal_summary.signal_codes, '{}'::text[]) as signal_codes,
  coalesce(signal_summary.signal_names, '{}'::text[]) as signal_names,
  coalesce(signal_summary.signal_categories, '{}'::text[]) as signal_categories,
  coalesce(signal_summary.signal_count, 0) as signal_count,
  coalesce(signal_summary.total_score, 0) as total_score,
  case coalesce(signal_summary.max_severity_rank, 0)
    when 3 then 'high'
    when 2 then 'medium'
    when 1 then 'low'
    else 'none'
  end as max_severity
from centinela.entity_enrichment_matches as matches
join centinela.entities as local_entities
  on local_entities.id = matches.entity_id
join centinela.entities as external_entities
  on external_entities.id = matches.matched_entity_id
left join signal_summary
  on signal_summary.entity_id = matches.entity_id
 and signal_summary.matched_entity_id = matches.matched_entity_id;

create view centinela.entity_external_risk_overview as
select
  entity_id,
  entity_name,
  count(*) as match_count,
  count(*) filter (where signal_count > 0) as risk_match_count,
  coalesce(sum(signal_count), 0) as external_signal_count,
  max(
    case max_severity
      when 'high' then 3
      when 'medium' then 2
      when 'low' then 1
      else 0
    end
  ) as max_severity_rank,
  array_agg(distinct source_key order by source_key) as source_keys
from centinela.entity_external_match_overview
group by entity_id, entity_name;
