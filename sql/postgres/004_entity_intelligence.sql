create table if not exists centinela.entity_source_mentions (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_key text not null,
  role text not null default 'observed',
  source_external_id text not null default '',
  observed_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  attributes jsonb not null default '{}'::jsonb,
  unique (entity_id, source_key, role, source_external_id)
);

create index if not exists entity_source_mentions_entity_source_idx
  on centinela.entity_source_mentions (entity_id, source_key);

create index if not exists process_parties_entity_role_idx
  on centinela.process_parties (entity_id, role);

drop view if exists centinela.process_review_queue;
drop view if exists centinela.buyer_supplier_edge_overview;
drop view if exists centinela.entity_procurement_activity;

create view centinela.entity_procurement_activity as
with role_summary as (
  select
    parties.entity_id,
    entities.canonical_name as entity_name,
    entities.entity_type,
    processes.source_key,
    parties.role,
    processes.id as process_id,
    coalesce(overview.total_contract_value, 0) as total_contract_value,
    coalesce(overview.total_paid_amount, 0) as total_paid_amount,
    coalesce(overview.risk_signal_count, 0) as risk_signal_count,
    processes.published_at
  from centinela.process_parties as parties
  join centinela.entities
    on entities.id = parties.entity_id
  join centinela.procurement_processes as processes
    on processes.id = parties.process_id
  left join centinela.process_risk_overview as overview
    on overview.process_id = parties.process_id
)
select
  entity_id,
  entity_name,
  entity_type,
  count(distinct source_key) as source_count,
  array_agg(distinct source_key order by source_key) as source_keys,
  count(distinct process_id) as total_process_count,
  count(distinct process_id) filter (where role = 'supplier') as supplier_process_count,
  count(distinct process_id) filter (where role = 'buyer') as buyer_process_count,
  count(distinct process_id) filter (where risk_signal_count > 0) as flagged_process_count,
  coalesce(sum(risk_signal_count), 0) as total_risk_signals,
  sum(case when role = 'supplier' then total_contract_value else 0 end) as supplier_linked_contract_value,
  sum(case when role = 'supplier' then total_paid_amount else 0 end) as supplier_linked_paid_amount,
  sum(case when role = 'buyer' then total_contract_value else 0 end) as buyer_linked_contract_value,
  sum(case when role = 'buyer' then total_paid_amount else 0 end) as buyer_linked_paid_amount,
  min(published_at) as first_published_at,
  max(published_at) as last_published_at
from role_summary
group by entity_id, entity_name, entity_type;

create view centinela.buyer_supplier_edge_overview as
with buyer_roles as (
  select
    process_id,
    entity_id as buyer_entity_id,
    party_name as buyer_name
  from centinela.process_parties
  where role = 'buyer'
),
supplier_roles as (
  select
    process_id,
    entity_id as supplier_entity_id,
    party_name as supplier_name
  from centinela.process_parties
  where role = 'supplier'
),
edge_processes as (
  select
    buyers.buyer_entity_id,
    suppliers.supplier_entity_id,
    buyers.buyer_name,
    suppliers.supplier_name,
    overview.process_id,
    overview.source_key,
    overview.risk_signal_count,
    overview.total_contract_value,
    overview.total_paid_amount,
    overview.published_at
  from buyer_roles as buyers
  join supplier_roles as suppliers
    on suppliers.process_id = buyers.process_id
  join centinela.process_risk_overview as overview
    on overview.process_id = buyers.process_id
),
edge_signal_codes as (
  select
    edge_processes.buyer_entity_id,
    edge_processes.supplier_entity_id,
    array_agg(distinct signals.signal_code order by signals.signal_code) as signal_codes
  from edge_processes
  left join centinela.risk_signals as signals
    on signals.process_id = edge_processes.process_id
  group by edge_processes.buyer_entity_id, edge_processes.supplier_entity_id
)
select
  edge_processes.buyer_entity_id,
  edge_processes.supplier_entity_id,
  edge_processes.buyer_name,
  edge_processes.supplier_name,
  count(distinct edge_processes.source_key) as source_count,
  array_agg(distinct edge_processes.source_key order by edge_processes.source_key) as source_keys,
  count(distinct edge_processes.process_id) as process_count,
  count(distinct edge_processes.process_id) filter (where edge_processes.risk_signal_count > 0) as flagged_process_count,
  coalesce(sum(edge_processes.risk_signal_count), 0) as total_risk_signals,
  sum(coalesce(edge_processes.total_contract_value, 0)) as linked_contract_value,
  sum(coalesce(edge_processes.total_paid_amount, 0)) as linked_paid_amount,
  min(edge_processes.published_at) as first_published_at,
  max(edge_processes.published_at) as last_published_at,
  coalesce(edge_signal_codes.signal_codes, '{}'::text[]) as signal_codes
