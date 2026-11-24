-- E16 (catálogo mestre, categorias, produtos, preço por loja), E17 (estoque) e E18 (combos e promoções).
-- Produto e combo são da CONTA (D37); preço por loja opcional; estoque é sempre da loja.

-- Helpers de conta -------------------------------------------------------------------
create or replace function private.terminal_account()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.account_id from app.stores s where s.id = (select private.terminal_store());
$$;

-- Permissão em ALGUMA loja da conta (editar o que é da conta, ex.: preço padrão).
create or replace function private.can_account(p_account_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from app.stores s where s.account_id = p_account_id and private.can(s.id, p_permission));
$$;

-- Lê o que é da conta: membro de alguma loja da conta, dono, ou terminal de uma loja da conta.
create or replace function private.reads_account(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_account_member(p_account_id) or coalesce(private.terminal_account() = p_account_id, false);
$$;

-- Lê o que é da loja: membro da loja ou terminal da loja.
create or replace function private.reads_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_store_member(p_store_id) or coalesce(private.terminal_store() = p_store_id, false);
$$;

revoke execute on function private.terminal_account() from public, anon;
revoke execute on function private.can_account(uuid, text) from public, anon;
revoke execute on function private.reads_account(uuid) from public, anon;
revoke execute on function private.reads_store(uuid) from public, anon;
grant execute on function private.terminal_account() to authenticated, service_role;
grant execute on function private.can_account(uuid, text) to authenticated, service_role;
grant execute on function private.reads_account(uuid) to authenticated, service_role;
grant execute on function private.reads_store(uuid) to authenticated, service_role;

-- Livro-razão: só inserção.
create or replace function private.ledger_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'LEDGER_IMMUTABLE',
    detail = tg_table_schema || '.' || tg_table_name || ' aceita só inserção; corrija com um novo lançamento';
end;
$$;
revoke execute on function private.ledger_immutable() from public, anon, authenticated;

-- Catálogo mestre (E16, leitura) -------------------------------------------------------
create table platform.catalog_products (
  id uuid primary key default gen_random_uuid(),
  ean text,
  name text not null,
  brand text,
  volume_ml int check (volume_ml > 0),
  abv numeric(4, 1),
  suggested_category text,
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index catalog_products_ean_published on platform.catalog_products (ean) where status = 'published' and ean is not null;
create index catalog_products_name_trgm on platform.catalog_products using gin (name extensions.gin_trgm_ops);
alter table platform.catalog_products enable row level security;
create trigger catalog_products_touch before update on platform.catalog_products for each row execute function private.touch_updated_at();

create or replace function app.search_catalog(p_query text, p_limit int default 20)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.ok(coalesce(jsonb_agg(to_jsonb(c) order by c.score desc, c.name), '[]'::jsonb))
  from (
    select cp.id, cp.ean, cp.name, cp.brand, cp.volume_ml, cp.suggested_category, cp.image_path,
           extensions.similarity(cp.name, p_query) as score
    from platform.catalog_products cp
    where cp.status = 'published'
      and (cp.ean = p_query or cp.name operator(extensions.%) p_query or cp.name ilike '%' || p_query || '%')
    order by score desc
    limit least(greatest(p_limit, 1), 50)
  ) c
  where (select auth.uid()) is not null;
$$;

-- Categorias e produtos (E16) -----------------------------------------------------------
create table app.categories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  name text not null check (length(trim(name)) between 1 and 60),
  color text,
  sort int not null default 0,
  unique (account_id, name),
  unique (id, account_id)
);

create table app.products (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  category_id uuid,
  catalog_product_id uuid references platform.catalog_products (id),
  name text not null check (length(trim(name)) between 1 and 120),
  ean text,
  unit text not null default 'un' check (unit in ('un', 'ml', 'l', 'kg', 'g')),
  volume_ml int check (volume_ml > 0),
  price app.cents not null,             -- preço padrão da conta (D37)
  avg_cost app.cents not null default 0, -- custo médio ponderado (D08)
  last_cost app.cents,
  min_stock app.qty not null default 0,
  active boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  foreign key (category_id, account_id) references app.categories (id, account_id)
);
create unique index products_account_ean on app.products (account_id, ean) where ean is not null;
create index products_account_idx on app.products (account_id);
create index products_category_idx on app.products (category_id, account_id);
create index products_catalog_idx on app.products (catalog_product_id);
create index products_name_trgm on app.products using gin (name extensions.gin_trgm_ops);
create trigger products_touch before update on app.products for each row execute function private.touch_updated_at();

-- Ajustes por loja: preço próprio, mínimo próprio, vende ou não nesta loja (D37).
create table app.store_products (
  store_id uuid not null,
  product_id uuid not null,
  account_id uuid not null,
  price app.cents,
  min_stock app.qty,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (product_id, account_id) references app.products (id, account_id)
);
create index store_products_product_idx on app.store_products (product_id, account_id);
create index store_products_store_account_idx on app.store_products (store_id, account_id);

create or replace function private.effective_price(p_store_id uuid, p_product_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sp.price, p.price)::bigint
  from app.products p
  left join app.store_products sp on sp.product_id = p.id and sp.store_id = p_store_id
  where p.id = p_product_id;
$$;
revoke execute on function private.effective_price(uuid, uuid) from public, anon;
grant execute on function private.effective_price(uuid, uuid) to authenticated, service_role;

-- Estoque (E17) --------------------------------------------------------------------------
create type app.stock_movement_type as enum (
  'initial', 'entry', 'sale', 'sale_cancel', 'adjustment', 'count_adjustment', 'loss',
  'transfer_out', 'transfer_in', 'order', 'order_cancel', 'tab', 'tab_remove'
);

create table app.product_stock (
  store_id uuid not null,
  product_id uuid not null,
  account_id uuid not null,
  quantity app.qty not null default 0,
  updated_at timestamptz not null default now(),
  primary key (store_id, product_id),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (product_id, account_id) references app.products (id, account_id)
);
create index product_stock_product_idx on app.product_stock (product_id, account_id);
create index product_stock_store_account_idx on app.product_stock (store_id, account_id);

create table app.stock_lots (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  account_id uuid not null,
  product_id uuid not null,
  code text,
  expires_on date,
  initial_qty app.qty not null check (initial_qty > 0),
  remaining_qty app.qty not null,
  created_at timestamptz not null default now(),
  unique (id, store_id),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (product_id, account_id) references app.products (id, account_id)
);
create index stock_lots_fefo_idx on app.stock_lots (store_id, product_id, expires_on) where remaining_qty > 0;
create index stock_lots_product_idx on app.stock_lots (product_id, account_id);
create index stock_lots_store_account_idx on app.stock_lots (store_id, account_id);

create table app.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  account_id uuid not null,
  product_id uuid not null,
  type app.stock_movement_type not null,
  quantity app.qty not null check (quantity <> 0), -- positivo entra, negativo sai
  unit_cost app.cents,
  lot_id uuid,
  ref_type text,
  ref_id uuid,
  reason text,
  operator_member_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (product_id, account_id) references app.products (id, account_id),
  foreign key (lot_id, store_id) references app.stock_lots (id, store_id)
);
create index stock_movements_store_idx on app.stock_movements (store_id, created_at desc);
create index stock_movements_product_idx on app.stock_movements (product_id, account_id, created_at desc);
create index stock_movements_store_account_idx on app.stock_movements (store_id, account_id);
create index stock_movements_lot_idx on app.stock_movements (lot_id, store_id);
create index stock_movements_ref_idx on app.stock_movements (ref_type, ref_id);

