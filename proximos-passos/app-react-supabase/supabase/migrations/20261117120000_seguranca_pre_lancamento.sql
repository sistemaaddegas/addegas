-- Auditoria de segurança antes da primeira versão (17/11/2026).
-- 1. Limite de taxa no banco, por chave de negócio (loja, telefone, usuário), em vez do IP: o x-forwarded-for
--    chega do cliente e pode ser forjado, e o limite em memória da Edge Function vale só para uma instância.
-- 2. Código do pareamento do caixa: trava a loja depois de 10 erros em 10 minutos e queima os códigos abertos
--    (antes dava para testar o milhão de combinações de 6 dígitos trocando o IP).
-- 3. Códigos de 6 dígitos com gerador criptográfico (random() do Postgres é previsível).
-- 4. WhatsApp de verificação do alerta: limite por loja e por número, e no máximo 5 tentativas do código
--    (antes servia para mandar mensagem do número da Addegas para qualquer telefone, sem limite).
-- 5. Criação de login da equipe: limite por loja (spam de e-mail pelo domínio da Addegas).
-- 6. Acesso rápido, pedido de compra e contagem: produto tem que ser da própria conta.
-- 7. Logs vindos do front: loja só entra se a pessoa for dela, com limite por usuário e global para anônimo.
-- 8. Defesa em profundidade: anon e authenticated sem execução no pg_net nem leitura do pg_stat_statements.

-- ===== 1. Limite de taxa =====
create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table private.rate_limits enable row level security;

-- Conta uma ocorrência na janela e diz se ainda está dentro do limite.
create or replace function private.rate_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
  v_window interval := make_interval(secs => p_window_seconds);
begin
  -- Passou do limite (p_max + 1, o que o rate_peek enxerga): não grava mais nada até a janela virar, para a
  -- enxurrada que o limite barra não virar uma escrita por pedido. Sem linha de volta = fora do limite.
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when r.window_start < now() - v_window then now() else r.window_start end,
    hits = case when r.window_start < now() - v_window then 1 else r.hits + 1 end
  where r.hits <= p_max or r.window_start < now() - v_window
  returning hits into v_hits;
  return coalesce(v_hits <= p_max, false);
end;
$$;

-- Chaves velhas saem uma vez por dia, fora do caminho dos pedidos.
select cron.schedule('addegas-limpa-limites', '45 5 * * *',
  $$delete from private.rate_limits where window_start < now() - interval '2 days'$$);

-- Quantas ocorrências a chave tem na janela, sem contar uma nova.
create or replace function private.rate_peek(p_key text, p_window_seconds int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select hits from private.rate_limits
                   where key = p_key and window_start >= now() - make_interval(secs => p_window_seconds)), 0);
$$;

-- ===== 3. Código de 6 dígitos com gerador criptográfico =====
create or replace function private.random_code6()
returns text
language sql
volatile
set search_path = ''
as $$
  select lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
$$;

