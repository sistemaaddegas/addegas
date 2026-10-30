# Dúvidas e decisões

As respostas de 28/10/2026 fecharam as dúvidas D01 a D63. Só a D64 continua em aberto. As decisões ficam registradas na parte 2, com a interpretação usada nas fichas quando a resposta pedia uma.

**Legenda:** 🔴 **bloqueante**: a entrega citada não começa sem resposta · 🟡 importante: precisa de resposta antes da entrega citada · ⚪ pode esperar.

Para responder, escreva embaixo do item: `**Decisão (dd/mm/aaaa):** ...`

---

## 1. Em aberto

### D64 🟡 Onde está o código da landing?
Você disse que está "aqui dentro desse projeto", mas não encontrei. Procurei em:
- todas as pastas de `C:\Users\welli\Documents\projetos\addegas` (nenhum `next.config` nem o texto da landing; o único `package.json` é o da fase 2);
- as branches `main` e `release` e o remoto `github.com/sistemaaddegas/addegas`;
- as outras pastas de `Documents\projetos`;
- a Vercel conectada aqui: o único time ("wellington martins' projects") só tem o `nexum-pro-v2`. A landing (`www.addegas.com.br`) e o protótipo (`addegasapp.vercel.app`) estão em **outra conta da Vercel**.

**Atualização (28/10/2026):** o link informado foi `github.com/sistemaaddegas/addegas`, que é o repositório deste projeto. Busquei de novo no GitHub (`git fetch`) e conferi **todo o histórico**: são 4 commits, todos do sistema (`index.html`, `admin.html`, fase 2), sem nenhum arquivo de Next.js nem da landing. A landing no ar foi publicada há cerca de 28 dias (pelo cabeçalho `Age` da Vercel) a partir de outro lugar: outro repositório, upload pela CLI da Vercel, ou v0/design.

Como achar, na conta da Vercel dona de `addegas.com.br`:
1. Abra o projeto que tem o domínio `www.addegas.com.br` → **Settings → Git**. Se houver repositório conectado, é ele.
2. Se aparecer "No Git Repository connected", a landing foi enviada pela CLI ou pelo v0. Em **Deployments**, abra o último deploy → aba **Source**, que mostra os arquivos enviados e permite baixar.
3. Com o código em mãos, dá para colocar numa pasta `landing/` deste repositório (com `landing` no `.vercelignore` do protótipo e um projeto Vercel com Root Directory `landing`) ou num repositório próprio.
- **Bloqueia:** só a E53 (ajuste de texto da landing). Enquanto isso, a E53 já traz o texto proposto para cada trecho.

---

## 2. Decisões tomadas (28/10/2026)

