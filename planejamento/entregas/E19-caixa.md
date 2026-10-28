# E19 · Caixa: abertura, sangria, reforço, troca de operador e fechamento

**Marco:** M4 · Núcleo | **Tamanho:** M | **Depende de:** E10, E12, E13, `D11` | **Desbloqueia:** E20, E26
**Origem:** §5 ("Caixa por operador"), §1 ("abertura e fechamento de caixa")

## Objetivo
Controlar o dinheiro da gaveta do começo ao fim do turno, sabendo quem vendeu, quem tirou e quem fechou.

## Decisão de modelo (D11, decidido; análise crítica 1.8)
O documento propõe "uma sessão aberta por operador e terminal". **Decidido: uma sessão por terminal (gaveta)**, com operadores se alternando dentro dela, e **fechamento bloqueado enquanto houver comanda aberta** na loja:
- cada terminal tem uma gaveta física; a contagem do fechamento é da gaveta, não da pessoa;
- toda venda, sangria e reforço guarda o operador, então o relatório "quanto cada caixa vendeu no turno" (TK-2046/2047 dos dados de exemplo) sai do mesmo jeito;
- se uma loja tiver duas gavetas, são dois terminais.

## Entra
- `app.cash_sessions` (store_id, terminal_id, aberta_por, aberta_em, fundo de troco em centavos, status `open`/`closed`, fechada_por, fechada_em, esperado por forma, contado em dinheiro, diferença, observação, `business_date`).
- Índice único `(terminal_id) where status = 'open'` (substitui o "um por loja" da migration atual).
- `app.cash_movements` (só inserção): `opening`, `sale_cash_in`, `change_out` (troco), `withdrawal` (sangria), `reinforcement` (reforço), `sale_cancel_refund`, `fiado_payment_in`, com operador e motivo.
- RPCs: `open_cash`, `cash_withdrawal`, `cash_reinforcement`, `close_cash(contado, observação)`.
- Fechamento calcula: esperado em dinheiro = fundo + entradas em dinheiro − troco − sangrias + reforços − estornos; diferença = contado − esperado. Pix, crédito, débito e fiado aparecem como totais informativos (não estão na gaveta).
- Resumo do fechamento salvo em `summary jsonb` (congelado) para o relatório e para o alerta no WhatsApp (E45).
- Diferença acima de um limite configurável → auditoria e alerta ao dono.
- **Comanda aberta bloqueia o fechamento (D11):** `close_cash` recusa com `CASH_OPEN_TABS` e devolve a lista das comandas abertas. Se a loja tiver mais de um terminal, o bloqueio vale só para o **último** caixa aberto da loja, para um terminal poder fechar enquanto o outro segue atendendo as mesas.
- **Pagar entregador (D42/D60, decidido):** botão opcional que registra uma sangria com a categoria `courier_payment`, para o caixa bater quando o motoboy é pago com dinheiro da gaveta.

## Não entra
- Conferência cega (operador digita o contado sem ver o esperado): opção em Ajustes (E31), desligada por padrão; entra numa versão seguinte.
- Reabertura de caixa fechado: fora da v1. Erro no fechamento se corrige com lançamento de ajuste (dono ou gerente, com motivo), coerente com o livro-razão.

## Critérios de aceite
- Teste: abrir dois caixas no mesmo terminal → segundo recusado.
- Teste: venda com caixa fechado → `SALE_CASH_CLOSED`.
- Teste: cenário completo (fundo 100, 3 vendas em dinheiro, 1 troco, 1 sangria, contado) → diferença correta em centavos.
- Teste: entregador tenta sangria → recusado.
- Teste: último caixa da loja com a Mesa 4 aberta → fechamento recusado com `CASH_OPEN_TABS`; com outro caixa ainda aberto → permitido.

## Riscos e atenção
- Caixa esquecido aberto de um dia para o outro: rotina que avisa o dono e, após X horas, impede novas vendas até fechar (com `business_date` coerente; ver E26).
