-- E06 (conta, loja, perfil, onboarding), E08 (várias lojas), E12 (permissões),
-- E32 (plano único, ciclos, loja adicional) e base da E33 (assinatura e acesso).

-- Tipos -----------------------------------------------------------------------
-- D63: cinco papéis, com estoquista.
create type app.member_role as enum ('owner', 'manager', 'cashier', 'stock_keeper', 'courier');
create type platform.billing_cycle as enum ('monthly', 'semiannual', 'annual');
create type platform.subscription_status as enum ('trial', 'active', 'past_due', 'canceled', 'expired');
create type platform.access_state as enum ('allowed', 'grace', 'suspended');

-- Plano (E32) ---------------------------------------------------------------------
create table platform.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true,
  for_sale boolean not null default true,
  created_at timestamptz not null default now()
);

create table platform.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references platform.plans (id),
  cycle platform.billing_cycle not null,
  price app.cents not null,
  stripe_price_id text,
  active boolean not null default true,
  unique (plan_id, cycle)
);

create table platform.addons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table platform.addon_prices (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid not null references platform.addons (id),
  cycle platform.billing_cycle not null,
  price app.cents not null,
  stripe_price_id text,
  unique (addon_id, cycle)
);

-- limit_value nulo = ilimitado; enabled = o recurso existe no plano.
create table platform.plan_features (
  plan_id uuid not null references platform.plans (id),
  feature_code text not null,
  enabled boolean not null default true,
  limit_value int,
  primary key (plan_id, feature_code)
);

alter table platform.plans enable row level security;
alter table platform.plan_prices enable row level security;
alter table platform.addons enable row level security;
alter table platform.addon_prices enable row level security;
alter table platform.plan_features enable row level security;

-- D54: R$ 149,90/mês; semestral −10%; anual −20%. Loja adicional R$ 49,90/mês com o mesmo desconto.
with p as (
  insert into platform.plans (code, name) values ('addegas', 'Addegas') returning id
)
insert into platform.plan_prices (plan_id, cycle, price)
select p.id, c.cycle, c.price from p,
  (values ('monthly'::platform.billing_cycle, 14990),
          ('semiannual'::platform.billing_cycle, 80946),
          ('annual'::platform.billing_cycle, 143904)) as c (cycle, price);

with a as (
  insert into platform.addons (code, name) values ('extra_store', 'Loja adicional') returning id
)
insert into platform.addon_prices (addon_id, cycle, price)
select a.id, c.cycle, c.price from a,
  (values ('monthly'::platform.billing_cycle, 4990),
          ('semiannual'::platform.billing_cycle, 26946),
          ('annual'::platform.billing_cycle, 47904)) as c (cycle, price);

insert into platform.plan_features (plan_id, feature_code, enabled, limit_value)
select p.id, f.code, f.enabled, f.lim
from platform.plans p,
  (values ('stores_included', true, 1),
          ('members', true, null),
          ('products', true, null),
          ('terminals', true, null),
          ('whatsapp_alerts', true, null),
          ('public_catalog', true, null),
          ('integrations_delivery', false, null)) as f (code, enabled, lim)
where p.code = 'addegas';

-- Conta e lojas (E06, E08) ------------------------------------------------------
create table app.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  document text,
  timezone text not null default 'America/Sao_Paulo',
  business_day_cutoff time not null default '05:00', -- D12: dia comercial
  owner_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_owner_idx on app.accounts (owner_user_id);

create table app.stores (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references app.accounts (id),
  name text not null check (length(trim(name)) between 2 and 120),
  slug extensions.citext not null unique,
  neighborhood text,
  city text,
  address text,
  whatsapp text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index stores_account_idx on app.stores (account_id);

create table app.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  last_store_id uuid references app.stores (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_last_store_idx on app.profiles (last_store_id);

-- Membro da loja. user_id nulo = pessoa que só opera o caixa por PIN (E07, E10).
create table app.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references app.stores (id),
  user_id uuid references auth.users (id),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  role app.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id),
  unique (id, store_id)
);
create index store_members_user_idx on app.store_members (user_id, store_id) where active;
create unique index store_members_one_owner on app.store_members (store_id) where role = 'owner';

