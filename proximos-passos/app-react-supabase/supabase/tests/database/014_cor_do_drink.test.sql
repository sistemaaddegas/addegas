-- Cor de fundo do drink salvo no Lucro no Copo.
begin;
select plan(4);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'dono', (j ->> 'user_id')::uuid from (select tests.new_store_owner('drink-dono@x.com', 'Adega Teste Drink') j) s;
insert into k select 'conta', account_id from app.stores where slug = 'adega-teste-drink';
insert into app.products (account_id, name, price) values (pg_temp.k('conta'), 'Vodka Teste', 4000);
insert into k select 'prod', id from app.products where account_id = pg_temp.k('conta');

select tests.act_as(pg_temp.k('dono'));
insert into k select 'r', (app.save_drink_recipe(pg_temp.k('conta'), jsonb_build_object('name', 'Caipiroska', 'sale_price', 2500, 'color', '#FF2D55',
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('prod'), 'amount', 50, 'unit', 'ml')))) -> 'data' ->> 'recipe_id')::uuid;
select is((select color from app.drink_recipes where id = pg_temp.k('r')), '#FF2D55', 'salva o drink com a cor');
select is(app.save_drink_recipe(pg_temp.k('conta'), jsonb_build_object('id', pg_temp.k('r'), 'color', '#1ED760')) ->> 'ok', 'true', 'troca só a cor');
select is((select count(*)::int from app.drink_recipe_items where recipe_id = pg_temp.k('r')), 1, 'trocar a cor não apaga os itens');
reset role;
select is((select color from app.drink_recipes where id = pg_temp.k('r')), '#1ED760', 'cor nova gravada');

select * from finish();
rollback;
