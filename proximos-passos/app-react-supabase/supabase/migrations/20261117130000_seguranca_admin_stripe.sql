-- Auditoria de segurança antes da primeira versão, parte 2 (17/11/2026): painel da equipe e cobrança.
-- Complementa a 20261117120000 (outra frente da mesma auditoria).
-- E1. Envio de modelo promocional exigia marketing.write só na Edge Function, por um campo que vem do pedido
--     (`promotional`). Suporte e Financeiro mandavam o "novidades" passando promotional = false. Agora o banco confere
--     o tipo do modelo e o perfil.
-- E2. Qualquer perfil com messages.send trocava o tipo do modelo de promocional para serviço; mensagem de serviço
--     não passa pelo consentimento (E49), então dava para mandar marketing para todas as adegas sem autorização
--     (LGPD) pelo número e pelo domínio da Addegas. Agora promocional nunca vira serviço, e mexer em modelo
--     promocional exige marketing.write.
-- E3. Desconto sem teto de ciclos nem de valor fixo: um clique dava 100% por 9.999 ciclos. Agora até 36 ciclos e
--     valor fixo até o maior preço do plano.
-- R1. Lojas adicionais: o limite só era conferido ao criar a loja. Contratava, criava as lojas, reduzia a
--     quantidade (com crédito proporcional no Stripe) e seguia usando todas. billing_extra_stores_in_use dá o
--     mínimo que a rota billing/extra-stores aceita (o portal do Stripe não deixa mudar a quantidade).
-- R2. Reembolso de pagamento feito pelo Stripe só pelo Stripe: o registro manual de um pagamento do Stripe criava um
--     estorno que não existiu (e contava em dobro quando o estorno de verdade chegava pelo webhook).

-- Perfil tem a ação? (o p_role vem do staff_check da Edge Function; estas funções só rodam com service_role)
create or replace function private.staff_role_can(p_role text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from platform.role_actions where role_code = p_role and action_code = p_action);
$$;
revoke execute on function private.staff_role_can(text, text) from public, anon, authenticated;
grant execute on function private.staff_role_can(text, text) to service_role;

-- ===== E1 =====
create or replace function private.admin_send(p_staff uuid, p_role text, p_template text, p_channels text[], p_accounts uuid[], p_when timestamp with time zone)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t platform.message_templates;
  v_c uuid;
  v_ch text;
  v_acc record;
  v_queued int := 0;
  v_skipped int := 0;
  v_link text;
  v_when timestamptz := coalesce(p_when, now());
