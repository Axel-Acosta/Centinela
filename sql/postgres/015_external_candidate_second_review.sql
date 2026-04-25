create table if not exists centinela.entity_enrichment_second_reviews (
  id bigserial primary key,
  candidate_id bigint not null references centinela.entity_enrichment_candidates(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  reviewed_by text not null,
  decision text not null check (decision in ('accepted_match', 'needs_more_evidence', 'rejected_match')),
  rationale text not null,
  limitations text,
  evidence jsonb not null default '[]'::jsonb,
  accepted_match_id bigint references centinela.entity_enrichment_matches(id) on delete set null
);

create index if not exists entity_enrichment_second_reviews_candidate_idx
  on centinela.entity_enrichment_second_reviews (candidate_id, reviewed_at desc, id desc);

create index if not exists entity_enrichment_second_reviews_decision_idx
  on centinela.entity_enrichment_second_reviews (decision, reviewed_at desc);

create unique index if not exists entity_enrichment_second_reviews_one_accepted_idx
  on centinela.entity_enrichment_second_reviews (candidate_id)
  where decision = 'accepted_match';

drop view if exists centinela.entity_enrichment_second_review_overview;
drop view if exists centinela.entity_anchor_gap_review;
drop view if exists centinela.entity_anchor_coverage_overview;
drop view if exists centinela.entity_intelligence_review_queue;
drop view if exists centinela.entity_enrichment_candidate_review_overview;

create view centinela.entity_enrichment_second_review_overview as
select
  reviews.id,
  reviews.candidate_id,
  candidates.entity_id,
  local_entities.canonical_name as entity_name,
  local_entities.entity_type,
  candidates.source_key as candidate_source_key,
  candidates.external_id,
  candidates.external_name,
  candidates.external_schema,
  candidates.external_entity_type,
  candidates.local_screening_role,
  candidates.match_method as candidate_match_method,
  candidates.match_confidence as candidate_match_confidence,
  candidates.review_status as candidate_review_status,
  reviews.reviewed_at,
  reviews.reviewed_by,
  reviews.decision,
  reviews.rationale,
  reviews.limitations,
  reviews.evidence,
  reviews.accepted_match_id,
  matches.source_key as accepted_match_source_key,
  matches.match_method as accepted_match_method,
  matches.match_quality as accepted_match_quality,
  matches.review_status as accepted_match_review_status
from centinela.entity_enrichment_second_reviews as reviews
join centinela.entity_enrichment_candidates as candidates
  on candidates.id = reviews.candidate_id
join centinela.entities as local_entities
  on local_entities.id = candidates.entity_id
left join centinela.entity_enrichment_matches as matches
  on matches.id = reviews.accepted_match_id;

create or replace view centinela.entity_enrichment_candidate_review_overview as
with identifier_summary as (
  select
    entity_id,
    array_agg(distinct concat(scheme, ':', value) order by concat(scheme, ':', value)) as local_identifiers,
    array_agg(distinct value order by value) filter (where scheme ilike '%RUC%') as local_ruc_identifiers
  from centinela.entity_identifiers
  group by entity_id
),
local_profile_summary as (
  select
    entity_id,
    array_agg(distinct source_key order by source_key) as local_profile_sources,
    array_agg(distinct official_name order by official_name) filter (where official_name is not null and official_name <> '') as local_profile_names,
    array_agg(distinct ruc order by ruc) filter (where ruc is not null and ruc <> '') as local_profile_rucs
  from centinela.entity_local_profile_overview
  group by entity_id
),
latest_hosted as (
  select distinct on (entity_id, local_screening_role)
    entity_id,
    local_screening_role,
    support_category as hosted_support_category,
    hosted_result_count as hosted_result_count,
    top_result_id as hosted_top_result_id,
    top_result_name as hosted_top_result_name,
    top_result_schema as hosted_top_result_schema,
    top_result_score as hosted_top_result_score,
    top_result_datasets as hosted_top_result_datasets,
    local_external_ids as hosted_local_external_ids,
    local_external_names as hosted_local_external_names,
    compared_at as hosted_compared_at
  from centinela.entity_hosted_match_comparison_overview
  order by entity_id, local_screening_role, compared_at desc, id desc
),
latest_second_review as (
  select distinct on (candidate_id)
    candidate_id,
    id as second_review_id,
    decision as second_review_decision,
    reviewed_at as second_reviewed_at,
    reviewed_by as second_reviewed_by,
    rationale as second_review_rationale,
    limitations as second_review_limitations,
    evidence as second_review_evidence,
    accepted_match_id
  from centinela.entity_enrichment_second_reviews
  order by candidate_id, reviewed_at desc, id desc
)
select
  overview.id,
  overview.entity_id,
  overview.entity_name,
  overview.entity_type,
  overview.source_run_id,
  overview.source_key,
  overview.external_id,
  overview.external_name,
  overview.external_schema,
  overview.external_entity_type,
  overview.local_screening_role,
  overview.candidate_status,
  overview.match_method,
  overview.match_confidence,
  overview.match_quality,
  candidates.review_status,
  candidates.reviewed_at,
  candidates.reviewed_by,
  candidates.review_notes,
  candidates.review_evidence,
  latest_second_review.second_review_id,
  latest_second_review.second_review_decision,
  latest_second_review.second_reviewed_at,
  latest_second_review.second_reviewed_by,
  latest_second_review.second_review_rationale,
  latest_second_review.second_review_limitations,
  latest_second_review.second_review_evidence,
  latest_second_review.accepted_match_id,
  overview.rejection_reason,
  overview.rationale,
  overview.evidence,
  overview.external_datasets,
  overview.external_countries,
  overview.external_aliases,
  overview.external_identifiers,
  latest_hosted.hosted_support_category,
  latest_hosted.hosted_result_count,
  latest_hosted.hosted_top_result_id,
  latest_hosted.hosted_top_result_name,
  latest_hosted.hosted_top_result_schema,
  latest_hosted.hosted_top_result_score,
  latest_hosted.hosted_top_result_datasets,
  latest_hosted.hosted_local_external_ids,
  latest_hosted.hosted_local_external_names,
  latest_hosted.hosted_compared_at,
  case
    when latest_second_review.second_review_decision = 'accepted_match' then 'accepted_match'
    when latest_second_review.second_review_decision = 'rejected_match' then 'rejected'
    when latest_second_review.second_review_decision = 'needs_more_evidence' then 'needs_evidence'
    when candidates.review_status <> 'unreviewed' then candidates.review_status
    when overview.candidate_status = 'review_candidate'
      and latest_hosted.hosted_support_category = 'same_local_candidate'
      then 'needs_evidence'
    when overview.candidate_status = 'review_candidate'
      then 'needs_evidence'
    when latest_hosted.hosted_support_category = 'different_hosted_result'
      then 'rejected'
    when latest_hosted.hosted_support_category = 'no_hosted_result'
      then 'rejected'
    else 'unreviewed'
  end as suggested_review_status,
  case
    when latest_second_review.second_review_decision = 'accepted_match' then 'closed'
    when latest_second_review.second_review_decision = 'rejected_match' then 'closed'
    when latest_second_review.second_review_decision = 'needs_more_evidence' then 'medium'
    when candidates.review_status = 'promotable' then 'high'
    when candidates.review_status = 'needs_evidence' then 'medium'
    when candidates.review_status = 'monitor' then 'diagnostic'
    when candidates.review_status = 'rejected' then 'closed'
    when overview.candidate_status = 'review_candidate'
      and latest_hosted.hosted_support_category = 'same_local_candidate'
      then 'high'
    when overview.candidate_status = 'review_candidate'
      then 'medium'
    when latest_hosted.hosted_support_category = 'same_local_candidate'
      then 'medium'
    else 'diagnostic'
  end as review_priority_hint,
  case
    when latest_second_review.second_review_decision = 'accepted_match'
      then 'A second reviewer accepted this as a source-backed identity match. Treat it as enrichment context, not proof of wrongdoing, and keep limitations visible in public or analyst outputs.'
    when latest_second_review.second_review_decision = 'rejected_match'
      then 'A second reviewer declined accepted-match insertion. Keep the row as audit history unless materially new source evidence appears.'
    when latest_second_review.second_review_decision = 'needs_more_evidence'
      then 'A second reviewer found the candidate still needs more evidence before accepted-match insertion.'
    when candidates.review_status = 'promotable'
      then 'A reviewer marked this candidate promotable. Before accepted-match insertion, verify source documents, local identifiers, and methodology notes in a second review step.'
    when candidates.review_status = 'needs_evidence'
      then 'A reviewer requested more evidence. Collect source documents, local identifiers, date context, or representative/ownership evidence before escalation.'
    when candidates.review_status = 'monitor'
      then 'A reviewer marked this row for monitoring. Preserve it for context, but do not treat it as an active escalation.'
    when candidates.review_status = 'rejected'
      then 'A reviewer rejected this candidate as an accepted match. Keep the record as audit history unless materially new source evidence appears.'
    when overview.candidate_status = 'review_candidate'
      and latest_hosted.hosted_support_category = 'same_local_candidate'
      then 'Hosted OpenSanctions returned the same local candidate. Review source documents, Paraguay identifiers, and procurement context before marking promotable.'
    when overview.candidate_status = 'review_candidate'
      and latest_hosted.hosted_support_category = 'different_hosted_result'
      then 'Hosted OpenSanctions returned a different top result. Treat this as broad-name ambiguity and seek stronger source evidence before escalation.'
    when overview.candidate_status = 'review_candidate'
      then 'Review the local RUC/DNCP/DNIT evidence, external source record, and procurement context before changing review status.'
    when latest_hosted.hosted_support_category = 'same_local_candidate'
      then 'Hosted support exists but the local row is diagnostic. Recheck whether the diagnostic threshold is still appropriate before escalation.'
    when latest_hosted.hosted_support_category = 'different_hosted_result'
      then 'Hosted matching suggests an alternative result. Keep this diagnostic unless source evidence identifies the same entity.'
    when latest_hosted.hosted_support_category = 'no_hosted_result'
      then 'Hosted matching did not support this local diagnostic. Keep as diagnostic unless new local or external evidence improves identity confidence.'
    else 'Keep as audit evidence. Do not escalate without stronger identity support.'
  end as review_next_step,
  overview.first_seen_at,
  overview.last_seen_at,
  coalesce(identifier_summary.local_identifiers, '{}'::text[]) as local_identifiers,
  coalesce(identifier_summary.local_ruc_identifiers, '{}'::text[]) as local_ruc_identifiers,
  coalesce(local_profile_summary.local_profile_sources, '{}'::text[]) as local_profile_sources,
  coalesce(local_profile_summary.local_profile_names, '{}'::text[]) as local_profile_names,
  coalesce(local_profile_summary.local_profile_rucs, '{}'::text[]) as local_profile_rucs
from centinela.entity_enrichment_candidate_overview as overview
join centinela.entity_enrichment_candidates as candidates
  on candidates.id = overview.id
left join identifier_summary
  on identifier_summary.entity_id = overview.entity_id
left join local_profile_summary
  on local_profile_summary.entity_id = overview.entity_id
left join latest_hosted
  on latest_hosted.entity_id = overview.entity_id
 and latest_hosted.local_screening_role = overview.local_screening_role
left join latest_second_review
  on latest_second_review.candidate_id = overview.id;

create or replace view centinela.entity_intelligence_review_queue as
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
    count(*) filter (
      where candidate_status = 'review_candidate'
        and review_status in ('unreviewed', 'needs_evidence', 'promotable')
        and coalesce(second_review_decision, '') not in ('accepted_match', 'rejected_match')
    ) as external_review_candidate_count,
    count(*) filter (
      where candidate_status = 'rejected_diagnostic'
         or review_status = 'rejected'
         or second_review_decision = 'rejected_match'
    ) as external_rejected_candidate_count,
    max(match_confidence) filter (
      where candidate_status = 'review_candidate'
        and review_status in ('unreviewed', 'needs_evidence', 'promotable')
        and coalesce(second_review_decision, '') not in ('accepted_match', 'rejected_match')
    ) as max_external_candidate_confidence,
    array_agg(distinct source_key order by source_key) as external_candidate_source_keys
  from centinela.entity_enrichment_candidate_review_overview
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
      then 'Inspect candidate evidence, reviewer status, hosted comparison support, local identifiers, second-review state, and representative/company context before accepting, rejecting, or seeking stronger source evidence.'
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
