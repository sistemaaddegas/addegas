-- Etapa 12 · Painel Addegas (admin.addegas.com.br). O protótipo aprovado é o `Addegas Admin.dc.html` (admin.html).
-- Esta migration completa o que as telas pedem e o back-end ainda não tinha:
--   · um retrato do painel (private.admin_snapshot), filtrado pelas ações do perfil de quem pede;
--   · as ações que faltavam: trocar ciclo, revogar desconto, editar preço, triagem de tickets e melhorias,
--     CRM completo, triagem de ocorrências, equipe, configurações, central de mensagens, brindes e funis.
-- Tudo passa pela admin-api (Edge Function `admin`), que confere 2FA, inatividade e a ação do perfil antes (E14).

-- Tickets: "aguardando equipe técnica" e o agrupamento de sugestões em melhorias (E38) --------------------------
alter table support.tickets drop constraint if exists tickets_status_check;
alter table support.tickets add constraint tickets_status_check
  check (status in ('novo', 'em_andamento', 'aguardando_cliente', 'aguardando_equipe', 'resolvido', 'fechado'));

create table support.improvements (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity,
  title text not null check (length(trim(title)) between 3 and 160),
  area text,
  status text not null default 'analise' check (status in ('analise', 'planejada', 'desenvolvimento', 'entregue')),
  delivered_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
alter table support.improvements enable row level security;
alter table support.tickets add column improvement_id uuid references support.improvements (id);
create index tickets_improvement_idx on support.tickets (improvement_id);
create index improvements_created_by_idx on support.improvements (created_by);

-- Repositório de produtos (E39): campos do catálogo geral que o protótipo mostra, e arquivados ---------------
alter table platform.catalog_products
  add column subcategory text,
  add column unit text not null default 'ml' check (unit in ('ml', 'L', 'g', 'kg', 'un')),
  add column packaging text,
  add column description text,
  add column origin text not null default 'Addegas';
alter table platform.catalog_products drop constraint if exists catalog_products_status_check;
alter table platform.catalog_products add constraint catalog_products_status_check check (status in ('draft', 'published', 'archived'));

-- Descontos (E37): revogação com motivo ---------------------------------------------------------------------
alter table platform.discounts
  add column revoked_at timestamptz,
  add column revoked_by uuid references auth.users (id),
  add column revoke_reason text;
create index discounts_revoked_by_idx on platform.discounts (revoked_by);

-- CRM (E48): campanha, endereço, permissão de promoções, perda com detalhe e mescla --------------------------
alter table platform.leads
  add column campaign text,
  add column address text,
  add column promo_ok boolean not null default true,
  add column lost_detail text,
  add column lost_at timestamptz,
  add column merged_into uuid references platform.leads (id);
create index leads_merged_into_idx on platform.leads (merged_into);
alter table platform.lead_stages add column color text;
insert into platform.lead_stages (code, name, sort) values ('demo', 'Demonstração agendada', 25) on conflict (code) do nothing;
update platform.lead_stages set name = 'Novo lead', color = '#A1A1A6' where code = 'novo';
update platform.lead_stages set name = 'Contato iniciado', color = '#7CB3FF' where code = 'contato';
update platform.lead_stages set color = '#FF8A00' where code = 'demo';
update platform.lead_stages set name = 'Em teste', color = '#1E90FF' where code = 'teste';
update platform.lead_stages set name = 'Assinante', color = '#16C60C' where code = 'cliente';

-- Modelos de mensagem com nome legível e um promocional de novidades (E49) -------------------------------------
alter table platform.message_templates add column name text;
update platform.message_templates set name = case code
  when 'trial_ending' then 'Teste próximo do fim'
  when 'grace_started' then 'Início da carência'
  when 'grace_24h' then 'Carência: 24 h para o fim'
  when 'suspended' then 'Acesso suspenso'
  when 'payment_confirmed' then 'Pagamento confirmado'
  when 'alert' then 'Alerta da loja'
  when 'verify_code' then 'Código de verificação'
  when 'member_access' then 'Acesso de funcionário'
  when 'deletion_confirm' then 'Confirmação de exclusão'
  else code end;
insert into platform.message_templates (code, channel, kind, subject, body, name) values
  ('novidades', 'whatsapp', 'promotional', null,
   'Oi {responsavel}! Tem novidade no Addegas para a {nome_adega}. Veja o que mudou no seu painel. Responda SAIR para não receber mais.', 'Novidades do Addegas'),
  ('novidades', 'email', 'promotional', 'Novidades no Addegas',
   'Oi {responsavel}! Tem novidade no Addegas para a {nome_adega}. Veja o que mudou no seu painel. Para não receber mais, responda SAIR.', 'Novidades do Addegas'),
  ('cobranca_proxima', 'whatsapp', 'service', null,
   'Oi {responsavel}, a mensalidade da {nome_adega} vence em {vencimento}. Pague por aqui: {link_regularizacao}', 'Cobrança próxima do vencimento'),
  ('cobranca_proxima', 'email', 'service', 'Sua mensalidade vence em breve',
   'Oi {responsavel}, a mensalidade da {nome_adega} vence em {vencimento}. Pague por aqui: {link_regularizacao}', 'Cobrança próxima do vencimento')
on conflict do nothing;

alter table platform.campaigns drop constraint if exists campaigns_status_check;
alter table platform.campaigns add constraint campaigns_status_check check (status in ('draft', 'scheduled', 'sent', 'canceled'));
alter table platform.campaigns add column scheduled_for timestamptz;


-- Triagem das ocorrências (E46): status, responsável e histórico, sem mexer no log ----------------------------
create table platform.log_triage (
  log_id uuid primary key,
  status text not null default 'aberto' check (status in ('aberto', 'investigando', 'resolvido')),
  assignee uuid references auth.users (id),
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table platform.log_triage enable row level security;
create index log_triage_assignee_idx on platform.log_triage (assignee);

-- Configurações da plataforma (automação, retenção, alertas, regra do catálogo) -------------------------------
create table platform.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
alter table platform.settings enable row level security;
create index settings_updated_by_idx on platform.settings (updated_by);
insert into platform.settings (key, value) values
  ('automation', '{"verif":"09:00","lembrete":"24","confirm":"sim","canal":"WhatsApp"}'),
  ('staff_session', '{"sessao":"30"}'),
  ('retention', '{"fe":"30","be":"90","sec":"5"}'),
  ('catalog_update_rule', '{"rule":"manual"}'),
  ('alerts', '{"items":[{"id":"AL1","t":"Falha crítica em pagamentos ou integrações","r":"qualquer ocorrência crítica nos módulos Pagamentos, Webhooks ou Integrações","on":true},
              {"id":"AL2","t":"Aumento anormal de erros no frontend","r":"erros por hora acima de 3× a média dos últimos 7 dias","on":true},
              {"id":"AL3","t":"Duplicidade em webhooks","r":"mais de 50 eventos duplicados em 1 hora","on":true},
              {"id":"AL4","t":"Ataque de força bruta no login","r":"5 ou mais falhas de login para a mesma conta ou IP em 10 minutos","on":true},
              {"id":"AL5","t":"Latência alta da API","r":"p95 acima de 2 s por 15 minutos","on":false}]}')
on conflict (key) do nothing;

-- Brindes de fidelidade (E50) -------------------------------------------------------------------------------
create table platform.gift_items (
  code text primary key,
  name text not null,
  qty int not null default 0 check (qty >= 0),
  unit_cost bigint not null default 0 check (unit_cost >= 0)
);
create table platform.gift_kits (
  milestone int primary key check (milestone between 1 and 3),
  items text[] not null default '{}'
);
create table platform.gifts (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity,
  account_id uuid not null references app.accounts (id),
  milestone int not null check (milestone >= 1),
  items text[] not null,
  size text,
  recipient text not null,
  address text not null,
  card text,
  notify boolean not null default false,
  status text not null default 'preparando' check (status in ('preparando', 'enviado', 'entregue')),
  tracking text,
  cost bigint not null default 0,
  freight bigint not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  unique (account_id, milestone)
);
alter table platform.gift_items enable row level security;
alter table platform.gift_kits enable row level security;
alter table platform.gifts enable row level security;
create index gifts_created_by_idx on platform.gifts (created_by);
insert into platform.gift_items (code, name, unit_cost) values
  ('adesivo', 'Adesivo dd', 180), ('copo', 'Copo Addegas 400 ml', 1490), ('camiseta', 'Camiseta preta dd', 3200),
  ('bone', 'Boné trucker amarelo', 2750), ('placa', 'Placa Parceiro Addegas', 4800), ('avental', 'Avental de balcão', 3900),
  ('abridor', 'Abridor de garrafa', 650)
on conflict (code) do nothing;
insert into platform.gift_kits (milestone, items) values
  (1, '{adesivo,copo}'), (2, '{adesivo,copo,camiseta,bone}'), (3, '{adesivo,copo,camiseta,bone,placa,avental}')
on conflict (milestone) do nothing;
insert into platform.staff_actions (code, description) values ('gifts.read', 'Ver brindes') on conflict (code) do nothing;

-- Retrato do painel ------------------------------------------------------------------------------------------
-- Uma leitura só, no tamanho da base do piloto (dezenas de adegas). Cada parte só vem se o perfil tiver a ação.
create or replace function private.admin_snapshot(p_staff uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me platform.staff;
  v_acts text[];
  v_out jsonb;
  v_can_accounts boolean;
begin
  select * into v_me from platform.staff where user_id = p_staff and active;
  if not found then return private.err('STAFF_INACTIVE'); end if;
  select array_agg(action_code order by action_code) into v_acts from platform.role_actions where role_code = v_me.role_code;
  v_can_accounts := 'accounts.read' = any (v_acts);

  v_out := jsonb_build_object(
    'now', now(),
    'me', jsonb_build_object('user_id', v_me.user_id, 'name', v_me.name, 'email', v_me.email, 'role', v_me.role_code,
      'role_label', (select name from platform.staff_roles where code = v_me.role_code), 'actions', to_jsonb(v_acts)),
    'roles', (select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name,
      'actions', (select coalesce(jsonb_agg(ra.action_code order by ra.action_code), '[]') from platform.role_actions ra where ra.role_code = r.code))
      order by case r.code when 'master' then 1 when 'finance' then 2 when 'support' then 3 when 'commercial' then 4 else 5 end)
      from platform.staff_roles r),
    'action_names', (select jsonb_object_agg(code, description) from platform.staff_actions),
    'staff_names', (select jsonb_agg(jsonb_build_object('user_id', user_id, 'name', name, 'role', role_code) order by name)
      from platform.staff where active),
    'plans', (select jsonb_agg(jsonb_build_object('plan', pl.code, 'plan_name', pl.name, 'cycle', pp.cycle, 'price', pp.price)
      order by case pp.cycle when 'monthly' then 1 when 'semiannual' then 2 else 3 end)
      from platform.plan_prices pp join platform.plans pl on pl.id = pp.plan_id where pp.active and pl.for_sale),
    'extra_store_prices', (select jsonb_object_agg(ap.cycle, ap.price) from platform.addon_prices ap
      join platform.addons ad on ad.id = ap.addon_id where ad.code = 'extra_store'),
    'features', (select jsonb_agg(jsonb_build_object('code', f.feature_code, 'enabled', f.enabled, 'limit', f.limit_value))
      from platform.plan_features f join platform.plans pl on pl.id = f.plan_id where pl.for_sale),
    'settings', (select jsonb_object_agg(key, value) from platform.settings)
  );

  if v_can_accounts then
    v_out := v_out || jsonb_build_object(
      'accounts', (select coalesce(jsonb_agg(x order by x ->> 'created_at'), '[]') from (
        select jsonb_build_object(
          'id', a.id, 'name', a.name, 'created_at', a.created_at,
          'owner_name', coalesce(nullif(pr.full_name, ''), u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
          'owner_email', u.email, 'owner_phone', coalesce(nullif(pr.phone, ''), st.whatsapp),
          'neighborhood', st.neighborhood, 'city', st.city, 'address', st.address,
          'stores', (select count(*) from app.stores x where x.account_id = a.id and x.archived_at is null),
          'members', (select count(*) from app.store_members m join app.stores x on x.id = m.store_id
                      where x.account_id = a.id and m.active and m.role <> 'courier'),
          'status', s.status, 'access', private.account_access(a.id), 'cycle', s.cycle, 'price', s.price,
          'extra_stores', s.extra_stores, 'extra_store_price', s.extra_store_price,
          'trial_ends_at', s.trial_ends_at, 'period_start', s.current_period_start, 'period_end', s.current_period_end,
          'grace_ends_at', s.grace_ends_at, 'cancel_at_period_end', s.cancel_at_period_end,
          'temp_access_until', s.temp_access_until, 'subscription_updated_at', s.updated_at,
          'started_at', (select min(e.created_at) from platform.subscription_events e where e.subscription_id = s.id and e.to_status = 'active'),
          'canceled_at', case when s.status in ('canceled', 'expired') then
            (select max(e.created_at) from platform.subscription_events e where e.subscription_id = s.id and e.to_status = s.status) end,
          'cancel_reason', (select e.reason from platform.subscription_events e where e.subscription_id = s.id
            and (e.to_status in ('canceled', 'expired') or e.reason ilike '%cancel%') order by e.created_at desc limit 1),
          'suspended_at', (select max(e.created_at) from platform.subscription_events e where e.subscription_id = s.id and e.to_access = 'suspended'),
          'overdue_at', (select min(i.due_at) from platform.invoices i where i.account_id = a.id and i.status = 'open' and i.due_at < now()),
          'last_action_at', greatest(
            (select max(sa.created_at) from audit.store_actions sa where sa.account_id = a.id and sa.outcome = 'allowed'),
            (select max(sl.created_at) from app.sales sl where sl.account_id = a.id)),
          'active_days_30', (select count(distinct (sa.created_at at time zone 'America/Sao_Paulo')::date) from audit.store_actions sa
            where sa.account_id = a.id and sa.outcome = 'allowed' and sa.created_at > now() - interval '30 days'),
          'active_days_prev', (select count(distinct (sa.created_at at time zone 'America/Sao_Paulo')::date) from audit.store_actions sa
            where sa.account_id = a.id and sa.outcome = 'allowed' and sa.created_at <= now() - interval '30 days' and sa.created_at > now() - interval '60 days'),
          'sessions_30', (select count(distinct (coalesce(sa.operator_member_id, sa.actor_user_id), (sa.created_at at time zone 'America/Sao_Paulo')::date))
            from audit.store_actions sa where sa.account_id = a.id and sa.outcome = 'allowed' and sa.created_at > now() - interval '30 days'),
          'sales_30', (select count(*) from app.sales sl where sl.account_id = a.id and sl.status = 'paid' and sl.created_at > now() - interval '30 days'),
          'gmv_30', (select coalesce(sum(sl.total), 0) from app.sales sl where sl.account_id = a.id and sl.status = 'paid' and sl.created_at > now() - interval '30 days'),
          'origin', ld.source, 'campaign', ld.campaign, 'utm', ld.utm, 'lead_id', ld.id,
          'promo', private.has_consent(a.id, 'whatsapp') or private.has_consent(a.id, 'email'),
          'notes', (select coalesce(jsonb_agg(jsonb_build_object('when', n.created_at, 'who', coalesce(sf.name, 'Equipe'), 't', n.body)
                     order by n.created_at desc), '[]') from platform.account_notes n left join platform.staff sf on sf.user_id = n.staff_user_id
                     where n.account_id = a.id),
          'people', (select coalesce(jsonb_agg(jsonb_build_object('name', m.display_name, 'role', m.role, 'store', x.name,
                      'neighborhood', x.neighborhood, 'email', case when mu.email like '%.invalid' then null else mu.email end,
                      'last', (select max(sa.created_at) from audit.store_actions sa where sa.store_id = x.id
                               and (sa.actor_user_id = m.user_id or sa.operator_member_id = m.id)))
                      order by case m.role when 'owner' then 1 when 'manager' then 2 when 'cashier' then 3 else 4 end, m.display_name), '[]')
                     from app.store_members m join app.stores x on x.id = m.store_id left join auth.users mu on mu.id = m.user_id
                     where x.account_id = a.id and m.active)
        ) x
        from app.accounts a
        join platform.subscriptions s on s.account_id = a.id
        join auth.users u on u.id = a.owner_user_id
        left join app.profiles pr on pr.id = a.owner_user_id
        left join lateral (select * from app.stores x where x.account_id = a.id order by x.created_at limit 1) st on true
        left join lateral (select l.* from platform.leads l where l.merged_into is null and (l.account_id = a.id
          or (l.account_id is null and (lower(l.email::text) = lower(u.email) or (nullif(regexp_replace(coalesce(pr.phone, ''), '\D', '', 'g'), '') is not null
              and regexp_replace(l.phone, '\D', '', 'g') = regexp_replace(pr.phone, '\D', '', 'g')))))
          order by (l.account_id = a.id) desc nulls last, l.created_at limit 1) ld on true
      ) y),
      'invoices', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'account_id', i.account_id, 'amount', i.amount, 'status', i.status,
          'due_at', i.due_at, 'paid_at', i.paid_at, 'period_start', i.period_start, 'period_end', i.period_end, 'created_at', i.created_at,
          'stripe_invoice_id', i.stripe_invoice_id, 'nfse', i.nfse_number,
          'method', (select p.method from platform.payments p where p.invoice_id = i.id order by p.paid_at desc limit 1),
          'source', (select p.source from platform.payments p where p.invoice_id = i.id order by p.paid_at desc limit 1),
          'payment_id', (select p.id from platform.payments p where p.invoice_id = i.id order by p.paid_at desc limit 1))
          order by i.created_at), '[]') from platform.invoices i where i.status <> 'draft'),
      'refunds', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'account_id', p.account_id, 'amount', r.amount, 'reason', r.reason,
          'created_at', r.created_at, 'who', sf.name) order by r.created_at desc), '[]')
          from platform.refunds r join platform.payments p on p.id = r.payment_id left join platform.staff sf on sf.user_id = r.staff_user_id),
      'discounts', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'value', d.value, 'cycles', d.cycles,
          'starts_at', d.starts_at, 'stacks', d.stacks, 'reason', d.reason, 'created_at', d.created_at, 'who', coalesce(sf.name, 'Sistema'),
          'revoked_at', d.revoked_at, 'revoke_reason', d.revoke_reason,
          'accounts', (select coalesce(jsonb_agg(t.account_id), '[]') from platform.discount_targets t where t.discount_id = d.id))
          order by d.created_at), '[]') from platform.discounts d left join platform.staff sf on sf.user_id = d.created_by),
      'audit', (select coalesce(jsonb_agg(q.z order by q.w desc), '[]') from (
          select aa.created_at w, jsonb_build_object('id', aa.id, 'when', aa.created_at, 'who', coalesce(sf.name, 'Equipe'), 'role', aa.staff_role,
            'action', aa.action, 'entity', aa.entity, 'account_id', aa.account_id, 'reason', aa.reason,
            'before', aa.before, 'after', aa.after, 'outcome', aa.outcome) z
          from audit.admin_actions aa left join platform.staff sf on sf.user_id = aa.staff_user_id
          where aa.created_at > now() - interval '180 days'
          union all
          select e.created_at, jsonb_build_object('id', e.id, 'when', e.created_at, 'who', case when e.author like 'staff:%' then
              coalesce((select name from platform.staff where user_id::text = substr(e.author, 7)), 'Equipe') else 'Sistema' end,
            'action', 'subscription.transition', 'entity', 'subscription', 'account_id', s.account_id, 'reason', e.reason,
            'before', jsonb_build_object('status', e.from_status, 'access', e.from_access),
            'after', jsonb_build_object('status', e.to_status, 'access', e.to_access), 'outcome', 'allowed', 'system', e.author not like 'staff:%')
          from platform.subscription_events e join platform.subscriptions s on s.id = e.subscription_id
          where e.created_at > now() - interval '180 days'
          order by 1 desc limit 600) q),
      'queue', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'account_id', o.account_id, 'when', o.scheduled_for,
          'template', o.template_code, 'channel', o.channel, 'kind', o.kind, 'status', o.status, 'sent_at', o.sent_at, 'error', o.error,
          'dedupe', o.dedupe_key) order by o.scheduled_for desc), '[]')
          from (select * from platform.outbox where account_id is not null and template_code not in ('alert', 'verify_code', 'member_access')
                order by scheduled_for desc limit 400) o)
    );
  end if;

  if 'tickets.read' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'tickets', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number, 'account_id', t.account_id, 'store_id', t.store_id,
          'opened_by', coalesce(nullif(pr.full_name, ''), ou.raw_user_meta_data ->> 'name', 'Cliente'), 'kind', t.kind, 'subject', t.subject,
          'description', t.description, 'priority', t.priority, 'status', t.status, 'assignee', t.assignee,
          'assignee_name', (select name from platform.staff where user_id = t.assignee),
          'improvement_id', t.improvement_id, 'correlation_ids', t.correlation_ids,
          'first_response_at', t.first_response_at, 'resolved_at', t.resolved_at, 'created_at', t.created_at, 'updated_at', t.updated_at,
          'attachments', (select coalesce(jsonb_agg(at.name order by at.created_at), '[]') from support.ticket_attachments at where at.ticket_id = t.id),
          'messages', (select coalesce(jsonb_agg(jsonb_build_object('when', m.created_at, 'side', m.side, 'internal', m.internal, 't', m.body,
              'who', case when m.side = 'equipe' then coalesce((select name from platform.staff where user_id = m.author_id), 'Equipe Addegas')
                          else coalesce((select nullif(full_name, '') from app.profiles where id = m.author_id), 'Cliente') end)
              order by m.created_at), '[]') from support.ticket_messages m where m.ticket_id = t.id))
          order by t.created_at desc), '[]')
          from support.tickets t left join app.profiles pr on pr.id = t.opened_by left join auth.users ou on ou.id = t.opened_by),
      'improvements', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'number', i.number, 'title', i.title, 'area', i.area,
          'status', i.status, 'delivered_at', i.delivered_at) order by i.number), '[]') from support.improvements i)
    );
  end if;

  if 'crm.write' = any (v_acts) or 'marketing.write' = any (v_acts) or 'usage.read' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'stages', (select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'color', color) order by sort)
        from platform.lead_stages where code <> 'perdido'),
      'leads', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'store_name', l.store_name, 'phone', l.phone,
          'email', l.email, 'neighborhood', l.neighborhood, 'city', l.city, 'address', l.address, 'source', l.source, 'campaign', l.campaign,
          'utm', l.utm, 'stage', l.stage, 'owner', (select name from platform.staff where user_id = l.owner_staff), 'owner_id', l.owner_staff,
          'next_task', l.next_task, 'next_task_at', l.next_task_at, 'lost_reason', l.lost_reason, 'lost_detail', l.lost_detail,
          'lost_at', l.lost_at, 'account_id', l.account_id, 'promo_ok', l.promo_ok, 'merged_into', l.merged_into, 'created_at', l.created_at,
          'events', (select coalesce(jsonb_agg(jsonb_build_object('when', e.created_at, 'kind', e.kind, 'body', e.body,
              'who', coalesce((select name from platform.staff where user_id = e.staff_user_id), 'Sistema')) order by e.created_at), '[]')
              from platform.lead_events e where e.lead_id = l.id))
          order by l.created_at), '[]') from platform.leads l),
      'marketing_spend', (select coalesce(jsonb_agg(jsonb_build_object('channel', ms.channel, 'amount', ms.amount, 'period_start', ms.period_start,
          'period_end', ms.period_end, 'note', ms.note, 'created_at', ms.created_at) order by ms.created_at), '[]') from platform.marketing_spend ms)
    );
  end if;

  if 'catalog.write' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'catalog', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'ean', c.ean, 'name', c.name, 'brand', c.brand,
          'category', c.suggested_category, 'subcategory', c.subcategory, 'volume', c.volume_ml, 'unit', c.unit, 'packaging', c.packaging,
          'abv', c.abv, 'image', c.image_path, 'description', c.description, 'origin', c.origin, 'status', c.status, 'version', c.version,
          'created_at', c.created_at, 'updated_at', c.updated_at,
          'usage', (select count(distinct p.account_id) from app.products p where p.catalog_product_id = c.id),
          'history', (select coalesce(jsonb_agg(jsonb_build_object('when', aa.created_at, 'who', coalesce(sf.name, 'Equipe'), 'after', aa.after)
              order by aa.created_at desc), '[]') from audit.admin_actions aa left join platform.staff sf on sf.user_id = aa.staff_user_id
              where aa.entity = 'catalog_product' and aa.entity_id = c.id::text))
          order by c.created_at, c.name), '[]') from platform.catalog_products c)
    );
  end if;

  if 'messages.send' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'templates', (select coalesce(jsonb_agg(jsonb_build_object('code', m.code, 'channel', m.channel, 'kind', m.kind, 'subject', m.subject,
          'body', m.body, 'name', m.name) order by m.code, m.channel), '[]') from platform.message_templates m
          where m.code not in ('alert', 'verify_code', 'member_access', 'deletion_confirm')),
      'campaigns', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'channel', c.channel, 'template', c.template_code,
          'audience', c.audience, 'status', c.status, 'sent_at', c.sent_at, 'scheduled_for', c.scheduled_for, 'result', c.result,
          'created_at', c.created_at, 'who', coalesce(sf.name, 'Sistema'),
          'deliveries', (select coalesce(jsonb_agg(jsonb_build_object('account_id', o.account_id, 'status', o.status, 'channel', o.channel, 'error', o.error)), '[]')
              from platform.outbox o where o.dedupe_key like 'send:' || c.id || ':%'))
          order by c.created_at desc), '[]') from platform.campaigns c left join platform.staff sf on sf.user_id = c.created_by)
    );
  end if;

  if 'monitoring.read' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'logs', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'when', l.created_at, 'source', l.source, 'level', l.level, 'code', l.code,
          'message', l.message, 'correlation_id', l.correlation_id, 'account_id', l.account_id, 'context', l.context,
          'status', coalesce(tr.status, 'aberto'), 'assignee', (select name from platform.staff where user_id = tr.assignee),
          'history', coalesce(tr.history, '[]')) order by l.created_at desc), '[]')
          from (select * from audit.system_logs where created_at > now() - interval '365 days'
                and (source <> 'security' or v_me.role_code = 'master') order by created_at desc limit 500) l
          left join platform.log_triage tr on tr.log_id = l.id),
      'webhooks', (select coalesce(jsonb_agg(jsonb_build_object('provider', w.provider, 'status', w.status, 'n', w.n)), '[]') from (
          select provider, status, count(*) n from platform.webhook_inbox where received_at > now() - interval '7 days' group by 1, 2) w),
      'jobs', (select coalesce(jsonb_agg(jsonb_build_object('job', j.job, 'run_date', j.run_date, 'status', j.status, 'finished_at', j.finished_at)
          order by j.started_at desc), '[]') from (select * from platform.job_runs order by started_at desc limit 30) j)
    );
  end if;

  if 'staff.manage' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'team', (select coalesce(jsonb_agg(jsonb_build_object('user_id', sf.user_id, 'name', sf.name, 'email', sf.email, 'role', sf.role_code,
          'active', sf.active, 'last', coalesce(sf.last_activity_at, u.last_sign_in_at), 'invited', u.last_sign_in_at is null,
          'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = sf.user_id and f.status = 'verified'))
          order by sf.created_at), '[]') from platform.staff sf join auth.users u on u.id = sf.user_id)
    );
  end if;

  if 'usage.read' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'funnels', (select coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'name', f.name, 'steps', f.steps,
          'counts', (select coalesce(jsonb_agg((x ->> 'accounts')::int), '[]') from jsonb_array_elements(
              private.funnel_report(f.code, (current_date - 30), current_date) -> 'data') x)) order by f.code), '[]')
          from analytics.funnels f),
      'features_usage', (select coalesce(jsonb_agg(jsonb_build_object('entity', z.entity, 'accounts', z.n)), '[]') from (
          select sa.entity, count(distinct sa.account_id) n from audit.store_actions sa
          where sa.outcome = 'allowed' and sa.created_at > now() - interval '30 days' and sa.entity is not null group by 1) z)
    );
  end if;

  if 'gifts.write' = any (v_acts) then
    v_out := v_out || jsonb_build_object(
      'gift_items', (select coalesce(jsonb_agg(jsonb_build_object('code', g.code, 'name', g.name, 'qty', g.qty, 'unit_cost', g.unit_cost)
          order by g.name), '[]') from platform.gift_items g),
      'gift_kits', (select coalesce(jsonb_object_agg(k.milestone, k.items), '{}') from platform.gift_kits k),
      'gifts', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'number', g.number, 'account_id', g.account_id, 'milestone', g.milestone,
          'items', g.items, 'size', g.size, 'recipient', g.recipient, 'address', g.address, 'card', g.card, 'status', g.status,
          'tracking', g.tracking, 'cost', g.cost, 'freight', g.freight, 'created_at', g.created_at, 'sent_at', g.sent_at,
          'delivered_at', g.delivered_at, 'who', (select name from platform.staff where user_id = g.created_by)) order by g.created_at desc), '[]')
          from platform.gifts g)
    );
  end if;

  return private.ok(v_out);
