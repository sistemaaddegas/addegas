-- Addegas · dados de exemplo para o ambiente local
--
-- Roda sozinho no `npm run db:reset`, depois das migrations. Nunca roda no dev
-- nem na produção (o `db push` não aplica seed).
--
-- São os dados de demonstração do `index.html` publicado (Adega Esquina, Vila Madalena;
-- Adega Esquina 2, Pinheiros; dono Marcos Silva), para o app novo poder ser comparado
-- tela a tela com o protótipo. Tudo passa pelas RPCs do sistema (venda, estoque, fiado,
-- pedidos), então saldos, números de venda, custo médio e auditoria ficam coerentes.
-- Por cima disso entram 13 dias de vendas anteriores, para os relatórios terem o que mostrar.
--
-- Acessos (senha de todos: addegas123):
--   marcos@adega.test     dono da Adega Esquina (as duas lojas)
--   rafa@adega.test       gerente nas duas lojas
--   diego / kaua          entregadores, entram pelo nome de usuário (ver o fim do arquivo)
--   joana@porto.test      dona da Adega do Porto (outra conta, em carência: serve para testar isolamento)
--   admin@addegas.com.br  equipe Addegas, perfil mestre (o painel exige cadastrar o 2FA no primeiro acesso)
--   caio@, lia@, rafael@, nina@addegas.com.br  equipe: financeiro, suporte, comercial e analista
-- Só no caixa (sem login): Bia Santos · Léo Moura · Tati Rocha (estoquista). No caixa, cada um toca no próprio nome.

begin;

select setseed(0.42); -- mesmo sorteio a cada reset
-- Datas e horários de São Paulo (o banco roda em UTC). O dia da adega vira às 05h, como no sistema.
set local timezone = 'America/Sao_Paulo';
create function pg_temp.today() returns date language sql as $$ select (localtimestamp - interval '5 hours')::date $$;

create temp table k (n text primary key, v uuid);
create function pg_temp.k(p text) returns uuid language sql as $$ select v from k where n = p $$;
create function pg_temp.put(p text, p_v uuid) returns uuid language sql as $$
  insert into k values (p, p_v) on conflict (n) do update set v = excluded.v returning v;
$$;

-- Toda RPC passa por aqui: o seed para no primeiro erro, mostrando o código.
create function pg_temp.ok(p_label text, r jsonb) returns jsonb language plpgsql as $$
begin
  if coalesce(r ->> 'ok', 'false') <> 'true' then raise exception 'seed: % falhou: %', p_label, r; end if;
  return r -> 'data';
end $$;

-- Usuário do Auth com senha addegas123 e e-mail confirmado, pronto para entrar pelo app.
create function pg_temp.new_user(p_email text, p_name text, p_kind text default null) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
    extensions.crypt('addegas123', extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
      || case when p_kind is null then '{}'::jsonb else jsonb_build_object('kind', p_kind) end,
    jsonb_build_object('name', p_name), now(), now(), '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v, v::text, jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now());
  return v;
end $$;

-- Age como o usuário (o que o JWT faria numa chamada real).
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'app_metadata', (select raw_app_meta_data from auth.users where id = p_user))::text, true);
$$;

-- Venda no caixa. p_items: [{"k": "p1", "q": 2}, {"k": "c3", "q": 1}] (c* = combo).
-- Dinheiro paga arredondado para cima (gera troco); os outros meios pagam o total exato.
create function pg_temp.sell(p_store uuid, p_session uuid, p_items jsonb, p_method text, p_extra jsonb default '{}')
returns jsonb language plpgsql as $$
declare
  it jsonb; v_id uuid; v_q numeric; v_items jsonb := '[]'; v_total bigint := 0; v_pay bigint;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_id := pg_temp.k(it ->> 'k'); v_q := (it ->> 'q')::numeric;
    if (it ->> 'k') like 'c%' then
      v_items := v_items || jsonb_build_object('bundle_id', v_id, 'quantity', v_q);
      v_total := v_total + private.bundle_price(p_store, v_id) * v_q;
    else
      v_items := v_items || jsonb_build_object('product_id', v_id, 'quantity', v_q);
      v_total := v_total + private.effective_price(p_store, v_id) * v_q;
    end if;
  end loop;
  v_pay := case when p_method = 'cash' then ceil(v_total / 1000.0)::bigint * 1000 else v_total end;
  return pg_temp.ok('venda', app.finalize_sale(jsonb_build_object('operator_session_id', p_session,
    'client_request_id', gen_random_uuid(), 'items', v_items,
    'payments', jsonb_build_array(jsonb_build_object('method', p_method, 'amount', v_pay))) || p_extra));
end $$;

-- Operador escolhe o próprio nome no aparelho; devolve a sessão de operador.
create function pg_temp.login(p_terminal text, p_member text) returns uuid language plpgsql as $$
begin
  perform pg_temp.as_user(pg_temp.k(p_terminal));
  return (pg_temp.ok('caixa ' || p_member, app.operator_login(pg_temp.k(p_member))) ->> 'operator_session_id')::uuid;
end $$;

-- Sorteia uma venda de balcão, com o peso de cada produto parecido com o de uma adega de verdade.
create function pg_temp.random_items() returns jsonb language plpgsql as $$
declare
  pool text[] := array['p1','p1','p1','p1','p1','p3','p3','p3','p3','p3','p4','p4','p4','p2','p2','p5','p5','p6','p6',
    'p12','p12','p12','p13','p13','p15','p15','p15','p16','p16','p18','p18','p18','p19','p19','p19','p20',
    'p7','p10','p14','p17','p9','p8','p11','c3','c3','c2','c1'];
  v jsonb := '[]'; v_k text; v_q int;
begin
  for i in 1 .. 1 + floor(random() * 3)::int loop
    v_k := pool[1 + floor(random() * array_length(pool, 1))::int];
    v_q := case when v_k in ('p1','p2','p3','p5','p6') then (array[1,2,3,4,6,6,12])[1 + floor(random() * 7)::int]
                when v_k in ('p4','p12','p13','p16','p19') then 1 + floor(random() * 4)::int
                else 1 end;
    v := v || jsonb_build_object('k', v_k, 'q', v_q);
  end loop;
  return v;
end $$;

create function pg_temp.random_method() returns text language sql as $$
  select (array['pix','pix','pix','pix','debit','debit','credit','credit','cash','cash'])[1 + floor(random() * 10)::int];
$$;

-- Um dia de caixa já fechado: abre, vende n vezes, fecha e leva tudo para a data e o horário do dia.
create function pg_temp.past_day(p_store text, p_terminal text, p_member text, p_day date, p_n int)
returns void language plpgsql as $$
declare
  v_s uuid; v_cash uuid; v_expected bigint; v_diff bigint;
begin
  v_s := pg_temp.login(p_terminal, p_member);
  v_cash := (pg_temp.ok('abrir caixa', app.open_cash(v_s, 15000)) ->> 'cash_session_id')::uuid;
  for i in 1 .. p_n loop
    perform pg_temp.sell(pg_temp.k(p_store), v_s, pg_temp.random_items(), pg_temp.random_method());
  end loop;
  select coalesce(sum(amount), 0) into v_expected from app.cash_movements where cash_session_id = v_cash;
  v_diff := (array[0,0,0,0,0,0,-1250,500,-200])[1 + floor(random() * 9)::int];
  perform pg_temp.ok('fechar caixa', app.close_cash(v_s, v_expected + v_diff,
    case when v_diff <> 0 then 'Conferido no fim do turno' end));
  -- Expediente das 16h às 02h; quem vende depois da meia-noite ainda conta no dia (virada às 05h).
  update app.sales set business_date = p_day,
    created_at = p_day + time '16:00' + random() * interval '10 hours'
  where cash_session_id = v_cash;
  update app.cash_sessions set business_date = p_day, opened_at = p_day + time '15:50',
    closed_at = p_day + interval '1 day' + time '02:20'
  where id = v_cash;
  perform pg_temp.ok('sair', app.operator_logout());
