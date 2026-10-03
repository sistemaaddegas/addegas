# Addegas — Front-end

Sistema de gestão para adegas de bairro. Reúne caixa (PDV) com mesas e comandas, pedidos dos apps, estoque, clientes e fiado, compras, contas a pagar, relatórios, promoções, Lucro no Copo, anotações, equipe, WhatsApp e ajustes. Funciona no computador, no tablet do balcão e no celular do dono.

Este repositório é o front-end **exatamente como foi aprovado no design**, pronto para GitHub e Vercel. É um site estático: sem build, sem dependências para instalar e sem variáveis de ambiente.

> **Usando o Claude Code?** Ele lê o `CLAUDE.md` automaticamente. Lá estão as regras, o passo a passo de publicação, a verificação e a solução de problemas.

## Publicar em 3 passos
1. **GitHub:** `git init -b main && git add . && git commit -m "Addegas" && gh repo create addegas-frontend --private --source=. --push`
2. **Vercel:** Add New → Project → importe o repositório → Framework **Other**, Root Directory **./**, sem build → Deploy.
3. **Conferir:** `bash scripts/verificar-deploy.sh https://SEU-PROJETO.vercel.app` (precisa terminar em "Tudo certo.").

Rodar local: `npx serve .` e abra o endereço exibido. Abrir o arquivo direto (`file://`) não funciona.

## Estrutura
```
index.html               o sistema (template + lógica + dados de exemplo)
support.js               runtime do index.html no navegador (não editar)
assets/                  logo, dd, textura do login
icons/                   favicon, apple-touch-icon e ícones 192/512 do app
data/lucro-no-copo.js    categorias, produtos, insumos e drinks do Lucro no Copo
manifest.webmanifest     permite "Adicionar à tela inicial" no celular
vercel.json              cache de assets/icons; sem build
.vercelignore            tira docs, scripts e fase 2 do site publicado
scripts/
  verificar-deploy.sh    confere se tudo responde 200 depois do deploy
  atualizar-design.mjs   aplica uma nova versão do design no index.html
proximos-passos/
  app-react-supabase/    fase 2: Vite + React + TypeScript + Supabase (fora do deploy)
```

## Como funciona
- O `index.html` é o `Addegas.dc.html` do projeto de design, **idêntico**. A única diferença é um bloco no `<head>`, entre `<!-- addegas:head:start -->` e `<!-- addegas:head:end -->`, com título, descrição, ícones e manifest, além do `lang="pt-BR"` na tag `<html>`.
- O `support.js` carrega React 18.3.1 e ReactDOM do unpkg.com, com verificação de integridade (SRI), e monta a interface. As fontes vêm do Google Fonts.
- Dependências externas em produção: `unpkg.com`, `fonts.googleapis.com` e `fonts.gstatic.com`.
- Não há backend. Vendas, mesas, contas, anotações e o resto funcionam em memória e voltam aos dados de exemplo quando a página recarrega.
- Para atualizar com uma versão nova do design, rode `node scripts/atualizar-design.mjs "/caminho/Addegas.dc.html"` e faça push.

## Valores fixos no código
São os mesmos valores do design:
- **Tela inicial:** `inicio`, já logado. Para abrir no login, troque no `index.html` o trecho `auth:(this.props&&this.props.startScreen)==='login'?'login':'app'` por `auth:'login'`.
- **Usuário logado:** `Marcos Silva`. O Início mostra só o primeiro nome, então nomes longos não quebram o layout.
- **Fonte:** Archivo. Alternativas já prontas no código: Bricolage Grotesque e Syne (`props.fonte`).
- **Cores dos cards:** `colorida` (alternativa: `amarelo`, em `props.coresCards`).
- **Layout:** `auto`, definido pela largura da tela.
- **Lojas de exemplo:** Adega Esquina (Vila Madalena) e Adega Esquina 2 (Pinheiros).

## Telas
Menu (computador):
- **Operação:** Início, Caixa, Pedidos
- **Gestão:** Estoque, Clientes e fiado, Compras, Contas a pagar
- **Análise:** Relatórios
- **Ferramentas:** Promoções, Lucro no Copo, Anotações
- **Configurar:** Equipe, WhatsApp, Ajustes

Fora do menu: login, escolha da loja e cadastro da adega em 3 passos (nome e bairro, produtos, apps conectados), seletor de lojas e central de alertas (sino com bolinha vermelha e número branco).

- **Início:** saudação com o nome do usuário. Cards Vendas de hoje, Vendas no caixa, Pedidos em andamento e Fiado a receber (pretos, com texto branco). Ações rápidas: Nova venda (amarelo), Fechar caixa (vermelho vivo `#E5241B`) ou Abrir caixa, Entrada de mercadoria (verde vivo `#16C60C`) e Promoções (azul `#1E90FF`). Acesso rápido em formato de prateleira, com até 10 produtos editáveis que lançam direto no caixa. Mais vendidos hoje, com miniatura do produto.
- **Caixa:**
  - Busca e filtros de categoria: arraste para reordenar, ou pinte com cores vivas (o texto troca entre preto e branco para manter o contraste). O ícone de pintar é amarelo.
  - Grade de produtos: clique esquerdo aumenta a quantidade, botão direito diminui.
  - Venda em andamento: Balcão, mesas e comandas (adicionar em destaque, renomear, excluir no X, abas que quebram linha), cliente, desconto e Limpar em vermelho.
  - Cobrança: Pix, crédito, débito, dinheiro (com troco) e fiado.
  - Abertura e fechamento de caixa.
- **Pedidos:** pedidos de iFood, Zé Delivery, 99Food, Keeta e WhatsApp.
- **Estoque:** produtos, entrada de mercadoria e sugestões de compra enviadas aos fornecedores no WhatsApp.
- **Clientes e fiado:** clientes, saldo e data de pagamento do fiado, novo cliente e detalhe do cliente.
- **Compras:** fornecedores e cadastro de novo fornecedor.
- **Contas a pagar:** nova conta com descrição, valor e fornecedor; tipo e juros são opcionais.
- **Relatórios:** períodos, indicadores, formas de pagamento, canais, mais vendidos e fechamentos de caixa.
- **Promoções:** criar promoção com produtos do estoque e excluir promoção.
- **Lucro no Copo:**
  - Monta o drink por categoria (cerveja, destilado, gelo de coco, energético, refrigerante), escolhendo produtos do estoque em cards com foto.
  - Copo ilustrado com as garrafas no estilo dispenser e o gelo de coco submerso.
  - Custo × preço de venda.
  - Drinks prontos salvos com título e cor de fundo vibrante. O botão "Salvar como drink" fica em destaque.
  - Os dados ficam em `data/lucro-no-copo.js`; para usar a foto real, preencha `imagem` com a URL.
- **Anotações:** folhas de caderno destacadas (com rebarba na lateral), prioridade e concluir.
- **Equipe:** pessoas, permissões e convite por WhatsApp.
- **WhatsApp:** alertas automáticos e link do catálogo.
- **Ajustes:** lojas, integrações e opção de ocultar a calculadora.
- **Menu lateral:** visual de prateleira de adega, calculadora abaixo de Ajustes (pode ser ocultada), logo que leva ao Início e botão Sair vermelho com texto branco.

## Responsivo
- **1180px ou mais (computador):** menu lateral completo.
- **720px a 1179px (tablet):** trilho com Início, Caixa, Pedidos, Estoque, Clientes, Relatórios e Mais. No caixa, a venda fica fixa à direita.
- **Abaixo de 720px (celular):**
  - abas Início · Pedidos · Vender · Relatórios · Mais;
  - as janelas abrem como folhas, de baixo para cima;
  - no caixa, aparece a barra "Ver venda".

## Atalhos do caixa (teclado)
`/` busca · `F2` cobrar · `Enter` confirma o pagamento · `Esc` fecha a janela

## Tokens visuais
**Cores**
- Amarelo Addegas `#FBC009` (hover de link `#FFD54A`)
- Fundo da página `#050506`, com textura de blocos pretos (SVG inline, constante `WALL`)
- Fundo e tinta `#0A0A0B`, menu `#060607`
- Superfícies `#141416` e `#1C1C1F`
- Bordas `#1F1F22`, `#232327`, `#2A2A2E` e `#3A3A40`
- Texto `#F5F5F2`, secundário `#A1A1A6`, terciário `#8A8A90`
- Estados: sucesso `#4ADE80`, erro `#FF6B5E`, info `#7CB3FF`
- Ações vivas: vermelho `#E5241B`, verde `#16C60C`, azul `#1E90FF`, dourado `#D4AF37` (tema amarelo dos cards)

**Tipografia:** Archivo (Google Fonts, `wdth` 62–125 e `wght` 100–900). O texto usa principalmente 13–17px, e os títulos vão de 20 a 52px.

**Cantos:** quadrados irregulares, um raio diferente em cada canto. Os mais usados:
- `3px 10px 2px 9px`
- `2px 8px 3px 7px`
- `4px 13px 5px 11px`
- `3px 11px 4px 10px`
- `2px 7px 3px 6px`

Pílulas usam `99px`.

## Fase 2: sistema real
A pasta `proximos-passos/app-react-supabase/` traz a base do sistema com banco de dados:
- Vite, React 19, TypeScript e Tailwind 4;
- Supabase (login, Postgres com RLS por loja, realtime);
- migrations em `supabase/migrations` e seed.

Ela **não** faz parte do deploy, **ainda não tem as telas portadas** e não foi compilada até agora. O primeiro passo é `npm install && npm run build`.

Plano sugerido:
1. Portar tela por tela, comparando lado a lado com o `index.html` publicado. A meta é ficar igual, pixel a pixel.
2. Ligar os dados ao Supabase, começando pelo Caixa.
3. Quando estiver idêntico, apontar a Vercel para a pasta: Root Directory na pasta, Framework Vite e variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Mover o `.github/` da pasta para a raiz do repositório, para ligar o CI.
