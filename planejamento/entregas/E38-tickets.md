# E38 · Tickets de suporte com SLA

**Marco:** M7 · Painel Addegas | **Tamanho:** M | **Depende de:** E14, E15, `D48` | **Desbloqueia:** E46 (ligação com logs)
**Origem:** §1 ("tickets com anexo", "tickets com SLA e mensagens internas"), §5 (`support` schema), §8 ("Prazo dos tickets")

## Objetivo
A adega abre um chamado pelo app, com anexo, e o suporte responde dentro de prazos medidos.

## Entra
- `support.tickets` (account_id, store_id, aberto_por, tipo `problema`/`duvida`/`melhoria`/`financeiro`, assunto, descrição, urgência, prioridade, status `novo`/`em_andamento`/`aguardando_cliente`/`resolvido`/`fechado`, responsável, primeira resposta em, resolvido em, correlation_ids relacionados).
- `support.ticket_messages` (autor, lado `cliente`/`equipe`, texto, **nota interna** que a adega não vê).
- `support.ticket_attachments` no bucket `ticket-attachments` (E15).
- Adega: RPC `app.open_ticket` e `app.my_tickets` (só os da própria conta, sem notas internas). O front da adega já tem a tela "Suporte" com chamados.
- Equipe: via `admin-api` (listar, atribuir, responder, nota interna, mudar status/prioridade).
- SLA (§8): primeira resposta em 1, 4, 8 e 24 h; resolução em 8, 24, 72 e 120 h, por prioridade. O prazo fica pausado enquanto o ticket está `aguardando_cliente`. Rotina a cada 15 min marca atraso.
- Ligação com erro: ao abrir ticket do tipo "problema", o front anexa os últimos `correlation_id` da sessão, e o suporte vê os logs ligados (E46).

## Não entra
- Grupos de melhoria (`improvement_groups`) e votação: adiar (análise crítica, seção 5).
- Notificação por WhatsApp de resposta ao ticket (pode usar E45 depois).

## Critérios de aceite
- Teste: adega A não lê tickets da adega B; nunca vê notas internas.
- Teste: ticket de prioridade alta sem resposta em 1 h → marcado atrasado.
- Teste: conta suspensa consegue abrir ticket (§1).

## Riscos e atenção
- Avaliar ferramenta pronta de atendimento (`D48`) antes de construir; o valor próprio está em ligar ticket a logs e à ficha da adega.
