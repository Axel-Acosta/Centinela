create table if not exists centinela.contract_transactions (
  id bigserial primary key,
  contract_id bigint not null references centinela.contracts(id) on delete cascade,
  transaction_external_id text not null,
  transaction_date timestamptz,
  request_date timestamptz,
  amount numeric,
  currency text,
  source_system text,
  financial_code text,
  payer_name text,
  payer_external_id text,
  payee_name text,
  payee_external_id text,
  payload jsonb not null default '{}'::jsonb,
  unique (contract_id, transaction_external_id)
);
