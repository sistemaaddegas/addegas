# E43 · iFood (integração piloto)

> ⏸️ **Em espera (D21, 28/10/2026).** Não entra no plano até haver decisão de retomar. Enquanto isso, pedidos do iFood são lançados à mão na tela de Pedidos (E41), e o texto do produto não promete integração automática (D59). A ficha fica como referência para a retomada.

**Marco:** M8 · Integrações | **Tamanho:** G | **Depende de:** E41, E42, `D21` (**bloqueante**) | **Desbloqueia:** E44
**Origem:** §8 ("pedidos entram por webhook, viram `orders` com baixa de estoque na confirmação, e a mudança de status volta para o app de origem")

## Objetivo
Pedidos do iFood da loja aparecem no Addegas sem duplicar, e confirmar, despachar ou cancelar no Addegas reflete no iFood.

## Antes de começar (`D21`)
- Cadastro do Addegas como software parceiro no portal de desenvolvedores do iFood e o processo de **homologação** (o iFood testa a integração antes de liberar para lojas reais).
- Modelo de recebimento: polling de eventos ou webhook (o iFood oferece os dois; confirmar o exigido para homologação), e o fluxo de autorização da loja (a adega autoriza o Addegas a acessar a conta dela).
- Prazos: o iFood cancela pedido não confirmado dentro do prazo dele. O Addegas precisa alertar a loja de forma que não dê para ignorar (som, tela cheia), e talvez confirmar automaticamente (configurável).

## Entra
- Vínculo da loja: `app.integrations` (canal `ifood`, merchant_id, status) + token por loja no **Vault** (§7), renovado por rotina antes de expirar.
- Recepção (webhook → E42, ou polling por cron a cada 30 s com `ack` dos eventos).
- Mapeamento: pedido iFood → `orders` + `order_items`; item do iFood → produto da loja por código externo (`app.product_external_codes`). Item sem vínculo: pedido entra com alerta "item não vinculado" e não baixa estoque daquele item.
- Ações de volta: confirmar, iniciar preparo, pronto, despachado, cancelar (com motivo da lista do iFood).
- Painel de saúde da integração por loja (última sincronização, erros).

## Critérios de aceite
- Roteiro de homologação do iFood aprovado.
- Teste: evento repetido não duplica pedido (chave `(store, 'ifood', order_id)`).
- Teste: cancelamento pelo cliente no iFood após confirmação devolve o estoque.

## Riscos e atenção
- Integração com app de delivery é produto contínuo: mudanças de API, incidentes, suporte às lojas. Prever dono do tema.
