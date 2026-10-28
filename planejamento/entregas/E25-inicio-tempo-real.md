# E25 · Início em tempo real

**Marco:** M4 · Núcleo | **Tamanho:** P | **Depende de:** E19, E20, E22 | **Desbloqueia:** E41 (pedidos ao vivo)
**Origem:** §5 ("Tempo real ligado em `orders`, `sales` e `cash_sessions`"), §9 ("Broadcast disparado por trigger em canal privado")

## Objetivo
O Início do dono e a tela de Pedidos atualizam sozinhos quando há venda, pedido novo ou mudança no caixa.

## Entra
- Triggers em `sales`, `cash_sessions`, `tabs` e (depois) `orders` que chamam `realtime.broadcast_changes` (ou `realtime.send`) no tópico privado `store:{store_id}`, com payload mínimo (tipo do evento, id, valores necessários para o card). Nada de dados pessoais no payload.
- Política em `realtime.messages` permitindo `select` (receber) só para membros ativos da loja do tópico e terminais da loja.
- RPC `app.dashboard_today(store_id)` que devolve os números do Início (vendas do dia comercial, ticket médio, por forma de pagamento, caixas abertos, pedidos em andamento). O front busca uma vez e aplica os eventos; a cada reconexão, busca de novo.

## Não entra
- Notificação push no celular do dono (fora da v1; avaliar depois com PWA).

## Critérios de aceite
- Venda no terminal aparece no Início do dono em < 2 s.
- Teste: membro da loja A tenta assinar `store:{B}` → recusado.
- Reconexão após 5 min offline mostra números corretos (refetch, não só eventos).

## Riscos e atenção
- Tempo real não é garantia de entrega: evento perdido durante desconexão some. Por isso o refetch ao reconectar é obrigatório.
- Limites de conexões simultâneas e mensagens do Realtime dependem do plano (`D32`).