end $$;

-- Produtos do protótipo (PRODUCTS do index.html): preço e custo em centavos, estoque e mínimo da loja 1.
create temp table prod (k text primary key, ean text, name text, cat text, price int, cost int, stock int, min_stock int, vol int);
insert into prod values
  ('p1',  '7896045506873', 'Heineken Long Neck 330ml',       'cervejas',     850,   540,  96, 48, 330),
  ('p2',  '7891149108718', 'Brahma Duplo Malte lata 350ml',  'cervejas',     499,   310,  12, 48, 350),
  ('p3',  '7891991010856', 'Skol lata 350ml',                'cervejas',     450,   280, 140, 72, 350),
  ('p4',  '7891991015073', 'Original 600ml',                 'cervejas',    1190,   720,  36, 24, 600),
  ('p5',  '7891991294942', 'Spaten Long Neck 355ml',         'cervejas',     790,   490,  60, 36, 355),
  ('p6',  '7896052604319', 'Amstel lata 350ml',              'cervejas',     549,   340,  24, 36, 350),
  ('p7',  '7893218000671', 'Smirnoff 998ml',                 'destilados',  4990,  3200,   8,  6, 998),
  ('p8',  '5000291020706', 'Tanqueray London Dry 750ml',     'destilados', 13990,  9800,   4,  3, 750),
  ('p9',  '5000267014005', 'Red Label 1L',                   'destilados', 11990,  8400,   6,  4, 1000),
  ('p10', '7896002100045', 'Velho Barreiro 910ml',           'destilados',  2190,  1350,  14,  8, 910),
  ('p11', '7896090701308', 'Askov Maracujá 900ml',           'destilados',  1990,  1180,   2,  6, 900),
  ('p12', '9002490100070', 'Red Bull 250ml',                 'energeticos', 1090,   690,  48, 24, 250),
  ('p13', '070847811169',  'Monster Energy 473ml',           'energeticos', 1190,   740,  30, 18, 473),
  ('p14', '7898938890039', 'Baly Tradicional 2L',            'energeticos', 1490,   890,  22, 12, 2000),
  ('p15', '7894900027013', 'Coca-Cola 2L',                   'semalcool',   1290,   860,  18, 12, 2000),
  ('p16', '7896065880021', 'Água mineral 500ml',             'semalcool',    300,   110,  60, 24, 500),
  ('p17', '7894900330014', 'Tônica Schweppes 350ml',         'semalcool',    590,   350,  40, 24, 350),
  ('p18', '2000000000018', 'Gelo em cubo 5kg',               'gelo',        1400,   600,  20, 10, null),
  ('p19', '2000000000025', 'Gelo de coco',                   'gelo',         350,   120,  80, 40, null),
  ('p20', '2000000000032', 'Carvão 3kg',                     'gelo',        2200,  1200,  10,  6, null);

-- Lotes com validade (LOTS do protótipo): dias até vencer.
create temp table lots (k text primary key, lot text, qty int, days int);
insert into lots values ('p17','L2309',24,4), ('p1','HK0811',48,9), ('p14','BL771',10,21), ('p4','OR5520',24,38), ('p13','MN204',30,63);

-- Catálogo global da Addegas (E39) ------------------------------------------------------------
insert into platform.catalog_products (ean, name, brand, volume_ml, suggested_category, status)
select ean, name, split_part(name, ' ', 1), vol,
  case cat when 'cervejas' then 'Cervejas' when 'destilados' then 'Destilados' when 'energeticos' then 'Energéticos'
    when 'semalcool' then 'Sem álcool' when 'gelo' then 'Gelo e carvão' else cat end, 'published'
from prod where k not in ('p18','p19','p20');
insert into platform.catalog_products (ean, name, brand, volume_ml, abv, suggested_category, status) values
  ('7891149103102', 'Budweiser lata 350ml',       'Budweiser', 350,  5.0, 'cervejas',    'published'),
  ('7891991015479', 'Corona Extra Long Neck 330ml','Corona',   330,  4.5, 'cervejas',    'published'),
  ('7896045504213', 'Stella Artois Long Neck 330ml','Stella',  330,  5.0, 'cervejas',    'published'),
  ('5099873089798', 'Jack Daniel''s Old No.7 1L', 'Jack Daniel''s', 1000, 40.0, 'destilados', 'published'),
  ('7312040017034', 'Absolut Vodka 1L',           'Absolut',  1000, 40.0, 'destilados',  'published'),
  ('7892840808006', 'Gatorade Limão 500ml',       'Gatorade', 500,  null, 'semalcool',   'published');

-- Dono, conta e lojas (E06, E08) --------------------------------------------------------------
select pg_temp.put('marcos', pg_temp.new_user('marcos@adega.test', 'Marcos Silva'));
select pg_temp.as_user(pg_temp.k('marcos'));
select pg_temp.put('acc', (d ->> 'account_id')::uuid), pg_temp.put('loja1', (d ->> 'store_id')::uuid)
from (select pg_temp.ok('cadastro', app.complete_onboarding('Adega Esquina', 'Vila Madalena', 'São Paulo', '11986755103', 'Marcos Silva')) d) s;
select pg_temp.ok('termos', app.accept_legal(array['termos','privacidade','dpa'], 'v0.1', pg_temp.k('acc')));

-- Assinante ativo, mensal, com uma loja adicional (D02, D03); a próxima cobrança vence em 11 dias.
update platform.subscriptions set status = 'active', access = 'allowed', trial_ends_at = now() - interval '35 days',
  current_period_start = now() - interval '19 days', current_period_end = now() + interval '11 days',
  extra_stores = 1, extra_store_price = 4990, stripe_customer_id = 'cus_seed_esquina'
where account_id = pg_temp.k('acc');

select pg_temp.put('loja2', (pg_temp.ok('loja 2', app.create_store(pg_temp.k('acc'), 'Adega Esquina 2', 'Pinheiros', 'São Paulo', '11986755104')) ->> 'store_id')::uuid);

select pg_temp.ok('ajustes loja 1', app.update_store_settings(pg_temp.k('loja1'), jsonb_build_object(
  'pix_key', '+5511986755103', 'pix_receiver_name', 'Adega Esquina', 'pix_city', 'Sao Paulo',
  'delivery_fee_default', 800, 'free_delivery_above', 15000, 'cash_difference_alert', 1000)));
select pg_temp.ok('ajustes loja 2', app.update_store_settings(pg_temp.k('loja2'), jsonb_build_object(
  'pix_key', '+5511986755104', 'pix_receiver_name', 'Adega Esquina 2', 'pix_city', 'Sao Paulo',
  'delivery_fee_default', 700)));
select pg_temp.ok('catálogo online', app.update_catalog_settings(pg_temp.k('loja1'), true, true, false, 'Entrega grátis acima de R$ 150!'));

