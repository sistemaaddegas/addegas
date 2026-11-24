-- E06, E08, E12, E32 e base da E33.
begin;
select plan(35);

-- Helpers do teste ------------------------------------------------------------
create function pg_temp.new_user(p_email text, p_kind text default null, p_confirmed boolean default true)
returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email, '',
    case when p_confirmed then now() end,
    case when p_kind is null then '{}'::jsonb else jsonb_build_object('kind', p_kind) end,
    '{"full_name":"Pessoa Teste"}'::jsonb, now(), now());
  return v;
end $$;

-- Entra como o usuário: claims do JWT + papel authenticated (chame `reset role` antes).
create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user, 'role', 'authenticated',
    'app_metadata', (select raw_app_meta_data from auth.users where id = p_user))::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- Permissão calculada, vista pela RPC pública (authenticated não acessa o schema private).
create function pg_temp.pode(p_store text, p_perm text) returns boolean language sql as $$
  select coalesce(app.my_permissions((select v from ids where k = p_store)) -> 'data' -> 'permissions' ? p_perm, false);
$$;


-- Usuários ----------------------------------------------------------------------
insert into ids values ('marcos', pg_temp.new_user('marcos@adegaesquina.com.br'));
insert into ids values ('bia', pg_temp.new_user('bia@outra.com.br'));
insert into ids values ('caio', pg_temp.new_user('caio@adegaesquina.com.br'));
insert into ids values ('gerente', pg_temp.new_user('gerente@adegaesquina.com.br'));
insert into ids values ('naoconf', pg_temp.new_user('naoconfirmado@x.com', null, false));
insert into ids values ('staff', pg_temp.new_user('lia@addegas.com.br', 'staff'));

select is((select raw_app_meta_data ->> 'kind' from auth.users where id = (select v from ids where k = 'marcos')),
  'person', 'cadastro público vira kind person');
select is((select raw_app_meta_data ->> 'kind' from auth.users where id = (select v from ids where k = 'staff')),
  'staff', 'kind definido pelo servidor é mantido');
select ok(exists (select 1 from app.profiles where id = (select v from ids where k = 'marcos')), 'perfil criado para pessoa');
select ok(not exists (select 1 from app.profiles where id = (select v from ids where k = 'staff')), 'equipe Addegas não ganha perfil de adega');

-- Onboarding --------------------------------------------------------------------
select pg_temp.act_as((select v from ids where k = 'naoconf'));
select is(app.complete_onboarding('Adega X') -> 'error' ->> 'code', 'EMAIL_NOT_CONFIRMED', 'sem e-mail confirmado, não conclui o cadastro');
reset role;

select pg_temp.act_as((select v from ids where k = 'staff'));
select is(app.complete_onboarding('Adega Y') -> 'error' ->> 'code', 'ONBOARDING_NOT_ALLOWED', 'conta da equipe Addegas não cria adega');
reset role;

select pg_temp.act_as((select v from ids where k = 'marcos'));
create temp table r1 as select app.complete_onboarding('Adega Esquina', 'Vila Madalena', 'São Paulo', '11999990000', 'Marcos Silva') as res;
select is((select res ->> 'ok' from r1), 'true', 'onboarding concluído');
select is((select res -> 'data' ->> 'created' from r1), 'true', 'conta e loja criadas');
select is(app.complete_onboarding('Adega Esquina') -> 'data' ->> 'account_id', (select res -> 'data' ->> 'account_id' from r1),
  'chamar de novo devolve a mesma conta (idempotente)');
reset role;

insert into ids values ('acc', (select (res -> 'data' ->> 'account_id')::uuid from r1));
insert into ids values ('loja1', (select (res -> 'data' ->> 'store_id')::uuid from r1));

select is((select slug::text from app.stores where id = (select v from ids where k = 'loja1')), 'adega-esquina', 'slug gerado sem acento');
select is((select count(*)::int from app.role_permissions where store_id = (select v from ids where k = 'loja1')), 95,
  'matriz padrão copiada (19 permissões x 5 papéis)');
select is((select row(status, access)::text from platform.subscriptions where account_id = (select v from ids where k = 'acc')),
  row('trial'::platform.subscription_status, 'allowed'::platform.access_state)::text, 'assinatura nasce em teste e liberada');
select ok((select trial_ends_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 hour'
  from platform.subscriptions where account_id = (select v from ids where k = 'acc')), 'teste de 14 dias');
select is((select count(*)::int from audit.store_actions where action = 'account.onboarding'), 1, 'onboarding auditado');

-- Bia cria a conta dela
select pg_temp.act_as((select v from ids where k = 'bia'));
create temp table r2 as select app.complete_onboarding('Adega Esquina', 'Penha') as res;
reset role;
insert into ids values ('loja_bia', (select (res -> 'data' ->> 'store_id')::uuid from r2));
insert into ids values ('acc_bia', (select (res -> 'data' ->> 'account_id')::uuid from r2));
select is((select slug::text from app.stores where id = (select v from ids where k = 'loja_bia')), 'adega-esquina-2', 'nome repetido ganha slug único');

