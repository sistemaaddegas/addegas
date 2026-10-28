# E16 · Catálogo mestre (leitura), categorias, produtos e preços por loja

**Marco:** M4 · Núcleo | **Tamanho:** M | **Depende de:** E12, E15 | **Desbloqueia:** E17, E18, E39
**Origem:** §5 ("Catálogo e estoque"), §1 ("Produtos")
**Decisões aplicadas:** D37 (preço padrão na conta, preço por loja opcional), D39 (planilha), D09 (quantidade `numeric`)

## Objetivo
A adega monta o cadastro uma vez para a conta inteira, escolhendo do catálogo mestre (com foto e EAN) ou criando produto próprio, e define preço padrão e, se quiser, um preço diferente em cada loja.

## Mudança de modelo (D37)
Na migration atual, o produto pertence à loja. Com a decisão, o **produto pertence à conta**, e o que muda por loja é preço (opcional) e estoque:
```
accounts ─┬─ products (preço padrão, custo médio, EAN, categoria)
          └─ stores ─┬─ store_product_prices (preço da loja, opcional)
                     └─ product_stock / stock_movements (estoque é sempre da loja)
```
Preço efetivo na loja = `coalesce(preço da loja, preço padrão)`, calculado no servidor (`private.effective_price(product_id, store_id)`) e usado pelo `finalize_sale` (E20).

## Entra
- `platform.catalog_products` (EAN, nome, marca, volume em ml, teor alcoólico, categoria sugerida, imagem, versão, status), lido pela adega por RPC de busca, sem expor o schema `platform`.
- `app.categories` (account_id, nome, cor, ordem), semeada com as categorias do front.
- `app.products` (account_id, category_id, catalog_product_id opcional, nome, EAN, **preço padrão** em centavos, custo médio em centavos, estoque mínimo padrão, unidade, ativo, imagem própria; `unique (account_id, ean)` quando houver EAN).
- `app.store_product_prices` (store_id, product_id, preço; e opcionalmente `active` por loja, para um produto que uma das lojas não vende). Sem linha = usa o padrão.
- `app.store_product_settings` (store_id, product_id, estoque mínimo da loja), se o mínimo variar por loja.
- RLS: produto visível para membros de qualquer loja da conta; editar o padrão exige `precos` e ser dono ou gerente em alguma loja da conta (regra da E12); editar o preço da loja exige `precos` **naquela loja**.
- RPC `app.add_products_from_catalog(account_id, [{catalog_id, preço, estoque_inicial_por_loja}])` para o onboarding.
- Importação de planilha (D39): nome, EAN, preço, custo, estoque, categoria; upload em `imports` (E15) → prévia (válidas, erros, duplicados por EAN; **atualiza** quando o EAN já existe) → confirmação grava em lote, com movimento de estoque inicial na loja escolhida.
- Busca: `pg_trgm` em nome; índice em `(account_id, ean)` para o leitor de código de barras.
- Histórico de preço via auditoria (E13).

## Não entra
- Edição do catálogo mestre pela equipe (E39), combos (E18).

## Regras
- O produto ligado ao catálogo herda nome e foto, mas a conta pode sobrescrever o nome de exibição.
- Desativar produto não apaga histórico; produto com venda não pode ser excluído.
- Preço zero só com permissão de desconto.
- Mudar o preço padrão não mexe nos preços específicos das lojas; a tela mostra quais lojas têm preço próprio.

## Critérios de aceite
- Teste: produto com padrão R$ 10,00 e preço da Loja 2 = R$ 12,00 → vende a R$ 10,00 na Loja 1 e a R$ 12,00 na Loja 2.
- Teste: apagar o preço da Loja 2 → volta a vender a R$ 10,00.
- Teste: dois produtos com o mesmo EAN na mesma conta → recusado.
- Teste: caixa tenta alterar preço → recusado e auditado.
- Teste: planilha com 500 linhas, 3 erros e 20 EANs existentes → prévia mostra 477 novos, 20 atualizações e 3 erros com número da linha.
- Busca por "heine" retorna Heineken em < 50 ms com 5 mil produtos.

## Riscos e atenção
- O produto por conta afeta todas as tabelas que ligam produto e loja (estoque, venda, combo, comanda): toda FK composta passa a ser `(product_id, account_id)` mais `store_id` na tabela filha.
