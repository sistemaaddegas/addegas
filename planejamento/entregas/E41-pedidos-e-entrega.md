# E41 · Pedidos: modelo, pedido manual/WhatsApp e entregador

**Marco:** M8 · Integrações (antecipar: pode vir logo após o M4) | **Tamanho:** M | **Depende de:** E20, E25, `D20`, `D42` | **Desbloqueia:** E42, E43, E44
**Origem:** §1 ("pedidos de iFood, Zé Delivery, 99Food, Keeta e WhatsApp em tempo real"), §4 (entregador vê só os atribuídos), §5 (`orders`, `order_items`, `order_events`)
**Decisões aplicadas:** D42 (taxa de entrega na venda, opção de frete grátis, motoboy pago à parte), D20 (entregador entra com o login que o dono criou), D21 (apps em espera: pedidos dos apps lançados à mão com o canal certo), D60 (botão "Pagar entregador" no caixa, decidido)

## Objetivo
Ter o fluxo de pedidos funcionando com pedidos lançados pela própria loja (WhatsApp, telefone, balcão para entrega) antes de receber pedidos de terceiros.

## Entra
- `app.orders` (store_id, canal `whatsapp`/`phone`/`counter`/`ifood`/`ze_delivery`/`food99`/`keeta`, external_id, status, modo `own_delivery`/`platform_delivery`/`pickup`, dados de entrega do pedido (nome, telefone, endereço; ficam só no pedido, não viram cadastro de cliente, D19, e são anonimizados após 6 meses, D25), taxa de entrega, subtotal, total, pagamento previsto, entregador atribuído, previsão, sale_id quando concluído), `unique (store_id, channel, external_id)` (§5).
- `app.order_items` e `app.order_events` (só inserção: status de → para, autor, origem `store`/`platform`, quando).
- Fluxo de status igual ao front: novo → em preparo → pronto → (chamar entregador | entregue ao entregador do app | entregue ao cliente na retirada) → em rota → entregue; recusado/cancelado com motivo.
- Baixa de estoque **na confirmação** do pedido (§8), com estorno se cancelado depois.
- Conclusão gera venda (`finalize_sale` com `order_id` e canal), para os relatórios por canal (E26) saírem de um lugar só.
- Entregador (D20): membro com função `courier`, com o login criado pelo dono (E07); RLS em `orders` com `courier_id = (select auth.uid())` para essa função; RPCs `courier_pickup`, `courier_delivered`.
- **Taxa de entrega (D42):** campo `delivery_fee` no pedido, com o valor padrão da loja (E31) editável, botão "Frete grátis" (zera e marca `free_delivery = true`) e regra opcional "frete grátis acima de R$ X". A taxa entra no total da venda e aparece separada no relatório (E26).
- **Motoboy pago à parte (D42):** o sistema **não** calcula repasse. Se o motoboy for pago com dinheiro da gaveta, o caixa usa "Pagar entregador" (E19, D60).
- **Apps em espera (D21):** a tela de Pedidos permite lançar à mão um pedido do iFood, Zé Delivery, 99Food ou Keeta, com o canal e o número do pedido no app, para o relatório por canal já funcionar.
- Alerta "pedido atrasado" (E31) por tempo no status.

## Não entra
- Receber pedidos de apps (E42 a E44).

## Critérios de aceite
- Teste: entregador lê só pedidos atribuídos a ele; não lê vendas nem estoque.
- Teste: pedido cancelado após confirmação devolve o estoque.
- Teste: pedido concluído aparece no relatório do canal certo.

## Riscos e atenção
- Pedido com frete grátis tem custo real de entrega que o sistema não vê (o motoboy é pago por fora). O dono pode achar que a entrega dá lucro quando não dá; vale um aviso no relatório.
