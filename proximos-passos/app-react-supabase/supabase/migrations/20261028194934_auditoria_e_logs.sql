-- E05 (parte de banco) e E13 · logs técnicos e auditoria imutável.
-- Tabelas particionadas por mês desde o início; sem FK (a auditoria sobrevive a exclusões).

-- Partições ----------------------------------------------------------------
-- Cria a partição mensal de uma tabela particionada por created_at, com RLS ligada.
create or replace function private.create_month_partition(p_parent regclass, p_month date)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_schema text;
  v_table text;
  v_name text;
begin
  select n.nspname, c.relname into v_schema, v_table
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.oid = p_parent;

  v_name := v_table || '_' || to_char(v_start, 'YYYY_MM');

  if to_regclass(format('%I.%I', v_schema, v_name)) is null then
    execute format(
      'create table %I.%I partition of %I.%I for values from (%L) to (%L)',
      v_schema, v_name, v_schema, v_table, v_start, v_end
    );
    execute format('alter table %I.%I enable row level security', v_schema, v_name);
  end if;
  return v_schema || '.' || v_name;
end;
$$;

-- Garante as partições do mês atual e dos próximos N meses (a rotina diária da E46 chama isto).
create or replace function private.ensure_month_partitions(p_parent regclass, p_months_ahead int default 2)
returns void
language plpgsql
set search_path = ''
as $$
begin
  for i in 0..p_months_ahead loop
    perform private.create_month_partition(p_parent, (now() + make_interval(months => i))::date);
  end loop;
end;
$$;

revoke execute on function private.create_month_partition(regclass, date) from public, anon, authenticated;
revoke execute on function private.ensure_month_partitions(regclass, int) from public, anon, authenticated;

