-- E47 (uso e funis), E48 (CRM e leads), E49 (consentimento e campanhas), E51 (LGPD) e E15 (Storage).
set check_function_bodies = off;

-- E47 · Eventos de uso ---------------------------------------------------------------------------------------
create table analytics.events (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid,
  store_id uuid,
  user_id uuid,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  source text not null default 'server' check (source in ('server', 'front')),
  primary key (id, created_at)
) partition by range (created_at);
alter table analytics.events enable row level security;
create index events_account_idx on analytics.events (account_id, name, created_at desc);
select private.ensure_month_partitions('analytics.events', 2);

create or replace function private.track(p_name text, p_account uuid, p_store uuid default null, p_props jsonb default '{}'::jsonb,
  p_source text default 'server')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into analytics.events (account_id, store_id, user_id, name, props, source)
  values (p_account, p_store, (select auth.uid()), p_name, coalesce(private.redact(p_props), '{}'::jsonb), p_source);
$$;

-- Eventos de negócio gravados pelo servidor (não dependem de adblock no front, E47).
create or replace function private.track_from_table()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'sales' and tg_op = 'INSERT' then
    perform private.track('sale_finalized', new.account_id, new.store_id, jsonb_build_object('total', new.total, 'channel', new.channel));
  elsif tg_table_name = 'cash_sessions' and tg_op = 'UPDATE' and new.status = 'closed' and old.status = 'open' then
    perform private.track('cash_closed', (select account_id from app.stores where id = new.store_id), new.store_id);
  elsif tg_table_name = 'accounts' and tg_op = 'INSERT' then
    perform private.track('onboarding_completed', new.id);
  elsif tg_table_name = 'subscription_events' and new.to_status = 'active' and new.from_status is distinct from 'active' then
    perform private.track('subscribed', (select account_id from platform.subscriptions where id = new.subscription_id));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
create trigger sales_track after insert on app.sales for each row execute function private.track_from_table();
create trigger cash_sessions_track after update of status on app.cash_sessions for each row execute function private.track_from_table();
create trigger accounts_track after insert on app.accounts for each row execute function private.track_from_table();
create trigger subscription_events_track after insert on platform.subscription_events for each row execute function private.track_from_table();

