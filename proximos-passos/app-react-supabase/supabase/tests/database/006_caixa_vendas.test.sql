-- E19, E20, E21, E22 e E23.
begin;
select plan(48);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

-- Venda pelo terminal: payload com client_request_id novo (ou o informado, para testar repetição).
create function pg_temp.sale(p_session text, p_items jsonb, p_payments jsonb, p_extra jsonb default '{}', p_req uuid default null)
returns jsonb language sql as $$
  select app.finalize_sale(jsonb_build_object('operator_session_id', pg_temp.k(p_session),
    'client_request_id', coalesce(p_req, gen_random_uuid()), 'items', p_items, 'payments', p_payments) || p_extra);
$$;
create function pg_temp.item(p text, q numeric) returns jsonb language sql as $$
  select jsonb_build_object('product_id', pg_temp.k(p), 'quantity', q);
$$;
create function pg_temp.pay(m text, a bigint) returns jsonb language sql as $$
  select jsonb_build_object('method', m, 'amount', a);
$$;
create function pg_temp.stock(p text) returns numeric language sql as $$
  select coalesce((select quantity::numeric from app.product_stock where store_id = pg_temp.k('loja') and product_id = pg_temp.k(p)), 0);
$$;

-- Cenário --------------------------------------------------------------------------------
insert into k select 'marcos', (j ->> 'user_id')::uuid from (select tests.new_store_owner('marcos@x.com', 'Adega Esquina') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-esquina';
insert into k select 'acc', account_id from app.stores where slug = 'adega-esquina';
insert into k values ('gerente', tests.add_member(pg_temp.k('loja'), 'gerente@x.com', 'manager'));
insert into k values ('estoq', tests.add_member(pg_temp.k('loja'), 'estoque@x.com', 'stock_keeper'));
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'm_bruno', (app.create_counter_member(pg_temp.k('loja'), 'Bruno', 'cashier') -> 'data' ->> 'member_id')::uuid;
insert into k select 'heineken', (app.save_product(pg_temp.k('acc'), '{"name":"Heineken Long Neck","price":1000}') -> 'data' ->> 'product_id')::uuid;
insert into k select 'gelo', (app.save_product(pg_temp.k('acc'), '{"name":"Gelo 5kg","price":1400}') -> 'data' ->> 'product_id')::uuid;
select app.receive_goods(pg_temp.k('loja'), jsonb_build_array(
  jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 40, 'unit_cost', 550),
  jsonb_build_object('product_id', pg_temp.k('gelo'), 'quantity', 5, 'unit_cost', 600)));
insert into k select 'balde', (app.save_bundle(pg_temp.k('acc'), jsonb_build_object('name', 'Balde 6', 'price', 4800,
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 6)))) -> 'data' ->> 'bundle_id')::uuid;
reset role;
insert into k select 'm_gerente', tests.member_id(pg_temp.k('loja'), pg_temp.k('gerente'));
insert into k select 'm_estoq', tests.member_id(pg_temp.k('loja'), pg_temp.k('estoq'));
insert into k values ('term', tests.new_terminal(pg_temp.k('loja')));

select tests.act_as(pg_temp.k('term'));
insert into k select 's_estoq', (app.operator_login(pg_temp.k('m_estoq')) -> 'data' ->> 'operator_session_id')::uuid;
select is(app.open_cash(pg_temp.k('s_estoq'), 10000) -> 'error' ->> 'code', 'FORBIDDEN', 'estoquista não abre caixa');
insert into k select 's_bruno', (app.operator_login(pg_temp.k('m_bruno')) -> 'data' ->> 'operator_session_id')::uuid;
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 1)), jsonb_build_array(pg_temp.pay('cash', 1000))) -> 'error' ->> 'code',
  'SALE_CASH_CLOSED', 'sem caixa aberto não vende');

