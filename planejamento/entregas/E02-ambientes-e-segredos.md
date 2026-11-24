# E02 · Ambientes: projetos Supabase, Vercel e segredos

**Marco:** M1 · Fundação | **Tamanho:** P | **Depende de:** E01 | **Desbloqueia:** E03, E04
**Origem:** §2 ("Ambientes"), §7 ("Segredos"), §9 ("No CI")
**Decisões aplicadas:** D32 (tudo gratuito, W-API pago), D34 (local + 2 projetos), D31 (domínio `addegas.com.br`), D47 (admin em projeto separado), D57 (continua no plano gratuito)

## Objetivo
Ambientes isolados de desenvolvimento e produção, cada um com seu banco, suas chaves e seu deploy, sem alteração manual em produção, dentro dos planos gratuitos.

## Entra
- **Local:** `supabase start` para desenvolver e rodar os testes.
- **Supabase** (plano gratuito, 2 projetos ativos por organização), região `sa-east-1` (São Paulo):
  - `addegas-dev`: ambiente online de teste (faz o papel de homologação);
  - `addegas-prd`: produção.
- **Vercel** (Hobby), quatro projetos:
  | Projeto | Endereço | Ambiente |
  | --- | --- | --- |
  | protótipo estático | `addegasapp.vercel.app` | continua no ar até o app novo ficar idêntico |
  | app da adega (fase 2) | `app.addegas.com.br` (prd) e `dev.addegas.com.br` (preview → `addegas-dev`) | produção na troca (E52) |
  | admin interno (D47) | `admin.addegas.com.br` | — |
  | landing (já existe) | `www.addegas.com.br` | — |
- Variáveis por ambiente: URL do Supabase e chave pública (anon/publicável) em `VITE_*`; nada de `service_role` no front.
- Segredos das funções (`supabase secrets set`) por projeto: Stripe (chaves de teste no dev), Resend, W-API, Turnstile.
- CI (GitHub Actions, gratuito para repositório privado dentro da cota):
  - em PR: `supabase db lint`, `supabase test db` (num Postgres local do runner), `supabase db advisors`;
  - na `main`: `supabase db push` para `addegas-dev`; em tag de release: push para `addegas-prd`.
- **Backup manual** enquanto estiver no gratuito: `supabase db dump` diário de produção por agendamento no GitHub Actions, guardado como artefato privado e criptografado. Não substitui o backup do plano pago, mas evita perder tudo.

## Limites do plano gratuito que afetam o desenho
Confira os números na página de preços atual de cada serviço; mudam com frequência.
| Serviço | Limite | Efeito no plano |
| --- | --- | --- |
| Supabase Free | pausa após 7 dias sem uso | `addegas-dev` pode pausar; produção com uso diário não pausa |
| Supabase Free | sem backup restaurável e sem PITR | backup manual acima (dump diário), com teste de restauração |
| Supabase Free | sem Branching, sem domínio próprio, sem timeout de sessão configurável | homologação = `addegas-dev`; sessão curta da equipe na `admin-api` (E11) |
| Supabase Free | sem transformação de imagem no Storage | conversão para WebP no navegador antes do upload (E15) |
| Supabase Free | banco e Storage pequenos | suficiente para piloto; acompanhar o uso no painel |
| Supabase Auth | SMTP padrão só envia para a equipe do projeto | SMTP próprio pelo Resend em `mail.addegas.com.br` (D56) |
| Vercel Hobby | firewall com menos regras | limite de taxa feito também nas funções (E04) |

## Não entra
- Registros DNS e serviços de e-mail: checklist em [../dominio-e-email.md](../dominio-e-email.md).

## Critérios de aceite
- Uma migration de teste chega ao `addegas-dev` pelo CI sem ninguém abrir o painel.
- A chave `service_role` não aparece em nenhuma variável `VITE_*` nem em log do CI.
- O backup manual de produção roda e foi restaurado com sucesso uma vez num banco local.

## Riscos e atenção
- Acompanhar os limites de uso nos painéis do Supabase e da Vercel; o backup manual é a proteção principal enquanto não houver backup gerenciado.
