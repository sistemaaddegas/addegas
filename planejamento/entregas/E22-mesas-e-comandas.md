# E22 · Mesas e comandas

**Marco:** M4 · Núcleo | **Tamanho:** M | **Depende de:** E20, `D41` | **Desbloqueia:** E25
**Origem:** §1 ("Vendas com mesas e comandas"), §5 (`tabs`)
**Decisões aplicadas:** D41 (estoque baixa no lançamento; sem divisão de conta nem taxa de serviço na v1), D11 (comanda aberta bloqueia o fechamento do último caixa, ver E19), D19 (comanda identificada só por rótulo, sem cliente)

## Objetivo
Abrir uma mesa ou comanda, lançar itens ao longo da noite e fechar com uma venda só.

## Entra
- `app.tabs` (store_id, tipo `table`/`tab`, rótulo "Mesa 4" ou "Comanda 12", apelido opcional ("João camiseta azul"), status `open`/`closed`/`canceled`, aberta_por, aberta_em, fechada_em, sale_id ao fechar).
- `app.tab_items` (tab_id, store_id, product/combo, quantidade, preço no lançamento, lançado_por, lançado_em, removido_por, removido_em, motivo) **[novo]**: os itens da comanda ficam aqui até o fechamento, não em `sale_items`.
- Estoque (D41, decidido): baixa no **lançamento** do item na comanda (o produto saiu da geladeira), com movimento `tab` e estorno se o item for removido. No fechamento, a venda não baixa de novo: os itens chegam ao `finalize_sale` marcados como "já baixados pela comanda".
- RPCs: `open_tab`, `add_tab_item`, `remove_tab_item` (motivo + permissão `cancelar` se já lançado há mais de X min), `transfer_tab_items` (juntar ou mudar de mesa), `close_tab` → chama `finalize_sale` com os itens.
- Unicidade: `unique (store_id, tipo, rótulo) where status = 'open'` (não dá para abrir a Mesa 4 duas vezes).
- Comanda pertence à loja, não ao terminal: qualquer terminal da loja vê e lança.

## Não entra
- Divisão de conta entre pessoas e taxa de serviço/gorjeta (D41): só se for pedido; seria uma entrega P separada.

## Critérios de aceite
- Teste: dois terminais lançando na mesma comanda ao mesmo tempo → todos os itens gravados.
- Teste: fechar comanda gera venda com os itens e a comanda fica `closed` com o `sale_id`.
- Teste: remover item lançado devolve o estoque (se baixa no lançamento).

## Riscos e atenção
- Comanda esquecida aberta: alerta no fim do dia comercial; o fechamento do último caixa da loja fica bloqueado até a comanda ser fechada ou cancelada com motivo (D11).
- Teste a incluir: fechar comanda não baixa o estoque duas vezes.