end;
$$;

-- Ações ------------------------------------------------------------------------------------------------------

-- Ativar ou trocar o ciclo do plano único (D03). Ativar vale para teste, expirada e cancelada.
create or replace function private.admin_change_cycle(p_staff uuid, p_role text, p_account_id uuid, p_cycle platform.billing_cycle,
  p_activate boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.subscriptions;
  v_price bigint;
  v_extra bigint;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  select * into v_s from platform.subscriptions where account_id = p_account_id for update;
  if not found then return private.err('ACCOUNT_NOT_FOUND'); end if;
  select pp.price into v_price from platform.plan_prices pp where pp.plan_id = v_s.plan_id and pp.cycle = p_cycle and pp.active;
  if v_price is null then return private.err('PLAN_PRICE_NOT_FOUND'); end if;
  select ap.price into v_extra from platform.addon_prices ap join platform.addons ad on ad.id = ap.addon_id
  where ad.code = 'extra_store' and ap.cycle = p_cycle;
  update platform.subscriptions set cycle = p_cycle, price = v_price, extra_store_price = coalesce(v_extra, extra_store_price),
    current_period_start = case when p_activate then now() else current_period_start end,
    current_period_end = case when p_activate then now() + case p_cycle when 'monthly' then interval '1 month'
      when 'semiannual' then interval '6 months' else interval '12 months' end else current_period_end end,
    cancel_at_period_end = case when p_activate then false else cancel_at_period_end end
  where id = v_s.id;
  if p_activate then
    perform private.subscription_transition(p_account_id, 'active', 'allowed', 'Plano ativado pela equipe: ' || p_reason, 'staff:' || p_staff);
  end if;
  perform private.audit_admin(p_staff, p_role, 'accounts.plan', p_account_id, 'subscription', v_s.id::text,
    jsonb_build_object('cycle', v_s.cycle, 'price', v_s.price, 'status', v_s.status),
    jsonb_build_object('cycle', p_cycle, 'price', v_price, 'status', case when p_activate then 'active' else v_s.status::text end), p_reason);
  return private.ok();
end;
$$;

-- Preço por ciclo para novas assinaturas. Quem já assina mantém o preço até o aviso (D29).
create or replace function private.admin_plan_price(p_staff uuid, p_role text, p_cycle platform.billing_cycle, p_price bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old bigint;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if coalesce(p_price, 0) <= 0 then return private.err('PLAN_PRICE_INVALID'); end if;
  select pp.price into v_old from platform.plan_prices pp join platform.plans pl on pl.id = pp.plan_id
  where pl.for_sale and pp.cycle = p_cycle and pp.active for update of pp;
  if v_old is null then return private.err('PLAN_PRICE_NOT_FOUND'); end if;
  update platform.plan_prices pp set price = p_price, stripe_price_id = case when p_price <> v_old then null else stripe_price_id end
  from platform.plans pl where pl.id = pp.plan_id and pl.for_sale and pp.cycle = p_cycle and pp.active;
  perform private.audit_admin(p_staff, p_role, 'platform.config', null, 'plan_price', p_cycle::text,
    jsonb_build_object('price', v_old), jsonb_build_object('price', p_price), p_reason);
  return private.ok();
end;
$$;

-- Desconto com início escolhido (o admin_create_discount antigo começa na criação).
create or replace function private.admin_discount_create(p_staff uuid, p_role text, p_accounts uuid[], p_kind text, p_value numeric,
  p_cycles int, p_stacks boolean, p_starts_at timestamptz, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r jsonb;
begin
  v_r := private.admin_create_discount(p_staff, p_role, p_accounts, p_kind, p_value, p_cycles, p_stacks, p_reason);
  if (v_r ->> 'ok')::boolean and p_starts_at is not null then
    update platform.discounts set starts_at = p_starts_at where id = (v_r -> 'data' ->> 'discount_id')::uuid;
  end if;
  return v_r;
end;
$$;

create or replace function private.admin_revoke_discount(p_staff uuid, p_role text, p_discount_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d platform.discounts;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  select * into v_d from platform.discounts where id = p_discount_id for update;
  if not found then return private.err('DISCOUNT_NOT_FOUND'); end if;
  if v_d.revoked_at is not null then return private.err('DISCOUNT_ALREADY_REVOKED'); end if;
  update platform.discounts set revoked_at = now(), revoked_by = p_staff, revoke_reason = trim(p_reason) where id = v_d.id;
  perform private.audit_admin(p_staff, p_role, 'billing.discount', t.account_id, 'discount', v_d.id::text,
    jsonb_build_object('revoked', false), jsonb_build_object('revoked', true), p_reason)
  from platform.discount_targets t where t.discount_id = v_d.id;
  return private.ok();
end;
$$;

-- Anotação interna devolvendo erro estável quando vazia (o admin_add_note antigo não valida).
create or replace function private.admin_note(p_staff uuid, p_role text, p_account_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(trim(coalesce(p_body, ''))) < 2 then return private.err('NOTE_EMPTY'); end if;
  return private.admin_add_note(p_staff, p_role, p_account_id, trim(p_body));
end;
$$;

-- Resposta a ticket aceitando "aguardando equipe técnica" e "fechado" (resolve junto).
create or replace function private.staff_reply_ticket(p_staff uuid, p_role text, p_ticket_id uuid, p_body text, p_internal boolean,
  p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t support.tickets;
begin
  select * into v_t from support.tickets where id = p_ticket_id for update;
  if not found then return private.err('TICKET_NOT_FOUND'); end if;
  if p_status is not null and p_status not in ('novo', 'em_andamento', 'aguardando_cliente', 'aguardando_equipe', 'resolvido', 'fechado') then
    return private.err('TICKET_STATUS_INVALID');
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then return private.err('TICKET_MESSAGE_EMPTY'); end if;
  insert into support.ticket_messages (ticket_id, author_id, side, body, internal) values (p_ticket_id, p_staff, 'equipe', trim(p_body), p_internal);
  update support.tickets set
    first_response_at = case when not p_internal and first_response_at is null then now() else first_response_at end,
    status = coalesce(p_status, case when status = 'novo' and not p_internal then 'em_andamento' else status end),
    assignee = coalesce(assignee, p_staff),
    waiting_since = case when p_status = 'aguardando_cliente' then now() else waiting_since end,
    resolved_at = case when p_status in ('resolvido', 'fechado') then coalesce(resolved_at, now())
                       when p_status is not null then null else resolved_at end,
    updated_at = now()
  where id = p_ticket_id;
  perform private.audit_admin(p_staff, p_role, 'tickets.reply', v_t.account_id, 'ticket', p_ticket_id::text, null,
    jsonb_build_object('internal', p_internal, 'status', p_status));
  return private.ok();
end;
$$;

-- Campos do ticket sem mensagem: status, prioridade, responsável e melhoria.
create or replace function private.admin_ticket_update(p_staff uuid, p_role text, p_ticket_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t support.tickets;
  v_imp uuid := nullif(p ->> 'improvement_id', '')::uuid;
begin
  select * into v_t from support.tickets where id = p_ticket_id for update;
  if not found then return private.err('TICKET_NOT_FOUND'); end if;
  if p ? 'status' and p ->> 'status' not in ('novo', 'em_andamento', 'aguardando_cliente', 'aguardando_equipe', 'resolvido', 'fechado') then
    return private.err('TICKET_STATUS_INVALID');
  end if;
  if p ? 'priority' and p ->> 'priority' not in ('critica', 'alta', 'media', 'baixa') then return private.err('TICKET_PRIORITY_INVALID'); end if;
  if p ? 'assignee' and nullif(p ->> 'assignee', '') is not null
     and not exists (select 1 from platform.staff where user_id = (p ->> 'assignee')::uuid and active) then
    return private.err('STAFF_NOT_FOUND');
  end if;
  if length(trim(coalesce(p ->> 'improvement_title', ''))) >= 3 then
    insert into support.improvements (title, area, created_by) values (trim(p ->> 'improvement_title'), v_t.subject, p_staff) returning id into v_imp;
  end if;
  update support.tickets set
    status = coalesce(p ->> 'status', status),
    priority = coalesce(p ->> 'priority', priority),
    assignee = case when p ? 'assignee' then nullif(p ->> 'assignee', '')::uuid else assignee end,
    improvement_id = coalesce(v_imp, improvement_id),
    waiting_since = case when p ->> 'status' = 'aguardando_cliente' then now() else waiting_since end,
    resolved_at = case when p ->> 'status' in ('resolvido', 'fechado') then coalesce(resolved_at, now())
                       when p ? 'status' then null else resolved_at end,
    updated_at = now()
  where id = v_t.id;
  perform private.audit_admin(p_staff, p_role, 'tickets.reply', v_t.account_id, 'ticket', v_t.id::text,
    jsonb_build_object('status', v_t.status, 'priority', v_t.priority, 'assignee', v_t.assignee, 'improvement_id', v_t.improvement_id),
    p || jsonb_build_object('improvement_id', v_imp));
  return private.ok(jsonb_build_object('improvement_id', v_imp));
end;
$$;

-- Situação da melhoria. "Entregue" resolve os tickets ligados e avisa as adegas pela conversa do ticket.
create or replace function private.admin_improvement_status(p_staff uuid, p_role text, p_improvement_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i support.improvements;
  v_n int := 0;
begin
  if p_status not in ('analise', 'planejada', 'desenvolvimento', 'entregue') then return private.err('IMPROVEMENT_STATUS_INVALID'); end if;
  select * into v_i from support.improvements where id = p_improvement_id for update;
  if not found then return private.err('IMPROVEMENT_NOT_FOUND'); end if;
  update support.improvements set status = p_status,
    delivered_at = case when p_status = 'entregue' then coalesce(delivered_at, now()) else null end where id = v_i.id;
  if p_status = 'entregue' then
    insert into support.ticket_messages (ticket_id, author_id, side, body, internal)
    select t.id, p_staff, 'equipe', 'Entregamos esta melhoria! Obrigado pela sugestão.', false
    from support.tickets t where t.improvement_id = v_i.id and t.status not in ('resolvido', 'fechado');
    update support.tickets set status = 'resolvido', resolved_at = now(), updated_at = now(),
      first_response_at = coalesce(first_response_at, now())
    where improvement_id = v_i.id and status not in ('resolvido', 'fechado');
    get diagnostics v_n = row_count;
  end if;
  perform private.audit_admin(p_staff, p_role, 'tickets.reply', null, 'improvement', v_i.id::text,
    jsonb_build_object('status', v_i.status), jsonb_build_object('status', p_status, 'tickets_resolved', v_n));
  return private.ok(jsonb_build_object('tickets_resolved', v_n));
end;
$$;

-- Repositório de produtos com todos os campos, arquivamento e versão a cada edição.
create or replace function private.admin_catalog_save(p_staff uuid, p_role text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_old platform.catalog_products;
  v_status text;
  v_ean text := nullif(regexp_replace(coalesce(p ->> 'ean', ''), '\D', '', 'g'), '');
begin
  if v_id is not null then
    select * into v_old from platform.catalog_products where id = v_id for update;
    if not found then return private.err('CATALOG_NOT_FOUND'); end if;
  end if;
  v_status := coalesce(p ->> 'status', v_old.status, 'draft');
  if v_status not in ('draft', 'published', 'archived') then return private.err('CATALOG_STATUS_INVALID'); end if;
  if v_old.id is null and length(trim(coalesce(p ->> 'name', ''))) < 2 then return private.err('CATALOG_NAME_REQUIRED'); end if;
  if v_ean is not null and v_status <> 'archived' and exists (
     select 1 from platform.catalog_products where ean = v_ean and status <> 'archived' and id is distinct from v_id) then
    return private.err('CATALOG_EAN_DUPLICATE');
  end if;
  if v_status = 'published' and coalesce(v_ean, v_old.ean) is null then return private.err('CATALOG_EAN_REQUIRED'); end if;
  if v_id is null then
    insert into platform.catalog_products (ean, name, brand, volume_ml, abv, suggested_category, subcategory, unit, packaging,
      image_path, description, origin, status)
    values (v_ean, trim(p ->> 'name'), nullif(trim(p ->> 'brand'), ''), coalesce(nullif(p ->> 'volume', '')::numeric, 1)::int,
      nullif(p ->> 'abv', '')::numeric, nullif(p ->> 'category', ''), nullif(p ->> 'subcategory', ''), coalesce(nullif(p ->> 'unit', ''), 'ml'),
      nullif(p ->> 'packaging', ''), nullif(p ->> 'image', ''), nullif(p ->> 'description', ''), coalesce(nullif(p ->> 'origin', ''), 'Addegas'),
      v_status) returning id into v_id;
  else
    update platform.catalog_products set
      ean = case when p ? 'ean' then v_ean else ean end,
      name = coalesce(nullif(trim(p ->> 'name'), ''), name),
      brand = case when p ? 'brand' then nullif(trim(p ->> 'brand'), '') else brand end,
      volume_ml = case when p ? 'volume' then coalesce(nullif(p ->> 'volume', '')::numeric, 1)::int else volume_ml end,
      abv = case when p ? 'abv' then nullif(p ->> 'abv', '')::numeric else abv end,
      suggested_category = case when p ? 'category' then nullif(p ->> 'category', '') else suggested_category end,
      subcategory = case when p ? 'subcategory' then nullif(p ->> 'subcategory', '') else subcategory end,
      unit = coalesce(nullif(p ->> 'unit', ''), unit),
      packaging = case when p ? 'packaging' then nullif(p ->> 'packaging', '') else packaging end,
      image_path = case when p ? 'image' then nullif(p ->> 'image', '') else image_path end,
      description = case when p ? 'description' then nullif(p ->> 'description', '') else description end,
      status = v_status,
      version = version + case when p ?| array['name', 'brand', 'ean', 'volume', 'unit', 'packaging', 'image', 'abv', 'category'] then 1 else 0 end,
      updated_at = now()
    where id = v_id;
  end if;
  perform private.audit_admin(p_staff, p_role, 'catalog.write', null, 'catalog_product', v_id::text,
    case when v_old.id is null then null else jsonb_build_object('status', v_old.status, 'version', v_old.version) end, p - 'id');
  return private.ok(jsonb_build_object('catalog_product_id', v_id));
end;
$$;

-- Mesclar duplicados: o de origem vai para arquivados e as adegas passam a apontar para o que fica.
create or replace function private.admin_catalog_merge(p_staff uuid, p_role text, p_keep uuid, p_drop uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if p_keep = p_drop or not exists (select 1 from platform.catalog_products where id = p_keep)
     or not exists (select 1 from platform.catalog_products where id = p_drop) then
    return private.err('CATALOG_NOT_FOUND');
  end if;
  update app.products set catalog_product_id = p_keep where catalog_product_id = p_drop;
  get diagnostics v_n = row_count;
  update platform.catalog_products set status = 'archived', updated_at = now() where id = p_drop;
  perform private.audit_admin(p_staff, p_role, 'catalog.write', null, 'catalog_product', p_keep::text, null,
    jsonb_build_object('merged', p_drop, 'products_moved', v_n));
  perform private.audit_admin(p_staff, p_role, 'catalog.write', null, 'catalog_product', p_drop::text, null,
    jsonb_build_object('status', 'archived', 'merged_into', p_keep));
  return private.ok(jsonb_build_object('products_moved', v_n));
end;
$$;

-- CRM: criar, registrar contato, mudar etapa, perder, reabrir, mesclar e converter (E48).
create or replace function private.admin_lead_action(p_staff uuid, p_role text, p_lead_id uuid, p_action text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l platform.leads;
  v_o platform.leads;
  v_id uuid := p_lead_id;
  v_phone text;
begin
  if p_action = 'create' then
    v_phone := regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g');
    if length(trim(coalesce(p ->> 'store_name', ''))) < 2 or length(trim(coalesce(p ->> 'name', ''))) < 2 then return private.err('LEAD_NAME_REQUIRED'); end if;
    if length(v_phone) not between 10 and 13 then return private.err('LEAD_PHONE_INVALID'); end if;
    if exists (select 1 from platform.leads where regexp_replace(phone, '\D', '', 'g') = v_phone) then return private.err('LEAD_DUPLICATE'); end if;
    insert into platform.leads (name, store_name, phone, email, neighborhood, city, address, source, campaign, utm, stage, owner_staff,
      next_task, next_task_at, promo_ok)
    values (trim(p ->> 'name'), trim(p ->> 'store_name'), p ->> 'phone', nullif(lower(trim(p ->> 'email')), ''), nullif(p ->> 'neighborhood', ''),
      coalesce(nullif(p ->> 'city', ''), 'São Paulo'), nullif(p ->> 'address', ''), coalesce(nullif(p ->> 'source', ''), 'Outro'),
      nullif(p ->> 'campaign', ''), case when jsonb_typeof(p -> 'utm') = 'object' then p -> 'utm' else '{}'::jsonb end,
      'novo', coalesce(nullif(p ->> 'owner', '')::uuid, p_staff), 'Primeiro contato', now() + interval '1 day', coalesce((p ->> 'promo_ok')::boolean, true))
    returning id into v_id;
    insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (v_id, 'Cadastro manual', 'Lead criado no painel.', p_staff);
  else
    select * into v_l from platform.leads where id = p_lead_id for update;
    if not found then return private.err('LEAD_NOT_FOUND'); end if;
    if p_action = 'contact' then
      if length(trim(coalesce(p ->> 'body', ''))) < 2 then return private.err('LEAD_CONTACT_EMPTY'); end if;
      update platform.leads set next_task = nullif(p ->> 'next_task', ''), next_task_at = nullif(p ->> 'next_task_at', '')::timestamptz,
        updated_at = now() where id = v_l.id;
      insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (v_l.id, coalesce(nullif(p ->> 'channel', ''), 'WhatsApp'), trim(p ->> 'body'), p_staff);
    elsif p_action = 'stage' then
      if not exists (select 1 from platform.lead_stages where code = p ->> 'stage' and code <> 'perdido') then return private.err('LEAD_STAGE_INVALID'); end if;
      update platform.leads set stage = p ->> 'stage', updated_at = now() where id = v_l.id;
      insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (v_l.id, 'Sistema',
        'Etapa: ' || (select name from platform.lead_stages where code = v_l.stage) || ' → ' || (select name from platform.lead_stages where code = p ->> 'stage'), p_staff);
    elsif p_action = 'lost' then
      if length(trim(coalesce(p ->> 'detail', ''))) < 2 then return private.err('LOST_REASON_REQUIRED'); end if;
      update platform.leads set lost_reason = coalesce(nullif(p ->> 'reason', ''), 'Outro'), lost_detail = trim(p ->> 'detail'), lost_at = now(),
        next_task = null, next_task_at = null, updated_at = now() where id = v_l.id;
      insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (v_l.id, 'Sistema',
        'Perdido: ' || coalesce(nullif(p ->> 'reason', ''), 'Outro') || '. ' || trim(p ->> 'detail'), p_staff);
    elsif p_action = 'reopen' then
      update platform.leads set lost_reason = null, lost_detail = null, lost_at = null, updated_at = now() where id = v_l.id;
      insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (v_l.id, 'Sistema', 'Oportunidade reaberta', p_staff);
    elsif p_action = 'merge' then
      select * into v_o from platform.leads where id = (p ->> 'other')::uuid for update;
      if not found or v_o.id = v_l.id then return private.err('LEAD_NOT_FOUND'); end if;
      update platform.lead_events set lead_id = v_l.id, body = body || ' (de ' || coalesce(v_o.store_name, '') || ')' where lead_id = v_o.id;
      update platform.leads set merged_into = v_l.id, updated_at = now() where id = v_o.id;
      update platform.leads set promo_ok = v_l.promo_ok and v_o.promo_ok, email = coalesce(email, v_o.email),
        campaign = coalesce(campaign, v_o.campaign), utm = coalesce(utm, v_o.utm), updated_at = now() where id = v_l.id;
      insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (v_l.id, 'Sistema',
        'Mesclado com ' || v_o.store_name || ' (' || v_o.source || ').', p_staff);
    elsif p_action = 'convert' then
      -- A adega nasce quando o responsável conclui o cadastro pelo link; o lead fica em teste até lá.
      update platform.leads set stage = 'teste', updated_at = now() where id = v_l.id;
      insert into platform.lead_events (lead_id, kind, body, staff_user_id) values (v_l.id, 'Sistema',
        'Link de cadastro enviado ao responsável: a adega entra em teste ao concluir.', p_staff);
    else
      return private.err('LEAD_ACTION_INVALID');
    end if;
  end if;
  perform private.audit_admin(p_staff, p_role, 'crm.write', v_l.account_id, 'lead', v_id::text, null,
    jsonb_build_object('action', p_action) || coalesce(p, '{}'::jsonb));
  return private.ok(jsonb_build_object('lead_id', v_id));
end;
$$;

-- Etapas do funil comercial: renomear as existentes e acrescentar uma antes de "Em teste".
create or replace function private.admin_stages_save(p_staff uuid, p_role text, p_names jsonb, p_new text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k text;
begin
  for v_k in select jsonb_object_keys(p_names) loop
    if length(trim(p_names ->> v_k)) < 2 then return private.err('LEAD_STAGE_NAME_REQUIRED'); end if;
    update platform.lead_stages set name = trim(p_names ->> v_k) where code = v_k;
  end loop;
  if length(trim(coalesce(p_new, ''))) >= 2 then
    insert into platform.lead_stages (code, name, sort, color)
    values ('x' || to_char(now(), 'YYMMDDHH24MISS'), trim(p_new), (select sort - 1 from platform.lead_stages where code = 'teste'), '#B4B4B9');
  end if;
  perform private.audit_admin(p_staff, p_role, 'crm.write', null, 'lead_stages', null, null,
    jsonb_build_object('names', p_names, 'new', p_new));
  return private.ok();
end;
$$;

-- Triagem de uma ocorrência: status, responsável e nota (o log em si não muda).
create or replace function private.admin_log_triage(p_staff uuid, p_role text, p_log_id uuid, p_status text, p_assignee uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old platform.log_triage;
  v_txt text;
begin
  if p_status not in ('aberto', 'investigando', 'resolvido') then return private.err('LOG_STATUS_INVALID'); end if;
  if not exists (select 1 from audit.system_logs where id = p_log_id) then return private.err('LOG_NOT_FOUND'); end if;
  select * into v_old from platform.log_triage where log_id = p_log_id;
  v_txt := concat_ws(' · ',
    case when coalesce(v_old.status, 'aberto') <> p_status then 'status: ' || coalesce(v_old.status, 'aberto') || ' → ' || p_status end,
    case when v_old.assignee is distinct from p_assignee then 'responsável: ' || coalesce((select name from platform.staff where user_id = v_old.assignee), '—')
      || ' → ' || coalesce((select name from platform.staff where user_id = p_assignee), '—') end,
    case when length(trim(coalesce(p_note, ''))) > 0 then 'nota: ' || trim(p_note) end);
  if coalesce(v_txt, '') = '' then return private.ok(jsonb_build_object('changed', false)); end if;
  insert into platform.log_triage (log_id, status, assignee, history, updated_at)
  values (p_log_id, p_status, p_assignee, jsonb_build_array(jsonb_build_object('when', now(),
    'who', (select name from platform.staff where user_id = p_staff), 't', v_txt)), now())
  on conflict (log_id) do update set status = excluded.status, assignee = excluded.assignee, updated_at = now(),
    history = platform.log_triage.history || excluded.history;
  perform private.audit_admin(p_staff, p_role, 'monitoring.read', null, 'system_log', p_log_id::text, null, jsonb_build_object('change', v_txt));
  return private.ok(jsonb_build_object('changed', true));
end;
$$;

-- Equipe: trocar perfil ou desativar. Ninguém muda o próprio perfil nem se desativa (E11).
create or replace function private.admin_staff_update(p_staff uuid, p_role text, p_user_id uuid, p_staff_role text, p_active boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.staff;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if p_user_id = p_staff then return private.err('STAFF_SELF_CHANGE'); end if;
  select * into v_s from platform.staff where user_id = p_user_id for update;
  if not found then return private.err('STAFF_NOT_FOUND'); end if;
  if not exists (select 1 from platform.staff_roles where code = p_staff_role) then return private.err('STAFF_ROLE_INVALID'); end if;
  update platform.staff set role_code = p_staff_role, active = coalesce(p_active, active),
    last_activity_at = case when coalesce(p_active, active) then last_activity_at else null end where user_id = p_user_id;
  perform private.audit_admin(p_staff, p_role, 'staff.manage', null, 'staff', p_user_id::text,
    jsonb_build_object('role', v_s.role_code, 'active', v_s.active), jsonb_build_object('role', p_staff_role, 'active', coalesce(p_active, v_s.active)), p_reason);
  return private.ok();
end;
$$;

-- Configurações (automação, sessão, retenção, alertas, regra do catálogo). Retenção da auditoria só aumenta.
create or replace function private.admin_setting_set(p_staff uuid, p_role text, p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  select value into v_old from platform.settings where key = p_key for update;
  if not found then return private.err('SETTING_NOT_FOUND'); end if;
  if p_key = 'retention' and (p_value ->> 'sec')::int < (v_old ->> 'sec')::int then return private.err('RETENTION_ONLY_UP'); end if;
  update platform.settings set value = p_value, updated_by = p_staff, updated_at = now() where key = p_key;
  perform private.audit_admin(p_staff, p_role, case when p_key = 'catalog_update_rule' then 'catalog.write'
    when p_key = 'alerts' then 'monitoring.read' else 'platform.config' end, null, 'setting', p_key, v_old, p_value);
  return private.ok();
end;
$$;

-- Modelo de mensagem: nome, tipo e texto. Variável desconhecida é recusada.
create or replace function private.admin_template_save(p_staff uuid, p_role text, p_code text, p_name text, p_kind text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bad text;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_body, ''))) < 5 then return private.err('TEMPLATE_INVALID'); end if;
  if p_kind not in ('service', 'promotional') then return private.err('TEMPLATE_INVALID'); end if;
  select string_agg(m[1], ', ') into v_bad from regexp_matches(p_body, '\{(\w+)\}', 'g') m
  where m[1] not in ('nome_adega', 'responsavel', 'plano', 'vencimento', 'prazo_final', 'link_regularizacao', 'dias');
  if v_bad is not null then return private.err('TEMPLATE_VARIABLE_UNKNOWN', v_bad); end if;
  if p_kind = 'promotional' and p_body !~* 'sair' then return private.err('TEMPLATE_OPT_OUT_REQUIRED'); end if;
  update platform.message_templates set name = trim(p_name), kind = p_kind, body = trim(p_body) where code = p_code;
  if not found then return private.err('TEMPLATE_NOT_FOUND'); end if;
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'template', p_code, null,
    jsonb_build_object('name', p_name, 'kind', p_kind));
  return private.ok();
end;
$$;

-- Envio da central: um registro de envio e uma mensagem por adega e canal na fila (com consentimento quando promocional).
create or replace function private.admin_send(p_staff uuid, p_role text, p_template text, p_channels text[], p_accounts uuid[],
  p_when timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t platform.message_templates;
  v_c uuid;
  v_ch text;
  v_acc record;
  v_queued int := 0;
  v_skipped int := 0;
  v_link text;
  v_when timestamptz := coalesce(p_when, now());
begin
  if coalesce(array_length(p_accounts, 1), 0) = 0 then return private.err('SEND_NO_RECIPIENTS'); end if;
  if v_when < now() - interval '1 minute' then return private.err('SEND_DATE_PAST'); end if;
  select * into v_t from platform.message_templates where code = p_template limit 1;
  if not found then return private.err('TEMPLATE_NOT_FOUND'); end if;
  insert into platform.campaigns (name, channel, template_code, audience, status, created_by, sent_at, scheduled_for)
  values (coalesce(v_t.name, p_template), p_channels[1], p_template, jsonb_build_object('accounts', to_jsonb(p_accounts), 'channels', to_jsonb(p_channels)),
    case when v_when > now() + interval '1 minute' then 'scheduled' else 'sent' end, p_staff,
    case when v_when > now() + interval '1 minute' then null else now() end, v_when)
  returning id into v_c;
  foreach v_ch in array p_channels loop
    if not exists (select 1 from platform.message_templates where code = p_template and channel = v_ch) then continue; end if;
    for v_acc in
      select a.id, a.name, u.email, coalesce(nullif(pr.full_name, ''), a.name) resp,
        coalesce(nullif(pr.phone, ''), (select whatsapp from app.stores where account_id = a.id order by created_at limit 1)) phone,
        s.trial_ends_at, s.grace_ends_at, s.current_period_end
      from app.accounts a join auth.users u on u.id = a.owner_user_id left join app.profiles pr on pr.id = a.owner_user_id
      join platform.subscriptions s on s.account_id = a.id where a.id = any (p_accounts)
    loop
      v_link := 'https://app.addegas.com.br/assinatura';
      if private.enqueue_message(v_ch, v_t.kind, case v_ch when 'email' then v_acc.email else v_acc.phone end, p_template,
           jsonb_build_object('nome_adega', v_acc.name, 'responsavel', split_part(v_acc.resp, ' ', 1),
             'vencimento', to_char(coalesce(v_acc.trial_ends_at, v_acc.current_period_end) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
             'prazo_final', to_char(v_acc.grace_ends_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'),
             'link_regularizacao', v_link, 'plano', 'Addegas'),
           'send:' || v_c || ':' || v_acc.id || ':' || v_ch, v_acc.id, null, null, v_when) is not null then
        v_queued := v_queued + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    end loop;
  end loop;
  update platform.campaigns set result = jsonb_build_object('queued', v_queued, 'skipped', v_skipped) where id = v_c;
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'campaign', v_c::text, null,
    jsonb_build_object('template', p_template, 'channels', p_channels, 'accounts', array_length(p_accounts, 1), 'queued', v_queued, 'skipped', v_skipped));
  return private.ok(jsonb_build_object('campaign_id', v_c, 'queued', v_queued, 'skipped', v_skipped));
end;
$$;

-- Cancelar um envio agendado (as mensagens ainda na fila saem dela).
create or replace function private.admin_send_cancel(p_staff uuid, p_role text, p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update platform.campaigns set status = 'canceled' where id = p_campaign_id and status = 'scheduled';
  if not found then return private.err('SEND_NOT_SCHEDULED'); end if;
  update platform.outbox set status = 'canceled' where dedupe_key like 'send:' || p_campaign_id || ':%' and status = 'pending';
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'campaign', p_campaign_id::text, null, jsonb_build_object('status', 'canceled'));
  return private.ok();
end;
$$;

-- Reenviar as falhas de um envio: voltam para a fila.
create or replace function private.admin_send_retry(p_staff uuid, p_role text, p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  update platform.outbox set status = 'pending', attempts = 0, error = null, scheduled_for = now()
  where dedupe_key like 'send:' || p_campaign_id || ':%' and status in ('failed', 'dead');
  get diagnostics v_n = row_count;
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'campaign', p_campaign_id::text, null, jsonb_build_object('retry', v_n));
  return private.ok(jsonb_build_object('retried', v_n));
end;
$$;

-- Investimento informado manualmente (mês atual por padrão).
create or replace function private.admin_marketing_spend(p_staff uuid, p_role text, p_channel text, p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(trim(coalesce(p_channel, ''))) < 2 or coalesce(p_amount, -1) < 0 then return private.err('SPEND_INVALID'); end if;
  insert into platform.marketing_spend (channel, period_start, period_end, amount, note, staff_user_id)
  values (trim(p_channel), date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
    p_amount, 'informado manualmente', p_staff);
  perform private.audit_admin(p_staff, p_role, 'marketing.write', null, 'marketing_spend', p_channel, null, jsonb_build_object('amount', p_amount));
  return private.ok();
end;
$$;

-- Funil novo: etapas são nomes de eventos confirmados (analytics.events).
create or replace function private.admin_funnel_create(p_staff uuid, p_role text, p_name text, p_steps text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := 'f' || to_char(now(), 'YYMMDDHH24MISS');
begin
  if length(trim(coalesce(p_name, ''))) < 2 or coalesce(array_length(p_steps, 1), 0) < 2 then return private.err('FUNNEL_INVALID'); end if;
  insert into analytics.funnels (code, name, steps) values (v_code, trim(p_name), p_steps);
  perform private.audit_admin(p_staff, p_role, 'usage.read', null, 'funnel', v_code, null, jsonb_build_object('name', p_name, 'steps', p_steps));
  return private.ok(jsonb_build_object('code', v_code));
end;
$$;

-- Brindes: registrar envio (baixa o estoque), avançar (enviado, entregue), repor estoque e editar kit.
create or replace function private.admin_gift_action(p_staff uuid, p_role text, p_action text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_g platform.gifts;
  v_items text[];
  v_missing text;
  v_cost bigint;
  v_id uuid;
begin
  if p_action = 'create' then
    select array_agg(x) into v_items from jsonb_array_elements_text(p -> 'items') x;
    if coalesce(array_length(v_items, 1), 0) = 0 then return private.err('GIFT_ITEMS_REQUIRED'); end if;
    if length(trim(coalesce(p ->> 'recipient', ''))) < 2 or length(trim(coalesce(p ->> 'address', ''))) < 5 then return private.err('GIFT_ADDRESS_REQUIRED'); end if;
    select string_agg(i, ', ') into v_missing from unnest(v_items) i
    where not exists (select 1 from platform.gift_items g where g.code = i and g.qty > 0);
    if v_missing is not null then return private.err('GIFT_OUT_OF_STOCK', v_missing); end if;
    select coalesce(sum(unit_cost), 0) into v_cost from platform.gift_items where code = any (v_items);
    update platform.gift_items set qty = qty - 1 where code = any (v_items);
    insert into platform.gifts (account_id, milestone, items, size, recipient, address, card, notify, cost, freight, created_by)
    values ((p ->> 'account_id')::uuid, (p ->> 'milestone')::int, v_items, nullif(p ->> 'size', ''), trim(p ->> 'recipient'), trim(p ->> 'address'),
      nullif(p ->> 'card', ''), coalesce((p ->> 'notify')::boolean, false), v_cost, coalesce((p ->> 'freight')::bigint, 2490), p_staff)
    returning id into v_id;
  elsif p_action = 'advance' then
    select * into v_g from platform.gifts where id = (p ->> 'id')::uuid for update;
    if not found then return private.err('GIFT_NOT_FOUND'); end if;
    if v_g.status = 'preparando' then
      update platform.gifts set status = 'enviado', sent_at = now(), tracking = nullif(p ->> 'tracking', '') where id = v_g.id;
    elsif v_g.status = 'enviado' then
      update platform.gifts set status = 'entregue', delivered_at = now() where id = v_g.id;
    else
      return private.err('GIFT_ALREADY_DELIVERED');
    end if;
    v_id := v_g.id;
  elsif p_action = 'restock' then
    if coalesce((p ->> 'qty')::int, 0) < 1 then return private.err('GIFT_QTY_INVALID'); end if;
    update platform.gift_items set qty = qty + (p ->> 'qty')::int, unit_cost = coalesce(nullif(p ->> 'unit_cost', '')::bigint, unit_cost)
    where code = p ->> 'code';
    if not found then return private.err('GIFT_ITEM_NOT_FOUND'); end if;
  elsif p_action = 'kit' then
    select array_agg(x) into v_items from jsonb_array_elements_text(p -> 'items') x;
    if coalesce(array_length(v_items, 1), 0) = 0 then return private.err('GIFT_ITEMS_REQUIRED'); end if;
    update platform.gift_kits set items = v_items where milestone = (p ->> 'milestone')::int;
    if not found then return private.err('GIFT_KIT_NOT_FOUND'); end if;
  else
    return private.err('GIFT_ACTION_INVALID');
  end if;
  perform private.audit_admin(p_staff, p_role, 'gifts.write', nullif(p ->> 'account_id', '')::uuid, 'gift', coalesce(v_id::text, p ->> 'code', p ->> 'milestone'),
    null, jsonb_build_object('action', p_action) || p);
  return private.ok(jsonb_build_object('gift_id', v_id));
end;
$$;

-- Exportação de planilha fica registrada (quem, o quê, quantas linhas).
create or replace function private.admin_log_export(p_staff uuid, p_role text, p_name text, p_rows int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.audit_admin(p_staff, p_role, 'export', null, 'export', p_name, null, jsonb_build_object('rows', p_rows));
  return private.ok();
end;
$$;

-- Só a admin-api (service_role) chama estas funções.
do $$
declare
  f text;
begin
  foreach f in array array[
    'private.admin_snapshot(uuid)',
    'private.admin_change_cycle(uuid, text, uuid, platform.billing_cycle, boolean, text)',
    'private.admin_plan_price(uuid, text, platform.billing_cycle, bigint, text)',
    'private.admin_discount_create(uuid, text, uuid[], text, numeric, integer, boolean, timestamptz, text)',
    'private.admin_revoke_discount(uuid, text, uuid, text)',
    'private.admin_note(uuid, text, uuid, text)',
    'private.staff_reply_ticket(uuid, text, uuid, text, boolean, text)',
    'private.admin_ticket_update(uuid, text, uuid, jsonb)',
    'private.admin_improvement_status(uuid, text, uuid, text)',
    'private.admin_catalog_save(uuid, text, jsonb)',
    'private.admin_catalog_merge(uuid, text, uuid, uuid)',
    'private.admin_lead_action(uuid, text, uuid, text, jsonb)',
    'private.admin_stages_save(uuid, text, jsonb, text)',
    'private.admin_log_triage(uuid, text, uuid, text, uuid, text)',
    'private.admin_staff_update(uuid, text, uuid, text, boolean, text)',
    'private.admin_setting_set(uuid, text, text, jsonb)',
    'private.admin_template_save(uuid, text, text, text, text, text)',
    'private.admin_send(uuid, text, text, text[], uuid[], timestamptz)',
    'private.admin_send_cancel(uuid, text, uuid)',
    'private.admin_send_retry(uuid, text, uuid)',
    'private.admin_marketing_spend(uuid, text, text, bigint)',
    'private.admin_funnel_create(uuid, text, text, text[])',
    'private.admin_gift_action(uuid, text, text, jsonb)',
    'private.admin_log_export(uuid, text, text, integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

-- Inatividade de 30 min (D46) contando também a hora da verificação 2FA que está no token: quem acabou de
-- confirmar o código não é derrubado na primeira chamada só porque o último uso foi há mais de meia hora.
drop function private.staff_check(uuid, text, text);
create function private.staff_check(p_user uuid, p_aal text, p_action text, p_auth_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff platform.staff;
  v_last timestamptz;
begin
  select * into v_staff from platform.staff where user_id = p_user;
  if not found or not v_staff.active then
    perform private.audit_admin(p_user, null, p_action, p_outcome => 'denied', p_reason => 'STAFF_INACTIVE');
    return private.err('STAFF_INACTIVE');
  end if;
  if p_aal is distinct from 'aal2' then
    return private.err('MFA_REQUIRED');
  end if;
  v_last := greatest(v_staff.last_activity_at, least(p_auth_at, now()));
  if v_last is not null and v_last < now() - interval '30 minutes' then
    update platform.staff set last_activity_at = null where user_id = p_user;
    return private.err('SESSION_IDLE');
  end if;
  if not exists (select 1 from platform.role_actions where role_code = v_staff.role_code and action_code = p_action) then
    perform private.audit_admin(p_user, v_staff.role_code, p_action, p_outcome => 'denied', p_reason => 'FORBIDDEN_ACTION');
    return private.err('FORBIDDEN_ACTION');
  end if;
  update platform.staff set last_activity_at = now() where user_id = p_user;
  return private.ok(jsonb_build_object('user_id', v_staff.user_id, 'name', v_staff.name, 'role', v_staff.role_code,
    'actions', (select jsonb_agg(action_code order by action_code) from platform.role_actions where role_code = v_staff.role_code)));
end;
$$;
revoke execute on function private.staff_check(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function private.staff_check(uuid, text, text, timestamptz) to service_role;
