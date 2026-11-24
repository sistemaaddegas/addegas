-- Addegas · massa de teste: 10 adegas usando o sistema a fundo
--
-- Roda POR CIMA do seed (não apaga nada, nem o 2FA de quem já cadastrou):
--   npm run db:massa
-- Depois de um `npm run db:reset`, rode de novo. Rodar duas vezes seguidas para com aviso.
--
-- Serve para ver o sistema com volume de cliente real: toda lista passa de 25 registros
-- nas adegas grandes (aparece a paginação "Mostrando 1–25 de N") e fica abaixo disso nas
-- pequenas (só a contagem). Tudo passa pelas RPCs do sistema (venda, estoque, fiado, pedidos,
-- compras, contas, chamados), então saldos, números, custo médio e auditoria ficam coerentes.
--
-- Acessos (senha de todos: addegas123), também em ACESSOS-DE-TESTE.md:
--   <slug>@massa.test          dono da adega (todas as lojas da conta)
--   gerente.<slug>@massa.test  gerente em todas as lojas da conta
-- slugs: bomgole, vilarica, paulista24, chico, lapagelada, copocheio, pontofrio, santomalte, butanta, noitefeliz
-- No caixa (sem login) cada loja tem a própria equipe; a pessoa toca no próprio nome.

begin;

do $$ begin
  if exists (select 1 from auth.users where email like '%@massa.test') then
    raise exception 'A massa de teste já está carregada. Para carregar de novo do zero: npm run db:reset e depois npm run db:massa.';
  end if;
  if not exists (select 1 from auth.users where email = 'caio@addegas.com.br') then
    raise exception 'Rode o seed antes (npm run db:reset): a massa usa a equipe Addegas criada por ele.';
  end if;
end $$;

select setseed(0.2026); -- sorteio quase igual a cada carga
set local timezone = 'America/Sao_Paulo';
create function pg_temp.today() returns date language sql as $$ select (localtimestamp - interval '5 hours')::date $$;

create function pg_temp.ok(p_label text, r jsonb) returns jsonb language plpgsql as $$
begin
  if coalesce(r ->> 'ok', 'false') <> 'true' then raise exception 'massa: % falhou: %', p_label, r; end if;
  return r -> 'data';
end $$;

create function pg_temp.new_user(p_email text, p_name text, p_kind text default null) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
    phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
    extensions.crypt('addegas123', extensions.gen_salt('bf', 4)), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
      || case when p_kind is null then '{}'::jsonb else jsonb_build_object('kind', p_kind) end,
    jsonb_build_object('name', p_name), now(), now(), '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v, v::text, jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now());
  return v;
end $$;

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'app_metadata', (select raw_app_meta_data from auth.users where id = p_user))::text, true);
$$;

create function pg_temp.login(p_terminal uuid, p_member uuid) returns uuid language plpgsql as $$
begin
  perform pg_temp.as_user(p_terminal);
  return (pg_temp.ok('caixa', app.operator_login(p_member)) ->> 'operator_session_id')::uuid;
end $$;

create function pg_temp.pick(a text[]) returns text language sql volatile as $$ select a[1 + floor(random() * array_length(a, 1))::int] $$;
create function pg_temp.rnd(p_min int, p_max int) returns int language sql volatile as $$ select p_min + floor(random() * (p_max - p_min + 1))::int $$;

create function pg_temp.pessoa() returns text language sql volatile as $$
  select pg_temp.pick(array['Ana','Bruno','Carla','Diego','Eduarda','Felipe','Gabriela','Henrique','Isabela','João','Karina','Lucas',
    'Mariana','Nicolas','Olívia','Paulo','Rafael','Sabrina','Thiago','Vinícius','Wesley','Yasmin','Beatriz','Caio','Daniela','Enzo',
    'Fernanda','Gustavo','Helena','Igor','Júlia','Leonardo','Larissa','Mateus','Natália','Otávio','Priscila','Renato','Simone',
    'Tânia','Valter','Vanessa','Rodrigo','Camila','André','Letícia','Marcelo','Aline','Sérgio','Juliana'])
    || ' ' || pg_temp.pick(array['Silva','Souza','Oliveira','Santos','Lima','Pereira','Costa','Ferreira','Rodrigues','Almeida',
    'Nascimento','Araújo','Ribeiro','Carvalho','Gomes','Martins','Rocha','Barbosa','Teixeira','Moreira','Cardoso','Mendes',
    'Freitas','Dias','Castro','Nunes','Moura','Pinto','Ramos','Vieira'])
$$;

-- EAN-13 com dígito verificador (prefixo 789 8, inventado para a massa).
create function pg_temp.ean13(p_prefix text, p int) returns text language sql immutable as $$
  with b as (select p_prefix || lpad(p::text, 12 - length(p_prefix), '0') s)
  select s || ((10 - (select sum(substr(s, i, 1)::int * case when i % 2 = 0 then 3 else 1 end) from generate_series(1, 12) i) % 10) % 10)::text
  from b
$$;

-- Venda no caixa. p_items: [{product_id|bundle_id, quantity}]. Dinheiro paga arredondado para cima (gera troco).
create function pg_temp.sell(p_store uuid, p_session uuid, p_items jsonb, p_method text, p_extra jsonb default '{}')
returns jsonb language plpgsql as $$
declare it jsonb; v_total bigint := 0; v_pay bigint;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (it ->> 'quantity')::numeric * case when it ? 'bundle_id'
      then private.bundle_price(p_store, (it ->> 'bundle_id')::uuid) else private.effective_price(p_store, (it ->> 'product_id')::uuid) end;
  end loop;
  v_pay := case when p_method = 'cash' then ceil(v_total / 1000.0)::bigint * 1000 else v_total end;
  return pg_temp.ok('venda', app.finalize_sale(jsonb_build_object('operator_session_id', p_session,
    'client_request_id', gen_random_uuid(), 'items', p_items,
    'payments', jsonb_build_array(jsonb_build_object('method', p_method, 'amount', v_pay))) || p_extra));
end $$;

create function pg_temp.random_method() returns text language sql volatile as $$
  select (array['pix','pix','pix','pix','debit','debit','credit','credit','cash','cash'])[1 + floor(random() * 10)::int];
$$;

-- Catálogo Addegas (E39) com volume: ~170 produtos novos, mais uns rascunhos ---------------------------
create temp table cat (n serial, name text, brand text, cat text, vol int, abv numeric, price int, ean text);
insert into cat (name, brand, cat, vol, abv, price)
select b.brand || ' ' || f.fmt, b.brand, 'Cervejas', f.vol, b.abv, (round(b.lata * f.mult / 10.0) * 10)::int
from (values ('Heineken', 5.0, 650), ('Brahma Chopp', 4.8, 450), ('Skol Pilsen', 4.7, 420), ('Original', 4.9, 520),
  ('Spaten', 5.2, 560), ('Amstel', 5.0, 500), ('Budweiser', 5.0, 520), ('Corona Extra', 4.5, 700), ('Stella Artois', 5.0, 650),
  ('Itaipava', 4.5, 380), ('Petra Puro Malte', 4.6, 420), ('Eisenbahn Pilsen', 4.8, 600), ('Bohemia', 5.0, 480),
  ('Colorado Appia', 5.5, 900), ('Baden Baden Golden', 4.8, 950), ('Devassa Puro Malte', 4.6, 450), ('Antarctica Subzero', 4.6, 400),
  ('Beck''s', 4.9, 600), ('Michelob Ultra', 4.2, 650), ('Patagonia Amber Lager', 4.5, 750)) b(brand, abv, lata)
