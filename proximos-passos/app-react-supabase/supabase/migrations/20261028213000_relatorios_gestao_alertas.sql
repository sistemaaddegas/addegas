-- E24 (notinha), E25 (Início em tempo real), E26 (relatórios), E27 (fornecedores e compras),
-- E28 (contas a pagar), E30 (Lucro no Copo e anotações), E31 (ajustes, alertas e catálogo público).

-- E24 · Notinha não fiscal ---------------------------------------------------------------------
create table app.printer_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  terminal_id uuid, -- nulo = padrão da loja
  width_mm int not null default 80 check (width_mm in (58, 80)),
  method text not null default 'webusb' check (method in ('webusb', 'webserial', 'browser')), -- D18
  header text,
  footer text,
  auto_print boolean not null default true,
  copies int not null default 1 check (copies between 1 and 3),
  open_drawer_on_cash boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (store_id, terminal_id),
  foreign key (terminal_id, store_id) references app.terminals (id, store_id)
);
create index printer_settings_terminal_idx on app.printer_settings (terminal_id, store_id);
alter table app.printer_settings enable row level security;
create policy printer_settings_read on app.printer_settings for select to authenticated using ((select private.reads_store(store_id)));
grant select on app.printer_settings to authenticated;
grant all on app.printer_settings to service_role;

create or replace function app.sale_receipt(p_sale_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.id is null then private.err('SALE_NOT_FOUND')
    when not (private.can(s.store_id, 'relatorios') or (private.current_terminal()).store_id = s.store_id) then private.err('FORBIDDEN')
    else private.ok(jsonb_build_object(
      'store', jsonb_build_object('name', st.name, 'address', st.address, 'neighborhood', st.neighborhood, 'city', st.city,
        'whatsapp', st.whatsapp, 'document', a.document),
      'number', s.number, 'status', s.status,
      'datetime', to_char(s.created_at at time zone a.timezone, 'DD/MM/YYYY HH24:MI'),
      'operator', m.display_name, 'tab', t.label,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('name', si.name, 'quantity', si.quantity, 'unit_price', si.unit_price,
                 'total', si.total) order by si.name), '[]'::jsonb) from app.sale_items si where si.sale_id = s.id),
      'subtotal', s.subtotal, 'discount', s.discount, 'delivery_fee', s.delivery_fee, 'total', s.total,
      'payments', (select coalesce(jsonb_agg(jsonb_build_object('method', sp.method, 'amount', sp.amount, 'change', sp.change_given)), '[]'::jsonb)
                   from app.sale_payments sp where sp.sale_id = s.id),
      'fiado_name', (select f.name from app.fiado_accounts f where f.id = s.fiado_account_id),
      'pix', (select jsonb_build_object('key', ss.pix_key, 'name', ss.pix_receiver_name, 'city', ss.pix_city)
              from app.store_settings ss where ss.store_id = s.store_id and ss.pix_key is not null),
      'footer_legal', 'Documento sem valor fiscal'
    )) end
  from (select p_sale_id as id) x
  left join app.sales s on s.id = x.id
  left join app.stores st on st.id = s.store_id
  left join app.accounts a on a.id = st.account_id
  left join app.store_members m on m.id = s.operator_member_id
  left join app.tabs t on t.id = s.tab_id;
$$;

-- E25 · Início em tempo real ---------------------------------------------------------------------
-- Broadcast em canal privado store:{id}, com payload mínimo e sem dado pessoal (§9).
create or replace function private.broadcast_store_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', new.id);
  if tg_table_name = 'sales' then
    v_payload := v_payload || jsonb_build_object('number', new.number, 'total', new.total, 'status', new.status);
  elsif tg_table_name = 'cash_sessions' then
    v_payload := v_payload || jsonb_build_object('status', new.status, 'terminal_id', new.terminal_id);
  elsif tg_table_name = 'tabs' then
    v_payload := v_payload || jsonb_build_object('status', new.status, 'label', new.label);
  end if;
  perform realtime.send(v_payload, tg_table_name || '.' || lower(tg_op), 'store:' || new.store_id, true);
  return new;
exception when others then
  -- Tempo real nunca derruba uma venda.
  return new;
end;
$$;
revoke execute on function private.broadcast_store_event() from public, anon, authenticated;

create trigger sales_broadcast after insert or update on app.sales for each row execute function private.broadcast_store_event();
create trigger cash_sessions_broadcast after insert or update on app.cash_sessions for each row execute function private.broadcast_store_event();
create trigger tabs_broadcast after insert or update on app.tabs for each row execute function private.broadcast_store_event();

-- Só quem lê a loja assina o canal dela.
create or replace function private.can_join_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_topic !~ '^store:[0-9a-f-]{36}$' then
    return false;
  end if;
  return private.reads_store(substr(p_topic, 7)::uuid);
end;
$$;
revoke execute on function private.can_join_topic(text) from public, anon;
grant execute on function private.can_join_topic(text) to authenticated, service_role;

create policy addegas_store_channels on realtime.messages for select to authenticated
  using ((select private.can_join_topic((select realtime.topic()))) and extension = 'broadcast');

