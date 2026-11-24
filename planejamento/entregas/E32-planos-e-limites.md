# E32 · Plano único, ciclos, loja adicional e limites

**Marco:** M6 · Assinatura (antecipar para antes do fim do M4) | **Tamanho:** M | **Depende de:** E12 | **Desbloqueia:** E33, E08, E34
**Origem:** §4 ("Limites do plano"), §8, §10 ("plano único de R$ 149,90")
**Decisões aplicadas:** D02 e D03 (plano único + loja adicional paga), D29 (mensal, semestral e anual), D54 (valores decididos)

## Objetivo
Ter no banco o plano único, os três ciclos de cobrança e o adicional por loja, com recursos e limites conferidos pelo servidor, e a estrutura pronta para outros planos no futuro.

## Entra
- `platform.plans` (código, nome, ativo, visível para venda). Seed v1: **Addegas**.
- `platform.plan_prices` (plan_id, ciclo `monthly`/`semiannual`/`annual`, preço em centavos, id do preço no Stripe, ativo). Seed v1 (D54, decidido):
  | Ciclo | Preço | Equivale a |
  | --- | --- | --- |
  | Mensal | R$ 149,90 | R$ 149,90/mês |
  | Semestral (−10%) | R$ 809,46 | R$ 134,91/mês |
  | Anual (−20%) | R$ 1.439,04 | R$ 119,92/mês |
- `platform.addons` + `platform.addon_prices`: **loja adicional**, um preço por ciclo: R$ 49,90/mês, R$ 269,46 no semestral (−10%) e R$ 479,04 no anual (−20%).
- `platform.plan_features` (plan_id, feature_code, limite ou ilimitado): `stores_included = 1`, `members` ilimitado, `products` ilimitado, `terminals` ilimitado, `whatsapp_alerts`, `public_catalog`, `integrations_delivery` (desligado enquanto D21 estiver em espera).
- Lojas permitidas = `stores_included` + quantidade de "loja adicional" na assinatura (E33/E34).
- `private.plan_allows(account_id, feature)` e `private.stores_allowed(account_id)`, usados pelo `can` (E12) e pela `create_store` (E08).
- Triggers de limite no insert (lojas, e o que mais tiver limite no futuro) com `for update` na conta.
- Preço contratado guardado na assinatura: mudar o preço de tabela não altera quem já assina, até aviso com 30 dias (regra que o admin já mostra).

## Não entra
- Telas do admin para editar planos (E37).

## Critérios de aceite
- Teste: conta com 1 loja incluída e 0 adicionais tenta criar a 2ª → `PLAN_LIMIT_STORES`.
- Teste: conta com 1 adicional cria a 2ª; a 3ª é recusada.
- Teste: os três preços do ciclo existem e batem com os preços cadastrados no Stripe (teste de sincronização no CI do dev).

## Riscos e atenção
- O front ainda mostra Bairro, Esquina e Rede. Sem o ajuste no design (E00), a tela mostra planos que não existem no banco.
- Desconto de ciclo e desconto do admin (E37) podem se somar; definir na E37 se descontos promocionais valem para semestral e anual.