cross join (values ('lata 350ml', 350, 1.0), ('long neck 330ml', 330, 1.3), ('garrafa 600ml', 600, 1.9), ('latão 473ml', 473, 1.3)) f(fmt, vol, mult);
insert into cat (name, brand, cat, vol, abv, price) values
  ('Smirnoff Ice 275ml', 'Smirnoff', 'Destilados', 275, 5.0, 990), ('Absolut Vodka 750ml', 'Absolut', 'Destilados', 750, 40, 9990),
  ('Ciroc Vodka 750ml', 'Ciroc', 'Destilados', 750, 40, 22990), ('Orloff Vodka 1L', 'Orloff', 'Destilados', 1000, 37.5, 3290),
  ('Skyy Vodka 980ml', 'Skyy', 'Destilados', 980, 40, 5990), ('Ketel One 1L', 'Ketel One', 'Destilados', 1000, 40, 13990),
  ('Beefeater London Dry 750ml', 'Beefeater', 'Destilados', 750, 40, 11990), ('Bombay Sapphire 750ml', 'Bombay', 'Destilados', 750, 47, 14990),
  ('Gordon''s London Dry 750ml', 'Gordon''s', 'Destilados', 750, 37.5, 8990), ('Hendrick''s 750ml', 'Hendrick''s', 'Destilados', 750, 41.4, 24990),
  ('Seagers Gin 980ml', 'Seagers', 'Destilados', 980, 37.5, 4990), ('Black Label 1L', 'Johnnie Walker', 'Destilados', 1000, 40, 21990),
  ('Ballantine''s Finest 1L', 'Ballantine''s', 'Destilados', 1000, 40, 9990), ('Chivas Regal 12 anos 1L', 'Chivas', 'Destilados', 1000, 40, 19990),
  ('White Horse 1L', 'White Horse', 'Destilados', 1000, 40, 8990), ('Old Parr 12 anos 1L', 'Old Parr', 'Destilados', 1000, 40, 18990),
  ('Jameson 750ml', 'Jameson', 'Destilados', 750, 40, 13990), ('Jack Daniel''s Honey 1L', 'Jack Daniel''s', 'Destilados', 1000, 35, 17990),
  ('Cachaça 51 965ml', '51', 'Destilados', 965, 39, 1690), ('Ypióca Prata 965ml', 'Ypióca', 'Destilados', 965, 39, 2190),
  ('Sagatiba Pura 700ml', 'Sagatiba', 'Destilados', 700, 38, 3490), ('Salinas Tradicional 600ml', 'Salinas', 'Destilados', 600, 42, 4290),
  ('Seleta Ouro 1L', 'Seleta', 'Destilados', 1000, 42, 5490), ('Bacardi Carta Blanca 980ml', 'Bacardi', 'Destilados', 980, 39, 6990),
  ('Montilla Carta Branca 1L', 'Montilla', 'Destilados', 1000, 39, 3290), ('José Cuervo Especial 750ml', 'José Cuervo', 'Destilados', 750, 38, 12990),
  ('Jägermeister 700ml', 'Jägermeister', 'Destilados', 700, 35, 14990), ('Baileys 750ml', 'Baileys', 'Destilados', 750, 17, 12990),
  ('Campari 998ml', 'Campari', 'Destilados', 998, 24, 6490), ('Aperol 750ml', 'Aperol', 'Destilados', 750, 11, 5990),
  ('Martini Bianco 750ml', 'Martini', 'Destilados', 750, 15, 4990), ('Contini 900ml', 'Contini', 'Destilados', 900, 14, 2490),
  ('Red Bull 355ml', 'Red Bull', 'Energéticos', 355, null, 1390), ('Red Bull 473ml', 'Red Bull', 'Energéticos', 473, null, 1690),
  ('Red Bull Tropical 250ml', 'Red Bull', 'Energéticos', 250, null, 1090), ('Red Bull Sugarfree 250ml', 'Red Bull', 'Energéticos', 250, null, 1090),
  ('Monster Mango Loco 473ml', 'Monster', 'Energéticos', 473, null, 1190), ('Monster Ultra 473ml', 'Monster', 'Energéticos', 473, null, 1190),
  ('Monster Pipeline Punch 473ml', 'Monster', 'Energéticos', 473, null, 1190), ('TNT Energy 269ml', 'TNT', 'Energéticos', 269, null, 690),
  ('TNT Energy 473ml', 'TNT', 'Energéticos', 473, null, 990), ('Fusion Energy 1L', 'Fusion', 'Energéticos', 1000, null, 1290),
  ('Fusion Energy 2L', 'Fusion', 'Energéticos', 2000, null, 1990), ('Baly Melancia 2L', 'Baly', 'Energéticos', 2000, null, 1490),
  ('Baly Tropical 2L', 'Baly', 'Energéticos', 2000, null, 1490), ('Burn Energy 260ml', 'Burn', 'Energéticos', 260, null, 790),
  ('Flash Power 2L', 'Flash Power', 'Energéticos', 2000, null, 1190), ('Vibe Energy 2L', 'Vibe', 'Energéticos', 2000, null, 1090),
  ('Coca-Cola lata 350ml', 'Coca-Cola', 'Sem álcool', 350, null, 550), ('Coca-Cola 600ml', 'Coca-Cola', 'Sem álcool', 600, null, 790),
  ('Coca-Cola Zero lata 350ml', 'Coca-Cola', 'Sem álcool', 350, null, 550), ('Coca-Cola Zero 2L', 'Coca-Cola', 'Sem álcool', 2000, null, 1290),
  ('Guaraná Antarctica lata 350ml', 'Antarctica', 'Sem álcool', 350, null, 490), ('Guaraná Antarctica 2L', 'Antarctica', 'Sem álcool', 2000, null, 1090),
  ('Fanta Laranja lata 350ml', 'Fanta', 'Sem álcool', 350, null, 490), ('Fanta Laranja 2L', 'Fanta', 'Sem álcool', 2000, null, 1090),
  ('Sprite lata 350ml', 'Sprite', 'Sem álcool', 350, null, 490), ('Sprite 2L', 'Sprite', 'Sem álcool', 2000, null, 1090),
  ('Schweppes Citrus 350ml', 'Schweppes', 'Sem álcool', 350, null, 590), ('H2OH Limão 500ml', 'H2OH', 'Sem álcool', 500, null, 590),
  ('Água Crystal sem gás 500ml', 'Crystal', 'Sem álcool', 500, null, 300), ('Água Crystal com gás 500ml', 'Crystal', 'Sem álcool', 500, null, 350),
  ('Água Crystal 1,5L', 'Crystal', 'Sem álcool', 1500, null, 550), ('Água Bonafont 500ml', 'Bonafont', 'Sem álcool', 500, null, 300),
  ('Gatorade Uva 500ml', 'Gatorade', 'Sem álcool', 500, null, 690), ('Gatorade Morango 500ml', 'Gatorade', 'Sem álcool', 500, null, 690),
  ('Powerade Mountain Blast 500ml', 'Powerade', 'Sem álcool', 500, null, 590), ('Del Valle Uva 1L', 'Del Valle', 'Sem álcool', 1000, null, 990),
  ('Pepsi lata 350ml', 'Pepsi', 'Sem álcool', 350, null, 450), ('Pepsi 2L', 'Pepsi', 'Sem álcool', 2000, null, 990),
  ('Soda Antarctica lata 350ml', 'Antarctica', 'Sem álcool', 350, null, 450), ('Kuat 2L', 'Kuat', 'Sem álcool', 2000, null, 890),
  ('Casillero del Diablo Cabernet 750ml', 'Casillero del Diablo', 'Vinhos', 750, 13.5, 6990),
  ('Casillero del Diablo Carménère 750ml', 'Casillero del Diablo', 'Vinhos', 750, 13.5, 6990),
  ('Santa Helena Reservado Merlot 750ml', 'Santa Helena', 'Vinhos', 750, 13, 3990), ('Pérgola Tinto Suave 1L', 'Pérgola', 'Vinhos', 1000, 10, 2490),
  ('Chalise Tinto Suave 750ml', 'Chalise', 'Vinhos', 750, 10, 1990), ('Miolo Seleção Tinto 750ml', 'Miolo', 'Vinhos', 750, 13, 5490),
  ('Salton Espumante Brut 750ml', 'Salton', 'Vinhos', 750, 11.5, 5990), ('Chandon Brut 750ml', 'Chandon', 'Vinhos', 750, 12, 11990),
  ('Concha y Toro Reservado 750ml', 'Concha y Toro', 'Vinhos', 750, 12.5, 3490), ('Quinta do Morgado Tinto 750ml', 'Quinta do Morgado', 'Vinhos', 750, 10, 1890),
  ('Almadén Cabernet 750ml', 'Almadén', 'Vinhos', 750, 12, 3990), ('Periquita Tinto 750ml', 'Periquita', 'Vinhos', 750, 13, 7990);
update cat set ean = pg_temp.ean13('7898', 4000 + n);
-- O que o catálogo já tem com o mesmo nome fica de fora.
delete from cat c where exists (select 1 from platform.catalog_products p where lower(p.name) = lower(c.name));
insert into platform.catalog_products (ean, name, brand, volume_ml, abv, suggested_category, status, created_at)
select ean, name, brand, vol, abv, cat, 'published', now() - make_interval(days => pg_temp.rnd(20, 200)) from cat;
insert into platform.catalog_products (ean, name, brand, volume_ml, suggested_category, status) values
  (pg_temp.ean13('7898', 9001), 'Heineken 0,0% lata 350ml', 'Heineken', 350, 'Cervejas', 'draft'),
  (pg_temp.ean13('7898', 9002), 'Brahma Zero lata 350ml', 'Brahma', 350, 'Cervejas', 'draft'),
  (pg_temp.ean13('7898', 9003), 'Tanqueray Sevilla 700ml', 'Tanqueray', 700, 'Destilados', 'draft'),
  (pg_temp.ean13('7898', 9004), 'Red Bull Coco Açaí 250ml', 'Red Bull', 250, 'Energéticos', 'draft'),
  (pg_temp.ean13('7898', 9005), 'Coca-Cola Café 220ml', 'Coca-Cola', 220, 'Sem álcool', 'draft'),
  (pg_temp.ean13('7898', 9006), 'Johnnie Walker Blonde 750ml', 'Johnnie Walker', 750, 'Destilados', 'draft');

