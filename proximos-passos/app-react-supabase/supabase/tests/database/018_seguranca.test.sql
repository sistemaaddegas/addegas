-- Auditoria de segurança (migration 20261117120000): cada teste é um ataque que precisa falhar.
begin;
select plan(26);

create temp table ids (k text primary key, v uuid);
create temp table txt (k text primary key, v text);
grant all on ids, txt to authenticated;
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;

-- Cenário: Marcos (Adega Esquina, com um caixa) e Bia (Adega da Bia), contas diferentes.
create temp table lojas as select tests.new_store_owner('marcos-seg@x.com', 'Adega Esquina Seg') m, tests.new_store_owner('bia-seg@y.com', 'Adega da Bia Seg') b;
insert into ids select 'marcos', (m ->> 'user_id')::uuid from lojas;
insert into ids select 'loja', (m ->> 'store_id')::uuid from lojas;
insert into ids select 'conta', (m ->> 'account_id')::uuid from lojas;
insert into ids select 'bia', (b ->> 'user_id')::uuid from lojas;
insert into ids select 'loja_bia', (b ->> 'store_id')::uuid from lojas;
insert into ids select 'conta_bia', (b ->> 'account_id')::uuid from lojas;
insert into ids select 'caio', tests.add_member(pg_temp.id('loja'), 'caio-seg@x.com', 'cashier');
insert into txt select 'slug', slug from app.stores where id = pg_temp.id('loja');

-- Produto da Bia (o alvo das referências cruzadas) e produto do Marcos.
select tests.act_as(pg_temp.id('bia'));
insert into ids select 'prod_bia', (app.save_product(pg_temp.id('conta_bia'), '{"name":"Gin da Bia","price":9000}') -> 'data' ->> 'product_id')::uuid;
reset role;
select tests.act_as(pg_temp.id('marcos'));
insert into ids select 'prod_marcos', (app.save_product(pg_temp.id('conta'), '{"name":"Cerveja","price":800}') -> 'data' ->> 'product_id')::uuid;
reset role;

-- ===== Código de 6 dígitos =====
select ok((select bool_and(private.random_code6() ~ '^[0-9]{6}$') from generate_series(1, 200)), 'código sempre com 6 dígitos');
select ok((select count(distinct private.random_code6()) from generate_series(1, 200)) > 150, 'códigos não se repetem em série');

-- ===== Força bruta no pareamento do caixa =====
select tests.act_as(pg_temp.id('marcos'));
insert into txt select 'code', app.create_pairing_code(pg_temp.id('loja'), 'Balcão') -> 'data' ->> 'code';
reset role;
insert into txt select 'errado', case when v = '000000' then '000001' else '000000' end from txt where k = 'code';
select is((select count(*) from generate_series(1, 9) g
           where private.redeem_pairing_code((select v from txt where k = 'slug'), (select v from txt where k = 'errado')) -> 'error' ->> 'code' = 'PAIRING_CODE_INVALID'),
  9::bigint, 'nove códigos errados: recusados um a um');
select is(private.redeem_pairing_code((select v from txt where k = 'slug'), (select v from txt where k = 'errado')) -> 'error' ->> 'code',
  'PAIRING_LOCKED', 'décimo erro trava a loja');
select is(private.redeem_pairing_code((select v from txt where k = 'slug'), (select v from txt where k = 'code')) -> 'error' ->> 'code',
  'PAIRING_LOCKED', 'travada, nem o código certo entra');
select is((select count(*) from private.pairing_codes where store_id = pg_temp.id('loja') and used_at is null and expires_at > now()),
  0::bigint, 'códigos abertos da loja foram queimados');
select is((select count(*) from app.terminals where store_id = pg_temp.id('loja')), 0::bigint, 'nenhum terminal registrado pelo atacante');
select ok(exists (select 1 from audit.store_actions where store_id = pg_temp.id('loja') and action = 'terminal.pairing_locked'),
  'a trava fica na auditoria da loja');
select is(private.redeem_pairing_code('loja-que-nao-existe', '123456') -> 'error' ->> 'code', 'PAIRING_CODE_INVALID', 'loja desconhecida: só "inválido"');

-- A trava é por loja: a da Bia continua pareando.
select tests.act_as(pg_temp.id('bia'));
insert into txt select 'code_bia', app.create_pairing_code(pg_temp.id('loja_bia'), 'Balcão') -> 'data' ->> 'code';
reset role;
select ok((private.redeem_pairing_code((select slug from app.stores where id = pg_temp.id('loja_bia')), (select v from txt where k = 'code_bia')) ->> 'ok')::boolean,
  'outra loja não é afetada');

