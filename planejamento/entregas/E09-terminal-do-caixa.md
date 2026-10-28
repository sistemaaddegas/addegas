# E09 · Terminal do caixa: registro do aparelho

**Marco:** M2 · Identidade | **Tamanho:** M | **Depende de:** E06, E07 | **Desbloqueia:** E10, E19
**Origem:** §3 ("Terminal do caixa", "Por que o terminal tem login próprio")

## Objetivo
O tablet ou PC do balcão fica logado com um usuário técnico que só enxerga caixa, pedidos e consulta de estoque daquela loja, em vez da conta do dono.

## Entra
- `app.terminals` (id, store_id, nome "Balcão 1", auth_user_id, ativo, último acesso, registrado_por, revogado_em).
- Fluxo de pareamento **[detalhe novo]**:
  1. Dono ou gerente, logado no próprio celular, toca em "Registrar este aparelho como caixa" ou gera um **código de pareamento** de 6 dígitos válido por 10 minutos.
  2. No aparelho do balcão, a tela "Registrar caixa" pede o código.
  3. A função `/api/terminals/pair` valida o código, cria um usuário no Auth com `app_metadata = { kind: 'terminal', store_id, terminal_id }` (sem e-mail real; e-mail técnico `terminal-<id>@terminals.addegas.invalid`) e devolve a sessão (access + refresh token) para o aparelho.
- Sessão do terminal: refresh token com rotação; o aparelho fica logado indefinidamente enquanto usado e o terminal estiver ativo.
- Revogação: no painel, "Revogar terminal" → `active = false`, `auth.admin.signOut(user)` e exclusão do usuário técnico. A RLS já recusa pelo `active` mesmo antes do token expirar (§9).
- RLS para `kind = 'terminal'`: leitura apenas de produtos/estoque, caixa, comandas e pedidos **da loja do terminal**; nenhuma leitura de contas a pagar, relatórios, equipe, clientes além do necessário para fiado (nome e saldo).

## Não entra
- PIN e sessão de operador (E10).

## Regras
- Limite de terminais por loja? Recomendação: sem limite no plano único, mas com alerta acima de 5 (`D02`).
- O terminal nunca escreve em tabela diretamente: toda escrita é RPC que exige sessão de operador válida (E10).

## Critérios de aceite
- Teste: token de terminal tenta ler `app.bills` → 0 linhas / erro.
- Teste: terminal da loja A tenta ler produtos da loja B → 0 linhas.
- Teste: terminal revogado → próxima chamada recusada, mesmo com access token ainda válido.
- Teste: código de pareamento usado duas vezes ou após 10 min → recusado.

## Riscos e atenção
- O refresh token fica guardado no aparelho. Se o tablet for roubado, a proteção é revogar no painel; mostrar "último acesso" e IP para o dono perceber.
- Ler código de barras pela câmera exige `Permissions-Policy` que libere câmera (E04).
