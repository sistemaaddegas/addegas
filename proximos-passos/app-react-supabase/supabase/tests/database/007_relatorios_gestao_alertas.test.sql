-- E24, E25, E26, E27, E28, E30 e E31.
begin;
select plan(31);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'marcos', (j ->> 'user_id')::uuid from (select tests.new_store_owner('marcos@x.com', 'Adega Esquina') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-esquina';
insert into k select 'acc', account_id from app.stores where slug = 'adega-esquina';
insert into k values ('gerente', tests.add_member(pg_temp.k('loja'), 'gerente@x.com', 'manager'));
insert into k values ('caixa', tests.add_member(pg_temp.k('loja'), 'caixa@x.com', 'cashier'));
insert into k select 'm_caixa', tests.member_id(pg_temp.k('loja'), pg_temp.k('caixa'));
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'jack', (app.save_product(pg_temp.k('acc'), '{"name":"Jack Daniel''s 1L","price":18000,"volume_ml":1000,"min_stock":2}') -> 'data' ->> 'product_id')::uuid;
insert into k select 'energ', (app.save_product(pg_temp.k('acc'), '{"name":"Energético 250ml","price":1000,"volume_ml":250,"min_stock":0}') -> 'data' ->> 'product_id')::uuid;
select app.receive_goods(pg_temp.k('loja'), jsonb_build_array(
  jsonb_build_object('product_id', pg_temp.k('jack'), 'quantity', 3, 'unit_cost', 12000, 'lot_code', 'J1', 'expires_on', current_date + 3),
  jsonb_build_object('product_id', pg_temp.k('energ'), 'quantity', 24, 'unit_cost', 800)));
select app.update_store_settings(pg_temp.k('loja'), '{"pix_key":"11986755103","pix_receiver_name":"Adega Esquina","pix_city":"Sao Paulo"}');
reset role;

-- Venda pelo terminal para alimentar notinha, Início e relatórios
insert into k values ('term', tests.new_terminal(pg_temp.k('loja')));
select tests.act_as(pg_temp.k('term'));
insert into k select 's', (app.operator_login(pg_temp.k('m_caixa')) -> 'data' ->> 'operator_session_id')::uuid;
select app.open_cash(pg_temp.k('s'), 5000);
insert into k select 'venda', (app.finalize_sale(jsonb_build_object('operator_session_id', pg_temp.k('s'), 'client_request_id', gen_random_uuid(),
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('jack'), 'quantity', 2)),
  'payments', jsonb_build_array(jsonb_build_object('method', 'pix', 'amount', 36000)))) -> 'data' ->> 'sale_id')::uuid;

-- E24 · notinha
select is(app.sale_receipt(pg_temp.k('venda')) -> 'data' ->> 'footer_legal', 'Documento sem valor fiscal', 'notinha marcada como sem valor fiscal');
select is(app.sale_receipt(pg_temp.k('venda')) -> 'data' -> 'pix' ->> 'city', 'SAO PAULO', 'notinha leva os dados do Pix da loja (D15)');
select is(app.sale_receipt(pg_temp.k('venda')) -> 'data' ->> 'operator', 'caixa', 'notinha traz o operador');
select is(app.update_store_settings(pg_temp.k('loja'), '{"pix_key":"chave-invalida"}') -> 'error' ->> 'code', 'FORBIDDEN',
  'terminal não mexe nos ajustes');
reset role;

-- E31 · alertas gerados sozinhos
select ok(exists (select 1 from app.alerts where type = 'cash_opened'), 'abrir o caixa gera alerta (landing)');
select ok(exists (select 1 from app.alerts where type = 'stock_low' and entity_id = pg_temp.k('jack')::text), 'Jack abaixo do mínimo (3 - 2 = 1 < 2) gera alerta');
select is((select count(*)::int from app.alerts where type = 'stock_low'), 1, 'alerta de estoque não se repete no mesmo dia');
select ok(private.run_periodic_alerts() >= 1, 'rotina periódica gera alerta de validade');
select ok(exists (select 1 from app.alerts where type = 'expiry_soon'), 'lote vencendo em 3 dias vira alerta');
select tests.act_as(pg_temp.k('term'));
select app.finalize_sale(jsonb_build_object('operator_session_id', pg_temp.k('s'), 'client_request_id', gen_random_uuid(),
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('energ'), 'quantity', 2)), 'discount', 500,
  'payments', jsonb_build_array(jsonb_build_object('method', 'pix', 'amount', 1500))));
reset role;
select ok(exists (select 1 from app.alerts where type = 'discount_out_of_rule'), 'tentativa de desconto acima do limite vira alerta');

-- E25 · Início e canal em tempo real
select tests.act_as(pg_temp.k('marcos'));
select is((app.dashboard_today(pg_temp.k('loja')) -> 'data' ->> 'sales_total')::int, 36000, 'Início: vendas do dia');
select is((app.dashboard_today(pg_temp.k('loja')) -> 'data' ->> 'open_cash_sessions')::int, 1, 'Início: caixas abertos');
reset role; -- funções do private rodam como postgres, mantendo o JWT do dono
select ok(private.can_join_topic('store:' || pg_temp.k('loja')), 'dono assina o canal da loja');
select tests.act_as(pg_temp.k('caixa'));
select is(app.dashboard_today(pg_temp.k('loja')) -> 'error' ->> 'code', 'FORBIDDEN', 'caixa não vê o Início do dono');
reset role;
select ok(not private.can_join_topic('store:' || gen_random_uuid()), 'canal de outra loja é recusado');