-- Eventos de produto vindos do front (nome controlado, com limite por usuário).
create or replace function app.track_event(p_name text, p_store_id uuid default null, p_props jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
begin
  if (select auth.uid()) is null or p_name !~ '^[a-z][a-z0-9_.]{2,60}$' then
    return private.err('EVENT_INVALID');
  end if;
  if (select count(*) from analytics.events where user_id = (select auth.uid()) and source = 'front'
      and created_at > now() - interval '1 minute') >= 60 then
    return private.err('RATE_LIMITED');
  end if;
  if p_store_id is not null and private.reads_store(p_store_id) then
    select account_id into v_account from app.stores where id = p_store_id;
  end if;
  perform private.track(p_name, v_account, case when v_account is null then null else p_store_id end, case when length(coalesce(p_props, '{}'::jsonb)::text) > 2000 then '{"truncated":true}'::jsonb else coalesce(p_props, '{}'::jsonb) end, 'front');
  return private.ok();
end;
$$;

-- Consolidação diária (rotina das 2h): ações de negócio, vendas e pessoas ativas por conta.
create or replace function private.consolidate_daily_usage(p_day date default current_date - 1)
returns int
language sql
security definer
set search_path = ''
as $$
  with x as (
    insert into analytics.daily_usage (account_id, day, business_actions, sales, active_users)
    select e.account_id, p_day,
      count(*) filter (where e.source = 'server'),
      count(*) filter (where e.name = 'sale_finalized'),
      count(distinct e.user_id)
    from analytics.events e
    where e.account_id is not null and e.created_at >= p_day and e.created_at < p_day + 1
      and exists (select 1 from app.accounts a where a.id = e.account_id)
    group by e.account_id
    on conflict (account_id, day) do update set business_actions = excluded.business_actions, sales = excluded.sales,
      active_users = excluded.active_users
    returning 1
  ) select count(*)::int from x;
$$;

create table analytics.funnels (
  code text primary key,
  name text not null,
  steps text[] not null
);
alter table analytics.funnels enable row level security;
insert into analytics.funnels values
  ('onboarding', 'Do cadastro à assinatura', array['onboarding_completed', 'sale_finalized', 'cash_closed', 'subscribed']);

-- Contas que chegaram a cada passo, na ordem, entre as que começaram no período.
create or replace function private.funnel_report(p_code text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_steps text[];
  v_out jsonb := '[]'::jsonb;
  v_count int;
begin
  select steps into v_steps from analytics.funnels where code = p_code;
  if v_steps is null then return private.err('FUNNEL_NOT_FOUND'); end if;
  for i in 1..array_length(v_steps, 1) loop
    select count(*) into v_count from (
      select e0.account_id from analytics.events e0
      where e0.name = v_steps[1] and e0.created_at >= p_from and e0.created_at < p_to + 1
        and (select bool_and(exists (select 1 from analytics.events ek where ek.account_id = e0.account_id and ek.name = v_steps[j]
             and ek.created_at >= e0.created_at)) from generate_series(1, i) j)
      group by e0.account_id) c;
    v_out := v_out || jsonb_build_object('step', v_steps[i], 'accounts', v_count);
  end loop;
  return private.ok(v_out);
end;
$$;

-- E48 · CRM e leads ---------------------------------------------------------------------------------------------
create table platform.lead_stages (
  code text primary key,
  name text not null,
  sort int not null
);
insert into platform.lead_stages values ('novo', 'Novo', 10), ('contato', 'Em contato', 20), ('teste', 'Em teste', 30),
  ('cliente', 'Cliente', 40), ('perdido', 'Perdido', 50);

create table platform.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  store_name text,
  phone text unique,
  email extensions.citext,
  neighborhood text,
  city text,
  source text,
  utm jsonb not null default '{}'::jsonb,
  stage text not null default 'novo' references platform.lead_stages (code),
  owner_staff uuid references auth.users (id),
  next_task text,
  next_task_at timestamptz,
  lost_reason text,
  account_id uuid references app.accounts (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stage <> 'perdido' or lost_reason is not null)
);
create index leads_stage_idx on platform.leads (stage);
create index leads_owner_idx on platform.leads (owner_staff);
create index leads_account_idx on platform.leads (account_id);
create trigger leads_touch before update on platform.leads for each row execute function private.touch_updated_at();

create table platform.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references platform.leads (id),
  kind text not null,
  body text,
  staff_user_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index lead_events_lead_idx on platform.lead_events (lead_id, created_at desc);
create index lead_events_staff_idx on platform.lead_events (staff_user_id);
alter table platform.lead_stages enable row level security;
alter table platform.leads enable row level security;
alter table platform.lead_events enable row level security;

-- Formulário da landing (via /api/leads, com captcha conferido na Edge Function). Dedup por telefone.
create or replace function private.lead_from_landing(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g');
  v_id uuid;
begin
  if v_phone !~ '^[0-9]{10,13}$' then return private.err('PHONE_INVALID'); end if;
  insert into platform.leads (name, store_name, phone, email, neighborhood, city, source, utm)
  values (p ->> 'name', p ->> 'store_name', v_phone, nullif(p ->> 'email', ''), p ->> 'neighborhood', p ->> 'city',
    coalesce(p -> 'utm' ->> 'utm_source', 'site'), coalesce(p -> 'utm', '{}'::jsonb))
  on conflict (phone) do update set name = coalesce(excluded.name, platform.leads.name),
    store_name = coalesce(excluded.store_name, platform.leads.store_name),
    utm = case when platform.leads.utm = '{}'::jsonb then excluded.utm else platform.leads.utm end
  returning id into v_id;
  insert into platform.lead_events (lead_id, kind, body) values (v_id, 'form', 'Formulário do site');
  return private.ok(jsonb_build_object('lead_id', v_id));
end;
$$;

-- Ao concluir o cadastro, liga o lead à conta (telefone) e guarda a origem (último clique com UTM, 30 dias).
create or replace function private.link_lead_on_onboarding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_origin jsonb;
begin
  if new.action <> 'account.onboarding' then return new; end if;
  v_origin := coalesce(new.after -> 'origin', '{}'::jsonb);
  select regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g') into v_phone from app.profiles pr where pr.id = new.actor_user_id;
  update platform.leads set account_id = new.account_id, stage = 'teste'
  where phone = v_phone and account_id is null;
  if not found then
    insert into platform.leads (name, phone, source, utm, stage, account_id)
    values (new.after ->> 'store', nullif(v_phone, ''), coalesce(v_origin ->> 'utm_source', 'direto'), v_origin, 'teste', new.account_id)
    on conflict (phone) do update set account_id = excluded.account_id, stage = 'teste';
  end if;
  return new;
exception when others then
  return new;
end;
$$;
create trigger store_actions_lead after insert on audit.store_actions for each row execute function private.link_lead_on_onboarding();

create or replace function private.admin_lead_update(p_staff uuid, p_role text, p_lead_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p ->> 'stage' = 'perdido' and length(trim(coalesce(p ->> 'lost_reason', ''))) < 3 then
    return private.err('LOST_REASON_REQUIRED');
  end if;
  update platform.leads set stage = coalesce(p ->> 'stage', stage), owner_staff = coalesce(nullif(p ->> 'owner_staff', '')::uuid, owner_staff),
    next_task = coalesce(p ->> 'next_task', next_task), next_task_at = coalesce(nullif(p ->> 'next_task_at', '')::timestamptz, next_task_at),
    lost_reason = coalesce(p ->> 'lost_reason', lost_reason)
  where id = p_lead_id;
  if not found then return private.err('LEAD_NOT_FOUND'); end if;
  insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (p_lead_id, 'update', p::text, p_staff);
  perform private.audit_admin(p_staff, p_role, 'crm.write', null, 'lead', p_lead_id::text, null, p);
  return private.ok();
end;
$$;

-- E49 · Consentimento, campanhas e investimento ---------------------------------------------------------------------
create table platform.consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  purpose text not null default 'promotional',
  channel text not null check (channel in ('whatsapp', 'email')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text not null,
  unique (account_id, purpose, channel)
);
alter table platform.consents enable row level security;

create or replace function private.has_consent(p_account uuid, p_channel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from platform.consents where account_id = p_account and channel = p_channel
                 and purpose = 'promotional' and revoked_at is null);
$$;

-- O dono liga ou desliga mensagens promocionais (aviso de serviço não depende disto, §8).
create or replace function app.set_marketing_consent(p_account_id uuid, p_channel text, p_granted boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from app.accounts where id = p_account_id and owner_user_id = (select auth.uid())) then
    return private.err('FORBIDDEN');
  end if;
  if p_channel not in ('whatsapp', 'email') then return private.err('CHANNEL_INVALID'); end if;
  insert into platform.consents (account_id, channel, source, granted_at, revoked_at)
  values (p_account_id, p_channel, 'app', now(), case when p_granted then null else now() end)
  on conflict (account_id, purpose, channel) do update set
    granted_at = case when p_granted then now() else platform.consents.granted_at end,
    revoked_at = case when p_granted then null else now() end;
  return private.ok();
end;
$$;

create table platform.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  template_code text not null,
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_by uuid not null references auth.users (id),
  sent_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  foreign key (template_code, channel) references platform.message_templates (code, channel)
);
create index campaigns_created_by_idx on platform.campaigns (created_by);
create index campaigns_template_idx on platform.campaigns (template_code, channel);

create table platform.marketing_spend (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  period_start date not null,
  period_end date not null,
  amount app.cents not null,
  note text,
  staff_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index marketing_spend_staff_idx on platform.marketing_spend (staff_user_id);
alter table platform.campaigns enable row level security;
alter table platform.marketing_spend enable row level security;

-- Dispara campanha promocional: só quem consentiu entra na fila; o resto é contado e pulado.
create or replace function private.campaign_send(p_staff uuid, p_role text, p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c platform.campaigns;
  v_queued int := 0;
  v_skipped int := 0;
  v_acc record;
begin
  select * into v_c from platform.campaigns where id = p_campaign_id for update;
  if not found or v_c.status <> 'draft' then return private.err('CAMPAIGN_NOT_DRAFT'); end if;
  if (select kind from platform.message_templates where code = v_c.template_code and channel = v_c.channel) <> 'promotional' then
    return private.err('CAMPAIGN_TEMPLATE_NOT_PROMOTIONAL');
  end if;
  for v_acc in
    select a.id, a.name, u.email, coalesce(pr.phone, (select whatsapp from app.stores where account_id = a.id order by created_at limit 1)) phone
    from app.accounts a join auth.users u on u.id = a.owner_user_id left join app.profiles pr on pr.id = a.owner_user_id
    join platform.subscriptions s on s.account_id = a.id
    where (v_c.audience ->> 'status' is null or s.status::text = v_c.audience ->> 'status')
  loop
    if private.has_consent(v_acc.id, v_c.channel) then
      perform private.enqueue_message(v_c.channel, 'promotional', case v_c.channel when 'email' then v_acc.email else v_acc.phone end,
        v_c.template_code, jsonb_build_object('nome_adega', v_acc.name), 'campaign:' || v_c.id || ':' || v_acc.id, v_acc.id);
      v_queued := v_queued + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  update platform.campaigns set status = 'sent', sent_at = now(),
    result = jsonb_build_object('queued', v_queued, 'skipped_no_consent', v_skipped) where id = p_campaign_id;
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'campaign', p_campaign_id::text, null,
    jsonb_build_object('queued', v_queued, 'skipped_no_consent', v_skipped));
  return private.ok(jsonb_build_object('queued', v_queued, 'skipped_no_consent', v_skipped));
end;
$$;

-- E51 · LGPD ---------------------------------------------------------------------------------------------------------------
create table platform.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  account_id uuid references app.accounts (id),
  document text not null check (document in ('termos', 'privacidade', 'dpa')),
  version text not null,
  accepted_at timestamptz not null default now(),
  ip inet,
  unique (user_id, document, version)
);
create index legal_acceptances_account_idx on platform.legal_acceptances (account_id);
alter table platform.legal_acceptances enable row level security;

create or replace function app.accept_legal(p_documents text[], p_version text, p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return private.err('AUTH_REQUIRED'); end if;
  if p_account_id is not null and not private.is_account_member(p_account_id) then return private.err('FORBIDDEN'); end if;
  insert into platform.legal_acceptances (user_id, account_id, document, version, ip)
  select (select auth.uid()), p_account_id, d, p_version, private.request_ip() from unnest(p_documents) d
  on conflict (user_id, document, version) do nothing;
  return private.ok();
end;
$$;

-- Exportação de tudo que é da conta (pedido do dono; LGPD art. 18).
create or replace function app.export_account_data(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not exists (select 1 from app.accounts where id = p_account_id and owner_user_id = (select auth.uid()))
    then private.err('FORBIDDEN') else private.ok(jsonb_build_object(
      'account', (select to_jsonb(a) from app.accounts a where a.id = p_account_id),
      'stores', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from app.stores s where s.account_id = p_account_id),
      'products', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from app.products p where p.account_id = p_account_id),
      'sales', (select coalesce(jsonb_agg(to_jsonb(s) || jsonb_build_object(
          'items', (select coalesce(jsonb_agg(to_jsonb(si)), '[]'::jsonb) from app.sale_items si where si.sale_id = s.id),
          'payments', (select coalesce(jsonb_agg(to_jsonb(sp)), '[]'::jsonb) from app.sale_payments sp where sp.sale_id = s.id))), '[]'::jsonb)
        from app.sales s where s.account_id = p_account_id),
      'fiado', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from app.fiado_accounts f join app.stores s on s.id = f.store_id
        where s.account_id = p_account_id),
      'bills', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from app.bills b where b.account_id = p_account_id),
      'suppliers', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from app.suppliers x where x.account_id = p_account_id),
      'stock_movements', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from app.stock_movements m where m.account_id = p_account_id),
      'exported_at', now())) end;
