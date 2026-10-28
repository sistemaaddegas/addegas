# E29 · Promoções

**Marco:** M5 · Gestão complementar | **Tamanho:** P | **Depende de:** E18, E20 | **Desbloqueia:** E31 (catálogo público)
**Origem:** §1 ("Promoções com produtos do estoque"), §5 (`promotions`, `promotion_items`); texto do front: "Promoções aparecem no caixa e no catálogo do WhatsApp. O estoque de cada item é baixado na venda."

## Objetivo
Criar ofertas com produtos do estoque, por período, que aparecem no caixa e no catálogo.

## Entra
- Em `app.bundles` (E18) com `kind = 'promotion'`: início, fim, dias da semana e horário opcionais, imagem e "mostrar no catálogo".
- Na venda (E20), a promoção é um item com `bundle_id`, que baixa o estoque de cada produto, como o combo.
- Preço validado no servidor: fora do período, `finalize_sale` recusa com `PROMO_EXPIRED` e o caixa pede para tirar o item. Recusar é mais seguro que trocar o preço em silêncio.

## Combo e promoção: uma tabela só (D52, decidido)
Promoção é um `app.bundles` com `kind = 'promotion'`, início e fim. Esta entrega só acrescenta a validação de período, os dias e horários e a vitrine do catálogo; a estrutura e a baixa de estoque vêm da E18.

| | Combo (E18) | Promoção (E29) |
| --- | --- | --- |
| Duração | Permanente | Com início e fim |
| Onde aparece | Caixa | Caixa e catálogo do WhatsApp |
| Estrutura | Vários produtos, preço fechado | Vários produtos, preço fechado |

## Critérios de aceite
- Teste: promoção vencida não aparece no caixa e é recusada pela RPC.
- Teste: venda de promoção baixa estoque dos itens.

## Riscos e atenção
- Desconto por quantidade ("leve 3, pague 2") e desconto percentual em categoria não estão no front; não incluir sem pedido.