-- E26 · Relatórios ------------------------------------------------------------------------------------
create or replace function app.report_sales(p_store_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profit boolean := private.can(p_store_id, 'ver_lucro');
  v_out jsonb;
begin
  if not private.can(p_store_id, 'relatorios') then
    return private.err('FORBIDDEN');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    return private.err('REPORT_PERIOD_INVALID');
  end if;

  with v as (
    select s.* from app.sales s where s.store_id = p_store_id and s.business_date between p_from and p_to
  ), paid as (select * from v where status = 'paid')
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'totals', jsonb_build_object('revenue', (select coalesce(sum(total), 0) from paid), 'count', (select count(*) from paid),
      'avg_ticket', (select coalesce(round(avg(total)), 0) from paid), 'discounts', (select coalesce(sum(discount), 0) from paid),
      'delivery_fees', (select coalesce(sum(delivery_fee), 0) from paid),
      'canceled_count', (select count(*) from v where status = 'canceled'),
      'contingency_count', (select count(*) from paid where origin = 'contingency')),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('date', business_date, 'revenue', r, 'count', c) order by business_date), '[]'::jsonb)
               from (select business_date, sum(total) r, count(*) c from paid group by 1) x),
    'by_hour', (select coalesce(jsonb_object_agg(h, r), '{}'::jsonb) from (
               select extract(hour from p.created_at at time zone a.timezone)::int h, sum(p.total) r
               from paid p join app.stores st on st.id = p.store_id join app.accounts a on a.id = st.account_id group by 1) x),
    'by_channel', (select coalesce(jsonb_object_agg(channel, r), '{}'::jsonb) from (select channel, sum(total) r from paid group by 1) x),
    'by_method', (select coalesce(jsonb_object_agg(method, r), '{}'::jsonb) from (
               select sp.method, sum(sp.amount - sp.change_given) r from app.sale_payments sp join paid on paid.id = sp.sale_id group by 1) x),
    'by_operator', (select coalesce(jsonb_agg(jsonb_build_object('name', m.display_name, 'revenue', x.r, 'count', x.c,
                     'pix', x.pix, 'discounts', x.d) order by x.r desc), '[]'::jsonb)
               from (select operator_member_id, sum(total) r, count(*) c, sum(discount) d,
                       (select coalesce(sum(sp.amount), 0) from app.sale_payments sp join paid p2 on p2.id = sp.sale_id
                        where p2.operator_member_id = paid.operator_member_id and sp.method = 'pix') pix
                     from paid group by operator_member_id) x
               join app.store_members m on m.id = x.operator_member_id),
    'cancellations_by_operator', (select coalesce(jsonb_object_agg(m.display_name, x.c), '{}'::jsonb)
               from (select canceled_by, count(*) c from v where status = 'canceled' group by 1) x
               join app.store_members m on m.id = x.canceled_by),
    'top_products', (select coalesce(jsonb_agg(t order by (t ->> 'revenue')::bigint desc), '[]'::jsonb) from (
               select jsonb_build_object('name', si.name, 'quantity', sum(si.quantity), 'revenue', sum(si.total),
                 'margin', case when v_profit then sum(si.total) - sum(round(si.quantity * si.unit_cost)) end) t
               from app.sale_items si join paid on paid.id = si.sale_id group by si.name order by sum(si.total) desc limit 20) y),
    'sold_without_stock', (select coalesce(jsonb_agg(distinct si.name), '[]'::jsonb) from app.sale_items si join paid on paid.id = si.sale_id
               where si.sold_without_stock),
    'gross_margin', case when v_profit then (select coalesce(sum(si.total) - sum(round(si.quantity * si.unit_cost)), 0)
               from app.sale_items si join paid on paid.id = si.sale_id) end,
    'cash_closings', (select coalesce(jsonb_agg(jsonb_build_object('closed_at', cs.closed_at, 'expected', cs.expected_cash,
               'counted', cs.counted_cash, 'difference', cs.difference, 'terminal', t.name) order by cs.closed_at), '[]'::jsonb)
               from app.cash_sessions cs join app.terminals t on t.id = cs.terminal_id
               where cs.store_id = p_store_id and cs.status = 'closed' and cs.business_date between p_from and p_to)
  ) into v_out;
  return private.ok(v_out);
end;
$$;

-- E27 · Fornecedores e compras --------------------------------------------------------------------
create table app.suppliers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  name text not null check (length(trim(name)) between 1 and 120),
  kind text,
  phone text,
  lead_time text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, account_id)
);
create index suppliers_account_idx on app.suppliers (account_id);

create table app.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  account_id uuid not null,
  supplier_id uuid,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_received', 'received', 'canceled')),
  expected_on date,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, store_id),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (supplier_id, account_id) references app.suppliers (id, account_id)
);
create index purchase_orders_store_idx on app.purchase_orders (store_id, account_id);
create index purchase_orders_supplier_idx on app.purchase_orders (supplier_id, account_id);

create table app.purchase_order_items (
  purchase_order_id uuid not null,
  store_id uuid not null,
  product_id uuid not null references app.products (id),
  quantity app.qty not null check (quantity > 0),
  unit_cost_estimate app.cents,
  received_qty app.qty not null default 0,
  primary key (purchase_order_id, product_id),
  foreign key (purchase_order_id, store_id) references app.purchase_orders (id, store_id) on delete cascade
);
create index purchase_order_items_po_idx on app.purchase_order_items (purchase_order_id, store_id);
create index purchase_order_items_product_idx on app.purchase_order_items (product_id);

alter table app.suppliers enable row level security;
alter table app.purchase_orders enable row level security;
alter table app.purchase_order_items enable row level security;
create policy suppliers_read on app.suppliers for select to authenticated using ((select private.can_account(account_id, 'compras')));
create policy purchase_orders_read on app.purchase_orders for select to authenticated using ((select private.can(store_id, 'compras')));
create policy purchase_order_items_read on app.purchase_order_items for select to authenticated using ((select private.can(store_id, 'compras')));
grant select on app.suppliers, app.purchase_orders, app.purchase_order_items to authenticated;
grant all on app.suppliers, app.purchase_orders, app.purchase_order_items to service_role;