-- Produtos que a adega cria por conta própria: ficam fora do catálogo e caem na fila de sugestões da equipe.
create temp table proprio (name text, cat text, vol int, price int, ean boolean);
insert into proprio values
  ('Gelo em cubo 5kg', 'Gelo e carvão', null, 1400, false), ('Gelo em cubo 10kg', 'Gelo e carvão', null, 2400, false),
  ('Gelo de coco', 'Gelo e carvão', null, 350, false), ('Gelo saborizado maracujá', 'Gelo e carvão', null, 400, false),
  ('Carvão 3kg', 'Gelo e carvão', null, 2200, true), ('Carvão 5kg', 'Gelo e carvão', null, 3200, true),
  ('Kit churrasco (carvão + gelo)', 'Gelo e carvão', null, 3200, false), ('Caipirinha da casa 500ml', 'Destilados', 500, 1800, false),
  ('Batida de amendoim da casa 1L', 'Destilados', 1000, 2500, false), ('Drink pronto gin tônica 269ml', 'Destilados', 269, 1200, true),
  ('Chope Pilsen growler 1L', 'Cervejas', 1000, 2800, false), ('Cerveja artesanal da região 500ml', 'Cervejas', 500, 1900, true),
  ('Vinho da casa 1L', 'Vinhos', 1000, 2500, false), ('Amendoim japonês 150g', 'Petiscos', null, 600, true),
  ('Batata palha 120g', 'Petiscos', null, 800, true), ('Torresmo 100g', 'Petiscos', null, 900, true),
  ('Salgadinho de milho 140g', 'Petiscos', null, 1090, true), ('Copo descartável 300ml (50 un)', 'Petiscos', null, 900, true),
  ('Cigarro de palha (maço)', 'Petiscos', null, 1500, true), ('Essência de narguilé menta 50g', 'Petiscos', null, 1200, true);

-- As 10 adegas ------------------------------------------------------------------------------------------
-- f = tamanho (1 = adega cheia, que passa de 25 em toda lista). meses = tempo de assinante.
create temp table cfg (i int, slug text, nome text, cidade text, dono text, lojas text[], bairros text[], f numeric, meses int, situacao text);
insert into cfg values
  (1, 'bomgole', 'Adega Bom Gole', 'São Paulo', 'Ricardo Menezes', array['Adega Bom Gole', 'Bom Gole Itaim', 'Bom Gole Vila Olímpia'], array['Moema', 'Itaim Bibi', 'Vila Olímpia'], 1.0, 12, 'ativa'),
  (2, 'vilarica', 'Empório Vila Rica', 'São Paulo', 'Sandra Okumura', array['Empório Vila Rica', 'Vila Rica Anália Franco'], array['Tatuapé', 'Anália Franco'], 1.0, 10, 'ativa'),
  (3, 'paulista24', 'Adega 24h Paulista', 'São Paulo', 'Fábio Rezende', array['Adega 24h Paulista', '24h Consolação'], array['Bela Vista', 'Consolação'], 0.9, 8, 'ativa'),
  (4, 'chico', 'Adega do Chico', 'São Paulo', 'Francisco Lopes', array['Adega do Chico'], array['Santana'], 0.8, 7, 'ativa'),
  (5, 'lapagelada', 'Lapa Gelada', 'São Paulo', 'Patrícia Duarte', array['Lapa Gelada'], array['Lapa'], 0.7, 6, 'ativa'),
  (6, 'copocheio', 'Adega Copo Cheio', 'São Paulo', 'Roberto Antunes', array['Adega Copo Cheio', 'Copo Cheio Belém'], array['Mooca', 'Belém'], 0.9, 9, 'ativa'),
  (7, 'pontofrio', 'Adega Ponto Frio', 'Campinas', 'Luciana Prates', array['Adega Ponto Frio'], array['Cambuí'], 0.6, 5, 'ativa'),
  (8, 'santomalte', 'Santo Malte', 'Santo André', 'Marcelo Viana', array['Santo Malte'], array['Centro'], 0.5, 6, 'carencia'),
  (9, 'butanta', 'Distribuidora Butantã', 'São Paulo', 'Carla Siqueira', array['Distribuidora Butantã', 'Butantã Rio Pequeno'], array['Butantã', 'Rio Pequeno'], 0.8, 4, 'ativa'),
  (10, 'noitefeliz', 'Adega Noite Feliz', 'Guarulhos', 'Diego Farias', array['Adega Noite Feliz'], array['Centro'], 0.4, 0, 'teste');

-- Produtos e combos de cada conta, para sortear as vendas.
create temp table mp (account_id uuid, id uuid, cat text, bundle boolean default false);
create temp table lojas_massa (account_id uuid, store_id uuid, slug text, j int, fs numeric, terminal uuid, owner uuid);
create temp table caixa_massa (store_id uuid, member_id uuid, role text);

create function pg_temp.itens(p_account uuid, p_combos boolean default true) returns jsonb language sql volatile as $$
  select jsonb_agg(case when x.bundle then jsonb_build_object('bundle_id', x.id, 'quantity', 1)
    else jsonb_build_object('product_id', x.id, 'quantity', case when x.cat = 'Cervejas' then (array[1,2,3,4,6,6,12])[1 + floor(random() * 7)::int]
      when x.cat in ('Sem álcool', 'Energéticos', 'Gelo e carvão', 'Petiscos') then 1 + floor(random() * 3)::int else 1 end) end)
  from (select * from mp where account_id = p_account and (p_combos or not bundle) order by random() limit 1 + floor(random() * 3)::int) x
$$;

-- Um dia de caixa já fechado: abre, vende, fecha e leva tudo para a data do dia.
create function pg_temp.dia(p_store uuid, p_account uuid, p_terminal uuid, p_member uuid, p_day date, p_n int) returns void language plpgsql as $$
declare v_s uuid; v_cash uuid; v_expected bigint; v_diff bigint;
begin
  v_s := pg_temp.login(p_terminal, p_member);
  v_cash := (pg_temp.ok('abrir caixa', app.open_cash(v_s, 15000)) ->> 'cash_session_id')::uuid;
  for k in 1 .. p_n loop
    perform pg_temp.sell(p_store, v_s, pg_temp.itens(p_account), pg_temp.random_method());
  end loop;
  if random() < 0.3 then
    perform pg_temp.ok('sangria', app.cash_movement(v_s, 'withdrawal', pg_temp.rnd(5, 30) * 1000, 'Sangria para o cofre'));
  end if;
  select coalesce(sum(amount), 0) into v_expected from app.cash_movements where cash_session_id = v_cash;
  v_diff := (array[0,0,0,0,0,0,-1250,500,-200,-3000])[1 + floor(random() * 10)::int];
  perform pg_temp.ok('fechar caixa', app.close_cash(v_s, greatest(v_expected + v_diff, 0),
    case when v_diff <> 0 then 'Conferido no fim do turno' end));
  update app.sales set business_date = p_day, created_at = p_day + time '16:00' + random() * interval '10 hours' where cash_session_id = v_cash;
  update app.cash_sessions set business_date = p_day, opened_at = p_day + time '15:50', closed_at = p_day + interval '1 day' + time '02:20'
  where id = v_cash;
  perform pg_temp.ok('sair', app.operator_logout());
end $$;

-- Conta, lojas, catálogo, equipe e estoque de uma adega.
create function pg_temp.montar(p_i int) returns void language plpgsql as $$
declare
  c cfg; v_owner uuid; v_gerente uuid; v_acc uuid; v_store uuid; v_cats jsonb := '{}'; v_sup uuid[] := '{}'; v_sup_cat jsonb := '{}';
  v_pid uuid; v_np int; r record; v_fs numeric; v_term uuid; v_items jsonb; v_n int; v_role text;
