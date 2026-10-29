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

## Padrão de RPC
- RPCs que o app chama ficam no schema `app`, são `security definer` com `set search_path = ''`, conferem `auth.uid()` e a permissão (`private.can`) logo no começo, e têm `grant execute ... to authenticated` explícito.
- Resposta sempre em `jsonb`: sucesso `{"ok": true, "data": {...}}` (`private.ok`), recusa previsível `{"ok": false, "error": {"code": "...", "detail": "..."}}` (`private.err`).
- **Toda recusa previsível (permissão, validação, caixa fechado) acontece antes de qualquer escrita** e devolve `private.err`, nunca exceção. Motivo: uma exceção desfaz a transação inteira, inclusive o registro da negação na auditoria (`private.audit_store(..., p_outcome => 'denied')`).
- Depois que a RPC começou a gravar, falha vira exceção (`private.fail`), e o Postgres desfaz tudo.
- Toda RPC que muda dado grava `private.audit_store` na mesma transação.

## Logs e auditoria
- `private.log(source, level, message, code, context)`: grava em `audit.system_logs` com o `correlation_id` da requisição, e-mails mascarados e chaves sensíveis (senha, token, PIN, cartão) removidas.
- `audit.store_actions` e `audit.admin_actions` aceitam só inserção; um trigger barra update e delete até do dono do schema. A anonimização da LGPD (E51) liga `addegas.audit_maintenance` dentro da própria rotina.
- As tabelas são particionadas por mês (`private.ensure_month_partitions`); a rotina diária da E46 cria as partições futuras.

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
O catálogo vive em **`src/lib/erros.ts`**: cada código com a mensagem em português que a tela mostra (`mensagem(code)`), agrupado por área. Formato do código: `ÁREA_MOTIVO`.

`npm run check:erros` lê as migrations e as Edge Functions e **falha se algum código não tiver mensagem**; roda no CI antes do build. Ao criar um código novo, acrescente a mensagem no mesmo commit.

Os mais comuns na operação:

| Código | Quando acontece |
| --- | --- |
| `ACCESS_SUSPENDED` | assinatura suspensa; só bloqueia permissões marcadas com `blocked_when_suspended` (D11) |
| `TERMINAL_REQUIRED` | o aparelho não é um caixa registrado ou foi revogado |
| `OPERATOR_PIN_LOCKED` / `TERMINAL_PIN_LOCKED` | 5 PINs errados em 15 min no operador, ou 20 em 1 h no aparelho |
| `SALE_CASH_CLOSED` | venda sem caixa aberto no aparelho |
| `SALE_DISCOUNT_FORBIDDEN` | desconto acima do limite do perfil; a tela pede a autorização (override) |
| `SALE_STOCK_INSUFFICIENT` | a loja bloqueia venda sem estoque |
| `SALE_FIADO_LIMIT` / `FIADO_NAME_PHONE_REQUIRED` | fiado acima do limite, ou sem nome e telefone (D19, D55) |
| `CASH_OPEN_TABS` | fechar o último caixa da loja com mesa ou comanda aberta |
| `PLAN_LIMIT_STORES` | criar loja além das cobertas pela assinatura (D02, D03) |
| `MFA_REQUIRED` | painel Addegas sem o segundo fator confirmado |

## Edge Functions
Ficam em `functions/`, com o código comum em `functions/_shared/`:

| Função | O que faz | JWT |
| --- | --- | --- |
| `health` | responde se a função e o banco estão de pé (monitoramento, E52) | não |
| `logs` | recebe erros do front e relatórios de CSP (`/api/logs`) | não |
| `members` | cria pessoa da equipe com login, redefine senha provisória, desativa (D20) | sim |
| `terminals` | registra o aparelho com o código de 6 dígitos e revoga | não¹ |
| `billing` | checkout, portal e lojas adicionais no Stripe (D01–D03) | sim |
| `admin` | ações do painel interno que precisam de Auth Admin (convite da equipe) | sim + MFA |
| `hooks-stripe` | webhook do Stripe: confere a assinatura e põe na fila (`webhook_inbox`) | não² |
| `hooks-wapi` | webhook da W-API: status de entrega e "SAIR" | não² |
| `cron` | rotinas chamadas pelo `pg_cron`: cobrança, fila de webhooks, envio de mensagens | não³ |
| `leads` | formulário da landing, com Turnstile | não |
| `uploads` | URL assinada de envio e conferência do arquivo pelo conteúdo | sim |

¹ o aparelho ainda não tem login; o código de registro é a credencial. ² valida a assinatura do parceiro. ³ exige `CRON_SECRET`.

As funções falam com o `private.*` por conexão direta ao Postgres (`_shared/supabase.ts`, `priv()`/`privRows()`), dentro de uma transação que antes grava `request.jwt.claims` e `request.headers`; assim `auth.uid()`, a auditoria e o `correlation_id` funcionam como numa RPC. Objetos vão crus para o driver, nunca com `JSON.stringify`.

Variáveis: `functions/.env.example` lista todas. Local, copie para `functions/.env` (fora do git). A CLI ignora nomes que começam com `SUPABASE_`, por isso o endereço público é `PUBLIC_API_URL`. Com `EMAIL_ENABLED=false` e `WHATSAPP_ENABLED=false`, nada sai: o envio só vai para o log.

```bash
npm run functions:serve     # sobe as funções em http://127.0.0.1:57321/functions/v1/<nome>
```

Na nuvem, as rotinas que chamam funções são agendadas por `cron/agendar-funcoes.sql`, que lê a URL e o `CRON_SECRET` do Vault (ver o runbook da E52 em `planejamento/`).

## Testes
| Comando | O que prova |
| --- | --- |
| `npm run db:test` | testes pgTAP de `tests/database/`, em ordem: `000_helpers` cria o schema `tests` (usuários, lojas, aparelhos, PINs) e `900_guardas` roda por último |
| `bash tests/concorrencia/venda-paralela.sh [n]` | dois aparelhos vendendo o mesmo produto ao mesmo tempo (`n` vendas cada, padrão 300): sem deadlock, sem número de venda repetido, estoque = inicial − vendido. Deixa dados: rode `db:reset` depois |
| `bash tests/funcoes/fluxo.sh` | ponta a ponta pelas Edge Functions (precisa do `functions:serve`): saúde e logs, cadastro, login criado pelo dono, registro e revogação do aparelho, PIN, admin com 2FA, webhook do Stripe, cron, fila de mensagens, lead e upload |
| `npm run db:lint` e `npx supabase db advisors --local` | erros em funções, segurança e desempenho |

## Onde fica cada coisa
```
supabase/
  config.toml          configuração local (portas, Auth, Storage)
  migrations/          uma por mudança, em ordem de timestamp
  seed.sql             dados de exemplo locais (os do index.html)
  tests/database/      testes pgTAP
  tests/concorrencia/  carga de vendas em paralelo
  tests/funcoes/       fluxo ponta a ponta pelas Edge Functions
  functions/           Edge Functions; _shared/ com código comum
  cron/                agendamento das rotinas que chamam funções (roda uma vez por projeto na nuvem)
  _referencia/         rascunho antigo da fase 2, só para consulta (não é aplicado)
```