create table app.store_settings (
  store_id uuid primary key references app.stores (id),
  block_negative_stock boolean not null default false,   -- D06
  cash_difference_alert app.cents not null default 2000,  -- R$ 20,00
  blind_cash_count boolean not null default false,
  delivery_fee_default app.cents not null default 0,      -- D42
  free_delivery_above app.cents,
  pix_key text,                                           -- D15
  pix_receiver_name text check (length(pix_receiver_name) <= 25),
  pix_city text check (length(pix_city) <= 15),
  updated_at timestamptz not null default now()
);

create trigger accounts_touch before update on app.accounts for each row execute function private.touch_updated_at();
create trigger stores_touch before update on app.stores for each row execute function private.touch_updated_at();
create trigger profiles_touch before update on app.profiles for each row execute function private.touch_updated_at();
create trigger store_members_touch before update on app.store_members for each row execute function private.touch_updated_at();
create trigger store_settings_touch before update on app.store_settings for each row execute function private.touch_updated_at();

-- Assinatura e acesso (E33, base) -------------------------------------------------
create table platform.subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references app.accounts (id),
  plan_id uuid not null references platform.plans (id),
  cycle platform.billing_cycle not null default 'monthly',
  price app.cents not null,
  extra_stores int not null default 0 check (extra_stores >= 0),
  extra_store_price app.cents not null default 0,
  status platform.subscription_status not null,
  access platform.access_state not null,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  temp_access_until timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_plan_idx on platform.subscriptions (plan_id);
create index subscriptions_due_idx on platform.subscriptions (status, access);
create trigger subscriptions_touch before update on platform.subscriptions for each row execute function private.touch_updated_at();

create table platform.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references platform.subscriptions (id),
  from_status platform.subscription_status,
  to_status platform.subscription_status,
  from_access platform.access_state,
  to_access platform.access_state,
  reason text not null,
  author text not null, -- 'system', 'webhook:stripe', 'staff:<uuid>', 'owner'
  correlation_id text,
  created_at timestamptz not null default now()
);
create index subscription_events_sub_idx on platform.subscription_events (subscription_id, created_at desc);

alter table platform.subscriptions enable row level security;
alter table platform.subscription_events enable row level security;

-- Permissões (E12) -------------------------------------------------------------------
create table app.permissions (
  code text primary key,
  name text not null,
  grp text not null,
  blocked_when_suspended boolean not null default false, -- §1: suspenso bloqueia caixa, pedidos e estoque
  feature_code text,                                     -- recurso de plano exigido (E32)
  sort int not null
);

create table app.role_permissions (
  store_id uuid not null references app.stores (id),
  role app.member_role not null,
  permission_code text not null references app.permissions (code),
  allowed boolean not null,
  updated_at timestamptz not null default now(),
  primary key (store_id, role, permission_code)
);
create index role_permissions_perm_idx on app.role_permissions (permission_code);

-- D05/D63: limite de desconto por papel (nulo = livre).
create table app.role_settings (
  store_id uuid not null references app.stores (id),
  role app.member_role not null,
  max_discount_pct numeric(5, 2) check (max_discount_pct between 0 and 100),
  primary key (store_id, role)
);

-- Matriz padrão (E12), copiada para cada loja nova.
create table private.default_role_permissions (
  role app.member_role not null,
  permission_code text not null references app.permissions (code),
  allowed boolean not null,
  primary key (role, permission_code)
);
create index default_role_permissions_perm_idx on private.default_role_permissions (permission_code);
alter table private.default_role_permissions enable row level security;