| # | Tema | Decisão | Onde foi aplicada |
| --- | --- | --- | --- |
| D01 | Gateway | **Stripe.** | E34 |
| D02 | Lojas por conta | Plano inclui 1 loja; **cada loja extra é um adicional pago** (valor em D54). | E08, E32, E34 |
| D03 | Planos no design | **Um plano único + adicional de loja.** Pedido de mudança no design do admin e da ficha da adega. | E00, E32 |
| D04 | Permissões | Lista proposta na E12 (as 10 do front + pedidos, clientes, receber fiado, compras, sangria, ferramentas, ajustes, exportar). | E12 |
| D05 | Desconto | Limite em % por função, configurável; acima do limite, faz a venda quem tem limite maior (a liberação por PIN saiu em 30/10/2026). | E10, E20 |
| D06 | Estoque negativo | Permitido, com aviso no caixa e relatório "vendido sem estoque"; a loja pode escolher bloquear. | E17, E20, E31 |
| D07 | Lotes | Só para validade e alertas; consumo estimado pelo lote mais antigo (FEFO). | E17 |
| D08 | Custo | Custo médio ponderado; último custo fica no movimento. | E17, E26, E30 |
| D09 | Quantidade | `numeric(12,3)` desde o início; Lucro no Copo como calculadora na v1; baixa por ml depois do piloto. | E03, E30 |
| D10 | Cancelamento | Só cancelamento total; até o fechamento do caixa, quem tem `cancelar`; depois, só dono ou gerente, com estorno saindo do caixa aberto. | E21 |
| D11 | Caixa | Uma sessão por terminal (gaveta), troca de operador dentro dela. **Fechar o caixa com comanda aberta é bloqueado.** | E19, E22 |
| D12 | Dia comercial | Horário de corte por conta (padrão 05:00) e `business_date` gravado. | E26 |
| D13 | ~~PIN~~ (revogada em 30/10/2026) | Sem PIN no sistema: no caixa a pessoa toca no próprio nome; sem travas por tentativa. | E10 |
| D14 | Sem internet | Só online na v1, com idempotência, mais uma tela de contingência simples. | E20 |
| D15 | Pix no caixa | Só registrar a forma, **com QR estático da chave Pix da loja na tela do caixa** (como funciona: logo abaixo da tabela). | E20, E31 |
| D16 | Fiado | **Sem juros e sem WhatsApp.** | E23, E45 |
| D17 | Juros de contas | Regra atual do front. | E28 |
| D18 | Cupom não-fiscal | Entra na v1: WebUSB/Web Serial (ESC/POS) e impressão do navegador como alternativa. | E24 |
| D19 | Clientes | **Sem cadastro nem burocracia.** Interpretação para o fiado em D55. | E23 |
| D20 | Login da equipe da loja | O **dono cria o login** da pessoa e manda por e-mail; quem não tem e-mail recebe usuário e senha do dono pessoalmente. Interpretação: abaixo da tabela. | E07 |
| D21 | Apps de delivery | **Em espera.** | E43, E44 |
| D22 | WhatsApp | Número do Addegas para alertas ao dono e avisos de cobrança; nada de mensagem da loja para o cliente final. | E45 |
| D23 | Landing | **Construir.** Detalhes em D58 e na E53. | E53 |
| D24 | Porte do front | Em paralelo, na ordem login → onboarding → caixa → início. | README |
| D25 | Retenção após o fim | **6 meses** após o fim do acesso, depois exclusão/anonimização (explicação da LGPD abaixo). | E51, minutas jurídicas |
| D26 | Logs de segurança | 180 dias; auditoria de ações sem prazo, anonimizada na exclusão. | E46 |
| D27 | Acesso do suporte | "Acesso temporário" libera conta suspensa; "diagnóstico" é leitura auditada pela `admin-api`; impersonação só com consentimento do dono. | E36 |
| D28 | Carência | 5 dias corridos a partir da primeira falha de cobrança. | E33 |
| D29 | Ciclos | **Mensal, semestral e anual.** | E32, E33, E34 |
| D30 | NFS-e | Manual no começo. | E34 |
| D31 | Domínio | (substituída pela linha "D31 (atualizada)" abaixo) | — |
| D32 | Custos | Tudo no plano gratuito (Supabase, Vercel); W-API pago. Ver D57. | E02 |
| D33 | Equipe e prazo | Só você, com IA; sem compromisso de prazo. Os tamanhos das fichas ficam só como medida de complexidade. | README |
| D34 | Homologação | Resolvida pelo D32: desenvolvimento local + 2 projetos gratuitos (explicação abaixo). | E02 |
| D35 | Repositório | Back-end no mesmo repositório do app da fase 2. | E01 |
| D37 | Várias lojas | Transferência de estoque entra; **preço padrão na conta, com preço específico por loja opcional** (se preenchido, vale ele; se não, o padrão). | E08, E16, E17 |
| D38 | Catálogo público | Vitrine só leitura que abre o WhatsApp da loja com o pedido em texto. | E31 |
| D39 | Planilha | Nome, EAN, preço, custo, estoque, categoria; atualiza por EAN com prévia. | E16 |
| D40 | Taxa da maquininha | Taxa por forma de pagamento em Ajustes e "lucro estimado" depois do piloto. | E26 |
| D41 | Comanda | Estoque baixa no lançamento; divisão de conta e serviço só se pedido. | E22 |
| D42 | Entrega | **Taxa de entrega entra na venda, com opção de frete grátis; o motoboy é pago à parte.** Ver D60. | E41 |
| D43 | Sessão | Sessão longa no projeto; regras curtas só na `admin-api`. | E06, E11 |
| D44 | 2FA do dono | Opcional. | E06 |
| D45 | Força bruta | Captcha e limites nativos para a adega na v1; proteção extra para a equipe Addegas. | E06, E11 |
| D46 | Sessão da equipe | Inatividade de 30 min implementada na `admin-api`. | E11 |
| D47 | Admin separado | Projeto Vercel separado para o painel interno. | E04, E11 |
| D48 | Tickets | Próprios e enxutos. | E38 |
| D49 | Avisos de cobrança | Também por WhatsApp, pelo número do Addegas. | E45 |
| D50 | Jurídico | Primeira versão completa feita agora, para validar com advogado: [juridico/](juridico/). | E51 |
| D51 | `docs` publicado | `docs` e `planejamento` no `.vercelignore`, no README, no `CLAUDE.md` e no `verificar-deploy.sh` (falha se estiverem públicos). | — |
| D52 | Combo x promoção | Uma tabela só, com período opcional. | E18, E29 |
| D53 | Anotações | Da loja, visíveis a todos os membros. | E30 |
| D54 | Preços | Semestral −10% (R$ 809,46), anual −20% (R$ 1.439,04), loja adicional R$ 49,90/mês com o desconto do ciclo; troca de ciclo vale na hora, com crédito proporcional; teste de 14 dias com 1 loja. | E32, E34, minutas |
| D55 | Fiado | **Nome e telefone** de quem compra fiado, sem outros dados; sem juros e sem WhatsApp (D16). Limite: ver D55b. | E23, minutas |
| D56 | Domínio e e-mail | **Domínio `addegas.com.br` já existe** (DNS no Registro.br, landing na Vercel). E-mail transacional pelo Resend no subdomínio `mail.addegas.com.br`; estrutura pronta, sem depender de mais nada. | E06, E07, E35, [dominio-e-email.md](dominio-e-email.md) |
| D58 | Landing | **A landing já existe** em `www.addegas.com.br` (Next.js, lista de espera). Não será construída outra: a E53 passa a alinhar a existente ao produto real. | E53 |
| D59 | Apps de delivery | Texto "em breve" no sistema e na landing; nada de prometer integração "no lançamento". | E00, E53 |
| D60 | Motoboy | Botão "Pagar entregador" no caixa, que registra uma sangria com a categoria `courier_payment`. | E19, E41 |
| D36 | Brindes e mapa | Adiados até ter clientes pagantes. | E50 |
| D31 | Domínios (atualizada) | Landing em `www.addegas.com.br`; sistema em `app.addegas.com.br`; admin em `admin.addegas.com.br`; e-mail em `mail.addegas.com.br`. O protótipo estático segue em `addegasapp.vercel.app` até o corte (E52). | E02, E04 |
| D57 | Plano da Vercel | Continua no plano gratuito; assunto encerrado. | E02, E52 |
| D61 | E-mail de recebimento | Configurado depois por você; a estrutura (endereços, registros 7 e 8, variáveis) está pronta em [dominio-e-email.md](dominio-e-email.md). | E35, minutas |
| D62 | App | **PWA**, sem loja de aplicativos, no padrão do NEXUM-PRO (manifest, service worker, convite de instalação, tutorial do iPhone, telas de abertura), mais a casca offline para o modo contingência e a atualização que não derruba o caixa. | E54, E53 |
| D63 | Papéis e permissões | O sistema adota a landing: 5 papéis (com **estoquista**), desconto dono livre / gerente 15% / caixa 5%, acima do limite vende quem tiver limite (sem PIN desde 30/10/2026), permissão nova `ver_lucro` (gerente vê vendas, não margem). | E12, E10, E00, E53 |
| D55b | Limite de fiado | Opcional por pessoa, desligado por padrão. | E23 |