create trigger stock_movements_immutable before update or delete on app.stock_movements
  for each row execute function private.ledger_immutable();

-- A única regra que muda saldo: insert em stock_movements (corrige os dois caminhos do rascunho antigo).
create or replace function private.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_left numeric;
  v_lot record;
  v_take numeric;
begin
  -- Custo médio ponderado da conta (D08), calculado com o estoque de todas as lojas antes da entrada.
  if new.type in ('entry', 'initial') and new.unit_cost is not null and new.quantity > 0 then
    select coalesce(sum(greatest(ps.quantity, 0)), 0) into v_total
    from app.product_stock ps where ps.product_id = new.product_id;
    update app.products p set
      avg_cost = case when v_total <= 0 then new.unit_cost
                      else round((v_total * p.avg_cost + new.quantity * new.unit_cost) / (v_total + new.quantity)) end,
      last_cost = new.unit_cost
    where p.id = new.product_id;
  end if;

  insert into app.product_stock (store_id, product_id, account_id, quantity)
  values (new.store_id, new.product_id, new.account_id, new.quantity)
  on conflict (store_id, product_id) do update
    set quantity = app.product_stock.quantity + excluded.quantity, updated_at = now();

  -- Lotes (D07): saída consome o lote de validade mais próxima (FEFO), só para alerta de validade.
  if new.quantity < 0 and new.lot_id is null then
    v_left := -new.quantity;
    for v_lot in
      select id, remaining_qty from app.stock_lots
      where store_id = new.store_id and product_id = new.product_id and remaining_qty > 0
      order by expires_on nulls last, created_at
      for update
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_lot.remaining_qty);
      update app.stock_lots set remaining_qty = remaining_qty - v_take where id = v_lot.id;
      v_left := v_left - v_take;
    end loop;
  end if;
  return new;
end;
$$;
revoke execute on function private.apply_stock_movement() from public, anon, authenticated;

create trigger stock_movements_apply after insert on app.stock_movements
  for each row execute function private.apply_stock_movement();