insert into app.permissions (code, name, grp, blocked_when_suspended, sort) values
  ('vender', 'Vender no caixa', 'caixa', true, 10),
  ('desconto', 'Dar desconto (dentro do limite)', 'caixa', true, 20),
  ('cancelar', 'Cancelar venda', 'caixa', true, 30),
  ('caixa', 'Abrir e fechar caixa', 'caixa', true, 40),
  ('sangria', 'Sangria, reforço e pagar entregador', 'caixa', true, 50),
  ('fiado', 'Vender no fiado', 'caixa', true, 60),
  ('fiado_receber', 'Receber pagamento de fiado', 'fiado', true, 70),
  ('fiado_ajustar', 'Juntar nomes e ajustar saldo do fiado', 'fiado', false, 80),
  ('estoque', 'Mexer no estoque', 'estoque', true, 90),
  ('precos', 'Editar preços, combos e promoções', 'estoque', false, 100),
  ('compras', 'Fornecedores e pedidos de compra', 'gestao', false, 110),
  ('contas', 'Ver contas a pagar', 'gestao', false, 120),
  ('pedidos', 'Ver e atualizar pedidos', 'pedidos', true, 130),
  ('relatorios', 'Ver relatórios de vendas', 'analise', false, 140),
  ('ver_lucro', 'Ver custo, margem e lucro', 'analise', false, 150),
  ('ferramentas', 'Ferramentas e anotações', 'ferramentas', false, 160),
  ('exportar', 'Exportar planilhas', 'analise', false, 170),
  ('ajustes', 'Ajustes da loja', 'configurar', false, 180),
  ('equipe', 'Gerenciar equipe', 'configurar', false, 190);

-- Matriz da E12 (S = sim). Dono tem tudo por regra; as linhas dele ficam só para exibição.
insert into private.default_role_permissions (role, permission_code, allowed)
select r.role, p.code, p.code = any (r.allowed)
from app.permissions p,
  (values
    ('owner'::app.member_role, array(select code from app.permissions)),
    ('manager'::app.member_role, array['vender','desconto','cancelar','caixa','sangria','fiado','fiado_receber',
      'fiado_ajustar','estoque','precos','compras','contas','pedidos','relatorios','ferramentas','exportar']),
    ('cashier'::app.member_role, array['vender','desconto','caixa','sangria','fiado','fiado_receber','pedidos']),
    ('stock_keeper'::app.member_role, array['estoque']),
    ('courier'::app.member_role, array['pedidos'])
  ) as r (role, allowed);

alter table app.accounts enable row level security;
alter table app.stores enable row level security;
alter table app.profiles enable row level security;
alter table app.store_members enable row level security;
alter table app.store_settings enable row level security;
alter table app.permissions enable row level security;
alter table app.role_permissions enable row level security;
alter table app.role_settings enable row level security;

-- Senha provisória (E07, D20): enquanto o hash atual do usuário for o da senha criada pelo dono,
-- ele não acessa nada da loja. Trocou a senha, o acesso volta sozinho.
create table private.provisional_passwords (
  user_id uuid primary key references auth.users (id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table private.provisional_passwords enable row level security;

create or replace function private.password_pending()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.provisional_passwords pp join auth.users u on u.id = pp.user_id
                 where pp.user_id = (select auth.uid()) and u.encrypted_password = pp.password_hash);
$$;

create or replace function private.remember_provisional_password(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.provisional_passwords (user_id, password_hash)
  select id, encrypted_password from auth.users where id = p_user_id
  on conflict (user_id) do update set password_hash = excluded.password_hash, created_at = now();
$$;

-- Helpers de acesso -------------------------------------------------------------
-- Pessoa logada é membro ativo da loja (loja não arquivada).
create or replace function private.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.store_members m join app.stores s on s.id = m.store_id
    where m.store_id = p_store_id and m.user_id = (select auth.uid()) and m.active and s.archived_at is null
  ) and not private.password_pending();
$$;

-- Pessoa logada é membro ativo de alguma loja da conta.
create or replace function private.is_account_member(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (exists (
    select 1 from app.store_members m join app.stores s on s.id = m.store_id
    where s.account_id = p_account_id and m.user_id = (select auth.uid()) and m.active
  ) or exists (
    select 1 from app.accounts a where a.id = p_account_id and a.owner_user_id = (select auth.uid())
  )) and not private.password_pending();
$$;

-- Estado de acesso efetivo: acesso temporário do suporte vale como liberado (D27).
create or replace function private.account_access(p_account_id uuid)
returns platform.access_state
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when s.temp_access_until > now() then 'allowed'::platform.access_state else s.access end
     from platform.subscriptions s where s.account_id = p_account_id),
    'suspended'::platform.access_state
  );
$$;

create or replace function private.plan_allows(p_account_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select f.enabled from platform.subscriptions s
     join platform.plan_features f on f.plan_id = s.plan_id and f.feature_code = p_feature
     where s.account_id = p_account_id),
    false
  );
