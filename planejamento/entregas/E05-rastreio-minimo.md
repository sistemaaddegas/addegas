# E05 · Rastreio mínimo: ID de correlação e log estruturado

**Marco:** M1 · Fundação (antecipado da etapa 8 do documento) **[novo na ordem]** | **Tamanho:** P | **Depende de:** E03, E04 | **Desbloqueia:** E13, E46
**Origem:** §7 ("Rastreio", "Logs")

## Objetivo
Desde o primeiro deploy, qualquer erro pode ser ligado a uma ação do usuário. O painel de monitoramento completo fica para a E46; aqui só a base.

## Entra
- Convenção: o front gera `x-correlation-id` (UUID v7, ordenável) por ação do usuário e manda em toda chamada (REST, RPC, função).
  - Em RPC via PostgREST, ler com `current_setting('request.headers', true)::json ->> 'x-correlation-id'`.
- Módulo `_shared/log.ts` das funções: log em JSON (`level`, `correlation_id`, `function`, `user_id`, `store_id`, `duration_ms`, `error_code`), mascarando e-mail (`m***@dominio`), IP (último octeto) e nunca registrando senha, token ou cartão.
- Tabela `audit.system_logs` mínima (origem `front`/`back`/`security`, nível, código, mensagem, correlation_id, contexto jsonb, created_at), com **partição mensal desde já** (mais fácil criar particionada do que converter depois).
- Função `POST /api/logs` para o front mandar erros (com limite de tamanho e de taxa por sessão).

## Não entra
- Regras de alerta, painel, retenção automatizada (E46).

## Critérios de aceite
- Um erro forçado numa RPC aparece em `audit.system_logs` com o mesmo `correlation_id` que o front gerou.
- Teste: log com e-mail ou token no contexto é gravado mascarado.

## Riscos e atenção
- Sem limite de taxa, `/api/logs` vira alvo fácil para encher o banco. Limitar por IP no firewall e por usuário na função.
- Avaliar um serviço pronto de erros de front em vez de gravar tudo no Postgres; o banco não é o melhor lugar para volume alto de logs.
