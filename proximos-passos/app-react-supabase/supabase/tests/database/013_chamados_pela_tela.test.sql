-- Chamado aberto pela tela, com anexo, e a lista "Meus tickets".
begin;
select plan(6);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'dono', (j ->> 'user_id')::uuid from (select tests.new_store_owner('tk-dono@x.com', 'Adega Teste Ticket') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-teste-ticket';
insert into k select 'conta', account_id from app.stores where slug = 'adega-teste-ticket';
insert into k select 'outro', (j ->> 'user_id')::uuid from (select tests.new_store_owner('tk-outro@x.com', 'Adega Teste Ticket Outra') j) s;

select tests.act_as(pg_temp.k('dono'));
insert into k select 'tk', (app.open_ticket(pg_temp.k('conta'), pg_temp.k('loja'), 'problema', 'Impressora / cupom', 'O cupom sai cortado na Elgin', 'parou') -> 'data' ->> 'ticket_id')::uuid;
reset role;
insert into platform.files (bucket, path, account_id, size_bytes, mime, original_name, sha256, uploaded_by)
values ('ticket-attachments', pg_temp.k('conta') || '/' || pg_temp.k('tk') || '/a.png', pg_temp.k('conta'), 10, 'image/png', 'print.png', 'x', pg_temp.k('dono'));

select tests.act_as(pg_temp.k('dono'));
select is(app.attach_ticket_file(pg_temp.k('tk'), pg_temp.k('conta') || '/' || pg_temp.k('tk') || '/a.png') ->> 'ok', 'true', 'anexa o print enviado');
select is(app.attach_ticket_file(pg_temp.k('tk'), pg_temp.k('conta') || '/outro/a.png') -> 'error' ->> 'code', 'UPLOAD_NOT_FOUND', 'não anexa arquivo de outro caminho');
select is(app.my_tickets(pg_temp.k('conta')) -> 'data' -> 0 ->> 'description', 'O cupom sai cortado na Elgin', 'lista traz a descrição');
select is((app.my_tickets(pg_temp.k('conta')) -> 'data' -> 0 ->> 'attachments')::int, 1, 'lista conta o anexo');
select is(app.my_tickets(pg_temp.k('conta')) -> 'data' -> 0 ->> 'priority', 'critica', '"Parou as vendas" vira prioridade crítica');
reset role;

select tests.act_as(pg_temp.k('outro'));
select is(app.attach_ticket_file(pg_temp.k('tk'), pg_temp.k('conta') || '/' || pg_temp.k('tk') || '/a.png') -> 'error' ->> 'code', 'FORBIDDEN', 'outra adega não mexe no chamado');
reset role;

select * from finish();
rollback;
