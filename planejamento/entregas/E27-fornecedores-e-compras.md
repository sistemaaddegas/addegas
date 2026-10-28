# E27 · Fornecedores, pedidos de compra e sugestão de compra

**Marco:** M5 · Gestão complementar | **Tamanho:** M | **Depende de:** E17 | **Desbloqueia:** E28
**Origem:** §1 ("fornecedores, sugestão de compra por WhatsApp"), §5 (`suppliers`, `supplier_types`, `purchase_orders`, `purchase_order_items`)

## Objetivo
Saber de quem a adega compra, o que pediu, o que chegou e o que precisa pedir.

## Entra
- `app.supplier_types` (seed: bebidas, destilados e mercearia, gelo e carvão, energéticos… como no front) e `app.suppliers` (nome, tipo, telefone/WhatsApp, prazo de entrega, observação, produtos que fornece).
- `app.purchase_orders` (fornecedor, status `draft`/`sent`/`partially_received`/`received`/`canceled`, previsão, total estimado) e `app.purchase_order_items` (produto, quantidade, custo estimado, quantidade recebida).
- Recebimento ligado à entrada de mercadoria (E17): receber um pedido gera os movimentos de estoque e atualiza "recebido".
- Sugestão de compra: RPC que lista produtos abaixo do mínimo **e** projeta a necessidade pelo giro dos últimos 14/28 dias (quantidade = venda média diária × dias de cobertura − saldo). Agrupa por fornecedor habitual.
- "Enviar por WhatsApp": monta o texto do pedido e abre `wa.me/<fornecedor>?text=...` (sem API; funciona sem a E45).
- Permissão `compras` (proposta em E12).

## Não entra
- Contas a pagar geradas pela compra (E28 pode criar a conta a partir do recebimento, opcional).
- Integração com distribuidora/atacadista.

## Critérios de aceite
- Teste: receber 8 de 10 itens → pedido `partially_received`, estoque +8.
- Teste: sugestão para produto que vende 5/dia, saldo 10, cobertura 7 dias → sugere 25.

## Riscos e atenção
- Sugestão baseada em giro erra em feriado e em produto novo; deixar a quantidade editável e mostrar a conta.
