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
where notes.case_id is not null;
