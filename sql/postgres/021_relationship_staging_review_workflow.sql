alter table centinela.entity_relationship_staging
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists last_reviewed_by text,
  add column if not exists last_review_decision text,
  add column if not exists last_review_rationale text;

create table if not exists centinela.entity_relationship_staging_reviews (
  id bigserial primary key,
  staging_id bigint not null references centinela.entity_relationship_staging(id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  reviewed_by text not null,
  decision text not null check (
    decision in (
      'needs_more_evidence',
      'keep_staged',
      'rejected',
      'promote_to_redacted_relationship'
    )
  ),
  rationale text not null,
  limitations text,
  evidence jsonb not null default '[]'::jsonb,
  promoted_subject_entity_id bigint references centinela.entities(id) on delete set null,
  promoted_object_entity_id bigint references centinela.entities(id) on delete set null,
  promoted_relationship_id bigint references centinela.entity_relationships(id) on delete set null
);

create index if not exists entity_relationship_staging_reviews_staging_idx
  on centinela.entity_relationship_staging_reviews (staging_id, reviewed_at desc);

create index if not exists entity_relationship_staging_reviews_decision_idx
  on centinela.entity_relationship_staging_reviews (decision, reviewed_at desc);

create unique index if not exists entity_relationship_staging_one_promotion_idx
  on centinela.entity_relationship_staging_reviews (staging_id)
  where decision = 'promote_to_redacted_relationship';

drop view if exists centinela.entity_relationship_staging_review_queue;
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
  staging.last_reviewed_at,
  staging.last_reviewed_by,
  staging.last_review_decision,
  staging.last_review_rationale,
  records.source_url,
  records.external_id as source_record_external_id,
  latest_review.id as latest_review_id,
  latest_review.reviewed_at as latest_reviewed_at,
  latest_review.reviewed_by as latest_reviewed_by,
  latest_review.decision as latest_review_decision,
  latest_review.rationale as latest_review_rationale,
  latest_review.limitations as latest_review_limitations,
  latest_review.promoted_object_entity_id,
  latest_review.promoted_relationship_id
from centinela.entity_relationship_staging as staging
join centinela.entities as company
  on company.id = staging.company_entity_id
left join centinela.source_records as records
  on records.id = staging.source_record_id
left join lateral (
  select reviews.*
  from centinela.entity_relationship_staging_reviews as reviews
  where reviews.staging_id = staging.id
  order by reviews.reviewed_at desc, reviews.id desc
  limit 1
) as latest_review
  on true;

create view centinela.entity_relationship_staging_summary as
select
  company_entity_id as entity_id,
  company_entity_name as entity_name,
  source_key,
  relation_type,
  relation_label,
  review_status,
  public_display_status,
  promotion_status,
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
  public_display_status,
  promotion_status;

create view centinela.entity_relationship_staging_review_queue as
select
  overview.*,
  coalesce(activity.total_process_count, 0) as total_process_count,
  coalesce(activity.flagged_process_count, 0) as flagged_process_count,
  coalesce(activity.total_risk_signals, 0) as total_risk_signals,
  coalesce(activity.supplier_linked_contract_value, 0) as supplier_linked_contract_value,
  coalesce(activity.supplier_linked_paid_amount, 0) as supplier_linked_paid_amount,
  case
    when overview.review_status = 'reviewed_promoted' then 'closed_promoted'
    when overview.review_status = 'reviewed_rejected' then 'closed_rejected'
    when overview.review_status = 'needs_more_evidence' then 'needs_more_evidence'
    when overview.relation_type = 'abogacia_beneficial_owner_staged' then 'high'
    when coalesce(activity.total_risk_signals, 0) >= 5 then 'high'
    when coalesce(activity.total_process_count, 0) >= 10 then 'triage'
    else 'normal'
  end as review_priority,
  case
    when overview.review_status = 'reviewed_promoted' then 'Promoted to a redacted internal relationship edge; keep public display blocked unless a later legal review permits disclosure.'
    when overview.review_status = 'reviewed_rejected' then 'Rejected for this workflow; keep rationale and source trace.'
    when overview.review_status = 'needs_more_evidence' then 'Gather stronger source-backed evidence before any promotion.'
    when overview.relation_type = 'abogacia_beneficial_owner_staged' then 'Review whether this redacted ownership lead should remain staged, require more evidence, or become a redacted internal graph edge.'
    else 'Review whether this redacted administrative relationship lead should remain staged, require more evidence, or be rejected.'
  end as lead_question,
  case
    when overview.review_status in ('reviewed_promoted', 'reviewed_rejected') then 'No immediate action unless new source evidence appears.'
    when overview.review_status = 'needs_more_evidence' then 'Open the linked source record and collect source-pack evidence before second review.'
    else 'Use database:review-staged-relationship or the internal API to record a cautious review decision.'
  end as recommended_action
from centinela.entity_relationship_staging_overview as overview
left join centinela.entity_procurement_activity as activity
  on activity.entity_id = overview.company_entity_id;
