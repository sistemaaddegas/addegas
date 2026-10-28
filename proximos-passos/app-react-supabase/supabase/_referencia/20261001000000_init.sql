-- Addegas · schema inicial (multi-loja, RLS por membro da loja)
create extension if not exists "pgcrypto";

create type member_role as enum ('owner','manager','cashier','courier');
create type pay_method as enum ('pix','cash','credit','debit','store_credit');
create type order_channel as enum ('ifood','ze_delivery','food99','keeta','whatsapp','counter');
create type order_status as enum ('new','preparing','ready','out_for_delivery','completed','rejected');
create type fulfillment as enum ('own_delivery','platform_delivery','pickup');
create type movement_type as enum ('entry','sale','adjustment','count','loss');

-- Lojas e equipe ----------------------------------------------------------
create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,               -- addegas.app/<slug> (catálogo)
  neighborhood text, city text, address text, cnpj text,
  owner_whatsapp text, opening_hours text,
  plan text not null default 'pro',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, phone text,
  created_at timestamptz not null default now()
);

create table store_members (
  store_id uuid not null references stores on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role member_role not null default 'cashier',
  pin_hash text,                            -- PIN de 4 dígitos para entrar no caixa
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table role_permissions (
  store_id uuid not null references stores on delete cascade,
  role member_role not null,
  permission text not null,                 -- vender, desconto, cancelar, caixa, fiado, estoque, precos, contas, relatorios, equipe
  allowed boolean not null default false,
  primary key (store_id, role, permission)
);

-- helpers de RLS
create or replace function is_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_members m where m.store_id = s and m.user_id = auth.uid() and m.active)
$$;
create or replace function has_role(s uuid, roles member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from store_members m where m.store_id = s and m.user_id = auth.uid() and m.active and m.role = any(roles))
$$;

-- Catálogo -----------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null, sort int not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  category_id uuid references categories on delete set null,
  name text not null,
  barcode text,
  price numeric(10,2) not null check (price >= 0),
  cost numeric(10,2) not null default 0,
  stock int not null default 0,
  min_stock int not null default 0,
  active boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  unique (store_id, barcode)
);
create index on products (store_id, name);

create table stock_lots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid not null references products on delete cascade,
  lot_code text, quantity int not null, expires_on date
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  product_id uuid not null references products on delete cascade,
  type movement_type not null,
  quantity int not null,                    -- positivo entra, negativo sai
  unit_cost numeric(10,2),
  ref_id uuid,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create table combos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null, price numeric(10,2) not null, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table combo_items (
  combo_id uuid not null references combos on delete cascade,
  product_id uuid not null references products on delete restrict,
  quantity int not null check (quantity > 0),
  primary key (combo_id, product_id)
);

-- Clientes e fiado ----------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null, phone text,
  credit_limit numeric(10,2) not null default 0,
  balance numeric(10,2) not null default 0,  -- quanto deve hoje (mantido por trigger)
  created_at timestamptz not null default now()
);
create table customer_ledger (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  customer_id uuid not null references customers on delete cascade,
  amount numeric(10,2) not null,             -- + compra no fiado / − pagamento
  sale_id uuid, note text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

-- Caixa, comandas e vendas --------------------------------------------------
create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  operator_id uuid not null references auth.users,
  opened_at timestamptz not null default now(),
  opening_float numeric(10,2) not null default 0,
  closed_at timestamptz,
  expected_cash numeric(10,2), counted_cash numeric(10,2), difference numeric(10,2),
  summary jsonb
);
create unique index one_open_session_per_store on cash_sessions (store_id) where closed_at is null;

create table tabs (                            -- comandas / mesas
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  label text not null, customer_id uuid references customers,
  status text not null default 'open' check (status in ('open','closed')),
  opened_at timestamptz not null default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  number bigint generated always as identity,
  cash_session_id uuid references cash_sessions,
  tab_id uuid references tabs, customer_id uuid references customers, order_id uuid,
  subtotal numeric(10,2) not null, discount numeric(10,2) not null default 0, total numeric(10,2) not null,
  status text not null default 'paid' check (status in ('paid','canceled')),
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
create index on sales (store_id, created_at desc);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales on delete cascade,
  store_id uuid not null references stores on delete cascade,
  product_id uuid references products, combo_id uuid references combos,
  name text not null, quantity int not null, unit_price numeric(10,2) not null, total numeric(10,2) not null,
  check ((product_id is null) <> (combo_id is null))
);

create table sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales on delete cascade,
  store_id uuid not null references stores on delete cascade,
  method pay_method not null, amount numeric(10,2) not null, change_given numeric(10,2) not null default 0
);

-- Pedidos (apps + WhatsApp + entrega própria) -------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  channel order_channel not null, external_id text,
  customer_name text, customer_phone text, address text,
  fulfillment fulfillment not null,
  status order_status not null default 'new',
  total numeric(10,2) not null, payment_note text,
  courier_id uuid references auth.users,
  raw jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (store_id, channel, external_id)
);
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders on delete cascade,
  store_id uuid not null references stores on delete cascade,
  product_id uuid references products, combo_id uuid references combos,
  name text not null, quantity int not null, unit_price numeric(10,2) not null
);