from edge_processes
left join edge_signal_codes
  on edge_signal_codes.buyer_entity_id = edge_processes.buyer_entity_id
 and edge_signal_codes.supplier_entity_id = edge_processes.supplier_entity_id
group by
  edge_processes.buyer_entity_id,
  edge_processes.supplier_entity_id,
  edge_processes.buyer_name,
  edge_processes.supplier_name,
  edge_signal_codes.signal_codes;

create view centinela.process_review_queue as
with buyer_roles as (
  select process_id, entity_id as buyer_entity_id
  from centinela.process_parties
  where role = 'buyer'
),
supplier_roles as (
  select process_id, entity_id as supplier_entity_id
  from centinela.process_parties
  where role = 'supplier'
),
pair_repeat as (
  select
    buyers.process_id,
    max(edges.process_count) as max_pair_occurrences
  from buyer_roles as buyers
  join supplier_roles as suppliers
    on suppliers.process_id = buyers.process_id
  join centinela.buyer_supplier_edge_overview as edges
    on edges.buyer_entity_id = buyers.buyer_entity_id
   and edges.supplier_entity_id = suppliers.supplier_entity_id
  group by buyers.process_id
)
select
  overview.process_id,
  overview.source_key,
  overview.title,
  overview.buyer_name,
  overview.suppliers,
  overview.status_details,
  overview.risk_signal_count,
  overview.signal_codes,
  overview.max_severity,
  overview.max_severity_rank,
  coalesce(pair_repeat.max_pair_occurrences, 0) as max_pair_occurrences,
  overview.total_contract_value,
  overview.total_paid_amount,
  overview.source_url,
  case
    when overview.max_severity_rank = 3 then 'priority'
    when coalesce(pair_repeat.max_pair_occurrences, 0) >= 3 then 'priority'
    when overview.risk_signal_count >= 3 then 'priority'
    when overview.max_severity_rank = 2 then 'enhanced_review'
    else 'triage'
  end as review_priority,
  case
    when 'PY-DNCP-P002' = any(overview.signal_codes) then 'payment_trace'
    when 'PY-DNCP-P001' = any(overview.signal_codes) then 'repeat_supplier_review'
    when 'PY-DNCP-B001' = any(overview.signal_codes) then 'competition_review'
    when 'PY-DNCP-T002' = any(overview.signal_codes) then 'procedure_review'
    when 'PY-DNCP-T003' = any(overview.signal_codes) then 'context_review'
    else 'general_triage'
  end as review_lane,
  case
    when 'PY-DNCP-P002' = any(overview.signal_codes)
      then 'Check amendments, payment chronology, and related contracts before escalation.'
    when 'PY-DNCP-P001' = any(overview.signal_codes)
      then 'Review repeat buyer-supplier history, concentration, and any linked ownership context.'
    when 'PY-DNCP-B001' = any(overview.signal_codes)
      then 'Review competition conditions, tenderer count, and comparable procedures for the same buyer.'
    when 'PY-DNCP-T002' = any(overview.signal_codes)
      then 'Review procedure justification, legal basis, and exception-related documentation.'
    when 'PY-DNCP-T003' = any(overview.signal_codes)
      then 'Review contextual markers, timing, and any supporting budget or urgency documentation.'
    else 'Start with basic provenance and source review.'
  end as recommended_action
from centinela.process_risk_overview as overview
left join pair_repeat
  on pair_repeat.process_id = overview.process_id
where overview.risk_signal_count > 0;