begin
  select * into c from cfg where i = p_i;
  v_owner := pg_temp.new_user(c.slug || '@massa.test', c.dono);
  perform pg_temp.as_user(v_owner);
  select (d ->> 'account_id')::uuid, (d ->> 'store_id')::uuid into v_acc, v_store
  from (select pg_temp.ok('cadastro ' || c.slug, app.complete_onboarding(c.lojas[1], c.bairros[1], c.cidade,
    '11' || (950000000 + p_i * 1111)::text, c.dono)) d) s;
  update app.accounts set name = c.nome where id = v_acc;
  perform pg_temp.ok('termos', app.accept_legal(array['termos','privacidade','dpa'], 'v0.1', v_acc));
  update platform.subscriptions set extra_stores = array_length(c.lojas, 1) - 1, extra_store_price = 4990 where account_id = v_acc;
  insert into lojas_massa values (v_acc, v_store, c.slug, 1, c.f, null, v_owner);
  for j in 2 .. array_length(c.lojas, 1) loop
    insert into lojas_massa values (v_acc, (pg_temp.ok('loja ' || c.lojas[j], app.create_store(v_acc, c.lojas[j], c.bairros[j], c.cidade,
      '11' || (950000000 + p_i * 1111 + j)::text)) ->> 'store_id')::uuid, c.slug, j, c.f * 0.5, null, v_owner);
  end loop;

  -- Categorias, produtos do catálogo (ligam pelo código de barras) e produtos próprios.
  for r in select * from (values ('Cervejas', '#F5A800', 1), ('Destilados', '#C084FC', 2), ('Vinhos', '#F87171', 3), ('Energéticos', '#3DD6C4', 4),
                                 ('Sem álcool', '#60A5FA', 5), ('Gelo e carvão', '#94A3B8', 6), ('Petiscos', '#FB923C', 7)) x(name, color, sort) loop
    v_cats := v_cats || jsonb_build_object(r.name, pg_temp.ok('categoria', app.save_category(v_acc, r.name, r.color, r.sort)) ->> 'category_id');
  end loop;
  v_np := round(60 + 90 * c.f);
  for r in select * from cat order by random() limit v_np loop
    v_pid := (pg_temp.ok('produto ' || r.name, app.save_product(v_acc, jsonb_strip_nulls(jsonb_build_object('name', r.name, 'ean', r.ean,
      'price', (round(r.price * (0.92 + random() * 0.25) / 10) * 10)::bigint, 'volume_ml', r.vol, 'unit', 'un',
      'category_id', v_cats ->> r.cat, 'min_stock', case when r.cat = 'Cervejas' then pg_temp.rnd(12, 48) else pg_temp.rnd(2, 10) end)))) ->> 'product_id')::uuid;
    insert into mp values (v_acc, v_pid, r.cat);
  end loop;
  for r in select x.*, row_number() over () rn from (select * from proprio order by random() limit round(6 + 10 * c.f)) x loop
    v_pid := (pg_temp.ok('produto próprio', app.save_product(v_acc, jsonb_strip_nulls(jsonb_build_object('name', r.name,
      'ean', case when r.ean then pg_temp.ean13('200', p_i * 100 + r.rn::int) end,
      'price', r.price, 'volume_ml', r.vol, 'unit', 'un', 'category_id', v_cats ->> r.cat, 'min_stock', pg_temp.rnd(4, 20))))) ->> 'product_id')::uuid;
    insert into mp values (v_acc, v_pid, r.cat);
  end loop;
  update platform.catalog_suggestions set created_at = now() - make_interval(days => pg_temp.rnd(0, 40), hours => pg_temp.rnd(0, 23))
  where account_id = v_acc;

  -- Fornecedores: um por categoria primeiro (são eles que entregam o estoque), depois os demais.
  v_n := round(8 + 26 * c.f);
  for k in 1 .. v_n loop
    v_pid := (pg_temp.ok('fornecedor', app.save_supplier(v_acc, jsonb_build_object(
      'name', case when k <= 7 then (array['Distribuidora Cervejeira ', 'Atacadão Destilados ', 'Vinícola Direto ', 'Energéticos ',
                 'Refrigerantes e Águas ', 'Gelo Polar ', 'Petiscos e Cia '])[k] || c.bairros[1]
               else pg_temp.pick(array['Distribuidora', 'Atacado', 'Comercial', 'Depósito', 'Empório', 'Representação']) || ' '
                 || pg_temp.pick(array['Nova Era', 'São Jorge', 'Bela Vista', 'Real', 'Paulistana', 'Santa Rita', 'Boa Esperança', 'Central',
                 'União', 'Primavera', 'Ouro Verde', 'Imperial', 'Horizonte', 'Aliança', 'Estrela', 'Progresso']) || ' ' || k end,
      'kind', (array['Cervejas', 'Destilados', 'Vinhos', 'Energéticos', 'Refrigerantes e águas', 'Gelo e carvão', 'Petiscos e descartáveis'])[1 + (k - 1) % 7],
      'phone', '11' || (33000000 + p_i * 1000 + k)::text,
      'lead_time', pg_temp.pick(array['Entrega em 1 dia', 'Entrega em 2 dias', 'Retirada no local', 'Entrega diária', 'Entrega semanal'])))) ->> 'supplier_id')::uuid;
    v_sup := v_sup || v_pid;
  end loop;
  v_sup_cat := jsonb_build_object('Cervejas', v_sup[1], 'Destilados', v_sup[2], 'Vinhos', v_sup[3], 'Energéticos', v_sup[4],
    'Sem álcool', v_sup[5], 'Gelo e carvão', v_sup[6], 'Petiscos', v_sup[7]);

  -- Combos e promoções (as promoções têm dia e horário).
  v_n := round(6 + 26 * c.f);
  for k in 1 .. v_n loop
    select jsonb_agg(jsonb_build_object('product_id', id, 'quantity', case when cat = 'Cervejas' then 6 else 1 end)) into v_items
    from (select id, cat from mp where account_id = v_acc and not bundle order by random() limit pg_temp.rnd(2, 3)) x;
    v_pid := (pg_temp.ok('combo', app.save_bundle(v_acc, jsonb_build_object(
      'name', case when k % 4 = 0 then pg_temp.pick(array['Happy hour', 'Promo sexta', 'Esquenta', 'Fim de tarde', 'Domingo de jogo']) || ' ' || k
              else pg_temp.pick(array['Combo', 'Kit', 'Balde', 'Pack']) || ' ' || pg_temp.pick(array['Churrasco', 'Resenha', 'Festa', 'Jogo',
                'Praia', 'Pagode', 'Aniversário', 'Galera', 'Casal', 'Noite']) || ' ' || k end,
      'kind', case when k % 4 = 0 then 'promotion' else 'combo' end,
      'price', (select (round(sum(private.effective_price((select store_id from lojas_massa where account_id = v_acc and j = 1), (it ->> 'product_id')::uuid)
                  * (it ->> 'quantity')::numeric) * 0.88 / 10) * 10)::bigint from jsonb_array_elements(v_items) it),
      'active', k % 7 <> 0, 'show_in_catalog', k % 3 <> 0, 'items', v_items)
      || case when k % 4 = 0 then jsonb_build_object('weekdays', jsonb_build_array(1, 2, 3, 4, 5), 'start_time', '17:00', 'end_time', '20:00') else '{}' end))
      ->> 'bundle_id')::uuid;
    if k % 4 <> 0 and k % 7 <> 0 then insert into mp values (v_acc, v_pid, 'combo', true); end if;
  end loop;

  -- Lucro no Copo: drinks com um destilado e um misturador.
  for k in 1 .. round(4 + 10 * c.f) loop
    perform pg_temp.ok('drink', app.save_drink_recipe(v_acc, jsonb_build_object(
      'name', pg_temp.pick(array['Gin tônica', 'Vodka com energético', 'Caipiroska', 'Cuba libre', 'Whisky com energético', 'Negroni',
        'Aperol spritz', 'Rabo de galo', 'Hi-fi', 'Gin com tropical']) || ' ' || k,
      'sale_price', pg_temp.rnd(15, 40) * 100,
      'items', jsonb_build_array(
        jsonb_build_object('product_id', (select id from mp where account_id = v_acc and cat = 'Destilados' and not bundle order by random() limit 1), 'amount', 50, 'unit', 'ml'),
        jsonb_build_object('product_id', (select id from mp where account_id = v_acc and cat in ('Energéticos', 'Sem álcool') order by random() limit 1), 'amount', 200, 'unit', 'ml')))));
  end loop;

  -- Gerente com login em todas as lojas.
  v_gerente := pg_temp.new_user('gerente.' || c.slug || '@massa.test', pg_temp.pessoa());
  for r in select * from lojas_massa where account_id = v_acc order by j loop
    perform private.attach_login_member(v_owner, r.store_id, v_gerente, (select raw_user_meta_data ->> 'name' from auth.users where id = v_gerente), 'manager');
  end loop;

  for r in select * from lojas_massa where account_id = v_acc order by j loop
    perform pg_temp.as_user(v_owner);
    perform pg_temp.ok('ajustes', app.update_store_settings(r.store_id, jsonb_build_object('pix_key', '+55' || (select whatsapp from app.stores where id = r.store_id),
      'pix_receiver_name', left((select name from app.stores where id = r.store_id), 25), 'pix_city', c.cidade,
      'delivery_fee_default', pg_temp.rnd(5, 10) * 100, 'free_delivery_above', 15000, 'cash_difference_alert', 1000)));
    -- Mínimo por loja e preço próprio em alguns produtos nas lojas extras.
    perform pg_temp.ok('mínimo', app.set_store_product(r.store_id, m.id, case when r.j > 1 and random() < 0.1
      then (round(private.effective_price(r.store_id, m.id) * 1.08 / 10) * 10)::bigint end,
      case when m.cat = 'Cervejas' then pg_temp.rnd(12, 60) else pg_temp.rnd(2, 12) end))
    from mp m where m.account_id = v_acc and not m.bundle;

    -- Aparelho do caixa e equipe do balcão.
    v_term := pg_temp.new_user('terminal-' || c.slug || '-' || r.j || '@terminals.addegas.invalid', 'Balcão ' || r.j, 'terminal');
    insert into app.terminals (store_id, name, auth_user_id) values (r.store_id, 'Balcão ' || r.j, v_term);
    update lojas_massa set terminal = v_term where store_id = r.store_id;
    v_n := round(3 + 27 * r.fs);
    for k in 1 .. v_n loop
      v_role := case when k <= 2 then 'cashier' when k = 3 then 'courier' else (array['cashier','cashier','cashier','courier','courier','stock_keeper'])[1 + floor(random() * 6)::int] end;
      insert into caixa_massa values (r.store_id, (pg_temp.ok('equipe', app.create_counter_member(r.store_id, pg_temp.pessoa(), v_role::app.member_role)) ->> 'member_id')::uuid, v_role);
    end loop;

    -- Estoque inicial por fornecedor; bebida perecível chega com lote e validade.
    for v_pid in select distinct (v_sup_cat ->> m.cat)::uuid from mp m where m.account_id = v_acc and not m.bundle loop
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('product_id', m.id,
        'quantity', case when m.cat = 'Cervejas' then pg_temp.rnd(60, 240) when m.cat in ('Destilados', 'Vinhos') then pg_temp.rnd(4, 24) else pg_temp.rnd(20, 90) end,
        'unit_cost', (round(private.effective_price(r.store_id, m.id) * (0.55 + random() * 0.12)))::bigint,
        'lot_code', case when m.cat in ('Cervejas', 'Sem álcool', 'Energéticos') then upper(substr(md5(m.id::text), 1, 2)) || pg_temp.rnd(1000, 9999) end,
        'expires_on', case when m.cat in ('Cervejas', 'Sem álcool', 'Energéticos') then pg_temp.today() + pg_temp.rnd(3, 160) end)))
      into v_items from mp m where m.account_id = v_acc and not m.bundle and (v_sup_cat ->> m.cat)::uuid = v_pid;
      perform pg_temp.ok('estoque inicial', app.receive_goods(r.store_id, v_items, 'Estoque inicial', v_pid));
    end loop;
  end loop;
