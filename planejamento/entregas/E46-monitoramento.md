# E46 · Monitoramento: logs, regras de alerta e retenção

**Marco:** M9 · Observabilidade | **Tamanho:** M | **Depende de:** E05, E42, `D26` | **Desbloqueia:** —
**Origem:** §1 ("Logs de front, back e segurança com ID de correlação, regras de alerta"), §8 (rotinas horária e das 2h), §9 (partições)

## Objetivo
A equipe descobre o problema antes da adega abrir o ticket, e os logs não crescem sem limite.

## Entra
- Tela de logs no admin (filtro por origem, nível, adega, correlation_id), ligando ticket, erro de front e erro de back pelo mesmo ID.
- `audit.alert_rules` (as do admin: erros de front acima de 3× a média dos últimos 7 dias; mais de 50 webhooks duplicados por hora; força bruta no login) e `audit.alert_events`.
- Rotina horária avalia as regras; aviso para a equipe (e-mail ou canal interno).
- Partições mensais para `system_logs`, `events`, `store_actions`, `admin_actions`; rotina que cria a partição do mês seguinte com antecedência (sem ela, o insert falha no dia 1º) e apaga partições vencidas pela retenção.
- Retenção configurável por origem (§7, D26 decidido): 30 dias front, 90 dias back, **180 dias segurança** (atende o mínimo de 6 meses do Marco Civil para registros de acesso); auditoria de ações (E13) sem prazo, anonimizada na exclusão da conta.
- Rotina das 2h: limpeza de `exports` com mais de 24 h (E15), consolidações (E47).

## Critérios de aceite
- Teste: virada de mês com a rotina desligada por 1 dia ainda grava (partição criada com 7 dias de antecedência).
- Teste: regra de duplicados dispara com 51 duplicados na hora e não dispara com 50.

## Riscos e atenção
- Avaliar serviço externo de erros e de logs antes de construir a tela própria (análise crítica, seção 5).
