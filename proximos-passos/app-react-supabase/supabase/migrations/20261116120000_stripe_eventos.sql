-- E34 · Todos os eventos do Stripe que importam para a assinatura: renovação, falha de cartão, 3DS pendente,
-- fatura anulada ou incobrável, estorno e contestação (chargeback). O processamento fica na função cron
-- (rota webhooks), que busca o estado atual de cada objeto no Stripe; aqui ficam só as gravações.

-- Estorno feito direto no painel do Stripe não tem alguém da equipe por trás.
alter table platform.refunds alter column staff_user_id drop not null;
alter table platform.refunds add column source text not null default 'staff' check (source in ('staff', 'stripe'));
alter table platform.refunds add column status text not null default 'succeeded'
  check (status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled'));
alter table platform.refunds add constraint refunds_author check (source = 'stripe' or staff_user_id is not null);

-- Contestação (chargeback): o banco do cliente contesta a cobrança; o Stripe segura o valor até a decisão.
create table platform.disputes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  payment_id uuid references platform.payments (id),
  stripe_dispute_id text not null unique,
  stripe_charge_id text,
  amount app.cents not null,
  reason text,
  status text not null,
  evidence_due_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index disputes_account_idx on platform.disputes (account_id, created_at desc);
create index disputes_payment_idx on platform.disputes (payment_id);
alter table platform.disputes enable row level security;
grant all on platform.disputes to service_role;

-- Pagamento pelo id do Stripe: o invoice.paid grava o payment_intent (ou a cobrança, nas faturas antigas).
create or replace function private.billing_payment_of(p_ids text[])
returns platform.payments
language sql
stable
security definer
set search_path = ''
as $$
  select * from platform.payments where stripe_payment_id = any (p_ids) order by paid_at limit 1;
$$;

-- Estorno vindo do Stripe (idempotente pelo id do estorno). Devolve a conta, ou nulo se o pagamento não é nosso.
create or replace function private.billing_record_refund(p_payment_ids text[], p_refund_id text, p_amount bigint,
  p_reason text, p_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay platform.payments := private.billing_payment_of(p_payment_ids);
begin
  if v_pay.id is null then return null; end if;
  insert into platform.refunds (payment_id, amount, reason, staff_user_id, stripe_refund_id, source, status)
  values (v_pay.id, p_amount, coalesce(nullif(p_reason, ''), 'Estorno feito no Stripe'), null, p_refund_id, 'stripe', p_status)
  on conflict (stripe_refund_id) do update set status = excluded.status, amount = excluded.amount;
  return v_pay.account_id;
end;
$$;

-- Contestação vinda do Stripe (idempotente pelo id). A conta vem do pagamento ou do cliente do Stripe.
create or replace function private.billing_record_dispute(p_payment_ids text[], p_customer_id text, p_dispute_id text,
  p_charge_id text, p_amount bigint, p_reason text, p_status text, p_evidence_due_by timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay platform.payments := private.billing_payment_of(p_payment_ids);
  v_acc uuid := coalesce(v_pay.account_id, (select account_id from platform.subscriptions where stripe_customer_id = p_customer_id));
begin
  if v_acc is null then return null; end if;
  insert into platform.disputes (account_id, payment_id, stripe_dispute_id, stripe_charge_id, amount, reason, status, evidence_due_by, closed_at)
  values (v_acc, v_pay.id, p_dispute_id, p_charge_id, p_amount, p_reason, p_status, p_evidence_due_by,
    case when p_status in ('won', 'lost', 'warning_closed') then now() end)
  on conflict (stripe_dispute_id) do update set status = excluded.status, amount = excluded.amount, reason = excluded.reason,
    evidence_due_by = excluded.evidence_due_by, updated_at = now(),
    closed_at = coalesce(platform.disputes.closed_at, excluded.closed_at);
  return v_acc;
end;
$$;

-- Fatura anulada ou incobrável no Stripe: só espelha a situação (o acesso segue a régua de cobrança).
create or replace function private.billing_invoice_status(p_invoice_id text, p_status text)
returns void
language sql
security definer
set search_path = ''
as $$
  update platform.invoices set status = p_status where stripe_invoice_id = p_invoice_id and status <> 'paid';
$$;

-- Contestações para o painel da equipe (Financeiro).
create or replace function private.admin_disputes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'account_id', d.account_id, 'amount', d.amount, 'reason', d.reason,
    'status', d.status, 'evidence_due_by', d.evidence_due_by, 'created_at', d.created_at, 'closed_at', d.closed_at,
    'stripe_dispute_id', d.stripe_dispute_id) order by d.created_at desc), '[]'::jsonb)
  from platform.disputes d;
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('billing_payment_of', 'billing_record_refund', 'billing_record_dispute',
      'billing_invoice_status', 'admin_disputes')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
