# E37 · Admin: financeiro, pagamento manual, reembolsos e descontos

**Marco:** M7 · Painel Addegas | **Tamanho:** M | **Depende de:** E34, E36, E15 | **Desbloqueia:** E40
**Origem:** §1 ("faturas, carência de 5 dias, pagamento manual com comprovante, descontos por ciclo, reembolsos"), §5 (`refunds`, `discounts`, `discount_targets`)

## Objetivo
O financeiro acompanha faturas, registra pagamento feito fora do gateway, concede descontos e faz reembolsos, tudo refletido no gateway e na auditoria.

## Entra
- Lista de faturas com filtros (aberta, paga, vencida, em carência), por adega e por período.
- Pagamento manual: valor, data, forma, **comprovante obrigatório** no bucket `payment-proofs` (E15) → marca a fatura como paga no gateway (`paid_out_of_band` no Stripe) e dispara a transição de E33.
- Reembolso total ou parcial: pelo gateway, com motivo; `platform.refunds`.
- Descontos (`platform.discounts`, `discount_targets`): percentual ou valor fixo, número de ciclos, início, acumula ou não com outros, alvo (adega, lista de adegas, todos), motivo. Os dados de exemplo do admin já têm esse formato (D-031: 20% por 3 ciclos, retenção).
- Integração: desconto vira cupom/desconto na assinatura do gateway.
- Exportação CSV de faturas (E14).

## Não entra
- Emissão de nota fiscal de serviço (`D30`).

## Critérios de aceite
- Teste: pagamento manual sem comprovante → recusado.
- Teste: pagamento manual em conta em carência → volta para `active`/`allowed` na hora, sem esperar a rotina.
- Teste: desconto "não acumula" aplicado sobre outro ativo → substitui e registra o anterior.

## Riscos e atenção
- Pagamento manual é ponto de fraude interna: exigir comprovante, auditar e listar no painel do mestre os pagamentos manuais do mês.
