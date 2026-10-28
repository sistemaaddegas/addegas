-- E33, E11/E14, E36, E37, E38, E39, E40, E42 e E46.
begin;
select plan(41);

create temp table k (n text primary key, v uuid);
grant all on k to authenticated;
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;
create function pg_temp.sub(p text) returns text language sql as $$
  select status || '/' || access from platform.subscriptions where account_id = pg_temp.k(p);
$$;

insert into k select 'marcos', (j ->> 'user_id')::uuid from (select tests.new_store_owner('marcos@x.com', 'Adega Esquina') j) s;
insert into k select 'acc', account_id from app.stores where slug = 'adega-esquina';
insert into k select 'loja', id from app.stores where slug = 'adega-esquina';
insert into k select 'bia', (j ->> 'user_id')::uuid from (select tests.new_store_owner('bia@y.com', 'Adega da Bia') j) s;
insert into k select 'acc_bia', account_id from app.stores where slug = 'adega-da-bia';

-- E33 · ciclo da assinatura --------------------------------------------------------------------------------
update platform.subscriptions set trial_ends_at = now() - interval '1 minute' where account_id = pg_temp.k('acc_bia');
select is((private.run_billing_cycle('{}', '2026-11-01') ->> 'trials_expired')::int, 1, 'teste vencido expira');
select is(pg_temp.sub('acc_bia'), 'expired/suspended', 'conta da Bia expirada e suspensa');
select is(private.run_billing_cycle('{}', '2026-11-01') ->> 'replayed', 'true', 'rodar duas vezes no mesmo dia não repete nada');
select is((select count(*)::int from platform.subscription_events e join platform.subscriptions s on s.id = e.subscription_id
  where s.account_id = pg_temp.k('acc_bia') and e.to_status = 'expired'), 1, 'um evento só por transição');

select private.billing_paid(pg_temp.k('acc'), now(), now() + interval '1 month', 'webhook:stripe');
select is(pg_temp.sub('acc'), 'active/allowed', 'pagamento ativa a assinatura');
select private.billing_failed(pg_temp.k('acc'), 'webhook:stripe');
select is(pg_temp.sub('acc'), 'past_due/grace', 'falha abre a carência');
create temp table g as select grace_ends_at from platform.subscriptions where account_id = pg_temp.k('acc');
select private.billing_failed(pg_temp.k('acc'), 'webhook:stripe');
select is((select grace_ends_at from platform.subscriptions where account_id = pg_temp.k('acc')), (select grace_ends_at from g),
  'nova falha não reinicia a carência (D28)');
update platform.subscriptions set grace_ends_at = now() - interval '1 minute' where account_id = pg_temp.k('acc');
select private.run_billing_cycle('{}', '2026-11-02');
select is(pg_temp.sub('acc'), 'past_due/grace', 'sem a reconferência do gateway, ninguém é suspenso');
select private.run_billing_cycle(array[pg_temp.k('acc')], '2026-11-03');
select is(pg_temp.sub('acc'), 'past_due/suspended', 'reconferido e não pago: suspenso');
select private.billing_paid(pg_temp.k('acc'), now(), now() + interval '1 month', 'webhook:stripe');

select tests.act_as(pg_temp.k('marcos'));
select is(app.request_cancellation(pg_temp.k('acc')) -> 'data' ->> 'cancel_at_period_end', 'true', 'dono pede cancelamento');
reset role;
select tests.act_as(pg_temp.k('bia'));
select is(app.request_cancellation(pg_temp.k('acc')) -> 'error' ->> 'code', 'FORBIDDEN', 'outra pessoa não cancela');
reset role;
select is(pg_temp.sub('acc'), 'active/allowed', 'acesso continua até o fim do ciclo');
update platform.subscriptions set current_period_end = now() - interval '1 minute' where account_id = pg_temp.k('acc');
select private.run_billing_cycle('{}', '2026-11-04');
select is(pg_temp.sub('acc'), 'canceled/suspended', 'no fim do ciclo, cancelada e suspensa');