-- Equipe (E07, E10): TEAM do protótipo + uma estoquista ------------------------------------
select pg_temp.put('rafa', pg_temp.new_user('rafa@adega.test', 'Rafa Costa'));
select pg_temp.put('diego', pg_temp.new_user('diego@u.adega-esquina.addegas.invalid', 'Diego Alves'));
select pg_temp.put('kaua', pg_temp.new_user('kaua@u.adega-esquina.addegas.invalid', 'Kauã Lima'));
select pg_temp.put('m_rafa',  private.attach_login_member(pg_temp.k('marcos'), pg_temp.k('loja1'), pg_temp.k('rafa'), 'Rafa Costa', 'manager'));
select pg_temp.put('m_rafa2', private.attach_login_member(pg_temp.k('marcos'), pg_temp.k('loja2'), pg_temp.k('rafa'), 'Rafa Costa', 'manager'));
select pg_temp.put('m_diego', private.attach_login_member(pg_temp.k('marcos'), pg_temp.k('loja1'), pg_temp.k('diego'), 'Diego Alves', 'courier'));
select pg_temp.put('m_kaua',  private.attach_login_member(pg_temp.k('marcos'), pg_temp.k('loja1'), pg_temp.k('kaua'), 'Kauã Lima', 'courier'));

select pg_temp.as_user(pg_temp.k('marcos'));
select pg_temp.put('m_bia',  (pg_temp.ok('Bia',  app.create_counter_member(pg_temp.k('loja1'), 'Bia Santos', 'cashier')) ->> 'member_id')::uuid);
select pg_temp.put('m_leo',  (pg_temp.ok('Léo',  app.create_counter_member(pg_temp.k('loja1'), 'Léo Moura', 'cashier')) ->> 'member_id')::uuid);
select pg_temp.put('m_leo2', (pg_temp.ok('Léo 2', app.create_counter_member(pg_temp.k('loja2'), 'Léo Moura', 'cashier')) ->> 'member_id')::uuid);
select pg_temp.put('m_tati', (pg_temp.ok('Tati', app.create_counter_member(pg_temp.k('loja1'), 'Tati Rocha', 'stock_keeper')) ->> 'member_id')::uuid);
select pg_temp.put('m_marcos', (select id from app.store_members where store_id = pg_temp.k('loja1') and user_id = pg_temp.k('marcos')));

-- Aparelhos de caixa já registrados (E09). Para testar o registro, gere um código novo pelo app.
select pg_temp.put('term1', pg_temp.new_user('terminal-esquina-1@terminals.addegas.invalid', 'Balcão 1', 'terminal'));
select pg_temp.put('term2', pg_temp.new_user('terminal-esquina-2@terminals.addegas.invalid', 'Balcão Pinheiros', 'terminal'));
insert into app.terminals (store_id, name, auth_user_id) values
  (pg_temp.k('loja1'), 'Balcão 1', pg_temp.k('term1')),
  (pg_temp.k('loja2'), 'Balcão Pinheiros', pg_temp.k('term2'));

-- Categorias e produtos (E16) -------------------------------------------------------------------
select pg_temp.as_user(pg_temp.k('marcos'));
select pg_temp.put(c.k, (pg_temp.ok('categoria', app.save_category(pg_temp.k('acc'), c.name, c.color, c.sort)) ->> 'category_id')::uuid)
from (values ('cervejas', 'Cervejas', '#F5A800', 1), ('destilados', 'Destilados', '#C084FC', 2),
             ('energeticos', 'Energéticos', '#3DD6C4', 3), ('semalcool', 'Sem álcool', '#60A5FA', 4),
             ('gelo', 'Gelo e carvão', '#94A3B8', 5)) c(k, name, color, sort);

select pg_temp.put(p.k, (pg_temp.ok('produto ' || p.name, app.save_product(pg_temp.k('acc'), jsonb_strip_nulls(jsonb_build_object(
  'name', p.name, 'ean', p.ean, 'price', p.price, 'min_stock', p.min_stock, 'volume_ml', p.vol, 'unit', 'un',
  'category_id', pg_temp.k(p.cat),
  'catalog_product_id', (select id from platform.catalog_products c where c.ean = p.ean))))) ->> 'product_id')::uuid)
from prod p order by p.k;

-- Mínimo por loja e, na loja 2, preço próprio em três produtos (D37: vazio = preço padrão).
select pg_temp.ok('mínimo', app.set_store_product(pg_temp.k('loja1'), pg_temp.k(p.k), null, p.min_stock)) from prod p;
select pg_temp.ok('preço loja 2', app.set_store_product(pg_temp.k('loja2'), pg_temp.k(x.k), x.price, x.min_stock))
from (values ('p1', 890, 24), ('p3', 479, 48), ('p12', 1190, 12)) x(k, price, min_stock);
select pg_temp.ok('mínimo loja 2', app.set_store_product(pg_temp.k('loja2'), pg_temp.k(p.k), null, greatest(p.min_stock / 2, 3)))
from prod p where p.k not in ('p1', 'p3', 'p12');

-- Fornecedores (E27) ----------------------------------------------------------------------------
select pg_temp.put(s.k, (pg_temp.ok('fornecedor', app.save_supplier(pg_temp.k('acc'), jsonb_build_object(
  'name', s.name, 'kind', s.kind, 'phone', s.phone, 'lead_time', s.lead))) ->> 'supplier_id')::uuid)
from (values ('f_zo', 'Distribuidora Zona Oeste', 'Cervejas e refrigerantes', '1133331000', 'Entrega em 1 dia'),
             ('f_lapa', 'Atacadão Lapa', 'Destilados e mercearia', '1134442000', 'Retirada no local'),
             ('f_gelo', 'Gelo Polar', 'Gelo e carvão', '11980003000', 'Entrega diária'),
             ('f_energ', 'Energéticos SP', 'Energéticos', '1135554000', 'Entrega em 2 dias')) s(k, name, kind, phone, lead);

-- Estoque inicial (E17): o que o protótipo mostra hoje. A reposição do fim do arquivo cobre o que foi vendido.
select pg_temp.ok('estoque inicial', app.receive_goods(pg_temp.k('loja1'),
  (select jsonb_agg(jsonb_build_object('product_id', pg_temp.k(k), 'quantity', stock, 'unit_cost', cost)) from prod),
  'Estoque inicial', pg_temp.k('f_zo')));
select pg_temp.ok('estoque loja 2', app.receive_goods(pg_temp.k('loja2'),
  (select jsonb_agg(jsonb_build_object('product_id', pg_temp.k(k), 'quantity', greatest(stock / 2, 6), 'unit_cost', cost)) from prod),
  'Estoque inicial', pg_temp.k('f_zo')));

-- Combos e promoções (E18, E29): COMBOS do protótipo + uma promoção de horário ------------------
select pg_temp.put(b.k, (pg_temp.ok('combo ' || b.name, app.save_bundle(pg_temp.k('acc'), jsonb_build_object(
  'name', b.name, 'kind', 'combo', 'price', b.price, 'active', b.active, 'show_in_catalog', true,
  'items', b.items))) ->> 'bundle_id')::uuid)
