create table if not exists centinela.analyst_case_public_reviews (
  id bigserial primary key,
  case_id bigint not null references centinela.analyst_cases(id) on delete cascade,
  review_status text not null default 'internal_only',
  public_summary text,
  public_limitations text,
  reviewed_by text not null default 'centinela-operator',
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint analyst_case_public_reviews_status_check
    check (review_status in (
      'internal_only',
      'public_candidate',
      'needs_redaction',
      'approved_public',
      'rejected_public'
    ))
);

create index if not exists analyst_case_public_reviews_case_idx
  on centinela.analyst_case_public_reviews (case_id, reviewed_at desc, id desc);

create index if not exists analyst_case_public_reviews_status_idx
  on centinela.analyst_case_public_reviews (review_status, reviewed_at desc);

create or replace view centinela.analyst_case_public_review_overview as
select distinct on (reviews.case_id)
  reviews.id,
  reviews.case_id,
  cases.case_key,
  cases.title as case_title,
  reviews.review_status,
  reviews.public_summary,
  reviews.public_limitations,
  reviews.reviewed_by,
  reviews.reviewed_at,
  reviews.metadata,
  count(*) over (partition by reviews.case_id)::int as review_history_count
from centinela.analyst_case_public_reviews as reviews
join centinela.analyst_cases as cases
  on cases.id = reviews.case_id
order by reviews.case_id, reviews.reviewed_at desc, reviews.id desc;

create or replace view centinela.analyst_case_evidence_export as
select
  evidence.id as evidence_link_id,
  evidence.case_id,
  evidence.case_key,
  evidence.case_title,
  cases.status as case_status,
  cases.priority as case_priority,
  coalesce(public_review.review_status, 'internal_only') as public_review_status,
  public_review.public_summary,
  public_review.public_limitations,
  public_review.reviewed_by as public_reviewed_by,
  public_review.reviewed_at as public_reviewed_at,
  evidence.source_record_id,
  evidence.source_key,
  evidence.external_id,
  evidence.record_kind,
  evidence.source_url,
  evidence.retrieved_at,
  evidence.source_run_status,
  evidence.target_type,
  evidence.target_id,
  evidence.target_label,
  evidence.field_path,
  evidence.field_value,
  evidence.evidence_summary,
  evidence.analyst_interpretation as internal_analyst_interpretation,
  evidence.limitations,
  evidence.evidence_role,
  evidence.created_by,
  evidence.created_at,
  evidence.metadata
    || jsonb_build_object(
      'sourceRecordId', evidence.source_record_id,
      'sourceKey', evidence.source_key,
      'externalId', evidence.external_id,
      'nonAccusatoryUse', true
    ) as evidence_metadata,
  'Evidence exports are source-backed review material. They are not proof of wrongdoing or a public finding.'::text
    as export_disclaimer
from centinela.analyst_case_evidence_overview as evidence
join centinela.analyst_cases as cases
  on cases.id = evidence.case_id
left join centinela.analyst_case_public_review_overview as public_review
  on public_review.case_id = evidence.case_id;

create or replace view centinela.analyst_case_overview as
select
  cases.id,
  cases.case_key,
  cases.title,
  cases.status,
  cases.priority,
  cases.summary,
  cases.created_by,
  cases.created_at,
  cases.updated_at,
  cases.metadata,
  count(distinct links.id)::int as linked_target_count,
  count(distinct notes.id)::int as note_count,
  max(notes.created_at) as latest_note_at,
  count(distinct evidence_links.id)::int as evidence_link_count,
  max(evidence_links.created_at) as latest_evidence_at,
  coalesce(public_review.review_status, 'internal_only') as public_review_status,
  public_review.reviewed_at as public_reviewed_at
from centinela.analyst_cases as cases
left join centinela.analyst_case_links as links
  on links.case_id = cases.id
left join centinela.analyst_notes as notes
  on notes.case_id = cases.id
left join centinela.analyst_evidence_links as evidence_links
  on evidence_links.case_id = cases.id
left join centinela.analyst_case_public_review_overview as public_review
  on public_review.case_id = cases.id
group by
  cases.id,
  cases.case_key,
  cases.title,
  cases.status,
  cases.priority,
  cases.summary,
  cases.created_by,
  cases.created_at,
  cases.updated_at,
  cases.metadata,
  public_review.review_status,
  public_review.reviewed_at;

create or replace view centinela.analyst_case_timeline as
select
  cases.id as case_id,
  cases.case_key,
  'case_created'::text as event_type,
  'case'::text as target_type,
  cases.id::text as target_id,
  cases.created_at as event_at,
  cases.created_by as actor,
  cases.title as title,
  cases.summary as body,
  cases.metadata
    || jsonb_build_object(
      'status', cases.status,
      'priority', cases.priority
    ) as metadata
from centinela.analyst_cases as cases

