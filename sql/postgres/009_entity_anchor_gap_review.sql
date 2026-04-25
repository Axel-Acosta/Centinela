drop view if exists centinela.entity_anchor_gap_review;

create view centinela.entity_anchor_gap_review as
with identifier_summary as (
  select
    entity_id,
    count(*) as identifier_count,
    array_agg(distinct concat(scheme, ':', value) order by concat(scheme, ':', value)) as identifiers,
    array_agg(distinct value order by value) filter (where scheme ilike '%RUC%') as ruc_identifiers,
    bool_or(scheme ilike '%RUC%') as has_ruc_identifier
  from centinela.entity_identifiers
  group by entity_id
),
mention_summary as (
  select
    entity_id,
    count(*) as procurement_source_mention_count,
    array_agg(distinct observed_name order by observed_name) filter (where observed_name is not null) as observed_names
  from centinela.entity_source_mentions
  where source_key like 'py-dncp-%'
  group by entity_id
)
select
  queue.entity_id,
  queue.entity_name,
  queue.source_keys,
  queue.total_process_count,
  queue.flagged_process_count,
  queue.total_risk_signals,
  queue.supplier_linked_contract_value,
  queue.supplier_linked_paid_amount,
  coalesce(identifier_summary.identifier_count, 0) as identifier_count,
  coalesce(identifier_summary.identifiers, '{}'::text[]) as identifiers,
  coalesce(identifier_summary.ruc_identifiers, '{}'::text[]) as ruc_identifiers,
  coalesce(identifier_summary.has_ruc_identifier, false) as has_ruc_identifier,
  coalesce(mention_summary.procurement_source_mention_count, 0) as procurement_source_mention_count,
  coalesce(mention_summary.observed_names, '{}'::text[]) as observed_names,
  case
    when coalesce(identifier_summary.has_ruc_identifier, false)
      then 'ruc_not_resolved_by_dncp_supplier_registry'
    when coalesce(identifier_summary.identifier_count, 0) > 0
      then 'non_ruc_identifier_needs_local_validation'
    else 'missing_structured_local_identifier'
  end as gap_reason,
  case
    when coalesce(identifier_summary.has_ruc_identifier, false)
      then 'Retry the official DNCP supplier anchor with fallback name search, then validate unresolved RUCs against the next lawful Paraguay company or taxpayer source.'
    when coalesce(identifier_summary.identifier_count, 0) > 0
      then 'Inspect source records and normalize the strongest local identifier before external enrichment escalation.'
    else 'Recover a local supplier identifier from DNCP source records or another lawful Paraguay company source before treating external matches as meaningful.'
  end as next_resolution_step,
  queue.review_priority,
  queue.review_lane,
  queue.lead_question,
  queue.recommended_action
from centinela.entity_intelligence_review_queue as queue
left join identifier_summary
  on identifier_summary.entity_id = queue.entity_id
left join mention_summary
  on mention_summary.entity_id = queue.entity_id
where queue.anchor_status = 'unanchored';
