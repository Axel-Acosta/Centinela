create table if not exists centinela.entity_enrichment_candidates (
  id bigserial primary key,
  entity_id bigint not null references centinela.entities(id) on delete cascade,
  source_run_id bigint references centinela.source_runs(id) on delete set null,
  source_key text not null,
  external_id text not null,
  external_name text not null,
  external_schema text not null default '',
  external_entity_type text not null default 'unknown',
  local_screening_role text not null,
  candidate_status text not null,
  match_method text not null,
  match_confidence numeric(5,2) not null default 0,
  match_quality text not null default 'candidate',
  review_status text not null default 'unreviewed',
  rejection_reason text,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  external_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (entity_id, source_key, external_id, local_screening_role, match_method)
);

create index if not exists entity_enrichment_candidates_entity_idx
  on centinela.entity_enrichment_candidates (entity_id, candidate_status, match_confidence desc);

create index if not exists entity_enrichment_candidates_source_idx
  on centinela.entity_enrichment_candidates (source_key, candidate_status, review_status);

create index if not exists entity_enrichment_candidates_external_idx
  on centinela.entity_enrichment_candidates (source_key, external_id);

drop view if exists centinela.entity_anchor_gap_review;
drop view if exists centinela.entity_anchor_coverage_overview;
drop view if exists centinela.entity_intelligence_review_queue;
drop view if exists centinela.entity_enrichment_candidate_overview;

create view centinela.entity_enrichment_candidate_overview as
select
  candidates.id,
  candidates.entity_id,
  local_entities.canonical_name as entity_name,
  local_entities.entity_type,
  candidates.source_run_id,
  candidates.source_key,
  candidates.external_id,
  candidates.external_name,
  candidates.external_schema,
  candidates.external_entity_type,
  candidates.local_screening_role,
  candidates.candidate_status,
  candidates.match_method,
  candidates.match_confidence,
  candidates.match_quality,
  candidates.review_status,
  candidates.rejection_reason,
  candidates.rationale,
  candidates.evidence,
  coalesce(candidates.external_payload -> 'datasets', '[]'::jsonb) as external_datasets,
  coalesce(candidates.external_payload -> 'countries', '[]'::jsonb) as external_countries,
  coalesce(candidates.external_payload -> 'aliases', '[]'::jsonb) as external_aliases,
  coalesce(candidates.external_payload -> 'identifiers', '[]'::jsonb) as external_identifiers,
  candidates.first_seen_at,
  candidates.last_seen_at
from centinela.entity_enrichment_candidates as candidates
join centinela.entities as local_entities
  on local_entities.id = candidates.entity_id;

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
candidate_summary as (
  select
    entity_id,
    count(*) as external_candidate_count,
    count(*) filter (where candidate_status = 'review_candidate') as external_review_candidate_count,
    count(*) filter (where candidate_status = 'rejected_diagnostic') as external_rejected_candidate_count,
    max(match_confidence) as max_external_candidate_confidence,
    array_agg(distinct source_key order by source_key) as external_candidate_source_keys
  from centinela.entity_enrichment_candidate_overview
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
  coalesce(candidate_summary.external_candidate_count, 0) as external_candidate_count,
  coalesce(candidate_summary.external_review_candidate_count, 0) as external_review_candidate_count,
  coalesce(candidate_summary.external_rejected_candidate_count, 0) as external_rejected_candidate_count,
  coalesce(candidate_summary.max_external_candidate_confidence, 0) as max_external_candidate_confidence,
  coalesce(candidate_summary.external_candidate_source_keys, '{}'::text[]) as external_candidate_source_keys,
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
    when coalesce(candidate_summary.external_review_candidate_count, 0) > 0 then 'enhanced_review'
    when coalesce(local_signal_summary.local_signal_count, 0) > 0 then 'enhanced_review'
    when coalesce(representative_summary.representative_count, 0) >= 4 then 'enhanced_review'
    else 'triage'
  end as review_priority,
  case
    when coalesce(external_summary.external_signal_count, 0) > 0 then 'external_risk_review'
    when coalesce(local_signal_summary.max_local_severity_rank, 0) = 3 then 'local_sanction_review'
    when not coalesce(profile_summary.has_local_profile, false) then 'company_anchor_gap'
    when coalesce(candidate_summary.external_review_candidate_count, 0) > 0 then 'external_candidate_review'
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
    when coalesce(candidate_summary.external_review_candidate_count, 0) > 0
      then 'Do the surfaced external candidates represent plausible entity-context leads, or should they remain rejected diagnostics?'
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
    when coalesce(candidate_summary.external_review_candidate_count, 0) > 0
      then 'Inspect candidate evidence, rejection reasons, local identifiers, and representative/company context before accepting, rejecting, or seeking stronger source evidence.'
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
left join candidate_summary
  on candidate_summary.entity_id = activity.entity_id
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
  count(*) filter (where external_review_candidate_count > 0) as external_candidate_entities,
  coalesce(sum(external_candidate_count), 0) as external_candidate_count,
  coalesce(sum(external_review_candidate_count), 0) as external_review_candidate_count,
  coalesce(sum(external_rejected_candidate_count), 0) as external_rejected_candidate_count,
  coalesce(sum(representative_count), 0) as representative_link_count
from centinela.entity_intelligence_review_queue;

create view centinela.entity_anchor_gap_review as
with identifier_summary as (
  select
    entity_id,
    count(*) as identifier_count,
    array_agg(distinct concat(scheme, ':', value) order by concat(scheme, ':', value)) as identifiers,
    array_agg(distinct value order by value) filter (where scheme ilike '%RUC%') as ruc_identifiers,
    bool_or(scheme ilike '%RUC%') as has_ruc_identifier,
    bool_or(
      scheme ilike '%RUC%'
      and (
        value ~ '^PY-RUC-[0-9]+-[0-9]$'
        or value ~ '^[0-9]+-[0-9]$'
      )
    ) as has_complete_ruc_identifier
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
  coalesce(identifier_summary.has_complete_ruc_identifier, false) as has_complete_ruc_identifier,
  coalesce(mention_summary.procurement_source_mention_count, 0) as procurement_source_mention_count,
  coalesce(mention_summary.observed_names, '{}'::text[]) as observed_names,
  case
    when coalesce(identifier_summary.has_ruc_identifier, false)
      and not coalesce(identifier_summary.has_complete_ruc_identifier, false)
      then 'ruc_missing_check_digit_for_dnit_bulk_validation'
    when coalesce(identifier_summary.has_ruc_identifier, false)
      then 'ruc_not_resolved_by_dncp_supplier_registry_or_dnit_equivalence'
    when coalesce(identifier_summary.identifier_count, 0) > 0
      then 'non_ruc_identifier_needs_local_validation'
    else 'missing_structured_local_identifier'
  end as gap_reason,
  case
    when coalesce(identifier_summary.has_ruc_identifier, false)
      and not coalesce(identifier_summary.has_complete_ruc_identifier, false)
      then 'Recover the missing RUC check digit from DNCP source records, official documents, or another lawful Paraguay identity source before rerunning DNIT bulk validation.'
    when coalesce(identifier_summary.has_ruc_identifier, false)
      then 'Inspect the RUC against DNCP supplier search, DNIT equivalence files, and source records to determine whether the procurement identifier is stale, malformed, or outside the current official bulk list.'
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