$$;

create table platform.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  requested_by uuid not null references auth.users (id),
  confirm_token_hash text not null,
  confirmed_at timestamptz,
  scheduled_for timestamptz,
  executed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now()
);
create index deletion_requests_account_idx on platform.deletion_requests (account_id);
create index deletion_requests_requested_by_idx on platform.deletion_requests (requested_by);
alter table platform.deletion_requests enable row level security;

-- Pedido de exclusão: confirmação por e-mail (token) e 7 dias para desistir.
create or replace function app.request_account_deletion(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not exists (select 1 from app.accounts where id = p_account_id and owner_user_id = (select auth.uid())) then
    return private.err('FORBIDDEN');
  end if;
  insert into platform.deletion_requests (account_id, requested_by, confirm_token_hash)
  values (p_account_id, (select auth.uid()), encode(extensions.digest(v_token, 'sha256'), 'hex'));
  perform private.enqueue_message('email', 'service', (select email from auth.users where id = (select auth.uid())), 'deletion_confirm',
    jsonb_build_object('link', 'https://app.addegas.com.br/excluir-conta?token=' || v_token), 'deletion:' || p_account_id || ':' || v_token,
    p_account_id);
  return private.ok(jsonb_build_object('confirmation_sent', true));
end;
$$;

create or replace function app.confirm_account_deletion(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r platform.deletion_requests;
begin
  select * into v_r from platform.deletion_requests
  where confirm_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and confirmed_at is null and canceled_at is null
    and created_at > now() - interval '2 days';
  if not found or v_r.requested_by is distinct from (select auth.uid()) then return private.err('TOKEN_INVALID'); end if;
  update platform.deletion_requests set confirmed_at = now(), scheduled_for = now() + interval '7 days' where id = v_r.id;
  return private.ok(jsonb_build_object('scheduled_for', now() + interval '7 days'));
end;
$$;

-- Anonimização (exclusão a pedido ou retenção de 6 meses, D25). Fica o que a lei exige (faturas do Addegas,
-- registros de acesso) e a auditoria, sem dados pessoais. As contas do Auth são apagadas pela Edge Function.
create or replace function private.anonymize_account(p_account_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stores uuid[];
begin
  select array_agg(id) into v_stores from app.stores where account_id = p_account_id;
  update app.fiado_accounts set name = 'Anonimizado', name_norm = 'anonimizado', phone = null, note = null, phone_anonymized_at = now()
  where store_id = any (v_stores);
  update app.orders set customer_name = null, customer_phone = null, address = null where store_id = any (v_stores);
  update app.store_members set display_name = 'Removido', active = false where store_id = any (v_stores) and role <> 'owner';
  update app.tabs set nickname = null where store_id = any (v_stores);
  update app.notes set title = 'Anotação removida', body = null where store_id = any (v_stores);
  update app.stores set archived_at = coalesce(archived_at, now()), whatsapp = null, address = null where account_id = p_account_id;
  update app.accounts set name = 'Conta excluída', document = null where id = p_account_id;
  update app.profiles set full_name = null, phone = null
  where id in (select user_id from app.store_members where store_id = any (v_stores) and user_id is not null);
  update platform.leads set name = null, phone = null, email = null where account_id = p_account_id;
  delete from app.alert_recipients where store_id = any (v_stores);

  perform set_config('addegas.audit_maintenance', 'on', true);
  update audit.store_actions set before = null, after = null, ip = null where account_id = p_account_id or store_id = any (v_stores);
  update audit.system_logs set context = '{}'::jsonb where account_id = p_account_id or store_id = any (v_stores);
  perform set_config('addegas.audit_maintenance', 'off', true);

  perform private.subscription_transition(p_account_id, 'canceled', 'suspended', p_reason, 'system');
  return private.ok(jsonb_build_object('stores', coalesce(array_length(v_stores, 1), 0),
    'auth_users', (select coalesce(jsonb_agg(distinct user_id), '[]'::jsonb) from app.store_members
                   where store_id = any (v_stores) and user_id is not null)));
end;
$$;

-- Retenção (D25): contas sem acesso há 6 meses são anonimizadas; exclusões confirmadas após os 7 dias também.
create or replace function private.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc uuid;
  v_n int := 0;
begin
  for v_acc in
    select s.account_id from platform.subscriptions s
    join app.accounts a on a.id = s.account_id and a.name <> 'Conta excluída'
    where s.status in ('expired', 'canceled') and s.access = 'suspended'
      and coalesce((select max(e.created_at) from platform.subscription_events e where e.subscription_id = s.id), s.updated_at) < now() - interval '6 months'
    union
    select account_id from platform.deletion_requests where confirmed_at is not null and canceled_at is null and executed_at is null
      and scheduled_for <= now()
  loop
    perform private.anonymize_account(v_acc, 'Retenção LGPD (D25) ou exclusão confirmada');
    update platform.deletion_requests set executed_at = now() where account_id = v_acc and executed_at is null and confirmed_at is not null;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('anonymized', v_n);
end;
$$;

insert into platform.message_templates values
  ('deletion_confirm', 'email', 'service', 'Confirme a exclusão da sua conta', 'Recebemos o pedido de exclusão da sua conta Addegas. Para confirmar, acesse {link}. Você terá 7 dias para desistir.');

-- E15 · Storage -------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('catalog-images', 'catalog-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('store-public', 'store-public', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('ticket-attachments', 'ticket-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('imports', 'imports', false, 5242880, array['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('exports', 'exports', false, 52428800, array['text/csv', 'application/json'])
on conflict (id) do nothing;

-- Primeiro segmento do caminho = loja (ou conta). O navegador só grava no caminho que a função assinou (§6),
-- e as políticas garantem que, mesmo assim, ninguém escreve fora da própria loja.
create or replace function private.storage_store(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function private.storage_store(text) to authenticated, service_role;
revoke execute on function private.storage_store(text) from public, anon;

create policy addegas_store_public_write on storage.objects for insert to authenticated
  with check (bucket_id = 'store-public' and (select private.can(private.storage_store(name), 'precos')));
create policy addegas_store_public_update on storage.objects for update to authenticated
  using (bucket_id = 'store-public' and (select private.can(private.storage_store(name), 'precos')))
  with check (bucket_id = 'store-public' and (select private.can(private.storage_store(name), 'precos')));
create policy addegas_store_public_select on storage.objects for select to authenticated
  using (bucket_id = 'store-public' and (select private.reads_store(private.storage_store(name))));
create policy addegas_ticket_read on storage.objects for select to authenticated
  using (bucket_id = 'ticket-attachments' and (select private.is_account_member(private.storage_store(name))));
create policy addegas_ticket_write on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-attachments' and (select private.is_account_member(private.storage_store(name))));
create policy addegas_imports_write on storage.objects for insert to authenticated
  with check (bucket_id = 'imports' and (select private.can(private.storage_store(name), 'precos')));
create policy addegas_imports_read on storage.objects for select to authenticated
  using (bucket_id = 'imports' and (select private.can(private.storage_store(name), 'precos')));
-- catalog-images, payment-proofs e exports: só service_role (Edge Functions), sem política para authenticated.

-- Metadados de cada arquivo privado (auditoria e exclusão junto com a conta, §6).
create table platform.files (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  account_id uuid references app.accounts (id),
  store_id uuid references app.stores (id),
  size_bytes bigint,
  mime text,
  original_name text,
  sha256 text,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (bucket, path)
);
create index files_account_idx on platform.files (account_id);
create index files_store_idx on platform.files (store_id);
create index files_uploaded_by_idx on platform.files (uploaded_by);
alter table platform.files enable row level security;

-- Manutenção diária passa a consolidar uso e aplicar a retenção (E46, E47, E51).
create or replace function private.run_daily_extras()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_month_partitions('analytics.events', 2);
  return jsonb_build_object('usage_rows', private.consolidate_daily_usage(), 'retention', private.run_retention());
end;
$$;
select cron.schedule('addegas-uso-e-retencao', '30 5 * * *', $$select private.run_daily_extras()$$);

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('track', 'track_from_table', 'consolidate_daily_usage', 'funnel_report',
      'lead_from_landing', 'link_lead_on_onboarding', 'admin_lead_update', 'has_consent', 'campaign_send', 'anonymize_account',
      'run_retention', 'run_daily_extras')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array['app.track_event(text, uuid, jsonb)', 'app.set_marketing_consent(uuid, text, boolean)',
    'app.accept_legal(text[], text, uuid)', 'app.export_account_data(uuid)', 'app.request_account_deletion(uuid)',
    'app.confirm_account_deletion(text)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