create or replace function app.save_supplier(p_account_id uuid, p_supplier jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_supplier ->> 'id', '')::uuid;
begin
  if not private.can_account(p_account_id, 'compras') then
    return private.err('FORBIDDEN');
  end if;
  if v_id is null then
    if length(trim(coalesce(p_supplier ->> 'name', ''))) < 1 then return private.err('SUPPLIER_NAME'); end if;
    insert into app.suppliers (account_id, name, kind, phone, lead_time, note)
    values (p_account_id, trim(p_supplier ->> 'name'), p_supplier ->> 'kind', p_supplier ->> 'phone', p_supplier ->> 'lead_time', p_supplier ->> 'note')
    returning id into v_id;
  else
    update app.suppliers set name = coalesce(nullif(trim(p_supplier ->> 'name'), ''), name), kind = coalesce(p_supplier ->> 'kind', kind),
      phone = coalesce(p_supplier ->> 'phone', phone), lead_time = coalesce(p_supplier ->> 'lead_time', lead_time),
      note = coalesce(p_supplier ->> 'note', note), active = coalesce((p_supplier ->> 'active')::boolean, active)
    where id = v_id and account_id = p_account_id;
    if not found then return private.err('SUPPLIER_NOT_FOUND'); end if;
  end if;
  return private.ok(jsonb_build_object('supplier_id', v_id));
end;
$$;

-- Itens: [{product_id, quantity, unit_cost_estimate}]
create or replace function app.save_purchase_order(p_store_id uuid, p_supplier_id uuid, p_items jsonb,
  p_status text default 'draft', p_expected_on date default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_po uuid;
begin
  if not private.can(p_store_id, 'compras') then
    return private.err('FORBIDDEN');
  end if;
  if p_status not in ('draft', 'sent') then
    return private.err('PURCHASE_STATUS');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return private.err('PURCHASE_ITEMS_EMPTY');
  end if;
  select account_id into v_account from app.stores where id = p_store_id;
  insert into app.purchase_orders (store_id, account_id, supplier_id, status, expected_on, note)
  values (p_store_id, v_account, p_supplier_id, p_status, p_expected_on, p_note) returning id into v_po;
  insert into app.purchase_order_items (purchase_order_id, store_id, product_id, quantity, unit_cost_estimate)
  select v_po, p_store_id, (i ->> 'product_id')::uuid, (i ->> 'quantity')::numeric, nullif(i ->> 'unit_cost_estimate', '')::bigint
  from jsonb_array_elements(p_items) i;
  return private.ok(jsonb_build_object('purchase_order_id', v_po));
end;
$$;

-- Recebimento do pedido: dá entrada no estoque (E17) e atualiza "recebido". Itens: [{product_id, quantity, unit_cost, lot_code?, expires_on?}]
create or replace function app.receive_purchase_order(p_purchase_order_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_po app.purchase_orders;
  v_res jsonb;
  v_pending boolean;
begin
  select * into v_po from app.purchase_orders where id = p_purchase_order_id for update;
  if not found or v_po.status in ('received', 'canceled') then
    return private.err('PURCHASE_NOT_OPEN');
  end if;
  if not (private.can(v_po.store_id, 'compras') and private.can(v_po.store_id, 'estoque')) then
    return private.err('FORBIDDEN');
  end if;
  v_res := app.receive_goods(v_po.store_id, p_items, 'Pedido de compra', v_po.supplier_id, v_po.id);
  if not (v_res ->> 'ok')::boolean then
    return v_res;
  end if;
  update app.purchase_order_items poi set received_qty = poi.received_qty + i.q
  from (select (x ->> 'product_id')::uuid pid, sum((x ->> 'quantity')::numeric) q from jsonb_array_elements(p_items) x group by 1) i
  where poi.purchase_order_id = v_po.id and poi.product_id = i.pid;
  select exists (select 1 from app.purchase_order_items where purchase_order_id = v_po.id and received_qty < quantity) into v_pending;
  update app.purchase_orders set status = case when v_pending then 'partially_received' else 'received' end where id = v_po.id;
  return private.ok(jsonb_build_object('status', case when v_pending then 'partially_received' else 'received' end));
end;
$$;

-- Sugestão de compra: venda média diária × dias de cobertura − saldo (E27).
create or replace function app.purchase_suggestion(p_store_id uuid, p_coverage_days int default 7, p_lookback_days int default 28)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.can(p_store_id, 'compras') then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(x order by (x ->> 'suggested')::numeric desc), '[]'::jsonb)) end
  from (
    select jsonb_build_object('product_id', p.id, 'name', p.name, 'stock', coalesce(ps.quantity, 0),
      'min_stock', coalesce(sp.min_stock, p.min_stock),
      'daily_avg', round(coalesce(sold.q, 0) / greatest(p_lookback_days, 1), 2),
      'suggested', greatest(ceil(coalesce(sold.q, 0) / greatest(p_lookback_days, 1) * p_coverage_days - coalesce(ps.quantity, 0)),
                            ceil(coalesce(sp.min_stock, p.min_stock) - coalesce(ps.quantity, 0)), 0)) x
    from app.stores st
    join app.products p on p.account_id = st.account_id and p.active
    left join app.store_products sp on sp.product_id = p.id and sp.store_id = st.id
    left join app.product_stock ps on ps.product_id = p.id and ps.store_id = st.id
    left join lateral (
      select -sum(m.quantity) q from app.stock_movements m
      where m.store_id = st.id and m.product_id = p.id and m.type in ('sale', 'tab', 'order')
        and m.created_at > now() - make_interval(days => p_lookback_days)
    ) sold on true
    where st.id = p_store_id
  ) y
  where (x ->> 'suggested')::numeric > 0;
$$;

