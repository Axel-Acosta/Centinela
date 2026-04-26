create table if not exists centinela.analyst_cases (
  id bigserial primary key,
  case_key text not null unique,
  title text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  summary text,
  created_by text not null default 'centinela-operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint analyst_cases_status_check
    check (status in ('open', 'monitoring', 'paused', 'closed')),
  constraint analyst_cases_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'))
);

create index if not exists analyst_cases_status_idx
  on centinela.analyst_cases (status, priority, updated_at desc);

create table if not exists centinela.analyst_case_links (
  id bigserial primary key,
  case_id bigint not null references centinela.analyst_cases(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  label text,
  rationale text,
  created_by text not null default 'centinela-operator',
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint analyst_case_links_target_type_check
    check (target_type in (
      'entity',
      'process',
      'external_candidate',
      'accepted_match',
      'source_record',
      'second_review',
      'note',
      'other'
    )),
  unique (case_id, target_type, target_id)
);

create index if not exists analyst_case_links_target_idx
  on centinela.analyst_case_links (target_type, target_id, created_at desc);

create table if not exists centinela.analyst_notes (
  id bigserial primary key,
  case_id bigint references centinela.analyst_cases(id) on delete set null,
  target_type text not null,
  target_id text not null,
  note_type text not null default 'analyst_note',
  note_text text not null,
  analyst text not null default 'centinela-operator',
  visibility text not null default 'internal',
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analyst_notes_target_type_check
    check (target_type in (
      'entity',
      'process',
      'external_candidate',
      'accepted_match',
      'source_record',
      'second_review',
      'other'
    )),
  constraint analyst_notes_visibility_check
    check (visibility in ('internal', 'methodology', 'public_candidate')),
  constraint analyst_notes_note_type_check
    check (note_type in (
      'analyst_note',
      'evidence_note',
      'limitation',
      'follow_up',
      'source_check',
      'methodology_note'
    ))
);

create index if not exists analyst_notes_target_idx
  on centinela.analyst_notes (target_type, target_id, created_at desc);

create index if not exists analyst_notes_case_idx
  on centinela.analyst_notes (case_id, created_at desc);

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
  max(notes.created_at) as latest_note_at
from centinela.analyst_cases as cases
left join centinela.analyst_case_links as links
  on links.case_id = cases.id
left join centinela.analyst_notes as notes
  on notes.case_id = cases.id
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
  notes.updated_at
from centinela.analyst_notes as notes
left join centinela.analyst_cases as cases
  on cases.id = notes.case_id;
