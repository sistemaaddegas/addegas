# E13 · Auditoria imutável (loja e plataforma)

**Marco:** M3 · Permissões | **Tamanho:** P | **Depende de:** E05, E12 | **Desbloqueia:** E14 e todas as ações sensíveis
**Origem:** §1 ("Toda ação administrativa registra autor, data, motivo e antes/depois"), §7 ("Auditoria"), §9 ("Livro-razão imutável")

## Objetivo
Registrar quem fez o quê, quando, por quê e o que mudou, incluindo tentativas negadas, sem possibilidade de apagar ou editar.

## Entra
- `audit.store_actions` (id, account_id, store_id, actor_user_id, actor_kind, operator_member_id, action, entity, entity_id, reason, before jsonb, after jsonb, outcome `allowed`/`denied`, correlation_id, ip, created_at).
- `audit.admin_actions` (mesma ideia, com staff_id, staff_role e account_id afetado).
- Escrita só por `private.audit(...)`; `revoke insert, update, delete` de todos os papéis da API; trigger que bloqueia `update` e `delete` mesmo para o dono do schema (segunda barreira).
- Partição mensal (as duas crescem com o uso).
- Leitura:
  - adega: RPC `app.store_audit(store_id, filtros)` só para o dono (tela de histórico, se existir no design);
  - equipe: via `admin-api` (E14).
- Lista do que é auditado na loja: mudança de preço, desconto acima de X, cancelamento de venda, sangria/reforço, fechamento com diferença, ajuste/perda de estoque, mudança de função e permissão, terminal registrado/revogado, criação de login e redefinição de senha de funcionário pelo dono, autorização de desconto por PIN do gerente, e **toda negação de permissão**.

## Não entra
- Logs técnicos (E05/E46).

## Critérios de aceite
- Teste: `update audit.store_actions` como `service_role` → bloqueado pelo trigger.
- Teste: ação negada em `finalize_sale` gera linha `outcome = denied` com o mesmo `correlation_id` da requisição.

## Riscos e atenção
- **LGPD x imutabilidade** **[novo]**: `before/after` pode conter nomes (fiado, funcionários, dados de entrega). Decidido com a D25: a auditoria guarda IDs e campos alterados; dados pessoais são **anonimizados** pela rotina de exclusão (6 meses após o fim do acesso ou a pedido), numa operação controlada e registrada, sem apagar as linhas.
- Negações em massa (alguém com script) podem encher a tabela; deduplicar negações iguais por minuto.