end $$;

-- Operação de uma loja: dias anteriores, o dia de hoje, fiado, mesas, pedidos, compras, contas e anotações.
create function pg_temp.operar(p_store uuid) returns void language plpgsql as $$
declare
  l lojas_massa; v_caixas uuid[]; v_couriers uuid[]; v_s uuid; v_dias int; v_n int; v_id uuid; v_items jsonb; v_status text;
  v_nome text; v_tel text; v_fiados uuid[] := '{}'; v_sup uuid; v_ch text; v_mode text; k2 int;
begin
  select * into l from lojas_massa where store_id = p_store;
  select array_agg(member_id) into v_caixas from caixa_massa where store_id = p_store and role = 'cashier';
  select array_agg(member_id) into v_couriers from caixa_massa where store_id = p_store and role = 'courier';

  -- Dias anteriores: a loja principal tem 32 dias de caixa fechado (passa de 25 no relatório de 30 dias).
  v_dias := case when l.j = 1 then 32 else 20 end;
  for d in reverse v_dias .. 1 loop
    perform pg_temp.dia(p_store, l.account_id, l.terminal, v_caixas[1 + d % array_length(v_caixas, 1)], pg_temp.today() - d,
      round((3 + 9 * l.fs) * case when extract(dow from pg_temp.today() - d) in (5, 6) then 1.7 else 1 end)::int);
  end loop;

  -- Hoje: caixa aberto há 3 horas.
  v_s := pg_temp.login(l.terminal, v_caixas[1]);
  v_id := (pg_temp.ok('abrir caixa hoje', app.open_cash(v_s, 15000)) ->> 'cash_session_id')::uuid;
  for k in 1 .. round(8 + 30 * l.fs) loop
    perform pg_temp.sell(p_store, v_s, pg_temp.itens(l.account_id), pg_temp.random_method());
  end loop;

  -- Fiado: cada cliente leva de 1 a 3 compras; parte já pagou tudo ou um pedaço.
  v_n := round(8 + 40 * l.fs);
  for k in 1 .. v_n loop
    v_nome := case when random() < 0.25 then pg_temp.pick(array['Seu ', 'Dona ']) || split_part(pg_temp.pessoa(), ' ', 1) else pg_temp.pessoa() end || ' ' || k;
    v_tel := '119' || lpad((70000000 + (select i from cfg where slug = l.slug) * 100000 + l.j * 1000 + k)::text, 8, '0');
    for q in 1 .. pg_temp.rnd(1, 3) loop
      perform pg_temp.sell(p_store, v_s, pg_temp.itens(l.account_id, false), 'fiado',
        jsonb_build_object('fiado', jsonb_build_object('name', v_nome, 'phone', v_tel)));
    end loop;
  end loop;
  select array_agg(id) into v_fiados from app.fiado_accounts where store_id = p_store;
  for k in 1 .. array_length(v_fiados, 1) loop
    if random() < 0.3 then
      perform pg_temp.ok('fiado pago', app.receive_fiado_payment(v_s, v_fiados[k], (select balance from app.fiado_accounts where id = v_fiados[k]), pg_temp.pick(array['pix', 'cash'])));
    elsif random() < 0.4 then
      perform pg_temp.ok('fiado parcial', app.receive_fiado_payment(v_s, v_fiados[k],
        greatest(100, (select balance / 2 from app.fiado_accounts where id = v_fiados[k])), 'pix'));
    end if;
  end loop;
  -- O livro do fiado é imutável; só a data dos lançamentos é espalhada pelos últimos 45 dias.
  set local session_replication_role = replica;
  update app.fiado_ledger set created_at = now() - make_interval(days => pg_temp.rnd(0, 45), hours => pg_temp.rnd(0, 20)) where store_id = p_store;
  set local session_replication_role = origin;

  -- Mesas e comandas abertas.
  for k in 1 .. round(2 + 6 * l.fs) loop
    v_id := (pg_temp.ok('mesa', app.open_tab(v_s, case when k % 2 = 0 then 'table' else 'tab' end,
      case when k % 2 = 0 then 'Mesa ' || k else 'Comanda ' || (10 + k) end, case when k % 3 = 0 then split_part(pg_temp.pessoa(), ' ', 1) end)) ->> 'tab_id')::uuid;
    for q in 1 .. pg_temp.rnd(1, 4) loop
      perform pg_temp.ok('item mesa', app.add_tab_item(v_s, v_id, (select id from mp where account_id = l.account_id and not bundle order by random() limit 1), null, pg_temp.rnd(1, 3)));
    end loop;
  end loop;
  if v_couriers is not null then
    perform pg_temp.ok('entregador', app.cash_movement(v_s, 'courier_payment', pg_temp.rnd(2, 6) * 1000, 'Entregas da tarde'));
  end if;
  update app.cash_sessions set opened_at = now() - interval '3 hours' where store_id = p_store and status = 'open';
  update app.sales set created_at = now() - random() * interval '170 minutes'
  where cash_session_id = (select id from app.cash_sessions where store_id = p_store and status = 'open');

  -- Pedidos: abertos em todas as etapas e os já entregues dos últimos dias.
  perform pg_temp.as_user(l.owner);
  v_n := round(4 + 26 * l.fs) + round(6 + 40 * l.fs);
  for k in 1 .. v_n loop
    v_ch := (array['whatsapp', 'whatsapp', 'ifood', 'ifood', 'ze_delivery', 'keeta', 'food99', 'phone', 'catalog'])[1 + floor(random() * 9)::int];
    v_mode := case when v_ch in ('ifood', 'ze_delivery', 'keeta', 'food99') then 'platform_delivery'
                   when random() < 0.2 then 'pickup' when v_couriers is null then 'pickup' else 'own_delivery' end;
    select jsonb_agg(jsonb_build_object('product_id', id, 'quantity', pg_temp.rnd(1, 6))) into v_items
    from (select id from mp where account_id = l.account_id and not bundle order by random() limit pg_temp.rnd(1, 3)) x;
    v_id := (pg_temp.ok('pedido', app.create_order(p_store, jsonb_strip_nulls(jsonb_build_object('channel', v_ch,
      'external_id', case when v_mode = 'platform_delivery' then upper(left(v_ch, 2)) || '-' || l.j || lpad(k::text, 4, '0') end,
      'customer_name', pg_temp.pessoa(), 'customer_phone', case when v_mode <> 'platform_delivery' then '119' || pg_temp.rnd(10000000, 99999999) end,
      'mode', v_mode, 'address', case when v_mode <> 'pickup' then pg_temp.pick(array['R. das Flores', 'Av. Brasil', 'R. Augusta', 'R. Harmonia',
        'R. dos Pinheiros', 'Al. Santos', 'R. Bela Cintra', 'Av. Paulista', 'R. Girassol', 'R. Cardeal Arcoverde']) || ', ' || pg_temp.rnd(10, 2000) end,
      'payment_hint', case when v_mode = 'platform_delivery' then 'Pago no app' else pg_temp.pick(array['Pix na entrega', 'Dinheiro', 'Cartão na entrega', 'Fiado']) end,
      'items', v_items)))) ->> 'order_id')::uuid;
    k2 := case when k > round(4 + 26 * l.fs) then 4 else k % 4 end; -- 0 novo · 1 preparo · 2 pronto · 3 saiu · 4 entregue
    if k2 >= 1 then perform pg_temp.ok('preparo', app.set_order_status(v_id, 'preparing')); end if;
    if k2 >= 2 then perform pg_temp.ok('pronto', app.set_order_status(v_id, 'ready')); end if;
    if k2 >= 3 and v_mode = 'own_delivery' then
      perform pg_temp.ok('entregador', app.assign_courier(v_id, v_couriers[1 + k % array_length(v_couriers, 1)]));
      perform pg_temp.ok('saiu', app.set_order_status(v_id, 'out_for_delivery'));
    end if;
    if k2 = 4 then perform pg_temp.ok('entregue', app.set_order_status(v_id, 'delivered')); end if;
    update app.orders set created_at = case when k2 = 4 then now() - make_interval(days => pg_temp.rnd(0, 10), mins => pg_temp.rnd(0, 600))
      else now() - make_interval(mins => pg_temp.rnd(1, 90)) end where id = v_id;
  end loop;

  -- Pedidos de compra: rascunho, enviados e recebidos.
  for k in 1 .. round(4 + 26 * l.fs) loop
    v_sup := (select id from app.suppliers where account_id = l.account_id order by random() limit 1);
    select jsonb_agg(jsonb_build_object('product_id', id, 'quantity', pg_temp.rnd(6, 48), 'unit_cost_estimate', pg_temp.rnd(200, 5000))) into v_items
    from (select id from mp where account_id = l.account_id and not bundle order by random() limit pg_temp.rnd(2, 6)) x;
    v_id := (pg_temp.ok('pedido de compra', app.save_purchase_order(p_store, v_sup, v_items, case when k % 3 = 0 then 'draft' else 'sent' end,
      pg_temp.today() + pg_temp.rnd(-10, 5), case when k % 2 = 0 then 'Pedido pelo WhatsApp do vendedor' end)) ->> 'purchase_order_id')::uuid;
    if k % 3 = 1 then
      perform pg_temp.ok('receber compra', app.receive_purchase_order(v_id, (select jsonb_agg(jsonb_build_object('product_id', it ->> 'product_id',
        'quantity', it -> 'quantity', 'unit_cost', it -> 'unit_cost_estimate')) from jsonb_array_elements(v_items) it)));
    end if;
    update app.purchase_orders set created_at = now() - make_interval(days => pg_temp.rnd(0, 40)) where id = v_id;
  end loop;

  -- Contas a pagar: vencidas, a vencer e pagas.
  for k in 1 .. round(8 + 34 * l.fs) loop
    v_sup := case when k % 2 = 0 then (select id from app.suppliers where account_id = l.account_id order by random() limit 1) end;
    v_id := (pg_temp.ok('conta', app.save_bill(p_store, jsonb_strip_nulls(jsonb_build_object(
      'description', case when v_sup is not null then (select name from app.suppliers where id = v_sup) || ' · NF ' || pg_temp.rnd(10000, 99999)
        else pg_temp.pick(array['Aluguel do ponto', 'Energia elétrica', 'Água e esgoto', 'Internet', 'Contador', 'Maquininha de cartão',
          'Manutenção do freezer', 'Seguro da loja', 'IPTU parcela', 'Plano Addegas', 'Salário', 'Vale-transporte', 'Limpeza']) || ' · ' || k end,
      'amount', pg_temp.rnd(80, 4500) * 100, 'due_on', pg_temp.today() + pg_temp.rnd(-40, 35), 'category', case when v_sup is null then 'Fixa' else 'Fornecedor' end,
      'supplier_id', v_sup, 'recurring_monthly', v_sup is null and random() < 0.5,
      'interest_kind', case when random() < 0.3 then 'pct_month' end, 'interest_value', case when random() < 0.3 then 2 end)))) ->> 'bill_id')::uuid;
    if (select due_on from app.bills where id = v_id) < pg_temp.today() - 3 and random() < 0.75 then
      perform pg_temp.ok('pagar conta', app.pay_bill(v_id, pg_temp.pick(array['pix', 'boleto', 'cash']), (select due_on from app.bills where id = v_id)));
    end if;
  end loop;

  -- Anotações.
  insert into app.notes (store_id, author_id, title, body, priority, pinned, done, created_at)
  select p_store, l.owner, pg_temp.pick(array['Pedir mais gelo para o fim de semana', 'Trocar a lâmpada do freezer', 'Conferir a NF do fornecedor',
      'Ligar para o contador', 'Organizar o depósito', 'Renovar o alvará', 'Treinar a equipe nova no caixa', 'Promoção de sexta no Instagram',
      'Cobrar o fiado atrasado', 'Consertar a porta da câmara fria', 'Comprar sacolas', 'Ver preço do concorrente']) || ' · ' || g,
    case when g % 3 = 0 then 'Anotado no fim do turno.' end, (array['alta', 'media', 'baixa'])[1 + g % 3], g % 9 = 0, g % 4 = 0,
    now() - make_interval(days => pg_temp.rnd(0, 60))
  from generate_series(1, round(4 + 28 * l.fs)::int) g;

  perform pg_temp.as_user(l.terminal);
  perform pg_temp.ok('sair', app.operator_logout());
