# E21 · Cancelamento e estorno de venda

**Marco:** M4 · Núcleo | **Tamanho:** P | **Depende de:** E20, `D10` | **Desbloqueia:** E26
**Origem:** §4 (permissão "Cancelar venda") **[regra nova]**
**Decisões aplicadas:** D10 (as regras propostas abaixo foram aprovadas: só cancelamento total; depois do fechamento, só dono ou gerente; estorno sai do caixa aberto)

## Objetivo
Cancelar uma venda desfazendo estoque, caixa e fiado com novos lançamentos, nunca apagando nada.

## Entra
- RPC `app.cancel_sale(sale_id, motivo, operator_session_id)`:
  - permissão `cancelar`; motivo obrigatório;
  - `sales.status` → `canceled`, com `canceled_by`, `canceled_at`, `cancel_reason`;
  - estoque: `sale_cancel` positivo para cada item (E17);
  - caixa: `sale_cancel_refund` negativo para a parte em dinheiro, **na sessão de caixa aberta agora** (que pode não ser a da venda);
  - fiado: lançamento de estorno no `fiado_ledger` (E23);
  - Pix e cartão: só registro; a devolução real é feita fora do sistema e a tela avisa;
  - auditoria com antes e depois.
- Cancelamento parcial: não existe na v1 (D10). Troca de item = cancelar e refazer.

## Regras (decididas em D10)
- Até o fechamento do caixa da venda: caixa com permissão `cancelar`.
- Depois do fechamento: só dono ou gerente, e o estorno em dinheiro sai do caixa aberto agora.
- Venda de pedido de app (E41) não se cancela por aqui: cancela-se o pedido.

## Critérios de aceite
- Teste: cancelar venda em dinheiro com outro caixa aberto → estorno registrado no caixa atual, não no fechado.
- Teste: cancelar duas vezes → segunda recusada.
- Teste: cancelar venda com fiado → saldo do cliente volta ao anterior.

## Riscos e atenção
- Cancelamento é a fraude mais comum em PDV (vende, recebe em dinheiro, cancela, embolsa). Relatório de cancelamentos por operador e alerta ao dono acima de N por turno.
