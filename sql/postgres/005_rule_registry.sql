create table if not exists centinela.risk_rule_registry (
  code text primary key,
  country_code text not null,
  family text not null,
  name text not null,
  category text not null,
  default_severity text not null,
  default_score numeric(5,2) not null,
  review_lane text not null,
  review_priority_hint text not null,
  public_description text not null,
  analyst_question text not null,
  rationale_template text not null,
  recommended_action text not null,
  dncp_alignment text,
  methodology_notes jsonb not null default '[]'::jsonb,
  field_dependencies jsonb not null default '[]'::jsonb,
  evidence_requirements jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  precedent_influences jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists risk_rule_registry_country_code_idx
  on centinela.risk_rule_registry (country_code, category);

drop view if exists centinela.risk_rule_coverage;
drop view if exists centinela.process_review_queue;

create view centinela.risk_rule_coverage as
select
  registry.code,
  registry.country_code,
  registry.family,
  registry.name,
  registry.category,
  registry.default_severity,
  registry.default_score,
  registry.review_lane,
  registry.review_priority_hint,
  registry.public_description,
  registry.analyst_question,
  registry.recommended_action,
  registry.dncp_alignment,
  registry.methodology_notes,
  registry.field_dependencies,
  registry.evidence_requirements,
  registry.exclusions,
  registry.limitations,
  registry.precedent_influences,
  count(signals.id) as signal_count,
  count(distinct signals.process_id) as process_count,
  round(avg(signals.score)::numeric, 2) as avg_observed_score,
  max(signals.created_at) as last_observed_at
from centinela.risk_rule_registry as registry
left join centinela.risk_signals as signals
  on signals.signal_code = registry.code
group by
  registry.code,
  registry.country_code,
  registry.family,
  registry.name,
  registry.category,
  registry.default_severity,
  registry.default_score,
  registry.review_lane,
  registry.review_priority_hint,
  registry.public_description,
  registry.analyst_question,
  registry.recommended_action,
  registry.dncp_alignment,
  registry.methodology_notes,
  registry.field_dependencies,
  registry.evidence_requirements,
  registry.exclusions,
  registry.limitations,
  registry.precedent_influences;

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
),
rule_summary as (
  select
    signals.process_id,
    max(
      case registry.review_priority_hint
        when 'priority' then 3
        when 'enhanced_review' then 2
        else 1
      end
    ) as max_rule_priority_rank,
    (array_agg(registry.review_lane order by
      case registry.review_priority_hint
        when 'priority' then 3
        when 'enhanced_review' then 2
        else 1
      end desc,
      signals.score desc,
      signals.signal_code
    ))[1] as primary_review_lane,
    (array_agg(registry.recommended_action order by
      case registry.review_priority_hint
        when 'priority' then 3
        when 'enhanced_review' then 2
        else 1
      end desc,
      signals.score desc,
      signals.signal_code
    ))[1] as primary_recommended_action,
    (array_agg(registry.analyst_question order by
      case registry.review_priority_hint
        when 'priority' then 3
        when 'enhanced_review' then 2
        else 1
      end desc,
      signals.score desc,
      signals.signal_code
    ))[1] as primary_lead_question
  from centinela.risk_signals as signals
  join centinela.risk_rule_registry as registry
    on registry.code = signals.signal_code
  group by signals.process_id
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
    when coalesce(rule_summary.max_rule_priority_rank, 0) = 3 then 'priority'
    when overview.max_severity_rank = 3 then 'priority'
    when coalesce(pair_repeat.max_pair_occurrences, 0) >= 3 then 'priority'
    when coalesce(rule_summary.max_rule_priority_rank, 0) = 2 then 'enhanced_review'
    when overview.risk_signal_count >= 3 then 'enhanced_review'
    when overview.max_severity_rank = 2 then 'enhanced_review'
    else 'triage'
  end as review_priority,
  coalesce(rule_summary.primary_review_lane, 'general_triage') as review_lane,
  coalesce(rule_summary.primary_recommended_action, 'Start with basic provenance and source review.') as recommended_action,
  coalesce(rule_summary.primary_lead_question, 'Which source facts should be checked first before drawing any inference?') as lead_question
from centinela.process_risk_overview as overview
left join pair_repeat
  on pair_repeat.process_id = overview.process_id
left join rule_summary
  on rule_summary.process_id = overview.process_id
where overview.risk_signal_count > 0;
