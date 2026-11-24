-- E41 (pedidos, entrega e entregador) e E45 (fila de mensagens: alertas e avisos de cobrança por WhatsApp e e-mail).

-- Quem age: pessoa logada (private.can) ou terminal com sessão de operador (private.operator_can).
create or replace function private.actor_can(p_store_id uuid, p_permission text, p_operator_session uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.current_user_kind() = 'terminal'
    then coalesce((private.current_terminal()).store_id = p_store_id and private.operator_can(p_operator_session, p_permission), false)
    else private.can(p_store_id, p_permission) end;
$$;

create or replace function private.my_member_id(p_store_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from app.store_members where store_id = p_store_id and user_id = (select auth.uid()) and active;
$$;
revoke execute on function private.actor_can(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function private.my_member_id(uuid) from public, anon;
grant execute on function private.my_member_id(uuid) to authenticated, service_role;

-- E41 · Pedidos ------------------------------------------------------------------------------------------
create table app.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  account_id uuid not null,
  number bigint not null,
  channel text not null check (channel in ('whatsapp', 'phone', 'counter', 'catalog', 'ifood', 'ze_delivery', 'food99', 'keeta')),
  external_id text,
  status text not null default 'new'
    check (status in ('new', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'rejected', 'canceled')),
  mode text not null default 'own_delivery' check (mode in ('own_delivery', 'platform_delivery', 'pickup')),
  -- Dados de entrega ficam só no pedido (D19) e são anonimizados após 6 meses (D25).
  customer_name text,
  customer_phone text,
  address text,
  delivery_fee app.cents not null default 0, -- D42
  free_delivery boolean not null default false,
  subtotal app.cents not null default 0,
  total app.cents not null default 0,
  payment_hint text,
  courier_member_id uuid,
  stock_moved boolean not null default false,
  sale_id uuid,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,
  unique (store_id, number),
  unique (id, store_id),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (courier_member_id, store_id) references app.store_members (id, store_id),
  foreign key (sale_id, store_id) references app.sales (id, store_id)
);
create unique index orders_external on app.orders (store_id, channel, external_id) where external_id is not null; -- §5
create index orders_store_status_idx on app.orders (store_id, status, created_at desc);
create index orders_store_account_idx on app.orders (store_id, account_id);
create index orders_courier_idx on app.orders (courier_member_id, store_id);
create index orders_sale_idx on app.orders (sale_id, store_id);

create table app.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  store_id uuid not null,
  product_id uuid references app.products (id),
  bundle_id uuid references app.bundles (id),
  name text not null,
  quantity app.qty not null check (quantity > 0),
  unit_price app.cents not null,
  check ((product_id is null) <> (bundle_id is null)),
  foreign key (order_id, store_id) references app.orders (id, store_id) on delete cascade
);
create index order_items_order_idx on app.order_items (order_id, store_id);
create index order_items_product_idx on app.order_items (product_id);
create index order_items_bundle_idx on app.order_items (bundle_id);

create table app.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  store_id uuid not null,
  from_status text,
  to_status text not null,
  actor_user uuid,
  origin text not null default 'store' check (origin in ('store', 'platform', 'courier')),
  reason text,
  created_at timestamptz not null default now(),
  foreign key (order_id, store_id) references app.orders (id, store_id)
);
create index order_events_order_idx on app.order_events (order_id, store_id, created_at);
create trigger order_events_immutable before update or delete on app.order_events
  for each row execute function private.ledger_immutable();

alter table app.sales add constraint sales_order_fk foreign key (order_id, store_id) references app.orders (id, store_id);
create index sales_order_store_idx on app.sales (order_id, store_id);

alter table app.orders enable row level security;
alter table app.order_items enable row level security;
alter table app.order_events enable row level security;

-- Entregador vê só os pedidos atribuídos a ele (§4); terminal vê os da loja.
create or replace function private.reads_order(p_store_id uuid, p_courier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.current_terminal()).store_id = p_store_id, false)
    or (private.can(p_store_id, 'pedidos')
        and (private.member_role(p_store_id) <> 'courier' or p_courier = private.my_member_id(p_store_id)));
$$;
revoke execute on function private.reads_order(uuid, uuid) from public, anon;
grant execute on function private.reads_order(uuid, uuid) to authenticated, service_role;