end $$;

select pg_temp.montar(i) from cfg order by i;
select pg_temp.operar(store_id) from lojas_massa order by slug, j;

-- Chamados de suporte de cada adega, com conversa e andamento ------------------------------------------
create temp table equipe as select
  (select id from auth.users where email = 'lia@addegas.com.br') lia, (select id from auth.users where email = 'caio@addegas.com.br') caio,
  (select id from auth.users where email = 'rafael@addegas.com.br') rafael, (select id from auth.users where email = 'admin@addegas.com.br') admin;

create function pg_temp.chamados(p_i int) returns void language plpgsql as $$
declare c cfg; v_acc uuid; v_owner uuid; v_store uuid; v_t uuid; v_kind text; v_st text; v_when timestamptz; e equipe;
begin
  select * into c from cfg where i = p_i;
  select * into e from equipe;
  select account_id, owner, store_id into v_acc, v_owner, v_store from lojas_massa where slug = c.slug and j = 1;
  perform pg_temp.as_user(v_owner);
  for k in 1 .. round(4 + 28 * c.f) loop
    v_kind := (array['problema', 'duvida', 'duvida', 'melhoria', 'financeiro'])[1 + k % 5];
    v_t := (pg_temp.ok('chamado', app.open_ticket(v_acc, v_store, v_kind,
      case v_kind when 'problema' then pg_temp.pick(array['Caixa travou ao finalizar', 'Impressora não imprime o cupom', 'Pedido do iFood não chegou',
          'Estoque ficou negativo', 'Erro ao fechar o caixa', 'Leitor de código de barras não lê'])
        when 'duvida' then pg_temp.pick(array['Como cadastrar um combo?', 'Como dar desconto no caixa?', 'Como ver o lucro do mês?',
          'Como transferir estoque entre lojas?', 'Como cadastrar um entregador?', 'Como importar produtos do catálogo?'])
        when 'melhoria' then pg_temp.pick(array['Relatório por funcionário', 'Etiqueta de preço', 'Aviso de validade no WhatsApp', 'Comanda por QR code'])
        else pg_temp.pick(array['Segunda via do boleto', 'Cobrança em duplicidade', 'Trocar o cartão da assinatura', 'Nota fiscal da mensalidade']) end || ' · #' || k,
      'Aconteceu na loja ' || c.lojas[1] || '. Preciso de ajuda para resolver isso o quanto antes.',
      (array['parou', 'atrapalha', 'atrapalha', 'duvida'])[1 + k % 4])) ->> 'ticket_id')::uuid;
    v_st := (array['novo', 'em_andamento', 'aguardando_cliente', 'aguardando_equipe', 'resolvido', 'fechado', 'fechado', 'resolvido'])[1 + k % 8];
    v_when := now() - make_interval(days => case when v_st in ('resolvido', 'fechado') then pg_temp.rnd(3, 90) else pg_temp.rnd(0, 6) end, hours => pg_temp.rnd(0, 20));
    update support.tickets set status = v_st, created_at = v_when, updated_at = v_when + interval '2 hours',
      assignee = case when v_st <> 'novo' then (array[e.lia, e.lia, e.caio, e.admin])[1 + k % 4] end,
      first_response_at = case when v_st <> 'novo' then v_when + make_interval(mins => pg_temp.rnd(5, 240)) end,
      waiting_since = case when v_st = 'aguardando_cliente' then v_when + interval '1 hour' end
    where id = v_t;
    if v_st <> 'novo' then
      insert into support.ticket_messages (ticket_id, author_id, side, body, internal, created_at) values
        (v_t, e.lia, 'equipe', 'Oi! Já estamos olhando. Consegue mandar um print da tela?', false, v_when + interval '30 minutes'),
        (v_t, v_owner, 'cliente', 'Mandei agora. Aconteceu de novo hoje cedo.', false, v_when + interval '50 minutes'),
        (v_t, e.lia, 'equipe', 'Anotado para o time técnico conferir nos logs.', true, v_when + interval '55 minutes');
    end if;
  end loop;
