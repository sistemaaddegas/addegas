# E04 · Borda na Vercel: proxy `/api`, headers e domínios

**Marco:** M1 · Fundação | **Tamanho:** P | **Depende de:** E02, `D31`, `D47` | **Desbloqueia:** E05, E14, E42
**Origem:** §2 ("Proxy", "Domínios"), §7 ("HTTP", "Abuso")
**Decisões aplicadas:** D31 (domínios `app.`, `admin.` e `www.addegas.com.br`, ver [../dominio-e-email.md](../dominio-e-email.md)), D47 (admin em projeto Vercel separado), D45 (login protegido por captcha e limites nativos do Supabase)

## Objetivo
Toda chamada a funções passa por uma URL nossa, com headers de segurança e limites de requisição num lugar só.

## Entra
- Rewrites no `vercel.json` **do app novo** (não no da raiz publicada hoje):
  - `/api/:path*` → `https://<projeto>.supabase.co/functions/v1/:path*`, um destino por ambiente.
  - Admin em **projeto Vercel separado**, em `admin.addegas.com.br`, com rewrite só para `/api/admin/*`; o projeto da adega (`app.addegas.com.br`) **não** tem essa rota (404).
  - HSTS com `preload` só depois de todos os subdomínios (`www`, `app`, `admin`, `mail`) estarem em HTTPS; a landing também precisa enviar o header.
- Headers: HSTS (`max-age=63072000; includeSubDomains; preload` só depois de confirmar todos os subdomínios em HTTPS), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, `Permissions-Policy` (câmera liberada só se o caixa ler código de barras pela câmera).
- CSP em **modo report-only** primeiro, com `report-to` apontando para a função de logs (E05); vira obrigatória depois de uma semana sem violação inesperada. Domínios: o próprio, `*.supabase.co` (REST, Auth, Realtime `wss://`, Storage), Google Fonts, Turnstile (`challenges.cloudflare.com`), Stripe (se o checkout for embutido).
- Regras de firewall: limite de requisições em `/api/hooks/*` por IP e em `/api/admin/*`.
- Função `GET /api/health` que responde versão, ambiente e horário do banco.

## Não entra
- Proteção do login na Vercel: o `supabase-js` chama o Auth do Supabase direto, então o firewall da Vercel **não vê o login** (análise 1.5). Decidido em D45: na v1 a proteção do login fica no Supabase (captcha Turnstile + limites nativos do Auth). O Auth não passa pelo proxy.
- Regras de limite de taxa no firewall: o plano Hobby tem poucas regras. Limites críticos (`/api/hooks/*`, `/api/logs`, `/api/leads`) são aplicados também dentro das funções, por IP e por usuário.

## Critérios de aceite
- `curl https://<app>/api/health` responde 200 com `x-correlation-id` no retorno.
- `curl https://<app>/api/admin/anything` no domínio da adega responde 404.
- securityheaders.com (ou equivalente) com nota A no domínio do app.

## Riscos e atenção
- O site estático atual carrega React do unpkg. Enquanto ele estiver no ar no mesmo domínio, a CSP precisa liberar `unpkg.com` (§7, "Atenção na fase atual").
- Regras de limite de taxa no firewall da Vercel dependem do plano (`D32`).
- Rewrite para domínio externo esconde o IP real do cliente na função; repassar `x-forwarded-for` e `x-real-ip` e só confiar neles quando vierem da Vercel.