-- E28 · Contas a pagar ------------------------------------------------------------------------------
create table app.bills (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  account_id uuid not null,
  description text not null check (length(trim(description)) between 1 and 120),
  category text,
  supplier_id uuid,
  amount app.cents not null check (amount > 0),
  due_on date not null,
  interest_kind text not null default 'none' check (interest_kind in ('none', 'pct_month', 'fixed')), -- D17
  interest_value numeric(10, 2) not null default 0,
  recurring_monthly boolean not null default false,
  paid_at timestamptz,
  paid_amount app.cents,
  paid_method text,
  proof_path text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (supplier_id, account_id) references app.suppliers (id, account_id)
);
create index bills_store_due_idx on app.bills (store_id, due_on) where paid_at is null;
create index bills_store_account_idx on app.bills (store_id, account_id);
create index bills_supplier_idx on app.bills (supplier_id, account_id);
alter table app.bills enable row level security;
create policy bills_read on app.bills for select to authenticated using ((select private.can(store_id, 'contas')));
grant select on app.bills to authenticated;
grant all on app.bills to service_role;

-- Regra do front (D17): % ao mês × meses iniciados de atraso (mínimo 1), ou valor fixo por atraso.
create or replace function private.bill_amount_due(p_bill app.bills, p_on date default current_date)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select p_bill.amount + case
    when p_on <= p_bill.due_on or p_bill.interest_kind = 'none' then 0
    when p_bill.interest_kind = 'fixed' then round(p_bill.interest_value * 100)::bigint
    else round(p_bill.amount * p_bill.interest_value / 100 * greatest(1, ceil((p_on - p_bill.due_on) / 30.0)))::bigint
  end;
$$;
revoke execute on function private.bill_amount_due(app.bills, date) from public, anon, authenticated;

create or replace function app.save_bill(p_store_id uuid, p_bill jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_bill ->> 'id', '')::uuid;
  v_account uuid;
begin
  if not private.can(p_store_id, 'contas') then
    return private.err('FORBIDDEN');
  end if;
  if coalesce((p_bill ->> 'amount')::bigint, 0) <= 0 or nullif(p_bill ->> 'due_on', '') is null then
    return private.err('BILL_INVALID');
  end if;
  select account_id into v_account from app.stores where id = p_store_id;
  if v_id is null then
    insert into app.bills (store_id, account_id, description, category, supplier_id, amount, due_on, interest_kind, interest_value, recurring_monthly)
    values (p_store_id, v_account, trim(p_bill ->> 'description'), p_bill ->> 'category', nullif(p_bill ->> 'supplier_id', '')::uuid,
      (p_bill ->> 'amount')::bigint, (p_bill ->> 'due_on')::date, coalesce(p_bill ->> 'interest_kind', 'none'),
      coalesce((p_bill ->> 'interest_value')::numeric, 0), coalesce((p_bill ->> 'recurring_monthly')::boolean, false))
    returning id into v_id;
  else
    update app.bills set description = coalesce(nullif(trim(p_bill ->> 'description'), ''), description),
      category = coalesce(p_bill ->> 'category', category), amount = (p_bill ->> 'amount')::bigint, due_on = (p_bill ->> 'due_on')::date,
      interest_kind = coalesce(p_bill ->> 'interest_kind', interest_kind),
      interest_value = coalesce((p_bill ->> 'interest_value')::numeric, interest_value),
      recurring_monthly = coalesce((p_bill ->> 'recurring_monthly')::boolean, recurring_monthly)
    where id = v_id and store_id = p_store_id and paid_at is null;
    if not found then return private.err('BILL_NOT_FOUND'); end if;
  end if;
  return private.ok(jsonb_build_object('bill_id', v_id));
end;
$$;

-- Pagar: registra o valor com juros; conta recorrente gera a do mês seguinte.
create or replace function app.pay_bill(p_bill_id uuid, p_method text, p_paid_on date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b app.bills;
  v_due bigint;
begin
  select * into v_b from app.bills where id = p_bill_id for update;
  if not found or v_b.paid_at is not null then
    return private.err('BILL_NOT_OPEN');
  end if;
  if not private.can(v_b.store_id, 'contas') then
    perform private.audit_store('bill.pay', v_b.store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  v_due := private.bill_amount_due(v_b, p_paid_on);
  update app.bills set paid_at = now(), paid_amount = v_due, paid_method = p_method where id = p_bill_id;
  if v_b.recurring_monthly then
    insert into app.bills (store_id, account_id, description, category, supplier_id, amount, due_on, interest_kind, interest_value, recurring_monthly)
    values (v_b.store_id, v_b.account_id, v_b.description, v_b.category, v_b.supplier_id, v_b.amount,
      (v_b.due_on + interval '1 month')::date, v_b.interest_kind, v_b.interest_value, true);
  end if;
  perform private.audit_store('bill.pay', v_b.store_id, v_b.account_id, 'bill', p_bill_id::text, null,
    jsonb_build_object('amount_paid', v_due, 'method', p_method));
  return private.ok(jsonb_build_object('paid_amount', v_due));
end;
$$;

create or replace function app.bills_list(p_store_id uuid, p_only_open boolean default true)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.can(p_store_id, 'contas') then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'description', b.description, 'category', b.category,
      'amount', b.amount, 'due_on', b.due_on, 'days_late', greatest(current_date - b.due_on, 0),
      'amount_due_today', private.bill_amount_due(b, current_date), 'paid_at', b.paid_at, 'paid_amount', b.paid_amount)
      order by b.due_on), '[]'::jsonb)) end
  from app.bills b where b.store_id = p_store_id and (not p_only_open or b.paid_at is null);
$$;

-- E30 · Lucro no Copo (calculadora, D09) e anotações (D53) -------------------------------------------
create table app.drink_recipes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  name text not null check (length(trim(name)) between 1 and 80),
  sale_price app.cents not null default 0,
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, account_id)
);
create index drink_recipes_account_idx on app.drink_recipes (account_id);

create table app.drink_recipe_items (
  recipe_id uuid not null,
  account_id uuid not null,
  product_id uuid not null,
  amount app.qty not null check (amount > 0),
  unit text not null check (unit in ('ml', 'un')),
  primary key (recipe_id, product_id),
  foreign key (recipe_id, account_id) references app.drink_recipes (id, account_id) on delete cascade,
  foreign key (product_id, account_id) references app.products (id, account_id)
);
create index drink_recipe_items_recipe_idx on app.drink_recipe_items (recipe_id, account_id);
create index drink_recipe_items_product_idx on app.drink_recipe_items (product_id, account_id);

