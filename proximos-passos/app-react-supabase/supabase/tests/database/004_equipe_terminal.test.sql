-- E07 (banco), E09 e E10.
begin;
select plan(20);

create function pg_temp.new_user(p_email text, p_kind text default null)
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email, '', now(),
    case when p_kind is null then '{}'::jsonb else jsonb_build_object('kind', p_kind) end, '{}'::jsonb, now(), now());
  return v;
end $$;
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'app_metadata', (select raw_app_meta_data from auth.users where id = p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create temp table ids (k text primary key, v uuid);
create temp table txt (k text primary key, v text);
grant all on ids, txt to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;

-- Cenário: Marcos (dono), gerente com login, caixa Caio com login
insert into ids values ('marcos', pg_temp.new_user('marcos@x.com')), ('gerente', pg_temp.new_user('gerente@x.com')),
  ('caio', pg_temp.new_user('caio@x.com')), ('bia', pg_temp.new_user('bia@y.com'));
select pg_temp.act_as(pg_temp.id('marcos'));
create temp table r as select app.complete_onboarding('Adega Esquina') as res;
reset role;
insert into ids values ('loja', (select (res -> 'data' ->> 'store_id')::uuid from r));
select pg_temp.act_as(pg_temp.id('bia'));
create temp table rb as select app.complete_onboarding('Adega da Bia') as res;
reset role;
insert into ids select 'm_gerente', private.attach_login_member(pg_temp.id('marcos'), pg_temp.id('loja'), pg_temp.id('gerente'), 'Gerente', 'manager');
insert into ids select 'm_caio', private.attach_login_member(pg_temp.id('marcos'), pg_temp.id('loja'), pg_temp.id('caio'), 'Caio', 'cashier');
insert into ids select 'm_marcos', id from app.store_members where store_id = pg_temp.id('loja') and role = 'owner';

-- Equipe (E07) ------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('marcos'));
create temp table rp as select app.create_counter_member(pg_temp.id('loja'), 'Bruno', 'cashier') as res;
select is((select res ->> 'ok' from rp), 'true', 'dono cria pessoa só do caixa (sem login)');
select is(app.create_counter_member(pg_temp.id('loja'), 'Outro dono', 'owner') -> 'error' ->> 'code', 'FORBIDDEN', 'ninguém cria outro dono');
select is(app.set_role_permission(pg_temp.id('loja'), 'manager', 'equipe', true) ->> 'ok', 'true', 'dono libera Gerenciar equipe para o gerente');
reset role;
insert into ids values ('m_bruno', (select (res -> 'data' ->> 'member_id')::uuid from rp));

select pg_temp.act_as(pg_temp.id('gerente'));
select is(app.create_counter_member(pg_temp.id('loja'), 'Gerente 2', 'manager') -> 'error' ->> 'code', 'FORBIDDEN', 'gerente não cria gerente');
select is(app.create_counter_member(pg_temp.id('loja'), 'Estoque', 'stock_keeper') ->> 'ok', 'true', 'com a permissão, gerente cria estoquista');
select is(app.update_member(pg_temp.id('m_marcos'), p_active => false) -> 'error' ->> 'code', 'FORBIDDEN', 'gerente não desativa o dono (§4)');
reset role;

select pg_temp.act_as(pg_temp.id('caio'));
select is(app.create_counter_member(pg_temp.id('loja'), 'X', 'cashier') -> 'error' ->> 'code', 'FORBIDDEN', 'caixa não mexe na equipe');
select is(app.create_pairing_code(pg_temp.id('loja'), 'Balcão') -> 'error' ->> 'code', 'FORBIDDEN', 'caixa não registra terminal');
reset role;

-- Terminal (E09) ------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('gerente'));
insert into txt select 'code', app.create_pairing_code(pg_temp.id('loja'), 'Balcão 1') -> 'data' ->> 'code';
reset role;
select ok((select v from txt where k = 'code') ~ '^[0-9]{6}$', 'código de pareamento com 6 dígitos');
select is(private.redeem_pairing_code('adega-esquina', '000000x') -> 'error' ->> 'code', 'PAIRING_CODE_INVALID', 'código errado recusado');
create temp table rr as select private.redeem_pairing_code('adega-esquina', (select v from txt where k = 'code')) as res;
select is((select res ->> 'ok' from rr), 'true', 'código certo cria o terminal');
select is(private.redeem_pairing_code('adega-esquina', (select v from txt where k = 'code')) -> 'error' ->> 'code',
  'PAIRING_CODE_INVALID', 'código usado não vale de novo');
insert into ids values ('terminal', (select (res -> 'data' ->> 'terminal_id')::uuid from rr));
insert into ids values ('u_terminal', pg_temp.new_user('terminal-x@terminals.addegas.invalid', 'terminal'));
select private.bind_terminal_user(pg_temp.id('terminal'), pg_temp.id('u_terminal'));

select pg_temp.act_as(pg_temp.id('u_terminal'));
select is((select count(*)::int from app.stores), 1, 'terminal enxerga só a própria loja');
select ok((select count(*) from app.store_members) >= 4, 'terminal lista os operadores para quem vai operar');
select is((select count(*)::int from app.accounts), 0, 'terminal não lê a conta');

-- Quem vai operar (E10): toca no próprio nome --------------------------------------------------
select is(app.operator_login(gen_random_uuid()) -> 'error' ->> 'code', 'OPERATOR_INVALID', 'só quem é da loja opera o caixa');
create temp table s1 as select app.operator_login(pg_temp.id('m_bruno')) as res;
select is((select res -> 'data' ->> 'role' from s1), 'cashier', 'Bruno entra tocando no próprio nome');
reset role;
insert into ids values ('sessao_bruno', (select (res -> 'data' ->> 'operator_session_id')::uuid from s1));
-- As funções private rodam aqui como postgres, mas com o JWT do terminal ainda valendo.
select ok(private.operator_can(pg_temp.id('sessao_bruno'), 'vender') and not private.operator_can(pg_temp.id('sessao_bruno'), 'cancelar'),
  'permissões do operador = as do papel dele (caixa vende, não cancela)');

-- Revogação ----------------------------------------------------------------------------
select pg_temp.act_as(pg_temp.id('gerente'));
select is(app.revoke_terminal(pg_temp.id('terminal')) ->> 'ok', 'true', 'gerente revoga o terminal');
reset role;
select pg_temp.act_as(pg_temp.id('u_terminal'));
select is(app.operator_login(pg_temp.id('m_bruno')) -> 'error' ->> 'code', 'TERMINAL_REQUIRED',
  'terminal revogado é recusado na hora, mesmo com o token ainda válido');
reset role;

select * from finish();
rollback;