end $$;
select pg_temp.chamados(i) from cfg order by i;

-- Assinaturas, faturas e pagamentos (lado da equipe) ----------------------------------------------------
create function pg_temp.assinatura(p_i int) returns void language plpgsql as $$
declare c cfg; v_acc uuid; s platform.subscriptions; v_inicio timestamptz; v_valor bigint; v_inv uuid;
begin
  select * into c from cfg where i = p_i;
  select account_id into v_acc from lojas_massa where slug = c.slug and j = 1;
  v_inicio := now() - make_interval(months => c.meses, days => 14 + p_i);
  update app.accounts set created_at = v_inicio where id = v_acc;
  update app.stores set created_at = v_inicio + make_interval(days => 20 * (select j - 1 from lojas_massa l where l.store_id = app.stores.id))
  where account_id = v_acc;
  if c.situacao = 'teste' then
    update platform.subscriptions set trial_ends_at = now() + interval '9 days', created_at = now() - interval '5 days' where account_id = v_acc;
    return;
  end if;
  update platform.subscriptions set status = (case when c.situacao = 'carencia' then 'past_due' else 'active' end)::platform.subscription_status,
    access = (case when c.situacao = 'carencia' then 'grace' else 'allowed' end)::platform.access_state,
    trial_ends_at = v_inicio + interval '14 days', created_at = v_inicio,
    current_period_start = case when c.situacao = 'carencia' then now() - interval '33 days' else now() - make_interval(days => 3 + p_i * 2) end,
    current_period_end = case when c.situacao = 'carencia' then now() - interval '3 days' else now() - make_interval(days => 3 + p_i * 2) + interval '1 month' end,
    grace_ends_at = case when c.situacao = 'carencia' then now() + interval '2 days' end,
    stripe_customer_id = 'cus_massa_' || c.slug, stripe_subscription_id = 'sub_massa_' || c.slug
  where account_id = v_acc returning * into s;
  v_valor := s.price + s.extra_stores * s.extra_store_price;
  insert into platform.subscription_events (subscription_id, from_status, to_status, from_access, to_access, reason, author, created_at)
  values (s.id, 'trial', 'active', 'allowed', 'allowed', 'Pagamento confirmado no fim do teste', 'stripe', v_inicio + interval '14 days');
  -- Um ciclo pago por mês desde o fim do teste; o ciclo atual fica em aberto.
  for m in reverse c.meses .. 1 loop
    insert into platform.invoices (account_id, stripe_invoice_id, amount, status, due_at, paid_at, period_start, period_end, created_at, nfse_number)
    values (v_acc, 'in_massa_' || c.slug || '_' || m, v_valor, 'paid', s.current_period_start - make_interval(months => m),
      s.current_period_start - make_interval(months => m) + make_interval(hours => pg_temp.rnd(1, 30)),
      s.current_period_start - make_interval(months => m), s.current_period_start - make_interval(months => m - 1),
      s.current_period_start - make_interval(months => m, days => 3), (2026000 + p_i * 100 + m)::text)
    returning id into v_inv;
    insert into platform.payments (invoice_id, account_id, amount, source, method, paid_at, stripe_payment_id)
    select v_inv, v_acc, v_valor, 'stripe', pg_temp.pick(array['card', 'card', 'pix', 'boleto']), paid_at, 'pi_massa_' || c.slug || '_' || m
    from platform.invoices where id = v_inv;
  end loop;
  insert into platform.invoices (account_id, stripe_invoice_id, amount, status, due_at, period_start, period_end, created_at)
  values (v_acc, 'in_massa_' || c.slug || '_atual', v_valor, 'open', s.current_period_end, s.current_period_end,
    s.current_period_end + interval '1 month', s.current_period_end - interval '3 days');
  if c.situacao = 'carencia' then
    insert into platform.subscription_events (subscription_id, from_status, to_status, from_access, to_access, reason, author, created_at)
    values (s.id, 'active', 'past_due', 'allowed', 'grace', 'Cobrança não paga no vencimento: carência de 5 dias', 'job:billing', s.current_period_end);
  end if;
end $$;
select pg_temp.assinatura(i) from cfg order by i;

-- Notas internas da equipe sobre cada adega.
insert into platform.account_notes (account_id, staff_user_id, body, created_at)
select l.account_id, (array[e.rafael, e.lia, e.caio])[1 + g % 3],
  pg_temp.pick(array['Pediu treinamento para a equipe nova do caixa.', 'Quer integrar o Zé Delivery no mês que vem.',
    'Elogiou o relatório de fechamento.', 'Avisou que vai abrir mais uma loja.', 'Reclamou da demora no suporte por WhatsApp.',
    'Combinamos ligar depois do feriado.', 'Pagou a fatura atrasada pelo Pix.']), now() - make_interval(days => pg_temp.rnd(1, 120))
from lojas_massa l, equipe e, generate_series(1, 3) g where l.j = 1;

-- CRM: as 10 adegas como clientes ganhos e mais 60 contatos em todas as etapas --------------------------
insert into platform.leads (name, store_name, phone, email, neighborhood, city, source, campaign, utm, stage, owner_staff, account_id, created_at)
select c.dono, c.nome, '11' || (950000000 + c.i * 1111)::text, c.slug || '@massa.test', c.bairros[1], c.cidade,
  (array['Google', 'Meta Ads', 'Instagram', 'Indicação', 'Evento'])[1 + c.i % 5], 'Teste grátis', '{}', 'cliente', e.rafael,
  l.account_id, now() - make_interval(months => c.meses, days => 20 + c.i)
from cfg c join lojas_massa l on l.slug = c.slug and l.j = 1, equipe e
on conflict (phone) do update set stage = excluded.stage, account_id = excluded.account_id, owner_staff = excluded.owner_staff,
  source = excluded.source, campaign = excluded.campaign, email = excluded.email, created_at = excluded.created_at; -- o cadastro já criou o contato
insert into platform.leads (name, store_name, phone, neighborhood, city, source, campaign, utm, stage, owner_staff, next_task, next_task_at,
  lost_reason, lost_detail, lost_at, created_at)
