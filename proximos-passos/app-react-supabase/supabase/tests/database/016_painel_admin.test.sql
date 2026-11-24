-- Etapa 12 · painel Addegas: retrato filtrado por perfil, inatividade com 2FA recente e as ações novas.
begin;
select plan(24);

create temp table k (n text primary key, v uuid);
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;

insert into k select 'dono', (j ->> 'user_id')::uuid from (select tests.new_store_owner('dono-painel@x.com', 'Adega Painel') j) s;
insert into k select 'acc', account_id from app.stores where slug = 'adega-painel';
insert into k values ('mestre', tests.new_user('mestre@addegas.com.br', 'staff')), ('fin', tests.new_user('fin@addegas.com.br', 'staff')),
  ('sup', tests.new_user('sup@addegas.com.br', 'staff'));
select private.admin_staff_upsert(null, 'seed', pg_temp.k('mestre'), 'Mestre', 'mestre@addegas.com.br', 'master');
select private.admin_staff_upsert(null, 'seed', pg_temp.k('fin'), 'Fin', 'fin@addegas.com.br', 'finance');
select private.admin_staff_upsert(null, 'seed', pg_temp.k('sup'), 'Sup', 'sup@addegas.com.br', 'support');

-- Retrato: cada parte só vem para quem tem a ação.
select ok((private.admin_snapshot(pg_temp.k('mestre')) -> 'data') ?& array['accounts', 'tickets', 'leads', 'catalog', 'logs', 'team', 'gifts'], 'mestre recebe todas as partes');
select ok(not ((private.admin_snapshot(pg_temp.k('fin')) -> 'data') ?| array['tickets', 'leads', 'catalog', 'logs', 'team']), 'financeiro não recebe tickets, CRM, catálogo, logs nem equipe');
select ok((private.admin_snapshot(pg_temp.k('fin')) -> 'data') ? 'invoices', 'financeiro recebe as cobranças');
select is(jsonb_array_length(private.admin_snapshot(pg_temp.k('mestre')) -> 'data' -> 'accounts'), (select count(*)::int from app.accounts), 'todas as adegas no retrato');

-- Inatividade: 2FA recente vale como atividade.
update platform.staff set last_activity_at = now() - interval '2 hours' where user_id = pg_temp.k('fin');
select is(private.staff_check(pg_temp.k('fin'), 'aal2', 'billing.read', now() - interval '1 minute') ->> 'ok', 'true', '2FA acabado de confirmar não é inatividade');
update platform.staff set last_activity_at = now() - interval '2 hours' where user_id = pg_temp.k('fin');
select is(private.staff_check(pg_temp.k('fin'), 'aal2', 'billing.read', now() - interval '3 hours') -> 'error' ->> 'code', 'SESSION_IDLE', 'sessão parada há mais de 30 min cai');

-- Ciclo do plano, desconto e preço.
select is(private.admin_change_cycle(pg_temp.k('fin'), 'finance', pg_temp.k('acc'), 'annual', true, '') -> 'error' ->> 'code', 'REASON_REQUIRED', 'trocar ciclo exige motivo');
select is(private.admin_change_cycle(pg_temp.k('fin'), 'finance', pg_temp.k('acc'), 'annual', true, 'Fechou o anual por telefone') ->> 'ok', 'true', 'ativa no ciclo anual');
select is((select status::text || '/' || cycle::text from platform.subscriptions where account_id = pg_temp.k('acc')), 'active/annual', 'assinatura ativa e anual');
insert into k select 'desc', (private.admin_discount_create(pg_temp.k('fin'), 'finance', array[pg_temp.k('acc')], 'pct', 10, 3, false, now(), 'Indicação de outra adega') -> 'data' ->> 'discount_id')::uuid;
select is(private.admin_revoke_discount(pg_temp.k('fin'), 'finance', pg_temp.k('desc'), 'Cliente pediu outro benefício') ->> 'ok', 'true', 'revoga o desconto');
select is(private.admin_revoke_discount(pg_temp.k('fin'), 'finance', pg_temp.k('desc'), 'De novo, por engano') -> 'error' ->> 'code', 'DISCOUNT_ALREADY_REVOKED', 'não revoga duas vezes');
select is(private.admin_plan_price(pg_temp.k('mestre'), 'master', 'monthly', 0, 'Preço zerado por engano') -> 'error' ->> 'code', 'PLAN_PRICE_INVALID', 'preço zero recusado');

