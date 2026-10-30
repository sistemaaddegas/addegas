-- Relatórios: o fechamento de caixa mostra quem fechou ("Operador: …" no protótipo).
create or replace function app.report_sales(p_store_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profit boolean := private.can(p_store_id, 'ver_lucro');
  v_out jsonb;
begin
  if not private.can(p_store_id, 'relatorios') then
    return private.err('FORBIDDEN');
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    return private.err('REPORT_PERIOD_INVALID');
  end if;

  with v as (
    select s.* from app.sales s where s.store_id = p_store_id and s.business_date between p_from and p_to
  ), paid as (select * from v where status = 'paid')
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'totals', jsonb_build_object('revenue', (select coalesce(sum(total), 0) from paid), 'count', (select count(*) from paid),
      'avg_ticket', (select coalesce(round(avg(total)), 0) from paid), 'discounts', (select coalesce(sum(discount), 0) from paid),
      'delivery_fees', (select coalesce(sum(delivery_fee), 0) from paid),
      'canceled_count', (select count(*) from v where status = 'canceled'),
      'contingency_count', (select count(*) from paid where origin = 'contingency')),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('date', business_date, 'revenue', r, 'count', c) order by business_date), '[]'::jsonb)
               from (select business_date, sum(total) r, count(*) c from paid group by 1) x),
    'by_hour', (select coalesce(jsonb_object_agg(h, r), '{}'::jsonb) from (
               select extract(hour from p.created_at at time zone a.timezone)::int h, sum(p.total) r
               from paid p join app.stores st on st.id = p.store_id join app.accounts a on a.id = st.account_id group by 1) x),
    'by_channel', (select coalesce(jsonb_object_agg(channel, r), '{}'::jsonb) from (select channel, sum(total) r from paid group by 1) x),
    'by_method', (select coalesce(jsonb_object_agg(method, r), '{}'::jsonb) from (
               select sp.method, sum(sp.amount - sp.change_given) r from app.sale_payments sp join paid on paid.id = sp.sale_id group by 1) x),
    'by_operator', (select coalesce(jsonb_agg(jsonb_build_object('name', m.display_name, 'revenue', x.r, 'count', x.c,
                     'pix', x.pix, 'discounts', x.d) order by x.r desc), '[]'::jsonb)
               from (select operator_member_id, sum(total) r, count(*) c, sum(discount) d,
                       (select coalesce(sum(sp.amount), 0) from app.sale_payments sp join paid p2 on p2.id = sp.sale_id
                        where p2.operator_member_id = paid.operator_member_id and sp.method = 'pix') pix
                     from paid group by operator_member_id) x
               join app.store_members m on m.id = x.operator_member_id),
    'cancellations_by_operator', (select coalesce(jsonb_object_agg(m.display_name, x.c), '{}'::jsonb)
               from (select canceled_by, count(*) c from v where status = 'canceled' group by 1) x
               join app.store_members m on m.id = x.canceled_by),
    'top_products', (select coalesce(jsonb_agg(t order by (t ->> 'revenue')::bigint desc), '[]'::jsonb) from (
               select jsonb_build_object('name', si.name, 'quantity', sum(si.quantity), 'revenue', sum(si.total),
                 'margin', case when v_profit then sum(si.total) - sum(round(si.quantity * si.unit_cost)) end) t
               from app.sale_items si join paid on paid.id = si.sale_id group by si.name order by sum(si.total) desc limit 20) y),
    'sold_without_stock', (select coalesce(jsonb_agg(distinct si.name), '[]'::jsonb) from app.sale_items si join paid on paid.id = si.sale_id
               where si.sold_without_stock),
    'gross_margin', case when v_profit then (select coalesce(sum(si.total) - sum(round(si.quantity * si.unit_cost)), 0)
               from app.sale_items si join paid on paid.id = si.sale_id) end,
    'cash_closings', (select coalesce(jsonb_agg(jsonb_build_object('closed_at', cs.closed_at, 'expected', cs.expected_cash,
               'counted', cs.counted_cash, 'difference', cs.difference, 'terminal', t.name, 'operator', m.display_name) order by cs.closed_at), '[]'::jsonb)
               from app.cash_sessions cs join app.terminals t on t.id = cs.terminal_id
               left join app.store_members m on m.id = cs.closed_by
               where cs.store_id = p_store_id and cs.status = 'closed' and cs.business_date between p_from and p_to)
  ) into v_out;
  return private.ok(v_out);
end;
$$;