### Como funciona o QR do Pix no caixa (D15)
1. Em Ajustes, o dono cadastra a chave Pix da loja, o nome do recebedor e a cidade (são os campos que o padrão do Banco Central exige).
2. No caixa, ao escolher "Pix", o próprio navegador monta o código **BR Code**: o mesmo texto do "Pix copia e cola", no padrão EMV do Banco Central, com o valor da venda e o número da venda como identificador. Depois desenha o QR na tela. Não passa por servidor nem por gateway, e não tem custo.
3. O cliente lê o QR com o app do banco, e o valor já aparece preenchido.
4. O operador confere o recebimento no app do banco ou na maquininha da loja e confirma a venda como "Pix".

Limite: **não existe confirmação automática.** O QR é estático, e confirmar sozinho exigiria um gateway (que você descartou para as vendas). O QR também pode sair impresso na notinha (E24), para mesas e comandas.

### Login da equipe da loja (D20), como ficou na E07
- O dono (ou quem tem "Gerenciar equipe") cadastra a pessoa com nome, função e **e-mail ou nome de usuário** (ex.: `joao.esquina`), e define uma senha provisória.
- Com e-mail, o sistema manda o login por e-mail (domínio já existe, D56). Sem e-mail, a tela mostra usuário e senha para o dono repassar.
- No primeiro acesso, a pessoa troca a senha. Quem não tem e-mail não consegue recuperar a senha sozinho: o dono redefine.
- Caixa que só opera no tablet do balcão nem precisa desse login: entra tocando no próprio nome no terminal (E10).

