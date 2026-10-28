-- Agenda as rotinas que chamam Edge Functions (pg_cron + pg_net), uma vez por ambiente (addegas-dev, addegas-prd).
-- As rotinas só de banco (manutenção, alertas, SLA, pedidos, uso e retenção) já vêm nas migrations.
--
-- Antes, guarde no Vault do projeto (SQL Editor do painel, uma vez):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_url');
--   select vault.create_secret('<o mesmo CRON_SECRET das funções>', 'cron_secret');
-- Depois rode este arquivo no SQL Editor. É idempotente (cron.schedule substitui o job de mesmo nome).

create extension if not exists pg_net;

create or replace function private.call_function(p_path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url');
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret');
begin
  if v_url is null or v_secret is null then
    raise exception 'Configure functions_url e cron_secret no Vault (supabase/cron/agendar-funcoes.sql)';
  end if;
  return net.http_post(url := v_url || '/cron/' || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 30000);
end;
$$;
revoke execute on function private.call_function(text) from public, anon, authenticated;

-- 9h em São Paulo = 12:00 UTC: ciclo da assinatura com reconferência no Stripe (E33, §8).
select cron.schedule('addegas-cobranca-9h', '0 12 * * *', $$select private.call_function('billing')$$);
-- Caixa de entrada do Stripe (E42) e fila de mensagens (E35, E45), a cada minuto.
select cron.schedule('addegas-webhooks', '* * * * *', $$select private.call_function('webhooks')$$);
select cron.schedule('addegas-mensagens', '* * * * *', $$select private.call_function('outbox')$$);