-- Compras e contas a pagar --------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null, category text, phone text, lead_time text
);
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  supplier_id uuid references suppliers,
  status text not null default 'draft' check (status in ('draft','sent','received','canceled')),
  total numeric(10,2), sent_at timestamptz, created_at timestamptz not null default now()
);
create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders on delete cascade,
  store_id uuid not null references stores on delete cascade,
  product_id uuid not null references products, quantity int not null, unit_cost numeric(10,2)
);
create table bills (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  supplier_id uuid references suppliers,
  description text not null, category text not null default 'Fornecedor',
  due_on date not null, amount numeric(10,2) not null, paid_at timestamptz
);

-- Configurações -------------------------------------------------------------
create table integrations (
  store_id uuid not null references stores on delete cascade,
  provider order_channel not null,
  enabled boolean not null default false,
  connected_at timestamptz,
  primary key (store_id, provider)            -- credenciais ficam no Vault / Edge Function secrets
);
create table alert_settings (
  store_id uuid primary key references stores on delete cascade,
  whatsapp_to text,
  low_stock boolean not null default true, cash_close boolean not null default true,
  late_order boolean not null default true, expiring boolean not null default true,
  big_sale boolean not null default false, big_sale_threshold numeric(10,2) not null default 300
);
create table catalog_settings (
  store_id uuid primary key references stores on delete cascade,
  enabled boolean not null default true
);

-- RLS -----------------------------------------------------------------------
alter table stores enable row level security;
create policy "membros leem a loja" on stores for select using (is_member(id));
create policy "dono edita a loja" on stores for update using (has_role(id, array['owner']::member_role[]));
create policy "usuário cria loja" on stores for insert with check (auth.uid() is not null);

alter table profiles enable row level security;
create policy "perfil próprio" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['categories','products','stock_lots','stock_movements','combos','customers','customer_ledger',
    'cash_sessions','tabs','sales','sale_items','sale_payments','orders','order_items','suppliers','purchase_orders',
    'purchase_order_items','integrations','alert_settings','catalog_settings']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "membros da loja" on %I for all using (is_member(store_id)) with check (is_member(store_id))', t);
  end loop;
end $$;

alter table combo_items enable row level security;
create policy "membros da loja" on combo_items for all
  using (exists (select 1 from combos c where c.id = combo_id and is_member(c.store_id)))
  with check (exists (select 1 from combos c where c.id = combo_id and is_member(c.store_id)));

-- só dono/gerente: equipe, permissões, contas a pagar
alter table store_members enable row level security;
create policy "membros veem a equipe" on store_members for select using (is_member(store_id));
create policy "dono/gerente gerenciam equipe" on store_members for all
  using (has_role(store_id, array['owner','manager']::member_role[]))
  with check (has_role(store_id, array['owner','manager']::member_role[]));

alter table role_permissions enable row level security;
create policy "membros leem permissões" on role_permissions for select using (is_member(store_id));
create policy "dono edita permissões" on role_permissions for all
  using (has_role(store_id, array['owner']::member_role[])) with check (has_role(store_id, array['owner']::member_role[]));

alter table bills enable row level security;
create policy "dono/gerente veem contas" on bills for all
  using (has_role(store_id, array['owner','manager']::member_role[]))
  with check (has_role(store_id, array['owner','manager']::member_role[]));

-- Quem cria a loja vira dono
create or replace function on_store_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into store_members (store_id, user_id, role) values (new.id, auth.uid(), 'owner');
  insert into alert_settings (store_id) values (new.id);
  insert into catalog_settings (store_id) values (new.id);
  return new;
end $$;
create trigger store_created after insert on stores for each row execute function on_store_created();

-- Baixa de estoque na venda (produto ou itens do combo)
create or replace function on_sale_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null then
    update products set stock = stock - new.quantity where id = new.product_id;
    insert into stock_movements (store_id, product_id, type, quantity, ref_id) values (new.store_id, new.product_id, 'sale', -new.quantity, new.sale_id);
  else
    update products p set stock = p.stock - ci.quantity * new.quantity from combo_items ci where ci.combo_id = new.combo_id and p.id = ci.product_id;
    insert into stock_movements (store_id, product_id, type, quantity, ref_id)
      select new.store_id, ci.product_id, 'sale', -(ci.quantity * new.quantity), new.sale_id from combo_items ci where ci.combo_id = new.combo_id;
  end if;
  return new;
end $$;
create trigger sale_item_stock after insert on sale_items for each row execute function on_sale_item();

-- Entrada / contagem atualiza estoque
create or replace function on_stock_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type in ('entry','adjustment','count','loss') then
    update products set stock = stock + new.quantity,
      cost = case when new.type = 'entry' and new.unit_cost is not null then new.unit_cost else cost end
    where id = new.product_id;
  end if;
  return new;
end $$;
create trigger stock_movement_apply after insert on stock_movements for each row execute function on_stock_movement();

-- Saldo do fiado
create or replace function on_ledger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update customers set balance = balance + new.amount where id = new.customer_id;
  return new;
end $$;
create trigger ledger_balance after insert on customer_ledger for each row execute function on_ledger();

-- Relatório diário
create or replace view daily_sales with (security_invoker = on) as
  select store_id, date_trunc('day', created_at) as day, count(*) as sales, sum(total) as revenue
  from sales where status = 'paid' group by 1, 2;

-- Realtime para o Início do dono
alter publication supabase_realtime add table orders, sales, cash_sessions;
