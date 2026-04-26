create table if not exists centinela.analyst_evidence_links (
  id bigserial primary key,
  case_id bigint not null references centinela.analyst_cases(id) on delete cascade,
  note_id bigint references centinela.analyst_notes(id) on delete set null,
  source_record_id bigint not null references centinela.source_records(id) on delete restrict,
  target_type text not null,
  target_id text not null,
  field_path text,
  field_value text,
  evidence_summary text not null,
  analyst_interpretation text,
  limitations text,
  evidence_role text not null default 'context',
  created_by text not null default 'centinela-operator',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint analyst_evidence_links_target_type_check
    check (target_type in (
      'entity',
      'process',
      'external_candidate',
      'accepted_match',
      'source_record',
      'second_review',
      'other'
    )),
  constraint analyst_evidence_links_role_check
    check (evidence_role in (
      'context',
      'supports_identity_context',
      'supports_review_lead',
      'supports_limitation',
      'contradicts_or_limits',
      'needs_follow_up'
    ))
);

create index if not exists analyst_evidence_links_case_idx
  on centinela.analyst_evidence_links (case_id, created_at desc);

create index if not exists analyst_evidence_links_source_record_idx
  on centinela.analyst_evidence_links (source_record_id, created_at desc);

create index if not exists analyst_evidence_links_target_idx
  on centinela.analyst_evidence_links (target_type, target_id, created_at desc);

create or replace view centinela.analyst_note_overview as
select
  notes.id,
  notes.case_id,
  cases.case_key,
  cases.title as case_title,
  notes.target_type,
  notes.target_id,
  notes.note_type,
  notes.note_text,
  notes.analyst,
  notes.visibility,
  notes.provenance,
  notes.created_at,
  notes.updated_at,
  count(distinct evidence_links.id)::int as linked_source_record_count
from centinela.analyst_notes as notes
left join centinela.analyst_cases as cases
  on cases.id = notes.case_id
left join centinela.analyst_evidence_links as evidence_links
  on evidence_links.note_id = notes.id
group by
  notes.id,
  notes.case_id,
  cases.case_key,
  cases.title,
  notes.target_type,
  notes.target_id,
  notes.note_type,
  notes.note_text,
  notes.analyst,
  notes.visibility,
  notes.provenance,
  notes.created_at,
  notes.updated_at;

create or replace view centinela.analyst_case_evidence_overview as
select
  evidence_links.id,
  evidence_links.case_id,
  cases.case_key,
  cases.title as case_title,
  evidence_links.note_id,
  notes.note_type,
  notes.note_text,
  evidence_links.source_record_id,
  source_records.source_key,
  source_records.external_id,
  source_records.record_kind,
  source_records.source_url,
  source_records.retrieved_at,
  source_runs.status as source_run_status,
  evidence_links.target_type,
  evidence_links.target_id,
  coalesce(
    entities.canonical_name,
    processes.title,
    candidates.entity_name || ' -> ' || candidates.external_name,
    second_reviews.entity_name || ' -> ' || second_reviews.external_name,
    'accepted match #' || enrichment_matches.id::text,
    evidence_links.target_type || ' #' || evidence_links.target_id
  ) as target_label,
  evidence_links.field_path,
  evidence_links.field_value,
  evidence_links.evidence_summary,
  evidence_links.analyst_interpretation,
  evidence_links.limitations,
  evidence_links.evidence_role,
  evidence_links.created_by,
  evidence_links.created_at,
  evidence_links.metadata
from centinela.analyst_evidence_links as evidence_links
join centinela.analyst_cases as cases
  on cases.id = evidence_links.case_id
left join centinela.analyst_notes as notes
  on notes.id = evidence_links.note_id
left join centinela.source_records as source_records
  on source_records.id = evidence_links.source_record_id
left join centinela.source_runs as source_runs
  on source_runs.id = source_records.source_run_id
left join centinela.entities as entities
  on evidence_links.target_type = 'entity'
 and entities.id = case when evidence_links.target_id ~ '^[0-9]+$' then evidence_links.target_id::bigint end
left join centinela.procurement_processes as processes
  on evidence_links.target_type = 'process'
 and processes.id = case when evidence_links.target_id ~ '^[0-9]+$' then evidence_links.target_id::bigint end
left join centinela.entity_enrichment_candidate_review_overview as candidates
  on evidence_links.target_type = 'external_candidate'
 and candidates.id = case when evidence_links.target_id ~ '^[0-9]+$' then evidence_links.target_id::bigint end
left join centinela.entity_enrichment_second_review_overview as second_reviews
  on evidence_links.target_type = 'second_review'
 and second_reviews.id = case when evidence_links.target_id ~ '^[0-9]+$' then evidence_links.target_id::bigint end
left join centinela.entity_enrichment_matches as enrichment_matches
  on evidence_links.target_type = 'accepted_match'
 and enrichment_matches.id = case when evidence_links.target_id ~ '^[0-9]+$' then evidence_links.target_id::bigint end;

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
  max(evidence_links.created_at) as latest_evidence_at
from centinela.analyst_cases as cases
left join centinela.analyst_case_links as links
  on links.case_id = cases.id
left join centinela.analyst_notes as notes
  on notes.case_id = cases.id
left join centinela.analyst_evidence_links as evidence_links
  on evidence_links.case_id = cases.id
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
  cases.metadata;

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
from centinela.analyst_case_evidence_overview as evidence;