-- Isolamento ----------------------------------------------------------------------
select pg_temp.act_as((select v from ids where k = 'marcos'));
select is((select count(*)::int from app.stores), 1, 'Marcos vê só a loja dele');
select is((select count(*)::int from app.store_members), 1, 'Marcos vê só os membros da loja dele');
select throws_ok($$ insert into app.stores (account_id, name, slug) values ((select v from ids where k = 'acc'), 'Hack', 'hack') $$,
  '42501', null, 'ninguém cria loja direto pela API (só pela RPC com limite)');
select is((app.my_permissions((select v from ids where k = 'loja1')) -> 'data' -> 'permissions') ->> 18, 'equipe',
  'dono tem as 19 permissões');
reset role;

select pg_temp.act_as((select v from ids where k = 'bia'));
select is(app.my_subscription((select v from ids where k = 'acc')) -> 'error' ->> 'code', 'FORBIDDEN', 'Bia não vê a assinatura de Marcos');
select is(app.create_store((select v from ids where k = 'acc'), 'Invasão') -> 'error' ->> 'code', 'FORBIDDEN',
  'Bia não cria loja na conta de Marcos');
reset role;
select is((select count(*)::int from audit.store_actions where action = 'store.create' and outcome = 'denied'), 1,
  'tentativa negada ficou na auditoria');

-- Limite de lojas (D02) -----------------------------------------------------------
select pg_temp.act_as((select v from ids where k = 'marcos'));
select is(app.create_store((select v from ids where k = 'acc'), 'Adega Esquina 2') -> 'error' ->> 'code', 'PLAN_LIMIT_STORES',
  'plano inclui 1 loja');
reset role;
update platform.subscriptions set extra_stores = 1 where account_id = (select v from ids where k = 'acc');
select pg_temp.act_as((select v from ids where k = 'marcos'));
create temp table r3 as select app.create_store((select v from ids where k = 'acc'), 'Adega Esquina 2', 'Pinheiros') as res;
select is((select res ->> 'ok' from r3), 'true', 'com 1 loja adicional, a segunda loja é criada');
select is(app.create_store((select v from ids where k = 'acc'), 'Adega Esquina 3') -> 'error' ->> 'code', 'PLAN_LIMIT_STORES',
  'a terceira passa do limite');
reset role;
insert into ids values ('loja2', (select (res -> 'data' ->> 'store_id')::uuid from r3));

-- Papéis (D63) -----------------------------------------------------------------------
insert into app.store_members (store_id, user_id, display_name, role) values
  ((select v from ids where k = 'loja1'), (select v from ids where k = 'caio'), 'Caio', 'cashier'),
  ((select v from ids where k = 'loja1'), (select v from ids where k = 'gerente'), 'Gerente', 'manager');

select pg_temp.act_as((select v from ids where k = 'caio'));
select ok(pg_temp.pode('loja1', 'vender') and not pg_temp.pode('loja1', 'cancelar'),
  'caixa vende e não cancela');
select is((select count(*)::int from app.stores), 1, 'caixa da loja 1 não vê a loja 2 da mesma conta');
select is(app.set_role_permission((select v from ids where k = 'loja1'), 'cashier', 'cancelar', true) -> 'error' ->> 'code',
  'FORBIDDEN', 'caixa não mexe na matriz');
reset role;

select pg_temp.act_as((select v from ids where k = 'gerente'));
select ok(pg_temp.pode('loja1', 'relatorios') and not pg_temp.pode('loja1', 'ver_lucro'),
  'gerente vê relatórios, não lucro (D63)');
select is(app.my_permissions((select v from ids where k = 'loja1')) -> 'data' ->> 'max_discount_pct', '15.00', 'gerente com limite de 15%');
reset role;

select pg_temp.act_as((select v from ids where k = 'marcos'));
select is(app.set_role_permission((select v from ids where k = 'loja1'), 'cashier', 'cancelar', true) ->> 'ok', 'true', 'dono altera a matriz');
select is(app.set_role_permission((select v from ids where k = 'loja1'), 'owner', 'vender', false) -> 'error' ->> 'code',
  'OWNER_ALWAYS_ALLOWED', 'o dono não perde permissões');
reset role;
select pg_temp.act_as((select v from ids where k = 'caio'));
select ok(pg_temp.pode('loja1', 'cancelar'), 'caixa passa a poder cancelar');
reset role;

-- Suspensão e acesso temporário (§1, D27) ------------------------------------------
update platform.subscriptions set access = 'suspended' where account_id = (select v from ids where k = 'acc');
select pg_temp.act_as((select v from ids where k = 'marcos'));
select ok(not pg_temp.pode('loja1', 'vender') and pg_temp.pode('loja1', 'relatorios'),
  'suspenso: não vende, mas vê relatórios');
reset role;
update platform.subscriptions set temp_access_until = now() + interval '2 days' where account_id = (select v from ids where k = 'acc');
select pg_temp.act_as((select v from ids where k = 'marcos'));
select ok(pg_temp.pode('loja1', 'vender'), 'acesso temporário do suporte libera a operação');
reset role;

select * from finish();
rollback;