create table app.notes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  author_id uuid not null default auth.uid() references auth.users (id),
  title text not null check (length(trim(title)) between 1 and 120),
  body text,
  priority text not null default 'media' check (priority in ('alta', 'media', 'baixa')),
  done boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_store_idx on app.notes (store_id, pinned desc, created_at desc);
create index notes_author_idx on app.notes (author_id);
create trigger notes_touch before update on app.notes for each row execute function private.touch_updated_at();

alter table app.drink_recipes enable row level security;
alter table app.drink_recipe_items enable row level security;
alter table app.notes enable row level security;
create policy drink_recipes_read on app.drink_recipes for select to authenticated using ((select private.can_account(account_id, 'ferramentas')));
create policy drink_recipe_items_read on app.drink_recipe_items for select to authenticated using ((select private.can_account(account_id, 'ferramentas')));
-- Anotações: CRUD direto pela API, com RLS completa (USING + WITH CHECK, §9).
create policy notes_select on app.notes for select to authenticated using ((select private.is_store_member(store_id)));
create policy notes_insert on app.notes for insert to authenticated
  with check ((select private.can(store_id, 'ferramentas')) and author_id = (select auth.uid()));
create policy notes_update on app.notes for update to authenticated
  using ((select private.can(store_id, 'ferramentas'))) with check ((select private.can(store_id, 'ferramentas')));
create policy notes_delete on app.notes for delete to authenticated using ((select private.can(store_id, 'ferramentas')));
grant select on app.drink_recipes, app.drink_recipe_items to authenticated;
grant select, insert, delete on app.notes to authenticated;
grant update (title, body, priority, done, pinned) on app.notes to authenticated;
grant all on app.drink_recipes, app.drink_recipe_items, app.notes to service_role;

-- p_recipe: {id?, name, sale_price, items:[{product_id, amount, unit}]}
create or replace function app.save_drink_recipe(p_account_id uuid, p_recipe jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_recipe ->> 'id', '')::uuid;
begin
  if not private.can_account(p_account_id, 'ferramentas') then
    return private.err('FORBIDDEN');
  end if;
  if jsonb_typeof(p_recipe -> 'items') <> 'array' or jsonb_array_length(p_recipe -> 'items') = 0 then
    return private.err('RECIPE_ITEMS_EMPTY');
  end if;
  if v_id is null then
    insert into app.drink_recipes (account_id, name, sale_price) values (p_account_id, trim(p_recipe ->> 'name'),
      coalesce((p_recipe ->> 'sale_price')::bigint, 0)) returning id into v_id;
  else
    update app.drink_recipes set name = coalesce(nullif(trim(p_recipe ->> 'name'), ''), name),
      sale_price = coalesce((p_recipe ->> 'sale_price')::bigint, sale_price) where id = v_id and account_id = p_account_id;
    if not found then return private.err('RECIPE_NOT_FOUND'); end if;
    delete from app.drink_recipe_items where recipe_id = v_id;
  end if;
  insert into app.drink_recipe_items (recipe_id, account_id, product_id, amount, unit)
  select v_id, p_account_id, (i ->> 'product_id')::uuid, (i ->> 'amount')::numeric, coalesce(i ->> 'unit', 'ml')
  from jsonb_array_elements(p_recipe -> 'items') i;
  return private.ok(jsonb_build_object('recipe_id', v_id));
end;
$$;

-- Custo do drink: custo médio ÷ volume × ml usados (+ itens por unidade). Exige ver_lucro (D63).
create or replace function app.drink_costs(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (private.can_account(p_account_id, 'ferramentas') and private.can_account(p_account_id, 'ver_lucro'))
    then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object('recipe_id', r.id, 'name', r.name, 'sale_price', r.sale_price,
      'cost', c.cost, 'margin', r.sale_price - c.cost,
      'margin_pct', case when r.sale_price > 0 then round((r.sale_price - c.cost) * 100.0 / r.sale_price, 1) end,
      'incomplete', c.incomplete) order by r.name), '[]'::jsonb)) end
  from app.drink_recipes r
  cross join lateral (
    select round(sum(case when i.unit = 'ml' and p.volume_ml > 0 then p.avg_cost::numeric / p.volume_ml * i.amount
                          when i.unit = 'un' then p.avg_cost * i.amount else 0 end))::bigint cost,
           bool_or(i.unit = 'ml' and coalesce(p.volume_ml, 0) = 0) incomplete
    from app.drink_recipe_items i join app.products p on p.id = i.product_id where i.recipe_id = r.id
  ) c
  where r.account_id = p_account_id and r.active;
$$;

-- E31 · Ajustes, alertas e catálogo público -----------------------------------------------------------
create table app.alerts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  entity text,
  entity_id text,
  message text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  read_by uuid references auth.users (id),
  sent_at timestamptz
);
create unique index alerts_dedupe on app.alerts (store_id, dedupe_key);
create index alerts_store_idx on app.alerts (store_id, created_at desc);
create index alerts_unsent_idx on app.alerts (sent_at) where sent_at is null;
create index alerts_read_by_idx on app.alerts (read_by);

create table app.alert_settings (
  store_id uuid not null references app.stores (id),
  type text not null,
  enabled boolean not null default true,
  threshold int,
  quiet_start time,
  quiet_end time,
  primary key (store_id, type)
);

create table app.catalog_settings (
  store_id uuid primary key references app.stores (id),
  enabled boolean not null default false,
  show_price boolean not null default true,
  show_stock boolean not null default false,
  whatsapp_message text not null default 'Olá! Quero fazer um pedido:'
);

