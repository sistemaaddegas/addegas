-- E33 (ciclo da assinatura), E11/E14 (equipe Addegas e filtro da admin-api), E36/E37 (ações do admin e
-- financeiro), E38 (tickets), E39 (repositório de produtos), E40 (métricas), E42 (caixa de webhooks),
-- E46 (manutenção e agendamentos). Tudo aqui é chamado pelas Edge Functions com service_role.

-- Funções desta migration citam tabelas criadas mais abaixo (faturas, tickets); a validação do corpo
-- fica para a execução.
set check_function_bodies = off;

-- E47 · uso diário por conta (consolidado pela rotina das 2h; lido pela ficha da adega e pela visão geral)
create table analytics.daily_usage (
  account_id uuid not null references app.accounts (id),
  day date not null,
  business_actions int not null default 0,
  sales int not null default 0,
  active_users int not null default 0,
  primary key (account_id, day)
);
alter table analytics.daily_usage enable row level security;

-- E33 · Ciclo da assinatura ---------------------------------------------------------------------
create table platform.job_runs (
  job text not null,
  run_date date not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  result jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (job, run_date)
);
alter table platform.job_runs enable row level security;

create or replace function private.subscription_transition(p_account_id uuid, p_status platform.subscription_status,
  p_access platform.access_state, p_reason text, p_author text, p_extra jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.subscriptions;
begin
  select * into v_s from platform.subscriptions where account_id = p_account_id for update;
  if not found then
    return false;
  end if;
  update platform.subscriptions set
    status = p_status, access = p_access,
    grace_ends_at = case when p_access = 'grace' then coalesce(nullif(p_extra ->> 'grace_ends_at', '')::timestamptz, now() + interval '5 days')
                         when p_access = 'allowed' then null else grace_ends_at end,
    current_period_start = coalesce(nullif(p_extra ->> 'period_start', '')::timestamptz, current_period_start),
    current_period_end = coalesce(nullif(p_extra ->> 'period_end', '')::timestamptz, current_period_end),
    cancel_at_period_end = case when p_status in ('canceled', 'expired') then false else cancel_at_period_end end
  where id = v_s.id;
  if v_s.status is distinct from p_status or v_s.access is distinct from p_access then
    insert into platform.subscription_events (subscription_id, from_status, to_status, from_access, to_access, reason, author, correlation_id)
    values (v_s.id, v_s.status, p_status, v_s.access, p_access, p_reason, p_author, private.correlation_id());
  end if;
  return true;
end;
$$;

-- Pagamento confirmado (webhook do gateway ou pagamento manual): ativa e libera (E33/E34/E37).
create or replace function private.billing_paid(p_account_id uuid, p_period_start timestamptz, p_period_end timestamptz, p_author text)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.subscription_transition(p_account_id, 'active', 'allowed', 'Pagamento confirmado', p_author,
    jsonb_build_object('period_start', p_period_start, 'period_end', p_period_end));
$$;

-- Falha de cobrança: carência de 5 dias corridos a partir da PRIMEIRA falha (D28).
create or replace function private.billing_failed(p_account_id uuid, p_author text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.subscriptions;
begin
  select * into v_s from platform.subscriptions where account_id = p_account_id;
  if v_s.access = 'grace' or v_s.access = 'suspended' then
    return; -- repetir a falha não reinicia a carência
  end if;
  perform private.subscription_transition(p_account_id, 'past_due', 'grace', 'Falha na cobrança', p_author,
    jsonb_build_object('grace_ends_at', now() + interval '5 days'));
end;
$$;

-- Rotina diária das 9h (America/Sao_Paulo). Idempotente: um registro por dia em job_runs; cada
-- transição só acontece se o estado de origem ainda vale. A suspensão por carência vencida recebe a
-- lista de contas que a Edge Function cron-billing JÁ reconferiu no gateway (§8).
create or replace function private.run_billing_cycle(p_confirmed_unpaid uuid[] default '{}', p_run_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date := coalesce(p_run_date, (now() at time zone 'America/Sao_Paulo')::date);
  v_expired int := 0;
  v_suspended int := 0;
  v_canceled int := 0;
  v_acc uuid;
begin
  insert into platform.job_runs (job, run_date) values ('billing_cycle', v_date) on conflict do nothing;
  if not found then
    return (select result from platform.job_runs where job = 'billing_cycle' and run_date = v_date) || '{"replayed":true}';
  end if;

  for v_acc in select account_id from platform.subscriptions where status = 'trial' and trial_ends_at <= now() loop
    perform private.subscription_transition(v_acc, 'expired', 'suspended', 'Fim do teste sem assinatura', 'system');
    v_expired := v_expired + 1;
  end loop;

  for v_acc in select account_id from platform.subscriptions
               where access = 'grace' and grace_ends_at <= now() and account_id = any (p_confirmed_unpaid) loop
    perform private.subscription_transition(v_acc, 'past_due', 'suspended', 'Carência vencida, pagamento reconferido', 'system');
    v_suspended := v_suspended + 1;
  end loop;

  for v_acc in select account_id from platform.subscriptions
               where cancel_at_period_end and current_period_end <= now() and status in ('active', 'past_due') loop
    perform private.subscription_transition(v_acc, 'canceled', 'suspended', 'Cancelamento no fim do ciclo', 'system');
    v_canceled := v_canceled + 1;
  end loop;

  update platform.job_runs set status = 'done', finished_at = now(),
    result = jsonb_build_object('trials_expired', v_expired, 'suspended', v_suspended, 'canceled', v_canceled)
  where job = 'billing_cycle' and run_date = v_date;
  return jsonb_build_object('trials_expired', v_expired, 'suspended', v_suspended, 'canceled', v_canceled);
end;
$$;

-- Dono pede cancelamento: renovação desligada, acesso até o fim do ciclo pago (§8).
create or replace function app.request_cancellation(p_account_id uuid, p_undo boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.subscriptions;
begin
  if not exists (select 1 from app.accounts where id = p_account_id and owner_user_id = (select auth.uid())) then
    return private.err('FORBIDDEN');
  end if;
  select * into v_s from platform.subscriptions where account_id = p_account_id for update;
  if v_s.status not in ('active', 'past_due') then
    return private.err('SUBSCRIPTION_NOT_ACTIVE');
  end if;
  update platform.subscriptions set cancel_at_period_end = not p_undo where id = v_s.id;
  insert into platform.subscription_events (subscription_id, from_status, to_status, from_access, to_access, reason, author, correlation_id)
  values (v_s.id, v_s.status, v_s.status, v_s.access, v_s.access,
    case when p_undo then 'Cancelamento desfeito' else 'Cancelamento pedido para o fim do ciclo' end, 'owner', private.correlation_id());
  return private.ok(jsonb_build_object('access_until', v_s.current_period_end, 'cancel_at_period_end', not p_undo));
end;
$$;

-- E42 · Caixa de entrada de webhooks ---------------------------------------------------------------
create table platform.webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed', 'dead', 'rejected')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index webhook_inbox_queue_idx on platform.webhook_inbox (next_attempt_at) where status in ('pending', 'failed');
create table platform.webhook_duplicates (
  provider text not null,
  hour timestamptz not null,
  count int not null default 0,
  primary key (provider, hour)
);
alter table platform.webhook_inbox enable row level security;
alter table platform.webhook_duplicates enable row level security;

-- Recebe: grava bruto; duplicado conta e não reprocessa. Devolve {id, duplicate}.
create or replace function private.inbox_receive(p_provider text, p_event_id text, p_type text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into platform.webhook_inbox (provider, event_id, event_type, payload)
  values (p_provider, p_event_id, p_type, p_payload)
  on conflict (provider, event_id) do nothing
  returning id into v_id;
  if v_id is null then
    insert into platform.webhook_duplicates (provider, hour, count) values (p_provider, date_trunc('hour', now()), 1)
    on conflict (provider, hour) do update set count = platform.webhook_duplicates.count + 1;
    return jsonb_build_object('id', (select id from platform.webhook_inbox where provider = p_provider and event_id = p_event_id), 'duplicate', true);
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;

-- Pega até N eventos prontos; dois processadores nunca pegam o mesmo (skip locked, §9).
create or replace function private.inbox_claim(p_provider text, p_limit int default 20)
returns setof platform.webhook_inbox
language sql
security definer
set search_path = ''
as $$
  update platform.webhook_inbox w set status = 'processing', attempts = w.attempts + 1
  where w.id in (
    select id from platform.webhook_inbox
    where provider = p_provider and status in ('pending', 'failed') and next_attempt_at <= now()
    order by received_at limit p_limit
    for update skip locked
  )
  returning w.*;
$$;

create or replace function private.inbox_done(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update platform.webhook_inbox set status = 'processed', processed_at = now(), last_error = null where id = p_id;
$$;

-- Falha: nova tentativa com espera exponencial; depois de 8, "dead" (alerta na E46).
create or replace function private.inbox_fail(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update platform.webhook_inbox set
    status = case when attempts >= 8 then 'dead' else 'failed' end,
    last_error = left(p_error, 2000),
    next_attempt_at = now() + make_interval(mins => power(2, least(attempts, 8))::int)
  where id = p_id;
$$;

-- E11 · Equipe Addegas -------------------------------------------------------------------------------
create table platform.staff_roles (
  code text primary key,
  name text not null
);
create table platform.staff_actions (
  code text primary key,
  description text not null
);
create table platform.role_actions (
  role_code text not null references platform.staff_roles (code),
  action_code text not null references platform.staff_actions (code),
  primary key (role_code, action_code)
);
create index role_actions_action_idx on platform.role_actions (action_code);
create table platform.staff (
  user_id uuid primary key references auth.users (id),
  name text not null,
  email extensions.citext not null unique check (email::text ~* '@addegas\.com\.br$'),
  role_code text not null references platform.staff_roles (code),
  active boolean not null default true,
  last_activity_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index staff_role_idx on platform.staff (role_code);
create index staff_created_by_idx on platform.staff (created_by);
alter table platform.staff_roles enable row level security;
alter table platform.staff_actions enable row level security;
alter table platform.role_actions enable row level security;
alter table platform.staff enable row level security;

insert into platform.staff_roles values
  ('master', 'Administrador mestre'), ('finance', 'Financeiro'), ('support', 'Suporte'),
  ('commercial', 'Comercial e marketing'), ('analyst', 'Analista');

insert into platform.staff_actions values
  ('overview.read', 'Ver visão geral'), ('accounts.read', 'Ver adegas e ficha'), ('accounts.note', 'Anotação interna'),
  ('accounts.extend_trial', 'Estender teste'), ('accounts.access', 'Suspender ou reativar acesso'),
  ('accounts.temp_access', 'Acesso temporário'), ('accounts.plan', 'Trocar ciclo e lojas adicionais'),
  ('accounts.diagnostics', 'Ver dados de diagnóstico da adega'),
  ('billing.read', 'Ver financeiro'), ('billing.manual_payment', 'Registrar pagamento manual'),
  ('billing.refund', 'Reembolsar'), ('billing.discount', 'Conceder desconto'), ('export', 'Exportar planilhas'),
  ('tickets.read', 'Ver tickets'), ('tickets.reply', 'Responder tickets'), ('catalog.write', 'Editar repositório de produtos'),
  ('crm.write', 'CRM e leads'), ('marketing.write', 'Investimento e campanhas'), ('gifts.write', 'Brindes'),
  ('messages.send', 'Enviar mensagens'), ('usage.read', 'Uso e funis'), ('monitoring.read', 'Monitoramento e logs'),
  ('webhooks.reprocess', 'Reprocessar webhooks'), ('staff.manage', 'Gerenciar equipe Addegas'),
  ('platform.config', 'Configurações da plataforma');

-- Perfis da §4.
insert into platform.role_actions (role_code, action_code)
select 'master', code from platform.staff_actions
union all select 'finance', a from unnest(array['overview.read','accounts.read','accounts.access','accounts.plan','billing.read',
  'billing.manual_payment','billing.refund','billing.discount','export','messages.send']) a
union all select 'support', a from unnest(array['overview.read','accounts.read','accounts.note','accounts.temp_access',
  'accounts.diagnostics','tickets.read','tickets.reply','catalog.write','messages.send','monitoring.read','webhooks.reprocess']) a
union all select 'commercial', a from unnest(array['overview.read','accounts.read','accounts.note','accounts.extend_trial',
  'crm.write','marketing.write','gifts.write','messages.send','billing.discount']) a
union all select 'analyst', a from unnest(array['overview.read','accounts.read','billing.read','usage.read','export']) a;

-- Filtro único da admin-api (E14): 2FA, pessoa ativa, 30 min de inatividade (D46), ação permitida.
-- Negação vai para a auditoria. Recebe o usuário e o nível do JWT já verificado pela Edge Function.
create or replace function private.staff_check(p_user uuid, p_aal text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff platform.staff;
begin
  select * into v_staff from platform.staff where user_id = p_user;
  if not found or not v_staff.active then
    perform private.audit_admin(p_user, null, p_action, p_outcome => 'denied', p_reason => 'STAFF_INACTIVE');
    return private.err('STAFF_INACTIVE');
  end if;
  if p_aal is distinct from 'aal2' then
    return private.err('MFA_REQUIRED');
  end if;
  if v_staff.last_activity_at is not null and v_staff.last_activity_at < now() - interval '30 minutes' then
    update platform.staff set last_activity_at = null where user_id = p_user;
    return private.err('SESSION_IDLE');
  end if;
  if not exists (select 1 from platform.role_actions where role_code = v_staff.role_code and action_code = p_action) then
    perform private.audit_admin(p_user, v_staff.role_code, p_action, p_outcome => 'denied', p_reason => 'FORBIDDEN_ACTION');
    return private.err('FORBIDDEN_ACTION');
  end if;
  update platform.staff set last_activity_at = now() where user_id = p_user;
  return private.ok(jsonb_build_object('user_id', v_staff.user_id, 'name', v_staff.name, 'role', v_staff.role_code,
    'actions', (select jsonb_agg(action_code order by action_code) from platform.role_actions where role_code = v_staff.role_code)));
end;
$$;

-- Ação administrativa padrão: valida motivo, executa, audita (mesma transação).
create or replace function private.admin_require_reason(p_reason text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select length(trim(coalesce(p_reason, ''))) >= 5;
$$;

-- E36 · Adegas ----------------------------------------------------------------------------------------
create table platform.account_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  staff_user_id uuid not null references auth.users (id),
  body text not null,
  created_at timestamptz not null default now()
);
create index account_notes_account_idx on platform.account_notes (account_id, created_at desc);
create index account_notes_staff_idx on platform.account_notes (staff_user_id);
alter table platform.account_notes enable row level security;

create or replace function private.admin_accounts(p_staff uuid, p_filter jsonb default '{}', p_cursor timestamptz default null, p_limit int default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('items', coalesce(jsonb_agg(x order by (x ->> 'created_at') desc), '[]'::jsonb),
    'next_cursor', min(x ->> 'created_at'))
  from (
    select jsonb_build_object('account_id', a.id, 'name', a.name, 'created_at', a.created_at,
      'status', s.status, 'access', private.account_access(a.id), 'cycle', s.cycle, 'trial_ends_at', s.trial_ends_at,
      'stores', (select count(*) from app.stores st where st.account_id = a.id and st.archived_at is null),
      'city', (select st.city from app.stores st where st.account_id = a.id order by st.created_at limit 1),
      'last_sale_at', (select max(sa.created_at) from app.sales sa where sa.account_id = a.id)) x
    from app.accounts a join platform.subscriptions s on s.account_id = a.id
    where (p_cursor is null or a.created_at < p_cursor)
      and (p_filter ->> 'status' is null or s.status::text = p_filter ->> 'status')
      and (p_filter ->> 'access' is null or s.access::text = p_filter ->> 'access')
      and (p_filter ->> 'q' is null or a.name ilike '%' || (p_filter ->> 'q') || '%')
    order by a.created_at desc
    limit least(greatest(p_limit, 1), 200)
  ) y;
$$;

create or replace function private.admin_account_detail(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'account', to_jsonb(a) - 'document',
    'subscription', (select to_jsonb(s) - 'stripe_customer_id' - 'stripe_subscription_id' from platform.subscriptions s where s.account_id = a.id),
    'stores', (select coalesce(jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name, 'slug', st.slug, 'city', st.city,
      'archived_at', st.archived_at)), '[]'::jsonb) from app.stores st where st.account_id = a.id),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb) from platform.subscription_events e
      join platform.subscriptions s on s.id = e.subscription_id where s.account_id = a.id),
    'invoices', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc), '[]'::jsonb) from platform.invoices i where i.account_id = a.id),
    'notes', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb) from platform.account_notes n where n.account_id = a.id),
    'tickets', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'subject', t.subject, 'status', t.status, 'priority', t.priority))
      , '[]'::jsonb) from support.tickets t where t.account_id = a.id),
    'usage_30d', (select coalesce(jsonb_agg(to_jsonb(u) order by u.day), '[]'::jsonb) from analytics.daily_usage u
      where u.account_id = a.id and u.day > current_date - 30),
    'history', (select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at desc), '[]'::jsonb) from (
      select created_at, staff_role, action, reason, before, after from audit.admin_actions where account_id = a.id
      order by created_at desc limit 100) h)
  )
  from app.accounts a where a.id = p_account_id;
