-- E03 · esqueleto: schemas, permissões, tipos e helpers.
begin;
select plan(19);

-- Schemas
select has_schema(s, 'schema ' || s || ' existe')
from unnest(array['app', 'platform', 'support', 'analytics', 'audit', 'private']) as s;

-- Quem enxerga o quê
select ok(has_schema_privilege('authenticated', 'app', 'USAGE'), 'authenticated usa o schema app');
select ok(has_schema_privilege('anon', 'app', 'USAGE'), 'anon usa o schema app (sem tabelas liberadas)');
select ok(
  not exists (
    select 1
    from unnest(array['platform', 'support', 'analytics', 'audit', 'private']) as s,
         unnest(array['anon', 'authenticated']) as r
    where has_schema_privilege(r, s, 'USAGE')
  ),
  'anon e authenticated não usam platform, support, analytics, audit nem private'
);
select ok(has_schema_privilege('service_role', 'platform', 'USAGE'), 'service_role usa platform');

-- Tipos
select throws_ok($$ select (-1)::app.cents $$, '23514', null, 'app.cents recusa valor negativo');
select is((-150)::app.signed_cents::bigint, -150::bigint, 'app.signed_cents aceita negativo');
select is((1.2345)::app.qty::numeric, 1.235::numeric, 'app.qty arredonda para 3 casas');

-- Helpers
select is(private.current_user_kind(), null, 'sem JWT, o tipo do usuário é nulo');
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"kind":"terminal"},"user_metadata":{"kind":"staff"}}', true); end $$;
select is(private.current_user_kind(), 'terminal', 'o tipo vem de app_metadata, nunca de user_metadata');
do $$ begin perform set_config('request.headers', '{"x-correlation-id":"0192f0c0-aaaa-7bbb-8ccc-000000000001"}', true); end $$;
select is(private.correlation_id(), '0192f0c0-aaaa-7bbb-8ccc-000000000001', 'correlation_id lido do header');
select throws_ok($$ select private.fail('SALE_CASH_CLOSED', 'teste') $$, 'P0001', 'SALE_CASH_CLOSED', 'fail() levanta o código estável');

-- Prova de que um helper do private funciona dentro da RLS para authenticated
-- (o Postgres confere EXECUTE com o papel de quem consulta).
create table app._prova_rls (id int primary key, kind text not null);
alter table app._prova_rls enable row level security;
create policy so_do_meu_tipo on app._prova_rls for select to authenticated
  using (kind = (select private.current_user_kind()));
grant select on app._prova_rls to authenticated;
insert into app._prova_rls values (1, 'terminal'), (2, 'person');
set local role authenticated;
select is((select count(*)::int from app._prova_rls), 1, 'RLS com helper do private filtra para authenticated');
reset role;

-- anon não executa nada do private
set local role anon;
select throws_ok($$ select private.current_user_kind() $$, '42501', null, 'anon não executa helper do private');
reset role;

select * from finish();
rollback;
