# E11 · Equipe Addegas: convite, 2FA obrigatório e sessão curta

**Marco:** M2 · Identidade | **Tamanho:** M | **Depende de:** E03, E04, `D45`, `D46` | **Desbloqueia:** E14
**Origem:** §3 ("Equipe Addegas"), §4 ("Equipe Addegas"), §3 ("Perfil vem da conta, nunca da tela")

## Objetivo
Só pessoas da equipe Addegas, com 2FA, entram no painel interno; o perfil vem do banco e a sessão expira após 30 min sem uso.

## Entra
- `platform.staff` (user_id, nome, e-mail `citext` terminado em `@addegas.com.br`, role_id, ativo, última atividade, criado_por).
- `platform.staff_roles` e `platform.role_actions` (seed com os 5 perfis da §4).
- Cadastro **só por convite** do administrador mestre: função `admin-api` → `auth.admin.inviteUserByEmail` + linha em `staff`. O cadastro público do Auth não cria staff.
- Bloqueio de domínio: hook "before user created" do Auth (ou checagem no convite) recusando e-mail fora de `@addegas.com.br` para `kind = 'staff'`.
- 2FA TOTP obrigatório: primeiro login força o cadastro do fator; a `admin-api` exige `aal = 'aal2'` no JWT em toda chamada.
- Sessão de 30 min sem uso **implementada na `admin-api`** **[ajuste]**: a cada chamada, compara `staff.last_activity_at`; passou de 30 min, responde `SESSION_IDLE` e o front faz logout. Motivo: o timeout do Supabase é do projeto inteiro e derrubaria também a adega e o terminal.
- Recuperação de senha por link de 30 min **sem** desligar o 2FA; perda do autenticador só com o administrador mestre removendo o fator, auditado.
- Primeiro administrador mestre criado por script de bootstrap (uma vez por ambiente), não pela interface.

## Não entra
- Ações do painel (E14 e seguintes).

## Critérios de aceite
- Teste: usuário staff com `aal1` chama `admin-api` → 401 `MFA_REQUIRED`.
- Teste: e-mail `@gmail.com` convidado como staff → recusado.
- Teste: staff inativo com token válido → 403 e auditoria.
- Teste: 31 min sem chamada → próxima chamada `SESSION_IDLE`.
- O perfil exibido no front vem de `GET /api/admin/me`, nunca de escolha na tela (o login de demonstração atual deixa escolher).

## Riscos e atenção
- "Bloqueio de IP por força bruta" no login da equipe: o login vai direto ao Auth do Supabase. Ver opções em `D45` (hook de verificação de senha, que depende do plano, ou login intermediado pela função).
- Se a equipe usar o mesmo e-mail para ser dona de uma adega de teste, o `kind` conflita. Regra: conta staff não pode ser membro de loja (ou usar e-mails separados).
- Avaliar hospedar o painel em projeto Vercel separado (`D47`), o que facilita CSP e firewall próprios.
