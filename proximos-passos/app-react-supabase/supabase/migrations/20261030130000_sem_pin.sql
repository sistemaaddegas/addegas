-- Sem PIN no sistema (decisão do dono do produto em 30/10/2026; substitui D13 e a liberação por PIN da D05).
-- No caixa, quem vai vender toca no próprio nome: sem PIN, sem travas por tentativa e sem token de liberação.
-- O limite de desconto por função continua (o dono configura em Equipe); acima dele, vende quem tem limite.

-- Venda: sai a liberação por token (o resto da função é o mesmo texto de antes).
CREATE OR REPLACE FUNCTION private.finalize_sale(p jsonb, p_tab_id uuid DEFAULT NULL::uuid, p_order_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_order record;
  v_order_channel text;
  v_order_status text;
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
  if p_order_id is not null then
    select * into v_order from app.orders where id = p_order_id and store_id = v_store and status not in ('completed', 'rejected', 'canceled');
    if not found then
      return private.err('ORDER_NOT_OPEN');
    end if;
    v_fee := v_order.delivery_fee;
    v_order_channel := v_order.channel;
    v_order_status := v_order.status;
    for v_it in select oi.product_id, oi.bundle_id, oi.name, oi.quantity qty, oi.unit_price from app.order_items oi where oi.order_id = p_order_id loop
      v_items := v_items || jsonb_build_object('product_id', v_it.product_id, 'bundle_id', v_it.bundle_id,
        'name', v_it.name, 'quantity', v_it.qty, 'unit_price', v_it.unit_price, 'from_tab', v_order.stock_moved);
    end loop;
  elsif p_tab_id is not null then
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
      perform private.audit_store('sale.discount', v_store, v_account, p_outcome => 'denied',
        p_after => jsonb_build_object('pct', v_pct), p_operator_member_id => v_op.id);
      return private.err('SALE_DISCOUNT_FORBIDDEN', format('%s%% acima do limite', v_pct));
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
    p_order_id, coalesce(v_order_channel, nullif(p ->> 'channel', ''), 'counter'), v_subtotal, v_discount, v_fee,
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
  if p_order_id is not null then
    update app.orders set status = 'completed', completed_at = now(), sale_id = v_sale where id = p_order_id;
    insert into app.order_events (order_id, store_id, from_status, to_status, actor_user, origin)
    values (p_order_id, v_store, v_order_status, 'completed', (select auth.uid()), 'store');
  end if;

  if v_discount > 0 then
    perform private.audit_store('sale.discount', v_store, v_account, 'sale', v_sale::text, null,
      jsonb_build_object('pct', v_pct, 'amount', v_discount, 'authorized_by', v_authorized), p_operator_member_id => v_op.id);
  end if;

  return private.ok(jsonb_build_object('sale_id', v_sale, 'number', v_number, 'total', v_total, 'change', v_change,
    'sold_without_stock', coalesce(v_short, '[]'::jsonb), 'replayed', false));
end;
$function$;

-- Entrar no caixa: só o operador escolhido (ativo e da loja do aparelho).
drop function app.operator_login(uuid, text);
create function app.operator_login(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t app.terminals := private.current_terminal();
  v_m app.store_members;
  v_session uuid;
begin
  if v_t.id is null then
    return private.err('TERMINAL_REQUIRED');
  end if;
  select * into v_m from app.store_members where id = p_member_id and store_id = v_t.store_id and active and role <> 'courier';
  if not found then
    return private.err('OPERATOR_INVALID');
  end if;
  update app.operator_sessions set ended_at = now(), end_reason = 'switched'
  where terminal_id = v_t.id and ended_at is null;
  insert into app.operator_sessions (store_id, terminal_id, member_id) values (v_t.store_id, v_t.id, v_m.id)
  returning id into v_session;
  update app.terminals set last_seen_at = now() where id = v_t.id;
  return private.ok(jsonb_build_object('operator_session_id', v_session, 'member_id', v_m.id,
    'name', v_m.display_name, 'role', v_m.role));
end;
$$;
revoke execute on function app.operator_login(uuid) from public, anon;
grant execute on function app.operator_login(uuid) to authenticated;

-- Pessoa só do caixa (sem login no sistema): nome e função, mais nada.
drop function app.create_pin_member(uuid, text, app.member_role, text);
create function app.create_counter_member(p_store_id uuid, p_display_name text, p_role app.member_role)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
begin
  if not private.can_manage_role(p_store_id, p_role) then
    perform private.audit_store('member.create', p_store_id, p_outcome => 'denied', p_entity => 'role', p_entity_id => p_role::text);
    return private.err('FORBIDDEN');
  end if;
  if length(trim(coalesce(p_display_name, ''))) < 1 then
    return private.err('MEMBER_NAME');
  end if;
  insert into app.store_members (store_id, user_id, display_name, role)
  values (p_store_id, null, trim(p_display_name), p_role) returning id into v_member;
  perform private.audit_store('member.create', p_store_id, null, 'store_member', v_member::text, null,
    jsonb_build_object('name', p_display_name, 'role', p_role, 'login', false));
  return private.ok(jsonb_build_object('member_id', v_member));
end;
$$;
revoke execute on function app.create_counter_member(uuid, text, app.member_role) from public, anon;
grant execute on function app.create_counter_member(uuid, text, app.member_role) to authenticated;

-- O que só existia por causa do PIN.
drop function app.authorize_override(uuid, text, text, numeric);
drop function private.consume_override(uuid, uuid, numeric);
drop function app.set_member_pin(uuid, text);
drop function private.pin_is_acceptable(text);
drop table private.override_tokens;
drop table private.pin_attempts;
drop table private.member_pins;
