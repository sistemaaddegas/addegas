# E33 · Ciclo da assinatura e rotina das 9h (sem gateway)

**Marco:** M6 · Assinatura (máquina de estados antecipada para o M3/M4) | **Tamanho:** M | **Depende de:** E06, E32, `D28` | **Desbloqueia:** E12 (estado de acesso), E34, E36
**Origem:** §1 ("Assinatura e acesso são eixos separados"), §8 ("Ciclo da assinatura", "Rotinas agendadas")
**Decisões aplicadas:** D28 (carência de 5 dias corridos a partir da primeira falha), D29 (ciclos mensal, semestral e anual: o período da assinatura segue o ciclo), D02 (quantidade de lojas adicionais guardada na assinatura), D27 (acesso temporário = liberar conta suspensa)

## Objetivo
Cada conta tem um estado de assinatura e um estado de acesso, que mudam sozinhos por regra, com histórico e sem depender do gateway para existir.

## Entra
- `platform.subscriptions` (account_id, plan_id, ciclo, preço contratado, lojas adicionais (quantidade e preço contratado), status `trial`/`active`/`past_due`/`canceled`/`expired`, acesso `allowed`/`grace`/`suspended`, trial_ends_at, current_period_start/end, grace_ends_at, cancel_at_period_end, temp_access_until, ids do gateway).
- `platform.subscription_events` (só inserção): de → para, motivo, autor (`system`, staff, webhook), correlation_id.
- Exposição à adega: RPC `app.my_subscription(account_id)` (estado, dias restantes, link de regularização), sem expor `platform`.
- Transições (tabela de verdade, testada):
  | De | Evento | Para (assinatura / acesso) |
  | --- | --- | --- |
  | trial / allowed | 14 dias sem assinar | expired / suspended |
  | trial / allowed | checkout pago | active / allowed |
  | active / allowed | fatura falhou | past_due / grace (carência de 5 dias corridos a partir da primeira falha, D28) |
  | past_due / grace | pagamento confirmado | active / allowed |
  | past_due / grace | carência vencida **e** pagamento reconferido | past_due / suspended |
  | active / allowed | cancelamento pedido | active / allowed + `cancel_at_period_end` |
  | active (cancel_at_period_end) | fim do ciclo | canceled / suspended |
  | qualquer / suspended | acesso temporário do suporte | igual / allowed até `temp_access_until` (não quita, não reinicia carência) |
- Rotina diária às 9h (America/Sao_Paulo = 12:00 UTC no pg_cron): conferir pagamentos pendentes no gateway antes de qualquer suspensão (§8), abrir carência, suspender, expirar testes, aplicar cancelamentos agendados, encerrar acesso temporário vencido.
- **Idempotência [novo]**: cada execução grava `platform.job_runs (job, run_date, status)` com `unique (job, run_date)`; a transição só acontece se o estado atual ainda for o de origem (update condicional). Rodar duas vezes não manda dois avisos nem suspende duas vezes.
- Disparo das mensagens de cobrança (E35 e E45) via fila, nunca dentro da transação da rotina.

## Não entra
- O gateway (E34): nesta entrega, "pagamento confirmado" pode ser simulado pelo admin (pagamento manual, E37).

## Critérios de aceite
- Teste para cada linha da tabela de transições.
- Teste: rotina rodada duas vezes no mesmo dia → mesmo resultado, 1 evento por transição.
- Teste: conta suspensa lê relatórios e abre ticket, mas não vende (integração com E12).

## Riscos e atenção
- Semestral e anual: a carência e a suspensão valem igual, mas o aviso "fatura chegando" deve sair com mais antecedência (ex.: 7 dias antes), porque o valor é maior e o cartão pode ter limite.
- Fuso: pg_cron roda em UTC. Brasil não tem horário de verão hoje, mas guardar o horário como "9h America/Sao_Paulo" e converter, caso volte.
- Pagamento confirmado no gateway às 8h59 e rotina às 9h: por isso a reconferência antes de suspender (§8).
