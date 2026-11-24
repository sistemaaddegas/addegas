-- E32/E34 · Preços do plano por ciclo para a tela de assinatura (os mesmos da landing, sem dados do gateway).
create or replace function app.plan_prices()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.ok(coalesce(jsonb_agg(jsonb_build_object(
    'cycle', pp.cycle, 'price', pp.price,
    'months', case pp.cycle when 'monthly' then 1 when 'semiannual' then 6 when 'annual' then 12 end
  ) order by case pp.cycle when 'monthly' then 1 when 'semiannual' then 2 else 3 end), '[]'::jsonb))
  from platform.plans pl join platform.plan_prices pp on pp.plan_id = pl.id
  where pl.code = 'addegas' and pp.active;
$$;
revoke execute on function app.plan_prices() from public, anon;
grant execute on function app.plan_prices() to authenticated;
