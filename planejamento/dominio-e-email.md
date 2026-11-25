# Domínio, subdomínios e e-mail

> **25/11/2026:** o envio ficou na **raiz** `addegas.com.br` (foi o domínio verificado no Resend), não em `mail.addegas.com.br`. Remetente: `naoresponda@addegas.com.br`. Os registros são `resend._domainkey` (DKIM), `send` (MX e SPF do retorno) e `_dmarc` (`p=none`). O que está abaixo sobre `mail.` é o plano original. Configuração aplicada: runbook-producao.md, item 2b.

**Situação em 28/10/2026** (conferida por consulta DNS e HTTP):
- `addegas.com.br` é registrado no Registro.br, com o **DNS no próprio Registro.br** (servidores `a.sec.dns.br` e `c.sec.dns.br`). Todos os registros abaixo são criados lá, em "Editar zona" / modo avançado.
- `addegas.com.br` redireciona para `www.addegas.com.br`, que serve a **landing atual** (Next.js na Vercel, lista de espera).
- `app.addegas.com.br` ainda não existe.
- **Não há registro MX**: nenhum `@addegas.com.br` recebe e-mail hoje.

## Mapa de endereços
| Endereço | O quê | Onde | Quando |
| --- | --- | --- | --- |
| `www.addegas.com.br` | Landing (já existe) | Projeto Vercel da landing | Já no ar |
| `app.addegas.com.br` | Sistema da adega (app novo, fase 2) | Projeto Vercel do app | Quando o app novo entrar em produção (E52) |
| `admin.addegas.com.br` | Painel interno (D47) | Projeto Vercel do admin | Junto com a E11/E14 |
| `dev.addegas.com.br` (opcional) | Preview fixo ligado ao `addegas-dev` | Projeto Vercel do app (ambiente Preview) | M1 |
| `mail.addegas.com.br` | Envio de e-mail transacional (Resend) | Só DNS | Já pode configurar (E35) |
| `addegasapp.vercel.app` | Protótipo estático atual | Projeto Vercel atual | Até o corte (E52) |

Não é preciso domínio próprio para o Supabase: o app chama `https://<projeto>.supabase.co` direto (o domínio próprio do Supabase é add-on pago). As funções continuam atrás do proxy `/api` do app (E04).

## Registros DNS a criar no Registro.br
Os **valores exatos** aparecem no painel de cada serviço na hora de adicionar o domínio; a tabela diz o tipo e o nome, para você saber o que esperar.

| # | Para quê | Tipo | Nome | Valor | Quando |
| --- | --- | --- | --- | --- | --- |
| 1 | App | CNAME | `app` | o que a Vercel mostrar (ex.: `cname.vercel-dns.com`) | Quando o projeto do app existir |
| 2 | Admin | CNAME | `admin` | idem | Quando o projeto do admin existir |
| 3 | Envio (Resend): retorno de bounces | MX | `send.mail` (ou o nome que o Resend indicar) | `feedback-smtp.<região>.amazonses.com`, prioridade 10 | Agora |
| 4 | Envio (Resend): SPF | TXT | `send.mail` | `v=spf1 include:amazonses.com ~all` | Agora |
| 5 | Envio (Resend): DKIM | TXT | `resend._domainkey.mail` | chave pública que o Resend gerar | Agora |
| 6 | Política anti-falsificação | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@addegas.com.br` (depois de 30 dias sem problema, `p=quarantine`) | Agora |
| 7 | Receber e-mail (D61, redirecionamento) | MX | `@` (raiz) | servidores do serviço de redirecionamento (ex.: ImprovMX: `mx1.improvmx.com` 10, `mx2.improvmx.com` 20) | Quando decidir a D61 |
| 8 | SPF da raiz (para o redirecionamento) | TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | Junto com o 7 |

Observações:
- O envio fica num **subdomínio** (`mail.`) de propósito: se a reputação de envio tiver problema, ela não contamina o domínio principal.
- Não crie dois registros SPF no mesmo nome; se um dia a raiz precisar de outro serviço, junte os `include:` num registro só.
- A propagação no Registro.br costuma levar minutos, mas pode chegar a algumas horas.

## Endereços de e-mail
| Endereço | Uso | Recebe? |
| --- | --- | --- |
| `naoresponda@mail.addegas.com.br` | Remetente dos e-mails do sistema (confirmação, senha, acesso de funcionário, cobrança) | Não |
| `contato@addegas.com.br` | Contato geral (landing, Termos) | Sim, pelo redirecionamento (D61) |
| `privacidade@addegas.com.br` | Encarregado de dados (LGPD) | Sim, pelo redirecionamento |
| `financeiro@addegas.com.br` | Respostas sobre cobrança (`reply-to` dos avisos de fatura) | Sim, pelo redirecionamento |
| `dmarc@addegas.com.br` | Relatórios DMARC | Sim (ou um serviço de relatório) |

## Configuração nos serviços (checklist)
**Resend**
- [ ] Criar conta e adicionar o domínio `mail.addegas.com.br`, região São Paulo, se disponível.
- [ ] Criar os registros 3, 4 e 5 e esperar o "Verified".
- [ ] Gerar uma API key só de envio, por ambiente (dev e prd).

**Supabase Auth** (em cada projeto)
- [ ] Site URL: `https://app.addegas.com.br` (no dev: `https://dev.addegas.com.br` ou `http://localhost:5173`).
- [ ] Redirect URLs: os mesmos, mais `https://admin.addegas.com.br`.
- [ ] SMTP próprio: host `smtp.resend.com`, porta 465, usuário `resend`, senha = API key, remetente `naoresponda@mail.addegas.com.br`, nome "Addegas".
- [ ] Ligar a confirmação de e-mail (E06).
- [ ] Templates em português: confirmação, recuperação de senha, mudança de e-mail.

**Variáveis das funções** (`supabase secrets set`), por ambiente:
| Variável | Exemplo |
| --- | --- |
| `APP_URL` | `https://app.addegas.com.br` |
| `ADMIN_URL` | `https://admin.addegas.com.br` |
| `EMAIL_FROM` | `Addegas <naoresponda@mail.addegas.com.br>` |
| `EMAIL_REPLY_TO_BILLING` | `financeiro@addegas.com.br` |
| `RESEND_API_KEY` | (segredo) |
| `EMAIL_ENABLED` | `true` (no dev, `false` desvia tudo para o log) |

**Cloudflare Turnstile**
- [ ] Hostnames permitidos: `app.addegas.com.br`, `admin.addegas.com.br`, `www.addegas.com.br`, `localhost`.

**Stripe**
- [ ] Site da empresa: `https://www.addegas.com.br`; e-mail de suporte: `financeiro@addegas.com.br`.
- [ ] Endpoint de webhook: `https://app.addegas.com.br/api/hooks/stripe` (no dev, o Stripe CLI).

**Vercel**
- [ ] Projeto do app com o domínio `app.addegas.com.br` (e `dev.` no Preview, se usado).
- [ ] Projeto do admin com `admin.addegas.com.br`.

## O que fica pronto no código (quando o desenvolvimento começar)
- Módulo `_shared/email.ts` nas funções, que lê `EMAIL_FROM`, `EMAIL_ENABLED` e `RESEND_API_KEY`, aplica a fila e a idempotência (E35) e, com `EMAIL_ENABLED=false`, só registra no log. Trocar de ambiente ou de provedor é trocar variável, não código.
- Nenhum endereço ou domínio escrito direto no código: tudo vem de `APP_URL`, `ADMIN_URL` e `EMAIL_*`.
