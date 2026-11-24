-- E35/E45 · A fila de mensagens desiste depois de 5 tentativas (status 'dead'), como a caixa de webhooks (E42).
-- Antes, os dois ramos gravavam 'failed' e a mensagem era tentada para sempre. Reenvio manual: runbook da E52.

alter table platform.outbox drop constraint outbox_status_check;
alter table platform.outbox add constraint outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'dead', 'canceled'));

create or replace function private.outbox_result(p_id uuid, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update platform.outbox set
    status = case when p_ok then 'sent' when attempts >= 5 then 'dead' else 'failed' end,
    sent_at = case when p_ok then now() end, provider_message_id = p_provider_id, error = left(p_error, 1000),
    scheduled_for = case when p_ok then scheduled_for else now() + make_interval(mins => 2 * attempts) end
  where id = p_id;
$$;
