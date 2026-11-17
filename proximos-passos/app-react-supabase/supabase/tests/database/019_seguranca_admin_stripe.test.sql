-- Auditoria de segurança, parte 2 (migration 20261117130000): cada teste é um ataque que precisa falhar.
begin;
select plan(17);

create temp table ids (k text primary key, v uuid);
create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;

create temp table lojas as select tests.new_store_owner('dono-adm@x.com', 'Adega Alvo Adm') d;
insert into ids select 'dono', (d ->> 'user_id')::uuid from lojas;
insert into ids select 'conta', (d ->> 'account_id')::uuid from lojas;
insert into ids values ('lia', tests.new_user('lia-adm@addegas.com.br', 'staff')), ('rafael', tests.new_user('rafael-adm@addegas.com.br', 'staff'));
insert into platform.staff (user_id, name, email, role_code) values
  (pg_temp.id('lia'), 'Lia', 'lia-adm@addegas.com.br', 'support'),
  (pg_temp.id('rafael'), 'Rafael', 'rafael-adm@addegas.com.br', 'commercial');

-- ===== E1: modelo promocional só com marketing.write =====
select is(private.admin_send(pg_temp.id('lia'), 'support', 'novidades', array['email'], array[pg_temp.id('conta')], null) -> 'error' ->> 'code',
  'FORBIDDEN_ACTION', 'suporte não envia o modelo promocional, mesmo dizendo que não é promocional');
select is(private.admin_send(pg_temp.id('lia'), 'finance', 'novidades', array['whatsapp'], array[pg_temp.id('conta')], null) -> 'error' ->> 'code',
  'FORBIDDEN_ACTION', 'financeiro também não');
select ok((private.admin_send(pg_temp.id('rafael'), 'commercial', 'novidades', array['email'], array[pg_temp.id('conta')], null) ->> 'ok')::boolean,
  'comercial (com marketing.write) envia');
select ok((private.admin_send(pg_temp.id('lia'), 'support', 'payment_confirmed', array['email'], array[pg_temp.id('conta')], null) ->> 'ok')::boolean,
  'suporte segue enviando modelo de serviço');
select is((select count(*) from platform.outbox where template_code = 'novidades' and account_id = pg_temp.id('conta')), 0::bigint,
  'promocional para quem não deu consentimento não entra na fila');
insert into platform.campaigns (name, channel, template_code, audience, status, created_by)
  values ('Teste', 'email', 'novidades', '{}', 'draft', pg_temp.id('lia')) returning id \gset camp_
select is(private.campaign_send(pg_temp.id('lia'), 'support', :'camp_id') -> 'error' ->> 'code', 'FORBIDDEN_ACTION',
  'suporte não dispara campanha promocional pela rota de campanha');

-- ===== E2: promocional não vira serviço =====
select is(private.admin_template_save(pg_temp.id('lia'), 'support', 'novidades', 'Novidades', 'service', 'Novidades do Addegas para {nome_adega}') -> 'error' ->> 'code',
  'TEMPLATE_KIND_LOCKED', 'ninguém troca o promocional para serviço (pularia o consentimento)');
select is(private.admin_template_save(pg_temp.id('rafael'), 'master', 'novidades', 'Novidades', 'service', 'Novidades do Addegas para {nome_adega}') -> 'error' ->> 'code',
  'TEMPLATE_KIND_LOCKED', 'nem o administrador mestre');
select is(private.admin_template_save(pg_temp.id('lia'), 'support', 'novidades', 'Novidades', 'promotional', 'Novidades para {nome_adega}. Para sair, responda SAIR') -> 'error' ->> 'code',
  'FORBIDDEN_ACTION', 'suporte não edita o texto do promocional');
select is(private.admin_template_save(pg_temp.id('lia'), 'support', 'payment_confirmed', 'Pagamento', 'promotional', 'Promo para {nome_adega}. Para sair, responda SAIR') -> 'error' ->> 'code',
  'FORBIDDEN_ACTION', 'suporte não transforma serviço em promocional');
select ok((private.admin_template_save(pg_temp.id('rafael'), 'commercial', 'novidades', 'Novidades', 'promotional', 'Novidades para {nome_adega}. Para sair, responda SAIR') ->> 'ok')::boolean,
  'comercial edita o promocional');
select is((select array_agg(distinct kind) from platform.message_templates where code = 'novidades'), array['promotional'],
  'o novidades continua promocional nos dois canais');

-- ===== E3: desconto com teto =====
select is(private.admin_create_discount(pg_temp.id('rafael'), 'commercial', array[pg_temp.id('conta')], 'pct', 100, 9999, false, 'parceria') -> 'error' ->> 'code',
  'DISCOUNT_INVALID', '100% por 9.999 ciclos é recusado');
select is(private.admin_create_discount(pg_temp.id('rafael'), 'commercial', array[pg_temp.id('conta')], 'fixed', 99999999, 1, false, 'parceria') -> 'error' ->> 'code',
  'DISCOUNT_INVALID', 'valor fixo acima do preço do plano é recusado');

-- ===== R1: lojas adicionais em uso =====
select is(private.billing_extra_stores_in_use(pg_temp.id('conta')), 0, 'uma loja só: nenhuma adicional em uso');
insert into app.stores (account_id, name, slug) values (pg_temp.id('conta'), 'Filial', 'filial-adm-teste'), (pg_temp.id('conta'), 'Filial 2', 'filial2-adm-teste');
select is(private.billing_extra_stores_in_use(pg_temp.id('conta')), 2, 'três lojas ativas: duas adicionais em uso (não dá para reduzir abaixo disso)');

-- ===== R2: reembolso de pagamento do Stripe só pelo Stripe =====
insert into platform.payments (account_id, amount, source, stripe_payment_id) values (pg_temp.id('conta'), 14990, 'stripe', 'pi_teste_adm') returning id \gset pay_
select is(private.admin_refund(pg_temp.id('rafael'), 'finance', :'pay_id', 5000, 'cliente pediu') -> 'error' ->> 'code',
  'REFUND_IN_STRIPE', 'estorno de pagamento do Stripe não é registrado à mão (contaria em dobro)');

select * from finish();
rollback;
