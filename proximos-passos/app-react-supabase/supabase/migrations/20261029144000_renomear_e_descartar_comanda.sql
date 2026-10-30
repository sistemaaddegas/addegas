-- E22 · No protótipo a mesa ou comanda se renomeia no carrinho ("Mesa 4" → "Mesa do João") e a vazia sai com o ×.

create or replace function app.rename_tab(p_operator_session_id uuid, p_tab_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_tab app.tabs;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'vender') then
    return private.err('FORBIDDEN');
  end if;
  select * into v_tab from app.tabs where id = p_tab_id and store_id = v_op.store_id and status = 'open' for update;
  if not found then
    return private.err('TAB_NOT_OPEN');
  end if;
  if length(trim(coalesce(p_label, ''))) not between 1 and 30 then
    return private.err('TAB_INVALID');
  end if;
  if exists (select 1 from app.tabs where store_id = v_tab.store_id and kind = v_tab.kind and id <> v_tab.id
             and lower(label) = lower(trim(p_label)) and status = 'open') then
    return private.err('TAB_ALREADY_OPEN');
  end if;
  update app.tabs set label = trim(p_label) where id = v_tab.id;
  return private.ok();
end;
$$;

-- Só descarta a que não tem nada lançado (o que foi lançado e tirado já voltou ao estoque, com motivo).
create or replace function app.discard_empty_tab(p_operator_session_id uuid, p_tab_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op app.store_members := private.operator(p_operator_session_id);
  v_tab app.tabs;
begin
  if v_op.id is null then
    return private.err('SALE_OPERATOR_INVALID');
  end if;
  if not private.operator_can(p_operator_session_id, 'vender') then
    return private.err('FORBIDDEN');
  end if;
  select * into v_tab from app.tabs where id = p_tab_id and store_id = v_op.store_id and status = 'open' for update;
  if not found then
    return private.err('TAB_NOT_OPEN');
  end if;
  if exists (select 1 from app.tab_items where tab_id = v_tab.id and removed_at is null) then
    return private.err('TAB_NOT_EMPTY');
  end if;
  update app.tabs set status = 'canceled' where id = v_tab.id;
  perform private.audit_store('tab.discard', v_tab.store_id, null, 'tab', v_tab.id::text, null, null, null, 'allowed', v_op.id);
  return private.ok();
end;
$$;

revoke execute on function app.rename_tab(uuid, uuid, text) from public, anon;
grant execute on function app.rename_tab(uuid, uuid, text) to authenticated;
revoke execute on function app.discard_empty_tab(uuid, uuid) from public, anon;
grant execute on function app.discard_empty_tab(uuid, uuid) to authenticated;
