-- E19 (caixa), E20 (venda atômica), E21 (cancelamento), E22 (mesas e comandas), E23 (fiado com nome e telefone).
-- Tudo que mexe em dinheiro passa por RPC chamada pelo TERMINAL com sessão de operador (E10).

-- Dia comercial (D12) ------------------------------------------------------------------------
create or replace function private.business_date(p_store_id uuid, p_at timestamptz default now())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select ((p_at at time zone a.timezone) - a.business_day_cutoff::interval)::date
  from app.stores s join app.accounts a on a.id = s.account_id
  where s.id = p_store_id;
$$;
revoke execute on function private.business_date(uuid, timestamptz) from public, anon;
grant execute on function private.business_date(uuid, timestamptz) to authenticated, service_role;

create type app.pay_method as enum ('pix', 'credit', 'debit', 'cash', 'fiado');
create type app.cash_movement_type as enum (
  'opening', 'sale_cash_in', 'change_out', 'withdrawal', 'reinforcement', 'courier_payment',
  'sale_cancel_refund', 'fiado_payment_in', 'adjustment'
);

-- Caixa (E19) -------------------------------------------------------------------------------------
create table app.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  terminal_id uuid not null,
  opened_by uuid not null,
  opened_at timestamptz not null default now(),
  opening_float app.cents not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by uuid,
  closed_at timestamptz,
  expected_cash app.signed_cents,
  counted_cash app.cents,
  difference app.signed_cents,
  note text,
  summary jsonb,
  business_date date not null,
  unique (id, store_id),
  foreign key (terminal_id, store_id) references app.terminals (id, store_id),
  foreign key (opened_by, store_id) references app.store_members (id, store_id),
  foreign key (closed_by, store_id) references app.store_members (id, store_id)
);
create unique index cash_sessions_one_open on app.cash_sessions (terminal_id) where status = 'open'; -- D11
create index cash_sessions_store_idx on app.cash_sessions (store_id, business_date desc);
create index cash_sessions_terminal_idx on app.cash_sessions (terminal_id, store_id);
create index cash_sessions_opened_by_idx on app.cash_sessions (opened_by, store_id);
create index cash_sessions_closed_by_idx on app.cash_sessions (closed_by, store_id);

create table app.cash_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  cash_session_id uuid not null,
  type app.cash_movement_type not null,
  amount app.signed_cents not null, -- positivo entra na gaveta, negativo sai
  member_id uuid,
  reason text,
  ref_id uuid,
  business_date date not null,
  created_at timestamptz not null default now(),
  foreign key (cash_session_id, store_id) references app.cash_sessions (id, store_id),
  foreign key (member_id, store_id) references app.store_members (id, store_id)
);
create index cash_movements_session_idx on app.cash_movements (cash_session_id, store_id);
create index cash_movements_member_idx on app.cash_movements (member_id, store_id);
create index cash_movements_store_idx on app.cash_movements (store_id, business_date desc);
create trigger cash_movements_immutable before update or delete on app.cash_movements
  for each row execute function private.ledger_immutable();

-- Fiado (E23, D55) ------------------------------------------------------------------------------
create table app.fiado_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  name text not null check (length(trim(name)) between 1 and 80),
  name_norm text not null,
  phone text not null check (phone ~ '^[0-9]{10,11}$'),
  promised_date date,
  note text,
  credit_limit app.cents, -- D55b: opcional, desligado por padrão
  balance app.signed_cents not null default 0, -- mantido pelo trigger do ledger
  phone_anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, phone),
  unique (id, store_id)
);
create index fiado_accounts_name_trgm on app.fiado_accounts using gin (name_norm extensions.gin_trgm_ops);
create trigger fiado_accounts_touch before update on app.fiado_accounts for each row execute function private.touch_updated_at();

create table app.fiado_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  fiado_account_id uuid not null,
  type text not null check (type in ('fiado_sale', 'payment', 'adjustment', 'sale_cancel', 'merge_in', 'merge_out')),
  amount app.signed_cents not null check (amount <> 0), -- + deve mais, − deve menos
  sale_id uuid,
  method app.pay_method,
  member_id uuid,
  note text,
  created_at timestamptz not null default now(),
  foreign key (fiado_account_id, store_id) references app.fiado_accounts (id, store_id)
);
create index fiado_ledger_account_idx on app.fiado_ledger (fiado_account_id, store_id, created_at desc);
create index fiado_ledger_sale_idx on app.fiado_ledger (sale_id);
create trigger fiado_ledger_immutable before update or delete on app.fiado_ledger
  for each row execute function private.ledger_immutable();

create or replace function private.apply_fiado_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app.fiado_accounts set balance = balance + new.amount where id = new.fiado_account_id;
  return new;
end;
$$;
revoke execute on function private.apply_fiado_ledger() from public, anon, authenticated;
create trigger fiado_ledger_apply after insert on app.fiado_ledger for each row execute function private.apply_fiado_ledger();

