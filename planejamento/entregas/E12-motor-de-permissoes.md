# E12 · Motor de permissões da loja (`private.can`) e RLS padrão

**Marco:** M3 · Permissões | **Tamanho:** M | **Depende de:** E06, E07, E09, E10, `D04` | **Desbloqueia:** todo o núcleo (E16+)
**Origem:** §4 ("Dentro da adega"), §9 (itens críticos e altos)

## Objetivo
Uma única função decide se uma ação passa, e ela é usada tanto pela RLS quanto pelas RPCs. A tela só esconde o que o servidor já recusaria.

## Entra
- `app.permissions` (código, nome, grupo, descrição): catálogo fixo, semeado pela migration. Corrige o texto livre da migration atual.
- `app.role_permissions` (store_id, role, permission_code, allowed), semeada por loja na criação com o padrão da §4. Editável pelo dono.
- `private.can(p_store_id uuid, p_permission text) returns boolean`, `security definer`, `set search_path = ''`, `stable`, com `revoke execute` de `public`, `anon`, `authenticated` (§9):
  1. principal é membro ativo da loja (pessoa) **ou** terminal ativo da loja com sessão de operador válida (E10);
  2. o estado de acesso da conta permite (E33): `suspenso` libera só leitura, regularização e suporte;
  3. o plano inclui o recurso (E32);
  4. a função tem a permissão; o dono sempre tem tudo.
- Wrapper `app.my_permissions(store_id)` para o front montar menus (só leitura, devolve a lista calculada).
- Padrão de política RLS, aplicado a toda tabela do `app`:
  - SELECT: `using ((select private.is_member(store_id)))`;
  - INSERT/UPDATE/DELETE: `using` **e** `with check` com `(select private.can(store_id, '<perm>'))` (§9: sem `WITH CHECK` dá para mover linha de loja);
  - escrita sensível só por RPC (revogar `insert/update/delete` direto).
- Índices em `store_id` e `account_id` em todas as tabelas (§9).

## Papéis (D63, decidido: o sistema segue a landing)
Cinco papéis: **dono, gerente, caixa, estoquista e entregador**. O estoquista é novo em relação ao `index.html`: cuida de entrada, contagem e perdas, sem vender. `member_role` passa a ser `owner`, `manager`, `cashier`, `stock_keeper`, `courier`.

## Matriz padrão (D04, D05, D63), editável pelo dono
`S` = sim, `N` = não. O dono sempre tem tudo e não pode ser rebaixado.

| Permissão | Telas | Dono | Gerente | Caixa | Estoquista | Entregador |
| --- | --- | --- | --- | --- | --- | --- |
| `vender` | Caixa | S | S | S | N | N |
| `desconto` (dentro do limite do papel, abaixo) | Caixa | S | S | S | N | N |
| `cancelar` | Caixa | S | S | N | N | N |
| `caixa` (abrir e fechar) | Caixa | S | S | S | N | N |
| `sangria` (sangria, reforço, pagar entregador) | Caixa | S | S | S | N | N |
| `fiado` (vender no fiado) | Caixa | S | S | S | N | N |
| `fiado_receber` | Fiado | S | S | S | N | N |
| `fiado_ajustar` (mesclar, ajustar saldo; sem cadastro de clientes, D19) | Fiado | S | S | N | N | N |
| `estoque` (entrada, contagem, perdas, transferência) | Estoque | S | S | N | **S** | N |
| `precos` (preços, combos e promoções) | Estoque | S | S | N | N | N |
| `compras` (fornecedores e pedidos de compra) | Compras | S | S | N | N | N |
| `contas` (contas a pagar) | Gestão | S | S | N | N | N |
| `pedidos` | Pedidos | S | S | S | N | só atribuídos |
| `relatorios` (vendas, por hora, canal, forma, operador, fechamentos) | Relatórios | S | S | N | N | N |
| **`ver_lucro`** (custo, margem, lucro, Lucro no Copo) **[novo, D63]** | Relatórios, Estoque, Ferramentas | S | **N** | N | N | N |
| `ferramentas` (anotações; promoções exigem também `precos`) | Ferramentas | S | S | N | N | N |
| `exportar` (CSV) | Relatórios | S | S | N | N | N |
| `ajustes` (integrações, alertas, catálogo, Pix) | Configurar | S | N | N | N | N |
| `equipe` (logins, papéis, PIN, terminais) | Configurar | S | N | N | N | N |

Notas:
- "Relatórios parciais" do gerente (como a landing chama) = `relatorios` sem `ver_lucro`: o gerente vê quanto vendeu, mas não custo nem margem. Sem `ver_lucro`, as colunas de custo e margem nem chegam ao navegador: a RPC devolve `null`, não só esconde.
- O estoquista vê produtos e saldos (leitura de membro), mas não vê custo sem `ver_lucro`.

**Limite de desconto (D05, D63):** `app.role_settings (store_id, role, max_discount_pct)`, com o padrão da landing: **dono livre, gerente até 15%, caixa até 5%**. Acima do limite, a venda pede o **PIN de alguém da loja cujo limite cubra o desconto pedido** (gerente ou dono), com o token de uso único da E10. A tentativa fora da regra gera o alerta "desconto fora da regra" (E31), com ou sem autorização. O `finalize_sale` confere o percentual sobre o subtotal.

**Preço padrão da conta (D37):** editar o preço padrão de um produto exige `precos` e ser dono ou gerente em pelo menos uma loja da conta; editar o preço de uma loja exige `precos` naquela loja.

## Critérios de aceite
- Matriz de testes pgTAP: para cada uma das 19 permissões × os 5 papéis × {permitido, negado} → resultado esperado.
- Teste: gerente chama o relatório de margem → colunas de custo e margem vêm `null`; dono → preenchidas.
- Teste: caixa dá 5% → passa; 8% sem autorização → `SALE_DISCOUNT_FORBIDDEN`; 8% com PIN do gerente → passa e gera alerta; 20% com PIN do gerente → recusado (limite do gerente é 15%); 20% com PIN do dono → passa.
- Teste: conta suspensa, dono tenta `finalize_sale` → recusado com `ACCESS_SUSPENDED`; o mesmo dono lê relatórios → permitido.
- Teste: gerente altera a matriz → recusado (só o dono).
- Teste: `private.can` chamada pela API REST → erro de permissão.
- Teste de desempenho: `select` em `sales` com 100 mil linhas usa o índice e avalia `can` uma vez (`(select ...)` no plano).

## Riscos e atenção
- Toda permissão nova muda o design (a matriz é tela do front). Agrupar as mudanças num único pedido de design (E00).
- `private.can` vai ser chamada em quase toda query. Mantê-la `stable`, sem `plpgsql` desnecessário e com índices de suporte em `store_members (user_id, store_id) where active`.
