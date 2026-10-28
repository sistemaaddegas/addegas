# E08 · Várias lojas e seletor de loja

**Marco:** M2 · Identidade | **Tamanho:** P | **Depende de:** E06, `D02`, `D37` | **Desbloqueia:** E32
**Origem:** §3 ("Várias lojas"), §1 ("seletor de loja")
**Decisões aplicadas:** D02 (1 loja no plano; cada loja extra é adicional pago), D37 (transferência de estoque; preço padrão da conta com preço por loja opcional, ver E16)

## Objetivo
Uma conta pode ter mais de uma loja, uma pessoa pode ser membro de várias, e trocar de loja não exige novo login.

## Entra
- RPC `app.create_store(account_id, ...)`: só o dono da conta; confere quantas lojas a assinatura cobre (1 do plano + adicionais contratados, E32) dentro da mesma transação, com `select ... for update` na conta para evitar duas criações simultâneas furando o limite.
- Loja adicional (D02): sem vaga, a tela oferece "Adicionar loja por R$ X/mês" (D54). A função aumenta a quantidade do item "loja adicional" na assinatura do Stripe (E34), com cobrança proporcional, e só libera a criação da loja quando o Stripe confirmar. Durante o teste, a segunda loja não é liberada.
- Remover loja adicional: a loja é arquivada (dados mantidos, sem operação) e a quantidade diminui na próxima renovação.
- RPC `app.my_stores()`: lista as lojas em que a pessoa é membro ativo, com função e estado de acesso da conta.
- A loja ativa fica no front (rota ou estado), **não** no token (§3). Toda chamada leva `store_id` explícito e a RLS confere.
- Preferência "última loja usada" em `app.profiles` para abrir direto nela.

## Não entra
- Transferência de estoque entre lojas: decidida (D37), construída na E17.
- Produtos e preços da conta com preço por loja: decididos (D37), construídos na E16.

## Regras
- Membro de duas lojas pode ter funções diferentes em cada uma (gerente em uma, caixa na outra).
- Relatório consolidado da conta (todas as lojas): só o dono. Definir se entra na v1 (E26).

## Critérios de aceite
- Teste: dono com limite de 1 loja tenta criar a 2ª → recusado com `PLAN_LIMIT_STORES`.
- Teste: duas chamadas concorrentes de `create_store` com 1 vaga restante → só uma passa.
- Teste: membro da loja A e B lê as duas; membro só da A não lê a B.

## Riscos e atenção
- A seção 5 da análise crítica sugere manter o modelo pronto, mas só liberar a segunda loja depois do piloto.
- Liberar a loja só depois da confirmação do Stripe evita loja criada sem cobrança; o dono precisa ver um estado "aguardando pagamento" na tela.
