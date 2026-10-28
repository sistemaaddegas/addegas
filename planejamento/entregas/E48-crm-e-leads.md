# E48 · CRM e leads

**Marco:** M9 · Crescimento | **Tamanho:** M | **Depende de:** E14, `D23` | **Desbloqueia:** E49
**Origem:** §1 ("funil de leads com origem e UTM, motivo de perda"), §5 (`leads`, `lead_events`, `lead_stages`)

## Objetivo
O comercial acompanha cada interessado, da origem até virar assinante ou ser perdido com motivo.

## Entra
- `platform.lead_stages` (seed das etapas do admin), `platform.leads` (nome da adega, responsável, telefone, bairro, cidade, origem, UTM source/medium/campaign/term/content, etapa, responsável comercial, próxima tarefa, motivo de perda, account_id quando converter), `platform.lead_events` (histórico: contato, mudança de etapa, anotação).
- Entrada de leads: formulário da landing (E53, D23) com captcha → função `/api/leads`; cadastro direto no app (E06) cria/atualiza o lead e liga à conta. A landing já grava as UTMs; esta entrega só precisa da tabela e da tela do CRM.
- Atribuição: último clique não direto com UTM, janela de 30 dias até o cadastro (regra que o admin já mostra).
- Tarefas com data ("Acompanhar primeiro fechamento") e lista "minhas tarefas de hoje".

## Critérios de aceite
- Teste: cadastro vindo de link com UTM → lead com origem preenchida e ligado à conta.
- Teste: lead perdido exige motivo.

## Riscos e atenção
- Avaliar CRM pronto antes de construir (análise crítica, seção 5). O que é próprio de verdade é ligar lead à conta e ao uso.