-- ===== 2. Pareamento do caixa =====
create or replace function app.create_pairing_code(p_store_id uuid, p_terminal_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := private.random_code6();
begin
  if private.member_role(p_store_id) not in ('owner', 'manager') then
    perform private.audit_store('terminal.pairing_code', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if length(trim(coalesce(p_terminal_name, ''))) < 1 then
    return private.err('TERMINAL_NAME');
  end if;
  -- Cada código aberto é mais uma chance para quem tenta adivinhar: no máximo 20 por hora por loja.
  if not private.rate_hit('pairing_create:' || p_store_id, 20, 3600) then
    return private.err('RATE_LIMITED');
  end if;

  insert into private.pairing_codes (store_id, terminal_name, code_hash, created_by, expires_at)
  values (p_store_id, left(trim(p_terminal_name), 60), extensions.crypt(v_code, extensions.gen_salt('bf', 8)),
    (select auth.uid()), now() + interval '10 minutes');

  perform private.audit_store('terminal.pairing_code', p_store_id, null, 'terminal', p_terminal_name);
  return private.ok(jsonb_build_object('code', v_code, 'expires_in_seconds', 600));
end;
$$;

create or replace function private.redeem_pairing_code(p_store_slug text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
  v_pc private.pairing_codes;
  v_terminal uuid;
begin
  select id into v_store from app.stores where slug = p_store_slug and archived_at is null;
  if v_store is null or coalesce(p_code, '') !~ '^[0-9]{6}$' then
    return private.err('PAIRING_CODE_INVALID');
  end if;
  -- Loja travada: 10 erros em 10 minutos. O dono gera um código novo depois da janela.
  if private.rate_peek('pairing_fail:' || v_store, 600) >= 10 then
    return private.err('PAIRING_LOCKED');
  end if;

  select pc.* into v_pc
  from private.pairing_codes pc
  where pc.store_id = v_store and pc.used_at is null and pc.expires_at > now()
    and pc.code_hash = extensions.crypt(p_code, pc.code_hash)
  order by pc.created_at desc limit 1
  for update of pc;

  if not found then
    if not private.rate_hit('pairing_fail:' || v_store, 9, 600) then
      -- Décimo erro: queima os códigos abertos da loja e registra para o dono ver.
      update private.pairing_codes set expires_at = now() where store_id = v_store and used_at is null and expires_at > now();
      insert into audit.store_actions (store_id, actor_kind, action, outcome, correlation_id)
      values (v_store, 'system', 'terminal.pairing_locked', 'denied', private.correlation_id());
      return private.err('PAIRING_LOCKED');
    end if;
    return private.err('PAIRING_CODE_INVALID');
  end if;

  update private.pairing_codes set used_at = now() where id = v_pc.id;
  insert into app.terminals (store_id, name, registered_by) values (v_pc.store_id, v_pc.terminal_name, v_pc.created_by)
  returning id into v_terminal;

  insert into audit.store_actions (store_id, actor_user_id, actor_kind, action, entity, entity_id, after, correlation_id)
  values (v_pc.store_id, v_pc.created_by, 'person', 'terminal.register', 'terminal', v_terminal::text,
    jsonb_build_object('name', v_pc.terminal_name), private.correlation_id());

  return private.ok(jsonb_build_object('terminal_id', v_terminal, 'store_id', v_pc.store_id, 'name', v_pc.terminal_name));
end;
$$;

-- ===== 4. Número que recebe os alertas por WhatsApp =====
create or replace function app.add_alert_recipient(p_store_id uuid, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_code text := private.random_code6();
begin
  if not private.can(p_store_id, 'ajustes') then return private.err('FORBIDDEN'); end if;
  if v_phone !~ '^[0-9]{10,13}$' then return private.err('PHONE_INVALID'); end if;
  if length(v_phone) <= 11 then v_phone := '55' || v_phone; end if;
  -- Cada código é uma mensagem saindo do número da Addegas: 5 por hora por loja e 3 por dia por número.
  if not private.rate_hit('alert_code_store:' || p_store_id, 5, 3600)
     or not private.rate_hit('alert_code_phone:' || v_phone, 3, 86400) then
    return private.err('RATE_LIMITED');
  end if;
  insert into app.alert_recipients (store_id, phone, code_hash)
  values (p_store_id, v_phone, extensions.crypt(v_code, extensions.gen_salt('bf', 6)))
  on conflict (store_id, phone) do update set code_hash = excluded.code_hash, verified_at = null, opted_out_at = null;
  perform private.enqueue_message('whatsapp', 'service', v_phone, 'verify_code',
    jsonb_build_object('nome_loja', left((select name from app.stores where id = p_store_id), 40), 'codigo', v_code),
    'verify:' || p_store_id || ':' || v_phone || ':' || extract(epoch from now())::bigint, (select account_id from app.stores where id = p_store_id), p_store_id);
  return private.ok(jsonb_build_object('phone', v_phone));
end;
$$;

create or replace function app.verify_alert_recipient(p_store_id uuid, p_phone text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r app.alert_recipients;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if not private.can(p_store_id, 'ajustes') then return private.err('FORBIDDEN'); end if;
  if length(v_phone) <= 11 then v_phone := '55' || v_phone; end if;
  select * into v_r from app.alert_recipients where store_id = p_store_id and phone = v_phone for update;
  if not found or v_r.code_hash is null then
    return private.err('CODE_INVALID');
  end if;
  if v_r.code_hash <> extensions.crypt(coalesce(p_code, ''), v_r.code_hash) then
    -- Quinta tentativa errada: o código morre e é preciso pedir outro.
    if not private.rate_hit('alert_verify:' || p_store_id || ':' || v_phone, 4, 3600) then
      update app.alert_recipients set code_hash = null where store_id = p_store_id and phone = v_phone;
    end if;
    return private.err('CODE_INVALID');
  end if;
  update app.alert_recipients set verified_at = now(), code_hash = null where store_id = p_store_id and phone = v_phone;
  return private.ok();
end;
$$;

-- ===== 5. Criação de login da equipe =====
create or replace function app.can_create_member(p_store_id uuid, p_role app.member_role)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_role(p_store_id, p_role) then
    perform private.audit_store('member.create', p_store_id, p_outcome => 'denied', p_entity => 'role', p_entity_id => p_role::text);
    return private.err('FORBIDDEN');
  end if;
  -- Criar login manda e-mail com a senha provisória: 30 por hora por loja (vale também para gerar senha nova).
  if not private.rate_hit('member_login:' || p_store_id, 30, 3600) then
    return private.err('RATE_LIMITED');
  end if;
  return private.ok(jsonb_build_object('store_slug', (select slug from app.stores where id = p_store_id)));
end;
$$;

-- ===== 6. Produto tem que ser da conta da loja =====
create or replace function private.store_owns_items(p_store_id uuid, p_items jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) i
    where (nullif(i ->> 'product_id', '') is not null and not exists (
             select 1 from app.products p join app.stores s on s.account_id = p.account_id
             where s.id = p_store_id and p.id = (i ->> 'product_id')::uuid))
       or (nullif(i ->> 'bundle_id', '') is not null and not exists (
             select 1 from app.bundles b join app.stores s on s.account_id = b.account_id
             where s.id = p_store_id and b.id = (i ->> 'bundle_id')::uuid))
  );
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
  if not private.store_owns_items(p_store_id, p_items) then
    return private.err('PRODUCT_NOT_FOUND');
  end if;
  delete from app.quick_access where store_id = p_store_id;
  insert into app.quick_access (store_id, position, product_id, bundle_id, color)
  select p_store_id, (i ->> 'position')::int, nullif(i ->> 'product_id', '')::uuid, nullif(i ->> 'bundle_id', '')::uuid, i ->> 'color'
  from jsonb_array_elements(p_items) i;
  return private.ok();
end;
$$;

create or replace function app.save_purchase_order(p_store_id uuid, p_supplier_id uuid, p_items jsonb, p_status text default 'draft',
  p_expected_on date default null, p_note text default null)
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
  if not private.store_owns_items(p_store_id, p_items)
     or exists (select 1 from jsonb_array_elements(p_items) i where nullif(i ->> 'product_id', '') is null) then
    return private.err('PRODUCT_NOT_FOUND');
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
  if p_product_id is null or not exists (select 1 from app.products p join app.stores s on s.account_id = p.account_id
                                         where s.id = v_store and p.id = p_product_id) then
    return private.err('PRODUCT_NOT_FOUND');
  end if;
  insert into app.stock_count_items (count_id, store_id, product_id, counted_qty, system_qty_at_count)
  values (p_count_id, v_store, p_product_id, p_counted,
    coalesce((select quantity from app.product_stock where store_id = v_store and product_id = p_product_id), 0))
  on conflict (count_id, product_id) do update set counted_qty = excluded.counted_qty,
    system_qty_at_count = excluded.system_qty_at_count, counted_at = now();
  return private.ok();
end;
$$;

-- ===== 7. Logs do front (/api/logs) =====
-- p_user vem do token já conferido pela Edge Function (que também o põe no auth.uid() desta chamada, gravado pelo
-- private.log). Loja só fica no registro se a pessoa (ou o aparelho) for dela.
create or replace function private.log_from_front(p_user uuid, p_source text, p_level text, p_message text, p_code text,
  p_context jsonb, p_store_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
begin
  if not private.rate_hit(case when p_user is null then 'front_log:anon' else 'front_log:' || p_user end,
                          case when p_user is null then 300 else 60 end, 60) then
    return false;
  end if;
  if p_store_id is not null and p_user is not null and (
       exists (select 1 from app.store_members m where m.store_id = p_store_id and m.user_id = p_user and m.active)
       or exists (select 1 from app.terminals t where t.store_id = p_store_id and t.auth_user_id = p_user and t.active)) then
    v_store := p_store_id;
  end if;
  perform private.log(case when p_source = 'security' then 'security' else 'front' end,
    case when p_level in ('debug', 'info', 'warn', 'error') then p_level else 'error' end,
    coalesce(p_message, 'sem mensagem'), left(p_code, 80), p_context, v_store);
  return true;
end;
$$;

-- Webhook com assinatura inválida: registra no banco no máximo 30 por minuto (o resto fica só no log da função).
create or replace function private.log_throttled(p_key text, p_max int, p_window_seconds int, p_message text, p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.rate_hit(p_key, p_max, p_window_seconds) then
    return false;
  end if;
  perform private.log('back', 'error', p_message, p_code);
  return true;
end;
$$;

-- ===== Permissões das funções novas =====
-- As trocadas (create or replace com a mesma assinatura) mantêm as permissões que já tinham.
revoke execute on function private.rate_hit(text, int, int), private.rate_peek(text, int), private.random_code6(),
  private.store_owns_items(uuid, jsonb), private.log_from_front(uuid, text, text, text, text, jsonb, uuid),
  private.log_throttled(text, int, int, text, text) from public, anon, authenticated;
grant execute on function private.rate_hit(text, int, int), private.rate_peek(text, int), private.random_code6(),
  private.store_owns_items(uuid, jsonb), private.log_from_front(uuid, text, text, text, text, jsonb, uuid),
  private.log_throttled(text, int, int, text, text) to service_role;

-- ===== 8. Defesa em profundidade =====
-- Nenhum caminho da API chega nessas funções hoje (só o schema app é exposto e o GraphQL está desligado), mas, se um
-- dia alguém expuser outro schema, o pg_net viraria um SSRF a partir do banco. Em projeto onde o dono das funções é
-- o supabase_admin, o revoke pode não ter efeito; o bloco não falha por isso.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'net'
  loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    exception when others then
      raise notice 'pg_net: sem permissão para revogar %', f.sig;
    end;
  end loop;
  begin
    execute 'revoke usage on schema net from anon, authenticated';
  exception when others then
    raise notice 'pg_net: sem permissão para revogar o schema';
  end;
  if to_regclass('extensions.pg_stat_statements') is not null then
    begin
      execute 'revoke select on extensions.pg_stat_statements, extensions.pg_stat_statements_info from anon, authenticated';
    exception when others then
      raise notice 'pg_stat_statements: sem permissão para revogar';
    end;
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    begin
      execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
    exception when others then
      raise notice 'rls_auto_enable: sem permissão para revogar';
    end;
  end if;
end $$;
