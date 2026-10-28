# Back-end do Addegas (Supabase)

Banco, regras de acesso, funções e testes do sistema da adega e do painel interno. O plano completo está em `planejamento/` na raiz do repositório; cada mudança aqui pertence a uma entrega (`E01`, `E03`...).

## Pré-requisitos
- Node 20.19 ou mais novo.
- **Docker Desktop aberto** (o Supabase local roda em containers).
- `npm install` nesta pasta (instala a CLI do Supabase como dependência, com versão fixa).

## Fluxo do dia a dia
```bash
npm run db:start      # sobe Postgres, Auth, Storage, Realtime e Studio locais
npm run db:reset      # recria o banco: aplica todas as migrations e o seed.sql
npm run db:test       # roda os testes pgTAP de supabase/tests/database
npm run db:lint       # procura erros nas funções e no schema
npm run db:types      # gera src/types/database.ts a partir do banco local
npm run db:stop       # desliga os containers
```
Endereços locais depois do `db:start`:
- API: http://127.0.0.1:57321
- Studio: http://127.0.0.1:57323
- Mailpit (e-mails de confirmação e senha): http://127.0.0.1:57324
- Postgres: `postgresql://postgres:postgres@127.0.0.1:57322/postgres`

As portas são as **573xx** de propósito: as 543xx são do `lava-facil`, as 553xx do `nexum-pro`, e o Windows reserva a faixa 56245–56444 (`netsh int ipv4 show excludedportrange protocol=tcp`). Assim os três projetos rodam ao mesmo tempo.

O `db:start` imprime as chaves locais; copie a URL e a chave `anon` (ou a `PUBLISHABLE_KEY`) para o `.env.local` do app. São chaves de demonstração do ambiente local, iguais para todo mundo; nunca use as do projeto na nuvem aqui.

## Criar uma mudança no banco
1. `npx supabase migration new <assunto>` cria `supabase/migrations/<timestamp>_<assunto>.sql`.
2. Escreva o SQL seguindo as convenções abaixo.
3. Escreva o teste em `supabase/tests/database/<assunto>.test.sql`.
4. `npm run db:reset && npm run db:test && npm run db:lint`.
5. `npm run db:types` e commit junto (migration, teste e tipos).

Nunca altere uma migration que já foi aplicada no `addegas-dev` ou no `addegas-prd`: crie outra. Nunca mude o banco pelo painel do Supabase.

## Convenções (valem para toda migration)
- **Schemas:** `app` (exposto na API), `platform`, `support`, `analytics`, `audit` e `private` (não expostos). Criados na E03.
- **RLS** ligada e **grant explícito** em toda tabela nova do `app`; nada para `anon`, a não ser a view pública do catálogo.
- **Dinheiro** em centavos (`bigint`); **quantidade** em `numeric(12,3)`; **datas** em `timestamptz`.
- Toda tabela filha referencia o pai por chave composta com `store_id` ou `account_id`, para nenhum dado de uma loja se ligar a outra.
- Funções `security definer` só no schema `private`, com `set search_path = ''`, e sem `execute` para `public`, `anon` e `authenticated`.
- Nomes no banco em inglês; mensagens para o usuário em português, no front.
- Erros com código estável, que o front traduz: `raise exception using errcode = 'P0001', message = 'SALE_CASH_CLOSED'`.

## Guardas automáticas
`tests/database/900_guardas.test.sql` roda por último e falha se qualquer migration:
- criar tabela sem RLS (no `app` e nos schemas internos);
- abrir tabela ou view do `app` para `anon` (exceções ficam listadas no próprio arquivo, com a entrega que as justifica);
- deixar tabela interna acessível a `anon`/`authenticated`;
- deixar função nossa executável por `anon`, ou função de `platform`/`support`/`analytics`/`audit` executável por `authenticated`;
- criar função `security definer` sem `search_path` fixo;
- criar chave estrangeira sem índice.

Helpers do `private` usados dentro de políticas de RLS precisam de `grant execute ... to authenticated`: o Postgres confere a permissão com o papel de quem consulta (provado em `001_esqueleto.test.sql`). Isso é seguro porque o `private` não é exposto pela API.

## Catálogo de códigos de erro
Cada entrega acrescenta os seus. Formato: `ÁREA_MOTIVO`.

| Código | Entrega | Quando acontece |
| --- | --- | --- |
| _(vazio até a E03)_ | | |

## Onde fica cada coisa
```
supabase/
  config.toml          configuração local (portas, Auth, Storage)
  migrations/          uma por mudança, em ordem de timestamp
  seed.sql             dados de exemplo locais (os do index.html)
  tests/database/      testes pgTAP
  functions/           Edge Functions (a partir da E04); _shared/ com código comum
  _referencia/         rascunho antigo da fase 2, só para consulta (não é aplicado)
```
