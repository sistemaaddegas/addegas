-- E34 · Funções de banco usadas pelas Edge Functions billing, hooks-stripe e cron (Stripe, D01).

-- Dados para montar o checkout: preço do ciclo, lojas adicionais e cliente no Stripe.
create or replace function private.billing_checkout_context(p_account_id uuid, p_cycle platform.billing_cycle)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'account_id', a.id, 'account_name', a.name, 'owner_email', u.email,
    'stripe_customer_id', s.stripe_customer_id, 'stripe_subscription_id', s.stripe_subscription_id,
    'status', s.status, 'extra_stores', s.extra_stores,
    'plan_price_id', (select pp.stripe_price_id from platform.plan_prices pp where pp.plan_id = s.plan_id and pp.cycle = p_cycle),
    'plan_price', (select pp.price from platform.plan_prices pp where pp.plan_id = s.plan_id and pp.cycle = p_cycle),
    'extra_store_price_id', (select ap.stripe_price_id from platform.addon_prices ap join platform.addons ad on ad.id = ap.addon_id
                             where ad.code = 'extra_store' and ap.cycle = p_cycle))
  from app.accounts a join auth.users u on u.id = a.owner_user_id join platform.subscriptions s on s.account_id = a.id
  where a.id = p_account_id;
$$;

create or replace function private.billing_link_customer(p_account_id uuid, p_customer_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update platform.subscriptions set stripe_customer_id = p_customer_id where account_id = p_account_id and stripe_customer_id is null;
$$;

-- Fatura do Stripe espelhada (idempotente pelo id do Stripe). Devolve a conta.
create or replace function private.billing_record_invoice(p_customer_id text, p_invoice_id text, p_amount bigint, p_status text,
  p_period_start timestamptz, p_period_end timestamptz, p_hosted_url text, p_payment_id text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc uuid;
  v_inv uuid;
begin
  select account_id into v_acc from platform.subscriptions where stripe_customer_id = p_customer_id;
  if v_acc is null then
    raise exception using errcode = 'P0001', message = 'BILLING_CUSTOMER_UNKNOWN', detail = p_customer_id;
  end if;
  insert into platform.invoices (account_id, stripe_invoice_id, amount, status, period_start, period_end, hosted_url,
    paid_at, due_at)
  values (v_acc, p_invoice_id, p_amount, p_status, p_period_start, p_period_end, p_hosted_url,
    case when p_status = 'paid' then now() end, p_period_start)
  on conflict (stripe_invoice_id) do update set status = excluded.status, amount = excluded.amount,
    paid_at = coalesce(platform.invoices.paid_at, excluded.paid_at), hosted_url = excluded.hosted_url
  returning id into v_inv;
  if p_status = 'paid' and p_payment_id is not null then
    insert into platform.payments (invoice_id, account_id, amount, source, method, stripe_payment_id)
    values (v_inv, v_acc, p_amount, 'stripe', 'card', p_payment_id)
    on conflict (stripe_payment_id) do nothing;
  end if;
  return v_acc;
end;
$$;

-- Estado da assinatura do Stripe: id, renovação, fim do período e quantidade de lojas adicionais.
create or replace function private.billing_sync_subscription(p_customer_id text, p_subscription_id text, p_status text,
  p_cancel_at_period_end boolean, p_period_start timestamptz, p_period_end timestamptz, p_cycle text, p_extra_stores int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc uuid;
begin
  update platform.subscriptions set stripe_subscription_id = p_subscription_id, cancel_at_period_end = p_cancel_at_period_end,
    current_period_start = p_period_start, current_period_end = p_period_end,
    cycle = coalesce(p_cycle::platform.billing_cycle, cycle),
    price = coalesce((select pp.price from platform.plan_prices pp where pp.plan_id = subscriptions.plan_id and pp.cycle::text = p_cycle), price),
    extra_stores = coalesce(p_extra_stores, extra_stores),
    extra_store_price = coalesce((select ap.price from platform.addon_prices ap join platform.addons ad on ad.id = ap.addon_id
                                  where ad.code = 'extra_store' and ap.cycle::text = p_cycle), extra_store_price)
  where stripe_customer_id = p_customer_id
  returning account_id into v_acc;
  if v_acc is null then
    raise exception using errcode = 'P0001', message = 'BILLING_CUSTOMER_UNKNOWN', detail = p_customer_id;
  end if;
  -- Assinatura apagada no Stripe = cancelada (o acesso é decidido pela rotina e pelo período pago).
  if p_status = 'canceled' then
    perform private.subscription_transition(v_acc, 'canceled', 'suspended', 'Assinatura encerrada no Stripe', 'webhook:stripe');
  end if;
  return v_acc;
end;
$$;

-- Contas em carência vencida, com os ids do Stripe, para a reconferência da rotina das 9h (§8).
create or replace function private.billing_overdue_candidates()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('account_id', account_id, 'stripe_customer_id', stripe_customer_id,
    'stripe_subscription_id', stripe_subscription_id)), '[]'::jsonb)
  from platform.subscriptions where access = 'grace' and grace_ends_at <= now();
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('billing_checkout_context', 'billing_link_customer', 'billing_record_invoice',
      'billing_sync_subscription', 'billing_overdue_candidates')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- E11 · Cadastro de pessoa da equipe Addegas (convite feito pela admin-api, só administrador mestre).
create or replace function private.admin_staff_upsert(p_staff uuid, p_role text, p_user_id uuid, p_name text, p_email text, p_staff_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from platform.staff_roles where code = p_staff_role) then
    return private.err('STAFF_ROLE_INVALID');
  end if;
  insert into platform.staff (user_id, name, email, role_code, created_by)
  values (p_user_id, trim(p_name), lower(p_email), p_staff_role, p_staff)
  on conflict (user_id) do update set name = excluded.name, role_code = excluded.role_code, active = true;
  perform private.audit_admin(p_staff, p_role, 'staff.manage', null, 'staff', p_user_id::text, null,
    jsonb_build_object('email', p_email, 'role', p_staff_role));
  return private.ok(jsonb_build_object('user_id', p_user_id));
end;
$$;

-- E15 · Metadados de cada arquivo enviado (dono, tamanho, tipo real, hash), para auditoria e exclusão com a conta.
create or replace function private.register_file(p_bucket text, p_path text, p_size bigint, p_mime text, p_sha256 text,
  p_original_name text, p_uploaded_by uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first uuid := private.storage_store(p_path);
  v_store uuid;
  v_account uuid;
  v_id uuid;
begin
  if p_bucket = 'ticket-attachments' then
    v_account := v_first;
  else
    v_store := v_first;
    select account_id into v_account from app.stores where id = v_store;
  end if;
  insert into platform.files (bucket, path, account_id, store_id, size_bytes, mime, original_name, sha256, uploaded_by)
  values (p_bucket, p_path, v_account, v_store, p_size, p_mime, p_original_name, p_sha256, p_uploaded_by)
  on conflict (bucket, path) do update set size_bytes = excluded.size_bytes, mime = excluded.mime, sha256 = excluded.sha256
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function private.admin_staff_upsert(uuid, text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function private.register_file(text, text, bigint, text, text, text, uuid) from public, anon, authenticated;
grant execute on function private.admin_staff_upsert(uuid, text, uuid, text, text, text) to service_role;
grant execute on function private.register_file(text, text, bigint, text, text, text, uuid) to service_role;
