-- E05 (banco) e E13 · logs, auditoria imutável, mascaramento e padrão de resposta.
begin;
select plan(16);

-- Partições do mês atual e dos próximos 2 já existem
select ok(
  to_regclass('audit.store_actions_' || to_char(now(), 'YYYY_MM')) is not null,
  'partição do mês atual de store_actions existe'
);
select ok(
  to_regclass('audit.system_logs_' || to_char(now() + interval '2 months', 'YYYY_MM')) is not null,
  'partição de daqui a 2 meses de system_logs existe'
);
select is(
  private.create_month_partition('audit.store_actions', now()::date),
  'audit.store_actions_' || to_char(now(), 'YYYY_MM'),
  'criar a partição de novo não dá erro (idempotente)'
);

-- Mascaramento
select is(private.mask_email('Falha para marcos.silva@adega.com.br'), 'Falha para m***@adega.com.br', 'e-mail mascarado');
select is(
  private.redact('{"user":{"email":"ana@x.com","password":"123","access_token":"abc"},"itens":[{"pin":"1234","qtd":2}]}'::jsonb),
  '{"user":{"email":"a***@x.com","password":"[removido]","access_token":"[removido]"},"itens":[{"pin":"[removido]","qtd":2}]}'::jsonb,
  'redact remove senha, token e PIN e mascara e-mail em qualquer nível'
);

-- Log técnico com correlation_id e contexto mascarado
do $$ begin perform set_config('request.headers', '{"x-correlation-id":"corr-teste-1","x-forwarded-for":"200.100.50.25, 10.0.0.1"}', true); end $$;
select private.log('back', 'error', 'Erro ao vender para joao@ex.com', 'SALE_TEST', '{"token":"x","total":1500}');
select is(
  (select row(message, code, correlation_id, context)::text from audit.system_logs where code = 'SALE_TEST'),
  row('Erro ao vender para j***@ex.com', 'SALE_TEST', 'corr-teste-1', '{"token": "[removido]", "total": 1500}'::jsonb)::text,
  'log gravado com mensagem e contexto mascarados e o correlation_id da requisição'
);

-- Auditoria: grava autor, tipo, IP e correlation_id
do $$ begin perform set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"kind":"person"}}', true); end $$;
select private.audit_store('price.update', '22222222-2222-2222-2222-222222222222', null, 'product', 'p1',
  '{"price":1000}', '{"price":1200}', 'reajuste');
select is(
  (select row(actor_user_id, actor_kind, outcome, correlation_id, host(ip))::text
   from audit.store_actions where action = 'price.update'),
  row('11111111-1111-1111-1111-111111111111'::uuid, 'person', 'allowed', 'corr-teste-1', '200.100.50.25')::text,
  'auditoria grava autor, tipo de usuário, resultado, correlation_id e IP'
);

-- Negações iguais no mesmo minuto viram uma linha só
select private.audit_store('sale.discount', '22222222-2222-2222-2222-222222222222', p_outcome => 'denied');
select private.audit_store('sale.discount', '22222222-2222-2222-2222-222222222222', p_outcome => 'denied');
select is(
  (select count(*)::int from audit.store_actions where action = 'sale.discount'),
  1,
  'negação repetida no mesmo minuto é gravada uma vez'
);

-- Imutabilidade
select throws_ok(
  $$ update audit.store_actions set reason = 'apagado' where action = 'price.update' $$,
  'P0001', 'AUDIT_IMMUTABLE', 'nem o dono do schema altera a auditoria'
);
select throws_ok(
  $$ delete from audit.system_logs where code = 'SALE_TEST' $$,
  'P0001', 'AUDIT_IMMUTABLE', 'logs também só aceitam inserção'
);
do $$ begin perform set_config('addegas.audit_maintenance', 'on', true); end $$;
select lives_ok(
  $$ update audit.store_actions set reason = null where action = 'price.update' $$,
  'a rotina de anonimização (E51) consegue alterar com a chave de manutenção'
);
do $$ begin perform set_config('addegas.audit_maintenance', 'off', true); end $$;

set local role service_role;
select throws_ok(
  $$ update audit.store_actions set reason = 'x' $$,
  '42501', null, 'service_role não tem permissão de alterar a auditoria'
);
reset role;

set local role authenticated;
select throws_ok($$ select * from audit.store_actions $$, '42501', null, 'authenticated não lê a auditoria');
select throws_ok($$ select private.audit_store('x', null) $$, '42501', null, 'authenticated não grava auditoria direto');
reset role;

-- Padrão de resposta das RPCs
select is(private.err('SALE_CASH_CLOSED'), '{"ok": false, "error": {"code": "SALE_CASH_CLOSED", "detail": null}}'::jsonb, 'err() no formato padrão');
select is(private.ok('{"number":1043}'), '{"ok": true, "data": {"number": 1043}}'::jsonb, 'ok() no formato padrão');

select * from finish();
rollback;