-- E26 · relatórios: margem só com ver_lucro
select tests.act_as(pg_temp.k('marcos'));
select is((app.report_sales(pg_temp.k('loja'), current_date - 1, current_date + 1) -> 'data' ->> 'gross_margin')::int, 36000 - 24000,
  'dono vê a margem bruta (venda 360 − custo 2 x 120)');
reset role;
select tests.act_as(pg_temp.k('gerente'));
select is(app.report_sales(pg_temp.k('loja'), current_date - 1, current_date + 1) -> 'data' -> 'gross_margin', 'null'::jsonb,
  'gerente vê vendas, não margem (D63)');
select is((app.report_sales(pg_temp.k('loja'), current_date - 1, current_date + 1) -> 'data' -> 'by_operator' -> 0 ->> 'name'), 'caixa',
  'vendas por operador (TK-2046/2047)');
reset role;

-- E27 · compras
select tests.act_as(pg_temp.k('gerente'));
insert into k select 'forn', (app.save_supplier(pg_temp.k('acc'), '{"name":"Distribuidora Leste","phone":"11933331000"}') -> 'data' ->> 'supplier_id')::uuid;
insert into k select 'po', (app.save_purchase_order(pg_temp.k('loja'), pg_temp.k('forn'),
  jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('energ'), 'quantity', 10, 'unit_cost_estimate', 800)), 'sent') -> 'data' ->> 'purchase_order_id')::uuid;
select is(app.receive_purchase_order(pg_temp.k('po'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('energ'), 'quantity', 8, 'unit_cost', 800)))
  -> 'data' ->> 'status', 'partially_received', 'receber 8 de 10 deixa o pedido parcial');
select ok(jsonb_array_length(app.purchase_suggestion(pg_temp.k('loja')) -> 'data') >= 1, 'sugestão de compra lista o Jack abaixo do mínimo');
reset role;

-- E28 · contas a pagar (D17)
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'conta', (app.save_bill(pg_temp.k('loja'), jsonb_build_object('description', 'Aluguel', 'amount', 10000,
  'due_on', current_date - 31, 'interest_kind', 'pct_month', 'interest_value', 2, 'recurring_monthly', true)) -> 'data' ->> 'bill_id')::uuid;
select is((app.bills_list(pg_temp.k('loja')) -> 'data' -> 0 ->> 'amount_due_today')::int, 10400, 'R$ 100 a 2% ao mês com 31 dias de atraso = R$ 104 (regra do front)');
select is((app.pay_bill(pg_temp.k('conta'), 'pix') -> 'data' ->> 'paid_amount')::int, 10400, 'pagamento registra o valor com juros');
select is(jsonb_array_length(app.bills_list(pg_temp.k('loja')) -> 'data'), 1, 'conta recorrente gera a do mês seguinte');
reset role;
select tests.act_as(pg_temp.k('caixa'));
select is(app.bills_list(pg_temp.k('loja')) -> 'error' ->> 'code', 'FORBIDDEN', 'caixa não vê contas a pagar');
reset role;

-- E30 · Lucro no Copo (ver_lucro) e anotações
update app.products set avg_cost = 12000 where id = pg_temp.k('jack');
update app.products set avg_cost = 800 where id = pg_temp.k('energ');
select tests.act_as(pg_temp.k('marcos'));
select app.save_drink_recipe(pg_temp.k('acc'), jsonb_build_object('name', 'Jack com energético', 'sale_price', 2500, 'items', jsonb_build_array(
  jsonb_build_object('product_id', pg_temp.k('jack'), 'amount', 50, 'unit', 'ml'),
  jsonb_build_object('product_id', pg_temp.k('energ'), 'amount', 200, 'unit', 'ml'))));
select is((app.drink_costs(pg_temp.k('acc')) -> 'data' -> 0 ->> 'cost')::int, 1240, '50 ml de Jack (120/1000 ml) + 200 ml de energético (8/250 ml) = R$ 12,40');
insert into app.notes (store_id, title, priority) values (pg_temp.k('loja'), 'Ligar para a distribuidora', 'alta');
select is((select count(*)::int from app.notes), 1, 'dono cria anotação direto pela API (RLS)');
reset role;
select tests.act_as(pg_temp.k('gerente'));
select is(app.drink_costs(pg_temp.k('acc')) -> 'error' ->> 'code', 'FORBIDDEN', 'gerente não vê custo do drink (sem ver_lucro)');
reset role;
select tests.act_as(pg_temp.k('caixa'));
select throws_ok($$ insert into app.notes (store_id, title) values (pg_temp.k('loja'), 'x') $$, '42501', null,
  'caixa não cria anotação (sem ferramentas)');
select is((select count(*)::int from app.notes), 1, 'mas lê as anotações da loja (D53)');
reset role;

-- E31 · catálogo público (anon)
set local role anon;
select is(app.public_catalog('adega-esquina') -> 'error' ->> 'code', 'CATALOG_NOT_FOUND', 'catálogo desligado não aparece');
reset role;
update app.catalog_settings set enabled = true where store_id = pg_temp.k('loja');
set local role anon;
select ok(not (app.public_catalog('adega-esquina')::text ~ 'avg_cost|12000'), 'vitrine pública não mostra custo');
reset role;

select * from finish();
rollback;