union all

select
  links.case_id,
  cases.case_key,
  'case_link'::text as event_type,
  links.target_type,
  links.target_id,
  links.created_at as event_at,
  links.created_by as actor,
  coalesce(
    links.label,
    entities.canonical_name,
    processes.title,
    candidates.entity_name || ' -> ' || candidates.external_name,
    source_records.source_key || ' #' || source_records.external_id,
    second_reviews.entity_name || ' -> ' || second_reviews.external_name,
    'accepted match #' || enrichment_matches.id::text,
    links.target_type || ' #' || links.target_id
  ) as title,
  links.rationale as body,
  links.metadata
    || jsonb_strip_nulls(jsonb_build_object(
      'linkId', links.id,
      'entityType', entities.entity_type,
      'processSourceKey', processes.source_key,
      'processOcid', processes.ocid,
      'candidateStatus', candidates.candidate_status,
      'candidateReviewStatus', candidates.review_status,
      'candidateSecondReviewDecision', candidates.second_review_decision,
      'sourceRecordKind', source_records.record_kind,
      'sourceRecordUrl', source_records.source_url,
      'secondReviewDecision', second_reviews.decision,
      'acceptedMatchReviewStatus', enrichment_matches.review_status
    )) as metadata
from centinela.analyst_case_links as links
join centinela.analyst_cases as cases
  on cases.id = links.case_id
left join centinela.entities as entities
  on links.target_type = 'entity'
 and entities.id = case when links.target_id ~ '^[0-9]+$' then links.target_id::bigint end
left join centinela.procurement_processes as processes
  on links.target_type = 'process'
 and processes.id = case when links.target_id ~ '^[0-9]+$' then links.target_id::bigint end
left join centinela.entity_enrichment_candidate_review_overview as candidates
  on links.target_type = 'external_candidate'
 and candidates.id = case when links.target_id ~ '^[0-9]+$' then links.target_id::bigint end
left join centinela.source_records as source_records
  on links.target_type = 'source_record'
 and source_records.id = case when links.target_id ~ '^[0-9]+$' then links.target_id::bigint end
left join centinela.entity_enrichment_second_review_overview as second_reviews
  on links.target_type = 'second_review'
 and second_reviews.id = case when links.target_id ~ '^[0-9]+$' then links.target_id::bigint end
left join centinela.entity_enrichment_matches as enrichment_matches
  on links.target_type = 'accepted_match'
 and enrichment_matches.id = case when links.target_id ~ '^[0-9]+$' then links.target_id::bigint end

union all

select
  notes.case_id,
  cases.case_key,
  'note'::text as event_type,
  notes.target_type,
  notes.target_id,
  notes.created_at as event_at,
  notes.analyst as actor,
  notes.note_type as title,
  notes.note_text as body,
  notes.provenance
    || jsonb_build_object(
      'noteId', notes.id,
      'visibility', notes.visibility
    ) as metadata
from centinela.analyst_notes as notes
join centinela.analyst_cases as cases
  on cases.id = notes.case_id
where notes.case_id is not null

union all

select
  evidence.case_id,
  evidence.case_key,
  'evidence_link'::text as event_type,
  evidence.target_type,
  evidence.target_id,
  evidence.created_at as event_at,
  evidence.created_by as actor,
  evidence.source_key || ' #' || evidence.external_id as title,
  evidence.evidence_summary as body,
  evidence.metadata
    || jsonb_strip_nulls(jsonb_build_object(
      'evidenceLinkId', evidence.id,
      'noteId', evidence.note_id,
      'sourceRecordId', evidence.source_record_id,
      'sourceKey', evidence.source_key,
      'externalId', evidence.external_id,
      'recordKind', evidence.record_kind,
      'sourceUrl', evidence.source_url,
      'targetLabel', evidence.target_label,
      'fieldPath', evidence.field_path,
      'fieldValue', evidence.field_value,
      'evidenceRole', evidence.evidence_role,
      'analystInterpretation', evidence.analyst_interpretation,
      'limitations', evidence.limitations
    )) as metadata
from centinela.analyst_case_evidence_overview as evidence

union all

select
  reviews.case_id,
  cases.case_key,
  'public_safety_review'::text as event_type,
  'case'::text as target_type,
  reviews.case_id::text as target_id,
  reviews.reviewed_at as event_at,
  reviews.reviewed_by as actor,
  reviews.review_status as title,
  reviews.public_summary as body,
  reviews.metadata
    || jsonb_strip_nulls(jsonb_build_object(
      'publicReviewId', reviews.id,
      'publicLimitations', reviews.public_limitations,
      'reviewStatus', reviews.review_status,
      'nonAccusatoryUse', true
    )) as metadata
from centinela.analyst_case_public_reviews as reviews
join centinela.analyst_cases as cases
  on cases.id = reviews.case_id;
