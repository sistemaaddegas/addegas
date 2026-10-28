# E42 · Caixa de entrada de webhooks e reprocessamento

**Marco:** M8 · Integrações (**pré-requisito da E34**, construir junto ou antes) | **Tamanho:** M | **Depende de:** E04, E05 | **Desbloqueia:** E34, E43, E44
**Origem:** §7 ("Webhooks"), §8 ("Reprocessamento de webhooks a cada 5 min"), §9 ("`pgmq` ou `for update skip locked`")

## Objetivo
Todo evento de parceiro é recebido, verificado, guardado bruto e processado uma única vez, mesmo que chegue repetido, fora de ordem ou durante uma falha.

## Entra
- Rota por parceiro: `/api/hooks/<parceiro>` → função `hooks-<parceiro>` (ou uma função com roteador).
- Passos na recepção (rápidos, resposta 200 em < 1 s):
  1. verificar assinatura do parceiro e tolerância de 5 min no horário;
  2. gravar payload bruto em `audit.webhook_inbox` (parceiro, tipo, external_event_id, chave de idempotência **única**, headers relevantes, payload, recebido_em, status `pending`);
  3. conflito na chave única → responder 200 sem reprocessar (duplicado);
  4. enfileirar o processamento (pgmq) e responder 200.
- Processador: consome a fila, processa cada evento numa transação, marca `processed` ou `failed` com erro e número de tentativas; backoff exponencial; após N tentativas, `dead` e alerta (E46).
- Rotina a cada 5 min reenfileira `failed` elegíveis.
- Reprocessamento manual pelo admin (perfil Suporte/Mestre) com auditoria.
- Métrica: duplicados por hora por parceiro (regra de alerta "mais de 50 duplicados/hora", §8).
- Retenção do payload bruto (contém dados pessoais do cliente final em pedidos): 90 dias, depois só metadados (`D26`).

## Critérios de aceite
- Teste: mesmo evento 412 vezes → 1 processamento, 411 duplicados contados.
- Teste: processador falha no meio → evento volta para a fila e é processado depois sem efeito duplicado.
- Teste: assinatura inválida → 400, linha de rejeição sem payload completo.

## Riscos e atenção
- Responder 200 antes de processar exige que o processamento seja confiável; sem a fila, um erro silencioso perde o pedido.
