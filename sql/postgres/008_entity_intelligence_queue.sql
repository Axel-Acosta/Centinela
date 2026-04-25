drop view if exists centinela.entity_anchor_coverage_overview;
drop view if exists centinela.entity_intelligence_review_queue;

create view centinela.entity_intelligence_review_queue as
with profile_summary as (
  select
    entity_id,
    count(*) as local_profile_count,
    bool_or(true) as has_local_profile,
    max(adjudication_count) as max_local_adjudication_count,
    array_agg(distinct source_key order by source_key) as local_profile_sources
  from centinela.entity_local_profile_overview
  group by entity_id
),
local_signal_summary as (
  select
    entity_id,
    count(*) as local_signal_count,
    array_agg(distinct signal_code order by signal_code) as local_signal_codes,
    max(
      case severity
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 0
      end
    ) as max_local_severity_rank,
    coalesce(sum(score), 0) as total_local_signal_score
  from centinela.entity_intelligence_signal_overview
  group by entity_id
),
external_summary as (
  select
    entity_id,
    count(*) as external_match_count,
    coalesce(sum(signal_count), 0) as external_signal_count,
    max(
      case max_severity
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 0
      end
    ) as max_external_severity_rank,
    array_agg(distinct source_key order by source_key) as external_source_keys
  from centinela.entity_external_match_overview
  group by entity_id
),
representative_summary as (
  select
    entity_id,
    count(*) as representative_count
  from centinela.entity_representative_overview
  group by entity_id
)
select
  activity.entity_id,
  activity.entity_name,
  activity.entity_type,
  activity.source_count,
  activity.source_keys,
  activity.total_process_count,
  activity.supplier_process_count,
  activity.flagged_process_count,
  activity.total_risk_signals,
  activity.supplier_linked_contract_value,
  activity.supplier_linked_paid_amount,
  coalesce(profile_summary.local_profile_count, 0) as local_profile_count,
  coalesce(profile_summary.has_local_profile, false) as has_local_profile,
  coalesce(profile_summary.max_local_adjudication_count, 0) as local_adjudication_count,
  coalesce(profile_summary.local_profile_sources, '{}'::text[]) as local_profile_sources,
  coalesce(local_signal_summary.local_signal_count, 0) as local_signal_count,
  coalesce(local_signal_summary.local_signal_codes, '{}'::text[]) as local_signal_codes,
  case coalesce(local_signal_summary.max_local_severity_rank, 0)
    when 3 then 'high'
    when 2 then 'medium'
    when 1 then 'low'
    else 'none'
  end as max_local_severity,
  coalesce(local_signal_summary.total_local_signal_score, 0) as total_local_signal_score,
  coalesce(external_summary.external_match_count, 0) as external_match_count,
  coalesce(external_summary.external_signal_count, 0) as external_signal_count,
  case coalesce(external_summary.max_external_severity_rank, 0)
    when 3 then 'high'
    when 2 then 'medium'
    when 1 then 'low'
    else 'none'
  end as max_external_severity,
  coalesce(external_summary.external_source_keys, '{}'::text[]) as external_source_keys,
  coalesce(representative_summary.representative_count, 0) as representative_count,
  case
    when coalesce(profile_summary.has_local_profile, false) then 'anchored'
    else 'unanchored'
  end as anchor_status,
  case
    when coalesce(external_summary.max_external_severity_rank, 0) = 3 then 'priority'
    when coalesce(local_signal_summary.max_local_severity_rank, 0) = 3 then 'priority'
    when coalesce(local_signal_summary.local_signal_count, 0) >= 2 then 'priority'
    when not coalesce(profile_summary.has_local_profile, false) and activity.total_risk_signals >= 3 then 'enhanced_review'
    when coalesce(external_summary.external_signal_count, 0) > 0 then 'enhanced_review'
    when coalesce(local_signal_summary.local_signal_count, 0) > 0 then 'enhanced_review'
    when coalesce(representative_summary.representative_count, 0) >= 4 then 'enhanced_review'
    else 'triage'
  end as review_priority,
  case
    when coalesce(external_summary.external_signal_count, 0) > 0 then 'external_risk_review'
    when coalesce(local_signal_summary.max_local_severity_rank, 0) = 3 then 'local_sanction_review'
    when not coalesce(profile_summary.has_local_profile, false) then 'company_anchor_gap'
    when coalesce(representative_summary.representative_count, 0) >= 4 then 'relationship_review'
    else 'entity_triage'
  end as review_lane,
  case
    when coalesce(external_summary.external_signal_count, 0) > 0
      then 'Which local identifiers, procurement patterns, and counterparties strengthen or weaken the current external-risk lead?'
    when coalesce(local_signal_summary.max_local_severity_rank, 0) = 3
      then 'What is the current status and time scope of the official DNCP administrative sanction history for this supplier?'
    when not coalesce(profile_summary.has_local_profile, false)
      then 'Why does this procurement-linked supplier still lack an official DNCP company anchor, and which identifier should resolve it next?'
    when coalesce(representative_summary.representative_count, 0) >= 4
      then 'Do the current representative links suggest shared control, repeat representation, or a relationship worth deeper review?'
    else 'Which next fact would most improve confidence in this company dossier?'
  end as lead_question,
  case
    when coalesce(external_summary.external_signal_count, 0) > 0
      then 'Review the external match evidence together with local RUC, supplier profile, counterparties, and representative links before escalating.'
    when coalesce(local_signal_summary.max_local_severity_rank, 0) = 3
      then 'Review the official DNCP sanctions history, resolution context, dates, and current supplier status.'
    when not coalesce(profile_summary.has_local_profile, false)
      then 'Run or rerun the Paraguay supplier anchor and add the next lawful Paraguay identity source for validation.'
    when coalesce(representative_summary.representative_count, 0) >= 4
      then 'Inspect representative overlap, repeated buyers, and related company dossiers for relationship-aware follow-up.'
    else 'Start with the entity dossier and then pivot into the highest-signal linked processes.'
  end as recommended_action
from centinela.entity_procurement_activity as activity
left join profile_summary
  on profile_summary.entity_id = activity.entity_id
left join local_signal_summary
  on local_signal_summary.entity_id = activity.entity_id
left join external_summary
  on external_summary.entity_id = activity.entity_id
left join representative_summary
  on representative_summary.entity_id = activity.entity_id
where activity.entity_type = 'company'
  and activity.supplier_process_count > 0;

create view centinela.entity_anchor_coverage_overview as
select
  count(*) as total_supplier_entities,
  count(*) filter (where anchor_status = 'anchored') as anchored_supplier_entities,
  count(*) filter (where anchor_status = 'unanchored') as unanchored_supplier_entities,
  count(*) filter (where local_signal_count > 0) as local_signal_entities,
  count(*) filter (where external_signal_count > 0) as external_signal_entities,
  coalesce(sum(representative_count), 0) as representative_link_count
from centinela.entity_intelligence_review_queue;
