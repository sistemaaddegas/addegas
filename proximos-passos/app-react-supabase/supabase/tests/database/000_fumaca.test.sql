-- Teste de fumaça: o banco local sobe, as migrations rodam e o pgTAP funciona.
-- As entregas seguintes acrescentam um arquivo por assunto (rls_*.test.sql, rpc_*.test.sql).
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select ok(true, 'pgTAP carregado');
select has_schema('auth', 'schema auth do Supabase existe');
select is(
  current_setting('server_version_num')::int >= 170000,
  true,
  'Postgres 17 ou mais novo (o mesmo do projeto na nuvem)'
);

select * from finish();
rollback;
