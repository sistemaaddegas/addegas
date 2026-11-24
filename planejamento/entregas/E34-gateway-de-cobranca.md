# E34 · Gateway de cobrança: checkout, webhooks e portal

**Marco:** M6 · Assinatura | **Tamanho:** G | **Depende de:** E33, E42 (caixa de webhooks) | **Desbloqueia:** E37, E08 (loja adicional)
**Origem:** §8 ("Stripe")

## Objetivo
A adega assina com cartão sem sair do fluxo, o gateway cobra todo mês e avisa o Addegas, e o estado da assinatura reflete o pagamento.

## Decisões aplicadas
- **D01: Stripe.**
- **D29:** três preços por produto no Stripe (mensal, semestral = `interval: month, interval_count: 6`, anual = `interval: year`).
- **D02/D54:** loja adicional como **segundo item da mesma assinatura**, com `quantity` = número de lojas extras. Mudar a quantidade gera cobrança proporcional (`proration_behavior: create_prorations`), e a loja só é liberada depois de `invoice.paid` da cobrança proporcional (E08).
- **D30:** nota fiscal de serviço emitida **manualmente** no começo. O Stripe só gera o recibo; a lista "faturas pagas sem NFS-e" no admin (E37) ajuda a não esquecer.
- **D56:** os avisos de cobrança saem pelo nosso e-mail (E35, `mail.addegas.com.br`) e pelo WhatsApp (E45). Os e-mails automáticos do Stripe (recibo, falha de cartão) ficam desligados para o cliente não receber mensagem duplicada; o portal do Stripe continua para trocar cartão.

## Entra (Stripe)
- Endpoint de webhook em produção: `https://app.addegas.com.br/api/hooks/stripe`.
- No cadastro (E06): criar o Customer no Stripe **sem cartão**, guardar `stripe_customer_id`. O teste roda no nosso banco (§8).
- Checkout: Stripe Checkout (hospedado) ou Payment Element embutido. Embutido evita redirect, mas exige liberar `js.stripe.com` na CSP (E04).
- Webhooks em `/api/hooks/stripe` → caixa de entrada (E42) com verificação de `Stripe-Signature` e tolerância de 5 min:
  - `invoice.paid` → fatura paga, assinatura `active`/`allowed`;
  - `invoice.payment_failed` → `past_due`/`grace`;
  - `customer.subscription.updated` / `deleted` → sincroniza status e `cancel_at_period_end`.
- `platform.invoices` e `platform.payments` espelhando o gateway (valor, status, vencimento, link da fatura, tentativa), com `unique (gateway, external_id)`.
- Retentativas do Stripe ligadas, mas **quem decide carência e suspensão é a rotina das 9h** (§8).
- Portal do cliente do Stripe para trocar cartão e segunda via (§8), aberto por função que gera a sessão do portal.
- Descontos do admin (E37) aplicados como cupom do Stripe.

## Não entra
- Pix e boleto recorrentes: dependem do que a conta brasileira liberar (§8). Validar antes (análise crítica, seção 4).
- Emissão automática de NFS-e (D30: manual no começo).
- Stripe Tax: o Brasil tem regras próprias de ISS; não usar cálculo automático de imposto do Stripe sem orientação contábil.

## Critérios de aceite
- Com Stripe CLI em modo teste: cada evento acima produz a transição esperada.
- Teste: assinatura anual com 1 loja adicional; adicionar a 2ª no meio do ciclo gera cobrança proporcional e libera a loja só depois do pagamento.
- Teste: troca de mensal para anual no meio do ciclo vale na hora, com crédito proporcional do período não usado (D54).
- Teste: mesmo evento entregue 3 vezes → processado uma vez.
- Teste: webhook com assinatura inválida → 400 e nada gravado além do registro de rejeição.

## Riscos e atenção
- Ordem dos eventos não é garantida: `subscription.updated` pode chegar antes de `invoice.paid`. Sempre buscar o estado atual no gateway ao processar, em vez de confiar só no payload.
- Preço em centavos dos dois lados; conferir moeda BRL.