alter table app.alerts enable row level security;
alter table app.alert_settings enable row level security;
alter table app.catalog_settings enable row level security;
create policy alerts_read on app.alerts for select to authenticated using ((select private.is_store_member(store_id)));
create policy alert_settings_read on app.alert_settings for select to authenticated using ((select private.is_store_member(store_id)));
create policy catalog_settings_read on app.catalog_settings for select to authenticated using ((select private.is_store_member(store_id)));
grant select on app.alerts, app.alert_settings, app.catalog_settings to authenticated;
grant all on app.alerts, app.alert_settings, app.catalog_settings to service_role;

-- Tipos de alerta e padrão (E31; os três últimos vêm da landing).
create table private.alert_types (
  type text primary key,
  name text not null,
  default_threshold int,
  severity text not null
);
alter table private.alert_types enable row level security;
insert into private.alert_types values
  ('stock_low', 'Estoque baixo', null, 'warning'),
  ('expiry_soon', 'Validade chegando', 7, 'warning'),
  ('order_late', 'Pedido atrasado', 30, 'warning'),
  ('cash_closed', 'Resumo do fechamento', null, 'info'),
  ('bill_due', 'Conta vencendo', 2, 'warning'),
  ('cash_difference', 'Diferença no caixa', null, 'critical'),
  ('cancellations', 'Cancelamentos acima do normal', 3, 'warning'),
  ('product_stalled', 'Produto parado', 3, 'info'),
  ('cash_opened', 'Caixa aberto', null, 'info'),
  ('discount_out_of_rule', 'Desconto fora da regra', null, 'warning');