-- Mascaramento --------------------------------------------------------------
-- E-mail: m***@dominio.com.br
create or replace function private.mask_email(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(p_value, '([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@', '\1***@', 'g');
$$;

-- Remove chaves sensíveis e mascara e-mails em qualquer nível de um jsonb.
create or replace function private.redact(p_value jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb;
  v_key text;
  v_item jsonb;
begin
  if p_value is null then
    return null;
  end if;

  case jsonb_typeof(p_value)
    when 'object' then
      v_out := '{}'::jsonb;
      for v_key, v_item in select * from jsonb_each(p_value) loop
        if v_key ~* '(senha|password|passwd|token|secret|authorization|cookie|apikey|api_key|card|cartao|cvv|pin)' then
          v_out := v_out || jsonb_build_object(v_key, '[removido]');
        else
          v_out := v_out || jsonb_build_object(v_key, private.redact(v_item));
        end if;
      end loop;
      return v_out;
    when 'array' then
      select coalesce(jsonb_agg(private.redact(e)), '[]'::jsonb) into v_out
      from jsonb_array_elements(p_value) e;
      return v_out;
    when 'string' then
      return to_jsonb(private.mask_email(p_value #>> '{}'));
    else
      return p_value;
  end case;
end;
$$;

revoke execute on function private.mask_email(text) from public, anon, authenticated;
revoke execute on function private.redact(jsonb) from public, anon, authenticated;

-- IP de quem chamou, a partir do x-forwarded-for repassado pela Vercel/Kong.
create or replace function private.request_ip()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  v_raw text := split_part(
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-forwarded-for', ',', 1);
begin
  return nullif(trim(v_raw), '')::inet;
exception when others then
  return null;
end;
$$;

revoke execute on function private.request_ip() from public, anon, authenticated;

-- Logs técnicos (E05) ----------------------------------------------------------
create table audit.system_logs (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('front', 'back', 'security')),
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  code text,
  message text not null,
  correlation_id text,
  account_id uuid,
  store_id uuid,
  user_id uuid,
  context jsonb not null default '{}'::jsonb,
  primary key (id, created_at)
) partition by range (created_at);

alter table audit.system_logs enable row level security;
create index system_logs_correlation_idx on audit.system_logs (correlation_id, created_at desc);
create index system_logs_level_idx on audit.system_logs (source, level, created_at desc);
select private.ensure_month_partitions('audit.system_logs', 2);

-- Grava um log com o contexto mascarado. Usado pelas RPCs e pela função /api/logs.
create or replace function private.log(
  p_source text,
  p_level text,
  p_message text,
  p_code text default null,
  p_context jsonb default '{}'::jsonb,
  p_store_id uuid default null,
  p_account_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into audit.system_logs (source, level, code, message, correlation_id, account_id, store_id, user_id, context)
  values (
    p_source, p_level, p_code, left(private.mask_email(p_message), 2000),
    private.correlation_id(), p_account_id, p_store_id, (select auth.uid()),
    coalesce(private.redact(p_context), '{}'::jsonb)
  );
end;
$$;

revoke execute on function private.log(text, text, text, text, jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function private.log(text, text, text, text, jsonb, uuid, uuid) to service_role;

-- Auditoria (E13) ---------------------------------------------------------------
create table audit.store_actions (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid,
  store_id uuid,
  actor_user_id uuid,
  actor_kind text,
  operator_member_id uuid,
  action text not null,
  entity text,
  entity_id text,
  reason text,
  before jsonb,
  after jsonb,
  outcome text not null default 'allowed' check (outcome in ('allowed', 'denied')),
  correlation_id text,
  ip inet,
  primary key (id, created_at)
) partition by range (created_at);

create table audit.admin_actions (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  staff_user_id uuid,
  staff_role text,
  account_id uuid,
  action text not null,
  entity text,
  entity_id text,
  reason text,
  before jsonb,
  after jsonb,
  outcome text not null default 'allowed' check (outcome in ('allowed', 'denied')),
  correlation_id text,
  ip inet,
  primary key (id, created_at)
) partition by range (created_at);

alter table audit.store_actions enable row level security;
alter table audit.admin_actions enable row level security;
create index store_actions_store_idx on audit.store_actions (store_id, created_at desc);
create index store_actions_account_idx on audit.store_actions (account_id, created_at desc);
create index store_actions_actor_idx on audit.store_actions (actor_user_id, action, created_at desc);
create index admin_actions_account_idx on audit.admin_actions (account_id, created_at desc);
create index admin_actions_staff_idx on audit.admin_actions (staff_user_id, created_at desc);
select private.ensure_month_partitions('audit.store_actions', 2);
select private.ensure_month_partitions('audit.admin_actions', 2);

-- Só inserção: nenhum papel da API altera ou apaga; e o trigger barra até o dono do schema,
-- salvo a rotina de anonimização da LGPD (E51), que liga a chave addegas.audit_maintenance.
revoke update, delete, truncate on all tables in schema audit from public, anon, authenticated, service_role;

create or replace function private.audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('addegas.audit_maintenance', true), 'off') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception using errcode = 'P0001', message = 'AUDIT_IMMUTABLE',
    detail = 'audit.' || tg_table_name || ' aceita só inserção';
end;
$$;

revoke execute on function private.audit_immutable() from public, anon, authenticated;

create trigger store_actions_immutable before update or delete on audit.store_actions
  for each row execute function private.audit_immutable();
create trigger admin_actions_immutable before update or delete on audit.admin_actions
  for each row execute function private.audit_immutable();
create trigger system_logs_immutable before update or delete on audit.system_logs
  for each row execute function private.audit_immutable();

-- Registra uma ação da loja. Negações iguais (mesmo autor, ação e loja) no mesmo minuto
-- são gravadas uma vez só, para um script insistente não encher a tabela.
create or replace function private.audit_store(
  p_action text,
  p_store_id uuid,
  p_account_id uuid default null,
  p_entity text default null,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_outcome text default 'allowed',
  p_operator_member_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if p_outcome = 'denied' and exists (
    select 1 from audit.store_actions
    where actor_user_id is not distinct from v_actor
      and action = p_action
      and store_id is not distinct from p_store_id
      and outcome = 'denied'
      and created_at > now() - interval '1 minute'
  ) then
    return;
  end if;

  insert into audit.store_actions (
    account_id, store_id, actor_user_id, actor_kind, operator_member_id, action,
    entity, entity_id, reason, before, after, outcome, correlation_id, ip
  ) values (
    p_account_id, p_store_id, v_actor, private.current_user_kind(), p_operator_member_id, p_action,
    p_entity, p_entity_id, p_reason, p_before, p_after, p_outcome, private.correlation_id(),
    private.request_ip()
  );
end;
$$;

-- Registra uma ação da equipe Addegas (chamada pela admin-api, E14).
create or replace function private.audit_admin(
  p_staff_user_id uuid,
  p_staff_role text,
  p_action text,
  p_account_id uuid default null,
  p_entity text default null,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_outcome text default 'allowed'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into audit.admin_actions (
    staff_user_id, staff_role, account_id, action, entity, entity_id, reason,
    before, after, outcome, correlation_id, ip
  ) values (
    p_staff_user_id, p_staff_role, p_account_id, p_action, p_entity, p_entity_id, p_reason,
    p_before, p_after, p_outcome, private.correlation_id(), private.request_ip()
  );
end;
$$;

revoke execute on function private.audit_store(text, uuid, uuid, text, text, jsonb, jsonb, text, text, uuid) from public, anon, authenticated;
revoke execute on function private.audit_admin(uuid, text, text, uuid, text, text, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function private.audit_admin(uuid, text, text, uuid, text, text, jsonb, jsonb, text, text) to service_role;

-- Padrão de resposta das RPCs (ver supabase/README.md, "Padrão de RPC"):
-- recusa previsível = {ok:false, error:{code, detail}}, sempre ANTES de qualquer escrita,
-- para que a auditoria da negação não seja desfeita junto com uma exceção.
create or replace function private.err(p_code text, p_detail text default null)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('ok', false, 'error', jsonb_build_object('code', p_code, 'detail', p_detail));
$$;

create or replace function private.ok(p_data jsonb default '{}'::jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'data', coalesce(p_data, '{}'::jsonb));
$$;

revoke execute on function private.err(text, text) from public, anon;
revoke execute on function private.ok(jsonb) from public, anon;
grant execute on function private.err(text, text) to authenticated, service_role;
grant execute on function private.ok(jsonb) to authenticated, service_role;
