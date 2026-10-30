-- O que faltava para os menus ficarem iguais ao Addegas.dc.html:
-- foto do "Meu perfil", "Excluir promoção" e "Novo cliente" do fiado.

-- Meu perfil: foto pequena (o front recorta em 320 px e grava como data URL). Fica na linha da própria pessoa,
-- sob a RLS de profiles, sem bucket público.
alter table app.profiles add column avatar text
  check (avatar is null or (avatar like 'data:image/%' and length(avatar) <= 150000));
grant update (avatar) on app.profiles to authenticated;

-- Promoções: excluir não apaga (vendas antigas apontam para o combo); arquiva e tira do caixa e do acesso rápido.
alter table app.bundles add column archived_at timestamptz;

create or replace function app.archive_bundle(p_account_id uuid, p_bundle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
begin
  if not private.can_account(p_account_id, 'precos') then
    return private.err('FORBIDDEN');
  end if;
  update app.bundles set active = false, archived_at = now()
  where id = p_bundle_id and account_id = p_account_id and archived_at is null;
  if not found then
    return private.err('BUNDLE_NOT_FOUND');
  end if;
  delete from app.quick_access where bundle_id = p_bundle_id;
  -- O combo é da conta; o log fica na primeira loja dela.
  select id into v_store from app.stores where account_id = p_account_id order by created_at limit 1;
  perform private.audit_store('bundle.archive', v_store, p_account_id, 'bundle', p_bundle_id::text);
  return private.ok();
end;
$$;

-- Clientes e fiado: "Novo cliente" do protótipo. Só nome e telefone (D55), limite opcional (D55b) e data combinada.
create or replace function app.create_fiado_account(p_store_id uuid, p_name text, p_phone text,
  p_credit_limit bigint default null, p_promised_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id uuid;
begin
  if not private.can(p_store_id, 'fiado_ajustar') then
    perform private.audit_store('fiado.create', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    return private.err('FIADO_NAME_REQUIRED');
  end if;
  if length(v_phone) in (12, 13) and v_phone like '55%' then
    v_phone := substr(v_phone, 3);
  end if;
  if v_phone !~ '^[0-9]{10,11}$' then
    return private.err('FIADO_PHONE_INVALID');
  end if;
  if coalesce(p_credit_limit, 0) < 0 then
    return private.err('FIADO_LIMIT_INVALID');
  end if;
  insert into app.fiado_accounts (store_id, name, name_norm, phone, credit_limit, promised_date)
  values (p_store_id, trim(p_name), private.normalize_name(p_name), v_phone, nullif(p_credit_limit, 0), p_promised_date)
  on conflict (store_id, phone) do nothing
  returning id into v_id;
  if v_id is null then
    return private.err('FIADO_PHONE_EXISTS');
  end if;
  perform private.audit_store('fiado.create', p_store_id, null, 'fiado_account', v_id::text, null,
    jsonb_build_object('credit_limit', p_credit_limit, 'promised_date', p_promised_date));
  return private.ok(jsonb_build_object('fiado_account_id', v_id));
end;
$$;

revoke execute on function app.archive_bundle(uuid, uuid) from public, anon;
grant execute on function app.archive_bundle(uuid, uuid) to authenticated;
revoke execute on function app.create_fiado_account(uuid, text, text, bigint, date) from public, anon;
grant execute on function app.create_fiado_account(uuid, text, text, bigint, date) to authenticated;