-- E42 · webhooks -----------------------------------------------------------------------------------------------
select is(private.inbox_receive('stripe', 'evt_1', 'invoice.paid', '{"a":1}') ->> 'duplicate', 'false', 'evento novo entra');
select is(private.inbox_receive('stripe', 'evt_1', 'invoice.paid', '{"a":1}') ->> 'duplicate', 'true', 'repetido é reconhecido');
select is((select count::int from platform.webhook_duplicates where provider = 'stripe'), 1, 'duplicado contado para a regra de alerta');
select is((select count(*)::int from private.inbox_claim('stripe')), 1, 'processador pega o evento');
select is((select count(*)::int from private.inbox_claim('stripe')), 0, 'evento em processamento não é pego de novo');
select private.inbox_fail(id, 'timeout') from platform.webhook_inbox where event_id = 'evt_1';
select is((select status from platform.webhook_inbox where event_id = 'evt_1'), 'failed', 'falha volta para a fila com espera');
update platform.webhook_inbox set attempts = 8 where event_id = 'evt_1';
select private.inbox_fail(id, 'timeout') from platform.webhook_inbox where event_id = 'evt_1';
select is((select status from platform.webhook_inbox where event_id = 'evt_1'), 'dead', 'depois de 8 tentativas, morto (alerta)');

-- E11/E14 · equipe Addegas ---------------------------------------------------------------------------------------
insert into k values ('lia', tests.new_user('lia@addegas.com.br', 'staff'));
insert into platform.staff (user_id, name, email, role_code) values (pg_temp.k('lia'), 'Lia Santos', 'lia@addegas.com.br', 'support');
select throws_ok($$ insert into platform.staff (user_id, name, email, role_code) values (tests.new_user('x@gmail.com', 'staff'), 'X', 'x@gmail.com', 'support') $$,
  '23514', null, 'só e-mail @addegas.com.br na equipe');
select is(private.staff_check(pg_temp.k('lia'), 'aal1', 'tickets.reply') -> 'error' ->> 'code', 'MFA_REQUIRED', 'sem 2FA, recusado');
select is(private.staff_check(pg_temp.k('lia'), 'aal2', 'tickets.reply') -> 'data' ->> 'role', 'support', 'suporte com 2FA responde ticket');
select is(private.staff_check(pg_temp.k('lia'), 'aal2', 'billing.refund') -> 'error' ->> 'code', 'FORBIDDEN_ACTION', 'suporte não reembolsa');
select ok(exists (select 1 from audit.admin_actions where action = 'billing.refund' and outcome = 'denied'), 'negação da equipe auditada');
update platform.staff set last_activity_at = now() - interval '31 minutes' where user_id = pg_temp.k('lia');
select is(private.staff_check(pg_temp.k('lia'), 'aal2', 'tickets.reply') -> 'error' ->> 'code', 'SESSION_IDLE', '30 min sem uso derruba a sessão (D46)');

-- E36/E37 · ações do admin --------------------------------------------------------------------------------------
select is(private.admin_extend_trial(pg_temp.k('lia'), 'commercial', pg_temp.k('acc_bia'), 7, '') -> 'error' ->> 'code', 'REASON_REQUIRED', 'ação sem motivo é recusada');
select is(private.admin_extend_trial(pg_temp.k('lia'), 'commercial', pg_temp.k('acc_bia'), 7, 'Pediu mais tempo para testar') ->> 'ok', 'true', 'teste estendido');
select is(pg_temp.sub('acc_bia'), 'trial/allowed', 'conta volta para teste liberado');
select is(private.admin_extend_trial(pg_temp.k('lia'), 'commercial', pg_temp.k('acc'), 7, 'Tentativa indevida') -> 'error' ->> 'code',
  'TRIAL_NOT_APPLICABLE', 'não estende teste de quem já assinou');
select private.admin_temp_access(pg_temp.k('lia'), 'support', pg_temp.k('acc'), 2, 'Cliente pagou, aguardando compensação');
select is(private.account_access(pg_temp.k('acc')), 'allowed'::platform.access_state, 'acesso temporário libera a conta suspensa (D27)');

