-- Foto do perfil, excluir promoção e novo cliente do fiado.
begin;
select plan(11);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'dono', (j ->> 'user_id')::uuid from (select tests.new_store_owner('menus-dono@x.com', 'Adega Teste Menus') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-teste-menus';
insert into k select 'conta', account_id from app.stores where slug = 'adega-teste-menus';
insert into k values ('caixa', tests.add_member(pg_temp.k('loja'), 'menus-caixa@x.com', 'cashier'));
insert into app.products (account_id, name, price) values (pg_temp.k('conta'), 'Cerveja Teste', 500);
insert into k select 'prod', id from app.products where account_id = pg_temp.k('conta');
insert into app.bundles (account_id, name, price) values (pg_temp.k('conta'), 'Combo Teste', 900);
insert into k select 'combo', id from app.bundles where account_id = pg_temp.k('conta');
insert into app.bundle_items (bundle_id, account_id, product_id, quantity) values (pg_temp.k('combo'), pg_temp.k('conta'), pg_temp.k('prod'), 2);
insert into app.quick_access (store_id, position, bundle_id) values (pg_temp.k('loja'), 0, pg_temp.k('combo'));

select tests.act_as(pg_temp.k('dono'));
update app.profiles set avatar = 'data:image/jpeg;base64,AAAA' where id = pg_temp.k('dono');
select is((select avatar from app.profiles where id = pg_temp.k('dono')), 'data:image/jpeg;base64,AAAA', 'a pessoa grava a própria foto');
select throws_ok($$ update app.profiles set avatar = 'https://x.com/a.png' where id = pg_temp.k('dono') $$, '23514', null, 'só aceita imagem em data URL');

select is(app.archive_bundle(pg_temp.k('conta'), pg_temp.k('combo')) ->> 'ok', 'true', 'dono exclui a promoção');
reset role;
select ok((select archived_at is not null and not active from app.bundles where id = pg_temp.k('combo')), 'promoção arquivada e inativa, sem apagar');
select is((select count(*)::int from app.quick_access where bundle_id = pg_temp.k('combo')), 0, 'sai do acesso rápido');

select tests.act_as(pg_temp.k('dono'));
select is(app.archive_bundle(pg_temp.k('conta'), pg_temp.k('combo')) -> 'error' ->> 'code', 'BUNDLE_NOT_FOUND', 'excluir de novo não faz nada');
select is(app.create_fiado_account(pg_temp.k('loja'), 'Juninho', '+55 (11) 98888-7777', 15000, null) ->> 'ok', 'true', 'cadastra cliente do fiado');
select is(app.create_fiado_account(pg_temp.k('loja'), 'Outro', '11988887777') -> 'error' ->> 'code', 'FIADO_PHONE_EXISTS', 'mesmo telefone não duplica');
select is(app.create_fiado_account(pg_temp.k('loja'), 'Sem fone', '123') -> 'error' ->> 'code', 'FIADO_PHONE_INVALID', 'telefone inválido');
reset role;
select is((select phone from app.fiado_accounts where store_id = pg_temp.k('loja')), '11988887777', 'telefone guardado só com dígitos, sem o 55');

select tests.act_as(pg_temp.k('caixa'));
select is(app.create_fiado_account(pg_temp.k('loja'), 'Bia', '11977776666') -> 'error' ->> 'code', 'FORBIDDEN', 'caixa não cadastra cliente');
reset role;

select * from finish();
rollback;
