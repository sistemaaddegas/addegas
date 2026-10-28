# E47 · Uso do sistema e funis

**Marco:** M9 · Crescimento | **Tamanho:** M | **Depende de:** E05, E46 | **Desbloqueia:** E40 (uso efetivo)
**Origem:** §1 ("Uso, funis por evento"), §5 (`analytics.events`, `daily_usage`, `funnels`, `funnel_steps`)

## Objetivo
Saber quais adegas usam o sistema de verdade e onde as novas param no onboarding.

## Entra
- `analytics.events` (account, store, user, nome do evento, propriedades, quando), particionada por mês. Eventos de negócio gravados **pelo servidor** nas RPCs (venda finalizada, caixa fechado, entrada de estoque), não pelo front, para não depender de adblock.
- Eventos de produto do front (tela vista, botão) por `POST /api/events` com amostragem e limite.
- `analytics.daily_usage` (conta, dia, ações de negócio, usuários ativos), consolidado às 2h.
- Funis configuráveis (`funnels`, `funnel_steps`): ex.: cadastro → onboarding completo → primeira venda → primeiro fechamento de caixa → assinatura.
- Alerta "assinante sem atividade há 7 dias" (o admin já tem a regra) e "uso baixo" para retenção.

## Critérios de aceite
- Teste: venda finalizada gera 1 evento mesmo se o front não mandar nada.
- Funil de onboarding com dados sintéticos bate com contagem manual.

## Riscos e atenção
- Evento de front é dado pessoal se tiver identificação; respeitar a política de privacidade (E51).
