-- Renomear mesa/comanda e descartar a vazia (E22).
begin;
select plan(6);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'dono', (j ->> 'user_id')::uuid from (select tests.new_store_owner('tab-dono@x.com', 'Adega Teste Mesa') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-teste-mesa';
insert into k select 'acc', account_id from app.stores where slug = 'adega-teste-mesa';
select tests.act_as(pg_temp.k('dono'));
insert into k select 'm_ana', (app.create_pin_member(pg_temp.k('loja'), 'Ana', 'cashier', '4821') -> 'data' ->> 'member_id')::uuid;
insert into k select 'cerveja', (app.save_product(pg_temp.k('acc'), '{"name":"Cerveja Teste","price":1000}') -> 'data' ->> 'product_id')::uuid;
select app.receive_goods(pg_temp.k('loja'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('cerveja'), 'quantity', 10, 'unit_cost', 500)));
reset role;
insert into k values ('term', tests.new_terminal(pg_temp.k('loja')));

select tests.act_as(pg_temp.k('term'));
insert into k select 's_ana', (app.operator_login(pg_temp.k('m_ana'), '4821') -> 'data' ->> 'operator_session_id')::uuid;
insert into k select 'mesa4', (app.open_tab(pg_temp.k('s_ana'), 'table', 'Mesa 4') -> 'data' ->> 'tab_id')::uuid;
insert into k select 'mesa5', (app.open_tab(pg_temp.k('s_ana'), 'table', 'Mesa 5') -> 'data' ->> 'tab_id')::uuid;
select is(app.rename_tab(pg_temp.k('s_ana'), pg_temp.k('mesa4'), 'Mesa do João') ->> 'ok', 'true', 'renomeia a mesa');
select is(app.rename_tab(pg_temp.k('s_ana'), pg_temp.k('mesa4'), 'mesa 5') -> 'error' ->> 'code', 'TAB_ALREADY_OPEN', 'não repete o nome de outra aberta');
select app.add_tab_item(pg_temp.k('s_ana'), pg_temp.k('mesa5'), pg_temp.k('cerveja'), null, 1);
select is(app.discard_empty_tab(pg_temp.k('s_ana'), pg_temp.k('mesa5')) -> 'error' ->> 'code', 'TAB_NOT_EMPTY', 'com item lançado não descarta');
select is(app.discard_empty_tab(pg_temp.k('s_ana'), pg_temp.k('mesa4')) ->> 'ok', 'true', 'vazia descarta');
reset role;
select is((select label from app.tabs where id = pg_temp.k('mesa4')), 'Mesa do João', 'nome novo gravado');
select is((select status from app.tabs where id = pg_temp.k('mesa4')), 'canceled', 'descartada sai das abertas');

select * from finish();
rollback;