-- Gera alerta com deduplicação diária por tipo + entidade.
create or replace function private.raise_alert(p_store_id uuid, p_type text, p_entity text, p_entity_id text,
  p_message text, p_severity text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
begin
  if not exists (select 1 from app.stores where id = p_store_id) then
    return;
  end if;
  select coalesce(s.enabled, true) into v_enabled
  from private.alert_types t left join app.alert_settings s on s.store_id = p_store_id and s.type = t.type
  where t.type = p_type;
  if not coalesce(v_enabled, false) then
    return;
  end if;
  insert into app.alerts (store_id, type, severity, entity, entity_id, message, dedupe_key)
  values (p_store_id, p_type, coalesce(p_severity, (select severity from private.alert_types where type = p_type)),
    p_entity, p_entity_id, p_message,
    p_type || ':' || coalesce(p_entity_id, '-') || ':' || private.business_date(p_store_id))
  on conflict (store_id, dedupe_key) do nothing;
end;
$$;
revoke execute on function private.raise_alert(uuid, text, text, text, text, text) from public, anon, authenticated;

-- Estoque baixo: quando o saldo cruza o mínimo para baixo.
create or replace function private.alert_stock_low()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min numeric;
  v_name text;
begin
  select coalesce(sp.min_stock, p.min_stock), p.name into v_min, v_name
  from app.products p left join app.store_products sp on sp.product_id = p.id and sp.store_id = new.store_id
  where p.id = new.product_id;
  if v_min > 0 and new.quantity < v_min and (tg_op = 'INSERT' or old.quantity >= v_min) then
    perform private.raise_alert(new.store_id, 'stock_low', 'product', new.product_id::text,
      format('%s: restam %s. Mínimo configurado: %s.', v_name, trim(to_char(new.quantity, 'FM999999990.###')), trim(to_char(v_min, 'FM999999990.###'))));
  end if;
  return new;
end;
$$;
revoke execute on function private.alert_stock_low() from public, anon, authenticated;
create trigger product_stock_alert after insert or update of quantity on app.product_stock
  for each row execute function private.alert_stock_low();

-- Caixa aberto, fechamento e diferença.
create or replace function private.alert_cash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_limit bigint;
begin
  if tg_op = 'INSERT' then
    select display_name into v_name from app.store_members where id = new.opened_by;
    perform private.raise_alert(new.store_id, 'cash_opened', 'cash_session', new.id::text,
      format('Caixa aberto por %s. Troco inicial: R$ %s.', v_name, to_char(new.opening_float / 100.0, 'FM999G990D00')));
  elsif new.status = 'closed' and old.status = 'open' then
    perform private.raise_alert(new.store_id, 'cash_closed', 'cash_session', new.id::text,
      format('Caixa fechado. Vendas: R$ %s. Diferença: R$ %s.', to_char(coalesce((new.summary ->> 'sales_total')::bigint, 0) / 100.0, 'FM999G990D00'),
        to_char(new.difference / 100.0, 'FM999G990D00')));
    select cash_difference_alert into v_limit from app.store_settings where store_id = new.store_id;
    if abs(new.difference) > coalesce(v_limit, 0) then
      perform private.raise_alert(new.store_id, 'cash_difference', 'cash_session', new.id::text,
        format('Diferença de R$ %s no fechamento.', to_char(new.difference / 100.0, 'FM999G990D00')));
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.alert_cash() from public, anon, authenticated;
create trigger cash_sessions_alert after insert or update of status on app.cash_sessions
  for each row execute function private.alert_cash();

-- Desconto fora da regra: tentativa negada ou desconto autorizado por outra pessoa (landing).
create or replace function private.alert_from_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action = 'sale.discount' and new.store_id is not null
     and (new.outcome = 'denied' or new.after ->> 'authorized_by' is not null) then
    perform private.raise_alert(new.store_id, 'discount_out_of_rule', 'audit', new.id::text,
      case when new.outcome = 'denied' then format('Tentativa de %s%% de desconto acima do limite.', new.after ->> 'pct')
           else format('Desconto de %s%% liberado com autorização.', new.after ->> 'pct') end);
  end if;
  return new;
exception when others then
  -- Alerta nunca derruba o registro de auditoria.
  return new;
end;
$$;
revoke execute on function private.alert_from_audit() from public, anon, authenticated;
create trigger store_actions_alert after insert on audit.store_actions
  for each row execute function private.alert_from_audit();

-- Rotina horária (agendada na E46): validade, produto parado, contas vencendo.
create or replace function private.run_periodic_alerts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before int;
  v_after int;
begin
  select count(*) into v_before from app.alerts;
  perform private.raise_alert(l.store_id, 'expiry_soon', 'stock_lot', l.id::text,
    format('%s: %s unidade(s) vencem em %s dia(s) (lote %s).', p.name, trim(to_char(l.remaining_qty, 'FM999999990.###')),
      l.expires_on - current_date, coalesce(l.code, '-')))
  from app.stock_lots l join app.products p on p.id = l.product_id
  left join app.alert_settings s on s.store_id = l.store_id and s.type = 'expiry_soon'
  where l.remaining_qty > 0 and l.expires_on is not null
    and l.expires_on <= current_date + coalesce(s.threshold, 7);

  perform private.raise_alert(ps.store_id, 'product_stalled', 'product', ps.product_id::text,
    format('%s está há %s dias sem vender. %s na prateleira.', p.name, coalesce(s.threshold, 3), trim(to_char(ps.quantity, 'FM999999990.###'))))
  from app.product_stock ps join app.products p on p.id = ps.product_id and p.active
  left join app.alert_settings s on s.store_id = ps.store_id and s.type = 'product_stalled'
  where ps.quantity > 0
    and exists (select 1 from app.stock_movements m where m.store_id = ps.store_id and m.product_id = ps.product_id
                and m.created_at < now() - make_interval(days => coalesce(s.threshold, 3)))
    and not exists (select 1 from app.stock_movements m where m.store_id = ps.store_id and m.product_id = ps.product_id
                    and m.type in ('sale', 'tab', 'order') and m.created_at > now() - make_interval(days => coalesce(s.threshold, 3)));

  perform private.raise_alert(b.store_id, 'bill_due', 'bill', b.id::text,
    format('%s vence em %s (R$ %s).', b.description, to_char(b.due_on, 'DD/MM'), to_char(b.amount / 100.0, 'FM999G990D00')))
  from app.bills b left join app.alert_settings s on s.store_id = b.store_id and s.type = 'bill_due'
  where b.paid_at is null and b.due_on <= current_date + coalesce(s.threshold, 2);

  select count(*) into v_after from app.alerts;
  return v_after - v_before;
end;
$$;
revoke execute on function private.run_periodic_alerts() from public, anon, authenticated;
grant execute on function private.run_periodic_alerts() to service_role;

create or replace function app.mark_alerts_read(p_store_id uuid, p_alert_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_store_member(p_store_id) then
    return private.err('FORBIDDEN');
  end if;
  update app.alerts set read_at = now(), read_by = (select auth.uid())
  where store_id = p_store_id and read_at is null and (p_alert_ids is null or id = any (p_alert_ids));
  return private.ok();
end;
$$;

create or replace function app.save_alert_setting(p_store_id uuid, p_type text, p_enabled boolean, p_threshold int default null,
  p_quiet_start time default null, p_quiet_end time default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can(p_store_id, 'ajustes') then
    return private.err('FORBIDDEN');
  end if;
  if not exists (select 1 from private.alert_types where type = p_type) then
    return private.err('ALERT_TYPE_UNKNOWN');
  end if;
  insert into app.alert_settings (store_id, type, enabled, threshold, quiet_start, quiet_end)
  values (p_store_id, p_type, p_enabled, p_threshold, p_quiet_start, p_quiet_end)
  on conflict (store_id, type) do update set enabled = excluded.enabled, threshold = excluded.threshold,
    quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end;
  return private.ok();
end;
$$;

-- Chave Pix (D15): CPF/CNPJ (só dígitos), e-mail, telefone +55 ou chave aleatória (UUID).
create or replace function private.pix_key_valid(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_key ~ '^[0-9]{11}$' or p_key ~ '^[0-9]{14}$' or p_key ~ '^\+55[0-9]{10,11}$'
      or p_key ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
      or p_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;
revoke execute on function private.pix_key_valid(text) from public, anon, authenticated;

-- Ajustes da loja (dono, ou quem tiver 'ajustes').
create or replace function app.update_store_settings(p_store_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  if not private.can(p_store_id, 'ajustes') then
    perform private.audit_store('settings.update', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if nullif(p ->> 'pix_key', '') is not null and not private.pix_key_valid(p ->> 'pix_key') then
    return private.err('PIX_KEY_INVALID');
  end if;
  if length(coalesce(p ->> 'pix_receiver_name', '')) > 25 or length(coalesce(p ->> 'pix_city', '')) > 15 then
    return private.err('PIX_FIELDS_TOO_LONG');
  end if;
  select to_jsonb(s) into v_before from app.store_settings s where store_id = p_store_id;
  update app.store_settings set
    block_negative_stock = coalesce((p ->> 'block_negative_stock')::boolean, block_negative_stock),
    cash_difference_alert = coalesce((p ->> 'cash_difference_alert')::bigint, cash_difference_alert),
    blind_cash_count = coalesce((p ->> 'blind_cash_count')::boolean, blind_cash_count),
    delivery_fee_default = coalesce((p ->> 'delivery_fee_default')::bigint, delivery_fee_default),
    free_delivery_above = case when p ? 'free_delivery_above' then nullif(p ->> 'free_delivery_above', '')::bigint else free_delivery_above end,
    pix_key = case when p ? 'pix_key' then nullif(p ->> 'pix_key', '') else pix_key end,
    pix_receiver_name = case when p ? 'pix_receiver_name' then upper(nullif(p ->> 'pix_receiver_name', '')) else pix_receiver_name end,
    pix_city = case when p ? 'pix_city' then upper(nullif(p ->> 'pix_city', '')) else pix_city end
  where store_id = p_store_id;
  perform private.audit_store('settings.update', p_store_id, null, 'store_settings', p_store_id::text, v_before,
    (select to_jsonb(s) from app.store_settings s where store_id = p_store_id));
  return private.ok();
end;
$$;

create or replace function app.update_catalog_settings(p_store_id uuid, p_enabled boolean, p_show_price boolean default true,
  p_show_stock boolean default false, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can(p_store_id, 'ajustes') then
    return private.err('FORBIDDEN');
  end if;
  insert into app.catalog_settings (store_id, enabled, show_price, show_stock, whatsapp_message)
  values (p_store_id, p_enabled, p_show_price, p_show_stock, coalesce(p_message, 'Olá! Quero fazer um pedido:'))
  on conflict (store_id) do update set enabled = excluded.enabled, show_price = excluded.show_price,
    show_stock = excluded.show_stock, whatsapp_message = excluded.whatsapp_message;
  return private.ok();
end;
$$;

-- Vitrine pública (D38): única função do app aberta a anon. Sem custo, sem saldo exato.
create or replace function app.public_catalog(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.ok(jsonb_build_object(
      'store', jsonb_build_object('name', s.name, 'neighborhood', s.neighborhood, 'city', s.city, 'whatsapp', s.whatsapp),
      'message', c.whatsapp_message,
      'products', (select coalesce(jsonb_agg(jsonb_build_object('name', p.name,
          'price', case when c.show_price then coalesce(sp.price, p.price) end, 'image_path', p.image_path,
          'category', cat.name, 'available', case when c.show_stock then coalesce(ps.quantity, 0) > 0 end)
          order by cat.sort, p.name), '[]'::jsonb)
        from app.products p
        left join app.categories cat on cat.id = p.category_id
        left join app.store_products sp on sp.product_id = p.id and sp.store_id = s.id
        left join app.product_stock ps on ps.product_id = p.id and ps.store_id = s.id
        where p.account_id = s.account_id and p.active and coalesce(sp.active, true)),
      'offers', (select coalesce(jsonb_agg(jsonb_build_object('name', b.name,
          'price', case when c.show_price then private.bundle_price(s.id, b.id) end, 'image_path', b.image_path)), '[]'::jsonb)
        from app.bundles b where b.account_id = s.account_id and b.show_in_catalog and private.bundle_is_live(b.id, s.id))
    ))
    from app.stores s join app.catalog_settings c on c.store_id = s.id and c.enabled
    where s.slug = p_slug and s.archived_at is null
  ), private.err('CATALOG_NOT_FOUND'));
$$;

-- Ao criar loja: configurações de impressão e catálogo (desligado).
create or replace function private.on_store_created_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into app.printer_settings (store_id) values (new.id);
  insert into app.catalog_settings (store_id) values (new.id);
  return new;
end;
$$;
revoke execute on function private.on_store_created_defaults() from public, anon, authenticated;
create trigger stores_defaults after insert on app.stores for each row execute function private.on_store_created_defaults();

-- E25 · números do Início (depois de app.alerts existir)
create or replace function app.dashboard_today(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select private.business_date(p_store_id) as dia),
  v as (select s.* from app.sales s, d where s.store_id = p_store_id and s.business_date = d.dia and s.status = 'paid')
  select case when not private.can(p_store_id, 'relatorios') then private.err('FORBIDDEN') else private.ok(jsonb_build_object(
    'business_date', (select dia from d),
    'sales_total', (select coalesce(sum(total), 0) from v),
    'sales_count', (select count(*) from v),
    'avg_ticket', (select coalesce(round(avg(total)), 0) from v),
    'by_method', (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) from (
      select sp.method, sum(sp.amount - sp.change_given) total from app.sale_payments sp join v on v.id = sp.sale_id group by sp.method) x),
    'by_hour', (select coalesce(jsonb_object_agg(h, total), '{}'::jsonb) from (
      select extract(hour from v.created_at at time zone a.timezone)::int h, sum(v.total) total
      from v join app.stores st on st.id = v.store_id join app.accounts a on a.id = st.account_id group by 1) x),
    'open_cash_sessions', (select count(*) from app.cash_sessions where store_id = p_store_id and status = 'open'),
    'open_tabs', (select count(*) from app.tabs where store_id = p_store_id and status = 'open'),
    'below_min_stock', (select count(*) from app.products p join app.stores st on st.account_id = p.account_id and st.id = p_store_id
      left join app.store_products sp on sp.product_id = p.id and sp.store_id = st.id
      left join app.product_stock ps on ps.product_id = p.id and ps.store_id = st.id
      where p.active and coalesce(ps.quantity, 0) < coalesce(sp.min_stock, p.min_stock) and coalesce(sp.min_stock, p.min_stock) > 0),
    'unread_alerts', (select count(*) from app.alerts al where al.store_id = p_store_id and al.read_at is null)
  )) end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'app.sale_receipt(uuid)', 'app.dashboard_today(uuid)', 'app.report_sales(uuid, date, date)',
    'app.save_supplier(uuid, jsonb)', 'app.save_purchase_order(uuid, uuid, jsonb, text, date, text)',
    'app.receive_purchase_order(uuid, jsonb)', 'app.purchase_suggestion(uuid, int, int)',
    'app.save_bill(uuid, jsonb)', 'app.pay_bill(uuid, text, date)', 'app.bills_list(uuid, boolean)',
    'app.save_drink_recipe(uuid, jsonb)', 'app.drink_costs(uuid)', 'app.mark_alerts_read(uuid, uuid[])',
    'app.save_alert_setting(uuid, text, boolean, int, time, time)', 'app.update_store_settings(uuid, jsonb)',
    'app.update_catalog_settings(uuid, boolean, boolean, boolean, text)', 'app.public_catalog(text)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function app.public_catalog(text) to anon;