-- Lança um movimento (usado pelas RPCs). Confere que produto e loja são da mesma conta via FK.
create or replace function private.move_stock(
  p_store_id uuid, p_product_id uuid, p_type app.stock_movement_type, p_quantity numeric,
  p_unit_cost bigint default null, p_ref_type text default null, p_ref_id uuid default null,
  p_reason text default null, p_operator uuid default null, p_lot_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into app.stock_movements (store_id, account_id, product_id, type, quantity, unit_cost, lot_id,
    ref_type, ref_id, reason, operator_member_id)
  select p_store_id, s.account_id, p_product_id, p_type, p_quantity, p_unit_cost, p_lot_id,
    p_ref_type, p_ref_id, p_reason, p_operator
  from app.stores s where s.id = p_store_id
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function private.move_stock(uuid, uuid, app.stock_movement_type, numeric, bigint, text, uuid, text, uuid, uuid) from public, anon, authenticated;

-- Contagem (E17): guarda o valor contado e o saldo do momento; aplica a diferença.
create table app.stock_counts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  status text not null default 'open' check (status in ('open', 'applied', 'canceled')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (id, store_id)
);
create index stock_counts_store_idx on app.stock_counts (store_id, created_at desc);

create table app.stock_count_items (
  count_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  counted_qty app.qty not null check (counted_qty >= 0),
  system_qty_at_count app.qty not null,
  counted_at timestamptz not null default now(),
  primary key (count_id, product_id),
  foreign key (count_id, store_id) references app.stock_counts (id, store_id),
  foreign key (product_id) references app.products (id)
);
create index stock_count_items_store_idx on app.stock_count_items (count_id, store_id);
create index stock_count_items_product_idx on app.stock_count_items (product_id);

-- Combos e promoções (E18 + E29, D52) ---------------------------------------------------
create table app.bundles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  kind text not null default 'combo' check (kind in ('combo', 'promotion')),
  name text not null check (length(trim(name)) between 1 and 120),
  price app.cents not null,
  active boolean not null default true,
  image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  weekdays int[] check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]),
  start_time time,
  end_time time,
  show_in_catalog boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index bundles_account_idx on app.bundles (account_id);
create trigger bundles_touch before update on app.bundles for each row execute function private.touch_updated_at();

create table app.bundle_items (
  bundle_id uuid not null,
  account_id uuid not null,
  product_id uuid not null,
  quantity app.qty not null check (quantity > 0),
  primary key (bundle_id, product_id),
  foreign key (bundle_id, account_id) references app.bundles (id, account_id) on delete cascade,
  foreign key (product_id, account_id) references app.products (id, account_id)
);
create index bundle_items_bundle_account_idx on app.bundle_items (bundle_id, account_id);
create index bundle_items_product_idx on app.bundle_items (product_id, account_id);

create table app.store_bundles (
  store_id uuid not null,
  bundle_id uuid not null,
  account_id uuid not null,
  price app.cents,
  active boolean not null default true,
  primary key (store_id, bundle_id),
  foreign key (store_id, account_id) references app.stores (id, account_id),
  foreign key (bundle_id, account_id) references app.bundles (id, account_id) on delete cascade
);
create index store_bundles_bundle_idx on app.store_bundles (bundle_id, account_id);
create index store_bundles_store_account_idx on app.store_bundles (store_id, account_id);

create table app.quick_access (
  store_id uuid not null references app.stores (id),
  position int not null check (position between 0 and 99),
  product_id uuid references app.products (id),
  bundle_id uuid references app.bundles (id),
  color text,
  primary key (store_id, position),
  check ((product_id is null) <> (bundle_id is null))
);
create index quick_access_product_idx on app.quick_access (product_id);
create index quick_access_bundle_idx on app.quick_access (bundle_id);

