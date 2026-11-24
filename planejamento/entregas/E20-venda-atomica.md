# E20 · Venda atômica: `finalize_sale`

**Marco:** M4 · Núcleo | **Tamanho:** G | **Depende de:** E17, E18, E19, `D05`, `D06`, `D15` | **Desbloqueia:** E21 a E26, E41
**Origem:** §5 ("Venda é uma RPC atômica", "Numeração por loja"), §9 ("Dois caixas vendendo o mesmo produto")
**Decisões aplicadas:** D05 (limite de desconto por função + autorização do gerente por PIN), D06 (estoque negativo permitido, salvo se a loja bloquear), D14 (só online + contingência), D15 (Pix só registrado, com QR estático), D37 (preço efetivo da loja), D42 (taxa de entrega na venda), D19/D55 (fiado só com nome)

## Objetivo
Fechar uma venda em uma única chamada, numa transação curta, sem duplicar, sem travar e sem deixar estoque, caixa e fiado inconsistentes.

## Entra
- `app.sales` (store_id, número por loja, cash_session_id, terminal_id, operator_member_id, tab_id, fiado_account_id, order_id, channel, taxa de entrega, origem (`normal`/`contingency`), subtotal, desconto, total, status, **client_request_id**, `business_date`, created_at), `unique (store_id, number)`, `unique (store_id, client_request_id)`.
- `app.sale_items` (sale_id, store_id, product_id ou bundle_id, nome congelado, vendido sem estoque (sim/não), quantidade, preço unitário, desconto do item, **custo unitário congelado**, total), FK composta `(sale_id, store_id)`.
- `app.sale_payments` (sale_id, store_id, forma `pix`/`credit`/`debit`/`cash`/`fiado`, valor, troco), FK composta.
- `app.store_counters` (store_id, nome, valor) para o número da venda (#1043) via `update ... returning` (§9).
- RPC `app.finalize_sale(payload)`:
  1. **idempotência [novo]**: se já existe venda com o mesmo `client_request_id` na loja, devolve a venda existente sem gravar nada (resolve o caso TK-2051, "caixa travou e o cliente pagou de novo");
  2. valida sessão de operador (E10) e caixa aberto (E19);
  3. valida permissões: `vender`; `desconto` se houver desconto, com o percentual dentro do limite da função ou com o token de autorização do gerente (E10); `fiado` se houver pagamento fiado;
  4. recalcula preços **no servidor**: preço efetivo da loja (`coalesce(preço da loja, preço padrão)`, E16) e combos/promoções vigentes (E18/E29); o preço enviado pelo front é só conferido;
  5. trava os saldos dos produtos na loja em ordem de id (`select ... for update order by product_id`) para evitar deadlock (§9);
  6. estoque: permite negativo e marca o item como "vendido sem estoque", a não ser que a loja tenha ligado o bloqueio (`SALE_STOCK_INSUFFICIENT`);
  7. confere soma dos pagamentos = total (com a taxa de entrega, quando houver, E41); troco só em dinheiro;
  8. fiado: localiza ou cria o fiado pelo nome (E23), confere o limite se houver e grava no `fiado_ledger`;
  9. grava venda, itens, pagamentos, movimentos de estoque (E17) e de caixa (E19);
  10. gera número da loja e devolve `{ sale_id, number, total, troco }`.
- Erros com código estável: `SALE_CASH_CLOSED`, `SALE_OPERATOR_INVALID`, `SALE_DISCOUNT_FORBIDDEN`, `SALE_FIADO_LIMIT`, `SALE_PAYMENT_MISMATCH`, `SALE_STOCK_INSUFFICIENT`.
- `revoke insert, update, delete` direto em `sales`, `sale_items`, `sale_payments` para `authenticated`: só a RPC escreve.

## Não entra
- Cancelamento (E21), comanda (E22), impressão (E24).
- Pagamento processado pelo sistema: o Pix e o cartão são **só registrados** (§10, D15).

## Pix com QR estático (D15) **[novo]**
- Ao escolher Pix, o front monta o **BR Code** (padrão EMV do Banco Central, o mesmo do "Pix copia e cola") com a chave, o nome e a cidade da loja (E31), o valor da venda e o número da venda como identificador (`txid`), calcula o CRC16 e desenha o QR na tela. Não passa por servidor nem por gateway.
- O operador confere no app do banco ou na maquininha e confirma; a venda grava `method = 'pix'`, como hoje.
- Função pura `buildPixPayload({ chave, nome, cidade, valor, txid })` com testes contra exemplos oficiais do manual do BR Code; o mesmo QR pode sair na notinha (E24).

## Contingência sem internet (D14) **[novo]**
- Só online na v1. Se a chamada falhar por rede, o front mantém a venda na tela e reenvia com o **mesmo** `client_request_id` (sem risco de duplicar).
- Tela "Modo contingência": se a rede cair por mais de alguns segundos, o operador anota no próprio app (salvo no aparelho) valor, forma de pagamento e itens principais. Quando a rede volta, cada anotação vira uma venda pelo `finalize_sale`, marcada como `contingency` e conferida pelo gerente. Não baixa estoque nem numera nada enquanto estiver offline.

## Critérios de aceite
- Teste: mesma venda enviada 3 vezes com o mesmo `client_request_id` → 1 venda, 3 respostas iguais.
- Teste de concorrência (pgbench ou script): 2 terminais vendendo o mesmo produto 500 vezes em paralelo → sem deadlock, saldo final correto, números sem repetição.
- Teste: front envia preço R$ 1,00 para produto de R$ 10,00 → venda sai a R$ 10,00 (ou é recusada).
- Teste: pagamento misto (R$ 20 Pix + R$ 30 dinheiro com troco de R$ 5) → caixa registra R$ 30 de entrada e R$ 5 de troco.
- p95 da RPC < 150 ms com 50 itens.

## Riscos e atenção
- A contingência (D14) cobre quedas curtas. Uma loja com internet ruim o tempo todo vai sofrer; vale perguntar sobre a conexão da loja no onboarding do piloto.
- Pix sem confirmação automática: o operador pode confirmar sem o dinheiro ter entrado. O relatório de vendas em Pix por operador ajuda o dono a conferir com o extrato.
- Número da venda sem buracos não é garantido se a transação falhar depois do `update` do contador (ela desfaz, então não há buraco). Não usar `sequence`, que gera buracos.