select pg_temp.pessoa(), pg_temp.pick(array['Adega', 'Empório', 'Distribuidora', 'Adega e Tabacaria', 'Conveniência']) || ' '
    || pg_temp.pick(array['São Jorge', 'Gelada', 'Do Bairro', 'Real', 'Ponto Certo', 'Noite e Dia', 'Esquina Feliz', 'Bom Preço', 'Primo', 'Central']) || ' ' || g,
  '119' || (60000000 + g)::text, pg_temp.pick(array['Pinheiros', 'Mooca', 'Tatuapé', 'Santana', 'Lapa', 'Ipiranga', 'Penha', 'Butantã', 'Saúde', 'Jabaquara']),
  'São Paulo', x.src, x.camp, jsonb_build_object('source', lower(x.src), 'campaign', 'massa'),
  x.stage, e.rafael, case when x.stage not in ('perdido') then pg_temp.pick(array['Ligar para apresentar', 'Enviar vídeo do caixa', 'Demonstração por vídeo', 'Cobrar retorno do teste']) end,
  case when x.stage not in ('perdido') then now() + make_interval(hours => pg_temp.rnd(-48, 120)) end,
  case when x.stage = 'perdido' then pg_temp.pick(array['Já usa outro sistema', 'Achou caro', 'Sem retorno', 'Fechou a loja']) end,
  case when x.stage = 'perdido' then 'Registrado pela massa de teste.' end, case when x.stage = 'perdido' then now() - make_interval(days => pg_temp.rnd(1, 40)) end,
  now() - make_interval(days => pg_temp.rnd(0, 60), hours => pg_temp.rnd(0, 23))
from generate_series(1, 60) g, equipe e,
  lateral (select (array['novo', 'novo', 'contato', 'contato', 'demo', 'teste', 'perdido'])[1 + g % 7] stage,
                  (array['Google', 'Meta Ads', 'Instagram', 'Indicação', 'Evento', 'Site'])[1 + g % 6] src,
                  (array['Sistema para adega', 'Teste grátis', 'Reels do caixa', 'Indicação de cliente'])[1 + g % 4] camp) x;
insert into platform.lead_events (lead_id, kind, body, staff_user_id, created_at)
select l.id, x.kind, x.body, case when x.kind <> 'Site' then e.rafael end, l.created_at + make_interval(hours => x.h)
from platform.leads l, equipe e, lateral (values ('Site', 'Pediu teste grátis pelo formulário.', 0),
  ('WhatsApp', 'Primeiro contato: explicou como funciona a loja.', 20), ('Ligação', 'Combinou de ver a demonstração.', 50)) x(kind, body, h)
where l.utm ->> 'campaign' = 'massa' or l.email::text like '%@massa.test';

-- Ocorrências do sistema dos últimos 7 dias --------------------------------------------------------------
insert into audit.system_logs (created_at, source, level, code, message, correlation_id, account_id, store_id, context)
select now() - make_interval(mins => pg_temp.rnd(1, 7 * 24 * 60)), t.src, t.lvl, t.code, t.msg, 'c-massa-' || g,
  case when t.loja then l.account_id end, case when t.loja then l.store_id end,
  jsonb_build_object('module', t.modulo, 'route', t.rota, 'version', 'web dev')
from generate_series(1, 320) g
join (select row_number() over () - 1 idx, * from (values
  ('front', 'error', 'PIX_TIMEOUT', 'Timeout aguardando confirmação do Pix (12 s)', 'Caixa', '/caixa', true),
  ('front', 'warn', 'SLOW_LCP', 'Carregamento lento: LCP de 4,1 s', 'Relatórios', '/relatorios', true),
  ('front', 'error', 'PRINT_FAILED', 'Impressora térmica não respondeu', 'Caixa', '/caixa', true),
  ('back', 'error', 'IFOOD_WEBHOOK_TIMEOUT', 'iFood: timeout ao confirmar o pedido', 'Pedidos', 'webhook', true),
  ('back', 'warn', 'STOCK_NEGATIVE', 'Venda deixou o estoque negativo', 'Estoque', 'api', true),
  ('back', 'info', 'JOB_DONE', 'Fechamento diário processado', 'Rotinas', 'job', false),
  ('security', 'warn', 'LOGIN_FAILED', 'Senha inválida 3 vezes seguidas', 'Login', 'auth', true),
  ('security', 'info', 'FORBIDDEN_ACTION', 'Caixa tentou abrir Contas a pagar: bloqueado no servidor', 'Acesso negado', 'authz', true)
) v(src, lvl, code, msg, modulo, rota, loja)) t on t.idx = (g * 7) % 8
join (select row_number() over (order by slug, j) - 1 idx, * from lojas_massa) l on l.idx = g % (select count(*) from lojas_massa);

-- Avisos da central de mensagens para as adegas (novidades só chegam a quem aceitou receber; os outros ficam como "pulados").
select pg_temp.ok('aviso', private.admin_send(e.caio, 'finance', 'cobranca_proxima', array['whatsapp'],
  (select array_agg(account_id) from lojas_massa where j = 1), now())) from equipe e;
select pg_temp.ok('aviso', private.admin_send(e.admin, 'master', 'novidades', array['whatsapp', 'email'],
  (select array_agg(account_id) from lojas_massa where j = 1), now())) from equipe e;
select pg_temp.ok('aviso', private.admin_send(e.admin, 'master', 'novidades', array['email'],
  (select array_agg(account_id) from lojas_massa where j = 1), now() + interval '3 days')) from equipe e;

-- Brindes por marco de vendas.
insert into platform.gifts (account_id, milestone, items, size, recipient, address, card, notify, status, tracking, cost, freight, created_by, created_at)
select l.account_id, g, case when g = 1 then array['adesivo', 'copo'] else array['camiseta', 'bone', 'abridor'] end, case when g > 1 then 'G' end,
  c.dono, 'Endereço da loja ' || c.lojas[1], 'Obrigado por vender com a Addegas!', true,
  (array['entregue', 'enviado', 'preparando'])[1 + (c.i + g) % 3], case when (c.i + g) % 3 < 2 then 'BR' || (100000000 + c.i * 10 + g) || 'SP' end,
  case when g = 1 then 1800 else 7400 end, 2200, e.caio, now() - make_interval(days => 60 / g + c.i)
from cfg c join lojas_massa l on l.slug = c.slug and l.j = 1, equipe e, generate_series(1, 2) g where c.meses >= 4;

-- Melhorias pedidas pelas adegas.
insert into support.improvements (title, area, status, created_by, created_at)
select x.t, x.a, x.s, e.lia, now() - make_interval(days => pg_temp.rnd(5, 80)) from equipe e, (values
  ('Etiqueta de preço pela impressora térmica', 'Estoque', 'planejada'), ('Aviso de validade pelo WhatsApp', 'Estoque', 'analise'),
  ('Comanda por QR code na mesa', 'Caixa', 'desenvolvimento'), ('Exportar relatório para Excel', 'Relatórios', 'entregue'),
  ('Integração com o Keeta', 'Pedidos', 'analise'), ('Meta de vendas por funcionário', 'Relatórios', 'planejada')) x(t, a, s);

-- Avisos de abertura e fechamento de caixa dos dias anteriores já foram vistos.
update app.alerts a set read_at = cs.closed_at, read_by = l.owner
from app.cash_sessions cs, lojas_massa l
where a.entity = 'cash_session' and cs.id = a.entity_id::uuid and cs.business_date < pg_temp.today() and l.store_id = cs.store_id;

-- Resumo: quantos registros cada lista recebeu na loja principal de cada adega.
select l.slug,
  (select count(*) from app.products p where p.account_id = l.account_id) produtos,
  (select count(*) from app.suppliers s where s.account_id = l.account_id) fornecedores,
  (select count(*) from app.bundles b where b.account_id = l.account_id) combos,
  (select count(*) from app.fiado_accounts f where f.store_id = l.store_id) clientes,
  (select count(*) from app.orders o where o.store_id = l.store_id and o.status in ('new', 'preparing', 'ready', 'out_for_delivery')) pedidos_abertos,
  (select count(*) from app.orders o where o.store_id = l.store_id and o.status in ('delivered', 'completed')) pedidos_entregues,
  (select count(*) from app.bills b where b.store_id = l.store_id) contas,
  (select count(*) from app.purchase_orders p where p.store_id = l.store_id) compras,
  (select count(*) from app.notes n where n.store_id = l.store_id) anotacoes,
  (select count(*) from app.store_members m where m.store_id = l.store_id) equipe,
  (select count(*) from app.stock_lots s where s.store_id = l.store_id and s.remaining_qty > 0 and s.expires_on is not null) lotes,
  (select count(*) from app.cash_sessions s where s.store_id = l.store_id and s.status <> 'open') fechamentos,
  (select count(*) from support.tickets t where t.account_id = l.account_id) chamados
from lojas_massa l where l.j = 1 order by (select i from cfg where slug = l.slug);

commit;