-- Promoção vale agora? (período, dia da semana e horário no fuso da conta)
create or replace function private.bundle_is_live(p_bundle_id uuid, p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select b.active and coalesce(sb.active, true)
    and (b.starts_at is null or now() >= b.starts_at)
    and (b.ends_at is null or now() < b.ends_at)
    and (b.weekdays is null or extract(dow from now() at time zone a.timezone)::int = any (b.weekdays))
    and (b.start_time is null or (now() at time zone a.timezone)::time >= b.start_time)
    and (b.end_time is null or (now() at time zone a.timezone)::time < b.end_time)
    -- E18: combo fica indisponível se algum item estiver inativo
    and not exists (select 1 from app.bundle_items bi join app.products p on p.id = bi.product_id
                    where bi.bundle_id = b.id and not p.active)
  from app.bundles b
  join app.accounts a on a.id = b.account_id
  left join app.store_bundles sb on sb.bundle_id = b.id and sb.store_id = p_store_id
  where b.id = p_bundle_id;
$$;
revoke execute on function private.bundle_is_live(uuid, uuid) from public, anon;
grant execute on function private.bundle_is_live(uuid, uuid) to authenticated, service_role;

create or replace function private.bundle_price(p_store_id uuid, p_bundle_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sb.price, b.price)::bigint from app.bundles b
  left join app.store_bundles sb on sb.bundle_id = b.id and sb.store_id = p_store_id
  where b.id = p_bundle_id;
$$;
revoke execute on function private.bundle_price(uuid, uuid) from public, anon;
grant execute on function private.bundle_price(uuid, uuid) to authenticated, service_role;

-- RLS e grants --------------------------------------------------------------------------------
alter table app.categories enable row level security;
alter table app.products enable row level security;
alter table app.store_products enable row level security;
alter table app.product_stock enable row level security;
alter table app.stock_lots enable row level security;
alter table app.stock_movements enable row level security;
alter table app.stock_counts enable row level security;
alter table app.stock_count_items enable row level security;
alter table app.bundles enable row level security;
alter table app.bundle_items enable row level security;
alter table app.store_bundles enable row level security;
alter table app.quick_access enable row level security;

create policy categories_read on app.categories for select to authenticated using ((select private.reads_account(account_id)));
create policy products_read on app.products for select to authenticated using ((select private.reads_account(account_id)));
create policy store_products_read on app.store_products for select to authenticated using ((select private.reads_store(store_id)));
create policy product_stock_read on app.product_stock for select to authenticated using ((select private.reads_store(store_id)));
create policy stock_lots_read on app.stock_lots for select to authenticated using ((select private.reads_store(store_id)));
create policy stock_movements_read on app.stock_movements for select to authenticated using ((select private.can(store_id, 'estoque')));
create policy stock_counts_read on app.stock_counts for select to authenticated using ((select private.can(store_id, 'estoque')));
create policy stock_count_items_read on app.stock_count_items for select to authenticated using ((select private.can(store_id, 'estoque')));
create policy bundles_read on app.bundles for select to authenticated using ((select private.reads_account(account_id)));
create policy bundle_items_read on app.bundle_items for select to authenticated using ((select private.reads_account(account_id)));
create policy store_bundles_read on app.store_bundles for select to authenticated using ((select private.reads_store(store_id)));
create policy quick_access_read on app.quick_access for select to authenticated using ((select private.reads_store(store_id)));

-- Custo (avg_cost, last_cost) fora do grant de coluna: só chega por RPC a quem tem ver_lucro (D63).
grant select (id, account_id, category_id, catalog_product_id, name, ean, unit, volume_ml, price, min_stock,
  active, image_path, created_at, updated_at) on app.products to authenticated;
grant select on app.categories, app.store_products, app.product_stock, app.stock_lots, app.bundles,
  app.bundle_items, app.store_bundles, app.quick_access to authenticated;
grant select (id, store_id, account_id, product_id, type, quantity, lot_id, ref_type, ref_id, reason,
  operator_member_id, created_by, created_at) on app.stock_movements to authenticated;
grant select on app.stock_counts, app.stock_count_items to authenticated;
grant all on app.categories, app.products, app.store_products, app.product_stock, app.stock_lots,
  app.stock_movements, app.stock_counts, app.stock_count_items, app.bundles, app.bundle_items,
  app.store_bundles, app.quick_access to service_role;
revoke update, delete, truncate on app.stock_movements from authenticated, service_role;

-- RPCs: catálogo e preço (E16) -----------------------------------------------------------------
create or replace function app.save_category(p_account_id uuid, p_name text, p_color text default null,
  p_sort int default 0, p_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_account(p_account_id, 'precos') then
    return private.err('FORBIDDEN');
  end if;
  if p_id is null then
    insert into app.categories (account_id, name, color, sort) values (p_account_id, trim(p_name), p_color, p_sort)
    on conflict (account_id, name) do update set color = excluded.color, sort = excluded.sort
    returning id into v_id;
  else
    update app.categories set name = trim(p_name), color = p_color, sort = p_sort
    where id = p_id and account_id = p_account_id returning id into v_id;
    if v_id is null then return private.err('CATEGORY_NOT_FOUND'); end if;
  end if;
  return private.ok(jsonb_build_object('category_id', v_id));
end;
$$;

-- Cria ou atualiza produto da conta. Campos ausentes no jsonb ficam como estão.
create or replace function app.save_product(p_account_id uuid, p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_product ->> 'id', '')::uuid;
  v_before jsonb;
  v_after jsonb;
  v_store uuid;
begin
  if not private.can_account(p_account_id, 'precos') then
    select s.id into v_store from app.stores s where s.account_id = p_account_id limit 1;
    perform private.audit_store('product.save', v_store, p_account_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if (p_product ? 'price') and (p_product ->> 'price')::bigint < 0 then
    return private.err('PRODUCT_PRICE');
  end if;
  if v_id is null and coalesce(length(trim(p_product ->> 'name')), 0) < 1 then
    return private.err('PRODUCT_NAME');
  end if;
  if nullif(p_product ->> 'ean', '') is not null and exists (
    select 1 from app.products where account_id = p_account_id and ean = p_product ->> 'ean'
      and id is distinct from v_id) then
    return private.err('PRODUCT_EAN_DUPLICATE');
  end if;

  if v_id is null then
    insert into app.products (account_id, category_id, catalog_product_id, name, ean, unit, volume_ml, price, min_stock, image_path)
    values (p_account_id, nullif(p_product ->> 'category_id', '')::uuid, nullif(p_product ->> 'catalog_product_id', '')::uuid,
      trim(p_product ->> 'name'), nullif(p_product ->> 'ean', ''), coalesce(p_product ->> 'unit', 'un'),
      nullif(p_product ->> 'volume_ml', '')::int, coalesce((p_product ->> 'price')::bigint, 0),
      coalesce((p_product ->> 'min_stock')::numeric, 0), p_product ->> 'image_path')
    returning id into v_id;
  else
    select jsonb_build_object('name', name, 'price', price, 'active', active) into v_before
    from app.products where id = v_id and account_id = p_account_id;
    if v_before is null then return private.err('PRODUCT_NOT_FOUND'); end if;
    update app.products set
      name = coalesce(nullif(trim(p_product ->> 'name'), ''), name),
      category_id = case when p_product ? 'category_id' then nullif(p_product ->> 'category_id', '')::uuid else category_id end,
      ean = case when p_product ? 'ean' then nullif(p_product ->> 'ean', '') else ean end,
      unit = coalesce(p_product ->> 'unit', unit),
      volume_ml = case when p_product ? 'volume_ml' then nullif(p_product ->> 'volume_ml', '')::int else volume_ml end,
      price = coalesce((p_product ->> 'price')::bigint, price),
      min_stock = coalesce((p_product ->> 'min_stock')::numeric, min_stock),
      active = coalesce((p_product ->> 'active')::boolean, active),
      image_path = case when p_product ? 'image_path' then p_product ->> 'image_path' else image_path end
    where id = v_id;
  end if;

  select jsonb_build_object('name', name, 'price', price, 'active', active) into v_after from app.products where id = v_id;
  select s.id into v_store from app.stores s where s.account_id = p_account_id order by s.created_at limit 1;
  perform private.audit_store(case when v_before is null then 'product.create' else 'product.update' end,
    v_store, p_account_id, 'product', v_id::text, v_before, v_after);
  return private.ok(jsonb_build_object('product_id', v_id));
end;
$$;

-- Preço, mínimo e "vende nesta loja" por loja. p_price nulo = volta ao padrão da conta (D37).
create or replace function app.set_store_product(p_store_id uuid, p_product_id uuid, p_price bigint default null,
  p_min_stock numeric default null, p_active boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_before bigint;
begin
  if not private.can(p_store_id, 'precos') then
    perform private.audit_store('product.store_price', p_store_id, p_outcome => 'denied', p_entity => 'product', p_entity_id => p_product_id::text);
    return private.err('FORBIDDEN');
  end if;
  if p_price is not null and p_price < 0 then
    return private.err('PRODUCT_PRICE');
  end if;
  select account_id into v_account from app.stores where id = p_store_id;
  select price into v_before from app.store_products where store_id = p_store_id and product_id = p_product_id;
  insert into app.store_products (store_id, product_id, account_id, price, min_stock, active)
  values (p_store_id, p_product_id, v_account, p_price, p_min_stock, coalesce(p_active, true))
  on conflict (store_id, product_id) do update set price = excluded.price, min_stock = excluded.min_stock,
    active = excluded.active, updated_at = now();
  perform private.audit_store('product.store_price', p_store_id, v_account, 'product', p_product_id::text,
    jsonb_build_object('price', v_before), jsonb_build_object('price', p_price));
  return private.ok(jsonb_build_object('effective_price', private.effective_price(p_store_id, p_product_id)));
end;
$$;

-- Lista de produtos da loja com preço efetivo e saldo; custo e margem só com ver_lucro (D63).
create or replace function app.store_products_list(p_store_id uuid, p_query text default null, p_only_active boolean default true)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.reads_store(p_store_id) then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'ean', p.ean, 'unit', p.unit, 'category_id', p.category_id,
      'price', coalesce(sp.price, p.price), 'store_price', sp.price, 'default_price', p.price,
      'stock', coalesce(ps.quantity, 0), 'min_stock', coalesce(sp.min_stock, p.min_stock),
      'below_min', coalesce(ps.quantity, 0) < coalesce(sp.min_stock, p.min_stock),
      'avg_cost', case when private.can(p_store_id, 'ver_lucro') then p.avg_cost end,
      'image_path', p.image_path
    ) order by p.name), '[]'::jsonb)) end
  from app.stores s
  join app.products p on p.account_id = s.account_id
  left join app.store_products sp on sp.product_id = p.id and sp.store_id = s.id
  left join app.product_stock ps on ps.product_id = p.id and ps.store_id = s.id
  where s.id = p_store_id
    and (not p_only_active or (p.active and coalesce(sp.active, true)))
    and (p_query is null or p.ean = p_query or p.name ilike '%' || p_query || '%');