-- Caixa (E19) ------------------------------------------------------------------------------
select is(app.open_cash(pg_temp.k('s_bruno'), 10000) ->> 'ok', 'true', 'caixa abre com fundo de R$ 100');
select is(app.open_cash(pg_temp.k('s_bruno'), 0) -> 'error' ->> 'code', 'CASH_ALREADY_OPEN', 'um caixa aberto por terminal (D11)');

-- Venda (E20) ---------------------------------------------------------------------------------
insert into k values ('req1', gen_random_uuid());
create temp table v1 as select pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 2)), jsonb_build_array(pg_temp.pay('cash', 5000)), '{}', pg_temp.k('req1')) r;
select is((select (r -> 'data' ->> 'total')::int from v1), 2000, 'total calculado no servidor: 2 x R$ 10,00');
select is((select (r -> 'data' ->> 'change')::int from v1), 3000, 'troco de R$ 30');
select is((select (r -> 'data' ->> 'number')::int from v1), 1, 'primeira venda da loja é a #1');
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 2)), jsonb_build_array(pg_temp.pay('cash', 5000)), '{}', pg_temp.k('req1')) -> 'data' ->> 'replayed',
  'true', 'mesma requisição de novo devolve a mesma venda (TK-2051)');
select is(app.finalize_sale(jsonb_build_object('operator_session_id', pg_temp.k('s_bruno'), 'client_request_id', gen_random_uuid(),
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 1, 'unit_price', 1)),
  'payments', jsonb_build_array(pg_temp.pay('pix', 1)))) -> 'error' ->> 'code', 'SALE_PAYMENT_MISMATCH',
  'preço enviado pelo front é ignorado (R$ 0,01 não paga uma Heineken)');
reset role;
select is((select count(*)::int from app.sales), 1, 'repetição não criou venda nova');
select is(pg_temp.stock('heineken'), 38.000, 'estoque baixou 2');
select tests.act_as(pg_temp.k('term'));

-- Desconto (D05, D63): caixa até 5%; acima do limite da função a venda é recusada (vende quem tem limite)
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 2)), jsonb_build_array(pg_temp.pay('pix', 1900)), '{"discount":100}') ->> 'ok',
  'true', 'caixa dá 5%');
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 2)), jsonb_build_array(pg_temp.pay('pix', 1800)), '{"discount":200}') -> 'error' ->> 'code',
  'SALE_DISCOUNT_FORBIDDEN', '10% sem autorização é recusado');
reset role;
select is((select count(*)::int from audit.store_actions where action = 'sale.discount' and outcome = 'denied'), 1, 'tentativa fora da regra auditada');
select tests.act_as(pg_temp.k('term'));

-- Pagamentos
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 1)), jsonb_build_array(pg_temp.pay('pix', 1500))) -> 'error' ->> 'code',
  'SALE_PAYMENT_MISMATCH', 'troco só sai de dinheiro, não de Pix');
create temp table v3 as select pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 3), pg_temp.item('gelo', 1)),
  jsonb_build_array(pg_temp.pay('pix', 2000), pg_temp.pay('cash', 3000))) r;
select is((select (r -> 'data' ->> 'change')::int from v3), 600, 'misto: R$ 44 em R$ 20 Pix + R$ 30 dinheiro = R$ 6 de troco');

-- Fiado (D55, D55b)
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 1)), jsonb_build_array(pg_temp.pay('fiado', 1000)),
  '{"fiado":{"name":"Zé da oficina"}}') -> 'error' ->> 'code', 'FIADO_NAME_PHONE_REQUIRED', 'fiado exige nome e telefone');
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 1)), jsonb_build_array(pg_temp.pay('fiado', 1000)),
  '{"fiado":{"name":"Zé da oficina","phone":"(11) 98675-5103"}}') ->> 'ok', 'true', 'fiado com nome e telefone cria a pessoa na hora');
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('gelo', 1)), jsonb_build_array(pg_temp.pay('fiado', 1400)),
  '{"fiado":{"name":"Zé","phone":"11986755103"}}') ->> 'ok', 'true', 'mesmo telefone, nome diferente');