$$;

-- Lojas que a assinatura cobre: as incluídas no plano + as adicionais contratadas (D02).
create or replace function private.stores_allowed(p_account_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select coalesce(f.limit_value, 1000000) + s.extra_stores
     from platform.subscriptions s
     join platform.plan_features f on f.plan_id = s.plan_id and f.feature_code = 'stores_included'
     where s.account_id = p_account_id),
    0
  );
$$;

-- E12: as quatro condições de uma vez (membro ativo, acesso, plano, papel).
create or replace function private.can(p_store_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app.store_members m
    join app.stores s on s.id = m.store_id
    join app.permissions p on p.code = p_permission
    left join app.role_permissions rp
      on rp.store_id = m.store_id and rp.role = m.role and rp.permission_code = p.code
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
      and m.active
      and s.archived_at is null
      and (m.role = 'owner' or coalesce(rp.allowed, false))
      and (not p.blocked_when_suspended or private.account_access(s.account_id) <> 'suspended')
      and (p.feature_code is null or private.plan_allows(s.account_id, p.feature_code))
  ) and not private.password_pending();
$$;

create or replace function private.member_role(p_store_id uuid)
returns app.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from app.store_members m
  where m.store_id = p_store_id and m.user_id = (select auth.uid()) and m.active;
$$;

revoke execute on function private.password_pending() from public, anon;
grant execute on function private.password_pending() to authenticated, service_role;
revoke execute on function private.remember_provisional_password(uuid) from public, anon, authenticated;
grant execute on function private.remember_provisional_password(uuid) to service_role;
revoke execute on function private.is_store_member(uuid) from public, anon;
revoke execute on function private.is_account_member(uuid) from public, anon;
revoke execute on function private.account_access(uuid) from public, anon, authenticated;
revoke execute on function private.plan_allows(uuid, text) from public, anon, authenticated;
revoke execute on function private.stores_allowed(uuid) from public, anon, authenticated;
revoke execute on function private.can(uuid, text) from public, anon;
revoke execute on function private.member_role(uuid) from public, anon;
grant execute on function private.is_store_member(uuid) to authenticated, service_role;
grant execute on function private.is_account_member(uuid) to authenticated, service_role;
grant execute on function private.can(uuid, text) to authenticated, service_role;
grant execute on function private.member_role(uuid) to authenticated, service_role;
grant execute on function private.account_access(uuid) to service_role;
grant execute on function private.plan_allows(uuid, text) to service_role;
grant execute on function private.stores_allowed(uuid) to service_role;

-- Políticas (leitura). Escrita só por RPC. --------------------------------------
create policy accounts_select on app.accounts for select to authenticated
  using ((select private.is_account_member(id)));
create policy stores_select on app.stores for select to authenticated
  using ((select private.is_store_member(id)) or (select private.is_account_member(account_id)) and exists (
    select 1 from app.accounts a where a.id = account_id and a.owner_user_id = (select auth.uid())));
create policy profiles_select_own on app.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on app.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy store_members_select on app.store_members for select to authenticated
  using ((select private.is_store_member(store_id)));
create policy store_settings_select on app.store_settings for select to authenticated
  using ((select private.is_store_member(store_id)));
create policy permissions_select on app.permissions for select to authenticated using (true);
create policy role_permissions_select on app.role_permissions for select to authenticated
  using ((select private.is_store_member(store_id)));
create policy role_settings_select on app.role_settings for select to authenticated
  using ((select private.is_store_member(store_id)));
create policy default_role_permissions_none on private.default_role_permissions for select to service_role using (true);

grant select on app.accounts, app.stores, app.store_members, app.store_settings,
  app.permissions, app.role_permissions, app.role_settings to authenticated;
grant select on app.profiles to authenticated;
grant update (full_name, phone, last_store_id) on app.profiles to authenticated;
grant all on app.accounts, app.stores, app.profiles, app.store_members, app.store_settings,
  app.permissions, app.role_permissions, app.role_settings to service_role;

-- Usuários novos ------------------------------------------------------------------
-- Cadastro público só cria pessoas: quem não vier com kind definido pelo servidor vira 'person'.
create or replace function private.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'kind', '') = '' then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"kind":"person"}'::jsonb;
  end if;
  return new;
