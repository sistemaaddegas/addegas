-- E39 · catálogo Addegas para a adega e fila de sugestões para a equipe.
begin;
select plan(12);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'dono', (j ->> 'user_id')::uuid from (select tests.new_store_owner('dono-cat@x.com', 'Adega Catálogo') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-catalogo';
insert into k select 'acc', account_id from app.stores where slug = 'adega-catalogo';
insert into k values ('equipe', tests.new_user('cat@addegas.com.br', 'staff'));
select private.admin_staff_upsert(null, 'seed', pg_temp.k('equipe'), 'Cat', 'cat@addegas.com.br', 'support');
insert into k select 'cp', (private.admin_catalog_save(pg_temp.k('equipe'), 'support',
  '{"name":"Cerveja do Catálogo 350 ml","brand":"Teste","category":"Cervejas","ean":"7890000000123","volume":"350","status":"published"}') -> 'data' ->> 'catalog_product_id')::uuid;

select tests.act_as(pg_temp.k('dono'));
select is((select (x ->> 'already')::boolean from jsonb_array_elements(app.search_catalog_for_store(pg_temp.k('loja'), '7890000000123') -> 'data') x),
  false, 'adega acha o produto do catálogo pelo código de barras');
select is(app.add_products_from_catalog(pg_temp.k('loja'), jsonb_build_array(jsonb_build_object('catalog_id', pg_temp.k('cp'), 'price', 900))) -> 'data' ->> 'created',
  '1', 'importa do catálogo');
select is(app.add_products_from_catalog(pg_temp.k('loja'), jsonb_build_array(jsonb_build_object('catalog_id', pg_temp.k('cp'), 'price', 900))) -> 'data' ->> 'already',
  '1', 'importar de novo não duplica');
select is((select (x ->> 'already')::boolean from jsonb_array_elements(app.search_catalog_for_store(pg_temp.k('loja'), '7890000000123') -> 'data') x),
  true, 'a busca mostra que a adega já tem');
insert into k select 'local', (app.save_product(pg_temp.k('acc'), '{"name":"Licor da Casa","ean":"7890000000222","price":3000}') -> 'data' ->> 'product_id')::uuid;
insert into k select 'outro', (app.save_product(pg_temp.k('acc'), '{"name":"Gelo de coco","price":800}') -> 'data' ->> 'product_id')::uuid;
reset role;

select is((select status from platform.catalog_suggestions where product_id = pg_temp.k('local')), 'pendente', 'produto fora do catálogo vai para a fila');
select is((select count(*)::int from platform.catalog_suggestions where account_id = pg_temp.k('acc')), 2, 'só os produtos fora do catálogo entram na fila');
insert into k select 'sug', id from platform.catalog_suggestions where product_id = pg_temp.k('local');
insert into k select 'sug2', id from platform.catalog_suggestions where product_id = pg_temp.k('outro');

select is(private.admin_catalog_suggestion(pg_temp.k('equipe'), 'support', pg_temp.k('sug'), 'approve', '{"name":"Licor da Casa 700 ml","category":"Destilados"}') ->> 'ok',
  'true', 'equipe aprova a sugestão');
select isnt((select catalog_product_id from app.products where id = pg_temp.k('local')), null, 'aprovar liga o produto da adega ao catálogo');
select is((select status from platform.catalog_products where ean = '7890000000222'), 'published', 'com EAN, entra publicado no catálogo');
select is(private.admin_catalog_suggestion(pg_temp.k('equipe'), 'support', pg_temp.k('sug'), 'approve', '{}') -> 'error' ->> 'code',
  'SUGGESTION_ALREADY_REVIEWED', 'não analisa duas vezes');
select is(private.admin_catalog_suggestion(pg_temp.k('equipe'), 'support', pg_temp.k('sug2'), 'reject', '{"reason":""}') -> 'error' ->> 'code',
  'REASON_REQUIRED', 'recusar exige motivo');

-- Cadastro manual com um código que já está no catálogo liga sozinho e não vira sugestão.
insert into k select 'p3', id from platform.catalog_products where ean = '7890000000222';
select tests.act_as(pg_temp.k('dono'));
select app.save_product(pg_temp.k('acc'), '{"name":"Cerveja do catálogo (digitada)","ean":"7890000000123","price":900}');
reset role;
insert into k select 'acc2', (j ->> 'user_id')::uuid from (select tests.new_store_owner('dono-cat2@x.com', 'Adega Catálogo 2') j) s;
insert into k select 'a2', account_id from app.stores where slug = 'adega-catalogo-2';
select tests.act_as(pg_temp.k('acc2'));
select app.save_product(pg_temp.k('a2'), '{"name":"Licor digitado","ean":"7890000000222","price":3100}');
reset role;
select is((select catalog_product_id from app.products where account_id = pg_temp.k('a2') and ean = '7890000000222'), pg_temp.k('p3'),
  'outra adega com o mesmo código já nasce ligada ao produto aprovado');

select * from finish();
rollback;