reset role;
select is((select count(*)::int from app.fiado_accounts), 1, 'telefone é a chave: um fiado só');
select is((select balance::int from app.fiado_accounts), 2400, 'saldo do fiado R$ 24');
insert into k select 'ze', id from app.fiado_accounts;
update app.fiado_accounts set credit_limit = 3000 where id = pg_temp.k('ze');
select tests.act_as(pg_temp.k('term'));
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('heineken', 1)), jsonb_build_array(pg_temp.pay('fiado', 1000)),
  jsonb_build_object('fiado', jsonb_build_object('fiado_account_id', pg_temp.k('ze')))) -> 'error' ->> 'code', 'SALE_FIADO_LIMIT', 'limite de R$ 30 respeitado');
select is((app.find_fiado(pg_temp.k('loja'), 'ze') -> 'data' -> 0 ->> 'phone'), '(11) •••••-5103', 'no terminal o telefone vem mascarado');

-- Estoque negativo (D06) e combo (E18)
reset role;
update app.store_settings set block_negative_stock = true where store_id = pg_temp.k('loja');
select tests.act_as(pg_temp.k('term'));
select is(pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('gelo', 10)), jsonb_build_array(pg_temp.pay('pix', 14000))) -> 'error' ->> 'code',
  'SALE_STOCK_INSUFFICIENT', 'loja que bloqueia negativo recusa');
reset role;
update app.store_settings set block_negative_stock = false where store_id = pg_temp.k('loja');
select tests.act_as(pg_temp.k('term'));
create temp table v4 as select pg_temp.sale('s_bruno', jsonb_build_array(pg_temp.item('gelo', 10)), jsonb_build_array(pg_temp.pay('pix', 14000))) r;
select is((select r -> 'data' -> 'sold_without_stock' ->> 0 from v4), pg_temp.k('gelo')::text, 'por padrão vende e marca "vendido sem estoque" (D06)');
select is(app.finalize_sale(jsonb_build_object('operator_session_id', pg_temp.k('s_bruno'), 'client_request_id', gen_random_uuid(),
  'items', jsonb_build_array(jsonb_build_object('bundle_id', pg_temp.k('balde'), 'quantity', 1)),
  'payments', jsonb_build_array(pg_temp.pay('debit', 4800)))) ->> 'ok', 'true', 'combo vendido');
reset role;
select is(pg_temp.stock('gelo'), -7.000, 'estoque do gelo ficou negativo (5 - 1 - 1 - 10 = -7)');
select is(pg_temp.stock('heineken'), 26.000, 'combo baixou 6 Heineken (40 - 2 - 2 - 3 - 1 - 6 = 26)');
select ok((select bool_and(ps.quantity = (select coalesce(sum(m.quantity), 0) from app.stock_movements m
  where m.store_id = ps.store_id and m.product_id = ps.product_id)) from app.product_stock ps), 'saldo = livro-razão depois das vendas');

-- Cancelamento (E21, D10)
select tests.act_as(pg_temp.k('term'));
select is(app.cancel_sale(pg_temp.k('s_bruno'), (select (r -> 'data' ->> 'sale_id')::uuid from v3), 'cliente desistiu') -> 'error' ->> 'code',
  'FORBIDDEN', 'caixa não cancela');
insert into k select 's_gerente', (app.operator_login(pg_temp.k('m_gerente')) -> 'data' ->> 'operator_session_id')::uuid;
select is(app.cancel_sale(pg_temp.k('s_gerente'), (select (r -> 'data' ->> 'sale_id')::uuid from v3), 'cliente desistiu') -> 'data' ->> 'refund_cash',
  '2400', 'gerente cancela; devolve só a parte em dinheiro (R$ 30 - R$ 6 de troco)');
select is(app.cancel_sale(pg_temp.k('s_gerente'), (select (r -> 'data' ->> 'sale_id')::uuid from v3), 'de novo') -> 'error' ->> 'code',
  'SALE_ALREADY_CANCELED', 'não cancela duas vezes');
reset role;
select is(pg_temp.stock('heineken'), 29.000, 'cancelamento devolveu 3 Heineken');