$$;

-- Estender teste (3, 7 ou 14 dias), só para conta ainda em teste ou expirada sem assinar.
create or replace function private.admin_extend_trial(p_staff uuid, p_role text, p_account_id uuid, p_days int, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.subscriptions;
  v_new timestamptz;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if p_days not in (3, 7, 14) then return private.err('TRIAL_DAYS_INVALID'); end if;
  select * into v_s from platform.subscriptions where account_id = p_account_id for update;
  if not found then return private.err('ACCOUNT_NOT_FOUND'); end if;
  if v_s.status not in ('trial', 'expired') then return private.err('TRIAL_NOT_APPLICABLE'); end if;
  v_new := greatest(coalesce(v_s.trial_ends_at, now()), now()) + make_interval(days => p_days);
  update platform.subscriptions set trial_ends_at = v_new where id = v_s.id;
  perform private.subscription_transition(p_account_id, 'trial', 'allowed', 'Teste estendido: ' || p_reason, 'staff:' || p_staff);
  perform private.audit_admin(p_staff, p_role, 'accounts.extend_trial', p_account_id, 'subscription', v_s.id::text,
    jsonb_build_object('trial_ends_at', v_s.trial_ends_at), jsonb_build_object('trial_ends_at', v_new), p_reason);
  return private.ok(jsonb_build_object('trial_ends_at', v_new));
end;
$$;

create or replace function private.admin_set_access(p_staff uuid, p_role text, p_account_id uuid, p_access platform.access_state, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.subscriptions;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if p_access not in ('allowed', 'suspended') then return private.err('ACCESS_INVALID'); end if;
  select * into v_s from platform.subscriptions where account_id = p_account_id;
  if not found then return private.err('ACCOUNT_NOT_FOUND'); end if;
  perform private.subscription_transition(p_account_id, v_s.status, p_access, p_reason, 'staff:' || p_staff);
  perform private.audit_admin(p_staff, p_role, 'accounts.access', p_account_id, 'subscription', v_s.id::text,
    jsonb_build_object('access', v_s.access), jsonb_build_object('access', p_access), p_reason);
  return private.ok();
end;
$$;

-- Acesso temporário (D27): libera conta suspensa por N dias; não quita nem reinicia carência.
create or replace function private.admin_temp_access(p_staff uuid, p_role text, p_account_id uuid, p_days int, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.subscriptions;
  v_until timestamptz := now() + make_interval(days => p_days);
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if p_days not between 1 and 7 then return private.err('TEMP_ACCESS_DAYS_INVALID'); end if;
  select * into v_s from platform.subscriptions where account_id = p_account_id for update;
  if not found then return private.err('ACCOUNT_NOT_FOUND'); end if;
  update platform.subscriptions set temp_access_until = v_until where id = v_s.id;
  perform private.audit_admin(p_staff, p_role, 'accounts.temp_access', p_account_id, 'subscription', v_s.id::text,
    jsonb_build_object('temp_access_until', v_s.temp_access_until), jsonb_build_object('temp_access_until', v_until), p_reason);
  return private.ok(jsonb_build_object('temp_access_until', v_until));
end;
$$;

create or replace function private.admin_add_note(p_staff uuid, p_role text, p_account_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if length(trim(coalesce(p_body, ''))) < 2 then return private.err('NOTE_EMPTY'); end if;
  insert into platform.account_notes (account_id, staff_user_id, body) values (p_account_id, p_staff, trim(p_body)) returning id into v_id;
  perform private.audit_admin(p_staff, p_role, 'accounts.note', p_account_id, 'account_note', v_id::text);
  return private.ok(jsonb_build_object('note_id', v_id));
end;
$$;

-- E37 · Financeiro ---------------------------------------------------------------------------------------
create table platform.invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  stripe_invoice_id text unique,
  amount app.cents not null,
  status text not null default 'open' check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  due_at timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  hosted_url text,
  nfse_number text, -- D30: emitida à mão no começo
  created_at timestamptz not null default now()
);
create index invoices_account_idx on platform.invoices (account_id, created_at desc);
create index invoices_status_idx on platform.invoices (status, due_at);

create table platform.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references platform.invoices (id),
  account_id uuid not null references app.accounts (id),
  amount app.cents not null check (amount > 0),
  source text not null check (source in ('stripe', 'manual')),
  method text,
  proof_path text,
  registered_by uuid references auth.users (id),
  paid_at timestamptz not null default now(),
  stripe_payment_id text unique,
  check (source <> 'manual' or proof_path is not null)
);
create index payments_invoice_idx on platform.payments (invoice_id);
create index payments_account_idx on platform.payments (account_id, paid_at desc);
create index payments_registered_by_idx on platform.payments (registered_by);

create table platform.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references platform.payments (id),
  amount app.cents not null check (amount > 0),
  reason text not null,
  staff_user_id uuid not null references auth.users (id),
  stripe_refund_id text unique,
  created_at timestamptz not null default now()
);
create index refunds_payment_idx on platform.refunds (payment_id);
create index refunds_staff_idx on platform.refunds (staff_user_id);

create table platform.discounts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pct', 'fixed')),
  value numeric(10, 2) not null check (value > 0),
  cycles int check (cycles > 0),
  starts_at timestamptz not null default now(),
  stacks boolean not null default false,
  reason text not null,
  stripe_coupon_id text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  check (kind <> 'pct' or value <= 100)
);
create index discounts_created_by_idx on platform.discounts (created_by);
create table platform.discount_targets (
  discount_id uuid not null references platform.discounts (id),
  account_id uuid not null references app.accounts (id),
  primary key (discount_id, account_id)
);
create index discount_targets_account_idx on platform.discount_targets (account_id);

