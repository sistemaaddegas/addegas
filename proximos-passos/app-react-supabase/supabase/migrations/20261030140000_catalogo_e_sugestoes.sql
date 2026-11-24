-- E39 · Repositório de produtos nos dois sentidos.
-- 1) A adega usa o catálogo Addegas: busca, importa com categoria e, ao cadastrar com um código de barras que já
--    está no catálogo, o produto fica ligado a ele sozinho.
-- 2) Produto que a adega cria fora do catálogo entra numa fila de sugestões; a equipe aprova (vira produto do
--    catálogo e a adega fica ligada a ele), liga a um produto que já existe, ou recusa com motivo.

create table platform.catalog_suggestions (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity,
  account_id uuid not null references app.accounts (id),
  product_id uuid not null unique references app.products (id) on delete cascade,
  name text not null,
  ean text,
  volume_ml int,
  category_name text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'vinculada', 'recusada')),
  catalog_product_id uuid references platform.catalog_products (id),
  reason text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table platform.catalog_suggestions enable row level security;
create index catalog_suggestions_status_idx on platform.catalog_suggestions (status, created_at);
create index catalog_suggestions_account_idx on platform.catalog_suggestions (account_id);
create index catalog_suggestions_catalog_idx on platform.catalog_suggestions (catalog_product_id);
create index catalog_suggestions_reviewed_by_idx on platform.catalog_suggestions (reviewed_by);

-- Código de barras que já está publicado no catálogo: liga na hora.
create or replace function private.product_link_catalog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.catalog_product_id is null and new.ean is not null then
    select id into new.catalog_product_id from platform.catalog_products where ean = new.ean and status = 'published' limit 1;
  end if;
  return new;
end;
$$;
create trigger products_link_catalog before insert on app.products for each row execute function private.product_link_catalog();

