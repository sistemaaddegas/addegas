# E40 · Admin: visão geral e métricas do negócio

**Marco:** M7 · Painel Addegas | **Tamanho:** M | **Depende de:** E33, E37, E47 (para "uso efetivo") | **Desbloqueia:** —
**Origem:** §1 ("MRR, recebido, churn, conversão do teste, uso efetivo (ações, não sessões abertas)"), §8 ("foto do MRR" na rotina das 2h)

## Objetivo
A equipe vê a saúde do negócio com números definidos de forma única e reproduzível.

## Entra
- Definições escritas (glossário no código e na tela):
  - **MRR**: soma do preço contratado mensal das assinaturas `active` e `past_due` (em carência), descontos recorrentes já aplicados; teste não entra.
  - **Recebido**: soma de pagamentos confirmados no período, menos reembolsos.
  - **Churn de logos**: contas que passaram a `canceled`/`expired` (exceto teste) no mês ÷ contas ativas no início do mês.
  - **Conversão do teste**: contas que saíram de `trial` para `active` ÷ contas cujo teste terminou no período.
  - **Uso efetivo**: dias com pelo menos uma ação de negócio (venda, entrada de estoque, fechamento) nos últimos 30 dias (E47), não sessões abertas.
  - **GMV das adegas**: soma das vendas registradas (indicador de operação, **não** receita do Addegas, como o admin já explica).
- `analytics.mrr_snapshots` (dia, MRR, contas por status) gravado pela rotina das 2h, para o gráfico histórico não depender de recalcular o passado.
- Endpoints de leitura na `admin-api` com cache curto.

## Critérios de aceite
- Teste com dados sintéticos: MRR, churn e conversão batem com cálculo feito à mão numa planilha de referência.

## Riscos e atenção
- Métrica sem definição escrita vira discussão. O glossário vale mais que o gráfico.
