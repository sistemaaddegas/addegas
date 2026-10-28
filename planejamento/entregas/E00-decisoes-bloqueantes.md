# E00 · Fechar decisões bloqueantes e alinhar o design

**Marco:** M0 · Decisões | **Tamanho:** P (de decisão, não de código) | **Depende de:** nada | **Desbloqueia:** todas
**Origem:** §1 e §10 do documento, mais as lacunas da [análise crítica](../analise-critica.md) **[novo]**

## Situação em 28/10/2026
- ✅ D01 a D53 respondidas e registradas em [duvidas.md](../duvidas.md), parte 2.
- ✅ `docs` e `planejamento` fora do site publicado (`.vercelignore`, README, `CLAUDE.md`, `verificar-deploy.sh`).
- ✅ Primeira versão das minutas jurídicas em [../juridico/](../juridico/), para validar com advogado.
- ✅ D54, D55, D56, D58, D59, D60 e D36 respondidas na segunda rodada; domínio `addegas.com.br` e landing já existem.
- ✅ Terceira rodada: D57 (fica no gratuito), D61 (preparado, configurar depois), D62 (PWA, E54), D63 (sistema adota os papéis da landing), D55b.
- ⏳ Em aberto: só a D64 (onde está o código da landing).

## Falta fazer
1. Responder D64.
2. Abrir **um único pedido de mudança no projeto de design**, juntando:
   - `Addegas Admin.dc.html`: tela de Planos e ficha da adega com **plano único de R$ 149,90/mês**, ciclos mensal, semestral e anual, **loja adicional** e teste de 14 dias (D03, D29, D54);
   - `Addegas.dc.html`:
     - matriz de permissões com as 18 permissões da E12 (D04);
     - limite de desconto por função (D05);
     - tela de Pix com QR no caixa e campos da chave Pix em Ajustes (D15);
     - fiado só com nome e telefone, sem tela de cadastro (D19, D55);
     - papel Estoquista, permissão `ver_lucro` e limites de desconto (caixa 5%, gerente 15%), D63;
     - convite de instalação do app e tutorial do iPhone (E54);
     - cadastro de funcionário pelo dono, com usuário e senha provisória (D20);
     - preço padrão e por loja no produto (D37);
     - taxa de entrega e frete grátis no pedido (D42);
     - aviso "não é possível fechar o caixa com comanda aberta" (D11);
     - texto dos apps de delivery como "em breve" (D59).
3. Alinhar o texto da landing existente (E53): apps "em breve", catálogo do WhatsApp sem pedido automático, app instalável em vez de "nas lojas" (D59, D62).
4. Depois que o design voltar, atualizar o `index.html` e o `admin.html` com `scripts/atualizar-design.mjs`.

## Não entra
- Nenhuma migration, função ou tela.

## Critérios de aceite
- Toda dúvida 🔴 tem decisão registrada.
- O pedido de design foi entregue; o M6 (assinatura) e a portabilidade das telas afetadas esperam por ele.

## Riscos e atenção
- O pedido de design é grande. Se demorar, o back-end pode avançar (M1 a M3 não dependem dele), mas o porte das telas do caixa e da equipe espera.
