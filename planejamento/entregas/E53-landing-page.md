# E53 · Landing existente: alinhar ao produto e ligar ao cadastro

**Marco:** paralelo (texto já; ligação com o cadastro junto com a E06) | **Tamanho:** P (texto) + P (cadastro e UTM) | **Depende de:** D64 (código da landing) | **Desbloqueia:** E06 (origem do cadastro), E48 (leads)
**Origem:** **[novo]**. Decidido em D58: a landing **já existe** em `www.addegas.com.br` (Next.js na Vercel, fase de lista de espera). Não será feita outra.

## Objetivo
A landing promete só o que o produto vai entregar, leva o interessado ao cadastro com teste grátis quando o app estiver no ar e entrega a origem (UTM) para o CRM.

## O que a landing tem hoje (lido em 28/10/2026)
Seções: topo "Gestão pra adega", Recursos (caixa, estoque, combos, fechamento), Integrações, Catálogo no WhatsApp, Alertas no WhatsApp, Regras e permissões, Marca × Sistema, Público, A marca na rua, App, Lançamento (lista de espera pelo WhatsApp), Perguntas frequentes. Contatos: WhatsApp (11) 98675-5103, `sistema.addegas@gmail.com`, Instagram, YouTube e X. Não mostra preço.

## Divergências com o que foi decidido
| # | A landing diz | O plano decidiu | Ajuste no texto |
| --- | --- | --- | --- |
| 1 | Integrações com iFood, Zé Delivery, 99Food e Keeta "em desenvolvimento · **chega no lançamento**"; "o pedido do app cai direto no caixa"; "muda o preço uma vez, atualiza em todos" | Integrações **em espera** (D21); pedidos dos apps lançados à mão (E41) | "Em breve" sem data; tirar "chega no lançamento" e a sincronização de cardápio; nas perguntas frequentes, deixar claro que hoje o pedido do app é lançado no sistema (D59) |
| 2 | Catálogo no WhatsApp: "o pedido **entra direto na Addegas**", "pedido #0427 na Addegas, estoque atualizado" | Vitrine que abre o WhatsApp da loja com o pedido em texto; a loja lança o pedido (D38) | "O cliente monta o pedido no catálogo e manda no seu WhatsApp, já organizado; você lança em segundos." Para o pedido cair sozinho, é preciso API oficial do WhatsApp por loja: fica como "em breve" |
| 3 | "App Addegas · iOS e Android · **em breve nas lojas**" | PWA instalável (D62, decidido; E54) | "Funciona no celular, no tablet e no computador. Instale direto do navegador, sem loja de aplicativos." A seção mantém o celular e os cards ao vivo; troca só os selos da App Store e do Google Play por "Instalar o app" |
| 4 | Papel **Estoque**, caixa com desconto **até 5%**, "pede a **senha do dono**", gerente com relatórios **parciais** | D63, decidido: **o sistema adota a landing** (5 papéis, caixa 5%, gerente 15%, `ver_lucro`) | Só trocar "senha do dono" por "senha de quem pode liberar (dono ou gerente)" |
| 5 | Alertas: produto parado, caixa aberto, desconto fora da regra | Não estavam na E31 | **Incorporados à E31** (o sistema passa a cumprir a landing) |
| 6 | Pix "no caixa" | Pix só registrado, com QR estático (D15) | Ok; pode acrescentar "QR do Pix na tela, sem taxa" |
| 7 | Contato `sistema.addegas@gmail.com` | Domínio próprio (D56) | `contato@addegas.com.br`, depois de configurar o recebimento (D61) |
| 8 | Sem preço, sem Termos, sem Política | Plano único com ciclos (D54); minutas prontas (E51) | Seção de preço; links no rodapé para `/termos` e `/privacidade` **depois da validação do advogado** |
| 9 | Lista de espera manda os dados pelo WhatsApp | CRM com origem e UTM (E48) | Manter o WhatsApp e, quando a E48 existir, gravar o lead também em `POST https://app.addegas.com.br/api/leads` |

## Entra
**Agora (só texto, não depende do back-end):** os ajustes 1, 2, 3 e 7 (este depois da D61) e a seção de preço com os valores da D54:
- mensal R$ 149,90;
- semestral R$ 809,46 (R$ 134,91/mês);
- anual R$ 1.439,04 (R$ 119,92/mês);
- loja adicional R$ 49,90/mês;
- 14 dias grátis sem cartão.

**Quando o app estiver no ar (junto com a E06):**
- Botões "Testar grátis" levando a `https://app.addegas.com.br/cadastro` com as UTMs repassadas. A landing guarda `utm_*` e `referrer` do primeiro acesso por 30 dias (mesma janela de atribuição do admin) e anexa no link.
- A lista de espera vira "Testar grátis"; quem já está na lista recebe o convite pelo WhatsApp no lançamento.
- Páginas `/termos` e `/privacidade` com as minutas validadas.

## Critérios de aceite
- Nenhuma frase da landing promete algo que não esteja em uma ficha com decisão "entra" ou marcado como "em breve".
- Link com `?utm_source=instagram&utm_campaign=lancamento` → o cadastro do app recebe as duas UTMs.
- Lighthouse no celular sem piora em relação a hoje.

## Riscos e atenção
- Promessa de integração "no lançamento" é o tipo de frase que vira reclamação e pedido de reembolso no primeiro mês.
