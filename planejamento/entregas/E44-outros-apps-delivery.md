# E44 · Zé Delivery, 99Food e Keeta (uma sub-entrega por app)

> ⏸️ **Em espera (D21, 28/10/2026).** Depende da E43, que também está em espera.

**Marco:** M8 · Integrações | **Tamanho:** G por app | **Depende de:** E43, `D21` (**bloqueante**) | **Desbloqueia:** —
**Origem:** §1 e §8

## Objetivo
Repetir o padrão do iFood para cada app, um de cada vez, só depois de confirmar que existe acesso à API.

## Sub-entregas
- **E44a · Zé Delivery**
- **E44b · 99Food**
- **E44c · Keeta**

Cada uma segue o roteiro da E43: acesso e contrato → modelo (webhook/polling) → vínculo da loja e token no Vault → mapeamento para `orders` → ações de volta → homologação → piloto com 1 loja.

## Antes de começar
Não há confirmação de API pública aberta para PDVs de terceiros nesses três apps; o acesso costuma depender de parceria comercial. Sem acesso confirmado, a sub-entrega não entra no planejamento (`D21`).

## Alternativa enquanto não houver API
Lançamento manual rápido do pedido do app na tela de Pedidos (E41), com o canal correto, para os relatórios por canal já funcionarem.

## Critérios de aceite
Os mesmos da E43, por app.

## Riscos e atenção
- O front já promete "Pedidos do iFood, Zé Delivery, 99Food, Keeta e WhatsApp entram automaticamente". Se algum não tiver API, o texto do design precisa mudar antes do lançamento.
