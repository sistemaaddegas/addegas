# E18 · Combos e acesso rápido do caixa

**Marco:** M4 · Núcleo | **Tamanho:** P | **Depende de:** E16, E17 | **Desbloqueia:** E20
**Origem:** §5 (`combos`, `combo_items`, `quick_access`)
**Decisões aplicadas:** D52 (combo e promoção na mesma tabela). As tabelas abaixo passam a se chamar `app.bundles` e `app.bundle_items`, com `kind` (`combo`/`promotion`), início e fim opcionais e "mostrar no catálogo". A E29 só acrescenta o período e a vitrine.

## Objetivo
Vender combos que baixam o estoque dos produtos que os compõem, e montar a grade de atalhos do caixa.

## Entra
- `app.bundles` (account_id, kind, nome, preço padrão em centavos, preço por loja opcional como no produto (D37), ativo, imagem) e `app.bundle_items` (bundle_id, account_id, product_id, quantidade), com FK composta `(bundle_id, account_id)` e `(product_id, account_id)`: o combo é da conta, como o produto (E16).
- Combo não tem estoque próprio: a disponibilidade é o mínimo de `saldo do item / quantidade no combo`. View `app.combo_availability` (`security_invoker`).
- **[novo]** Combo fica indisponível automaticamente quando algum item está inativo (corrige o ponto 10 da análise crítica).
- `app.quick_access` (store_id, posição, product_id ou combo_id, cor): é o "acesso rápido" do caixa no front (ids e cores salvos no estado `mine`).
- Permissão: `precos` para criar e editar combos.

## Não entra
- Promoções com preço por período (E29).

## Critérios de aceite
- Teste: venda de 2 combos "Balde 6 long necks" baixa 12 unidades do produto.
- Teste: produto do combo desativado → combo aparece indisponível.
- Teste: combo de outra conta não pode usar produto desta conta (FK composta).

## Riscos e atenção
- Margem de combo: custo = soma dos custos médios dos itens. Garantir que o relatório de margem use o custo **no momento da venda** (gravado em `sale_items`), não o atual.