begin
  if coalesce(array_length(p_accounts, 1), 0) = 0 then return private.err('SEND_NO_RECIPIENTS'); end if;
  if v_when < now() - interval '1 minute' then return private.err('SEND_DATE_PAST'); end if;
  select * into v_t from platform.message_templates where code = p_template limit 1;
  if not found then return private.err('TEMPLATE_NOT_FOUND'); end if;
  -- Promocional (em qualquer canal do modelo) só para quem faz marketing.
  if exists (select 1 from platform.message_templates where code = p_template and kind = 'promotional')
     and not private.staff_role_can(p_role, 'marketing.write') then
    perform private.audit_admin(p_staff, p_role, 'marketing.write', p_outcome => 'denied', p_reason => 'FORBIDDEN_ACTION');
    return private.err('FORBIDDEN_ACTION');
  end if;
  insert into platform.campaigns (name, channel, template_code, audience, status, created_by, sent_at, scheduled_for)
  values (coalesce(v_t.name, p_template), p_channels[1], p_template, jsonb_build_object('accounts', to_jsonb(p_accounts), 'channels', to_jsonb(p_channels)),
    case when v_when > now() + interval '1 minute' then 'scheduled' else 'sent' end, p_staff,
    case when v_when > now() + interval '1 minute' then null else now() end, v_when)
  returning id into v_c;
  foreach v_ch in array p_channels loop
    if not exists (select 1 from platform.message_templates where code = p_template and channel = v_ch) then continue; end if;
    -- O tipo vale por canal (a fila confere o consentimento do promocional).
    select * into v_t from platform.message_templates where code = p_template and channel = v_ch;
    for v_acc in
      select a.id, a.name, u.email, coalesce(nullif(pr.full_name, ''), a.name) resp,
        coalesce(nullif(pr.phone, ''), (select whatsapp from app.stores where account_id = a.id order by created_at limit 1)) phone,
        s.trial_ends_at, s.grace_ends_at, s.current_period_end
      from app.accounts a join auth.users u on u.id = a.owner_user_id left join app.profiles pr on pr.id = a.owner_user_id
      join platform.subscriptions s on s.account_id = a.id where a.id = any (p_accounts)
    loop
      v_link := 'https://app.addegas.com.br/assinatura';
      if private.enqueue_message(v_ch, v_t.kind, case v_ch when 'email' then v_acc.email else v_acc.phone end, p_template,
           jsonb_build_object('nome_adega', v_acc.name, 'responsavel', split_part(v_acc.resp, ' ', 1),
             'vencimento', to_char(coalesce(v_acc.trial_ends_at, v_acc.current_period_end) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
             'prazo_final', to_char(v_acc.grace_ends_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI'),
             'link_regularizacao', v_link, 'plano', 'Addegas'),
           'send:' || v_c || ':' || v_acc.id || ':' || v_ch, v_acc.id, null, null, v_when) is not null then
        v_queued := v_queued + 1;
      else
        v_skipped := v_skipped + 1;
      end if;
    end loop;
  end loop;
  update platform.campaigns set result = jsonb_build_object('queued', v_queued, 'skipped', v_skipped) where id = v_c;
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'campaign', v_c::text, null,
    jsonb_build_object('template', p_template, 'channels', p_channels, 'accounts', array_length(p_accounts, 1), 'queued', v_queued, 'skipped', v_skipped));
  return private.ok(jsonb_build_object('campaign_id', v_c, 'queued', v_queued, 'skipped', v_skipped));
end;
$$;

-- Campanha promocional (rota messages/campaign-send, que só exige messages.send): também só com marketing.
create or replace function private.campaign_send(p_staff uuid, p_role text, p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c platform.campaigns;
  v_queued int := 0;
  v_skipped int := 0;
  v_acc record;
begin
  if not private.staff_role_can(p_role, 'marketing.write') then
    perform private.audit_admin(p_staff, p_role, 'marketing.write', p_outcome => 'denied', p_reason => 'FORBIDDEN_ACTION');
    return private.err('FORBIDDEN_ACTION');
  end if;
  select * into v_c from platform.campaigns where id = p_campaign_id for update;
  if not found or v_c.status <> 'draft' then return private.err('CAMPAIGN_NOT_DRAFT'); end if;
  if (select kind from platform.message_templates where code = v_c.template_code and channel = v_c.channel) <> 'promotional' then
    return private.err('CAMPAIGN_TEMPLATE_NOT_PROMOTIONAL');
  end if;
  for v_acc in
    select a.id, a.name, u.email, coalesce(pr.phone, (select whatsapp from app.stores where account_id = a.id order by created_at limit 1)) phone
    from app.accounts a join auth.users u on u.id = a.owner_user_id left join app.profiles pr on pr.id = a.owner_user_id
    join platform.subscriptions s on s.account_id = a.id
    where (v_c.audience ->> 'status' is null or s.status::text = v_c.audience ->> 'status')
  loop
    if private.has_consent(v_acc.id, v_c.channel) then
      perform private.enqueue_message(v_c.channel, 'promotional', case v_c.channel when 'email' then v_acc.email else v_acc.phone end,
        v_c.template_code, jsonb_build_object('nome_adega', v_acc.name), 'campaign:' || v_c.id || ':' || v_acc.id, v_acc.id);
      v_queued := v_queued + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  update platform.campaigns set status = 'sent', sent_at = now(),
    result = jsonb_build_object('queued', v_queued, 'skipped_no_consent', v_skipped) where id = p_campaign_id;
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'campaign', p_campaign_id::text, null,
    jsonb_build_object('queued', v_queued, 'skipped_no_consent', v_skipped));
  return private.ok(jsonb_build_object('queued', v_queued, 'skipped_no_consent', v_skipped));
end;
$$;

-- ===== E2 =====
create or replace function private.admin_template_save(p_staff uuid, p_role text, p_code text, p_name text, p_kind text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bad text;
  v_promo boolean;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_body, ''))) < 5 then return private.err('TEMPLATE_INVALID'); end if;
  if p_kind not in ('service', 'promotional') then return private.err('TEMPLATE_INVALID'); end if;
  select bool_or(kind = 'promotional') into v_promo from platform.message_templates where code = p_code;
  if v_promo is null then return private.err('TEMPLATE_NOT_FOUND'); end if;
  -- Promocional nunca vira serviço (pularia o consentimento); tornar ou editar promocional é de marketing.
  if v_promo and p_kind <> 'promotional' then return private.err('TEMPLATE_KIND_LOCKED'); end if;
  if (v_promo or p_kind = 'promotional') and not private.staff_role_can(p_role, 'marketing.write') then
    perform private.audit_admin(p_staff, p_role, 'marketing.write', p_outcome => 'denied', p_reason => 'FORBIDDEN_ACTION');
    return private.err('FORBIDDEN_ACTION');
  end if;
  select string_agg(m[1], ', ') into v_bad from regexp_matches(p_body, '\{(\w+)\}', 'g') m
  where m[1] not in ('nome_adega', 'responsavel', 'plano', 'vencimento', 'prazo_final', 'link_regularizacao', 'dias');
  if v_bad is not null then return private.err('TEMPLATE_VARIABLE_UNKNOWN', v_bad); end if;
  if p_kind = 'promotional' and p_body !~* 'sair' then return private.err('TEMPLATE_OPT_OUT_REQUIRED'); end if;
  update platform.message_templates set name = trim(p_name), kind = p_kind, body = trim(p_body) where code = p_code;
  perform private.audit_admin(p_staff, p_role, 'messages.send', null, 'template', p_code, null,
    jsonb_build_object('name', p_name, 'kind', p_kind));
  return private.ok();
