# E26 · Relatórios da loja e dia comercial

**Marco:** M4 · Núcleo | **Tamanho:** M | **Depende de:** E19, E20, E21, `D12`, `D40` | **Desbloqueia:** E40 (GMV no admin)
**Origem:** §1 ("Vendas por período, hora, canal e forma de pagamento, mais vendidos, fechamentos de caixa"), §5 ("timestamptz, fuso na conta")

## Objetivo
Relatórios rápidos e corretos, com o dia definido como a adega entende o dia, não como o relógio entende.

## Entra
- **Dia comercial [novo, decidido em D12]**: `accounts.business_day_cutoff` (padrão 05:00). Venda às 01:30 de sábado conta como sexta. Coluna `business_date` gravada em `sales`, `cash_sessions` e `cash_movements` no momento do insert, calculada no fuso da conta.
- Relatórios (RPCs com `security_invoker` ou funções que conferem `can(store, 'relatorios')`):
  - vendas por período, por dia, por hora do dia, por canal, por forma de pagamento;
  - mais vendidos (quantidade e faturamento) e margem por produto (com custo congelado na venda, E18/E20);
  - fechamentos de caixa com diferença;
  - **vendas por operador e por turno** **[novo]** (pedido recorrente nos tickets de exemplo TK-2046/2047);
  - cancelamentos e descontos por operador (antifraude, E21);
  - vendido sem estoque (D06 permite negativo);
  - taxas de entrega recebidas e vendas com frete grátis (D42);
  - vendas em contingência (D14) e em Pix por operador (para conferência com o extrato, D15).
- Agregação: tabela `app.daily_store_stats` atualizada por trigger ou pela rotina das 2h, para períodos longos não varrerem `sales`. Dia corrente sempre calculado ao vivo.
- Exportação CSV com permissão `exportar` (E12).
- Índices compostos `(store_id, business_date)` e `(store_id, created_at desc)` (§9).

## Não entra
- Lucro estimado com taxas da maquininha (D40, decidido para depois do piloto): taxa por forma de pagamento em Ajustes e coluna "lucro estimado".
- Vendas por loja e consolidado da conta: o produto é da conta (D37), então o relatório "por produto em todas as lojas" fica simples; entra quando a segunda loja for liberada.

## Critérios de aceite
- Teste: venda às 01:30 com corte às 05:00 aparece no dia anterior.
- Teste: soma do relatório por forma de pagamento = soma de `sale_payments` do período, excluindo canceladas.
- Teste: caixa (sem `relatorios`) chama a RPC → recusado.
- Relatório de 12 meses com 200 mil vendas responde em < 1 s.

## Riscos e atenção
- Mudar o horário de corte depois de ter dados não recalcula `business_date` antigo; avisar na tela de Ajustes ou recalcular por rotina.
