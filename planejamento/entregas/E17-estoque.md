# E17 · Estoque: livro-razão, entrada, lotes, contagem, perdas e transferência

**Marco:** M4 · Núcleo | **Tamanho:** G | **Depende de:** E16, `D06`, `D07`, `D08`, `D37` | **Desbloqueia:** E18, E20, E27
**Origem:** §5 ("Saldos derivados de livro-razão imutável"), §1 ("lotes com validade, entrada de mercadoria, contagem")
**Decisões aplicadas:** D06 (negativo permitido, loja pode bloquear), D07 (opção A), D08 (custo médio ponderado), D09 (`numeric`), D37 (transferência entre lojas; produto da conta, estoque da loja)

## Objetivo
O saldo de cada produto é sempre a soma do livro-razão, e toda mudança de estoque tem tipo, autor, motivo e origem.

## Entra
- `app.stock_movements` (store_id, product_id, tipo, quantidade com sinal, custo unitário em centavos, lot_id, ref_type, ref_id, operator, reason, created_at), **só inserção** (`revoke update, delete` + trigger, §9).
- Tipos: `entry` (entrada), `sale`, `sale_cancel`, `adjustment`, `count_adjustment`, `loss` (quebra, vencimento, consumo interno), `transfer_out`, `transfer_in`, `order` (pedido de app, E41).
- Trigger único **[ajuste]**: o saldo (`app.product_stock`) muda **só** no insert de `stock_movements`. Corrige os dois caminhos da migration atual.
- Entrada de mercadoria: RPC `app.receive_goods(store_id, supplier_id?, purchase_order_id?, itens[{product, qtd, custo, lote?, validade?}])`, gera movimentos e, se houver pedido de compra, marca o recebimento (E27).
- Lotes: `app.stock_lots` (store, product, código, validade, quantidade inicial, quantidade restante). **Decidido (D07):** lote só para controle de validade e alerta; a venda não escolhe lote; o "restante" é estimado consumindo o lote de validade mais próxima (FEFO) por trigger.
- Contagem: `app.stock_counts` (sessão de contagem com status `open`/`applied`) e `app.stock_count_items` (produto, quantidade **contada**, saldo do sistema no momento). Ao aplicar, o servidor calcula a diferença e grava `count_adjustment`. Corrige a ambiguidade do tipo `count` da migration atual.
- Perdas com motivo obrigatório (lista: quebra, vencido, consumo, furto, outro).
- Transferência entre lojas da mesma conta **[novo]** (`D37`): RPC única que grava `transfer_out` na origem e `transfer_in` no destino numa transação, exigindo permissão `estoque` nas duas.
- Custo (D08, decidido): **custo médio ponderado** recalculado em cada entrada, guardado em `products.avg_cost` (por conta, porque o produto é da conta); o último custo fica no movimento. Transferência entre lojas não altera o custo médio.
- Estoque mínimo e alerta "estoque baixo" (consumido pela E31/E45).

## Não entra
- Baixa por venda (E20) e por pedido (E41), que usam esta estrutura.

## Regras
- Estoque negativo (D06, decidido): **permitido**, com alerta no caixa e relatório "vendido sem estoque"; a loja pode ligar o bloqueio em Ajustes (`store_settings.block_negative_stock`, E31).
- Ajuste manual exige motivo e gera auditoria.

## Critérios de aceite
- Teste: saldo = soma dos movimentos, para 1.000 movimentos aleatórios (teste de propriedade).
- Teste: `update` em `stock_movements` → recusado.
- Teste: contagem com valor 10 e saldo 12 → um movimento `count_adjustment` de −2.
- Teste: transferência falha no destino → nada gravado na origem.
- Teste: custo médio após entradas de 10 un a R$ 5,00 e 10 un a R$ 7,00 = R$ 6,00.

## Riscos e atenção
- Quantidade é `numeric(12,3)` (D09); a tela mostra inteiro para produtos vendidos por unidade.
- Contagem demorada com vendas acontecendo ao mesmo tempo: o "saldo do sistema" deve ser o do momento em que o item foi contado, não o da aplicação. Guardar o saldo por item na hora da contagem e aplicar a diferença com os movimentos posteriores.