$$;

-- Onboarding: produtos a partir do catálogo mestre, com estoque inicial na loja (E06/E16).
create or replace function app.add_products_from_catalog(p_store_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_item jsonb;
  v_cp platform.catalog_products;
  v_product uuid;
  v_count int := 0;
begin
  if not (private.can(p_store_id, 'precos') and private.can(p_store_id, 'estoque')) then
    return private.err('FORBIDDEN');
  end if;
  select account_id into v_account from app.stores where id = p_store_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_cp from platform.catalog_products where id = (v_item ->> 'catalog_id')::uuid and status = 'published';
    if not found then
      raise exception using errcode = 'P0001', message = 'CATALOG_ITEM_NOT_FOUND', detail = v_item ->> 'catalog_id';
    end if;
    select id into v_product from app.products where account_id = v_account and ean = v_cp.ean;
    if v_product is null then
      insert into app.products (account_id, catalog_product_id, name, ean, volume_ml, price, image_path)
      values (v_account, v_cp.id, v_cp.name, v_cp.ean, v_cp.volume_ml, coalesce((v_item ->> 'price')::bigint, 0), v_cp.image_path)
      returning id into v_product;
      v_count := v_count + 1;
    end if;
    if coalesce((v_item ->> 'initial_qty')::numeric, 0) <> 0 then
      perform private.move_stock(p_store_id, v_product, 'initial', (v_item ->> 'initial_qty')::numeric,
        nullif(v_item ->> 'unit_cost', '')::bigint, 'onboarding', null, 'Estoque inicial');
    end if;
  end loop;

  perform private.audit_store('product.import_catalog', p_store_id, v_account, 'product', null, null,
    jsonb_build_object('created', v_count, 'items', jsonb_array_length(p_items)));
  return private.ok(jsonb_build_object('created', v_count));
end;
$$;

-- RPCs: estoque (E17) -----------------------------------------------------------------------
-- Entrada de mercadoria. Itens: [{product_id, quantity, unit_cost, lot_code?, expires_on?}]
create or replace function app.receive_goods(p_store_id uuid, p_items jsonb, p_note text default null,
  p_supplier_id uuid default null, p_purchase_order_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_lot uuid;
  v_account uuid;
  v_ref uuid := gen_random_uuid();
begin
  if not private.can(p_store_id, 'estoque') then
    perform private.audit_store('stock.entry', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return private.err('STOCK_ITEMS_EMPTY');
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) i
             where coalesce((i ->> 'quantity')::numeric, 0) <= 0 or coalesce((i ->> 'unit_cost')::bigint, 0) < 0) then
    return private.err('STOCK_ITEM_INVALID');
  end if;
  select account_id into v_account from app.stores where id = p_store_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_lot := null;
    if nullif(v_item ->> 'expires_on', '') is not null or nullif(v_item ->> 'lot_code', '') is not null then
      insert into app.stock_lots (store_id, account_id, product_id, code, expires_on, initial_qty, remaining_qty)
      values (p_store_id, v_account, (v_item ->> 'product_id')::uuid, nullif(v_item ->> 'lot_code', ''),
        nullif(v_item ->> 'expires_on', '')::date, (v_item ->> 'quantity')::numeric, (v_item ->> 'quantity')::numeric)
      returning id into v_lot;
    end if;
    perform private.move_stock(p_store_id, (v_item ->> 'product_id')::uuid, 'entry', (v_item ->> 'quantity')::numeric,
      (v_item ->> 'unit_cost')::bigint, coalesce(case when p_purchase_order_id is not null then 'purchase_order' end, 'entry'),
      coalesce(p_purchase_order_id, v_ref), p_note, null, v_lot);
  end loop;

  perform private.audit_store('stock.entry', p_store_id, v_account, 'stock_entry', v_ref::text, null,
    jsonb_build_object('items', jsonb_array_length(p_items), 'supplier_id', p_supplier_id));
  return private.ok(jsonb_build_object('entry_id', v_ref));
end;
$$;

-- Perda (quebra, vencido, consumo, furto, outro) e ajuste manual: motivo obrigatório.
create or replace function app.register_stock_change(p_store_id uuid, p_product_id uuid, p_kind text,
  p_quantity numeric, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type app.stock_movement_type;
  v_qty numeric;
  v_mov uuid;
begin
  if not private.can(p_store_id, 'estoque') then
    perform private.audit_store('stock.change', p_store_id, p_outcome => 'denied', p_entity => 'product', p_entity_id => p_product_id::text);
    return private.err('FORBIDDEN');
  end if;
  if p_kind not in ('quebra', 'vencido', 'consumo', 'furto', 'outro', 'ajuste') then
    return private.err('STOCK_REASON_KIND');
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    return private.err('STOCK_REASON_REQUIRED');
  end if;
  if coalesce(p_quantity, 0) = 0 then
    return private.err('STOCK_ITEM_INVALID');
  end if;
  if not exists (select 1 from app.products p join app.stores s on s.account_id = p.account_id
                 where p.id = p_product_id and s.id = p_store_id) then
    return private.err('PRODUCT_NOT_FOUND');
  end if;

  if p_kind = 'ajuste' then
    v_type := 'adjustment'; v_qty := p_quantity;
  else
    v_type := 'loss'; v_qty := -abs(p_quantity);
  end if;
  v_mov := private.move_stock(p_store_id, p_product_id, v_type, v_qty, null, 'manual', null, p_kind || ': ' || trim(p_reason));
  perform private.audit_store('stock.' || v_type::text, p_store_id, null, 'product', p_product_id::text, null,
    jsonb_build_object('quantity', v_qty, 'kind', p_kind, 'reason', p_reason));
  return private.ok(jsonb_build_object('movement_id', v_mov));
end;
$$;

-- Transferência entre lojas da mesma conta, numa transação (E17, D37).
create or replace function app.transfer_stock(p_from_store uuid, p_to_store uuid, p_items jsonb, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_ref uuid := gen_random_uuid();
begin
  if p_from_store = p_to_store then
    return private.err('TRANSFER_SAME_STORE');
  end if;
  if not (private.can(p_from_store, 'estoque') and private.can(p_to_store, 'estoque')) then
    perform private.audit_store('stock.transfer', p_from_store, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if (select count(distinct account_id) from app.stores where id in (p_from_store, p_to_store)) <> 1 then
    return private.err('TRANSFER_OTHER_ACCOUNT');
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) i where coalesce((i ->> 'quantity')::numeric, 0) <= 0) then
    return private.err('STOCK_ITEM_INVALID');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    perform private.move_stock(p_from_store, (v_item ->> 'product_id')::uuid, 'transfer_out', -(v_item ->> 'quantity')::numeric,
      null, 'transfer', v_ref, p_note);
    perform private.move_stock(p_to_store, (v_item ->> 'product_id')::uuid, 'transfer_in', (v_item ->> 'quantity')::numeric,
      null, 'transfer', v_ref, p_note);
  end loop;
  perform private.audit_store('stock.transfer', p_from_store, null, 'transfer', v_ref::text, null,
    jsonb_build_object('to_store', p_to_store, 'items', p_items));
  return private.ok(jsonb_build_object('transfer_id', v_ref));
end;
$$;

create or replace function app.open_stock_count(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can(p_store_id, 'estoque') then
    return private.err('FORBIDDEN');
  end if;
  insert into app.stock_counts (store_id) values (p_store_id) returning id into v_id;
  return private.ok(jsonb_build_object('count_id', v_id));
end;
$$;

-- Grava o que foi contado e o saldo do sistema NAQUELE momento (vendas durante a contagem não distorcem).
create or replace function app.save_count_item(p_count_id uuid, p_product_id uuid, p_counted numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
begin
  select store_id into v_store from app.stock_counts where id = p_count_id and status = 'open';
  if v_store is null then
    return private.err('COUNT_NOT_OPEN');
  end if;
  if not private.can(v_store, 'estoque') then
    return private.err('FORBIDDEN');
  end if;
  if p_counted is null or p_counted < 0 then
    return private.err('STOCK_ITEM_INVALID');
  end if;
  insert into app.stock_count_items (count_id, store_id, product_id, counted_qty, system_qty_at_count)
  values (p_count_id, v_store, p_product_id, p_counted,
    coalesce((select quantity from app.product_stock where store_id = v_store and product_id = p_product_id), 0))
  on conflict (count_id, product_id) do update set counted_qty = excluded.counted_qty,
    system_qty_at_count = excluded.system_qty_at_count, counted_at = now();
  return private.ok();
end;
$$;

create or replace function app.apply_stock_count(p_count_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
  v_item record;
  v_n int := 0;
begin
  select store_id into v_store from app.stock_counts where id = p_count_id and status = 'open' for update;
  if v_store is null then
    return private.err('COUNT_NOT_OPEN');
  end if;
  if not private.can(v_store, 'estoque') then
    perform private.audit_store('stock.count_apply', v_store, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  for v_item in select * from app.stock_count_items where count_id = p_count_id loop
    if v_item.counted_qty <> v_item.system_qty_at_count then
      perform private.move_stock(v_store, v_item.product_id, 'count_adjustment',
        v_item.counted_qty - v_item.system_qty_at_count, null, 'stock_count', p_count_id, 'Contagem');
      v_n := v_n + 1;
    end if;
  end loop;
  update app.stock_counts set status = 'applied', applied_at = now() where id = p_count_id;
  perform private.audit_store('stock.count_apply', v_store, null, 'stock_count', p_count_id::text, null,
    jsonb_build_object('adjusted_items', v_n));
  return private.ok(jsonb_build_object('adjusted_items', v_n));
end;
$$;

-- RPCs: combos e promoções (E18, E29) ------------------------------------------------------
-- p_bundle: {id?, kind, name, price, active, starts_at, ends_at, weekdays, start_time, end_time,
--            show_in_catalog, items:[{product_id, quantity}]}
create or replace function app.save_bundle(p_account_id uuid, p_bundle jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_bundle ->> 'id', '')::uuid;
begin
  if not private.can_account(p_account_id, 'precos') then
    return private.err('FORBIDDEN');
  end if;
  if jsonb_typeof(p_bundle -> 'items') <> 'array' or jsonb_array_length(p_bundle -> 'items') = 0 then
    return private.err('BUNDLE_ITEMS_EMPTY');
  end if;
  if coalesce((p_bundle ->> 'price')::bigint, -1) < 0 then
    return private.err('BUNDLE_PRICE');
  end if;

  if v_id is null then
    insert into app.bundles (account_id, kind, name, price) values (p_account_id, coalesce(p_bundle ->> 'kind', 'combo'),
      trim(p_bundle ->> 'name'), (p_bundle ->> 'price')::bigint) returning id into v_id;
  elsif not exists (select 1 from app.bundles where id = v_id and account_id = p_account_id) then
    return private.err('BUNDLE_NOT_FOUND');
  end if;

  update app.bundles set
    kind = coalesce(p_bundle ->> 'kind', kind),
    name = coalesce(nullif(trim(p_bundle ->> 'name'), ''), name),
    price = (p_bundle ->> 'price')::bigint,
    active = coalesce((p_bundle ->> 'active')::boolean, active),
    starts_at = nullif(p_bundle ->> 'starts_at', '')::timestamptz,
    ends_at = nullif(p_bundle ->> 'ends_at', '')::timestamptz,
    weekdays = case when p_bundle ? 'weekdays' and jsonb_typeof(p_bundle -> 'weekdays') = 'array'
                    then array(select jsonb_array_elements_text(p_bundle -> 'weekdays')::int) end,
    start_time = nullif(p_bundle ->> 'start_time', '')::time,
    end_time = nullif(p_bundle ->> 'end_time', '')::time,
    show_in_catalog = coalesce((p_bundle ->> 'show_in_catalog')::boolean, show_in_catalog)
  where id = v_id;

  delete from app.bundle_items where bundle_id = v_id;
  insert into app.bundle_items (bundle_id, account_id, product_id, quantity)
  select v_id, p_account_id, (i ->> 'product_id')::uuid, (i ->> 'quantity')::numeric
  from jsonb_array_elements(p_bundle -> 'items') i;

  return private.ok(jsonb_build_object('bundle_id', v_id));
end;
$$;

create or replace function app.set_quick_access(p_store_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can(p_store_id, 'precos') then
    return private.err('FORBIDDEN');
  end if;
  delete from app.quick_access where store_id = p_store_id;
  insert into app.quick_access (store_id, position, product_id, bundle_id, color)
  select p_store_id, (i ->> 'position')::int, nullif(i ->> 'product_id', '')::uuid, nullif(i ->> 'bundle_id', '')::uuid, i ->> 'color'
  from jsonb_array_elements(p_items) i;
  return private.ok();
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'app.search_catalog(text, int)', 'app.save_category(uuid, text, text, int, uuid)', 'app.save_product(uuid, jsonb)',
    'app.set_store_product(uuid, uuid, bigint, numeric, boolean)', 'app.store_products_list(uuid, text, boolean)',
    'app.add_products_from_catalog(uuid, jsonb)', 'app.receive_goods(uuid, jsonb, text, uuid, uuid)',
    'app.register_stock_change(uuid, uuid, text, numeric, text)', 'app.transfer_stock(uuid, uuid, jsonb, text)',
    'app.open_stock_count(uuid)', 'app.save_count_item(uuid, uuid, numeric)', 'app.apply_stock_count(uuid)',
    'app.save_bundle(uuid, jsonb)', 'app.set_quick_access(uuid, jsonb)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
