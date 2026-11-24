-- E03 · Esqueleto do banco: schemas, permissões padrão, tipos e helpers.
-- Toda migration seguinte herda estas regras. Ver planejamento/entregas/E03-esqueleto-do-banco.md.

-- Extensões usadas desde o começo. pg_cron, pg_net e pgmq entram nas entregas que precisam delas.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Schemas -------------------------------------------------------------------
-- app: exposto na API de dados (RLS em toda tabela).
-- platform, support, analytics, audit: só funções e service_role.
-- private: helpers security definer, nunca expostos.
create schema if not exists app;
create schema if not exists platform;
create schema if not exists support;
create schema if not exists analytics;
create schema if not exists audit;
create schema if not exists private;

revoke all on schema platform, support, analytics, audit, private from public, anon, authenticated;
grant usage on schema platform, support, analytics, audit, private to service_role;

revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- Padrões para objetos criados pelo dono das migrations (postgres):
-- nenhuma função nasce executável por public/anon; nenhuma tabela do app nasce aberta.
alter default privileges in schema app revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema platform revoke execute on functions from public;
alter default privileges in schema support revoke execute on functions from public;
alter default privileges in schema analytics revoke execute on functions from public;
alter default privileges in schema audit revoke execute on functions from public;

-- service_role (funções do servidor) enxerga os schemas internos.
alter default privileges in schema platform grant all on tables to service_role;
alter default privileges in schema support grant all on tables to service_role;
alter default privileges in schema analytics grant all on tables to service_role;
alter default privileges in schema audit grant select, insert on tables to service_role;
alter default privileges in schema platform grant usage, select on sequences to service_role;
alter default privileges in schema support grant usage, select on sequences to service_role;
alter default privileges in schema analytics grant usage, select on sequences to service_role;
alter default privileges in schema audit grant usage, select on sequences to service_role;

-- Tipos -----------------------------------------------------------------------
-- Dinheiro sempre em centavos; quantidade com 3 casas (D09: dose, ml, kg no futuro).
create domain app.cents as bigint check (value >= 0);
create domain app.signed_cents as bigint;
create domain app.qty as numeric(12, 3);

-- Helpers -------------------------------------------------------------------
-- Atualiza updated_at em toda tabela que tiver a coluna.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Tipo do usuário logado, gravado só pelo servidor em app_metadata (nunca user_metadata, §9):
-- 'person' (dono e equipe da loja), 'terminal' (aparelho do caixa) ou 'staff' (equipe Addegas).
create or replace function private.current_user_kind()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif((select auth.jwt()) -> 'app_metadata' ->> 'kind', '');
$$;

-- ID de correlação enviado pelo front em x-correlation-id (E05). Nulo fora de requisições HTTP.
create or replace function private.correlation_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-correlation-id',
    ''
  );
$$;

-- Erro com código estável para o front traduzir (catálogo em supabase/README.md).
create or replace function private.fail(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end;
$$;

-- Regra de execução dos helpers:
-- - public e anon nunca executam nada do schema private;
-- - authenticated executa só o que as políticas de RLS e as RPCs security invoker usam,
--   porque o Postgres confere EXECUTE com o papel de quem consulta. Isso é seguro porque o
--   schema private não é exposto pela API: ninguém chama esses helpers por /rest/v1/rpc.
revoke execute on function private.touch_updated_at() from public, anon, authenticated;
revoke execute on function private.current_user_kind() from public, anon;
revoke execute on function private.correlation_id() from public, anon;
revoke execute on function private.fail(text, text) from public, anon;
grant execute on function private.current_user_kind() to authenticated, service_role;
grant execute on function private.correlation_id() to authenticated, service_role;
grant execute on function private.fail(text, text) to authenticated, service_role;