create or replace function private.normalize_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(trim(regexp_replace(translate(coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'), '\s+', ' ', 'g')));
$$;
revoke execute on function private.normalize_name(text) from public, anon, authenticated;

-- Mesas e comandas (E22) --------------------------------------------------------------------------
create table app.tabs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  kind text not null check (kind in ('table', 'tab')),
  label text not null check (length(trim(label)) between 1 and 30),
  nickname text,
  status text not null default 'open' check (status in ('open', 'closed', 'canceled')),
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  sale_id uuid,
  unique (id, store_id),
  foreign key (opened_by, store_id) references app.store_members (id, store_id)
);
create unique index tabs_one_open_label on app.tabs (store_id, kind, lower(label)) where status = 'open';
create index tabs_opened_by_idx on app.tabs (opened_by, store_id);
create index tabs_sale_idx on app.tabs (sale_id);

create table app.tab_items (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid not null,
  store_id uuid not null,
  product_id uuid references app.products (id),
  bundle_id uuid references app.bundles (id),
  name text not null,
  quantity app.qty not null check (quantity > 0),
  unit_price app.cents not null,
  added_by uuid,
  added_at timestamptz not null default now(),
  removed_by uuid,
  removed_at timestamptz,
  remove_reason text,
  check ((product_id is null) <> (bundle_id is null)),
  foreign key (tab_id, store_id) references app.tabs (id, store_id),
  foreign key (added_by, store_id) references app.store_members (id, store_id),
  foreign key (removed_by, store_id) references app.store_members (id, store_id)
);
create index tab_items_tab_idx on app.tab_items (tab_id, store_id);
create index tab_items_product_idx on app.tab_items (product_id);
create index tab_items_bundle_idx on app.tab_items (bundle_id);
create index tab_items_added_by_idx on app.tab_items (added_by, store_id);
create index tab_items_removed_by_idx on app.tab_items (removed_by, store_id);

-- Vendas (E20) ---------------------------------------------------------------------------------
create table app.store_counters (
  store_id uuid not null references app.stores (id),
  name text not null,
  value bigint not null default 0,
  primary key (store_id, name)
);

create table app.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  account_id uuid not null,
  number bigint not null,
  cash_session_id uuid,
  terminal_id uuid,
  operator_member_id uuid,
  tab_id uuid,
  fiado_account_id uuid,
  order_id uuid,
  channel text not null default 'counter',
  subtotal app.cents not null,
  discount app.cents not null default 0,
  delivery_fee app.cents not null default 0,
  total app.cents not null,
  status text not null default 'paid' check (status in ('paid', 'canceled')),
  origin text not null default 'normal' check (origin in ('normal', 'contingency')),
  client_request_id uuid not null,
  discount_authorized_by uuid,
  business_date date not null,
  created_at timestamptz not null default now(),
  canceled_at timestamptz,
  canceled_by uuid,
  cancel_reason text,
  unique (store_id, number),
  unique (store_id, client_request_id),
  unique (id, store_id),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (cash_session_id, store_id) references app.cash_sessions (id, store_id),
  foreign key (terminal_id, store_id) references app.terminals (id, store_id),
  foreign key (operator_member_id, store_id) references app.store_members (id, store_id),
  foreign key (tab_id, store_id) references app.tabs (id, store_id),
  foreign key (fiado_account_id, store_id) references app.fiado_accounts (id, store_id),
  foreign key (discount_authorized_by, store_id) references app.store_members (id, store_id),
  foreign key (canceled_by, store_id) references app.store_members (id, store_id)
);
create index sales_store_date_idx on app.sales (store_id, business_date desc);
create index sales_store_created_idx on app.sales (store_id, created_at desc);
create index sales_account_idx on app.sales (store_id, account_id);
create index sales_cash_idx on app.sales (cash_session_id, store_id);
create index sales_terminal_idx on app.sales (terminal_id, store_id);
create index sales_operator_idx on app.sales (operator_member_id, store_id);
create index sales_tab_idx on app.sales (tab_id, store_id);
create index sales_fiado_idx on app.sales (fiado_account_id, store_id);
create index sales_authorized_idx on app.sales (discount_authorized_by, store_id);
create index sales_canceled_by_idx on app.sales (canceled_by, store_id);
create index sales_order_idx on app.sales (order_id);

create table app.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  store_id uuid not null,
  product_id uuid references app.products (id),
  bundle_id uuid references app.bundles (id),
  name text not null,
  quantity app.qty not null check (quantity > 0),
  unit_price app.cents not null,
  unit_cost app.cents not null default 0, -- congelado na venda (margem histórica)
  total app.cents not null,
  sold_without_stock boolean not null default false,
  stock_from_tab boolean not null default false,
  check ((product_id is null) <> (bundle_id is null)),
  foreign key (sale_id, store_id) references app.sales (id, store_id)
);
create index sale_items_sale_idx on app.sale_items (sale_id, store_id);
create index sale_items_product_idx on app.sale_items (product_id);
create index sale_items_bundle_idx on app.sale_items (bundle_id);

create table app.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  store_id uuid not null,
  method app.pay_method not null,
  amount app.cents not null check (amount > 0),
  change_given app.cents not null default 0,
  foreign key (sale_id, store_id) references app.sales (id, store_id)
);
create index sale_payments_sale_idx on app.sale_payments (sale_id, store_id);

alter table app.tabs add constraint tabs_sale_fk foreign key (sale_id, store_id) references app.sales (id, store_id);
create index tabs_sale_store_idx on app.tabs (sale_id, store_id);

-- RLS -------------------------------------------------------------------------------------------
alter table app.cash_sessions enable row level security;
alter table app.cash_movements enable row level security;
alter table app.fiado_accounts enable row level security;
alter table app.fiado_ledger enable row level security;
alter table app.tabs enable row level security;
alter table app.tab_items enable row level security;
alter table app.store_counters enable row level security;
alter table app.sales enable row level security;
alter table app.sale_items enable row level security;
alter table app.sale_payments enable row level security;

