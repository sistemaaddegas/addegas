-- Auditoria de segurança, parte 3 (17/11/2026): formulário da landing (POST /api/leads).
-- A rota é pública e só tinha o captcha e um limite por IP em memória (o IP vem do cliente e pode ser forjado; a
-- memória vale para uma instância só). Sem limite no banco:
--   1. um robô que passasse do captcha enchia o CRM de contatos falsos;
--   2. o mesmo telefone sobrescrevia nome e adega de um contato que já existe e empilhava eventos no histórico dele
--      (quem soubesse o telefone de um cliente adulterava o CRM).
-- Agora: no máximo 3 envios por telefone por dia, 300 no total por hora, e campos com tamanho limitado.
create or replace function private.lead_from_landing(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g');
  v_id uuid;
begin
  if v_phone !~ '^[0-9]{10,13}$' then return private.err('PHONE_INVALID'); end if;
  if not private.rate_hit('lead_phone:' || v_phone, 3, 86400) or not private.rate_hit('lead_all', 300, 3600) then
    return private.err('RATE_LIMITED');
  end if;
  insert into platform.leads (name, store_name, phone, email, neighborhood, city, source, utm)
  values (left(p ->> 'name', 120), left(p ->> 'store_name', 120), v_phone, left(nullif(p ->> 'email', ''), 254),
    left(p ->> 'neighborhood', 80), left(p ->> 'city', 80),
    left(coalesce(p -> 'utm' ->> 'utm_source', 'site'), 80),
    case when jsonb_typeof(p -> 'utm') = 'object' and length((p -> 'utm')::text) <= 1000 then p -> 'utm' else '{}'::jsonb end)
  on conflict (phone) do update set name = coalesce(excluded.name, platform.leads.name),
    store_name = coalesce(excluded.store_name, platform.leads.store_name),
    utm = case when platform.leads.utm = '{}'::jsonb then excluded.utm else platform.leads.utm end
  returning id into v_id;
  insert into platform.lead_events (lead_id, kind, body) values (v_id, 'form', 'Formulário do site');
  return private.ok(jsonb_build_object('lead_id', v_id));
end;
$$;
