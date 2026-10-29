-- E41, E45, E47, E48, E49, E51 e E15.
begin;
select plan(31);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;
create function pg_temp.stock(p text) returns numeric language sql as $$
  select coalesce((select quantity::numeric from app.product_stock where store_id = pg_temp.k('loja') and product_id = pg_temp.k(p)), 0);
$$;

insert into k select 'marcos', (j ->> 'user_id')::uuid from (select tests.new_store_owner('marcos@x.com', 'Adega Esquina') j) s;
insert into k select 'loja', id from app.stores where slug = 'adega-esquina';
insert into k select 'acc', account_id from app.stores where slug = 'adega-esquina';
update app.profiles set phone = '11986755103' where id = pg_temp.k('marcos');
insert into k values ('moto', tests.add_member(pg_temp.k('loja'), 'moto@x.com', 'courier'));
insert into k values ('moto2', tests.add_member(pg_temp.k('loja'), 'moto2@x.com', 'courier'));
insert into k select 'm_moto', tests.member_id(pg_temp.k('loja'), pg_temp.k('moto'));
insert into k values ('caixa', tests.add_member(pg_temp.k('loja'), 'caixa@x.com', 'cashier'));
insert into k select 'm_caixa', tests.member_id(pg_temp.k('loja'), pg_temp.k('caixa'));
select tests.set_pin(pg_temp.k('m_caixa'), '4821');
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'gin', (app.save_product(pg_temp.k('acc'), '{"name":"Gin Tanqueray","price":15000}') -> 'data' ->> 'product_id')::uuid;
select app.receive_goods(pg_temp.k('loja'), jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('gin'), 'quantity', 10, 'unit_cost', 9000)));
select app.update_store_settings(pg_temp.k('loja'), '{"delivery_fee_default":800,"free_delivery_above":40000}');

-- E41 · pedidos ------------------------------------------------------------------------------------------------
create temp table o1 as select app.create_order(pg_temp.k('loja'), jsonb_build_object('channel', 'whatsapp', 'customer_name', 'Ana',
  'customer_phone', '(11) 91234-5678', 'address', 'Rua A, 10', 'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('gin'), 'quantity', 1)))) r;
select is((select (r -> 'data' ->> 'delivery_fee')::int from o1), 800, 'taxa de entrega padrão da loja (D42)');
select is((app.create_order(pg_temp.k('loja'), jsonb_build_object('channel', 'phone', 'items',
  jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('gin'), 'quantity', 3)))) -> 'data' ->> 'delivery_fee')::int, 0,
  'acima de R$ 400, frete grátis automático');
select is(app.create_order(pg_temp.k('loja'), jsonb_build_object('channel', 'ifood', 'external_id', 'IF-1', 'mode', 'platform_delivery',
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('gin'), 'quantity', 1)))) ->> 'ok', 'true', 'pedido do iFood lançado à mão (D21)');
select is(app.create_order(pg_temp.k('loja'), jsonb_build_object('channel', 'ifood', 'external_id', 'IF-1',
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('gin'), 'quantity', 1)))) -> 'error' ->> 'code', 'ORDER_DUPLICATE',
  'mesmo pedido do app não entra duas vezes (§5)');
insert into k select 'pedido', (r -> 'data' ->> 'order_id')::uuid from o1;
select is(pg_temp.stock('gin'), 10.000, 'pedido novo ainda não baixa estoque');
select is(app.set_order_status(pg_temp.k('pedido'), 'preparing') ->> 'ok', 'true', 'confirmar o pedido');
select is(pg_temp.stock('gin'), 9.000, 'confirmação baixa o estoque (§8)');
select is(app.set_order_status(pg_temp.k('pedido'), 'delivered') -> 'error' ->> 'code', 'ORDER_TRANSITION_INVALID', 'não pula etapas');
select app.set_order_status(pg_temp.k('pedido'), 'ready');
select is(app.assign_courier(pg_temp.k('pedido'), pg_temp.k('m_moto')) ->> 'ok', 'true', 'atribui o entregador');
reset role;

select tests.act_as(pg_temp.k('moto'));
select is((select count(*)::int from app.orders), 1, 'entregador vê só o pedido dele (§4)');
select is(app.courier_update(pg_temp.k('pedido'), 'out_for_delivery') ->> 'ok', 'true', 'entregador sai para entrega');
select is(app.courier_update(pg_temp.k('pedido'), 'delivered') ->> 'ok', 'true', 'entregador marca entregue');
select is((select count(*)::int from app.sales), 0, 'entregador não lê vendas (RLS devolve zero linhas)');
reset role;
select tests.act_as(pg_temp.k('moto2'));
select is((select count(*)::int from app.orders), 0, 'outro entregador não vê o pedido');
reset role;