create or replace function private.reads_cash(p_store_id uuid, p_terminal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can(p_store_id, 'caixa') or private.can(p_store_id, 'relatorios')
    or (private.current_terminal()).id = p_terminal_id;
$$;
revoke execute on function private.reads_cash(uuid, uuid) from public, anon;
grant execute on function private.reads_cash(uuid, uuid) to authenticated, service_role;

create policy cash_sessions_read on app.cash_sessions for select to authenticated
  using ((select private.reads_cash(store_id, terminal_id)));
create policy cash_movements_read on app.cash_movements for select to authenticated
  using (exists (select 1 from app.cash_sessions cs where cs.id = cash_session_id));
create policy fiado_accounts_read on app.fiado_accounts for select to authenticated
  using ((select private.can(store_id, 'fiado')) or (select private.can(store_id, 'fiado_receber'))
         or store_id = (select private.terminal_store()));
create policy fiado_ledger_read on app.fiado_ledger for select to authenticated
  using ((select private.can(store_id, 'fiado_receber')) or (select private.can(store_id, 'fiado_ajustar')));
create policy tabs_read on app.tabs for select to authenticated using ((select private.reads_store(store_id)));
create policy tab_items_read on app.tab_items for select to authenticated using ((select private.reads_store(store_id)));
create policy sales_read on app.sales for select to authenticated
  using ((select private.can(store_id, 'relatorios')) or terminal_id = (select (private.current_terminal()).id));
create policy sale_items_read on app.sale_items for select to authenticated
  using (exists (select 1 from app.sales s where s.id = sale_id));
create policy sale_payments_read on app.sale_payments for select to authenticated
  using (exists (select 1 from app.sales s where s.id = sale_id));

grant select on app.cash_sessions, app.cash_movements, app.tabs, app.tab_items, app.sales, app.sale_payments to authenticated;
-- Custo congelado só por RPC com ver_lucro (D63); telefone do fiado só por RPC (mascarado no terminal).
grant select (id, sale_id, store_id, product_id, bundle_id, name, quantity, unit_price, total, sold_without_stock,
  stock_from_tab) on app.sale_items to authenticated;
grant select (id, store_id, name, promised_date, credit_limit, balance, created_at) on app.fiado_accounts to authenticated;
grant select on app.fiado_ledger to authenticated;
grant all on app.cash_sessions, app.cash_movements, app.fiado_accounts, app.fiado_ledger, app.tabs, app.tab_items,
  app.store_counters, app.sales, app.sale_items, app.sale_payments to service_role;
revoke update, delete, truncate on app.cash_movements, app.fiado_ledger from authenticated, service_role;

-- Helpers de operação --------------------------------------------------------------------------
create or replace function private.open_cash_of_terminal(p_terminal_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from app.cash_sessions where terminal_id = p_terminal_id and status = 'open';
$$;
revoke execute on function private.open_cash_of_terminal(uuid) from public, anon, authenticated;

create or replace function private.cash_in(p_store uuid, p_session uuid, p_type app.cash_movement_type,
  p_amount bigint, p_member uuid, p_reason text default null, p_ref uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into app.cash_movements (store_id, cash_session_id, type, amount, member_id, reason, ref_id, business_date)
  select p_store, p_session, p_type, p_amount, p_member, p_reason, p_ref, private.business_date(p_store)
  where p_amount <> 0;
$$;
revoke execute on function private.cash_in(uuid, uuid, app.cash_movement_type, bigint, uuid, text, uuid) from public, anon, authenticated;

-- RPCs: caixa (E19) ------------------------------------------------------------------------------
create or replace function app.open_cash(p_operator_session_id uuid, p_opening_float bigint default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_t app.terminals := private.current_terminal();
  v_cash uuid;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'caixa') then
    perform private.audit_store('cash.open', v_op.store_id, p_outcome => 'denied', p_operator_member_id => v_op.id);
    return private.err('FORBIDDEN');
  end if;
  if private.open_cash_of_terminal(v_t.id) is not null then
    return private.err('CASH_ALREADY_OPEN');
  end if;
  if coalesce(p_opening_float, -1) < 0 then
    return private.err('CASH_AMOUNT_INVALID');
  end if;

  insert into app.cash_sessions (store_id, terminal_id, opened_by, opening_float, business_date)
  values (v_op.store_id, v_t.id, v_op.id, p_opening_float, private.business_date(v_op.store_id))
  returning id into v_cash;
  perform private.cash_in(v_op.store_id, v_cash, 'opening', p_opening_float, v_op.id, 'Fundo de troco');
  perform private.audit_store('cash.open', v_op.store_id, null, 'cash_session', v_cash::text, null,
    jsonb_build_object('opening_float', p_opening_float), p_operator_member_id => v_op.id);
  return private.ok(jsonb_build_object('cash_session_id', v_cash));
end;
$$;

-- Sangria, reforço e pagar entregador (D60).
create or replace function app.cash_movement(p_operator_session_id uuid, p_type text, p_amount bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_cash uuid := private.open_cash_of_terminal((private.current_terminal()).id);
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'sangria') then
    perform private.audit_store('cash.' || coalesce(p_type, '?'), v_op.store_id, p_outcome => 'denied', p_operator_member_id => v_op.id);
    return private.err('FORBIDDEN');
  end if;
  if v_cash is null then
    return private.err('SALE_CASH_CLOSED');
  end if;
  if p_type not in ('withdrawal', 'reinforcement', 'courier_payment') then
    return private.err('CASH_MOVEMENT_TYPE');
  end if;
  if coalesce(p_amount, 0) <= 0 then
    return private.err('CASH_AMOUNT_INVALID');
  end if;
  if p_type <> 'reinforcement' and length(trim(coalesce(p_reason, ''))) < 3 then
    return private.err('CASH_REASON_REQUIRED');
  end if;

  perform private.cash_in(v_op.store_id, v_cash, p_type::app.cash_movement_type,
    case when p_type = 'reinforcement' then p_amount else -p_amount end, v_op.id, p_reason);
  perform private.audit_store('cash.' || p_type, v_op.store_id, null, 'cash_session', v_cash::text, null,
    jsonb_build_object('amount', p_amount, 'reason', p_reason), p_operator_member_id => v_op.id);
  return private.ok();
end;
$$;

-- Fechamento: esperado em dinheiro x contado; comanda aberta bloqueia o último caixa da loja (D11).
create or replace function app.close_cash(p_operator_session_id uuid, p_counted_cash bigint, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_t app.terminals := private.current_terminal();
  v_cash app.cash_sessions;
  v_expected bigint;
  v_summary jsonb;
  v_open_tabs jsonb;
  v_alert bigint;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'caixa') then
    perform private.audit_store('cash.close', v_op.store_id, p_outcome => 'denied', p_operator_member_id => v_op.id);
    return private.err('FORBIDDEN');
  end if;
  select * into v_cash from app.cash_sessions where terminal_id = v_t.id and status = 'open' for update;
  if not found then
    return private.err('SALE_CASH_CLOSED');
  end if;
  if coalesce(p_counted_cash, -1) < 0 then
    return private.err('CASH_AMOUNT_INVALID');
  end if;

  if not exists (select 1 from app.cash_sessions where store_id = v_op.store_id and status = 'open' and id <> v_cash.id) then
    select jsonb_agg(jsonb_build_object('tab_id', id, 'label', label)) into v_open_tabs
    from app.tabs where store_id = v_op.store_id and status = 'open';
    if v_open_tabs is not null then
      return private.err('CASH_OPEN_TABS', v_open_tabs::text);
    end if;
  end if;

  select coalesce(sum(amount), 0) into v_expected from app.cash_movements where cash_session_id = v_cash.id;
  select jsonb_build_object(
    'sales_count', (select count(*) from app.sales s where s.cash_session_id = v_cash.id and s.status = 'paid'),
    'sales_total', (select coalesce(sum(total), 0) from app.sales s where s.cash_session_id = v_cash.id and s.status = 'paid'),
    'canceled_count', (select count(*) from app.sales s where s.cash_session_id = v_cash.id and s.status = 'canceled'),
    'by_method', (select coalesce(jsonb_object_agg(method, total), '{}'::jsonb) from (
        select sp.method, sum(sp.amount - sp.change_given) total
        from app.sale_payments sp join app.sales s on s.id = sp.sale_id
        where s.cash_session_id = v_cash.id and s.status = 'paid' group by sp.method) m),
    'by_operator', (select coalesce(jsonb_object_agg(name, total), '{}'::jsonb) from (
        select m.display_name name, sum(s.total) total from app.sales s
        join app.store_members m on m.id = s.operator_member_id
        where s.cash_session_id = v_cash.id and s.status = 'paid' group by m.display_name) o),
    'movements', (select coalesce(jsonb_object_agg(type, total), '{}'::jsonb) from (
        select type, sum(amount) total from app.cash_movements where cash_session_id = v_cash.id group by type) mv)
  ) into v_summary;

  update app.cash_sessions set status = 'closed', closed_by = v_op.id, closed_at = now(), expected_cash = v_expected,
    counted_cash = p_counted_cash, difference = p_counted_cash - v_expected, note = p_note, summary = v_summary
  where id = v_cash.id;

  select cash_difference_alert into v_alert from app.store_settings where store_id = v_op.store_id;
  perform private.audit_store('cash.close', v_op.store_id, null, 'cash_session', v_cash.id::text, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted_cash, 'difference', p_counted_cash - v_expected,
      'alert', abs(p_counted_cash - v_expected) > coalesce(v_alert, 0)), p_operator_member_id => v_op.id);
  update app.operator_sessions set ended_at = now(), end_reason = 'cash_closed'
  where terminal_id = v_t.id and ended_at is null;

  return private.ok(jsonb_build_object('cash_session_id', v_cash.id, 'expected_cash', v_expected,
    'counted_cash', p_counted_cash, 'difference', p_counted_cash - v_expected, 'summary', v_summary));
end;
$$;

-- RPC: venda atômica (E20) ---------------------------------------------------------------------
-- p: {operator_session_id, client_request_id, items:[{product_id|bundle_id, quantity}], discount (centavos),
--     override_token?, payments:[{method, amount}], fiado:{fiado_account_id | name, phone},
--     delivery_fee?, channel?, order_id?, origin?}
-- p_tab_id: fechamento de comanda (itens vêm da comanda, estoque já baixado no lançamento, D41).
create or replace function private.finalize_sale(p jsonb, p_tab_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid := nullif(p ->> 'operator_session_id', '')::uuid;
  v_req uuid := nullif(p ->> 'client_request_id', '')::uuid;
  v_op app.store_members := private.operator(v_session);
  v_t app.terminals := private.current_terminal();
  v_store uuid;
  v_account uuid;
  v_existing app.sales;
  v_cash uuid;
  v_items jsonb := '[]'::jsonb;
  v_it record;
  v_subtotal bigint := 0;
  v_discount bigint := greatest(coalesce((p ->> 'discount')::bigint, 0), 0);
  v_fee bigint := greatest(coalesce((p ->> 'delivery_fee')::bigint, 0), 0);
  v_total bigint;
  v_pct numeric;
  v_limit numeric;
  v_authorized uuid;
  v_paid bigint;
  v_cash_paid bigint;
  v_fiado_amt bigint;
  v_change bigint;
  v_fiado_id uuid;
  v_fiado app.fiado_accounts;
  v_phone text;
  v_block_negative boolean;
  v_needs jsonb;
  v_short jsonb;
  v_number bigint;
  v_sale uuid;
  v_price bigint;
  v_cost bigint;
  v_name text;
  v_no_stock boolean;
  v_bdate date;
begin
  -- 1. Idempotência (TK-2051): mesma requisição devolve a mesma venda, sem gravar nada.
  if v_req is null then
    return private.err('SALE_REQUEST_ID_REQUIRED');
  end if;
  if v_t.id is not null then
    select * into v_existing from app.sales where store_id = v_t.store_id and client_request_id = v_req;
    if found then
      return private.ok(jsonb_build_object('sale_id', v_existing.id, 'number', v_existing.number,
        'total', v_existing.total, 'change', (select coalesce(sum(change_given), 0) from app.sale_payments where sale_id = v_existing.id),
        'replayed', true));
    end if;
  end if;

  -- 2. Operador, permissão e caixa aberto
  if v_t.id is null or v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  v_store := v_op.store_id;
  select account_id into v_account from app.stores where id = v_store;
  if not private.operator_can(v_session, 'vender') then
    perform private.audit_store('sale.create', v_store, v_account, p_outcome => 'denied', p_operator_member_id => v_op.id);
    return private.err('FORBIDDEN');
  end if;
  v_cash := private.open_cash_of_terminal(v_t.id);
  if v_cash is null then
    return private.err('SALE_CASH_CLOSED');
  end if;

  -- 3. Itens com preço do servidor
  if p_tab_id is not null then
    for v_it in
      select ti.product_id, ti.bundle_id, ti.name, sum(ti.quantity) qty, ti.unit_price
      from app.tab_items ti where ti.tab_id = p_tab_id and ti.removed_at is null
      group by ti.product_id, ti.bundle_id, ti.name, ti.unit_price
    loop
      v_items := v_items || jsonb_build_object('product_id', v_it.product_id, 'bundle_id', v_it.bundle_id,
        'name', v_it.name, 'quantity', v_it.qty, 'unit_price', v_it.unit_price, 'from_tab', true);
    end loop;
  else
    if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
      return private.err('SALE_ITEMS_EMPTY');
    end if;
    for v_it in select * from jsonb_to_recordset(p -> 'items') as x(product_id uuid, bundle_id uuid, quantity numeric) loop
      if coalesce(v_it.quantity, 0) <= 0 or ((v_it.product_id is null) = (v_it.bundle_id is null)) then
        return private.err('SALE_ITEM_INVALID');
      end if;
      if v_it.product_id is not null then
        select p2.name, private.effective_price(v_store, p2.id) into v_name, v_price
        from app.products p2
        left join app.store_products sp on sp.product_id = p2.id and sp.store_id = v_store
        where p2.id = v_it.product_id and p2.account_id = v_account and p2.active and coalesce(sp.active, true);
        if v_name is null then
          return private.err('SALE_PRODUCT_UNAVAILABLE', v_it.product_id::text);
        end if;
      else
        select b.name, private.bundle_price(v_store, b.id) into v_name, v_price
        from app.bundles b where b.id = v_it.bundle_id and b.account_id = v_account;
        if v_name is null or not private.bundle_is_live(v_it.bundle_id, v_store) then
          return private.err('PROMO_EXPIRED', v_it.bundle_id::text);
        end if;
      end if;
      v_items := v_items || jsonb_build_object('product_id', v_it.product_id, 'bundle_id', v_it.bundle_id,
        'name', v_name, 'quantity', v_it.quantity, 'unit_price', v_price, 'from_tab', false);
      v_name := null;
    end loop;
  end if;
  if jsonb_array_length(v_items) = 0 then
    return private.err('SALE_ITEMS_EMPTY');
  end if;

  select coalesce(sum(round((i ->> 'quantity')::numeric * (i ->> 'unit_price')::bigint)), 0) into v_subtotal
  from jsonb_array_elements(v_items) i;

  -- 4. Desconto: dentro do limite do papel ou com autorização (D05, D63)
  if v_discount > v_subtotal then
    return private.err('SALE_DISCOUNT_INVALID');
  end if;
  if v_discount > 0 then
    v_pct := round(v_discount * 100.0 / nullif(v_subtotal, 0), 2);
    select max_discount_pct into v_limit from app.role_settings where store_id = v_store and role = v_op.role;
    if not (private.operator_can(v_session, 'desconto') and (v_op.role = 'owner' or (v_limit is not null and v_pct <= v_limit))) then
      if nullif(p ->> 'override_token', '') is null then
        perform private.audit_store('sale.discount', v_store, v_account, p_outcome => 'denied',
          p_after => jsonb_build_object('pct', v_pct), p_operator_member_id => v_op.id);
        return private.err('SALE_DISCOUNT_FORBIDDEN', format('%s%% acima do limite', v_pct));
      end if;
      if not exists (select 1 from private.override_tokens where id = (p ->> 'override_token')::uuid and store_id = v_store
                     and terminal_id = v_t.id and used_at is null and expires_at > now() and max_value >= v_pct) then
        return private.err('SALE_OVERRIDE_INVALID');
      end if;
    end if;
  end if;
  v_total := v_subtotal - v_discount + v_fee;

  -- 5. Pagamentos
  if jsonb_typeof(p -> 'payments') <> 'array' or jsonb_array_length(p -> 'payments') = 0 then
    return private.err('SALE_PAYMENT_MISMATCH');
  end if;
  if exists (select 1 from jsonb_to_recordset(p -> 'payments') as x(method text, amount bigint)
             where coalesce(amount, 0) <= 0 or method not in ('pix', 'credit', 'debit', 'cash', 'fiado')) then
    return private.err('SALE_PAYMENT_MISMATCH');
  end if;
  select coalesce(sum(amount), 0), coalesce(sum(amount) filter (where method = 'cash'), 0),
         coalesce(sum(amount) filter (where method = 'fiado'), 0)
  into v_paid, v_cash_paid, v_fiado_amt
  from jsonb_to_recordset(p -> 'payments') as x(method text, amount bigint);
  v_change := v_paid - v_total;
  if v_change < 0 or v_change > v_cash_paid then
    return private.err('SALE_PAYMENT_MISMATCH', format('total %s, pago %s', v_total, v_paid));
  end if;

  -- 6. Fiado (D55): nome e telefone; limite opcional (D55b)
  if v_fiado_amt > 0 then
    if not private.operator_can(v_session, 'fiado') then
      perform private.audit_store('sale.fiado', v_store, v_account, p_outcome => 'denied', p_operator_member_id => v_op.id);
      return private.err('FORBIDDEN');
    end if;
    v_fiado_id := nullif(p -> 'fiado' ->> 'fiado_account_id', '')::uuid;
    if v_fiado_id is null then
      v_phone := regexp_replace(coalesce(p -> 'fiado' ->> 'phone', ''), '\D', '', 'g');
      if length(trim(coalesce(p -> 'fiado' ->> 'name', ''))) < 1 or v_phone !~ '^[0-9]{10,11}$' then
        return private.err('FIADO_NAME_PHONE_REQUIRED');
      end if;
      select id into v_fiado_id from app.fiado_accounts where store_id = v_store and phone = v_phone;
    end if;
    if v_fiado_id is not null then
      select * into v_fiado from app.fiado_accounts where id = v_fiado_id and store_id = v_store;
      if not found then
        return private.err('FIADO_NOT_FOUND');
      end if;
      if v_fiado.credit_limit is not null and v_fiado.balance + v_fiado_amt > v_fiado.credit_limit then
        return private.err('SALE_FIADO_LIMIT', format('saldo %s, limite %s', v_fiado.balance, v_fiado.credit_limit));
      end if;
    end if;
  end if;

  -- 7. Estoque: trava em ordem de produto (evita deadlock entre caixas, §9) e confere se a loja bloqueia negativo
  with needs as (
    select coalesce(i.product_id, bi.product_id) product_id,
           sum((i.quantity) * coalesce(bi.quantity, 1)) qty
    from jsonb_to_recordset(v_items) as i(product_id uuid, bundle_id uuid, quantity numeric, from_tab boolean)
    left join app.bundle_items bi on bi.bundle_id = i.bundle_id
    where not coalesce(i.from_tab, false)
    group by 1
  )
  select jsonb_object_agg(product_id, qty) into v_needs from needs;

  perform 1 from app.product_stock ps
  where ps.store_id = v_store and v_needs ? ps.product_id::text
  order by ps.product_id for update;

  select block_negative_stock into v_block_negative from app.store_settings where store_id = v_store;
  select jsonb_agg(n.key) into v_short
  from jsonb_each_text(coalesce(v_needs, '{}'::jsonb)) n
  left join app.product_stock ps on ps.store_id = v_store and ps.product_id = n.key::uuid
  where coalesce(ps.quantity, 0) < n.value::numeric;
  if v_block_negative and v_short is not null then
    return private.err('SALE_STOCK_INSUFFICIENT', v_short::text);
  end if;

  -- ===== A partir daqui, só escritas; falha vira exceção e desfaz tudo =====
  if v_discount > 0 and nullif(p ->> 'override_token', '') is not null then
    v_authorized := private.consume_override((p ->> 'override_token')::uuid, v_store, v_pct);
    if v_authorized is null then
      perform private.fail('SALE_OVERRIDE_INVALID');
    end if;
  end if;

  if v_fiado_amt > 0 and v_fiado_id is null then
    insert into app.fiado_accounts (store_id, name, name_norm, phone)
    values (v_store, trim(p -> 'fiado' ->> 'name'), private.normalize_name(p -> 'fiado' ->> 'name'), v_phone)
    returning id into v_fiado_id;
  end if;

  insert into app.store_counters (store_id, name, value) values (v_store, 'sale', 1)
  on conflict (store_id, name) do update set value = app.store_counters.value + 1
  returning value into v_number;

  v_bdate := private.business_date(v_store);
  insert into app.sales (store_id, account_id, number, cash_session_id, terminal_id, operator_member_id, tab_id,
    fiado_account_id, order_id, channel, subtotal, discount, delivery_fee, total, origin, client_request_id,
    discount_authorized_by, business_date)
  values (v_store, v_account, v_number, v_cash, v_t.id, v_op.id, p_tab_id, v_fiado_id,
    nullif(p ->> 'order_id', '')::uuid, coalesce(nullif(p ->> 'channel', ''), 'counter'), v_subtotal, v_discount, v_fee,
    v_total, coalesce(nullif(p ->> 'origin', ''), 'normal'), v_req, v_authorized, v_bdate)
  returning id into v_sale;

  for v_it in select * from jsonb_to_recordset(v_items)
      as x(product_id uuid, bundle_id uuid, name text, quantity numeric, unit_price bigint, from_tab boolean) loop
    if v_it.product_id is not null then
      select avg_cost into v_cost from app.products where id = v_it.product_id;
    else
      select coalesce(sum(round(bi.quantity * p2.avg_cost)), 0) into v_cost
      from app.bundle_items bi join app.products p2 on p2.id = bi.product_id where bi.bundle_id = v_it.bundle_id;
    end if;
    v_no_stock := v_short is not null and not v_it.from_tab and (
      (v_it.product_id is not null and v_short ? v_it.product_id::text) or
      exists (select 1 from app.bundle_items bi where bi.bundle_id = v_it.bundle_id and v_short ? bi.product_id::text));
    insert into app.sale_items (sale_id, store_id, product_id, bundle_id, name, quantity, unit_price, unit_cost, total,
      sold_without_stock, stock_from_tab)
    values (v_sale, v_store, v_it.product_id, v_it.bundle_id, v_it.name, v_it.quantity, v_it.unit_price, v_cost,
      round(v_it.quantity * v_it.unit_price), v_no_stock, v_it.from_tab);
  end loop;

  -- Baixa de estoque (combo baixa os itens, E18)
  perform private.move_stock(v_store, n.key::uuid, 'sale', -(n.value::numeric), null, 'sale', v_sale, null, v_op.id)
  from jsonb_each_text(coalesce(v_needs, '{}'::jsonb)) n;

  -- Pagamentos, troco e caixa
  insert into app.sale_payments (sale_id, store_id, method, amount, change_given)
  select v_sale, v_store, x.method::app.pay_method, x.amount,
         case when x.method = 'cash' and x.rn = 1 then v_change else 0 end
  from (select method, amount, row_number() over (partition by method) rn
        from jsonb_to_recordset(p -> 'payments') as y(method text, amount bigint)) x;
  perform private.cash_in(v_store, v_cash, 'sale_cash_in', v_cash_paid, v_op.id, null, v_sale);
  perform private.cash_in(v_store, v_cash, 'change_out', -v_change, v_op.id, null, v_sale);

  if v_fiado_amt > 0 then
    insert into app.fiado_ledger (store_id, fiado_account_id, type, amount, sale_id, member_id)
    values (v_store, v_fiado_id, 'fiado_sale', v_fiado_amt, v_sale, v_op.id);
  end if;

  if p_tab_id is not null then
    update app.tabs set status = 'closed', closed_at = now(), sale_id = v_sale where id = p_tab_id;
  end if;

  if v_discount > 0 then
    perform private.audit_store('sale.discount', v_store, v_account, 'sale', v_sale::text, null,
      jsonb_build_object('pct', v_pct, 'amount', v_discount, 'authorized_by', v_authorized), p_operator_member_id => v_op.id);
  end if;

  return private.ok(jsonb_build_object('sale_id', v_sale, 'number', v_number, 'total', v_total, 'change', v_change,
    'sold_without_stock', coalesce(v_short, '[]'::jsonb), 'replayed', false));
end;
$$;
revoke execute on function private.finalize_sale(jsonb, uuid) from public, anon, authenticated;

create or replace function app.finalize_sale(p jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.finalize_sale(p, null);
$$;

-- RPC: cancelamento (E21, D10) ------------------------------------------------------------------
create or replace function app.cancel_sale(p_operator_session_id uuid, p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_t app.terminals := private.current_terminal();
  v_sale app.sales;
  v_cash_now uuid;
  v_refund bigint;
  v_fiado bigint;
  v_item record;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  select * into v_sale from app.sales where id = p_sale_id and store_id = v_op.store_id for update;
  if not found then
    return private.err('SALE_NOT_FOUND');
  end if;
  if not private.operator_can(p_operator_session_id, 'cancelar')
     or ((select status from app.cash_sessions where id = v_sale.cash_session_id) = 'closed'
         and v_op.role not in ('owner', 'manager')) then
    perform private.audit_store('sale.cancel', v_op.store_id, p_outcome => 'denied', p_entity => 'sale',
      p_entity_id => p_sale_id::text, p_operator_member_id => v_op.id);
    return private.err('FORBIDDEN');
  end if;
  if v_sale.status = 'canceled' then
    return private.err('SALE_ALREADY_CANCELED');
  end if;
  if v_sale.order_id is not null then
    return private.err('SALE_FROM_ORDER', 'Cancele pelo pedido.');
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    return private.err('SALE_CANCEL_REASON_REQUIRED');
  end if;
  select coalesce(sum(amount - change_given) filter (where method = 'cash'), 0),
         coalesce(sum(amount) filter (where method = 'fiado'), 0)
  into v_refund, v_fiado from app.sale_payments where sale_id = p_sale_id;
  v_cash_now := private.open_cash_of_terminal(v_t.id);
  if v_refund > 0 and v_cash_now is null then
    return private.err('SALE_CASH_CLOSED', 'Abra o caixa para devolver o dinheiro.');
  end if;

  update app.sales set status = 'canceled', canceled_at = now(), canceled_by = v_op.id, cancel_reason = trim(p_reason)
  where id = p_sale_id;

  for v_item in
    select coalesce(si.product_id, bi.product_id) product_id, sum(si.quantity * coalesce(bi.quantity, 1)) qty
    from app.sale_items si left join app.bundle_items bi on bi.bundle_id = si.bundle_id
    where si.sale_id = p_sale_id group by 1
  loop
    perform private.move_stock(v_op.store_id, v_item.product_id, 'sale_cancel', v_item.qty, null, 'sale', p_sale_id, p_reason, v_op.id);
  end loop;

  perform private.cash_in(v_op.store_id, v_cash_now, 'sale_cancel_refund', -v_refund, v_op.id, p_reason, p_sale_id);
  if v_fiado > 0 then
    insert into app.fiado_ledger (store_id, fiado_account_id, type, amount, sale_id, member_id, note)
    values (v_op.store_id, v_sale.fiado_account_id, 'sale_cancel', -v_fiado, p_sale_id, v_op.id, p_reason);
  end if;

  perform private.audit_store('sale.cancel', v_op.store_id, v_sale.account_id, 'sale', p_sale_id::text,
    jsonb_build_object('status', 'paid', 'total', v_sale.total), jsonb_build_object('status', 'canceled', 'refund_cash', v_refund),
    p_reason, p_operator_member_id => v_op.id);
  return private.ok(jsonb_build_object('refund_cash', v_refund, 'pix_card_refund_outside',
    v_sale.total - v_refund - v_fiado > 0));
end;
$$;

-- RPCs: comandas (E22, D41) ---------------------------------------------------------------------
create or replace function app.open_tab(p_operator_session_id uuid, p_kind text, p_label text, p_nickname text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_tab uuid;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'vender') then
    return private.err('FORBIDDEN');
  end if;
  if p_kind not in ('table', 'tab') or length(trim(coalesce(p_label, ''))) < 1 then
    return private.err('TAB_INVALID');
  end if;
  if exists (select 1 from app.tabs where store_id = v_op.store_id and kind = p_kind and lower(label) = lower(trim(p_label)) and status = 'open') then
    return private.err('TAB_ALREADY_OPEN');
  end if;
  insert into app.tabs (store_id, kind, label, nickname, opened_by) values (v_op.store_id, p_kind, trim(p_label), p_nickname, v_op.id)
  returning id into v_tab;
  return private.ok(jsonb_build_object('tab_id', v_tab));
end;
$$;

-- Lança item na comanda e já baixa o estoque (D41).
create or replace function app.add_tab_item(p_operator_session_id uuid, p_tab_id uuid, p_product_id uuid,
  p_bundle_id uuid, p_quantity numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_name text;
  v_price bigint;
  v_item uuid;
  v_account uuid;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'vender') then
    return private.err('FORBIDDEN');
  end if;
  perform 1 from app.tabs where id = p_tab_id and store_id = v_op.store_id and status = 'open';
  if not found then
    return private.err('TAB_NOT_OPEN');
  end if;
  if coalesce(p_quantity, 0) <= 0 or ((p_product_id is null) = (p_bundle_id is null)) then
    return private.err('SALE_ITEM_INVALID');
  end if;
  select account_id into v_account from app.stores where id = v_op.store_id;
  if p_product_id is not null then
    select p2.name, private.effective_price(v_op.store_id, p2.id) into v_name, v_price
    from app.products p2 where p2.id = p_product_id and p2.account_id = v_account and p2.active;
  else
    select b.name, private.bundle_price(v_op.store_id, b.id) into v_name, v_price
    from app.bundles b where b.id = p_bundle_id and b.account_id = v_account and private.bundle_is_live(b.id, v_op.store_id);
  end if;
  if v_name is null then
    return private.err('SALE_PRODUCT_UNAVAILABLE');
  end if;

  insert into app.tab_items (tab_id, store_id, product_id, bundle_id, name, quantity, unit_price, added_by)
  values (p_tab_id, v_op.store_id, p_product_id, p_bundle_id, v_name, p_quantity, v_price, v_op.id)
  returning id into v_item;
  perform private.move_stock(v_op.store_id, coalesce(p_product_id, bi.product_id), 'tab',
    -(p_quantity * coalesce(bi.quantity, 1)), null, 'tab', p_tab_id, null, v_op.id)
  from (select null::uuid product_id, null::numeric quantity where p_product_id is not null
        union all select product_id, quantity from app.bundle_items where bundle_id = p_bundle_id) bi;
  return private.ok(jsonb_build_object('tab_item_id', v_item, 'unit_price', v_price));
end;
$$;

-- Tirar item: devolve o estoque; depois de 10 min exige permissão de cancelar.
create or replace function app.remove_tab_item(p_operator_session_id uuid, p_tab_item_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_it app.tab_items;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  select ti.* into v_it from app.tab_items ti join app.tabs t on t.id = ti.tab_id and t.status = 'open'
  where ti.id = p_tab_item_id and ti.store_id = v_op.store_id and ti.removed_at is null for update of ti;
  if not found then
    return private.err('TAB_ITEM_NOT_FOUND');
  end if;
  if not private.operator_can(p_operator_session_id, 'vender')
     or (v_it.added_at < now() - interval '10 minutes' and not private.operator_can(p_operator_session_id, 'cancelar')) then
    perform private.audit_store('tab.remove_item', v_op.store_id, p_outcome => 'denied', p_entity => 'tab_item',
      p_entity_id => p_tab_item_id::text, p_operator_member_id => v_op.id);
    return private.err('FORBIDDEN');
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    return private.err('TAB_REMOVE_REASON_REQUIRED');
  end if;
  update app.tab_items set removed_at = now(), removed_by = v_op.id, remove_reason = trim(p_reason) where id = p_tab_item_id;
  perform private.move_stock(v_op.store_id, coalesce(v_it.product_id, bi.product_id), 'tab_remove',
    v_it.quantity * coalesce(bi.quantity, 1), null, 'tab', v_it.tab_id, p_reason, v_op.id)
  from (select null::uuid product_id, null::numeric quantity where v_it.product_id is not null
        union all select product_id, quantity from app.bundle_items where bundle_id = v_it.bundle_id) bi;
  perform private.audit_store('tab.remove_item', v_op.store_id, null, 'tab_item', p_tab_item_id::text, null,
    jsonb_build_object('name', v_it.name, 'quantity', v_it.quantity), p_reason, p_operator_member_id => v_op.id);
  return private.ok();
end;
$$;

-- Fechar comanda = venda com os itens da comanda (sem baixar estoque de novo).
create or replace function app.close_tab(p_tab_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tab app.tabs;
begin
  select * into v_tab from app.tabs where id = p_tab_id and status = 'open' for update;
  if not found then
    return private.err('TAB_NOT_OPEN');
  end if;
  if v_tab.store_id is distinct from private.terminal_store() then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  return private.finalize_sale(p, p_tab_id);
end;
$$;

-- RPCs: fiado (E23) ------------------------------------------------------------------------------
-- Busca por nome (sem acento) ou telefone. No terminal, o telefone vem mascarado.
create or replace function app.find_fiado(p_store_id uuid, p_query text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not (private.reads_store(p_store_id)) then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object(
      'fiado_account_id', f.id, 'name', f.name, 'balance', f.balance, 'promised_date', f.promised_date,
      'credit_limit', f.credit_limit,
      'phone', case when private.current_user_kind() = 'terminal' or not private.can(p_store_id, 'fiado_receber')
                    then '(' || substr(f.phone, 1, 2) || ') •••••-' || right(f.phone, 4)
                    else f.phone end
    ) order by f.name), '[]'::jsonb)) end
  from app.fiado_accounts f
  where f.store_id = p_store_id
    and (regexp_replace(coalesce(p_query, ''), '\D', '', 'g') <> '' and f.phone like '%' || regexp_replace(p_query, '\D', '', 'g') || '%'
         or f.name_norm operator(extensions.%) private.normalize_name(p_query)
         or f.name_norm like '%' || private.normalize_name(p_query) || '%');
$$;

-- Quem deve, por atraso (pessoa logada com fiado_receber).
create or replace function app.fiado_list(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.can(p_store_id, 'fiado_receber') then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object(
      'fiado_account_id', f.id, 'name', f.name, 'phone', f.phone, 'balance', f.balance,
      'promised_date', f.promised_date, 'last_purchase', (select max(created_at) from app.fiado_ledger l
        where l.fiado_account_id = f.id and l.type = 'fiado_sale')
    ) order by f.promised_date nulls last, f.balance desc), '[]'::jsonb)) end
  from app.fiado_accounts f where f.store_id = p_store_id and f.balance > 0;
$$;

create or replace function app.receive_fiado_payment(p_operator_session_id uuid, p_fiado_account_id uuid,
  p_amount bigint, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_f app.fiado_accounts;
  v_cash uuid := private.open_cash_of_terminal((private.current_terminal()).id);
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'fiado_receber') then
    perform private.audit_store('fiado.payment', v_op.store_id, p_outcome => 'denied', p_operator_member_id => v_op.id);
    return private.err('FORBIDDEN');
  end if;
  select * into v_f from app.fiado_accounts where id = p_fiado_account_id and store_id = v_op.store_id for update;
  if not found then
    return private.err('FIADO_NOT_FOUND');
  end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > v_f.balance then
    return private.err('FIADO_PAYMENT_INVALID', format('saldo %s', v_f.balance));
  end if;
  if p_method not in ('pix', 'credit', 'debit', 'cash') then
    return private.err('FIADO_PAYMENT_METHOD');
  end if;
  if p_method = 'cash' and v_cash is null then
    return private.err('SALE_CASH_CLOSED');
  end if;

  insert into app.fiado_ledger (store_id, fiado_account_id, type, amount, method, member_id)
  values (v_op.store_id, p_fiado_account_id, 'payment', -p_amount, p_method::app.pay_method, v_op.id);
  if p_method = 'cash' then
    perform private.cash_in(v_op.store_id, v_cash, 'fiado_payment_in', p_amount, v_op.id, 'Pagamento de fiado', p_fiado_account_id);
  end if;
  perform private.audit_store('fiado.payment', v_op.store_id, null, 'fiado_account', p_fiado_account_id::text,
    jsonb_build_object('balance', v_f.balance), jsonb_build_object('balance', v_f.balance - p_amount, 'method', p_method),
    p_operator_member_id => v_op.id);
  return private.ok(jsonb_build_object('balance', v_f.balance - p_amount));
end;
$$;

-- Juntar dois fiados que são a mesma pessoa (dono ou gerente com fiado_ajustar, pelo celular).
create or replace function app.merge_fiado(p_store_id uuid, p_from uuid, p_into uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from app.fiado_accounts;
begin
  if not private.can(p_store_id, 'fiado_ajustar') then
    perform private.audit_store('fiado.merge', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if p_from = p_into then
    return private.err('FIADO_MERGE_SAME');
  end if;
  select * into v_from from app.fiado_accounts where id = p_from and store_id = p_store_id for update;
  if not found or not exists (select 1 from app.fiado_accounts where id = p_into and store_id = p_store_id) then
    return private.err('FIADO_NOT_FOUND');
  end if;
  if v_from.balance <> 0 then
    insert into app.fiado_ledger (store_id, fiado_account_id, type, amount, note) values
      (p_store_id, p_from, 'merge_out', -v_from.balance, 'Juntado em ' || p_into),
      (p_store_id, p_into, 'merge_in', v_from.balance, 'Veio de ' || v_from.name);
  end if;
  update app.sales set fiado_account_id = p_into where fiado_account_id = p_from and store_id = p_store_id;
  perform private.audit_store('fiado.merge', p_store_id, null, 'fiado_account', p_into::text,
    jsonb_build_object('from', p_from, 'from_name', v_from.name, 'balance', v_from.balance), null);
  return private.ok();
end;
$$;

-- Limite e data prometida (dono ou gerente).
create or replace function app.update_fiado(p_store_id uuid, p_fiado_account_id uuid, p_credit_limit bigint default null,
  p_promised_date date default null, p_note text default null, p_clear_limit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can(p_store_id, 'fiado_ajustar') then
    return private.err('FORBIDDEN');
  end if;
  update app.fiado_accounts set
    credit_limit = case when p_clear_limit then null else coalesce(p_credit_limit, credit_limit) end,
    promised_date = coalesce(p_promised_date, promised_date),
    note = coalesce(p_note, note)
  where id = p_fiado_account_id and store_id = p_store_id;
  if not found then
    return private.err('FIADO_NOT_FOUND');
  end if;
  perform private.audit_store('fiado.update', p_store_id, null, 'fiado_account', p_fiado_account_id::text, null,
    jsonb_build_object('credit_limit', p_credit_limit, 'promised_date', p_promised_date));
  return private.ok();
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'app.open_cash(uuid, bigint)', 'app.cash_movement(uuid, text, bigint, text)', 'app.close_cash(uuid, bigint, text)',
    'app.finalize_sale(jsonb)', 'app.cancel_sale(uuid, uuid, text)', 'app.open_tab(uuid, text, text, text)',
    'app.add_tab_item(uuid, uuid, uuid, uuid, numeric)', 'app.remove_tab_item(uuid, uuid, text)', 'app.close_tab(uuid, jsonb)',
    'app.find_fiado(uuid, text)', 'app.fiado_list(uuid)', 'app.receive_fiado_payment(uuid, uuid, bigint, text)',
    'app.merge_fiado(uuid, uuid, uuid)', 'app.update_fiado(uuid, uuid, bigint, date, text, boolean)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
