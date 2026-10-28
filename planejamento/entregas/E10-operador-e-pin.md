# E10 · Operador no terminal: PIN e sessão de operador

**Marco:** M2 · Identidade | **Tamanho:** M | **Depende de:** E07, E09, `D13` | **Desbloqueia:** E19, E20
**Origem:** §3 ("o operador entra com nome e PIN de 4 dígitos")
**Decisões aplicadas:** D13 (4 dígitos, trava por operador e por terminal), D05 e D63 (desconto acima do limite autorizado pelo PIN de quem tiver limite suficiente)

## Objetivo
Saber quem está operando o caixa em cada venda, sangria e fechamento, sem que cada pessoa precise de login próprio no aparelho.

## Entra
- PIN por membro e por loja: `app.store_members.pin_hash` (bcrypt via `crypt(pin, gen_salt('bf', 10))`), definido pela própria pessoa no primeiro acesso ou pelo dono.
- `app.operator_sessions` (id, store_id, terminal_id, member_user_id, iniciada_em, expira_em, encerrada_em, motivo_encerramento).
- RPC `app.operator_login(terminal_id, member_user_id, pin)`:
  - só aceita chamada de um token `kind = 'terminal'` cujo `terminal_id` bate;
  - confere tentativas: **5 erros travam o operador por 15 min** (§3) **e** 20 erros na mesma hora travam o terminal inteiro para PIN **[novo]**, porque com 4 dígitos o ataque é trocar de operador;
  - encerra sessão anterior do mesmo terminal; abre nova com validade até o fechamento do caixa ou 12 h;
  - devolve `operator_session_id`.
- `app.operator_logout`, troca rápida de operador ("Trocar operador" no caixa).
- Todas as RPCs de caixa e venda recebem `operator_session_id` e validam: sessão ativa, mesmo terminal do token, não expirada, membro ainda ativo. A partir daí, as permissões aplicadas são as **da função do operador** (vender, desconto, cancelar etc.), não as do terminal.
- Tabela de tentativas `private.pin_attempts` (operador, terminal, sucesso, ip, quando), fora da API.

## Não entra
- Abrir/fechar caixa (E19).

## Regras
- O PIN nunca sai do banco, nem o hash: a coluna é revogada para `authenticated` (`revoke select (pin_hash) ...`) ou o PIN fica em tabela em `private`.
- PIN não pode ser trivial (`0000`, `1234`, igual a outro operador da mesma loja? este último revelaria o PIN alheio; recomendação: **permitir repetido** e checar só triviais).
- Dono e gerente também usam PIN quando operam o caixa no terminal.

## Critérios de aceite
- Teste: 5 PINs errados → operador travado 15 min; 6ª tentativa com PIN certo é recusada.
- Teste: PIN certo de operador desativado → recusado.
- Teste: `finalize_sale` com `operator_session_id` de outro terminal → recusado.
- Teste: caixa sem permissão de desconto tenta desconto via RPC → recusado e auditado, mesmo com a tela escondendo o botão.

## Riscos e atenção
- 4 dígitos = 10 mil combinações. O hash não protege se vazar; o que protege é a trava por operador e por terminal (D13, decidido).
- **Autorização de desconto (D05, D63):** RPC `app.authorize_override(terminal_id, member_user_id, pin, ação, valor)` devolve um token de uso único, válido por 2 minutos, que o `finalize_sale` aceita para um desconto acima do limite do operador. Quem autoriza precisa ter limite que cubra o desconto pedido (gerente até 15%, dono livre; E12). Conta nas mesmas travas de tentativas e fica na auditoria com os dois nomes (operador e quem autorizou).