-- Concluir no caixa: vira venda com a taxa, sem baixar estoque de novo
insert into k values ('term', tests.new_terminal(pg_temp.k('loja')));
select tests.act_as(pg_temp.k('term'));
insert into k select 's', (app.operator_login(pg_temp.k('m_caixa'), '4821') -> 'data' ->> 'operator_session_id')::uuid;
select app.open_cash(pg_temp.k('s'), 0);
create temp table vc as select app.complete_order(pg_temp.k('pedido'), jsonb_build_object('operator_session_id', pg_temp.k('s'),
  'client_request_id', gen_random_uuid(), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 15800)))) r;
select is((select (r -> 'data' ->> 'total')::int from vc), 15800, 'venda do pedido inclui a taxa de entrega');
reset role;
select is(pg_temp.stock('gin'), 9.000, 'concluir o pedido não baixa o estoque de novo');
select is((select status from app.orders where id = pg_temp.k('pedido')), 'completed', 'pedido concluído');
select is((select channel from app.sales where order_id = pg_temp.k('pedido')), 'whatsapp', 'venda guarda o canal do pedido (E26)');

-- E45 · mensagens ------------------------------------------------------------------------------------------------
select ok(not exists (select 1 from platform.outbox where template_code = 'alert'), 'sem número confirmado, alerta não vai para o WhatsApp');
select tests.act_as(pg_temp.k('marcos'));
select app.add_alert_recipient(pg_temp.k('loja'), '11986755103');
reset role;
select is((select count(*)::int from platform.outbox where template_code = 'verify_code'), 1, 'código de confirmação enviado (opt-in)');
update app.alert_recipients set verified_at = now() where store_id = pg_temp.k('loja');
select private.raise_alert(pg_temp.k('loja'), 'stock_low', 'product', 'teste', 'Gin acabando');
select is((select count(*)::int from platform.outbox where template_code = 'alert'), 1, 'alerta novo vai para o número confirmado');
select private.billing_failed(pg_temp.k('acc'), 'webhook:stripe');
select is((select count(*)::int from platform.outbox where template_code = 'grace_started'), 2, 'aviso de carência por WhatsApp e e-mail (D49)');
select private.billing_paid(pg_temp.k('acc'), now(), now() + interval '1 month', 'webhook:stripe');
select is((select count(*)::int from private.outbox_claim('whatsapp') where template_code = 'grace_started'), 0,
  'aviso de carência é descartado se o pagamento chegou antes do envio (§8)');
select is((private.render_template('grace_started', 'whatsapp', '{"responsavel":"Marcos","nome_adega":"Adega Esquina","prazo_final":"05/11","link_regularizacao":"x"}')
  ->> 'body'), 'Oi Marcos, não identificamos o pagamento da Adega Esquina. Você tem até 05/11 para regularizar: x', 'modelo preenchido');
select is(private.whatsapp_opt_out('5511986755103'), 1, 'resposta SAIR desliga os alertas do número');
select private.enqueue_message('email', 'service', 'x@exemplo.com', 'grace_started', '{}'::jsonb, 'teste:desiste', pg_temp.k('acc'));
update platform.outbox set attempts = 5 where dedupe_key = 'teste:desiste';
select private.outbox_result((select id from platform.outbox where dedupe_key = 'teste:desiste'), false, null, 'recusado');
select is((select status from platform.outbox where dedupe_key = 'teste:desiste'), 'dead', 'depois de 5 tentativas a fila desiste da mensagem');

-- E47/E48/E49 · uso, leads e consentimento
select ok(exists (select 1 from analytics.events where name = 'sale_finalized' and account_id = pg_temp.k('acc')),
  'venda vira evento de uso gravado pelo servidor');
select ok(exists (select 1 from platform.leads where account_id = pg_temp.k('acc')), 'cadastro cria e liga o lead à conta (E48)');
select ok(not private.has_consent(pg_temp.k('acc'), 'whatsapp'), 'sem consentimento por padrão (E49)');

-- E51 · exportação e anonimização
select tests.act_as(pg_temp.k('marcos'));
select ok(jsonb_array_length(app.export_account_data(pg_temp.k('acc')) -> 'data' -> 'sales') = 1, 'dono exporta os dados da conta');
reset role;
select private.anonymize_account(pg_temp.k('acc'), 'teste');
select ok(not exists (select 1 from app.orders where account_id = pg_temp.k('acc') and (customer_name is not null or customer_phone <> '')),
  'anonimização apaga dados de entrega (D25)');

select * from finish();
rollback;