### Retenção e LGPD (D25)
A LGPD **não fixa um prazo** em dias. A regra é eliminar os dados quando a finalidade termina (arts. 15 e 16), com exceções para guardar o que a lei exige. Por isso o "mínimo da LGPD" é "assim que não houver mais motivo", e os 6 meses que você pensou funcionam bem como janela para a adega voltar ou pedir os dados. Ficou assim:
- **Dados operacionais da adega** (vendas, produtos, fiado, equipe): excluídos ou anonimizados **6 meses** depois do fim do acesso, ou antes, se o dono pedir.
- **Registros de acesso ao sistema** (IP, data e hora): **6 meses**, prazo mínimo obrigatório do Marco Civil da Internet (art. 15) para provedores de aplicação.
- **Faturas e pagamentos do Addegas**: **5 anos**, por obrigação fiscal.
- **Auditoria**: mantida, mas com os dados pessoais anonimizados na exclusão.

Isso está nas minutas jurídicas e precisa da validação do advogado.

### Homologação (D34)
"Homologação" é um ambiente de teste igual ao de produção, onde se confere uma mudança antes de ela chegar aos clientes. Com o plano gratuito (D32), o Supabase permite 2 projetos ativos e não tem Branching (que é pago). Ficou assim:
- **Na sua máquina:** `supabase start`, para desenvolver e rodar os testes.
- **`addegas-dev`** (gratuito): ambiente online para testar com o front publicado em preview na Vercel. Faz o papel da homologação.
- **`addegas-prd`** (gratuito até a primeira adega pagante, D57): produção.

---

## 3. Sobre as perguntas originais
As opções e os argumentos de cada pergunta D01 a D53 foram incorporados nas fichas de entrega onde a decisão se aplica (coluna "Onde foi aplicada"). Recomendo commitar a pasta `planejamento/` agora, para as próximas mudanças ficarem no histórico.