end;
$$;

-- ===== E3 =====
create or replace function private.admin_create_discount(p_staff uuid, p_role text, p_accounts uuid[], p_kind text, p_value numeric, p_cycles integer, p_stacks boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_max bigint := (select max(price) from platform.plan_prices where active);
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  if p_kind not in ('pct', 'fixed') or coalesce(p_value, 0) <= 0 or (p_kind = 'pct' and p_value > 100)
     or (p_kind = 'fixed' and p_value > coalesce(v_max, 0)) or coalesce(p_cycles, 0) not between 1 and 36 then
    return private.err('DISCOUNT_INVALID');
  end if;
  if coalesce(array_length(p_accounts, 1), 0) = 0 then return private.err('DISCOUNT_TARGETS_EMPTY'); end if;
  insert into platform.discounts (kind, value, cycles, stacks, reason, created_by)
  values (p_kind, p_value, p_cycles, coalesce(p_stacks, false), p_reason, p_staff) returning id into v_id;
  if not coalesce(p_stacks, false) then
    delete from platform.discount_targets dt using platform.discounts d
    where dt.discount_id = d.id and d.id <> v_id and dt.account_id = any (p_accounts);
  end if;
  insert into platform.discount_targets (discount_id, account_id) select v_id, unnest(p_accounts);
  perform private.audit_admin(p_staff, p_role, 'billing.discount', a, 'discount', v_id::text, null,
    jsonb_build_object('kind', p_kind, 'value', p_value, 'cycles', p_cycles, 'stacks', p_stacks), p_reason)
  from unnest(p_accounts) a;
  return private.ok(jsonb_build_object('discount_id', v_id));
end;
$$;

-- ===== R1 =====
-- Quantas lojas adicionais estão em uso (lojas ativas além das incluídas no plano). A rota billing/extra-stores
-- não aceita quantidade menor: para reduzir, a adega arquiva a loja antes.
create or replace function private.billing_extra_stores_in_use(p_account_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0,
    (select count(*)::int from app.stores where account_id = p_account_id and archived_at is null)
    - coalesce((select coalesce(f.limit_value, 1000000) from platform.subscriptions s
                join platform.plan_features f on f.plan_id = s.plan_id and f.feature_code = 'stores_included'
                where s.account_id = p_account_id), 1));
$$;
revoke execute on function private.billing_extra_stores_in_use(uuid) from public, anon, authenticated;
grant execute on function private.billing_extra_stores_in_use(uuid) to service_role;

-- ===== R2 =====
create or replace function private.admin_refund(p_staff uuid, p_role text, p_payment_id uuid, p_amount bigint, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay platform.payments;
  v_refunded bigint;
  v_id uuid;
begin
  if not private.admin_require_reason(p_reason) then return private.err('REASON_REQUIRED'); end if;
  select * into v_pay from platform.payments where id = p_payment_id for update;
  if not found then return private.err('PAYMENT_NOT_FOUND'); end if;
  -- Pagamento do Stripe: o estorno é feito no Stripe e entra sozinho pelo webhook (charge.refunded).
  if v_pay.source = 'stripe' then return private.err('REFUND_IN_STRIPE'); end if;
  select coalesce(sum(amount), 0) into v_refunded from platform.refunds where payment_id = p_payment_id;
  if coalesce(p_amount, 0) <= 0 or v_refunded + p_amount > v_pay.amount then
    return private.err('REFUND_AMOUNT_INVALID', format('pago %s, já reembolsado %s', v_pay.amount, v_refunded));
  end if;
  insert into platform.refunds (payment_id, amount, reason, staff_user_id) values (p_payment_id, p_amount, p_reason, p_staff) returning id into v_id;
  perform private.audit_admin(p_staff, p_role, 'billing.refund', v_pay.account_id, 'payment', p_payment_id::text, null,
    jsonb_build_object('refund_id', v_id, 'amount', p_amount), p_reason);
  return private.ok(jsonb_build_object('refund_id', v_id, 'source', v_pay.source));
end;
$$;
