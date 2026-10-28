-- E16, E17 e E18.
begin;
select plan(29);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

-- Cenário: Marcos com 2 lojas; gerente, caixa e estoquista na loja 1; Bia em outra conta.
insert into k select 'marcos', (j ->> 'user_id')::uuid from (select tests.new_store_owner('marcos@x.com', 'Adega Esquina') j) s;
insert into k select 'acc', account_id from app.stores where slug = 'adega-esquina';
insert into k select 'loja1', id from app.stores where slug = 'adega-esquina';
update platform.subscriptions set extra_stores = 1 where account_id = pg_temp.k('acc');
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'loja2', (app.create_store(pg_temp.k('acc'), 'Adega Esquina 2') -> 'data' ->> 'store_id')::uuid;
reset role;
insert into k values ('gerente', tests.add_member(pg_temp.k('loja1'), 'gerente@x.com', 'manager'));
insert into k values ('caixa', tests.add_member(pg_temp.k('loja1'), 'caixa@x.com', 'cashier'));
insert into k values ('estoque', tests.add_member(pg_temp.k('loja1'), 'estoque@x.com', 'stock_keeper'));
insert into k select 'bia', (j ->> 'user_id')::uuid from (select tests.new_store_owner('bia@y.com', 'Adega da Bia') j) s;
insert into k select 'loja_bia', id from app.stores where slug = 'adega-da-bia';

insert into platform.catalog_products (ean, name, brand, volume_ml, status) values
  ('7896045506873', 'Heineken Long Neck 330ml', 'Heineken', 330, 'published'),
  ('7891149108718', 'Brahma Duplo Malte lata 350ml', 'Brahma', 350, 'published'),
  ('0000000000001', 'Rascunho que não aparece', null, null, 'draft');
insert into k select 'cat_heineken', id from platform.catalog_products where ean = '7896045506873';

-- Catálogo mestre (E16) ------------------------------------------------------------------
select tests.act_as(pg_temp.k('marcos'));
select is(jsonb_array_length(app.search_catalog('heine') -> 'data'), 1, 'busca "heine" acha a Heineken');
select is(jsonb_array_length(app.search_catalog('Rascunho') -> 'data'), 0, 'rascunho do catálogo não aparece para a adega');
select is(app.add_products_from_catalog(pg_temp.k('loja1'),
  jsonb_build_array(jsonb_build_object('catalog_id', pg_temp.k('cat_heineken'),
    'price', 1000, 'initial_qty', 0))) -> 'data' ->> 'created', '1', 'produto criado a partir do catálogo');
reset role;
insert into k select 'heineken', id from app.products where ean = '7896045506873';

-- Produto e permissões
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'gelo', (app.save_product(pg_temp.k('acc'), '{"name":"Gelo 5kg","price":1400,"unit":"un","min_stock":10}') -> 'data' ->> 'product_id')::uuid;
select is(app.save_product(pg_temp.k('acc'), jsonb_build_object('name', 'Outra Heineken', 'ean', '7896045506873', 'price', 900)) -> 'error' ->> 'code',
  'PRODUCT_EAN_DUPLICATE', 'mesmo EAN na mesma conta é recusado');
reset role;
select tests.act_as(pg_temp.k('caixa'));
select is(app.save_product(pg_temp.k('acc'), '{"name":"Hack","price":1}') -> 'error' ->> 'code', 'FORBIDDEN', 'caixa não cria produto');
select is((select count(*)::int from app.products), 2, 'caixa lê os produtos da conta');
select throws_ok($$ select avg_cost from app.products $$, '42501', null, 'caixa não lê o custo direto da tabela (D63)');
reset role;
select tests.act_as(pg_temp.k('bia'));
select is((select count(*)::int from app.products), 0, 'Bia não vê produtos de outra conta');
reset role;

-- Preço por loja (D37) -------------------------------------------------------------------
select tests.act_as(pg_temp.k('marcos'));
select is(app.set_store_product(pg_temp.k('loja2'), pg_temp.k('heineken'), 1200) -> 'data' ->> 'effective_price', '1200', 'Loja 2 com preço próprio');
reset role;
select is(private.effective_price(pg_temp.k('loja1'), pg_temp.k('heineken')), 1000::bigint, 'Loja 1 usa o preço padrão');
select is(private.effective_price(pg_temp.k('loja2'), pg_temp.k('heineken')), 1200::bigint, 'Loja 2 usa o próprio');
select tests.act_as(pg_temp.k('marcos'));
select app.set_store_product(pg_temp.k('loja2'), pg_temp.k('heineken'), null);
reset role;
select is(private.effective_price(pg_temp.k('loja2'), pg_temp.k('heineken')), 1000::bigint, 'sem preço próprio, volta ao padrão');

