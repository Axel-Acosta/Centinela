create index if not exists procurement_processes_source_key_idx
  on centinela.procurement_processes (source_key);

create index if not exists procurement_processes_ocid_idx
  on centinela.procurement_processes (ocid);

create index if not exists procurement_processes_tender_id_idx
  on centinela.procurement_processes (tender_id);

create index if not exists entities_type_normalized_name_idx
  on centinela.entities (entity_type, normalized_name);

create index if not exists process_parties_process_role_idx
  on centinela.process_parties (process_id, role);

create index if not exists process_parties_party_name_idx
  on centinela.process_parties (party_name);

create index if not exists contracts_process_id_idx
  on centinela.contracts (process_id);

create index if not exists contract_transactions_contract_id_idx
  on centinela.contract_transactions (contract_id);

create index if not exists contract_transactions_payee_name_idx
  on centinela.contract_transactions (payee_name);

create index if not exists risk_signals_process_id_idx
  on centinela.risk_signals (process_id);

create index if not exists risk_signals_code_idx
  on centinela.risk_signals (signal_code, severity);

create or replace view centinela.process_risk_overview as
with contract_summary as (
  select
    process_id,
    count(*) as contract_count,
    sum(amount) as total_contract_value
  from centinela.contracts
  group by process_id
),
payment_summary as (
  select
    contracts.process_id,
    sum(transactions.amount) as total_paid_amount
  from centinela.contracts
  join centinela.contract_transactions as transactions
    on transactions.contract_id = contracts.id
  group by contracts.process_id
),
supplier_summary as (
  select
    process_id,
    array_agg(distinct party_name order by party_name) filter (where role = 'supplier') as suppliers
  from centinela.process_parties
  group by process_id
),
risk_summary as (
  select
    process_id,
    count(*) as risk_signal_count,
    array_agg(signal_code order by score desc, signal_code) as signal_codes,
    max(
      case severity
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 0
      end
    ) as max_severity_rank
  from centinela.risk_signals
  group by process_id
)
select
  processes.id as process_id,
  processes.source_key,
  processes.country_code,
  processes.ocid,
  processes.tender_id,
  processes.title,
  processes.process_stage,
  processes.buyer_name,
  processes.buyer_external_id,
  processes.procurement_method,
  processes.procurement_method_details,
  processes.status_details,
  processes.published_at,
  processes.source_url,
  coalesce(supplier_summary.suppliers, '{}'::text[]) as suppliers,
  coalesce(contract_summary.contract_count, 0) as contract_count,
  contract_summary.total_contract_value,
  payment_summary.total_paid_amount,
  coalesce(risk_summary.risk_signal_count, 0) as risk_signal_count,
  coalesce(risk_summary.signal_codes, '{}'::text[]) as signal_codes,
  coalesce(risk_summary.max_severity_rank, 0) as max_severity_rank,
  case coalesce(risk_summary.max_severity_rank, 0)
    when 3 then 'high'
    when 2 then 'medium'
    when 1 then 'low'
    else 'none'
  end as max_severity
from centinela.procurement_processes as processes
left join contract_summary
  on contract_summary.process_id = processes.id
left join payment_summary
  on payment_summary.process_id = processes.id
left join supplier_summary
  on supplier_summary.process_id = processes.id
left join risk_summary
  on risk_summary.process_id = processes.id;

create or replace view centinela.buyer_supplier_pair_summary as
with process_totals as (
  select
    overview.process_id,
    overview.source_key,
    overview.buyer_name,
    overview.risk_signal_count,
    coalesce(overview.total_contract_value, 0) as total_contract_value,
    coalesce(overview.total_paid_amount, 0) as total_paid_amount
  from centinela.process_risk_overview as overview
),
supplier_parties as (
  select distinct
    process_id,
    party_name as supplier_name
  from centinela.process_parties
  where role = 'supplier'
)
select
  process_totals.source_key,
  process_totals.buyer_name,
  supplier_parties.supplier_name,
  count(*) as process_count,
  sum(process_totals.risk_signal_count) as total_risk_signals,
  sum(process_totals.total_contract_value) as total_contract_value,
  sum(process_totals.total_paid_amount) as total_paid_amount
from process_totals
join supplier_parties
  on supplier_parties.process_id = process_totals.process_id
group by
  process_totals.source_key,
  process_totals.buyer_name,
  supplier_parties.supplier_name;
