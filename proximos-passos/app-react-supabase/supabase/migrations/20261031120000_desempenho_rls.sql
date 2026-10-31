-- Desempenho das leituras com RLS.
--
-- As políticas chamavam private.can(store_id, ...) e parentes para cada linha lida: 34 fornecedores levavam 87 ms e
-- a lista crescia com o volume de todas as adegas juntas (as consultas sem filtro de loja varriam tudo). Agora cada
-- política compara a coluna com o conjunto de lojas ou contas que a pessoa pode ver, calculado uma vez por consulta
-- com as mesmas funções de antes (private.can, is_store_member...). Quem vê o quê não muda.

-- Conjuntos, sempre a partir dos vínculos da própria pessoa (poucas linhas) ------------------------------------
create function private.stores_can(p_permission text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.store_id from app.store_members m
  where m.user_id = (select auth.uid()) and m.active and private.can(m.store_id, p_permission);
$$;

create function private.accounts_can(p_permission text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct s.account_id from app.stores s where s.id in (select private.stores_can(p_permission));
$$;

-- Mesma regra de private.is_store_member.
create function private.my_stores()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.store_id from app.store_members m join app.stores s on s.id = m.store_id
  where m.user_id = (select auth.uid()) and m.active and s.archived_at is null and not private.password_pending();
$$;

-- Mesma regra de private.reads_store: membro da loja ou o aparelho do caixa da loja.
create function private.readable_stores()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.my_stores() union select t from private.terminal_store() t where t is not null;
$$;

-- Mesma regra de private.is_account_member.
create function private.my_accounts()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.account_id from app.store_members m join app.stores s on s.id = m.store_id
  where m.user_id = (select auth.uid()) and m.active and not private.password_pending()
  union
  select a.id from app.accounts a where a.owner_user_id = (select auth.uid()) and not private.password_pending();
$$;

-- Mesma regra de private.reads_account.
create function private.readable_accounts()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.my_accounts() union select t from private.terminal_account() t where t is not null;
$$;

-- Pedidos (private.reads_order): quem tem "pedidos" e não é entregador vê a loja toda; o entregador, só os dele.
create function private.order_stores_full()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.store_id from app.store_members m
  where m.user_id = (select auth.uid()) and m.active and m.role <> 'courier' and private.can(m.store_id, 'pedidos');
$$;

create function private.order_courier_members()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from app.store_members m
  where m.user_id = (select auth.uid()) and m.active and m.role = 'courier' and private.can(m.store_id, 'pedidos');
$$;

revoke execute on function private.stores_can(text), private.accounts_can(text), private.my_stores(), private.readable_stores(),
  private.my_accounts(), private.readable_accounts(), private.order_stores_full(), private.order_courier_members() from public, anon;
grant execute on function private.stores_can(text), private.accounts_can(text), private.my_stores(), private.readable_stores(),
  private.my_accounts(), private.readable_accounts(), private.order_stores_full(), private.order_courier_members() to authenticated, service_role;

-- Políticas de leitura -------------------------------------------------------------------------------------------
alter policy accounts_select on app.accounts using (id in (select private.my_accounts()));
alter policy alert_recipients_read on app.alert_recipients using (store_id in (select private.stores_can('ajustes')));
alter policy alert_settings_read on app.alert_settings using (store_id in (select private.my_stores()));
alter policy alerts_read on app.alerts using (store_id in (select private.my_stores()));
alter policy bills_read on app.bills using (store_id in (select private.stores_can('contas')));
alter policy bundle_items_read on app.bundle_items using (account_id in (select private.readable_accounts()));
alter policy bundles_read on app.bundles using (account_id in (select private.readable_accounts()));
alter policy cash_sessions_read on app.cash_sessions using (
  store_id in (select private.stores_can('caixa')) or store_id in (select private.stores_can('relatorios'))
  or terminal_id = (select (private.current_terminal()).id));
alter policy catalog_settings_read on app.catalog_settings using (store_id in (select private.my_stores()));
alter policy categories_read on app.categories using (account_id in (select private.readable_accounts()));
alter policy drink_recipe_items_read on app.drink_recipe_items using (account_id in (select private.accounts_can('ferramentas')));
alter policy drink_recipes_read on app.drink_recipes using (account_id in (select private.accounts_can('ferramentas')));
alter policy fiado_accounts_read on app.fiado_accounts using (
  store_id in (select private.stores_can('fiado')) or store_id in (select private.stores_can('fiado_receber'))
  or store_id = (select private.terminal_store()));
alter policy fiado_ledger_read on app.fiado_ledger using (
  store_id in (select private.stores_can('fiado_receber')) or store_id in (select private.stores_can('fiado_ajustar')));
alter policy notes_select on app.notes using (store_id in (select private.my_stores()));
alter policy operator_sessions_select on app.operator_sessions using (
  store_id in (select private.stores_can('caixa')) or terminal_id = (select (private.current_terminal()).id));
alter policy orders_read on app.orders using (
  store_id = (select private.terminal_store()) or store_id in (select private.order_stores_full())
  or courier_member_id in (select private.order_courier_members()));
alter policy printer_settings_read on app.printer_settings using (store_id in (select private.readable_stores()));
alter policy product_stock_read on app.product_stock using (store_id in (select private.readable_stores()));
alter policy products_read on app.products using (account_id in (select private.readable_accounts()));
alter policy purchase_order_items_read on app.purchase_order_items using (store_id in (select private.stores_can('compras')));
alter policy purchase_orders_read on app.purchase_orders using (store_id in (select private.stores_can('compras')));
alter policy quick_access_read on app.quick_access using (store_id in (select private.readable_stores()));
alter policy role_permissions_select on app.role_permissions using (store_id in (select private.my_stores()));
alter policy role_settings_select on app.role_settings using (store_id in (select private.my_stores()));
alter policy sales_read on app.sales using (
  store_id in (select private.stores_can('relatorios')) or terminal_id = (select (private.current_terminal()).id));
alter policy stock_count_items_read on app.stock_count_items using (store_id in (select private.stores_can('estoque')));
alter policy stock_counts_read on app.stock_counts using (store_id in (select private.stores_can('estoque')));
alter policy stock_lots_read on app.stock_lots using (store_id in (select private.readable_stores()));
alter policy stock_movements_read on app.stock_movements using (store_id in (select private.stores_can('estoque')));
alter policy store_bundles_read on app.store_bundles using (store_id in (select private.readable_stores()));
alter policy store_members_select on app.store_members using (
  store_id in (select private.my_stores()) or store_id = (select private.terminal_store()));
alter policy store_products_read on app.store_products using (store_id in (select private.readable_stores()));
alter policy store_settings_select on app.store_settings using (
  store_id in (select private.my_stores()) or store_id = (select private.terminal_store()));
alter policy stores_select on app.stores using (
  id in (select private.my_stores()) or id = (select private.terminal_store())
  or exists (select 1 from app.accounts a where a.id = stores.account_id and a.owner_user_id = (select auth.uid())));
alter policy suppliers_read on app.suppliers using (account_id in (select private.accounts_can('compras')));
alter policy tab_items_read on app.tab_items using (store_id in (select private.readable_stores()));
alter policy tabs_read on app.tabs using (store_id in (select private.readable_stores()));
alter policy terminals_select on app.terminals using (
  store_id in (select private.my_stores()) or id = (select (private.current_terminal()).id));

-- Lista de produtos: "pode ver o custo" era conferido produto a produto; agora uma vez só.
create or replace function app.store_products_list(p_store_id uuid, p_query text default null, p_only_active boolean default true)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with perm as (select private.reads_store(p_store_id) le, private.can(p_store_id, 'ver_lucro') lucro)
  select case when not (select le from perm) then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object(
      'product_id', p.id, 'name', p.name, 'ean', p.ean, 'unit', p.unit, 'category_id', p.category_id,
      'price', coalesce(sp.price, p.price), 'store_price', sp.price, 'default_price', p.price,
      'stock', coalesce(ps.quantity, 0), 'min_stock', coalesce(sp.min_stock, p.min_stock),
      'below_min', coalesce(ps.quantity, 0) < coalesce(sp.min_stock, p.min_stock),
      'avg_cost', case when (select lucro from perm) then p.avg_cost end,
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
