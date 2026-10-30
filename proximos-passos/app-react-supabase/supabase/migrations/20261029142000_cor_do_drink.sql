-- Lucro no Copo: cor de fundo do drink salvo ("Cor de fundo de …" no protótipo).
alter table app.drink_recipes add column color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

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
  -- Só a cor: troca sem mexer nos itens.
  if v_id is not null and p_recipe ? 'color' and not p_recipe ? 'items' then
    update app.drink_recipes set color = nullif(p_recipe ->> 'color', '') where id = v_id and account_id = p_account_id;
    if not found then return private.err('RECIPE_NOT_FOUND'); end if;
    return private.ok(jsonb_build_object('recipe_id', v_id));
  end if;
  if jsonb_typeof(p_recipe -> 'items') <> 'array' or jsonb_array_length(p_recipe -> 'items') = 0 then
    return private.err('RECIPE_ITEMS_EMPTY');
  end if;
  if v_id is null then
    insert into app.drink_recipes (account_id, name, sale_price, color) values (p_account_id, trim(p_recipe ->> 'name'),
      coalesce((p_recipe ->> 'sale_price')::bigint, 0), nullif(p_recipe ->> 'color', '')) returning id into v_id;
  else
    update app.drink_recipes set name = coalesce(nullif(trim(p_recipe ->> 'name'), ''), name),
      sale_price = coalesce((p_recipe ->> 'sale_price')::bigint, sale_price),
      color = case when p_recipe ? 'color' then nullif(p_recipe ->> 'color', '') else color end
    where id = v_id and account_id = p_account_id;
    if not found then return private.err('RECIPE_NOT_FOUND'); end if;
    delete from app.drink_recipe_items where recipe_id = v_id;
  end if;
  insert into app.drink_recipe_items (recipe_id, account_id, product_id, amount, unit)
  select v_id, p_account_id, (i ->> 'product_id')::uuid, (i ->> 'amount')::numeric, coalesce(i ->> 'unit', 'ml')
  from jsonb_array_elements(p_recipe -> 'items') i;
  return private.ok(jsonb_build_object('recipe_id', v_id));
end;
$$;