end;
$$;

create or replace function private.on_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_app_meta_data ->> 'kind' = 'person' then
    insert into app.profiles (id, full_name)
    values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function private.on_auth_user_created() from public, anon, authenticated;
revoke execute on function private.on_auth_user_profile() from public, anon, authenticated;

create trigger addegas_user_kind before insert on auth.users
  for each row execute function private.on_auth_user_created();
create trigger addegas_user_profile after insert on auth.users
  for each row execute function private.on_auth_user_profile();

-- Slug único a partir do nome (addegas.com.br/<slug>, catálogo público E31).
create or replace function private.unique_store_slug(p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_base text := trim(both '-' from regexp_replace(lower(translate(p_name,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g'));
  v_slug text;
  v_n int := 1;
begin
  v_base := left(coalesce(nullif(v_base, ''), 'adega'), 40);
  v_slug := v_base;
  while exists (select 1 from app.stores where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;
revoke execute on function private.unique_store_slug(text) from public, anon, authenticated;

-- Cria loja com configurações e matriz de permissões padrão (usado no onboarding e na E08).
create or replace function private.provision_store(
  p_account_id uuid, p_owner uuid, p_owner_name text, p_name text,
  p_neighborhood text, p_city text, p_whatsapp text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store uuid;
begin
  insert into app.stores (account_id, name, slug, neighborhood, city, whatsapp)
  values (p_account_id, trim(p_name), private.unique_store_slug(p_name), p_neighborhood, p_city, p_whatsapp)
  returning id into v_store;

  insert into app.store_members (store_id, user_id, display_name, role)
  values (v_store, p_owner, coalesce(nullif(trim(p_owner_name), ''), 'Dono'), 'owner');

  insert into app.store_settings (store_id) values (v_store);

  insert into app.role_permissions (store_id, role, permission_code, allowed)
  select v_store, d.role, d.permission_code, d.allowed from private.default_role_permissions d;

  insert into app.role_settings (store_id, role, max_discount_pct) values
    (v_store, 'owner', null), (v_store, 'manager', 15), (v_store, 'cashier', 5),
    (v_store, 'stock_keeper', 0), (v_store, 'courier', 0);

  return v_store;
end;
$$;
revoke execute on function private.provision_store(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;

-- RPCs ---------------------------------------------------------------------------
-- E06: termina o cadastro em 3 passos. Idempotente: quem já tem conta recebe a mesma de volta.
create or replace function app.complete_onboarding(
  p_store_name text,
  p_neighborhood text default null,
  p_city text default null,
  p_whatsapp text default null,
  p_owner_name text default null,
  p_origin jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_account uuid;
  v_store uuid;
  v_plan uuid;
  v_price bigint;
begin
  if v_user is null then
    return private.err('AUTH_REQUIRED');
  end if;
  if private.current_user_kind() is distinct from 'person' then
    return private.err('ONBOARDING_NOT_ALLOWED');
  end if;
  if not exists (select 1 from auth.users u where u.id = v_user and u.email_confirmed_at is not null) then
    return private.err('EMAIL_NOT_CONFIRMED');
  end if;
  if length(trim(coalesce(p_store_name, ''))) < 2 then
    return private.err('ONBOARDING_STORE_NAME');
  end if;

  -- Idempotência (D02: uma pessoa é dona de uma conta só na v1).
  select a.id into v_account from app.accounts a where a.owner_user_id = v_user;
  if v_account is not null then
    select s.id into v_store from app.stores s where s.account_id = v_account order by s.created_at limit 1;
    return private.ok(jsonb_build_object('account_id', v_account, 'store_id', v_store, 'created', false));
  end if;

  insert into app.accounts (name, owner_user_id) values (trim(p_store_name), v_user)
  returning id into v_account;

  v_store := private.provision_store(v_account, v_user, p_owner_name, p_store_name, p_neighborhood, p_city, p_whatsapp);

  update app.profiles set full_name = coalesce(nullif(trim(p_owner_name), ''), full_name), phone = p_whatsapp,
    last_store_id = v_store
  where id = v_user;

  select pl.id, pp.price into v_plan, v_price
  from platform.plans pl join platform.plan_prices pp on pp.plan_id = pl.id and pp.cycle = 'monthly'
  where pl.code = 'addegas';

  -- Teste grátis de 14 dias (§10).
  insert into platform.subscriptions (account_id, plan_id, cycle, price, status, access, trial_ends_at)
  values (v_account, v_plan, 'monthly', v_price, 'trial', 'allowed', now() + interval '14 days');

  insert into platform.subscription_events (subscription_id, to_status, to_access, reason, author, correlation_id)
  select s.id, 'trial', 'allowed', 'Cadastro concluído', 'owner', private.correlation_id()
  from platform.subscriptions s where s.account_id = v_account;

  perform private.audit_store('account.onboarding', v_store, v_account, 'account', v_account::text,
    null, jsonb_build_object('store', p_store_name, 'origin', p_origin));

  return private.ok(jsonb_build_object('account_id', v_account, 'store_id', v_store, 'created', true));
end;
$$;

-- E08: loja adicional, só o dono, dentro do que a assinatura cobre.
create or replace function app.create_store(
  p_account_id uuid,
  p_name text,
  p_neighborhood text default null,
  p_city text default null,
  p_whatsapp text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_used int;
  v_store uuid;
  v_owner_name text;
begin
  -- Trava a conta: duas criações simultâneas não furam o limite.
  perform 1 from app.accounts a where a.id = p_account_id and a.owner_user_id = v_user for update;
  if not found then
    perform private.audit_store('store.create', null, p_account_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if private.account_access(p_account_id) = 'suspended' then
    return private.err('ACCESS_SUSPENDED');
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    return private.err('STORE_NAME');
  end if;

  select count(*) into v_used from app.stores s where s.account_id = p_account_id and s.archived_at is null;
  if v_used >= private.stores_allowed(p_account_id) then
    return private.err('PLAN_LIMIT_STORES', format('%s de %s lojas em uso', v_used, private.stores_allowed(p_account_id)));
  end if;

  select m.display_name into v_owner_name
  from app.store_members m join app.stores s on s.id = m.store_id
  where s.account_id = p_account_id and m.user_id = v_user and m.role = 'owner'
  order by m.created_at limit 1;

  v_store := private.provision_store(p_account_id, v_user, v_owner_name, p_name, p_neighborhood, p_city, p_whatsapp);
  perform private.audit_store('store.create', v_store, p_account_id, 'store', v_store::text, null,
    jsonb_build_object('name', p_name));
  return private.ok(jsonb_build_object('store_id', v_store));
end;
$$;

-- E08: lojas da pessoa logada, com papel e estado de acesso.
create or replace function app.my_stores()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.ok(coalesce(jsonb_agg(jsonb_build_object(
    'store_id', s.id, 'account_id', s.account_id, 'name', s.name, 'slug', s.slug,
    'neighborhood', s.neighborhood, 'role', m.role,
    'access', private.account_access(s.account_id)
  ) order by s.created_at), '[]'::jsonb))
  from app.store_members m join app.stores s on s.id = m.store_id
  where m.user_id = (select auth.uid()) and m.active and s.archived_at is null and not private.password_pending();
$$;

-- E12: lista calculada de permissões e o limite de desconto da pessoa na loja.
create or replace function app.my_permissions(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_store_member(p_store_id) then private.err('FORBIDDEN') else
    private.ok(jsonb_build_object(
      'role', private.member_role(p_store_id),
      'permissions', (select coalesce(jsonb_agg(p.code order by p.sort), '[]'::jsonb)
                      from app.permissions p where private.can(p_store_id, p.code)),
      'max_discount_pct', (select rs.max_discount_pct from app.role_settings rs
                           where rs.store_id = p_store_id and rs.role = private.member_role(p_store_id))
    )) end;
$$;

-- E12: dono altera a matriz (o próprio papel de dono não muda: ele sempre tem tudo).
create or replace function app.set_role_permission(
  p_store_id uuid, p_role app.member_role, p_permission text, p_allowed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before boolean;
begin
  if private.member_role(p_store_id) is distinct from 'owner' then
    perform private.audit_store('permissions.update', p_store_id, p_outcome => 'denied',
      p_entity => 'role_permission', p_entity_id => p_role || ':' || p_permission);
    return private.err('FORBIDDEN');
  end if;
  if p_role = 'owner' then
    return private.err('OWNER_ALWAYS_ALLOWED');
  end if;
  if not exists (select 1 from app.permissions where code = p_permission) then
    return private.err('PERMISSION_UNKNOWN');
  end if;

  select allowed into v_before from app.role_permissions
  where store_id = p_store_id and role = p_role and permission_code = p_permission;

  insert into app.role_permissions (store_id, role, permission_code, allowed)
  values (p_store_id, p_role, p_permission, p_allowed)
  on conflict (store_id, role, permission_code) do update set allowed = excluded.allowed, updated_at = now();

  perform private.audit_store('permissions.update', p_store_id, null, 'role_permission',
    p_role || ':' || p_permission, jsonb_build_object('allowed', v_before), jsonb_build_object('allowed', p_allowed));
  return private.ok();
end;
$$;

create or replace function app.set_role_discount_limit(
  p_store_id uuid, p_role app.member_role, p_max_pct numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before numeric;
begin
  if private.member_role(p_store_id) is distinct from 'owner' then
    perform private.audit_store('discount_limit.update', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  if p_role = 'owner' then
    return private.err('OWNER_ALWAYS_ALLOWED');
  end if;
  if p_max_pct is null or p_max_pct < 0 or p_max_pct > 100 then
    return private.err('DISCOUNT_LIMIT_INVALID');
  end if;

  select max_discount_pct into v_before from app.role_settings where store_id = p_store_id and role = p_role;
  update app.role_settings set max_discount_pct = p_max_pct where store_id = p_store_id and role = p_role;
  perform private.audit_store('discount_limit.update', p_store_id, null, 'role_settings', p_role::text,
    jsonb_build_object('max_discount_pct', v_before), jsonb_build_object('max_discount_pct', p_max_pct));
  return private.ok();
end;
$$;

-- E07: o app mostra a tela de troca de senha antes de qualquer outra.
create or replace function app.must_change_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.password_pending();
$$;
revoke execute on function app.must_change_password() from public, anon;
grant execute on function app.must_change_password() to authenticated;

-- E33: estado da assinatura visto pela adega, sem expor o schema platform.
create or replace function app.my_subscription(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_account_member(p_account_id) then private.err('FORBIDDEN') else
    coalesce((
      select private.ok(jsonb_build_object(
        'status', s.status, 'access', private.account_access(s.account_id), 'cycle', s.cycle,
        'price', s.price, 'extra_stores', s.extra_stores, 'trial_ends_at', s.trial_ends_at,
        'current_period_end', s.current_period_end, 'grace_ends_at', s.grace_ends_at,
        'cancel_at_period_end', s.cancel_at_period_end, 'temp_access_until', s.temp_access_until,
        'stores_allowed', private.stores_allowed(s.account_id)
      ))
      from platform.subscriptions s where s.account_id = p_account_id
    ), private.err('SUBSCRIPTION_NOT_FOUND')) end;
$$;

revoke execute on function app.complete_onboarding(text, text, text, text, text, jsonb) from public, anon;
revoke execute on function app.create_store(uuid, text, text, text, text) from public, anon;
revoke execute on function app.my_stores() from public, anon;
revoke execute on function app.my_permissions(uuid) from public, anon;
revoke execute on function app.set_role_permission(uuid, app.member_role, text, boolean) from public, anon;
revoke execute on function app.set_role_discount_limit(uuid, app.member_role, numeric) from public, anon;
revoke execute on function app.my_subscription(uuid) from public, anon;
grant execute on function app.complete_onboarding(text, text, text, text, text, jsonb) to authenticated;
grant execute on function app.create_store(uuid, text, text, text, text) to authenticated;
grant execute on function app.my_stores() to authenticated;
grant execute on function app.my_permissions(uuid) to authenticated;
grant execute on function app.set_role_permission(uuid, app.member_role, text, boolean) to authenticated;
grant execute on function app.set_role_discount_limit(uuid, app.member_role, numeric) to authenticated;
grant execute on function app.my_subscription(uuid) to authenticated;

-- private.audit_store precisa ser chamável pelas RPCs security definer (dono = postgres): já é.
