# Addegas · Runbook de produção (E52)

O que fazer quando algo cai ou precisa de ação manual. Vale para o `addegas-prd`; no `addegas-dev` os passos são os mesmos.
Precisa ser revisado por alguém que não escreveu o código antes do piloto (critério da E52).

Os caminhos citados ficam em `proximos-passos/app-react-supabase/`.

## Antes de tudo: onde olhar
| O quê | Onde |
| --- | --- |
| O sistema está de pé? | `GET https://app.addegas.com.br/api/health` responde `{"ok": true}` com o banco conferido |
| Erros do app e das funções | tabela `audit.system_logs` (filtre por `correlation_id`, que o usuário vê na tela de erro) |
| Rotinas agendadas | `select * from cron.job_run_details order by start_time desc limit 50;` e `platform.job_runs` |
| Fila do Stripe | `select status, count(*) from platform.webhook_inbox group by 1;` |
| Fila de e-mail e WhatsApp | `select status, count(*) from platform.outbox group by 1;` |
| Situação do Supabase, da Vercel e do Stripe | status.supabase.com · vercel-status.com · status.stripe.com |

## Incidentes

### Supabase fora do ar (banco ou API)
1. Confirme em status.supabase.com e no `/api/health`.
2. Os caixas continuam vendendo: o PWA abre em **modo contingência** (D14), guarda as vendas no aparelho (IndexedDB) e envia quando a conexão volta. Não peça para ninguém limpar o navegador nem reinstalar o app: isso apaga a fila.
3. Avise as adegas pelo WhatsApp da equipe se passar de 15 minutos.
4. Quando voltar, confira em `audit.system_logs` se as vendas da contingência subiram sem erro (`code` começando com `SALE_`).

### Vercel fora do ar
O app instalado (PWA) abre pela casca guardada no aparelho, mas as chamadas a `/api/*` passam pela Vercel e falham. O caixa entra em contingência como acima. Nada a fazer além de acompanhar o status.

### Stripe fora do ar ou webhooks atrasados
- Nenhuma adega é suspensa por isso: a rotina das 9h (`addegas-cobranca-9h`) reconfere no Stripe antes de suspender e não suspende o que não conseguiu conferir.
- Eventos que falharam 8 vezes ficam `dead`. Para reprocessar depois que o Stripe voltar:
  ```sql
  update platform.webhook_inbox set status = 'pending', attempts = 0, next_attempt_at = now()
  where provider = 'stripe' and status = 'dead';
  ```
  A rotina `addegas-webhooks` pega de novo no minuto seguinte. É seguro: o processamento é idempotente pelo `event_id`.

### WhatsApp (W-API) ou e-mail (Resend) fora do ar
As mensagens ficam na `platform.outbox` e são tentadas de novo com intervalo crescente; depois de 5 tentativas viram `dead`. Antes de cada envio a condição é reconferida, então um aviso de cobrança de quem já pagou é descartado. Se a instância da W-API caiu, reconecte o número no painel da W-API (QR code). Para desligar o envio sem perder a fila: `supabase secrets set WHATSAPP_ENABLED=false` (ou `EMAIL_ENABLED=false`).

Quando o serviço voltar, reenvie o que desistiu nas últimas 24 h (mensagens mais antigas costumam ter perdido o sentido):
```sql
update platform.outbox set status = 'pending', attempts = 0, scheduled_for = now()
where status = 'dead' and created_at > now() - interval '24 hours';
```

### Rotinas paradas
Se `cron.job_run_details` não mostra execuções recentes de `addegas-webhooks` ou `addegas-mensagens`:
1. Confira os segredos no Vault (`functions_url` e `cron_secret`): `select name from vault.secrets;`.
2. Confira se o `CRON_SECRET` das funções é o mesmo do Vault.
3. Rode de novo `supabase/cron/agendar-funcoes.sql` no SQL Editor (é idempotente).

### Plano gratuito do Supabase pausado por inatividade
Não deve acontecer com adegas usando, mas pode acontecer no `addegas-dev`. Reative pelo painel do Supabase (Restore project).

## Ações manuais na conta de uma adega
Sempre pelo painel Addegas (`admin.addegas.com.br`), que exige 2FA, pede motivo e grava em `audit.admin_actions`. Nunca direto no banco.

| Situação | Ação no painel | Função |
| --- | --- | --- |
| Pagou por Pix ou transferência | Financeiro → registrar pagamento manual, com comprovante | `admin_manual_payment` |
| Precisa vender hoje, pagamento a caminho | Adega → acesso temporário (1 a 7 dias) | `admin_temp_access` |
| Suspender ou reativar | Adega → acesso (`allowed` ou `suspended`) | `admin_set_access` |
| Teste acabando e quer mais tempo | Adega → estender teste (3, 7 ou 14 dias) | `admin_extend_trial` |
| Reembolso | Financeiro → reembolso (até o valor pago) | `admin_refund` |

