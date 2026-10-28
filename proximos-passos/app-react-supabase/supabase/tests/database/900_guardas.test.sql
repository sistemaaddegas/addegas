-- Guardas que valem para TODA migration (E03). Rodam por último.
-- Se um destes falhar, a migration nova esqueceu uma regra de segurança ou de desempenho.
begin;
select plan(8);

-- Exceções conscientes, documentadas na entrega que as criou.
create temp table guarda_excecoes (tipo text, nome text);
insert into guarda_excecoes values
  ('anon_exec', 'app.public_catalog');  -- E31/D38: vitrine pública da loja, sem custo nem saldo exato

select is_empty(
  $$ select n.nspname || '.' || c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'app' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'toda tabela do app tem RLS ligada'
);

select is_empty(
  $$ select n.nspname || '.' || c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('platform', 'support', 'analytics', 'audit', 'private')
       and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'toda tabela dos schemas internos tem RLS ligada (defesa extra; service_role ignora RLS)'
);

select is_empty(
  $$ select n.nspname || '.' || c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'app' and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
       and n.nspname || '.' || c.relname not in (select nome from guarda_excecoes where tipo = 'anon_select') $$,
  'nenhuma tabela ou view do app aberta para anon (fora as exceções)'
);

select is_empty(
  $$ select n.nspname || '.' || c.relname || ' -> ' || r
     from pg_class c join pg_namespace n on n.oid = c.relnamespace,
          unnest(array['anon', 'authenticated']) as r
     where n.nspname in ('platform', 'support', 'analytics', 'audit', 'private')
       and c.relkind in ('r', 'p', 'v', 'm')
       and has_table_privilege(r, c.oid, 'SELECT, INSERT, UPDATE, DELETE') $$,
  'nenhuma tabela dos schemas internos acessível por anon ou authenticated'
);

select is_empty(
  $$ select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app', 'private', 'platform', 'support', 'analytics', 'audit')
       and has_function_privilege('anon', p.oid, 'EXECUTE')
       and n.nspname || '.' || p.proname not in (select nome from guarda_excecoes where tipo = 'anon_exec') $$,
  'nenhuma função nossa executável por anon (fora as exceções)'
);

select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('platform', 'support', 'analytics', 'audit')
       and has_function_privilege('authenticated', p.oid, 'EXECUTE') $$,
  'funções de platform, support, analytics e audit não são executáveis por authenticated'
);

select is_empty(
  $$ select n.nspname || '.' || p.proname
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('app', 'private', 'platform', 'support', 'analytics', 'audit')
       and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%') $$,
  'toda função security definer fixa o search_path'
);

-- Toda chave estrangeira tem um índice que começa pelas mesmas colunas.
select is_empty(
  $$ select con.conrelid::regclass::text || ' (' || con.conname || ')'
     from pg_constraint con join pg_namespace n on n.oid = con.connamespace
     where con.contype = 'f'
       and n.nspname in ('app', 'platform', 'support', 'analytics', 'audit')
       and not exists (
         select 1 from pg_index i
         where i.indrelid = con.conrelid
           and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] @> con.conkey
           and (i.indkey::int2[])[0:array_length(con.conkey, 1) - 1] <@ con.conkey
       ) $$,
  'toda chave estrangeira tem índice'
);

select * from finish();
rollback;
