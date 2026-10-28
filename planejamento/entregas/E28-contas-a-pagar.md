# E28 · Contas a pagar com vencimento e juros

**Marco:** M5 · Gestão complementar | **Tamanho:** P | **Depende de:** E12, E27, `D17` | **Desbloqueia:** E31 (alertas de vencimento)
**Origem:** §1 ("contas com juros"), §5 (`bills`, `bill_categories`)

## Objetivo
Registrar contas da loja (fornecedor e fixas), ver o que vence e quanto custa o atraso.

## Entra
- `app.bill_categories` (seed com as do front) e `app.bills` (descrição, categoria, fornecedor opcional, valor em centavos, vencimento, recorrência mensal opcional, regra de juros, pago em, valor pago, forma, comprovante opcional no Storage).
- Regra de juros (D17, decidido: a do front): **juros simples de X% ao mês, multiplicado pelo número de meses iniciados de atraso** (`ceil(dias/30)`, mínimo 1), ou **valor fixo por atraso**.
- Cálculo no servidor (função `app.bill_amount_due(bill_id, data)`) para o front não divergir.
- Recorrência: rotina diária gera a próxima conta de uma recorrente quando a atual é paga ou no dia 1º.
- Pagamento: RPC `pay_bill`; se pago em dinheiro do caixa, opção de lançar como sangria no caixa aberto (E19).
- Permissão `contas` (dono e gerente; terminal nunca vê).

## Critérios de aceite
- Teste: conta de R$ 100 com 2% ao mês, 31 dias de atraso → R$ 104,00 pela regra atual do front.
- Teste: caixa e terminal não leem `bills`.

## Riscos e atenção
- A regra do front difere do usual no Brasil (multa fixa + juros de mora pro rata dia). Se um dono reclamar que o valor não bate com o boleto, a regra pode virar opção em Ajustes.
