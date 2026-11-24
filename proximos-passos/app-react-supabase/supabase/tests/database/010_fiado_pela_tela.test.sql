-- E23 · lista e baixa de fiado por quem está logado (fora do terminal).
begin;
select plan(9);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'marcos', (j ->> 'user_id')::uuid from (select tests.new_store_owner('fiado-dono@x.com', 'Adega Teste Fiado') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-teste-fiado';
insert into k values ('estoq', tests.add_member(pg_temp.k('loja'), 'fiado-estoque@x.com', 'stock_keeper'));
insert into app.fiado_accounts (store_id, name, name_norm, phone) values (pg_temp.k('loja'), 'Zé', 'ze', '11986755103');
insert into k select 'ze', id from app.fiado_accounts where store_id = pg_temp.k('loja');
insert into app.fiado_ledger (store_id, fiado_account_id, type, amount) values (pg_temp.k('loja'), pg_temp.k('ze'), 'fiado_sale', 5000);

select tests.act_as(pg_temp.k('marcos'));
select is(app.fiado_accounts_list(pg_temp.k('loja')) -> 'data' -> 0 ->> 'phone', '11986755103', 'dono vê o telefone completo para ligar');
select is((app.fiado_accounts_list(pg_temp.k('loja')) -> 'data' -> 0 ->> 'balance')::int, 5000, 'lista traz o saldo');
select is(app.receive_fiado_by_member(pg_temp.k('loja'), pg_temp.k('ze'), 2000, 'cash') -> 'error' ->> 'code', 'FIADO_PAYMENT_METHOD',
  'dinheiro fora do caixa é recusado (tem de entrar na gaveta)');
select is(app.receive_fiado_by_member(pg_temp.k('loja'), pg_temp.k('ze'), 6000, 'pix') -> 'error' ->> 'code', 'FIADO_PAYMENT_INVALID',
  'não recebe mais do que o saldo');
select is(app.receive_fiado_by_member(pg_temp.k('loja'), pg_temp.k('ze'), 2000, 'pix') -> 'data' ->> 'balance', '3000', 'Pix de R$ 20 baixa o saldo');
reset role;
select is((select balance::int from app.fiado_accounts where id = pg_temp.k('ze')), 3000, 'saldo derivado do livro-razão');
select is((select member_id from app.fiado_ledger where type = 'payment' and fiado_account_id = pg_temp.k('ze')), tests.member_id(pg_temp.k('loja'), pg_temp.k('marcos')),
  'o pagamento registra quem recebeu');

select tests.act_as(pg_temp.k('estoq'));
select is(app.fiado_accounts_list(pg_temp.k('loja')) -> 'error' ->> 'code', 'FORBIDDEN', 'estoquista não vê a lista de fiado');
select is(app.receive_fiado_by_member(pg_temp.k('loja'), pg_temp.k('ze'), 1000, 'pix') -> 'error' ->> 'code', 'FORBIDDEN', 'estoquista não recebe fiado');
reset role;

select * from finish();
rollback;