insert into platform.invoices (account_id, amount, status, period_start, period_end) values (pg_temp.k('acc'), 14990, 'open', now(), now() + interval '1 month');
insert into k select 'fatura', id from platform.invoices where account_id = pg_temp.k('acc');
select is(private.admin_manual_payment(pg_temp.k('lia'), 'finance', pg_temp.k('fatura'), 'pix', '', 'Pagou por Pix direto') -> 'error' ->> 'code',
  'PROOF_REQUIRED', 'pagamento manual sem comprovante é recusado');
select is(private.admin_manual_payment(pg_temp.k('lia'), 'finance', pg_temp.k('fatura'), 'pix', 'acc/fatura/comprovante.pdf', 'Pagou por Pix direto') ->> 'ok',
  'true', 'pagamento manual com comprovante');
select is(pg_temp.sub('acc'), 'active/allowed', 'quitou na hora, sem esperar a rotina');
select is(private.admin_refund(pg_temp.k('lia'), 'finance', (select id from platform.payments limit 1), 20000, 'Cobrança em duplicidade') -> 'error' ->> 'code',
  'REFUND_AMOUNT_INVALID', 'reembolso maior que o pago é recusado');

-- E38 · tickets ----------------------------------------------------------------------------------------------------
select tests.act_as(pg_temp.k('marcos'));
insert into k select 'ticket', (app.open_ticket(pg_temp.k('acc'), pg_temp.k('loja'), 'problema', 'Caixa travou', 'Travou ao finalizar no Pix', 'parou') -> 'data' ->> 'ticket_id')::uuid;
reset role;
select private.staff_reply_ticket(pg_temp.k('lia'), 'support', pg_temp.k('ticket'), 'Cliente usa Elgin i9', true);
select private.staff_reply_ticket(pg_temp.k('lia'), 'support', pg_temp.k('ticket'), 'Pode mandar o modelo da impressora?', false, 'aguardando_cliente');
select tests.act_as(pg_temp.k('marcos'));
select is(jsonb_array_length(app.my_tickets(pg_temp.k('acc')) -> 'data' -> 0 -> 'messages'), 1, 'nota interna não aparece para a adega');
reset role;
update support.tickets set created_at = now() - interval '3 hours', first_response_at = null, status = 'novo', waiting_since = null where id = pg_temp.k('ticket');
select private.run_ticket_sla();
select ok((select first_response_late from support.tickets where id = pg_temp.k('ticket')), 'ticket crítico sem resposta em 1 h fica atrasado');

-- E39 · repositório de produtos
select private.admin_catalog_save(pg_temp.k('lia'), 'support', '{"ean":"7896045506873","name":"Heineken Long Neck 330ml","volume_ml":330,"status":"published"}');
select is(private.admin_catalog_save(pg_temp.k('lia'), 'support', '{"ean":"7896045506873","name":"Heineken LN","status":"published"}') -> 'error' ->> 'code',
  'CATALOG_EAN_DUPLICATE', 'dois publicados com o mesmo EAN são recusados');

-- E40 · métricas
update platform.subscriptions set status = 'active', access = 'allowed', cycle = 'monthly', price = 14990, extra_stores = 1, extra_store_price = 4990
where account_id = pg_temp.k('acc');
update platform.subscriptions set status = 'active', access = 'allowed', cycle = 'annual', price = 143904 where account_id = pg_temp.k('acc_bia');
select is(private.current_mrr(), (14990 + 4990 + 11992)::bigint, 'MRR: mensal + loja adicional + anual dividido por 12');

-- E46 · manutenção e agendamentos
select private.create_month_partition('audit.system_logs', (now() - interval '31 days')::date);
do $$ begin perform set_config('addegas.audit_maintenance', 'on', true); end $$;
insert into audit.system_logs (source, level, message, created_at) values ('front', 'error', 'velho', now() - interval '31 days');
do $$ begin perform set_config('addegas.audit_maintenance', 'off', true); end $$;
select is((private.run_daily_maintenance() ->> 'logs_deleted')::int, 1, 'manutenção apaga log de front com mais de 30 dias (D26)');
select is((select count(*)::int from cron.job where jobname like 'addegas-%'), 5, 'rotinas agendadas no pg_cron (manutenção, alertas, SLA, pedidos, uso e retenção)');

select * from finish();
rollback;