from (values
  ('c1', 'Combo Gin Tanqueray', 16990, true, jsonb_build_array(
     jsonb_build_object('product_id', pg_temp.k('p8'), 'quantity', 1), jsonb_build_object('product_id', pg_temp.k('p17'), 'quantity', 4),
     jsonb_build_object('product_id', pg_temp.k('p18'), 'quantity', 1))),
  ('c2', 'Combo Smirnoff + Baly', 6990, true, jsonb_build_array(
     jsonb_build_object('product_id', pg_temp.k('p7'), 'quantity', 1), jsonb_build_object('product_id', pg_temp.k('p14'), 'quantity', 1),
     jsonb_build_object('product_id', pg_temp.k('p19'), 'quantity', 4))),
  ('c3', 'Balde 6 Heineken', 5200, true, jsonb_build_array(
     jsonb_build_object('product_id', pg_temp.k('p1'), 'quantity', 6), jsonb_build_object('product_id', pg_temp.k('p18'), 'quantity', 1))),
  ('c4', 'Combo Red Label + Red Bull', 15990, false, jsonb_build_array(
     jsonb_build_object('product_id', pg_temp.k('p9'), 'quantity', 1), jsonb_build_object('product_id', pg_temp.k('p12'), 'quantity', 4),
     jsonb_build_object('product_id', pg_temp.k('p19'), 'quantity', 4)))
) b(k, name, price, active, items);

