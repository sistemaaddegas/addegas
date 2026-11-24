# E14 · `admin-api`: esqueleto, perfis da equipe e negação auditada

**Marco:** M3 · Permissões | **Tamanho:** M | **Depende de:** E04, E11, E13 | **Desbloqueia:** E36 a E40, E38
**Origem:** §2 ("Tudo do painel Addegas → `/api/admin/*`"), §4 ("Equipe Addegas")

## Objetivo
Uma função única, com um filtro único, por onde passa toda ação do painel interno.

## Entra
- Edge Function `admin-api` com roteador interno (`GET /api/admin/me`, `POST /api/admin/accounts/:id/suspend` etc.).
- Middleware, nesta ordem:
  1. CORS só para o domínio do admin;
  2. lê e repassa `x-correlation-id`;
  3. valida JWT, exige `aal2` (E11);
  4. carrega `platform.staff` ativo e confere inatividade de 30 min;
  5. confere `platform.role_actions` para a ação da rota;
  6. negou → grava `audit.admin_actions` com `outcome = denied` e responde 403 `FORBIDDEN_ACTION`;
  7. passou → executa com cliente `service_role` **dentro de uma função de banco** que recebe o `staff_id` e grava a auditoria na mesma transação da mudança.
- Ações que exigem **motivo** obrigatório (ex.: suspender, estender teste, conceder desconto, reembolsar) validam o campo no servidor.
- Catálogo de ações em código **e** em tabela, com teste que falha se uma rota não tiver ação registrada.
- Paginação por cursor em toda listagem (§9).
- Exportação: gera CSV no bucket `exports` (E15) e devolve URL assinada de 5 min.

## Não entra
- As telas de negócio do admin (E36 a E40).

## Critérios de aceite
- Teste: perfil Analista chama ação de escrita → 403 e auditoria.
- Teste: rota nova sem ação no catálogo → teste de CI falha.
- Teste: a mudança e a auditoria estão na mesma transação (falha na auditoria desfaz a mudança).

## Riscos e atenção
- Uma função só concentra tudo: cuidado com tempo de cold start e tamanho. Se crescer muito, dividir por domínio (`admin-billing`, `admin-support`) mantendo o mesmo middleware compartilhado.
- O cliente `service_role` ignora RLS. Toda consulta dentro da `admin-api` precisa filtrar explicitamente; preferir chamar funções de banco com parâmetros a montar SQL na função.