alter table platform.invoices enable row level security;
alter table platform.payments enable row level security;
alter table platform.refunds enable row level security;
alter table platform.discounts enable row level security;
alter table platform.discount_targets enable row level security;

-- Pagamento manual: comprovante obrigatório; quita a fatura e libera na hora (E37).
create or replace function private.admin_manual_payment(p_staff uuid, p_role text, p_invoice_id uuid, p_method text,
  p_proof_path text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv platform.invoices;
  v_pay uuid;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if length(trim(coalesce(p_proof_path, ''))) = 0 then return private.err('PROOF_REQUIRED'); end if;
  select * into v_inv from platform.invoices where id = p_invoice_id for update;
  if not found then return private.err('INVOICE_NOT_FOUND'); end if;
  if v_inv.status = 'paid' then return private.err('INVOICE_ALREADY_PAID'); end if;
  insert into platform.payments (invoice_id, account_id, amount, source, method, proof_path, registered_by)
  values (v_inv.id, v_inv.account_id, v_inv.amount, 'manual', p_method, p_proof_path, p_staff) returning id into v_pay;
  update platform.invoices set status = 'paid', paid_at = now() where id = v_inv.id;
  perform private.billing_paid(v_inv.account_id, v_inv.period_start, v_inv.period_end, 'staff:' || p_staff);
  perform private.audit_admin(p_staff, p_role, 'billing.manual_payment', v_inv.account_id, 'invoice', v_inv.id::text,
    jsonb_build_object('status', v_inv.status), jsonb_build_object('status', 'paid', 'payment_id', v_pay, 'proof', p_proof_path), p_reason);
  return private.ok(jsonb_build_object('payment_id', v_pay));
end;
$$;

create or replace function private.admin_refund(p_staff uuid, p_role text, p_payment_id uuid, p_amount bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay platform.payments;
  v_refunded bigint;
  v_id uuid;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  select * into v_pay from platform.payments where id = p_payment_id for update;
  if not found then return private.err('PAYMENT_NOT_FOUND'); end if;
  select coalesce(sum(amount), 0) into v_refunded from platform.refunds where payment_id = p_payment_id;
  if coalesce(p_amount, 0) <= 0 or v_refunded + p_amount > v_pay.amount then
    return private.err('REFUND_AMOUNT_INVALID', format('pago %s, já reembolsado %s', v_pay.amount, v_refunded));
  end if;
  insert into platform.refunds (payment_id, amount, reason, staff_user_id) values (p_payment_id, p_amount, p_reason, p_staff) returning id into v_id;
  perform private.audit_admin(p_staff, p_role, 'billing.refund', v_pay.account_id, 'payment', p_payment_id::text, null,
    jsonb_build_object('refund_id', v_id, 'amount', p_amount), p_reason);
  return private.ok(jsonb_build_object('refund_id', v_id, 'source', v_pay.source));
end;
$$;

-- Desconto: "não acumula" substitui o desconto vigente da conta (E37).
create or replace function private.admin_create_discount(p_staff uuid, p_role text, p_accounts uuid[], p_kind text, p_value numeric,
  p_cycles int, p_stacks boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if p_kind not in ('pct', 'fixed') or coalesce(p_value, 0) <= 0 or (p_kind = 'pct' and p_value > 100) then
    return private.err('DISCOUNT_INVALID');
  end if;
  if coalesce(array_length(p_accounts, 1), 0) = 0 then return private.err('DISCOUNT_TARGETS_EMPTY'); end if;
  insert into platform.discounts (kind, value, cycles, stacks, reason, created_by)
  values (p_kind, p_value, p_cycles, coalesce(p_stacks, false), p_reason, p_staff) returning id into v_id;
  if not coalesce(p_stacks, false) then
    delete from platform.discount_targets dt using platform.discounts d
    where dt.discount_id = d.id and d.id <> v_id and dt.account_id = any (p_accounts);
  end if;
  insert into platform.discount_targets (discount_id, account_id) select v_id, unnest(p_accounts);
  perform private.audit_admin(p_staff, p_role, 'billing.discount', a, 'discount', v_id::text, null,
    jsonb_build_object('kind', p_kind, 'value', p_value, 'cycles', p_cycles, 'stacks', p_stacks), p_reason)
  from unnest(p_accounts) a;
  return private.ok(jsonb_build_object('discount_id', v_id));
end;
$$;

-- E38 · Tickets ---------------------------------------------------------------------------------------------
create table support.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  account_id uuid not null references app.accounts (id),
  store_id uuid references app.stores (id),
  opened_by uuid not null references auth.users (id),
  kind text not null check (kind in ('problema', 'duvida', 'melhoria', 'financeiro')),
  subject text not null check (length(trim(subject)) between 3 and 120),
  description text not null,
  priority text not null default 'media' check (priority in ('critica', 'alta', 'media', 'baixa')),
  status text not null default 'novo' check (status in ('novo', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado')),
  assignee uuid references auth.users (id),
  correlation_ids text[] not null default '{}',
  first_response_at timestamptz,
  resolved_at timestamptz,
  waiting_since timestamptz,
  paused_seconds int not null default 0,
  first_response_late boolean not null default false,
  resolution_late boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_account_idx on support.tickets (account_id, created_at desc);
create index tickets_store_idx on support.tickets (store_id);
create index tickets_opened_by_idx on support.tickets (opened_by);
create index tickets_assignee_idx on support.tickets (assignee);
create index tickets_open_idx on support.tickets (status, priority) where status not in ('resolvido', 'fechado');
create trigger tickets_touch before update on support.tickets for each row execute function private.touch_updated_at();

create table support.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support.tickets (id),
  author_id uuid not null references auth.users (id),
  side text not null check (side in ('cliente', 'equipe')),
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now(),
  check (not internal or side = 'equipe')
);
create index ticket_messages_ticket_idx on support.ticket_messages (ticket_id, created_at);
create index ticket_messages_author_idx on support.ticket_messages (author_id);

create table support.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support.tickets (id),
  path text not null,
  name text,
  size_bytes int,
  mime text,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index ticket_attachments_ticket_idx on support.ticket_attachments (ticket_id);
create index ticket_attachments_uploader_idx on support.ticket_attachments (uploaded_by);
alter table support.tickets enable row level security;
alter table support.ticket_messages enable row level security;
alter table support.ticket_attachments enable row level security;

-- Prazos da §8: primeira resposta 1/4/8/24 h e resolução 8/24/72/120 h por prioridade.
create or replace function private.ticket_sla(p_priority text, p_kind text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'first' then case p_priority when 'critica' then interval '1 hour' when 'alta' then interval '4 hours'
                                      when 'media' then interval '8 hours' else interval '24 hours' end
    else case p_priority when 'critica' then interval '8 hours' when 'alta' then interval '24 hours'
                         when 'media' then interval '72 hours' else interval '120 hours' end end;
$$;

-- A adega abre o chamado (conta suspensa também pode, §1).
create or replace function app.open_ticket(p_account_id uuid, p_store_id uuid, p_kind text, p_subject text, p_description text,
  p_urgency text default 'atrapalha', p_correlation_ids text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_number bigint;
begin
  if not private.is_account_member(p_account_id) or (p_store_id is not null and not private.is_store_member(p_store_id)) then
    return private.err('FORBIDDEN');
  end if;
  if p_kind not in ('problema', 'duvida', 'melhoria', 'financeiro') or length(trim(coalesce(p_subject, ''))) < 3
     or length(trim(coalesce(p_description, ''))) < 5 then
    return private.err('TICKET_INVALID');
  end if;
  insert into support.tickets (account_id, store_id, opened_by, kind, subject, description, priority, correlation_ids)
  values (p_account_id, p_store_id, (select auth.uid()), p_kind, trim(p_subject), trim(p_description),
    case p_urgency when 'parou' then 'critica' when 'atrapalha' then 'alta' when 'duvida' then 'baixa' else 'media' end,
    coalesce(p_correlation_ids[1:20], '{}'))
  returning id, number into v_id, v_number;
  return private.ok(jsonb_build_object('ticket_id', v_id, 'number', v_number));
end;
$$;

create or replace function app.my_tickets(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_account_member(p_account_id) then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object('ticket_id', t.id, 'number', t.number, 'kind', t.kind, 'subject', t.subject,
      'status', t.status, 'created_at', t.created_at,
      'messages', (select coalesce(jsonb_agg(jsonb_build_object('side', m.side, 'body', m.body, 'created_at', m.created_at)
                   order by m.created_at), '[]'::jsonb) from support.ticket_messages m where m.ticket_id = t.id and not m.internal))
      order by t.created_at desc), '[]'::jsonb)) end
  from support.tickets t where t.account_id = p_account_id;
$$;

create or replace function app.reply_ticket(p_ticket_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t support.tickets;
begin
  select * into v_t from support.tickets where id = p_ticket_id for update;
  if not found or not private.is_account_member(v_t.account_id) then
    return private.err('FORBIDDEN');
  end if;
  if length(trim(coalesce(p_body, ''))) < 1 then return private.err('TICKET_MESSAGE_EMPTY'); end if;
  insert into support.ticket_messages (ticket_id, author_id, side, body) values (p_ticket_id, (select auth.uid()), 'cliente', trim(p_body));
  -- Resposta do cliente retoma o prazo pausado.
  update support.tickets set status = case when status in ('aguardando_cliente', 'resolvido') then 'em_andamento' else status end,
    paused_seconds = paused_seconds + coalesce(extract(epoch from now() - waiting_since)::int, 0), waiting_since = null
  where id = p_ticket_id;
  return private.ok();
end;
$$;

-- Equipe responde (nota interna não aparece para a adega). Status aguardando_cliente pausa o prazo.
create or replace function private.staff_reply_ticket(p_staff uuid, p_role text, p_ticket_id uuid, p_body text, p_internal boolean,
  p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t support.tickets;
begin
  select * into v_t from support.tickets where id = p_ticket_id for update;
  if not found then return private.err('TICKET_NOT_FOUND'); end if;
  if p_status is not null and p_status not in ('novo', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado') then
    return private.err('TICKET_STATUS_INVALID');
  end if;
  insert into support.ticket_messages (ticket_id, author_id, side, body, internal) values (p_ticket_id, p_staff, 'equipe', trim(p_body), p_internal);
  update support.tickets set
    first_response_at = case when not p_internal and first_response_at is null then now() else first_response_at end,
    status = coalesce(p_status, case when status = 'novo' and not p_internal then 'em_andamento' else status end),
    assignee = coalesce(assignee, p_staff),
    waiting_since = case when p_status = 'aguardando_cliente' then now() else waiting_since end,
    resolved_at = case when p_status = 'resolvido' then now() else resolved_at end
  where id = p_ticket_id;
  perform private.audit_admin(p_staff, p_role, 'tickets.reply', v_t.account_id, 'ticket', p_ticket_id::text, null,
    jsonb_build_object('internal', p_internal, 'status', p_status));
  return private.ok();
end;
$$;

-- Rotina de 15 min: marca atraso de primeira resposta e de resolução (prazo pausado não conta).
create or replace function private.run_ticket_sla()
returns int
language sql
security definer
set search_path = ''
as $$
  with upd as (
    update support.tickets t set
      first_response_late = t.first_response_late or (t.first_response_at is null
        and now() - t.created_at > private.ticket_sla(t.priority, 'first')),
      resolution_late = t.resolution_late or (t.resolved_at is null and t.status <> 'aguardando_cliente'
        and now() - t.created_at - make_interval(secs => t.paused_seconds) > private.ticket_sla(t.priority, 'resolution'))
    where t.status not in ('resolvido', 'fechado')
    returning 1
  ) select count(*)::int from upd;
$$;

-- E39 · Repositório de produtos ----------------------------------------------------------------------------
create or replace function private.admin_catalog_save(p_staff uuid, p_role text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_status text := coalesce(p ->> 'status', 'draft');
begin
  if v_status not in ('draft', 'published') then return private.err('CATALOG_STATUS_INVALID'); end if;
  if v_status = 'published' and nullif(p ->> 'ean', '') is not null and exists (
     select 1 from platform.catalog_products where ean = p ->> 'ean' and status = 'published' and id is distinct from v_id) then
    return private.err('CATALOG_EAN_DUPLICATE');
  end if;
  if v_id is null then
    insert into platform.catalog_products (ean, name, brand, volume_ml, abv, suggested_category, image_path, status)
    values (nullif(p ->> 'ean', ''), trim(p ->> 'name'), p ->> 'brand', nullif(p ->> 'volume_ml', '')::int,
      nullif(p ->> 'abv', '')::numeric, p ->> 'suggested_category', p ->> 'image_path', v_status) returning id into v_id;
  else
    update platform.catalog_products set ean = coalesce(nullif(p ->> 'ean', ''), ean), name = coalesce(nullif(trim(p ->> 'name'), ''), name),
      brand = coalesce(p ->> 'brand', brand), volume_ml = coalesce(nullif(p ->> 'volume_ml', '')::int, volume_ml),
      image_path = coalesce(p ->> 'image_path', image_path), status = v_status,
      version = version + case when v_status = 'published' then 1 else 0 end
    where id = v_id;
    if not found then return private.err('CATALOG_NOT_FOUND'); end if;
  end if;
  perform private.audit_admin(p_staff, p_role, 'catalog.write', null, 'catalog_product', v_id::text, null, p);
  return private.ok(jsonb_build_object('catalog_product_id', v_id));
end;
$$;

-- Possíveis duplicidades (mesmo EAN ou nome muito parecido com o mesmo volume).
create or replace function private.admin_catalog_duplicates()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('a', a.id, 'a_name', a.name, 'b', b.id, 'b_name', b.name,
    'similarity', round(extensions.similarity(a.name, b.name)::numeric, 2))), '[]'::jsonb)
  from platform.catalog_products a join platform.catalog_products b on a.id < b.id
  where (a.ean = b.ean and a.ean is not null)
     or (a.volume_ml is not distinct from b.volume_ml and extensions.similarity(a.name, b.name) > 0.6);
$$;

-- E40 · Métricas ----------------------------------------------------------------------------------------------
create table analytics.mrr_snapshots (
  day date primary key,
  mrr app.cents not null,
  accounts_by_status jsonb not null,
  created_at timestamptz not null default now()
);
alter table analytics.mrr_snapshots enable row level security;

-- MRR: preço mensal equivalente das assinaturas ativas e em carência (teste não entra).
create or replace function private.current_mrr()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(round((s.price + s.extra_stores * s.extra_store_price)::numeric /
    case s.cycle when 'monthly' then 1 when 'semiannual' then 6 else 12 end)), 0)::bigint
  from platform.subscriptions s where s.status in ('active', 'past_due');
$$;

create or replace function private.metrics_overview(p_month date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with m as (select date_trunc('month', coalesce(p_month, current_date))::date ini,
                    (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date fim)
  select jsonb_build_object(
    'mrr', private.current_mrr(),
    'received', (select coalesce(sum(p.amount), 0) - coalesce((select sum(r.amount) from platform.refunds r, m
                   where r.created_at >= m.ini and r.created_at < m.fim), 0)
                 from platform.payments p, m where p.paid_at >= m.ini and p.paid_at < m.fim),
    'churned', (select count(distinct s.account_id) from platform.subscription_events e join platform.subscriptions s on s.id = e.subscription_id, m
                where e.to_status in ('canceled') and e.from_status in ('active', 'past_due') and e.created_at >= m.ini and e.created_at < m.fim),
    'active_at_start', (select count(*) from platform.subscriptions s, m where s.status in ('active', 'past_due') and s.created_at < m.ini),
    'trial_ended', (select count(distinct s.account_id) from platform.subscription_events e join platform.subscriptions s on s.id = e.subscription_id, m
                    where e.from_status = 'trial' and e.to_status in ('active', 'expired') and e.created_at >= m.ini and e.created_at < m.fim),
    'trial_converted', (select count(distinct s.account_id) from platform.subscription_events e join platform.subscriptions s on s.id = e.subscription_id, m
                        where e.from_status = 'trial' and e.to_status = 'active' and e.created_at >= m.ini and e.created_at < m.fim),
    'gmv_30d', (select coalesce(sum(total), 0) from app.sales where status = 'paid' and created_at > now() - interval '30 days'),
    'accounts_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
      select status, count(*) n from platform.subscriptions group by status) x)
  );
$$;

-- E46 · Manutenção diária ---------------------------------------------------------------------------------------
-- Partições futuras, retenção de logs (D26), payload de webhook após 90 dias, telefone de fiado quitado há
-- 6 meses (E23) e foto do MRR. Idempotente.
create or replace function private.run_daily_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_logs int;
  v_hooks int;
  v_phones int;
begin
  perform private.ensure_month_partitions('audit.system_logs', 2);
  perform private.ensure_month_partitions('audit.store_actions', 2);
  perform private.ensure_month_partitions('audit.admin_actions', 2);

  perform set_config('addegas.audit_maintenance', 'on', true);
  delete from audit.system_logs
  where (source = 'front' and created_at < now() - interval '30 days')
     or (source = 'back' and created_at < now() - interval '90 days')
     or (source = 'security' and created_at < now() - interval '180 days');
  get diagnostics v_logs = row_count;
  perform set_config('addegas.audit_maintenance', 'off', true);

  update platform.webhook_inbox set payload = null
  where payload is not null and status in ('processed', 'rejected', 'dead') and received_at < now() - interval '90 days';
  get diagnostics v_hooks = row_count;

  update app.fiado_accounts set phone = null, phone_anonymized_at = now()
  where balance = 0 and phone_anonymized_at is null
    and not exists (select 1 from app.fiado_ledger l where l.fiado_account_id = fiado_accounts.id and l.created_at > now() - interval '6 months');
  get diagnostics v_phones = row_count;

  insert into analytics.mrr_snapshots (day, mrr, accounts_by_status)
  values (current_date, private.current_mrr(),
    (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from platform.subscriptions group by status) x))
  on conflict (day) do update set mrr = excluded.mrr, accounts_by_status = excluded.accounts_by_status;

  return jsonb_build_object('logs_deleted', v_logs, 'webhook_payloads_cleared', v_hooks, 'fiado_phones_anonymized', v_phones);
end;
$$;

-- Permissões: tudo deste arquivo é só para service_role (Edge Functions) ------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('subscription_transition', 'billing_paid', 'billing_failed', 'run_billing_cycle',
      'inbox_receive', 'inbox_claim', 'inbox_done', 'inbox_fail', 'staff_check', 'admin_require_reason', 'admin_accounts',
      'admin_account_detail', 'admin_extend_trial', 'admin_set_access', 'admin_temp_access', 'admin_add_note', 'admin_manual_payment',
      'admin_refund', 'admin_create_discount', 'ticket_sla', 'staff_reply_ticket', 'run_ticket_sla', 'admin_catalog_save',
      'admin_catalog_duplicates', 'current_mrr', 'metrics_overview', 'run_daily_maintenance')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array['app.request_cancellation(uuid, boolean)', 'app.open_ticket(uuid, uuid, text, text, text, text, text[])',
    'app.my_tickets(uuid)', 'app.reply_ticket(uuid, text)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Agendamentos (pg_cron, horários em UTC; São Paulo = UTC−3). A rotina das 9h de cobrança (12:00 UTC)
-- é disparada pela Edge Function cron-billing, que reconfere o gateway antes (supabase/cron/README.md).
create extension if not exists pg_cron;
select cron.schedule('addegas-manutencao-diaria', '0 5 * * *', $$select private.run_daily_maintenance()$$);
select cron.schedule('addegas-alertas-periodicos', '7 * * * *', $$select private.run_periodic_alerts()$$);
select cron.schedule('addegas-sla-tickets', '*/15 * * * *', $$select private.run_ticket_sla()$$);
