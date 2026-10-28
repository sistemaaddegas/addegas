# E30 · Lucro no Copo e Anotações

**Marco:** M5 · Gestão complementar | **Tamanho:** M | **Depende de:** E16, E17, E15, `D09` | **Desbloqueia:** —
**Origem:** §1 ("receitas de drinks com custo por ml, notas com prioridade"), §5 (`drink_recipes`, `drink_recipe_items`, `notes`); `data/lucro-no-copo.js`

## Objetivo
Calcular custo e margem de cada drink montado com produtos do estoque, e guardar anotações da loja.

## Entra — Lucro no Copo
- Estrutura igual ao `data/lucro-no-copo.js`: categorias de insumo (destilado, energético, gelo, refrigerante, cerveja) com unidade (`ml` ou `un`), passo, mínimo, máximo e padrão; insumos ligados a produtos do estoque com volume em ml e custo.
- `app.drink_recipes` (nome, preço de venda, imagem no bucket `store-public/drinks`, ativo) e `app.drink_recipe_items` (product_id, quantidade em ml ou un).
- Cálculo no servidor: custo do drink = Σ (custo médio do produto ÷ volume em ml × ml usados) + itens por unidade; margem e markup. View `app.drink_recipe_costs` (`security_invoker`).
- **Decidido (D09):** na v1 o Lucro no Copo é **calculadora** e não toca no estoque. A quantidade já nasce `numeric(12,3)` (E03), para que a venda de drink com baixa em ml (garrafa aberta x fechada, contagem por ml) entre depois do piloto sem migração de tipo. O `estoque` em ml do arquivo de exemplo é só exibição.

## Entra — Anotações
- `app.notes` (store_id, autor, título, texto, prioridade `alta`/`media`/`baixa`, concluída, fixada, created_at). **Decidido (D53):** anotações da loja, visíveis a todos os membros; editar exige `ferramentas`.

## Critérios de aceite
- Teste: drink com 50 ml de Jack (R$ 120 / 1000 ml) + 200 ml de energético (R$ 8 / 250 ml) → custo R$ 12,40.
- Teste: mudança de custo médio do produto reflete no custo do drink sem regravar a receita.

## Riscos e atenção
- O arquivo de exemplo usa custo em reais com decimais (`49.9`); no banco, centavos. Na conta por ml, arredondar só no fim.
