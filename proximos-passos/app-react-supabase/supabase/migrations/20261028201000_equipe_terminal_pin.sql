-- E07 (equipe, parte de banco), E09 (terminal do caixa) e E10 (PIN e sessão de operador).
-- A criação de usuário com login (e-mail ou nome de usuário) e o pareamento do aparelho
-- precisam da chave de serviço do Auth e ficam nas Edge Functions, que chamam as funções
-- private.* daqui.

-- Equipe (E07) ---------------------------------------------------------------------
-- PIN fora do app: nem o hash chega ao navegador.
create table private.member_pins (
  member_id uuid primary key references app.store_members (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);
alter table private.member_pins enable row level security;

-- Quem pode gerir quem: dono gere todos; quem tem 'equipe' gere papéis abaixo do dono,
-- e nunca dá papel igual ou acima do próprio (gerente não cria gerente nem dono).
create or replace function private.role_rank(p_role app.member_role)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_role when 'owner' then 100 when 'manager' then 50 else 10 end;
$$;
revoke execute on function private.role_rank(app.member_role) from public, anon, authenticated;

create or replace function private.can_manage_role(p_store_id uuid, p_target app.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_target <> 'owner'
    and private.can(p_store_id, 'equipe')
    and (private.member_role(p_store_id) = 'owner'
         or private.role_rank(p_target) < private.role_rank(private.member_role(p_store_id)));
$$;
revoke execute on function private.can_manage_role(uuid, app.member_role) from public, anon, authenticated;

-- Membro só com PIN (caixa que usa apenas o tablet do balcão, E07/E10).
create or replace function app.create_pin_member(
  p_store_id uuid, p_display_name text, p_role app.member_role, p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
begin
  if not private.can_manage_role(p_store_id, p_role) then
    perform private.audit_store('member.create', p_store_id, p_outcome => 'denied', p_entity => 'role', p_entity_id => p_role::text);
    return private.err('FORBIDDEN');
  end if;
  if length(trim(coalesce(p_display_name, ''))) < 1 then
    return private.err('MEMBER_NAME');
  end if;
  if not private.pin_is_acceptable(p_pin) then
    return private.err('PIN_WEAK', 'Use 4 dígitos, sem sequência nem repetição (ex.: 1234, 0000).');
  end if;

  insert into app.store_members (store_id, user_id, display_name, role)
  values (p_store_id, null, trim(p_display_name), p_role) returning id into v_member;
  insert into private.member_pins (member_id, pin_hash)
  values (v_member, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)));

  perform private.audit_store('member.create', p_store_id, null, 'store_member', v_member::text, null,
    jsonb_build_object('name', p_display_name, 'role', p_role, 'login', false));
  return private.ok(jsonb_build_object('member_id', v_member));
end;
$$;

-- Ligação feita pela Edge Function members-create depois de criar o usuário no Auth.
create or replace function private.attach_login_member(
  p_actor uuid, p_store_id uuid, p_user_id uuid, p_display_name text, p_role app.member_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
begin
  insert into app.store_members (store_id, user_id, display_name, role)
  values (p_store_id, p_user_id, trim(p_display_name), p_role) returning id into v_member;
  insert into audit.store_actions (store_id, actor_user_id, actor_kind, action, entity, entity_id, after, correlation_id)
  values (p_store_id, p_actor, 'person', 'member.create', 'store_member', v_member::text,
    jsonb_build_object('name', p_display_name, 'role', p_role, 'login', true), private.correlation_id());
  return v_member;
end;
$$;
revoke execute on function private.attach_login_member(uuid, uuid, uuid, text, app.member_role) from public, anon, authenticated;
grant execute on function private.attach_login_member(uuid, uuid, uuid, text, app.member_role) to service_role;

-- Pré-checagem chamada pela Edge Function com o token de quem pediu (antes de criar o usuário).
create or replace function app.can_create_member(p_store_id uuid, p_role app.member_role)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_role(p_store_id, p_role) then
    perform private.audit_store('member.create', p_store_id, p_outcome => 'denied', p_entity => 'role', p_entity_id => p_role::text);
    return private.err('FORBIDDEN');
  end if;
  return private.ok(jsonb_build_object('store_slug', (select slug from app.stores where id = p_store_id)));
end;
$$;

create or replace function app.update_member(
  p_member_id uuid, p_role app.member_role default null, p_active boolean default null, p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m app.store_members;
begin
  select * into v_m from app.store_members where id = p_member_id;
  if not found then
    return private.err('MEMBER_NOT_FOUND');
  end if;
  -- §4: o dono nunca perde permissões nem é rebaixado ou desativado por outro.
  if v_m.role = 'owner'
     or not private.can_manage_role(v_m.store_id, v_m.role)
     or (p_role is not null and not private.can_manage_role(v_m.store_id, p_role)) then
    perform private.audit_store('member.update', v_m.store_id, p_outcome => 'denied', p_entity => 'store_member', p_entity_id => p_member_id::text);
    return private.err('FORBIDDEN');
  end if;

  update app.store_members set
    role = coalesce(p_role, role),
    active = coalesce(p_active, active),
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = p_member_id;

  perform private.audit_store('member.update', v_m.store_id, null, 'store_member', p_member_id::text,
    jsonb_build_object('role', v_m.role, 'active', v_m.active, 'name', v_m.display_name),
    jsonb_build_object('role', coalesce(p_role, v_m.role), 'active', coalesce(p_active, v_m.active),
      'name', coalesce(nullif(trim(p_display_name), ''), v_m.display_name)));

  -- Desativado: encerra as sessões de operador abertas (o token de login é revogado pela Edge Function).
  if p_active is false then
    update app.operator_sessions set ended_at = now(), end_reason = 'member_deactivated'
    where member_id = p_member_id and ended_at is null;
  end if;
  return private.ok(jsonb_build_object('user_id', v_m.user_id));
end;
$$;

-- PIN: 4 dígitos sem sequência óbvia nem repetição (E10). Repetir o PIN de colega é permitido
-- de propósito: recusar revelaria o PIN do outro.
create or replace function private.pin_is_acceptable(p_pin text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_pin ~ '^[0-9]{4}$'
    and p_pin !~ '^(\d)\1{3}$'
    and p_pin not in ('0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654',
                      '6543', '5432', '4321', '3210', '1212', '2580', '1111');
$$;
revoke execute on function private.pin_is_acceptable(text) from public, anon, authenticated;

-- A própria pessoa troca o PIN; dono ou quem tem 'equipe' define o PIN de quem gere.
create or replace function app.set_member_pin(p_member_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m app.store_members;
begin
  select * into v_m from app.store_members where id = p_member_id and active;
  if not found then
    return private.err('MEMBER_NOT_FOUND');
  end if;
  if v_m.user_id is distinct from (select auth.uid())
     and not (v_m.role <> 'owner' and private.can_manage_role(v_m.store_id, v_m.role))
     and private.member_role(v_m.store_id) is distinct from 'owner' then
    perform private.audit_store('member.pin', v_m.store_id, p_outcome => 'denied', p_entity => 'store_member', p_entity_id => p_member_id::text);
    return private.err('FORBIDDEN');
  end if;
  if not private.pin_is_acceptable(p_pin) then
    return private.err('PIN_WEAK', 'Use 4 dígitos, sem sequência nem repetição (ex.: 1234, 0000).');
  end if;

  insert into private.member_pins (member_id, pin_hash) values (p_member_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (member_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
  perform private.audit_store('member.pin', v_m.store_id, null, 'store_member', p_member_id::text);
  return private.ok();
end;
$$;

-- Terminal do caixa (E09) -----------------------------------------------------------
create table app.terminals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  name text not null check (length(trim(name)) between 1 and 40),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  active boolean not null default true,
  registered_by uuid references auth.users (id),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, store_id)
);
create index terminals_store_idx on app.terminals (store_id);
create index terminals_registered_by_idx on app.terminals (registered_by);
alter table app.terminals enable row level security;

-- Código de 6 dígitos válido por 10 minutos e de uso único; só o hash fica guardado.
create table private.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  terminal_name text not null,
  code_hash text not null,
  created_by uuid not null references auth.users (id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index pairing_codes_store_idx on private.pairing_codes (store_id);
create index pairing_codes_open_idx on private.pairing_codes (expires_at) where used_at is null;
alter table private.pairing_codes enable row level security;

-- Terminal da sessão: só vale se o usuário técnico ainda estiver ligado a um terminal ativo.
create or replace function private.current_terminal()
returns app.terminals
language sql
stable
security definer
set search_path = ''
as $$
  select t.* from app.terminals t
  where private.current_user_kind() = 'terminal'
    and t.auth_user_id = (select auth.uid())
    and t.active;
$$;

create or replace function private.terminal_store()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (private.current_terminal()).store_id;
$$;

revoke execute on function private.current_terminal() from public, anon;
revoke execute on function private.terminal_store() from public, anon;
grant execute on function private.current_terminal() to authenticated, service_role;
grant execute on function private.terminal_store() to authenticated, service_role;

-- Dono ou gerente (permissão 'equipe' ou 'caixa' de gerente) gera o código de pareamento.
create or replace function app.create_pairing_code(p_store_id uuid, p_terminal_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  if private.member_role(p_store_id) not in ('owner', 'manager') then
    perform private.audit_store('terminal.pairing_code', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if length(trim(coalesce(p_terminal_name, ''))) < 1 then
    return private.err('TERMINAL_NAME');
  end if;

  insert into private.pairing_codes (store_id, terminal_name, code_hash, created_by, expires_at)
  values (p_store_id, trim(p_terminal_name), extensions.crypt(v_code, extensions.gen_salt('bf', 8)),
    (select auth.uid()), now() + interval '10 minutes');

  perform private.audit_store('terminal.pairing_code', p_store_id, null, 'terminal', p_terminal_name);
  return private.ok(jsonb_build_object('code', v_code, 'expires_in_seconds', 600));
end;
$$;

-- Usado pela Edge Function terminals-pair: confere o código, cria o terminal e devolve
-- o que vai em app_metadata do usuário técnico. Código errado, vencido ou usado = mesmo erro.
create or replace function private.redeem_pairing_code(p_store_slug text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pc private.pairing_codes;
  v_terminal uuid;
begin
  select pc.* into v_pc
  from private.pairing_codes pc join app.stores s on s.id = pc.store_id
  where s.slug = p_store_slug and pc.used_at is null and pc.expires_at > now()
    and pc.code_hash = extensions.crypt(p_code, pc.code_hash)
  order by pc.created_at desc limit 1
  for update of pc;

  if not found then
    return private.err('PAIRING_CODE_INVALID');
  end if;

  update private.pairing_codes set used_at = now() where id = v_pc.id;
  insert into app.terminals (store_id, name, registered_by) values (v_pc.store_id, v_pc.terminal_name, v_pc.created_by)
  returning id into v_terminal;

  insert into audit.store_actions (store_id, actor_user_id, actor_kind, action, entity, entity_id, after, correlation_id)
  values (v_pc.store_id, v_pc.created_by, 'person', 'terminal.register', 'terminal', v_terminal::text,
    jsonb_build_object('name', v_pc.terminal_name), private.correlation_id());

  return private.ok(jsonb_build_object('terminal_id', v_terminal, 'store_id', v_pc.store_id, 'name', v_pc.terminal_name));
end;
$$;

create or replace function private.bind_terminal_user(p_terminal_id uuid, p_auth_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update app.terminals set auth_user_id = p_auth_user, last_seen_at = now() where id = p_terminal_id;
$$;

revoke execute on function private.redeem_pairing_code(text, text) from public, anon, authenticated;
revoke execute on function private.bind_terminal_user(uuid, uuid) from public, anon, authenticated;
grant execute on function private.redeem_pairing_code(text, text) to service_role;
grant execute on function private.bind_terminal_user(uuid, uuid) to service_role;

-- Revogar: a RLS recusa na hora pelo active; a Edge Function também derruba as sessões no Auth.
create or replace function app.revoke_terminal(p_terminal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t app.terminals;
begin
  select * into v_t from app.terminals where id = p_terminal_id;
  if not found then
    return private.err('TERMINAL_NOT_FOUND');
  end if;
  if private.member_role(v_t.store_id) not in ('owner', 'manager') then
    perform private.audit_store('terminal.revoke', v_t.store_id, p_outcome => 'denied', p_entity => 'terminal', p_entity_id => p_terminal_id::text);
    return private.err('FORBIDDEN');
  end if;
  update app.terminals set active = false, revoked_at = now() where id = p_terminal_id;
  update app.operator_sessions set ended_at = now(), end_reason = 'terminal_revoked'
  where terminal_id = p_terminal_id and ended_at is null;
  perform private.audit_store('terminal.revoke', v_t.store_id, null, 'terminal', p_terminal_id::text);
  return private.ok(jsonb_build_object('auth_user_id', v_t.auth_user_id));
end;
$$;

-- Operador e PIN (E10) -----------------------------------------------------------------
create table app.operator_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  terminal_id uuid not null,
  member_id uuid not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours',
  ended_at timestamptz,
  end_reason text,
  foreign key (terminal_id, store_id) references app.terminals (id, store_id),
  foreign key (member_id, store_id) references app.store_members (id, store_id)
);
create index operator_sessions_terminal_idx on app.operator_sessions (terminal_id, store_id);
create index operator_sessions_member_idx on app.operator_sessions (member_id, store_id);
create unique index operator_sessions_one_open on app.operator_sessions (terminal_id) where ended_at is null;
alter table app.operator_sessions enable row level security;

create table private.pin_attempts (
  id bigint generated always as identity primary key,
  terminal_id uuid not null,
  member_id uuid not null,
  success boolean not null,
  ip inet,
  created_at timestamptz not null default now()
);
create index pin_attempts_member_idx on private.pin_attempts (member_id, created_at desc);
create index pin_attempts_terminal_idx on private.pin_attempts (terminal_id, created_at desc);
alter table private.pin_attempts enable row level security;

-- Grava tentativas de PIN mesmo quando a RPC termina em recusa (é ok:false, não exceção).
create or replace function app.operator_login(p_member_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t app.terminals := private.current_terminal();
  v_m app.store_members;
  v_hash text;
  v_session uuid;
begin
  if v_t.id is null then
    return private.err('TERMINAL_REQUIRED');
  end if;

  -- Trava do terminal: 20 erros na última hora (E10), contra quem troca de operador para adivinhar.
  if (select count(*) from private.pin_attempts
      where terminal_id = v_t.id and not success and created_at > now() - interval '1 hour') >= 20 then
    return private.err('TERMINAL_PIN_LOCKED');
  end if;

  select * into v_m from app.store_members where id = p_member_id and store_id = v_t.store_id and active;
  if not found then
    return private.err('OPERATOR_INVALID');
  end if;

  -- Trava do operador: 5 erros em 15 minutos (§3).
  if (select count(*) from private.pin_attempts
      where member_id = v_m.id and not success and created_at > now() - interval '15 minutes') >= 5 then
    return private.err('OPERATOR_PIN_LOCKED', 'Tente de novo em 15 minutos.');
  end if;

  select pin_hash into v_hash from private.member_pins where member_id = v_m.id;
  if v_hash is null or v_hash <> extensions.crypt(p_pin, v_hash) then
    insert into private.pin_attempts (terminal_id, member_id, success, ip) values (v_t.id, v_m.id, false, private.request_ip());
    return private.err('PIN_INVALID');
  end if;

  insert into private.pin_attempts (terminal_id, member_id, success, ip) values (v_t.id, v_m.id, true, private.request_ip());
  update app.operator_sessions set ended_at = now(), end_reason = 'switched'
  where terminal_id = v_t.id and ended_at is null;
  insert into app.operator_sessions (store_id, terminal_id, member_id) values (v_t.store_id, v_t.id, v_m.id)
  returning id into v_session;
  update app.terminals set last_seen_at = now() where id = v_t.id;

  return private.ok(jsonb_build_object('operator_session_id', v_session, 'member_id', v_m.id,
    'name', v_m.display_name, 'role', v_m.role));
end;
$$;

create or replace function app.operator_logout()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t app.terminals := private.current_terminal();
begin
  if v_t.id is null then
    return private.err('TERMINAL_REQUIRED');
  end if;
  update app.operator_sessions set ended_at = now(), end_reason = 'logout'
  where terminal_id = v_t.id and ended_at is null;
  return private.ok();
end;
$$;

-- Sessão de operador válida no terminal da requisição: devolve o membro (E10).
-- Usada pelas RPCs de caixa e venda; a permissão aplicada é a do papel do operador.
create or replace function private.operator(p_session_id uuid)
returns app.store_members
language sql
stable
security definer
set search_path = ''
as $$
  select m.* from app.operator_sessions os
  join app.store_members m on m.id = os.member_id and m.active
  join app.stores s on s.id = os.store_id and s.archived_at is null
  where os.id = p_session_id
    and os.ended_at is null
    and os.expires_at > now()
    and os.terminal_id = (private.current_terminal()).id;
$$;

-- Permissão do operador: mesma regra do private.can, aplicada ao papel do membro da sessão.
create or replace function private.operator_can(p_session_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.operator_sessions os
    join app.store_members m on m.id = os.member_id and m.active
    join app.stores s on s.id = os.store_id and s.archived_at is null
    join app.permissions p on p.code = p_permission
    left join app.role_permissions rp on rp.store_id = m.store_id and rp.role = m.role and rp.permission_code = p.code
    where os.id = p_session_id
      and os.ended_at is null
      and os.expires_at > now()
      and os.terminal_id = (private.current_terminal()).id
      and (m.role = 'owner' or coalesce(rp.allowed, false))
      and (not p.blocked_when_suspended or private.account_access(s.account_id) <> 'suspended')
      and (p.feature_code is null or private.plan_allows(s.account_id, p.feature_code))
  );
$$;

revoke execute on function private.operator(uuid) from public, anon, authenticated;
revoke execute on function private.operator_can(uuid, text) from public, anon, authenticated;
grant execute on function private.operator(uuid) to service_role;
grant execute on function private.operator_can(uuid, text) to service_role;

-- Autorização de desconto acima do limite (D05, D63): PIN de quem tem limite suficiente.
create table private.override_tokens (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  terminal_id uuid not null,
  authorized_by uuid not null references app.store_members (id) on delete cascade,
  action text not null,
  max_value numeric(5, 2),
  expires_at timestamptz not null default now() + interval '2 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index override_tokens_member_idx on private.override_tokens (authorized_by);
alter table private.override_tokens enable row level security;

create or replace function app.authorize_override(p_member_id uuid, p_pin text, p_action text, p_value numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t app.terminals := private.current_terminal();
  v_m app.store_members;
  v_hash text;
  v_limit numeric;
  v_token uuid;
begin
  if v_t.id is null then
    return private.err('TERMINAL_REQUIRED');
  end if;
  if p_action <> 'discount' then
    return private.err('OVERRIDE_ACTION_UNKNOWN');
  end if;
  select * into v_m from app.store_members where id = p_member_id and store_id = v_t.store_id and active;
  if not found then
    return private.err('OPERATOR_INVALID');
  end if;
  if (select count(*) from private.pin_attempts
      where member_id = v_m.id and not success and created_at > now() - interval '15 minutes') >= 5 then
    return private.err('OPERATOR_PIN_LOCKED');
  end if;
  select pin_hash into v_hash from private.member_pins where member_id = v_m.id;
  if v_hash is null or v_hash <> extensions.crypt(p_pin, v_hash) then
    insert into private.pin_attempts (terminal_id, member_id, success, ip) values (v_t.id, v_m.id, false, private.request_ip());
    return private.err('PIN_INVALID');
  end if;

  -- Quem autoriza precisa ter 'desconto' e limite que cubra o valor (dono = livre).
  select rs.max_discount_pct into v_limit from app.role_settings rs where rs.store_id = v_t.store_id and rs.role = v_m.role;
  if not (v_m.role = 'owner' or (
      exists (select 1 from app.role_permissions rp where rp.store_id = v_t.store_id and rp.role = v_m.role
              and rp.permission_code = 'desconto' and rp.allowed)
      and v_limit is not null and v_limit >= p_value)) then
    perform private.audit_store('sale.discount_override', v_t.store_id, p_outcome => 'denied',
      p_entity => 'store_member', p_entity_id => v_m.id::text, p_after => jsonb_build_object('pct', p_value));
    return private.err('OVERRIDE_LIMIT', 'Quem autoriza não tem limite para esse desconto.');
  end if;

  insert into private.pin_attempts (terminal_id, member_id, success, ip) values (v_t.id, v_m.id, true, private.request_ip());
  insert into private.override_tokens (store_id, terminal_id, authorized_by, action, max_value)
  values (v_t.store_id, v_t.id, v_m.id, p_action, p_value) returning id into v_token;
  return private.ok(jsonb_build_object('override_token', v_token, 'expires_in_seconds', 120));
end;
$$;

-- Consome o token (uso único) dentro da venda. Devolve o membro que autorizou.
create or replace function private.consume_override(p_token uuid, p_store_id uuid, p_value numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_by uuid;
begin
  update private.override_tokens set used_at = now()
  where id = p_token and store_id = p_store_id and terminal_id = (private.current_terminal()).id
    and used_at is null and expires_at > now() and max_value >= p_value
  returning authorized_by into v_by;
  return v_by;
end;
$$;
revoke execute on function private.consume_override(uuid, uuid, numeric) from public, anon, authenticated;

-- Políticas --------------------------------------------------------------------------------
-- Terminal lê a lista de operadores da loja (tela de PIN), sem dados além do nome e papel.
create policy store_members_terminal on app.store_members for select to authenticated
  using (store_id = (select private.terminal_store()));
create policy stores_terminal on app.stores for select to authenticated
  using (id = (select private.terminal_store()));
create policy terminals_select on app.terminals for select to authenticated
  using ((select private.is_store_member(store_id)) or id = (select (private.current_terminal()).id));
create policy operator_sessions_select on app.operator_sessions for select to authenticated
  using ((select private.can(store_id, 'caixa')) or terminal_id = (select (private.current_terminal()).id));
create policy default_terminal_settings on app.store_settings for select to authenticated
  using (store_id = (select private.terminal_store()));

grant select on app.terminals, app.operator_sessions to authenticated;
grant all on app.terminals, app.operator_sessions to service_role;

revoke execute on function app.create_pin_member(uuid, text, app.member_role, text) from public, anon;
revoke execute on function app.can_create_member(uuid, app.member_role) from public, anon;
revoke execute on function app.update_member(uuid, app.member_role, boolean, text) from public, anon;
revoke execute on function app.set_member_pin(uuid, text) from public, anon;
revoke execute on function app.create_pairing_code(uuid, text) from public, anon;
revoke execute on function app.revoke_terminal(uuid) from public, anon;
revoke execute on function app.operator_login(uuid, text) from public, anon;
revoke execute on function app.operator_logout() from public, anon;
revoke execute on function app.authorize_override(uuid, text, text, numeric) from public, anon;
grant execute on function app.create_pin_member(uuid, text, app.member_role, text) to authenticated;
grant execute on function app.can_create_member(uuid, app.member_role) to authenticated;
grant execute on function app.update_member(uuid, app.member_role, boolean, text) to authenticated;
grant execute on function app.set_member_pin(uuid, text) to authenticated;
grant execute on function app.create_pairing_code(uuid, text) to authenticated;
grant execute on function app.revoke_terminal(uuid) to authenticated;
grant execute on function app.operator_login(uuid, text) to authenticated;
grant execute on function app.operator_logout() to authenticated;
grant execute on function app.authorize_override(uuid, text, text, numeric) to authenticated;