-- Gerar código sem fim também tem limite (cada código aberto é mais uma chance de acerto).
select tests.act_as(pg_temp.id('marcos'));
select is((select count(*) from generate_series(1, 19) g where (app.create_pairing_code(pg_temp.id('loja'), 'B') ->> 'ok')::boolean),
  19::bigint, 'até 20 códigos por hora');
select is(app.create_pairing_code(pg_temp.id('loja'), 'B') -> 'error' ->> 'code', 'RATE_LIMITED', 'o 21º código é recusado');
reset role;

-- ===== WhatsApp de verificação: sem spam pelo número da Addegas =====
select tests.act_as(pg_temp.id('marcos'));
select is((select count(*) from generate_series(1, 3) g where (app.add_alert_recipient(pg_temp.id('loja'), '11999990001') ->> 'ok')::boolean),
  3::bigint, 'três códigos para o mesmo número no dia');
select is(app.add_alert_recipient(pg_temp.id('loja'), '11999990001') -> 'error' ->> 'code', 'RATE_LIMITED', 'o quarto para o mesmo número é recusado');
select ok((app.add_alert_recipient(pg_temp.id('loja'), '11999990002') ->> 'ok')::boolean, 'outro número ainda passa (5ª da hora)');
select is(app.add_alert_recipient(pg_temp.id('loja'), '11999990003') -> 'error' ->> 'code', 'RATE_LIMITED', 'loja passou de 5 por hora: recusado');
reset role;

-- Código do alerta: 5 erros e ele morre.
update app.alert_recipients set code_hash = extensions.crypt('123456', extensions.gen_salt('bf', 4)), verified_at = null
where store_id = pg_temp.id('loja') and phone = '5511999990001';
select tests.act_as(pg_temp.id('marcos'));
select is((select count(*) from generate_series(1, 5) g
           where app.verify_alert_recipient(pg_temp.id('loja'), '11999990001', '000000') -> 'error' ->> 'code' = 'CODE_INVALID'),
  5::bigint, 'cinco tentativas erradas');
select is(app.verify_alert_recipient(pg_temp.id('loja'), '11999990001', '123456') -> 'error' ->> 'code', 'CODE_INVALID',
  'depois de 5 erros nem o código certo vale');
reset role;

-- ===== Criação de login da equipe: limite por loja =====
select tests.act_as(pg_temp.id('marcos'));
select is((select count(*) from generate_series(1, 30) g where (app.can_create_member(pg_temp.id('loja'), 'cashier') ->> 'ok')::boolean),
  30::bigint, '30 logins por hora');
select is(app.can_create_member(pg_temp.id('loja'), 'cashier') -> 'error' ->> 'code', 'RATE_LIMITED', 'o 31º é recusado');

-- ===== Produto de outra conta =====
select is(app.set_quick_access(pg_temp.id('loja'), jsonb_build_array(jsonb_build_object('position', 1, 'product_id', pg_temp.id('prod_bia'))))
  -> 'error' ->> 'code', 'PRODUCT_NOT_FOUND', 'acesso rápido não aceita produto da Bia');
select is(app.save_purchase_order(pg_temp.id('loja'), null, jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('prod_bia'), 'quantity', 1)))
  -> 'error' ->> 'code', 'PRODUCT_NOT_FOUND', 'pedido de compra não aceita produto da Bia');
insert into ids select 'contagem', (app.open_stock_count(pg_temp.id('loja')) -> 'data' ->> 'count_id')::uuid;
select is(app.save_count_item(pg_temp.id('contagem'), pg_temp.id('prod_bia'), 3) -> 'error' ->> 'code', 'PRODUCT_NOT_FOUND',
  'contagem não aceita produto da Bia');
select ok((app.set_quick_access(pg_temp.id('loja'), jsonb_build_array(jsonb_build_object('position', 1, 'product_id', pg_temp.id('prod_marcos')))) ->> 'ok')::boolean,
  'produto da própria conta continua aceito');
reset role;

-- ===== Logs do front: loja só entra se a pessoa for dela =====
select private.log_from_front(pg_temp.id('bia'), 'front', 'error', 'erro forjado', 'X', '{}', pg_temp.id('loja'));
select private.log_from_front(pg_temp.id('caio'), 'front', 'error', 'erro de verdade', 'Y', '{}', pg_temp.id('loja'));
select is((select store_id from audit.system_logs where message = 'erro forjado' order by created_at desc limit 1), null,
  'quem não é da loja não grava erro em nome dela');
select is((select store_id from audit.system_logs where message = 'erro de verdade' order by created_at desc limit 1), pg_temp.id('loja'),
  'quem é da loja grava com a loja');

select * from finish();
rollback;