-- Comandas (E22, D41, D11)
select tests.act_as(pg_temp.k('term'));
insert into k select 's_bruno2', (app.operator_login(pg_temp.k('m_bruno')) -> 'data' ->> 'operator_session_id')::uuid;
insert into k select 'mesa4', (app.open_tab(pg_temp.k('s_bruno2'), 'table', 'Mesa 4') -> 'data' ->> 'tab_id')::uuid;
select is(app.open_tab(pg_temp.k('s_bruno2'), 'table', 'mesa 4') -> 'error' ->> 'code', 'TAB_ALREADY_OPEN', 'Mesa 4 não abre duas vezes');
insert into k select 'item_a', (app.add_tab_item(pg_temp.k('s_bruno2'), pg_temp.k('mesa4'), pg_temp.k('heineken'), null, 3) -> 'data' ->> 'tab_item_id')::uuid;
select app.add_tab_item(pg_temp.k('s_bruno2'), pg_temp.k('mesa4'), pg_temp.k('heineken'), null, 2);
reset role;
select is(pg_temp.stock('heineken'), 24.000, 'item lançado na comanda já baixa o estoque (D41)');
select tests.act_as(pg_temp.k('term'));
select is(app.remove_tab_item(pg_temp.k('s_bruno2'), pg_temp.k('item_a'), 'lançado errado') ->> 'ok', 'true', 'tira item da comanda');
reset role;
select is(pg_temp.stock('heineken'), 27.000, 'tirar item devolve o estoque');
select tests.act_as(pg_temp.k('term'));
select is(app.close_cash(pg_temp.k('s_bruno2'), 0) -> 'error' ->> 'code', 'CASH_OPEN_TABS', 'comanda aberta bloqueia o fechamento (D11)');
select is(app.close_tab(pg_temp.k('mesa4'), jsonb_build_object('operator_session_id', pg_temp.k('s_bruno2'), 'client_request_id', gen_random_uuid(),
  'payments', jsonb_build_array(pg_temp.pay('cash', 2000)))) -> 'data' ->> 'total', '2000', 'fechar a comanda vira venda com os itens dela');
reset role;
select is(pg_temp.stock('heineken'), 27.000, 'fechar a comanda não baixa o estoque de novo');
select ok((select bool_and(stock_from_tab) from app.sale_items si join app.sales s on s.id = si.sale_id where s.tab_id = pg_temp.k('mesa4')),
  'itens da venda marcados como vindos da comanda');

-- Fiado: pagamento em dinheiro entra no caixa
select tests.act_as(pg_temp.k('term'));
select is(app.receive_fiado_payment(pg_temp.k('s_bruno2'), pg_temp.k('ze'), 1000, 'cash') -> 'data' ->> 'balance', '1400', 'Zé paga R$ 10');

-- Fechamento (E19): esperado = fundo + entradas em dinheiro − troco − estornos + fiado recebido
create temp table fc as select app.close_cash(pg_temp.k('s_bruno2'), 18000) r;
reset role;
select is((select (r -> 'data' ->> 'expected_cash')::int from fc), 10000 + 5000 - 3000 + 3000 - 600 - 2400 + 2000 + 1000,
  'esperado em dinheiro bate com os movimentos');
select is((select (r -> 'data' ->> 'difference')::int from fc), 18000 - 15000, 'diferença = contado − esperado');
select is((select count(distinct number)::int = count(*)::int from app.sales)::int, 1, 'números de venda sem repetição');
select throws_ok($$ delete from app.cash_movements $$, 'P0001', 'LEDGER_IMMUTABLE', 'movimento de caixa não se apaga');

-- Leitura (RLS)
select tests.act_as(pg_temp.k('marcos'));
select ok((select count(*) from app.sales) > 0, 'dono lê as vendas');
select throws_ok($$ select unit_cost from app.sale_items $$, '42501', null, 'custo congelado não sai pela tabela (D63)');
reset role;

select * from finish();
rollback;
