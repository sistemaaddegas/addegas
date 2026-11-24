-- Auditoria de segurança, parte 3 (migration 20261117140000): formulário público da landing.
begin;
select plan(7);

select ok((private.lead_from_landing('{"name":"Zé","store_name":"Adega do Zé","phone":"11 97777-0001"}') ->> 'ok')::boolean,
  'primeiro envio do formulário entra');
select ok((private.lead_from_landing('{"name":"Zé","phone":"11977770001"}') ->> 'ok')::boolean
  and (private.lead_from_landing('{"name":"Zé","phone":"11977770001"}') ->> 'ok')::boolean,
  'segundo e terceiro envios do mesmo telefone no dia entram');
select is(private.lead_from_landing('{"name":"Invasor","store_name":"Trocada","phone":"(11) 97777-0001"}') -> 'error' ->> 'code',
  'RATE_LIMITED', 'quarto envio do mesmo telefone no dia é barrado');
select is((select name || ' · ' || store_name from platform.leads where phone = '11977770001'), 'Zé · Adega do Zé',
  'o envio barrado não sobrescreve o contato que já existe');
select is((select count(*) from platform.lead_events e join platform.leads l on l.id = e.lead_id where l.phone = '11977770001'),
  3::bigint, 'nem empilha evento no histórico dele');

create temp table gigante as select private.lead_from_landing(jsonb_build_object('name', repeat('x', 5000), 'phone', '11977770002',
  'utm', jsonb_build_object('utm_source', repeat('y', 5000)))) r;
select ok((select (r ->> 'ok')::boolean from gigante)
  and (select length(name) = 120 and length(source) = 80 from platform.leads where phone = '11977770002'),
  'campos gigantes são cortados no tamanho do formulário');

-- Total por hora: com o contador já no teto, um telefone novo também é barrado.
update private.rate_limits set hits = 300, window_start = now() where key = 'lead_all';
select is(private.lead_from_landing('{"name":"Robô","phone":"11977770003"}') -> 'error' ->> 'code',
  'RATE_LIMITED', 'acima de 300 envios na hora, o formulário para de aceitar');

select * from finish();
rollback;
