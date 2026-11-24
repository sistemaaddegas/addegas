-- E23 · Tela "Clientes e fiado" para quem está logado (dono, gerente, quem tem fiado_receber), fora do terminal.
-- O fiado continua nascendo só na venda (D19): aqui não há cadastro, só lista, baixa e ajuste de limite e data.

-- Todos os fiados da loja, com telefone completo para quem pode receber (E23: "ligar") e a última compra.
create or replace function app.fiado_accounts_list(p_store_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.can(p_store_id, 'fiado_receber') then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object(
      'fiado_account_id', f.id, 'name', f.name, 'phone', f.phone, 'balance', f.balance,
      'credit_limit', f.credit_limit, 'promised_date', f.promised_date, 'note', f.note,
      'last_purchase', (select max(l.created_at) from app.fiado_ledger l
        where l.fiado_account_id = f.id and l.type = 'fiado_sale')
    ) order by f.balance > 0 desc, f.promised_date nulls last, f.name), '[]'::jsonb)) end
  from app.fiado_accounts f where f.store_id = p_store_id;
$$;

-- Baixa feita pelo celular de quem está logado: só Pix ou cartão, porque dinheiro tem de entrar na gaveta
-- (aí é no caixa, com app.receive_fiado_payment).
create or replace function app.receive_fiado_by_member(p_store_id uuid, p_fiado_account_id uuid, p_amount bigint, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f app.fiado_accounts;
  v_member uuid := private.my_member_id(p_store_id);
begin
  if not private.can(p_store_id, 'fiado_receber') then
    perform private.audit_store('fiado.payment', p_store_id, p_outcome => 'denied');
    return private.err('FORBIDDEN');
  end if;
  select * into v_f from app.fiado_accounts where id = p_fiado_account_id and store_id = p_store_id for update;
  if not found then
    return private.err('FIADO_NOT_FOUND');
  end if;
  if coalesce(p_amount, 0) <= 0 or p_amount > v_f.balance then
    return private.err('FIADO_PAYMENT_INVALID', format('saldo %s', v_f.balance));
  end if;
  if p_method not in ('pix', 'credit', 'debit') then
    return private.err('FIADO_PAYMENT_METHOD');
  end if;

  insert into app.fiado_ledger (store_id, fiado_account_id, type, amount, method, member_id, note)
  values (p_store_id, p_fiado_account_id, 'payment', -p_amount, p_method::app.pay_method, v_member, 'Recebido fora do caixa');
  perform private.audit_store('fiado.payment', p_store_id, null, 'fiado_account', p_fiado_account_id::text,
    jsonb_build_object('balance', v_f.balance), jsonb_build_object('balance', v_f.balance - p_amount, 'method', p_method));
  return private.ok(jsonb_build_object('balance', v_f.balance - p_amount));
end;
$$;

revoke execute on function app.fiado_accounts_list(uuid) from public, anon;
grant execute on function app.fiado_accounts_list(uuid) to authenticated;
revoke execute on function app.receive_fiado_by_member(uuid, uuid, bigint, text) from public, anon;
grant execute on function app.receive_fiado_by_member(uuid, uuid, bigint, text) to authenticated;