-- Estoque (E17) --------------------------------------------------------------------------
select tests.act_as(pg_temp.k('estoque'));
select is(app.receive_goods(pg_temp.k('loja1'), jsonb_build_array(
  jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 10, 'unit_cost', 500, 'lot_code', 'L1', 'expires_on', current_date + 10),
  jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 10, 'unit_cost', 700, 'lot_code', 'L2', 'expires_on', current_date + 60)
)) ->> 'ok', 'true', 'estoquista dá entrada de mercadoria');
select is(app.save_product(pg_temp.k('acc'), '{"name":"X","price":1}') -> 'error' ->> 'code', 'FORBIDDEN', 'estoquista não mexe em preço');
reset role;
select is((select avg_cost::bigint from app.products where id = pg_temp.k('heineken')), 600::bigint, 'custo médio ponderado: 10 a 5,00 + 10 a 7,00 = 6,00 (D08)');
select is((select quantity::numeric from app.product_stock where store_id = pg_temp.k('loja1') and product_id = pg_temp.k('heineken')), 20.000, 'saldo 20');

select tests.act_as(pg_temp.k('estoque'));
select is(app.register_stock_change(pg_temp.k('loja1'), pg_temp.k('heineken'), 'quebra', 3, '') -> 'error' ->> 'code',
  'STOCK_REASON_REQUIRED', 'perda sem motivo é recusada');
select is(app.register_stock_change(pg_temp.k('loja1'), pg_temp.k('heineken'), 'quebra', 3, 'caiu da prateleira') ->> 'ok', 'true', 'perda registrada');
reset role;
select is((select remaining_qty::numeric from app.stock_lots where code = 'L1'), 7.000, 'a perda saiu do lote que vence primeiro (D07)');

-- Contagem com venda no meio: aplica só a diferença do momento da contagem
select tests.act_as(pg_temp.k('estoque'));
insert into k select 'contagem', (app.open_stock_count(pg_temp.k('loja1')) -> 'data' ->> 'count_id')::uuid;
select app.save_count_item(pg_temp.k('contagem'), pg_temp.k('heineken'), 15);
select app.register_stock_change(pg_temp.k('loja1'), pg_temp.k('heineken'), 'consumo', 1, 'degustação');
select is(app.apply_stock_count(pg_temp.k('contagem')) -> 'data' ->> 'adjusted_items', '1', 'contagem aplicada');
reset role;
select is((select quantity::numeric from app.product_stock where store_id = pg_temp.k('loja1') and product_id = pg_temp.k('heineken')), 14.000,
  'contou 15 com saldo 17; depois saiu 1: saldo final 14 (17 - 1 - 2)');

-- Transferência (D37)
select tests.act_as(pg_temp.k('marcos'));
select is(app.transfer_stock(pg_temp.k('loja1'), pg_temp.k('loja2'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 4))) ->> 'ok',
  'true', 'transferência entre lojas da conta');
select is(app.transfer_stock(pg_temp.k('loja1'), pg_temp.k('loja_bia'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 1))) -> 'error' ->> 'code',
  'FORBIDDEN', 'não transfere para loja de outra conta');
reset role;
select ok(
  (select bool_and(ps.quantity = (select coalesce(sum(m.quantity), 0) from app.stock_movements m
    where m.store_id = ps.store_id and m.product_id = ps.product_id)) from app.product_stock ps),
  'saldo = soma do livro-razão em todas as lojas'
);
select throws_ok($$ update app.stock_movements set quantity = 100 $$, 'P0001', 'LEDGER_IMMUTABLE', 'movimento de estoque não se altera');

-- Combos e custo visível só com ver_lucro (E18, D63) ----------------------------------------
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'balde', (app.save_bundle(pg_temp.k('acc'), jsonb_build_object('name', 'Balde 6 long necks', 'price', 4200,
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('heineken'), 'quantity', 6)))) -> 'data' ->> 'bundle_id')::uuid;
select is((select (e ->> 'avg_cost')::bigint from jsonb_array_elements(app.store_products_list(pg_temp.k('loja1')) -> 'data') e
  where e ->> 'name' like 'Heineken%'), 600::bigint, 'dono vê o custo na lista');
reset role;
select ok(private.bundle_is_live(pg_temp.k('balde'), pg_temp.k('loja1')), 'combo disponível');
update app.products set active = false where id = pg_temp.k('heineken');
select ok(not private.bundle_is_live(pg_temp.k('balde'), pg_temp.k('loja1')), 'item inativo derruba o combo (E18)');
update app.products set active = true where id = pg_temp.k('heineken');

select tests.act_as(pg_temp.k('gerente'));
select is((select e -> 'avg_cost' from jsonb_array_elements(app.store_products_list(pg_temp.k('loja1')) -> 'data') e
  where e ->> 'name' like 'Heineken%'), 'null'::jsonb, 'gerente não recebe o custo (sem ver_lucro)');
reset role;

select * from finish();
rollback;
