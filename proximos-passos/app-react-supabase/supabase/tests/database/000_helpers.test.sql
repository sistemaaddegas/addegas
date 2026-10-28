-- Helpers compartilhados pelos testes. Este arquivo NÃO faz rollback: o schema `tests`
-- fica no banco local para os arquivos seguintes (rodam em ordem alfabética).
-- Só existe no banco local de teste; nunca vai para migrations.
create schema if not exists tests;
grant usage on schema tests to authenticated, service_role;

-- Cria um usuário no Auth (kind opcional; e-mail confirmado por padrão).
create or replace function tests.new_user(p_email text, p_kind text default null, p_confirmed boolean default true)
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email, '',
    case when p_confirmed then now() end,
    case when p_kind is null then '{}'::jsonb else jsonb_build_object('kind', p_kind) end, '{}'::jsonb, now(), now());
  return v;
end $$;

-- Entra como o usuário (claims do JWT + papel authenticated). Chame `reset role` antes.
create or replace function tests.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'app_metadata', (select raw_app_meta_data from auth.users where id = p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Cria dono + conta + loja e devolve {account_id, store_id}. Roda como o próprio dono.
create or replace function tests.new_store_owner(p_email text, p_store text) returns jsonb language plpgsql as $$
declare v_user uuid := tests.new_user(p_email); v jsonb;
begin
  perform tests.act_as(v_user);
  v := app.complete_onboarding(p_store) -> 'data';
  perform set_config('role', 'postgres', true);
  return v || jsonb_build_object('user_id', v_user);
end $$;

-- Membro com login numa loja (sem passar pela Edge Function).
create or replace function tests.add_member(p_store uuid, p_email text, p_role app.member_role) returns uuid
language plpgsql as $$
declare v_user uuid := tests.new_user(p_email);
begin
  perform private.attach_login_member(null, p_store, v_user, split_part(p_email, '@', 1), p_role);
  return v_user;
end $$;

-- Terminal pareado na loja, com sessão de operador do membro informado (PIN já definido).
create or replace function tests.new_terminal(p_store uuid) returns uuid language plpgsql as $$
declare v_term uuid; v_user uuid := tests.new_user('terminal-' || gen_random_uuid() || '@terminals.addegas.invalid', 'terminal');
begin
  insert into app.terminals (store_id, name, auth_user_id) values (p_store, 'Balcão teste', v_user) returning id into v_term;
  return v_user;
end $$;

create or replace function tests.set_pin(p_member uuid, p_pin text) returns void language sql as $$
  insert into private.member_pins (member_id, pin_hash) values (p_member, extensions.crypt(p_pin, extensions.gen_salt('bf', 4)))
  on conflict (member_id) do update set pin_hash = excluded.pin_hash;
$$;

create or replace function tests.member_id(p_store uuid, p_user uuid) returns uuid language sql as $$
  select id from app.store_members where store_id = p_store and user_id = p_user;
$$;

grant execute on all functions in schema tests to authenticated, service_role;

begin;
select plan(1);
select has_function('tests', 'new_store_owner', 'helpers de teste carregados');
select * from finish();
rollback;
