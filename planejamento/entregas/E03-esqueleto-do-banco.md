# E03 · Esqueleto do banco: schemas, permissões padrão e convenções

**Marco:** M1 · Fundação | **Tamanho:** M | **Depende de:** E01, E02 | **Desbloqueia:** todas as entregas com tabela
**Origem:** §5 ("cinco schemas", "regras que valem para o banco inteiro"), §9 (itens críticos)

## Objetivo
Criar a estrutura vazia e as regras que toda migration seguinte herda, para que segurança não dependa de cada pessoa lembrar.

## Entra
- Schemas: `app` (exposto na API de dados), `platform`, `support`, `analytics`, `audit` (não expostos) e **`private`** (helpers `security definer`, não exposto; exigência da §9).
- Configuração da API de dados: expor só `app` (e `graphql_public` se usado); tirar `public` da lista.
- Permissões padrão:
  - `revoke all on schema platform, support, analytics, audit, private from anon, authenticated;`
  - `alter default privileges in schema private revoke execute on functions from public;` (e de `anon`, `authenticated`);
  - `alter default privileges in schema app revoke all on tables from anon;`
- Extensões: `pgcrypto`, `pg_cron`, `pg_net`, `pgmq` (ou decisão por `for update skip locked`), `pgtap` (só para testes), `citext` (e-mail).
- Tipos e convenções:
  - dinheiro: domínio `app.cents` = `bigint check (value >= 0)` e `app.signed_cents` para lançamentos;
  - quantidade: `numeric(12,3)` (D09, decidido), para comportar dose, ml e kg no futuro;
  - ids `uuid` com `gen_random_uuid()`; colunas `created_at`, `created_by`, `updated_at`;
  - trigger genérico `private.touch_updated_at()`.
- Modelo de chave composta para isolamento: toda tabela filha referencia o pai por `(parent_id, store_id)`, e o pai tem `unique (id, store_id)`. Assim é impossível ligar um item da loja A a uma venda da loja B, mesmo que alguém escreva direto na tabela. Para o que pertence à **conta** (produtos, categorias, combos, D37), a mesma regra vale com `(id, account_id)`, e a loja tem `unique (id, account_id)`.
- Padrão de erro: `raise exception using errcode = 'P0001', message = 'SALE_CASH_CLOSED', detail = ...`, com catálogo de códigos em `supabase/README.md`.
- Template de migration de tabela do `app` (enable RLS + grant explícito + políticas + índices em FK), para copiar.

## Não entra
- Tabelas de negócio. Elas nascem em cada entrega.

## Dados e funções
- `private.current_user_kind()` lê `auth.jwt() -> 'app_metadata' ->> 'kind'` (`person`, `terminal`, `staff`). **Nunca** `user_metadata` (§9).

## Critérios de aceite
- Teste pgTAP: `anon` não consegue `select` em nenhum schema (a única exceção futura é a view pública do catálogo, E31, com teste próprio); `authenticated` não enxerga `platform`, `audit` nem `private`.
- Teste pgTAP: chamar uma função de `private` via `/rest/v1/rpc` retorna erro de permissão.
- `supabase db advisors` sem alerta.

## Riscos e atenção
- A afirmação "desde 30/05/2026 o Supabase não expõe tabela nova sozinho" precisa ser conferida no changelog. Com ou sem ela, o grant explícito fica.
- Quantidade: decidido `numeric(12,3)` desde o início (D09); trocar depois afetaria estoque, venda, receitas e relatórios.