Suspender bloqueia só as permissões marcadas como bloqueáveis (D11): a adega ainda vê os dados e consegue pagar.

## Backup e restauração
- O job **Backup diário** (`.github/workflows/backup.yml`) faz o dump de produção às 03:30, criptografa com `BACKUP_PASSPHRASE` e guarda por 30 dias como artefato privado do GitHub. No plano gratuito do Supabase esse é o único backup restaurável.
- Restaurar (num projeto novo ou no `addegas-dev`, nunca por cima de produção sem decidir antes):
  ```bash
  gpg -d backup.tgz.gpg > backup.tgz && tar xzf backup.tgz
  psql "$DB_URL_DESTINO" -f schema.sql
  psql "$DB_URL_DESTINO" -c "set session_replication_role = replica" -f data.sql
  ```
  O `session_replication_role = replica` desliga os triggers durante a carga: sem isso, os triggers de `auth.users` criariam perfis em dobro, e os de alerta e de eventos gerariam linhas novas a partir de dados antigos.
- **Teste de restauração a cada 3 meses** no `addegas-dev`, anotando aqui a data e quanto tempo levou.

| Data | Quem | Tempo | Observação |
| --- | --- | --- | --- |
| _(primeiro teste antes do piloto)_ | | | |

## Publicar uma versão
- Banco e funções: push na `main` sobe no `addegas-dev`; tag `v*` sobe no `addegas-prd` com aprovação manual (`.github/workflows/banco.yml`).
- Front: a Vercel publica sozinha. A atualização do PWA não derruba o caixa: o app espera o carrinho esvaziar para trocar de versão (E54).
- Voltar uma versão do front: Vercel → Deployments → Promote na anterior. Migration não se desfaz: corrija com uma nova.

## Segurança antes da primeira versão (auditoria de 17/11/2026)
O código já está corrigido (migration `20261117120000_seguranca_pre_lancamento.sql`, Edge Functions, `vercel.json` e `vercel.ts`; teste `018_seguranca.test.sql`). Falta o que depende de acesso ao painel ou de decisão:
1. ✅ **Nuvem `addegas` (23/11/2026):** as três migrations de segurança (20261117120000, 20261117130000 e 20261117140000) foram aplicadas e as 11 funções publicadas; `/functions/v1/health` responde `ok`.
1b. **Data API da nuvem** (Project Settings → Data API): a nuvem expunha só `public` e `graphql_public`, e o app chama tudo no schema `app` (`Invalid schema: app`). Deixar igual ao `config.toml`: Exposed schemas `app` e `graphql_public` (tirar `public`), Extra search path `public, extensions` e Max rows `1000`. Sem isso o app publicado não fala com o banco.
2. **Auth da nuvem** (Authentication → Sign In / Providers e Bot protection): senha mínima 8 com `letters_digits`, "Secure password change" ligado e captcha Turnstile no cadastro, login e recuperação. Hoje a nuvem aceita senha de 6 caracteres e não tem captcha.
3. **Turnstile:** criar a chave e gravar `TURNSTILE_SECRET` nos segredos das funções. Sem ela, o `/api/leads` recusa todo formulário em produção, o que é seguro mas derruba a landing.
4. **CSP do app:** está em report-only (`CSP_ENFORCE` diferente de `true`). Passados 7 dias sem violação inesperada em `/api/logs` (código `CSP_VIOLATION`), definir `CSP_ENFORCE=true` na Vercel. Até lá, a CSP não bloqueia nada.
5. **`pg_net`:** depois do push (23/11), `anon` e `authenticated` ainda têm `execute` em `net.http_post`, porque nessa nuvem o dono das funções é o `supabase_admin`. O schema `net` não é exposto (`PGRST106`), então nenhuma rota da API chega nelas. O único aviso do advisor é `pg_net` no schema `public`, que é o padrão do Supabase. Risco aceito, a não ser que alguém exponha o `net` na Data API.
6. **Decisões conscientes que ficam registradas:** caixa sem PIN (quem está no aparelho entra como qualquer operador, inclusive o dono; ver `planejamento/duvidas.md`); `/admin` do site estático é uma demonstração com dados fictícios e acesso público.

## Contatos
| Assunto | Quem | Como |
| --- | --- | --- |
| Responsável técnico | _(preencher)_ | |
| Suporte Supabase | painel → Support | só e-mail no plano gratuito |
| Stripe | dashboard.stripe.com → Ajuda | |
| W-API | _(preencher o canal do suporte contratado)_ | |
| Registro.br (DNS) | registro.br | |
