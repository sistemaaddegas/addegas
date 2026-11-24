# E06 · Cadastro do dono: conta, primeira loja e onboarding

**Marco:** M2 · Identidade | **Tamanho:** M | **Depende de:** E03, E04 | **Desbloqueia:** E07, E08, E09, E12, E33
**Origem:** §3 ("Pessoa da adega"), §5 ("Hierarquia do cliente"), §1 ("cadastro em 3 passos")
**Decisões aplicadas:** D44 (2FA opcional para o dono), D45 (captcha + limites nativos), D43 (sessão longa), D02 (1 loja no plano), D56 (domínio `addegas.com.br` existe: confirmação de e-mail ligada, via Resend), D23/D58 (cadastro a partir da landing)

## Objetivo
Um dono se cadastra, confirma o e-mail e termina o onboarding com conta, loja e teste de 14 dias criados, numa transação só.

## Entra
- Supabase Auth com e-mail e senha, confirmação de e-mail obrigatória, captcha Turnstile no cadastro, no login e na recuperação de senha.
- Política de senha: mínimo 8 caracteres, com letras e números.
- Tabelas:
  - `app.accounts` (id, nome, documento CPF/CNPJ opcional, fuso `America/Sao_Paulo`, `business_day_cutoff` padrão `05:00` (ver E26), `created_by`);
  - `app.stores` (id, account_id, nome, slug único, bairro, cidade, endereço, WhatsApp, `unique (id, account_id)`);
  - `app.profiles` (id = auth.users.id, nome, telefone);
  - `app.store_members` (store_id, user_id, role, ativo) criado aqui só para o dono.
- RPC `app.complete_onboarding(nome_adega, bairro, whatsapp, origem_produtos, apps)`, `security definer` em `private` chamada por um wrapper com checagem:
  - cria `accounts`, `stores`, `store_members(owner)`, `store_settings`, `alert_settings`;
  - cria a assinatura em teste no `platform` (status `trial`, fim = agora + 14 dias), ver E33;
  - grava `app_metadata.kind = 'person'` (via função administrativa, nunca pelo cliente);
  - é idempotente: chamar duas vezes não cria duas contas.
- Os 3 passos do onboarding do front: nome e bairro → WhatsApp → produtos (catálogo, planilha ou depois) e apps de delivery (só preferência, sem integração).
- Captura de origem (UTM, referrer) vinda da landing `www.addegas.com.br` (E53), gravada para o CRM (E48).

## Não entra
- Criação de lojas adicionais (E08), logins da equipe (E07), cobrança (E34).
- 2FA do dono: decidido como **opcional** (D44). Entrega pequena depois da E11, reaproveitando o TOTP do Supabase (gratuito): "Ativar verificação em duas etapas" no perfil.
- Checagem de senha vazada do Supabase Auth: é recurso de plano pago do Supabase; fica fora.

## E-mail (D56)
Confirmação de cadastro e recuperação de senha pelo SMTP do Resend em `mail.addegas.com.br`. Configuração e registros DNS em [../dominio-e-email.md](../dominio-e-email.md). No ambiente de desenvolvimento, `EMAIL_ENABLED=false` desvia os e-mails para o log.

## Regras
- **Não** permitir `insert` direto em `stores` pela API (corrige o defeito da migration atual, que deixa qualquer usuário criar lojas sem limite).
- Uma pessoa pode ser dona de mais de uma conta? Recomendação: não na v1 (`D02`).

## Critérios de aceite
- Teste: cadastro sem captcha válido é recusado.
- Teste (e-mail): usuário sem e-mail confirmado não consegue chamar `complete_onboarding`.
- Teste: após o onboarding, o dono lê a própria loja e não lê nenhuma outra.
- Teste: `insert into app.stores` direto pela API é recusado.

## Riscos e atenção
- "Bloqueio após 5 erros em 10 min" não é nativo (ver `D45`).
- Duração de "lembrar este aparelho" (`D43`) é configuração do projeto inteiro no Supabase; afeta também o terminal e a equipe.