select pg_temp.put('c5', (pg_temp.ok('promoção', app.save_bundle(pg_temp.k('acc'), jsonb_build_object(
  'name', 'Happy hour Skol: 12 latas', 'kind', 'promotion', 'price', 4490, 'active', true,
  'weekdays', jsonb_build_array(1, 2, 3, 4), 'start_time', '17:00', 'end_time', '20:00',
  'items', jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p3'), 'quantity', 12))))) ->> 'bundle_id')::uuid);

select pg_temp.ok('acesso rápido', app.set_quick_access(pg_temp.k('loja1'), jsonb_build_array(
  jsonb_build_object('product_id', pg_temp.k('p1'), 'position', 1, 'color', '#F5A800'),
  jsonb_build_object('product_id', pg_temp.k('p3'), 'position', 2),
  jsonb_build_object('bundle_id', pg_temp.k('c3'), 'position', 3, 'color', '#3BD16F'),
  jsonb_build_object('product_id', pg_temp.k('p18'), 'position', 4),
  jsonb_build_object('product_id', pg_temp.k('p12'), 'position', 5),
  jsonb_build_object('product_id', pg_temp.k('p19'), 'position', 6))));

-- Transferência entre lojas (E17)
select pg_temp.ok('transferência', app.transfer_stock(pg_temp.k('loja1'), pg_temp.k('loja2'),
  jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p1'), 'quantity', 24)), 'Reforço para o fim de semana'));

-- 13 dias de vendas (E19, E20, E26): sexta e sábado vendem o dobro ------------------------------
select pg_temp.past_day('loja1', 'term1',
  (array['m_bia','m_leo','m_bia','m_rafa'])[1 + (d % 4)],
  pg_temp.today() - d, case when extract(dow from pg_temp.today() - d) in (5, 6) then 40 else 20 end)
from generate_series(13, 1, -1) d;
select pg_temp.past_day('loja2', 'term2', 'm_leo2', pg_temp.today() - d, 12)
from generate_series(6, 1, -1) d;

-- Hoje na loja 1: caixa aberto pela Bia há 3 horas ---------------------------------------------
select pg_temp.put('s_bia', pg_temp.login('term1', 'm_bia'));
select pg_temp.put('cash1', (pg_temp.ok('abrir caixa hoje', app.open_cash(pg_temp.k('s_bia'), 15000)) ->> 'cash_session_id')::uuid);
select pg_temp.sell(pg_temp.k('loja1'), pg_temp.k('s_bia'), pg_temp.random_items(), pg_temp.random_method())
from generate_series(1, 16);

-- Fiado (E23, D19, D55): CUSTOMERS do protótipo, nome e telefone
select pg_temp.sell(pg_temp.k('loja1'), pg_temp.k('s_bia'), f.items, 'fiado', jsonb_build_object('fiado', jsonb_build_object('name', f.name, 'phone', f.phone)))
from (values
  (1, 'Seu Antônio', '11981112233', '[{"k":"p3","q":12}]'::jsonb),
  (2, 'Seu Antônio', '11981112233', '[{"k":"p18","q":1},{"k":"p20","q":1}]'),
  (3, 'Seu Antônio', '11981112233', '[{"k":"p10","q":1},{"k":"p15","q":2}]'),
  (4, 'Juninho da Oficina', '11972224455', '[{"k":"c3","q":2}]'),
  (5, 'Juninho da Oficina', '11972224455', '[{"k":"p7","q":1},{"k":"p12","q":1}]'),
  (6, 'Juninho da Oficina', '11972224455', '[{"k":"p4","q":4}]'),
  (7, 'Dona Cida', '11963337788', '[{"k":"p15","q":1},{"k":"p16","q":6}]'),
  (8, 'Marina Lopes', '11954441010', '[{"k":"p6","q":6},{"k":"p19","q":1}]'),
  (9, 'Carlos Mendes', '11945552020', '[{"k":"p16","q":2}]')
) f(n, name, phone, items) order by f.n;
select pg_temp.put('fiado_' || split_part(lower(name), ' ', 1), id) from app.fiado_accounts where store_id = pg_temp.k('loja1');

select pg_temp.ok('pagamento fiado', app.receive_fiado_payment(pg_temp.k('s_bia'), pg_temp.k('fiado_seu'), 5000, 'pix'));
select pg_temp.ok('pagamento fiado', app.receive_fiado_payment(pg_temp.k('s_bia'), pg_temp.k('fiado_dona'),
  (select balance from app.fiado_accounts where id = pg_temp.k('fiado_dona')), 'cash'));
select pg_temp.ok('pagamento fiado', app.receive_fiado_payment(pg_temp.k('s_bia'), pg_temp.k('fiado_carlos'),
  (select balance from app.fiado_accounts where id = pg_temp.k('fiado_carlos')), 'pix'));

-- Mesa e comanda abertas (E22)
select pg_temp.put('mesa4', (pg_temp.ok('mesa', app.open_tab(pg_temp.k('s_bia'), 'table', 'Mesa 4')) ->> 'tab_id')::uuid);
select pg_temp.ok('item mesa', app.add_tab_item(pg_temp.k('s_bia'), pg_temp.k('mesa4'), pg_temp.k('p1'), null, 3));
select pg_temp.ok('item mesa', app.add_tab_item(pg_temp.k('s_bia'), pg_temp.k('mesa4'), pg_temp.k('p19'), null, 2));
select pg_temp.put('comanda12', (pg_temp.ok('comanda', app.open_tab(pg_temp.k('s_bia'), 'tab', 'Comanda 12', 'Juninho')) ->> 'tab_id')::uuid);
select pg_temp.ok('item comanda', app.add_tab_item(pg_temp.k('s_bia'), pg_temp.k('comanda12'), null, pg_temp.k('c3'), 1));

-- Sangria, pagamento do entregador e um cancelamento feito pela gerente (E19, E21)
select pg_temp.ok('pagar entregador', app.cash_movement(pg_temp.k('s_bia'), 'courier_payment', 3000, 'Diego · 3 entregas'));
select pg_temp.put('s_rafa', pg_temp.login('term1', 'm_rafa'));
select pg_temp.ok('sangria', app.cash_movement(pg_temp.k('s_rafa'), 'withdrawal', 20000, 'Sangria para o cofre'));
select pg_temp.ok('cancelar', app.cancel_sale(pg_temp.k('s_rafa'),
  (select id from app.sales where cash_session_id = pg_temp.k('cash1') and fiado_account_id is null order by number desc limit 1),
  'Cliente desistiu da compra'));
select pg_temp.put('s_bia', pg_temp.login('term1', 'm_bia'));

-- Vendas de hoje espalhadas nas últimas 3 horas
update app.cash_sessions set opened_at = now() - interval '3 hours' where id = pg_temp.k('cash1');
update app.sales set created_at = now() - random() * interval '170 minutes' where cash_session_id = pg_temp.k('cash1');

-- Hoje na loja 2: caixa aberto pelo Léo
select pg_temp.put('s_leo2', pg_temp.login('term2', 'm_leo2'));
select pg_temp.ok('abrir caixa loja 2', app.open_cash(pg_temp.k('s_leo2'), 10000));
select pg_temp.sell(pg_temp.k('loja2'), pg_temp.k('s_leo2'), pg_temp.random_items(), pg_temp.random_method())
from generate_series(1, 7);

-- Pedidos (E41): ORDERS do protótipo, em várias etapas ------------------------------------------
select pg_temp.as_user(pg_temp.k('marcos'));
select pg_temp.put(o.k, (pg_temp.ok('pedido ' || o.k, app.create_order(pg_temp.k('loja1'), jsonb_strip_nulls(jsonb_build_object(
  'channel', o.channel, 'external_id', o.ext, 'customer_name', o.customer, 'customer_phone', o.phone,
  'mode', o.mode, 'address', o.address, 'payment_hint', o.pay, 'items', o.items)))) ->> 'order_id')::uuid)
from (values
  ('o4813', 'ze_delivery', 'ZE-4813', 'Lucas F.', null, 'platform_delivery', 'R. Fradique Coutinho, 55', 'Pago no app',
     jsonb_build_array(jsonb_build_object('bundle_id', pg_temp.k('c3'), 'quantity', 1))),
  ('o4814', 'whatsapp', null, 'Seu Antônio', '11981112233', 'own_delivery', 'R. Girassol, 45', 'Fiado',
     jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p10'), 'quantity', 1), jsonb_build_object('product_id', pg_temp.k('p15'), 'quantity', 2))),
  ('o4815', 'ifood', 'IF-4815', 'Bruno T.', null, 'platform_delivery', 'R. Mourato Coelho, 900', 'Pago no app',
     jsonb_build_array(jsonb_build_object('bundle_id', pg_temp.k('c3'), 'quantity', 1))),
  ('o4816', 'whatsapp', null, 'Marina L.', '11954441010', 'own_delivery', 'R. Harmonia, 310', 'Dinheiro · troco para R$ 100',
     jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p4'), 'quantity', 6))),
  ('o4817', 'keeta', 'KT-4817', 'Rafael S.', null, 'platform_delivery', 'R. Augusta, 1500', 'Pago no app',
     jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p12'), 'quantity', 4), jsonb_build_object('product_id', pg_temp.k('p19'), 'quantity', 2))),
  ('o4818', 'food99', '99-4818', 'Ana P.', null, 'pickup', null, 'Pago no app',
     jsonb_build_array(jsonb_build_object('bundle_id', pg_temp.k('c1'), 'quantity', 1))),
  ('o4819', 'ze_delivery', 'ZE-4819', 'Pedro H.', null, 'platform_delivery', 'R. Ipiranga, 77', 'Pago no app',
     jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p3'), 'quantity', 12), jsonb_build_object('product_id', pg_temp.k('p20'), 'quantity', 1))),
  ('o4820', 'whatsapp', null, 'Carlos M.', '11945552020', 'own_delivery', 'Av. Brasil, 2040, ap 12', 'Pix na entrega',
     jsonb_build_array(jsonb_build_object('bundle_id', pg_temp.k('c2'), 'quantity', 1))),
  ('o4821', 'ifood', 'IF-4821', 'Juliana R.', null, 'platform_delivery', 'R. das Flores, 128', 'Pago no app',
     jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p1'), 'quantity', 2), jsonb_build_object('product_id', pg_temp.k('p18'), 'quantity', 1)))
) o(k, channel, ext, customer, phone, mode, address, pay, items) order by o.k;

select pg_temp.ok('pedido em preparo', app.set_order_status(pg_temp.k(k), 'preparing'))
from unnest(array['o4813','o4814','o4815','o4816','o4817','o4818']) k;
select pg_temp.ok('pedido pronto', app.set_order_status(pg_temp.k(k), 'ready'))
from unnest(array['o4813','o4814','o4815','o4816']) k;
select pg_temp.ok('entregador', app.assign_courier(pg_temp.k('o4814'), pg_temp.k('m_diego')));
select pg_temp.ok('saiu', app.set_order_status(pg_temp.k('o4814'), 'out_for_delivery'));
select pg_temp.ok('entregue', app.set_order_status(pg_temp.k('o4813'), 'delivered'));
select pg_temp.as_user(pg_temp.k('term1'));
select pg_temp.ok('concluir pedido', app.complete_order(pg_temp.k('o4813'), jsonb_build_object(
  'operator_session_id', pg_temp.k('s_bia'), 'client_request_id', gen_random_uuid(),
  'payments', jsonb_build_array(jsonb_build_object('method', 'pix', 'amount', 5200)))));
update app.orders o set created_at = now() - make_interval(mins => x.ago)
from (values ('o4813', 41), ('o4814', 26), ('o4815', 20), ('o4816', 18), ('o4817', 14), ('o4818', 11),
             ('o4819', 7), ('o4820', 5), ('o4821', 2)) x(k, ago)
where o.id = pg_temp.k(x.k);

-- Reposição (E17): repõe o que foi vendido para o estoque ficar igual ao do protótipo, com os lotes e validades.
select pg_temp.as_user(pg_temp.k('marcos'));
select pg_temp.ok('reposição', app.receive_goods(pg_temp.k('loja1'), (
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('product_id', pg_temp.k(p.k),
    'quantity', p.stock - coalesce(s.quantity, 0), 'unit_cost', p.cost,
    'lot_code', l.lot, 'expires_on', pg_temp.today() + l.days)))
  from prod p
  left join app.product_stock s on s.store_id = pg_temp.k('loja1') and s.product_id = pg_temp.k(p.k)
  left join lots l on l.k = p.k
  where p.stock > coalesce(s.quantity, 0)), 'Reposição da semana', pg_temp.k('f_zo')));
-- Loja 2: metade do estoque da loja 1 (mínimo de 6), também com tudo reposto.
select pg_temp.ok('reposição loja 2', app.receive_goods(pg_temp.k('loja2'), (
  select jsonb_agg(jsonb_build_object('product_id', pg_temp.k(p.k),
    'quantity', greatest(p.stock / 2, 6) - coalesce(s.quantity, 0), 'unit_cost', p.cost))
  from prod p
  left join app.product_stock s on s.store_id = pg_temp.k('loja2') and s.product_id = pg_temp.k(p.k)
  where greatest(p.stock / 2, 6) > coalesce(s.quantity, 0)), 'Reposição da semana', pg_temp.k('f_zo')));

-- Compras e contas (E27, E28): BILLS do protótipo --------------------------------------------
select pg_temp.ok('pedido de compra', app.save_purchase_order(pg_temp.k('loja1'), pg_temp.k('f_zo'), jsonb_build_array(
  jsonb_build_object('product_id', pg_temp.k('p2'), 'quantity', 48, 'unit_cost_estimate', 310),
  jsonb_build_object('product_id', pg_temp.k('p6'), 'quantity', 24, 'unit_cost_estimate', 340)),
  'sent', pg_temp.today() + 1, 'Pedido pelo WhatsApp do vendedor'));
select pg_temp.ok('pedido de compra', app.save_purchase_order(pg_temp.k('loja1'), pg_temp.k('f_lapa'), jsonb_build_array(
  jsonb_build_object('product_id', pg_temp.k('p11'), 'quantity', 12, 'unit_cost_estimate', 1180)), 'draft'));

select pg_temp.put(b.k, (pg_temp.ok('conta ' || b.descr, app.save_bill(pg_temp.k('loja1'), jsonb_strip_nulls(jsonb_build_object(
  'description', b.descr, 'amount', b.amount, 'due_on', pg_temp.today() + b.days, 'category', b.cat,
  'supplier_id', pg_temp.k(b.supplier), 'recurring_monthly', b.recurring,
  'interest_kind', b.interest, 'interest_value', b.interest_value)))) ->> 'bill_id')::uuid)
from (values
  ('b5', 'Atacadão Lapa · NF 5521',             71240, -3, 'Fornecedor', 'f_lapa', false, 'pct_month', 2),
  ('b1', 'Distribuidora Zona Oeste · NF 88213', 184000, 1, 'Fornecedor', 'f_zo',   false, 'none', null),
  ('b3', 'Gelo Polar · semanal',                32000,  2, 'Fornecedor', 'f_gelo', false, 'none', null),
  ('b2', 'Aluguel do ponto',                    260000, 4, 'Fixa',       null,     true,  'pct_month', 1),
  ('b4', 'Energia elétrica',                    48630,  9, 'Fixa',       null,     true,  'none', null),
  ('b6', 'Plano Addegas',                       14990, 11, 'Fixa',       null,     true,  'none', null),
  ('b0', 'Gelo Polar · semana passada',         29000, -6, 'Fornecedor', 'f_gelo', false, 'none', null)
) b(k, descr, amount, days, cat, supplier, recurring, interest, interest_value);
select pg_temp.ok('conta paga', app.pay_bill(pg_temp.k('b0'), 'pix', pg_temp.today() - 6));

-- Fiado: limites e datas combinadas (CUSTOMERS do protótipo)
select pg_temp.ok('limite', app.update_fiado(pg_temp.k('loja1'), pg_temp.k(f.k), f.lim, pg_temp.today() + f.days, f.note))
from (values ('fiado_seu', 30000, 10, 'Paga no dia 10, quando recebe a aposentadoria'),
             ('fiado_juninho', 25000, -2, 'Prometeu acertar no fim do mês'),
             ('fiado_dona', 20000, null, null),
             ('fiado_marina', 15000, 5, null),
             ('fiado_carlos', 0, null, 'Só à vista por enquanto')) f(k, lim, days, note);

-- Lucro no Copo (E30) e anotações
select pg_temp.ok('drink', app.save_drink_recipe(pg_temp.k('acc'), jsonb_build_object('name', d.name, 'sale_price', d.price, 'items', d.items)))
from (values
  ('Gin tônica', 2800, jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p8'), 'amount', 50, 'unit', 'ml'),
     jsonb_build_object('product_id', pg_temp.k('p17'), 'amount', 200, 'unit', 'ml'), jsonb_build_object('product_id', pg_temp.k('p19'), 'amount', 2, 'unit', 'un'))),
  ('Vodka com Baly', 1800, jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p7'), 'amount', 60, 'unit', 'ml'),
     jsonb_build_object('product_id', pg_temp.k('p14'), 'amount', 200, 'unit', 'ml'), jsonb_build_object('product_id', pg_temp.k('p19'), 'amount', 1, 'unit', 'un'))),
  ('Whisky com Red Bull', 3000, jsonb_build_array(jsonb_build_object('product_id', pg_temp.k('p9'), 'amount', 50, 'unit', 'ml'),
     jsonb_build_object('product_id', pg_temp.k('p12'), 'amount', 250, 'unit', 'ml'), jsonb_build_object('product_id', pg_temp.k('p19'), 'amount', 2, 'unit', 'un')))
) d(name, price, items);

insert into app.notes (store_id, author_id, title, body, priority, pinned, done) values
  (pg_temp.k('loja1'), pg_temp.k('marcos'), 'Pedir mais gelo para sexta', 'Jogo às 21h: dobrar o pedido da Gelo Polar.', 'alta', true, false),
  (pg_temp.k('loja1'), pg_temp.k('marcos'), 'Trocar a lâmpada do freezer 2', null, 'media', false, false),
  (pg_temp.k('loja1'), pg_temp.k('rafa'), 'Conferir a NF 88213 com a Distribuidora', 'Veio uma caixa de Amstel a menos.', 'baixa', false, true);

-- Chamado de suporte (E38)
select pg_temp.ok('chamado', app.open_ticket(pg_temp.k('acc'), pg_temp.k('loja1'), 'duvida', 'Como imprimir o cupom?',
  'Comprei uma impressora térmica de 80 mm e não sei configurar.', 'atrapalha'));

-- Outra adega, em carência de pagamento (para testar isolamento e o aviso de cobrança) ---------
select pg_temp.put('joana', pg_temp.new_user('joana@porto.test', 'Joana Prado'));
select pg_temp.as_user(pg_temp.k('joana'));
select pg_temp.put('acc_porto', (d ->> 'account_id')::uuid), pg_temp.put('loja_porto', (d ->> 'store_id')::uuid)
from (select pg_temp.ok('cadastro Porto', app.complete_onboarding('Adega do Porto', 'Gonzaga', 'Santos', '13991234567', 'Joana Prado')) d) s;
select pg_temp.put('porto_' || x.k, (pg_temp.ok('produto Porto', app.save_product(pg_temp.k('acc_porto'),
  jsonb_build_object('name', x.name, 'price', x.price, 'unit', 'un'))) ->> 'product_id')::uuid)
from (values ('a', 'Heineken Long Neck 330ml', 900), ('b', 'Skol lata 350ml', 480), ('c', 'Gelo 5kg', 1500)) x(k, name, price);
update platform.subscriptions set status = 'past_due', access = 'grace', trial_ends_at = now() - interval '40 days',
  current_period_start = now() - interval '33 days', current_period_end = now() - interval '3 days',
  grace_ends_at = now() + interval '4 days'
where account_id = pg_temp.k('acc_porto');

-- Equipe Addegas (E11): entra no painel depois de cadastrar o 2FA ------------------------------
select pg_temp.put('admin', pg_temp.new_user('admin@addegas.com.br', 'Admin Addegas', 'staff'));
select pg_temp.ok('equipe', private.admin_staff_upsert(null, 'seed', pg_temp.k('admin'), 'Admin Addegas', 'admin@addegas.com.br', 'master'));

-- Alertas: os de estoque baixo criados durante a simulação já não valem depois da reposição.
delete from app.alerts a using app.product_stock s, app.store_products sp
where a.type = 'stock_low' and a.entity = 'product'
  and s.store_id = a.store_id and s.product_id = a.entity_id::uuid
  and sp.store_id = a.store_id and sp.product_id = a.entity_id::uuid
  and s.quantity > coalesce(sp.min_stock, 0);

-- Avisos de abertura e fechamento de caixa dos dias anteriores já foram vistos.
update app.alerts a set read_at = cs.closed_at, read_by = pg_temp.k('marcos')
from app.cash_sessions cs
where a.entity = 'cash_session' and cs.id = a.entity_id::uuid and cs.business_date < pg_temp.today();

-- Painel Addegas (etapa 12): equipe com os cinco perfis e o lado da equipe (cobranças, tickets, CRM, ocorrências) ----
-- Senha de todos: addegas123. Cada pessoa cadastra o 2FA (aplicativo autenticador) no primeiro acesso ao painel.
create function pg_temp.staff(p_email text, p_name text, p_role text) returns uuid language plpgsql as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  if v is null then
    v := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
      phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
      extensions.crypt('addegas123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"],"kind":"staff"}'::jsonb, jsonb_build_object('name', p_name), now(), now(),
      '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v, v::text, jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true),
      'email', now(), now(), now());
  end if;
  perform private.admin_staff_upsert(null, 'seed', v, p_name, p_email, p_role);
  return v;
end $$;
select pg_temp.staff('caio@addegas.com.br', 'Caio Brandão', 'finance'), pg_temp.staff('lia@addegas.com.br', 'Lia Santos', 'support'),
  pg_temp.staff('rafael@addegas.com.br', 'Rafael Okada', 'commercial'), pg_temp.staff('nina@addegas.com.br', 'Nina Torres', 'analyst');

create temp table adm as select
  (select id from app.accounts where name = 'Adega Esquina') esquina,
  (select id from app.accounts where name = 'Adega do Porto') porto,
  (select id from app.stores where name = 'Adega Esquina') loja1,
  (select id from app.stores where name = 'Adega do Porto') loja_porto,
  (select id from auth.users where email = 'marcos@adega.test') marcos,
  (select id from auth.users where email = 'joana@porto.test') joana,
  (select id from auth.users where email = 'admin@addegas.com.br') admin,
  (select id from auth.users where email = 'lia@addegas.com.br') lia,
  (select id from auth.users where email = 'rafael@addegas.com.br') rafael,
  (select id from auth.users where email = 'caio@addegas.com.br') caio;

-- Cobranças: Adega Esquina em dia (paga o ciclo atual, a próxima vence no fim dele); Porto com a fatura vencida.
insert into platform.subscription_events (subscription_id, from_status, to_status, from_access, to_access, reason, author, created_at)
select s.id, 'trial', 'active', 'allowed', 'allowed', 'Pagamento confirmado no fim do teste', 'stripe', s.current_period_start
from platform.subscriptions s, adm where s.account_id = adm.esquina;
insert into platform.invoices (account_id, stripe_invoice_id, amount, status, due_at, paid_at, period_start, period_end, created_at)
select s.account_id, 'in_seed_esquina_1', s.price + s.extra_stores * s.extra_store_price, 'paid', s.current_period_start,
  s.current_period_start + interval '2 hours', s.current_period_start, s.current_period_end, s.current_period_start - interval '3 days'
from platform.subscriptions s, adm where s.account_id = adm.esquina;
insert into platform.payments (invoice_id, account_id, amount, source, method, paid_at, stripe_payment_id)
select i.id, i.account_id, i.amount, 'stripe', 'card', i.paid_at, 'pi_seed_esquina_1' from platform.invoices i where i.stripe_invoice_id = 'in_seed_esquina_1';
insert into platform.invoices (account_id, stripe_invoice_id, amount, status, due_at, period_start, period_end, created_at)
select s.account_id, 'in_seed_esquina_2', s.price + s.extra_stores * s.extra_store_price, 'open', s.current_period_end,
  s.current_period_end, s.current_period_end + interval '1 month', now()
from platform.subscriptions s, adm where s.account_id = adm.esquina;
insert into platform.subscription_events (subscription_id, from_status, to_status, from_access, to_access, reason, author, created_at)
select s.id, 'trial', 'active', 'allowed', 'allowed', 'Pagamento confirmado no fim do teste', 'stripe', s.current_period_start
from platform.subscriptions s, adm where s.account_id = adm.porto;
insert into platform.invoices (account_id, stripe_invoice_id, amount, status, due_at, paid_at, period_start, period_end, created_at)
select s.account_id, 'in_seed_porto_1', s.price, 'paid', s.current_period_start, s.current_period_start + interval '1 hour',
  s.current_period_start, s.current_period_end, s.current_period_start - interval '3 days'
from platform.subscriptions s, adm where s.account_id = adm.porto;
insert into platform.payments (invoice_id, account_id, amount, source, method, paid_at, stripe_payment_id)
select i.id, i.account_id, i.amount, 'stripe', 'pix', i.paid_at, 'pi_seed_porto_1' from platform.invoices i where i.stripe_invoice_id = 'in_seed_porto_1';
insert into platform.invoices (account_id, stripe_invoice_id, amount, status, due_at, period_start, period_end, created_at)
select s.account_id, 'in_seed_porto_2', s.price, 'open', s.current_period_end, s.current_period_end, s.current_period_end + interval '1 month',
  s.current_period_end - interval '3 days'
from platform.subscriptions s, adm where s.account_id = adm.porto;
insert into platform.subscription_events (subscription_id, from_status, to_status, from_access, to_access, reason, author, created_at)
select s.id, 'active', 'past_due', 'allowed', 'grace', 'Cobrança não paga no vencimento: carência de 5 dias', 'job:billing', s.current_period_end
from platform.subscriptions s, adm where s.account_id = adm.porto;

-- Desconto de indicação para a Adega Esquina.
select private.admin_discount_create(adm.caio, 'finance', array[adm.esquina], 'pct', 10, 3, false, now() - interval '20 days',
  'Indicação: trouxe a Adega do Porto') from adm;
insert into platform.account_notes (account_id, staff_user_id, body, created_at)
select adm.esquina, adm.rafael, 'Marcos pediu para avisar quando sair o relatório por funcionário.', now() - interval '2 days' from adm;

-- Tickets com conversa, nota interna e uma melhoria agrupada.
insert into support.improvements (title, area, status, created_by) select 'Relatório de vendas por funcionário e turno', 'Relatórios', 'analise', adm.lia from adm;
with t as (
  insert into support.tickets (account_id, store_id, opened_by, kind, subject, description, priority, status, assignee, correlation_ids,
    first_response_at, created_at, updated_at)
  select adm.esquina, adm.loja1, adm.marcos, 'problema', 'Caixa', 'Caixa travou ao finalizar venda no Pix e o cliente teve que pagar de novo.',
    'critica', 'em_andamento', adm.lia, array['c-cx-7781'], now() - interval '75 minutes', now() - interval '95 minutes', now() - interval '40 minutes'
  from adm returning id)
insert into support.ticket_messages (ticket_id, author_id, side, body, internal, created_at)
select t.id, x.who, x.side, x.body, x.internal, now() - x.ago from t, adm,
  lateral (values (adm.lia, 'equipe', 'Oi Marcos, já estamos olhando. Consegue mandar o horário da venda?', false, interval '75 minutes'),
                  (adm.marcos, 'cliente', 'Foi 12:58, venda de R$ 86,40.', false, interval '67 minutes'),
                  (adm.lia, 'equipe', 'Correlação c-cx-7781. Timeout no retorno do Pix. Encaminhar ao time técnico se repetir.', true, interval '55 minutes'))
  x(who, side, body, internal, ago);
insert into support.tickets (account_id, store_id, opened_by, kind, subject, description, priority, status, improvement_id, created_at, updated_at)
select adm.esquina, adm.loja1, adm.marcos, 'melhoria', 'Relatórios', 'Relatório de vendas por funcionário no fim do turno.', 'baixa', 'novo',
  (select id from support.improvements order by number limit 1), now() - interval '4 days', now() - interval '4 days' from adm;
insert into support.tickets (account_id, store_id, opened_by, kind, subject, description, priority, status, created_at, updated_at)
select adm.porto, adm.loja_porto, adm.joana, 'financeiro', 'Pagamento', 'Paguei ontem e o sistema diz que estou em carência.', 'alta', 'novo',
  now() - interval '3 hours', now() - interval '3 hours' from adm;

-- CRM: leads em várias etapas, com histórico, uma tarefa atrasada e um perdido.
insert into platform.leads (name, store_name, phone, email, neighborhood, city, source, campaign, utm, stage, owner_staff, next_task, next_task_at,
  lost_reason, lost_detail, lost_at, created_at)
select x.resp, x.nome, x.tel, x.email, x.bairro, 'São Paulo', x.origem, x.camp, coalesce(x.utm, '{}'), x.etapa, adm.rafael, x.prox,
  case when x.prox is null then null else now() + x.quando end, x.perdido, x.det, case when x.perdido is null then null else now() - interval '20 days' end,
  now() - x.criado
from adm, (values
  ('Otávio Reis', 'Adega Brooklin', '11981112030', 'otavio@adegabrooklin.com.br', 'Brooklin', 'Meta Ads', 'Teste grátis outubro',
   '{"source":"facebook","medium":"cpc","campaign":"teste-gratis-out"}'::jsonb, 'novo', 'Primeiro contato por WhatsApp', interval '2 hours', null, null, interval '1 day'),
  ('Mirela Antunes', 'Adega Saúde 24h', '11994201187', null, 'Saúde', 'Google', 'Sistema para adega',
   '{"source":"google","medium":"cpc","campaign":"sistema-adega"}'::jsonb, 'novo', 'Ligar para apresentar', interval '2 days', null, null, interval '12 hours'),
  ('Sérgio Kato', 'Empório Vila Prudente', '11973004411', null, 'Vila Prudente', 'Instagram', 'Reels do caixa',
   '{"source":"instagram","medium":"social","campaign":"reels-caixa"}'::jsonb, 'contato', 'Enviar vídeo do caixa', interval '-1 day', null, null, interval '5 days'),
  ('Beatriz Nogueira', 'Adega Aclimação', '11987651200', null, 'Aclimação', 'Indicação', 'Indicação Adega Esquina', null, 'demo',
   'Demonstração por vídeo', interval '3 days', null, null, interval '8 days'),
  ('Leandro Souza', 'Adega Ipiranga', '11955103320', null, 'Ipiranga', 'Google', 'Sistema para adega',
   '{"source":"google","medium":"cpc","campaign":"sistema-adega"}'::jsonb, 'contato', null, null, 'Já usa outro sistema',
   'Contrato com outro fornecedor até março de 2027.', interval '25 days')
) x(resp, nome, tel, email, bairro, origem, camp, utm, etapa, prox, quando, perdido, det, criado);
insert into platform.lead_events (lead_id, kind, body, staff_user_id, created_at)
select l.id, 'Site', 'Pediu teste grátis pelo formulário.', null, l.created_at from platform.leads l where l.store_name in ('Adega Brooklin', 'Adega Saúde 24h');
insert into platform.lead_events (lead_id, kind, body, staff_user_id, created_at)
select l.id, 'WhatsApp', 'Expliquei integração com iFood e Zé Delivery. Pediu um vídeo.', adm.rafael, l.created_at + interval '1 day'
from platform.leads l, adm where l.store_name = 'Empório Vila Prudente';
insert into platform.lead_events (lead_id, kind, body, staff_user_id, created_at)
select l.id, 'Ligação', 'Agendada demonstração por vídeo.', adm.rafael, l.created_at + interval '1 day'
from platform.leads l, adm where l.store_name = 'Adega Aclimação';
insert into platform.lead_events (lead_id, kind, body, staff_user_id, created_at)
select l.id, 'Sistema', 'Perdido: Já usa outro sistema. Contrato com outro fornecedor até março de 2027.', adm.rafael, now() - interval '20 days'
from platform.leads l, adm where l.store_name = 'Adega Ipiranga';
insert into platform.marketing_spend (channel, period_start, period_end, amount, note, staff_user_id)
select x.c, date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, x.v, 'informado manualmente', adm.rafael
from adm, (values ('Google', 240000), ('Meta Ads', 180000), ('Evento', 150000)) x(c, v);

-- Ocorrências do sistema nas três camadas, ligadas pela correlação.
insert into audit.system_logs (created_at, source, level, code, message, correlation_id, account_id, store_id, context)
select now() - x.ago, x.src, x.lvl, x.code, x.msg, x.corr, case when x.acc then adm.esquina end, case when x.acc then adm.loja1 end, x.ctx
from adm, (values
  (interval '100 minutes', 'front', 'error', 'PIX_TIMEOUT', 'Timeout aguardando confirmação do Pix (12 s)', 'c-cx-7781', true,
   '{"module":"Caixa","route":"/caixa","version":"web dev","device":"Android · Chrome"}'::jsonb),
  (interval '100 minutes', 'back', 'error', 'PIX_GATEWAY_TIMEOUT', 'Gateway Pix: timeout de 12 000 ms ao confirmar a cobrança', 'c-cx-7781', true,
   '{"module":"Pagamentos","route":"api","version":"api dev"}'::jsonb),
  (interval '5 hours', 'front', 'warn', 'SLOW_LCP', 'Carregamento lento: LCP de 4,8 s', 'c-rel-8807', true,
   '{"module":"Relatórios","route":"/relatorios","version":"web dev","device":"Windows · Edge"}'::jsonb),
  (interval '7 hours', 'back', 'warn', 'WEBHOOK_SIGNATURE', 'Webhook de pagamento sem assinatura válida: descartado', 'c-pay-5519', false,
   '{"module":"Webhooks","route":"webhook","version":"api dev"}'::jsonb),
  (interval '9 hours', 'security', 'warn', 'LOGIN_FAILED', '3 senhas inválidas para n***@addegas.com.br', 'c-auth-3301', false,
   '{"module":"Login","route":"auth","ip":"189.40.xxx.xxx"}'::jsonb),
  (interval '20 hours', 'security', 'info', 'FORBIDDEN_ACTION', 'Analista tentou abrir Descontos: bloqueado no servidor', 'c-authz-3290', false,
   '{"module":"Acesso negado","route":"authz"}'::jsonb)
) x(ago, src, lvl, code, msg, corr, acc, ctx);
insert into platform.log_triage (log_id, status, assignee, history)
select l.id, 'investigando', adm.lia, jsonb_build_array(jsonb_build_object('when', now() - interval '80 minutes', 'who', 'Lia Santos',
  't', 'status: aberto → investigando · responsável: — → Lia Santos'))
from audit.system_logs l, adm where l.correlation_id = 'c-cx-7781';

-- Brindes: estoque inicial e um envio de exemplo pronto para despachar.
update platform.gift_items set qty = x.q from (values ('adesivo', 420), ('copo', 38), ('camiseta', 22), ('bone', 9), ('placa', 6),
  ('avental', 14), ('abridor', 120)) x(c, q) where code = x.c;

-- Um aviso de serviço já enviado pela central.
select private.admin_send(adm.caio, 'finance', 'cobranca_proxima', array['whatsapp'], array[adm.esquina], now()) from adm;

commit;
