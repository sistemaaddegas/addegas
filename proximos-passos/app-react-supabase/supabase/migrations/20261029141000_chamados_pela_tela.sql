-- E38 · Tela "Registrar ticket" da adega: anexar o print enviado pelo uploads e listar os chamados com a descrição.

-- Liga ao chamado um arquivo que o /api/uploads já conferiu (platform.files). O caminho tem de ser {conta}/{chamado}/...
create or replace function app.attach_ticket_file(p_ticket_id uuid, p_path text, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t support.tickets;
  v_f platform.files;
begin
  select * into v_t from support.tickets where id = p_ticket_id;
  if not found or not private.is_account_member(v_t.account_id) then
    return private.err('FORBIDDEN');
  end if;
  select * into v_f from platform.files where bucket = 'ticket-attachments' and path = p_path;
  if not found or p_path not like v_t.account_id::text || '/' || p_ticket_id::text || '/%' then
    return private.err('UPLOAD_NOT_FOUND');
  end if;
  insert into support.ticket_attachments (ticket_id, path, name, size_bytes, mime, uploaded_by)
  values (p_ticket_id, p_path, left(coalesce(p_name, v_f.original_name), 120), v_f.size_bytes, v_f.mime, (select auth.uid()));
  return private.ok();
end;
$$;

-- Mesma lista de antes, agora com descrição, urgência e quantos anexos (a tela mostra "com imagem").
create or replace function app.my_tickets(p_account_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not private.is_account_member(p_account_id) then private.err('FORBIDDEN') else
    private.ok(coalesce(jsonb_agg(jsonb_build_object('ticket_id', t.id, 'number', t.number, 'kind', t.kind, 'subject', t.subject,
      'description', t.description, 'priority', t.priority, 'status', t.status, 'created_at', t.created_at,
      'attachments', (select count(*) from support.ticket_attachments a where a.ticket_id = t.id),
      'messages', (select coalesce(jsonb_agg(jsonb_build_object('side', m.side, 'body', m.body, 'created_at', m.created_at)
                   order by m.created_at), '[]'::jsonb) from support.ticket_messages m where m.ticket_id = t.id and not m.internal))
      order by t.created_at desc), '[]'::jsonb)) end
  from support.tickets t where t.account_id = p_account_id;
$$;

revoke execute on function app.attach_ticket_file(uuid, text, text) from public, anon;
grant execute on function app.attach_ticket_file(uuid, text, text) to authenticated;