create policy orders_read on app.orders for select to authenticated using ((select private.reads_order(store_id, courier_member_id)));
create policy order_items_read on app.order_items for select to authenticated
  using (exists (select 1 from app.orders o where o.id = order_id));
create policy order_events_read on app.order_events for select to authenticated
  using (exists (select 1 from app.orders o where o.id = order_id));
grant select on app.orders, app.order_items, app.order_events to authenticated;
grant all on app.orders, app.order_items, app.order_events to service_role;

-- Cria pedido (WhatsApp, telefone, catálogo e, enquanto os apps estão em espera, pedidos dos apps lançados à mão).
-- p: {operator_session_id?, channel, external_id?, mode, customer_name, customer_phone, address, notes, payment_hint,
--     delivery_fee?, free_delivery?, items:[{product_id|bundle_id, quantity}]}
create or replace function app.create_order(p_store_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid := nullif(p ->> 'operator_session_id', '')::uuid;
  v_account uuid;
  v_order uuid;
  v_number bigint;
  v_it record;
  v_name text;
  v_price bigint;
  v_subtotal bigint := 0;
  v_fee bigint;
  v_free boolean := coalesce((p ->> 'free_delivery')::boolean, false);
  v_settings app.store_settings;
begin
  if not private.actor_can(p_store_id, 'pedidos', v_session) then
    perform private.audit_store('order.create', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if nullif(p ->> 'channel', '') is null or jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    return private.err('ORDER_INVALID');
  end if;
  if (p ->> 'channel') not in ('whatsapp', 'phone', 'counter', 'catalog', 'ifood', 'ze_delivery', 'food99', 'keeta') then
    return private.err('ORDER_CHANNEL_INVALID');
  end if;
  if nullif(p ->> 'external_id', '') is not null and exists (select 1 from app.orders where store_id = p_store_id
       and channel = p ->> 'channel' and external_id = p ->> 'external_id') then
    return private.err('ORDER_DUPLICATE');
  end if;
  select account_id into v_account from app.stores where id = p_store_id;
  select * into v_settings from app.store_settings where store_id = p_store_id;

  insert into app.store_counters (store_id, name, value) values (p_store_id, 'order', 1)
  on conflict (store_id, name) do update set value = app.store_counters.value + 1 returning value into v_number;

  insert into app.orders (store_id, account_id, number, channel, external_id, mode, customer_name, customer_phone, address,
    notes, payment_hint)
  values (p_store_id, v_account, v_number, p ->> 'channel', nullif(p ->> 'external_id', ''), coalesce(p ->> 'mode', 'own_delivery'),
    p ->> 'customer_name', regexp_replace(coalesce(p ->> 'customer_phone', ''), '\D', '', 'g'), p ->> 'address',
    p ->> 'notes', p ->> 'payment_hint')
  returning id into v_order;

  for v_it in select * from jsonb_to_recordset(p -> 'items') as x(product_id uuid, bundle_id uuid, quantity numeric) loop
    if coalesce(v_it.quantity, 0) <= 0 or ((v_it.product_id is null) = (v_it.bundle_id is null)) then
      perform private.fail('SALE_ITEM_INVALID');
    end if;
    if v_it.product_id is not null then
      select p2.name, private.effective_price(p_store_id, p2.id) into v_name, v_price
      from app.products p2 where p2.id = v_it.product_id and p2.account_id = v_account and p2.active;
    else
      select b.name, private.bundle_price(p_store_id, b.id) into v_name, v_price
      from app.bundles b where b.id = v_it.bundle_id and b.account_id = v_account and private.bundle_is_live(b.id, p_store_id);
    end if;
    if v_name is null then
      perform private.fail('SALE_PRODUCT_UNAVAILABLE', coalesce(v_it.product_id, v_it.bundle_id)::text);
    end if;
    insert into app.order_items (order_id, store_id, product_id, bundle_id, name, quantity, unit_price)
    values (v_order, p_store_id, v_it.product_id, v_it.bundle_id, v_name, v_it.quantity, v_price);
    v_subtotal := v_subtotal + round(v_it.quantity * v_price);
    v_name := null;
  end loop;

  -- Taxa de entrega (D42): informada, ou padrão da loja; frete grátis manual ou acima de um valor.
  v_fee := case when coalesce(p ->> 'mode', 'own_delivery') <> 'own_delivery' then 0
                else coalesce((p ->> 'delivery_fee')::bigint, v_settings.delivery_fee_default, 0) end;
  if v_settings.free_delivery_above is not null and v_subtotal >= v_settings.free_delivery_above then
    v_free := true;
  end if;
  if v_free then v_fee := 0; end if;

  update app.orders set subtotal = v_subtotal, delivery_fee = v_fee, free_delivery = v_free, total = v_subtotal + v_fee where id = v_order;
  insert into app.order_events (order_id, store_id, to_status, actor_user) values (v_order, p_store_id, 'new', (select auth.uid()));
  return private.ok(jsonb_build_object('order_id', v_order, 'number', v_number, 'total', v_subtotal + v_fee, 'delivery_fee', v_fee));
end;
$$;

-- Fluxo de status. Confirmar (new → preparing) baixa o estoque (§8); cancelar depois devolve.
create or replace function app.set_order_status(p_order_id uuid, p_status text, p_reason text default null,
  p_operator_session_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o app.orders;
  v_item record;
  v_allowed text[];
begin
  select * into v_o from app.orders where id = p_order_id for update;
  if not found then return private.err('ORDER_NOT_FOUND'); end if;
  if not private.actor_can(v_o.store_id, 'pedidos', p_operator_session_id) then
    perform private.audit_store('order.status', v_o.store_id, p_outcome => 'denied', p_entity => 'order', p_entity_id => p_order_id::text);
    return private.err('FORBIDDEN');
  end if;
  v_allowed := case v_o.status
    when 'new' then array['preparing', 'rejected', 'canceled']
    when 'preparing' then array['ready', 'canceled']
    when 'ready' then case v_o.mode when 'own_delivery' then array['out_for_delivery', 'canceled']
                                    else array['delivered', 'canceled'] end
    when 'out_for_delivery' then array['delivered', 'canceled']
    else array[]::text[] end;
  if not (p_status = any (v_allowed)) then
    return private.err('ORDER_TRANSITION_INVALID', v_o.status || ' -> ' || p_status);
  end if;
  if p_status in ('rejected', 'canceled') and length(trim(coalesce(p_reason, ''))) < 3 then
    return private.err('ORDER_REASON_REQUIRED');
  end if;

  if p_status = 'preparing' and not v_o.stock_moved then
    for v_item in select coalesce(oi.product_id, bi.product_id) pid, sum(oi.quantity * coalesce(bi.quantity, 1)) q
                  from app.order_items oi left join app.bundle_items bi on bi.bundle_id = oi.bundle_id
                  where oi.order_id = p_order_id group by 1 loop
      perform private.move_stock(v_o.store_id, v_item.pid, 'order', -v_item.q, null, 'order', p_order_id);
    end loop;
    update app.orders set stock_moved = true, confirmed_at = now() where id = p_order_id;
  elsif p_status in ('canceled', 'rejected') and v_o.stock_moved then
    for v_item in select coalesce(oi.product_id, bi.product_id) pid, sum(oi.quantity * coalesce(bi.quantity, 1)) q
                  from app.order_items oi left join app.bundle_items bi on bi.bundle_id = oi.bundle_id
                  where oi.order_id = p_order_id group by 1 loop
      perform private.move_stock(v_o.store_id, v_item.pid, 'order_cancel', v_item.q, null, 'order', p_order_id, p_reason);
    end loop;
    update app.orders set stock_moved = false where id = p_order_id;
  end if;

  update app.orders set status = p_status,
    canceled_at = case when p_status in ('canceled', 'rejected') then now() end,
    cancel_reason = case when p_status in ('canceled', 'rejected') then trim(p_reason) end
  where id = p_order_id;
  insert into app.order_events (order_id, store_id, from_status, to_status, actor_user, reason)
  values (p_order_id, v_o.store_id, v_o.status, p_status, (select auth.uid()), p_reason);
  if p_status in ('canceled', 'rejected') then
    perform private.audit_store('order.' || p_status, v_o.store_id, v_o.account_id, 'order', p_order_id::text, null,
      jsonb_build_object('from', v_o.status), p_reason);
  end if;
  return private.ok(jsonb_build_object('status', p_status));
end;
$$;

create or replace function app.assign_courier(p_order_id uuid, p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o app.orders;
begin
  select * into v_o from app.orders where id = p_order_id for update;
  if not found then return private.err('ORDER_NOT_FOUND'); end if;
  if not private.can(v_o.store_id, 'pedidos') or private.member_role(v_o.store_id) = 'courier' then
    return private.err('FORBIDDEN');
  end if;
  if not exists (select 1 from app.store_members where id = p_member_id and store_id = v_o.store_id and role = 'courier' and active) then
    return private.err('COURIER_INVALID');
  end if;
  update app.orders set courier_member_id = p_member_id where id = p_order_id;
  return private.ok();
end;
$$;

-- Entregador no celular: saiu para entrega e entregou (só os pedidos dele).
create or replace function app.courier_update(p_order_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o app.orders;
begin
  select * into v_o from app.orders where id = p_order_id for update;
  if not found or v_o.courier_member_id is distinct from private.my_member_id(v_o.store_id) then
    return private.err('FORBIDDEN');
  end if;
  if not ((v_o.status = 'ready' and p_status = 'out_for_delivery') or (v_o.status = 'out_for_delivery' and p_status = 'delivered')) then
    return private.err('ORDER_TRANSITION_INVALID', v_o.status || ' -> ' || p_status);
  end if;
  update app.orders set status = p_status where id = p_order_id;
  insert into app.order_events (order_id, store_id, from_status, to_status, actor_user, origin)
  values (p_order_id, v_o.store_id, v_o.status, p_status, (select auth.uid()), 'courier');
  return private.ok(jsonb_build_object('status', p_status));
end;
$$;

-- Concluir no caixa: vira venda com os itens do pedido (sem baixar estoque de novo) e a taxa de entrega.
create or replace function app.complete_order(p_order_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
begin
  select store_id into v_store from app.orders where id = p_order_id;
  if v_store is null then return private.err('ORDER_NOT_FOUND'); end if;
  if v_store is distinct from private.terminal_store() then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(nullif(p ->> 'operator_session_id', '')::uuid, 'pedidos') then
    return private.err('FORBIDDEN');
  end if;
  return private.finalize_sale(p, null, p_order_id);
end;
$$;

-- Pedido atrasado (E31): entra na rotina periódica.
create or replace function private.run_order_alerts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before int;
begin
  select count(*) into v_before from app.alerts;
  perform private.raise_alert(o.store_id, 'order_late', 'order', o.id::text,
    format('Pedido #%s (%s) está há %s min em "%s".', o.number, o.channel, extract(epoch from now() - o.created_at)::int / 60, o.status))
  from app.orders o left join app.alert_settings s on s.store_id = o.store_id and s.type = 'order_late'
  where o.status in ('new', 'preparing', 'ready', 'out_for_delivery')
    and o.created_at < now() - make_interval(mins => coalesce(s.threshold, 30));
  return (select count(*) from app.alerts) - v_before;
end;
$$;
revoke execute on function private.run_order_alerts() from public, anon, authenticated;
grant execute on function private.run_order_alerts() to service_role;
select cron.schedule('addegas-pedidos-atrasados', '*/5 * * * *', $$select private.run_order_alerts()$$);

-- E45 · Fila de mensagens ---------------------------------------------------------------------------------
create table platform.message_templates (
  code text not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  kind text not null check (kind in ('service', 'promotional')),
  subject text,
  body text not null,
  primary key (code, channel)
);
alter table platform.message_templates enable row level security;

insert into platform.message_templates values
  ('alert', 'whatsapp', 'service', null, 'Addegas · {nome_loja}: {mensagem}'),
  ('verify_code', 'whatsapp', 'service', null, 'Addegas: seu código para receber alertas da {nome_loja} é {codigo}. Responda SAIR para não receber mais.'),
  ('trial_ending', 'whatsapp', 'service', null, 'Oi {responsavel}! O teste grátis da {nome_adega} acaba em {dias} dia(s). Para continuar: {link_regularizacao}'),
  ('grace_started', 'whatsapp', 'service', null, 'Oi {responsavel}, não identificamos o pagamento da {nome_adega}. Você tem até {prazo_final} para regularizar: {link_regularizacao}'),
  ('grace_24h', 'whatsapp', 'service', null, 'Faltam 24 horas: o acesso da {nome_adega} será suspenso em {prazo_final} se o pagamento não for confirmado. {link_regularizacao}'),
  ('suspended', 'whatsapp', 'service', null, 'O acesso ao caixa da {nome_adega} foi suspenso. Seus dados estão guardados. Regularize em {link_regularizacao}'),
  ('payment_confirmed', 'whatsapp', 'service', null, 'Pagamento confirmado. Obrigado, {responsavel}! A {nome_adega} segue com tudo liberado.'),
  ('member_access', 'email', 'service', 'Seu acesso ao Addegas', 'Oi {nome}! {quem} criou seu acesso à {nome_loja}. Usuário: {usuario}. Senha provisória: {senha}. Troque no primeiro acesso.');

insert into platform.message_templates values
  ('grace_started', 'email', 'service', 'Pagamento não identificado', 'Oi {responsavel}, não identificamos o pagamento da {nome_adega}. Prazo para regularizar: {prazo_final}. {link_regularizacao}'),
  ('suspended', 'email', 'service', 'Acesso suspenso', 'O acesso ao caixa da {nome_adega} foi suspenso. Regularize em {link_regularizacao}.'),
  ('payment_confirmed', 'email', 'service', 'Pagamento confirmado', 'Pagamento confirmado. Obrigado, {responsavel}!');

create table platform.outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'email')),
  kind text not null check (kind in ('service', 'promotional')),
  account_id uuid references app.accounts (id),
  store_id uuid references app.stores (id),
  to_address text not null,
  template_code text not null,
  vars jsonb not null default '{}'::jsonb,
  condition jsonb, -- reconferida antes de enviar (§8)
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'canceled')),
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (template_code, channel) references platform.message_templates (code, channel)
);
create index outbox_queue_idx on platform.outbox (channel, scheduled_for) where status in ('pending', 'failed');
create index outbox_account_idx on platform.outbox (account_id);
create index outbox_store_idx on platform.outbox (store_id);
create index outbox_template_idx on platform.outbox (template_code, channel);
alter table platform.outbox enable row level security;

-- Números que recebem alertas da loja: confirmados por código (opt-in) e com SAIR (E45).
create table app.alert_recipients (
  store_id uuid not null references app.stores (id),
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  code_hash text,
  verified_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (store_id, phone)
);
alter table app.alert_recipients enable row level security;
create policy alert_recipients_read on app.alert_recipients for select to authenticated using ((select private.can(store_id, 'ajustes')));
grant select (store_id, phone, verified_at, opted_out_at, created_at) on app.alert_recipients to authenticated;
grant all on app.alert_recipients to service_role;

create or replace function private.enqueue_message(p_channel text, p_kind text, p_to text, p_template text, p_vars jsonb,
  p_dedupe text, p_account uuid default null, p_store uuid default null, p_condition jsonb default null,
  p_when timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(p_to, '') = '' then return null; end if;
  -- Promocional só com consentimento (E49).
  if p_kind = 'promotional' and not private.has_consent(p_account, p_channel) then return null; end if;
  insert into platform.outbox (channel, kind, account_id, store_id, to_address, template_code, vars, condition, dedupe_key, scheduled_for)
  values (p_channel, p_kind, p_account, p_store, p_to, p_template, p_vars, p_condition, p_dedupe, p_when)
  on conflict (dedupe_key) do nothing returning id into v_id;
  return v_id;
end;
$$;

-- Fora do horário silencioso da loja (E45).
create or replace function private.after_quiet_hours(p_store_id uuid, p_type text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.quiet_start is null or s.quiet_end is null then now()
    when s.quiet_start < s.quiet_end and (now() at time zone a.timezone)::time between s.quiet_start and s.quiet_end
      then (((now() at time zone a.timezone)::date + s.quiet_end) at time zone a.timezone)
    when s.quiet_start > s.quiet_end and ((now() at time zone a.timezone)::time >= s.quiet_start or (now() at time zone a.timezone)::time < s.quiet_end)
      then ((((now() at time zone a.timezone)::time >= s.quiet_start)::int + (now() at time zone a.timezone)::date + s.quiet_end) at time zone a.timezone)
    else now() end
  from app.stores st join app.accounts a on a.id = st.account_id
  left join app.alert_settings s on s.store_id = st.id and s.type = p_type
  where st.id = p_store_id;
$$;

-- Cada alerta novo vai para os números confirmados da loja.
create or replace function private.dispatch_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_message('whatsapp', 'service', r.phone, 'alert',
    jsonb_build_object('nome_loja', st.name, 'mensagem', new.message), 'alert:' || new.id || ':' || r.phone,
    st.account_id, new.store_id, null, coalesce(private.after_quiet_hours(new.store_id, new.type), now()))
  from app.alert_recipients r join app.stores st on st.id = r.store_id
  where r.store_id = new.store_id and r.verified_at is not null and r.opted_out_at is null;
  return new;
exception when others then
  return new;
end;
$$;
create trigger alerts_dispatch after insert on app.alerts for each row execute function private.dispatch_alert();

-- Avisos de cobrança ao dono (D49): WhatsApp e e-mail, reconferidos antes do envio.
create or replace function private.dispatch_billing_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tpl text;
  v_acc uuid;
  v_vars jsonb;
  v_phone text;
  v_email text;
begin
  v_tpl := case
    when new.to_access = 'grace' and new.from_access is distinct from 'grace' then 'grace_started'
    when new.to_access = 'suspended' and new.from_access is distinct from 'suspended' then 'suspended'
    when new.to_status = 'active' and new.from_status in ('past_due', 'trial') then 'payment_confirmed'
    else null end;
  if v_tpl is null then return new; end if;
  select s.account_id into v_acc from platform.subscriptions s where s.id = new.subscription_id;
  select coalesce(pr.phone, st.whatsapp), u.email,
         jsonb_build_object('responsavel', coalesce(split_part(pr.full_name, ' ', 1), 'tudo bem'), 'nome_adega', a.name,
           'prazo_final', to_char((select grace_ends_at from platform.subscriptions where id = new.subscription_id) at time zone a.timezone, 'DD/MM HH24:MI'),
           'link_regularizacao', 'https://app.addegas.com.br/assinatura')
  into v_phone, v_email, v_vars
  from app.accounts a join auth.users u on u.id = a.owner_user_id
  left join app.profiles pr on pr.id = a.owner_user_id
  left join lateral (select whatsapp from app.stores where account_id = a.id order by created_at limit 1) st on true
  where a.id = v_acc;

  perform private.enqueue_message('whatsapp', 'service', regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), v_tpl, v_vars,
    'billing:' || new.id || ':wa', v_acc, null, jsonb_build_object('type', 'subscription_state', 'account_id', v_acc,
      'access', new.to_access, 'status', new.to_status));
  if exists (select 1 from platform.message_templates where code = v_tpl and channel = 'email') then
    perform private.enqueue_message('email', 'service', v_email, v_tpl, v_vars, 'billing:' || new.id || ':email', v_acc, null,
      jsonb_build_object('type', 'subscription_state', 'account_id', v_acc, 'access', new.to_access, 'status', new.to_status));
  end if;
  return new;
exception when others then
  return new;
end;
$$;
create trigger subscription_events_notice after insert on platform.subscription_events
  for each row execute function private.dispatch_billing_notice();

-- A condição ainda vale? (ex.: não manda "carência começou" se já pagou)
create or replace function private.message_condition_holds(p_condition jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_condition is null then true
    when p_condition ->> 'type' = 'subscription_state' then exists (
      select 1 from platform.subscriptions s where s.account_id = (p_condition ->> 'account_id')::uuid
        and s.access::text = p_condition ->> 'access' and s.status::text = p_condition ->> 'status')
    else true end;
$$;

-- Envio (Edge Function cron-outbox): pega mensagens prontas; as que perderam a condição viram "canceled".
create or replace function private.outbox_claim(p_channel text, p_limit int default 30)
returns setof platform.outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  update platform.outbox set status = 'canceled', error = 'condição não vale mais'
  where status in ('pending', 'failed') and channel = p_channel and scheduled_for <= now()
    and not private.message_condition_holds(condition);
  return query
  update platform.outbox o set status = 'sending', attempts = o.attempts + 1
  where o.id in (select id from platform.outbox where channel = p_channel and status in ('pending', 'failed')
                 and scheduled_for <= now() order by scheduled_for limit p_limit for update skip locked)
  returning o.*;
end;
$$;

create or replace function private.outbox_result(p_id uuid, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update platform.outbox set
    status = case when p_ok then 'sent' when attempts >= 5 then 'failed' else 'failed' end,
    sent_at = case when p_ok then now() end, provider_message_id = p_provider_id, error = left(p_error, 1000),
    scheduled_for = case when p_ok then scheduled_for else now() + make_interval(mins => 2 * attempts) end
  where id = p_id;
$$;

-- Texto final com as variáveis.
create or replace function private.render_template(p_code text, p_channel text, p_vars jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_t platform.message_templates;
  v_body text;
  v_subject text;
  v_key text;
  v_val text;
begin
  select * into v_t from platform.message_templates where code = p_code and channel = p_channel;
  v_body := v_t.body;
  v_subject := v_t.subject;
  for v_key, v_val in select * from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    v_body := replace(v_body, '{' || v_key || '}', coalesce(v_val, ''));
    v_subject := replace(v_subject, '{' || v_key || '}', coalesce(v_val, ''));
  end loop;
  return jsonb_build_object('subject', v_subject, 'body', v_body);
end;
$$;

-- Cadastro e confirmação de número para alertas.
create or replace function app.add_alert_recipient(p_store_id uuid, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  if not private.can(p_store_id, 'ajustes') then return private.err('FORBIDDEN'); end if;
  if v_phone !~ '^[0-9]{10,13}$' then return private.err('PHONE_INVALID'); end if;
  if length(v_phone) <= 11 then v_phone := '55' || v_phone; end if;
  insert into app.alert_recipients (store_id, phone, code_hash)
  values (p_store_id, v_phone, extensions.crypt(v_code, extensions.gen_salt('bf', 6)))
  on conflict (store_id, phone) do update set code_hash = excluded.code_hash, verified_at = null, opted_out_at = null;
  perform private.enqueue_message('whatsapp', 'service', v_phone, 'verify_code',
    jsonb_build_object('nome_loja', (select name from app.stores where id = p_store_id), 'codigo', v_code),
    'verify:' || p_store_id || ':' || v_phone || ':' || extract(epoch from now())::bigint, (select account_id from app.stores where id = p_store_id), p_store_id);
  return private.ok(jsonb_build_object('phone', v_phone));
end;
$$;

create or replace function app.verify_alert_recipient(p_store_id uuid, p_phone text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r app.alert_recipients;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not private.can(p_store_id, 'ajustes') then return private.err('FORBIDDEN'); end if;
  if length(v_phone) <= 11 then v_phone := '55' || v_phone; end if;
  select * into v_r from app.alert_recipients where store_id = p_store_id and phone = v_phone for update;
  if not found or v_r.code_hash is null or v_r.code_hash <> extensions.crypt(p_code, v_r.code_hash) then
    return private.err('CODE_INVALID');
  end if;
  update app.alert_recipients set verified_at = now(), code_hash = null where store_id = p_store_id and phone = v_phone;
  return private.ok();
end;
$$;

-- Resposta "SAIR" (webhook de entrada da W-API): desliga alertas daquele número em todas as lojas.
create or replace function private.whatsapp_opt_out(p_phone text)
returns int
language sql
security definer
set search_path = ''
as $$
  with u as (update app.alert_recipients set opted_out_at = now() where phone = regexp_replace(p_phone, '\D', '', 'g')
             and opted_out_at is null returning 1)
  select count(*)::int from u;
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname in ('enqueue_message', 'after_quiet_hours', 'dispatch_alert', 'dispatch_billing_notice',
      'message_condition_holds', 'outbox_claim', 'outbox_result', 'render_template', 'whatsapp_opt_out')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array['app.create_order(uuid, jsonb)', 'app.set_order_status(uuid, text, text, uuid)', 'app.assign_courier(uuid, uuid)',
    'app.courier_update(uuid, text)', 'app.complete_order(uuid, jsonb)', 'app.add_alert_recipient(uuid, text)',
    'app.verify_alert_recipient(uuid, text, text)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