-- O que ficou fora do catálogo vira sugestão para a equipe.
create or replace function private.product_suggest_catalog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.catalog_product_id is null then
    insert into platform.catalog_suggestions (account_id, product_id, name, ean, volume_ml, category_name)
    values (new.account_id, new.id, new.name, new.ean, new.volume_ml,
      (select c.name from app.categories c where c.id = new.category_id))
    on conflict (product_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger products_suggest_catalog after insert on app.products for each row execute function private.product_suggest_catalog();

-- Produtos que já existiam: liga pelo código de barras e manda o resto para a fila.
update app.products p set catalog_product_id = c.id
from platform.catalog_products c
where p.catalog_product_id is null and p.ean is not null and c.ean = p.ean and c.status = 'published';
insert into platform.catalog_suggestions (account_id, product_id, name, ean, volume_ml, category_name, created_at)
select p.account_id, p.id, p.name, p.ean, p.volume_ml, (select c.name from app.categories c where c.id = p.category_id), p.created_at
from app.products p where p.catalog_product_id is null
on conflict (product_id) do nothing;

-- Importar do catálogo também traz a categoria (quando a adega tem uma com o mesmo nome).
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
  v_skipped int := 0;
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
    if coalesce((v_item ->> 'price')::bigint, 0) < 0 then
      raise exception using errcode = 'P0001', message = 'PRODUCT_PRICE';
    end if;
    select id into v_product from app.products
    where account_id = v_account and (catalog_product_id = v_cp.id or (v_cp.ean is not null and ean = v_cp.ean));
    if v_product is null then
      insert into app.products (account_id, catalog_product_id, category_id, name, ean, volume_ml, price, image_path)
      values (v_account, v_cp.id,
        (select c.id from app.categories c where c.account_id = v_account and lower(c.name) = lower(v_cp.suggested_category) limit 1),
        v_cp.name, v_cp.ean, v_cp.volume_ml, coalesce((v_item ->> 'price')::bigint, 0), v_cp.image_path)
      returning id into v_product;
      v_count := v_count + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
    if coalesce((v_item ->> 'initial_qty')::numeric, 0) <> 0 then
      perform private.move_stock(p_store_id, v_product, 'initial', (v_item ->> 'initial_qty')::numeric,
        nullif(v_item ->> 'unit_cost', '')::bigint, 'onboarding', null, 'Estoque inicial');
    end if;
  end loop;

  perform private.audit_store('product.import_catalog', p_store_id, v_account, 'product', null, null,
    jsonb_build_object('created', v_count, 'already', v_skipped, 'items', jsonb_array_length(p_items)));
  return private.ok(jsonb_build_object('created', v_count, 'already', v_skipped));
end;
$$;

-- Busca do catálogo para a adega, dizendo o que ela já tem.
create or replace function app.search_catalog_for_store(p_store_id uuid, p_query text, p_limit int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account uuid;
  v_q text := trim(coalesce(p_query, ''));
begin
  if not private.is_store_member(p_store_id) then return private.err('FORBIDDEN'); end if;
  select account_id into v_account from app.stores where id = p_store_id;
  return private.ok(coalesce((
    select jsonb_agg(to_jsonb(c) order by c.score desc, c.name)
    from (
      select cp.id, cp.ean, cp.name, cp.brand, cp.volume_ml, cp.unit, cp.packaging, cp.suggested_category as category, cp.image_path,
        case when v_q = '' then 0 else extensions.similarity(cp.name, v_q) end as score,
        exists (select 1 from app.products p where p.account_id = v_account
                and (p.catalog_product_id = cp.id or (cp.ean is not null and p.ean = cp.ean))) as already
      from platform.catalog_products cp
      where cp.status = 'published'
        and (v_q = '' or cp.ean = v_q or cp.name operator(extensions.%) v_q or cp.name ilike '%' || v_q || '%'
             or cp.brand ilike '%' || v_q || '%' or cp.suggested_category ilike '%' || v_q || '%')
      order by score desc, cp.name
      limit least(greatest(p_limit, 1), 100)
    ) c), '[]'::jsonb));
end;
$$;
revoke execute on function app.search_catalog_for_store(uuid, text, int) from public, anon;
grant execute on function app.search_catalog_for_store(uuid, text, int) to authenticated;

-- Situação de cada produto da adega no catálogo (para a tela de Estoque).
create or replace function app.catalog_status(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.can_account(p_account_id, 'estoque') and not private.can_account(p_account_id, 'precos')
    then private.err('FORBIDDEN') else private.ok(coalesce((
      select jsonb_object_agg(p.id, coalesce(case when p.catalog_product_id is not null then 'catalogo' end, s.status, 'local'))
      from app.products p left join platform.catalog_suggestions s on s.product_id = p.id
      where p.account_id = p_account_id), '{}'::jsonb)) end;
$$;
revoke execute on function app.catalog_status(uuid) from public, anon;
grant execute on function app.catalog_status(uuid) to authenticated;

-- Equipe: aprovar (cria o produto no catálogo), ligar a um que já existe ou recusar.
create or replace function private.admin_catalog_suggestion(p_staff uuid, p_role text, p_id uuid, p_action text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s platform.catalog_suggestions;
  v_cat uuid;
  v_ean text;
  v_r jsonb;
begin
  select * into v_s from platform.catalog_suggestions where id = p_id for update;
  if not found then return private.err('SUGGESTION_NOT_FOUND'); end if;
  if v_s.status <> 'pendente' then return private.err('SUGGESTION_ALREADY_REVIEWED'); end if;
  if p_action = 'approve' then
    v_ean := nullif(regexp_replace(coalesce(p ->> 'ean', v_s.ean, ''), '\D', '', 'g'), '');
    v_r := private.admin_catalog_save(p_staff, p_role, jsonb_build_object(
      'name', coalesce(nullif(trim(p ->> 'name'), ''), v_s.name), 'brand', p ->> 'brand', 'ean', v_ean,
      'category', coalesce(nullif(p ->> 'category', ''), v_s.category_name), 'volume', coalesce(nullif(p ->> 'volume', ''), v_s.volume_ml::text),
      'unit', coalesce(nullif(p ->> 'unit', ''), 'ml'), 'origin', 'Sugestão de adega',
      'status', case when v_ean is not null and coalesce((p ->> 'publish')::boolean, true) then 'published' else 'draft' end));
    if not (v_r ->> 'ok')::boolean then return v_r; end if;
    v_cat := (v_r -> 'data' ->> 'catalog_product_id')::uuid;
  elsif p_action = 'link' then
    v_cat := nullif(p ->> 'catalog_id', '')::uuid;
    if not exists (select 1 from platform.catalog_products where id = v_cat and status <> 'archived') then return private.err('CATALOG_NOT_FOUND'); end if;
  elsif p_action = 'reject' then
    if length(trim(coalesce(p ->> 'reason', ''))) < 3 then return private.err('REASON_REQUIRED'); end if;
    update platform.catalog_suggestions set status = 'recusada', reason = trim(p ->> 'reason'), reviewed_by = p_staff, reviewed_at = now() where id = v_s.id;
    perform private.audit_admin(p_staff, p_role, 'catalog.write', v_s.account_id, 'catalog_suggestion', v_s.id::text, null,
      jsonb_build_object('status', 'recusada'), p ->> 'reason');
    return private.ok();
  else
    return private.err('SUGGESTION_ACTION_INVALID');
  end if;
  -- Aprovada ou ligada: o produto da adega (e qualquer outro sem vínculo com o mesmo código) passa a usar o catálogo.
  update app.products set catalog_product_id = v_cat
  where catalog_product_id is null and (id = v_s.product_id or (v_s.ean is not null and ean = v_s.ean));
  update platform.catalog_suggestions set status = case when p_action = 'approve' then 'aprovada' else 'vinculada' end,
    catalog_product_id = v_cat, reviewed_by = p_staff, reviewed_at = now()
  where status = 'pendente' and (id = v_s.id or (v_s.ean is not null and ean = v_s.ean));
  perform private.audit_admin(p_staff, p_role, 'catalog.write', v_s.account_id, 'catalog_suggestion', v_s.id::text, null,
    jsonb_build_object('status', p_action, 'catalog_product_id', v_cat));
  return private.ok(jsonb_build_object('catalog_product_id', v_cat));
end;
$$;
revoke execute on function private.admin_catalog_suggestion(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.admin_catalog_suggestion(uuid, text, uuid, text, jsonb) to service_role;

-- Fila para o painel (Repositório de produtos → Sugestões das adegas).
create or replace function private.admin_catalog_suggestions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'account_id', s.account_id, 'account', a.name,
    'product_id', s.product_id, 'name', s.name, 'ean', s.ean, 'volume_ml', s.volume_ml, 'category', s.category_name,
    'status', s.status, 'catalog_product_id', s.catalog_product_id, 'reason', s.reason, 'created_at', s.created_at,
    'reviewed_at', s.reviewed_at, 'who', (select name from platform.staff where user_id = s.reviewed_by),
    'same_ean', (select count(*) from platform.catalog_suggestions o where o.ean = s.ean and o.id <> s.id and o.status = 'pendente'))
    order by s.status <> 'pendente', s.created_at desc), '[]'::jsonb)
  from platform.catalog_suggestions s join app.accounts a on a.id = s.account_id;
$$;
revoke execute on function private.admin_catalog_suggestions() from public, anon, authenticated;
grant execute on function private.admin_catalog_suggestions() to service_role;

-- Funções de gatilho: ninguém chama direto.
revoke execute on function private.product_link_catalog() from public, anon, authenticated;
revoke execute on function private.product_suggest_catalog() from public, anon, authenticated;