-- Tickets e melhorias.
with t as (insert into support.tickets (account_id, opened_by, kind, subject, description, priority)
  values (pg_temp.k('acc'), pg_temp.k('dono'), 'melhoria', 'Relatórios', 'Vendas por funcionário', 'baixa') returning id)
insert into k select 't1', id from t;
insert into k select 'imp', (private.admin_ticket_update(pg_temp.k('sup'), 'support', pg_temp.k('t1'), '{"improvement_title":"Vendas por funcionário"}') -> 'data' ->> 'improvement_id')::uuid;
select isnt(pg_temp.k('imp'), null, 'sugestão vira melhoria nova');
select is(private.admin_improvement_status(pg_temp.k('sup'), 'support', pg_temp.k('imp'), 'entregue') -> 'data' ->> 'tickets_resolved', '1', 'entregar resolve o ticket ligado');
select is((select count(*)::int from support.ticket_messages where ticket_id = pg_temp.k('t1') and side = 'equipe' and not internal), 1, 'a adega recebe o aviso no ticket');
select is(private.staff_reply_ticket(pg_temp.k('sup'), 'support', pg_temp.k('t1'), 'Ainda falta algo?', false, 'aguardando_equipe') ->> 'ok', 'true', 'aceita aguardando equipe técnica');

-- CRM.
insert into k select 'lead', (private.admin_lead_action(pg_temp.k('mestre'), 'master', null, 'create', '{"store_name":"Adega Nova","name":"Ana","phone":"11988887777","source":"Site"}') -> 'data' ->> 'lead_id')::uuid;
select is(private.admin_lead_action(pg_temp.k('mestre'), 'master', null, 'create', '{"store_name":"Outra","name":"Bia","phone":"(11) 98888-7777"}') -> 'error' ->> 'code', 'LEAD_DUPLICATE', 'mesmo telefone não duplica o lead');
select is(private.admin_lead_action(pg_temp.k('mestre'), 'master', pg_temp.k('lead'), 'lost', '{"reason":"Preço","detail":""}') -> 'error' ->> 'code', 'LOST_REASON_REQUIRED', 'perder exige detalhe');
select is(private.admin_lead_action(pg_temp.k('mestre'), 'master', pg_temp.k('lead'), 'stage', '{"stage":"demo"}') ->> 'ok', 'true', 'muda de etapa');

-- Equipe, configurações, modelos e brindes.
select is(private.admin_staff_update(pg_temp.k('mestre'), 'master', pg_temp.k('mestre'), 'analyst', true, 'Testando a mim mesmo') -> 'error' ->> 'code', 'STAFF_SELF_CHANGE', 'ninguém muda o próprio perfil');
select is(private.admin_setting_set(pg_temp.k('mestre'), 'master', 'retention', '{"fe":"30","be":"90","sec":"1"}') -> 'error' ->> 'code', 'RETENTION_ONLY_UP', 'retenção da auditoria só aumenta');
select is(private.admin_template_save(pg_temp.k('mestre'), 'master', 'novidades', 'Novidades', 'promotional', 'Oi {responsavel}, novidade!') -> 'error' ->> 'code', 'TEMPLATE_OPT_OUT_REQUIRED', 'promocional sem opção de saída é recusado');
select is(private.admin_send(pg_temp.k('mestre'), 'master', 'novidades', array['whatsapp'], array[pg_temp.k('acc')], now()) -> 'data' ->> 'skipped', '1', 'promocional não sai para quem não consentiu');
update platform.gift_items set qty = 0 where code = 'placa';
select is(private.admin_gift_action(pg_temp.k('mestre'), 'master', 'create', jsonb_build_object('account_id', pg_temp.k('acc'), 'milestone', 1,
  'items', '["placa"]'::jsonb, 'recipient', 'Dono', 'address', 'Rua A, 10')) -> 'error' ->> 'code', 'GIFT_OUT_OF_STOCK', 'brinde sem estoque é recusado');

select * from finish();
rollback;
