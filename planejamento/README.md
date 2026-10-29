# Addegas · Plano de entregas do back-end

Origem: [`docs/Addegas · Arquitetura do back-end.md`](../docs/Addegas%20·%20Arquitetura%20do%20back-end.md) (26/10/2026).
Este plano quebra a arquitetura em entregas pequenas, cada uma testável sozinha, e registra o que foi acrescentado, o que foi questionado e o que ainda precisa de resposta. O andamento do desenvolvimento está na tabela abaixo.

**Situação em 28/10/2026:** dúvidas D01 a D63 respondidas e aplicadas nas fichas; domínio `addegas.com.br` e landing já existem; PWA na E54 e papéis da landing na E12; só a D64 em aberto (onde está o código da landing); integrações de delivery (E43, E44) em espera; minutas jurídicas e plano de domínio e e-mail criados.

| Arquivo | Para que serve |
| --- | --- |
| [analise-critica.md](analise-critica.md) | Revisão do documento: inconsistências, premissas frágeis, lacunas e riscos (escrita antes das decisões; as decisões estão no `duvidas.md`) |
| [entregas/](entregas/) | Uma ficha por entrega (objetivo, escopo, dados, regras, critérios de aceite, riscos), com as decisões aplicadas no topo |
| [duvidas.md](duvidas.md) | Dúvidas em aberto e registro das decisões tomadas |
| [juridico/](juridico/) | Minutas de Termos de Uso, Política de Privacidade e Acordo de Tratamento de Dados, para validar com advogado |
| [dominio-e-email.md](dominio-e-email.md) | Subdomínios, registros DNS no Registro.br, e-mail de envio (Resend) e de recebimento, checklist dos serviços |
| [runbook-producao.md](runbook-producao.md) | O que fazer quando algo cai, ações manuais na conta de uma adega, backup e restauração (E52) |

## Andamento
Situação em 28/10/2026, branch `entregas-backend`. "Back-end pronto" quer dizer banco, regras, RPCs, Edge Functions e testes rodando no Supabase local; as **telas** de cada entrega entram no porte do front (D24). O porte começou em 29/10 e todas as telas do menu do dono já usam o back-end: cadastro em 3 passos, login, Início, Caixa, Pedidos, Estoque, Combos, Clientes e fiado, Compras e contas, Relatórios, Lucro no Copo, Anotações, Equipe, WhatsApp e Ajustes (tabela abaixo). Ainda faltam: no caixa, vender fiado, autorizar desconto acima do limite, comandas e o modo sem internet; em Pedidos, lançar pedido à mão e receber no caixa; Assinatura (etapa 11) e Admin (etapa 12).

Verificação: 296 testes pgTAP, advisors sem aviso, 1000 vendas em paralelo sem conflito, fluxo ponta a ponta das funções 26/26, `check:erros` com 153 códigos traduzidos, typecheck e build do app.

| Entrega | Situação | O que falta |
| --- | --- | --- |
| E00 · Decisões bloqueantes | 🟡 Decisões tomadas | Pedido de ajuste ao design (plano único, permissões, apps "em breve") |
| E01 · Estrutura e ambiente local | ✅ Pronta | — |
| E02 · Ambientes e segredos | 🟡 Preparada | Criar `addegas-dev` e `addegas-prd` no Supabase, segredos no GitHub e nas funções; o CI (`banco.yml`) e o backup (`backup.yml`) já estão escritos |
| E03 a E05 · Banco, borda Vercel, rastreio | ✅ Back-end pronto | Variáveis da Vercel ao criar o projeto do app |
| E06 a E15 · Identidade, permissões, auditoria, admin-api, arquivos | ✅ Back-end pronto | Telas; captcha do cadastro ligado na nuvem |
| E16 a E26 · Núcleo da adega | ✅ Back-end pronto | Telas (caixa, venda, comandas, fiado, relatórios) |
| E27 a E31 · Gestão complementar | ✅ Back-end pronto | Telas |
| E32, E33, E35 · Plano, ciclo da assinatura, e-mails | ✅ Back-end pronto | Domínio de envio no Resend (`dominio-e-email.md`) |
| E34 · Stripe | 🟡 Código pronto | Conta Stripe, chaves e `scripts/stripe-sync.mjs` para criar os preços |
| E36 a E40 · Painel Addegas | ✅ Back-end pronto | Telas do admin; cadastrar a equipe (`admin/staff/invite`) |
| E41, E42, E45 · Pedidos, webhooks, WhatsApp | ✅ Back-end pronto | Instância da W-API e o webhook apontando para `/api/hooks/wapi` |
| E43, E44 · iFood e outros apps | ⏸️ Em espera (D21) | — |
| E46 a E49 · Monitoramento, uso, leads, campanhas | ✅ Back-end pronto | Agendar as rotinas na nuvem (`supabase/cron/agendar-funcoes.sql`) |
| E50 · Brindes e mapa | ⏸️ Adiada | — |
| E51 · LGPD e continuidade | 🟡 Back-end pronto | Minutas validadas por advogado e dados da empresa; primeiro teste de restauração |
| E52 · Prontidão para produção | 🟡 Runbook escrito ([runbook-producao.md](runbook-producao.md)) | Matriz de acesso automatizada, teste de carga na nuvem, piloto, revisão do runbook por outra pessoa |
| E53 · Landing | ⏳ Aguardando D64 | Acesso ao código da landing existente |
| E54 · PWA | ✅ Pronta | Ícones finais vindos do design, se mudarem |

## Premissas de trabalho (decididas em 28/10/2026)
- **Uma pessoa, com IA, sem compromisso de prazo** (D33). Os tamanhos das fichas medem complexidade, não agenda.
- **Tudo no plano gratuito** (Supabase, Vercel), W-API paga (D32).
- **Domínio `addegas.com.br`** (D31, D56): landing em `www.` (já existe), sistema em `app.`, painel interno em `admin.`, e-mail em `mail.`. O protótipo segue em `addegasapp.vercel.app` até o corte.
- **PWA**, sem loja de aplicativos, no padrão já usado no NEXUM-PRO (D62, E54).
- **Stripe** para a assinatura, **plano único** + loja adicional, ciclos mensal, semestral e anual (D01, D02, D29).

## Como ler uma ficha
Toda ficha tem o mesmo formato: **Objetivo · Entra · Não entra · Dados e funções · Regras · Critérios de aceite · Riscos e atenção · Dúvidas**.
- **Tamanho:** P (pequena), M (média), G (grande): medida de complexidade, não de prazo (D33). Nenhuma entrega deve passar de G; se passar, quebre. Com IA, a regra útil é outra: cada entrega deve caber numa sessão de trabalho com começo, testes e fim.
- **Dúvidas:** os códigos `D01`, `D02`… apontam para [duvidas.md](duvidas.md). Entrega com dúvida marcada como **bloqueante** não começa antes da resposta.
- **Origem:** cada ficha diz de que seção do documento veio. O que não estava no documento aparece como **[novo]**.

## Marcos e entregas

| Marco | Entregas | Resultado visível no fim do marco |
| --- | --- | --- |
| **M0 · Decisões** | [E00](entregas/E00-decisoes-bloqueantes.md) | Dúvidas bloqueantes respondidas e design ajustado (plano único, permissões) |
| **M1 · Fundação** | [E01](entregas/E01-estrutura-repositorio.md) · [E02](entregas/E02-ambientes-e-segredos.md) · [E03](entregas/E03-esqueleto-do-banco.md) · [E04](entregas/E04-borda-vercel.md) · [E05](entregas/E05-rastreio-minimo.md) | Migration vazia sobe no `addegas-dev` pelo CI; `/api/health` responde com ID de correlação |
| **Paralelo · App instalável** | [E54](entregas/E54-pwa.md) | PWA instalável no celular, tablet e computador; atualização sem derrubar o caixa; abre no modo contingência sem internet |
| **Paralelo · Site** | [E53](entregas/E53-landing-page.md) | Landing existente alinhada ao produto (apps "em breve", preço) e, depois, ligada ao cadastro com UTM |
| **M2 · Identidade** | [E06](entregas/E06-cadastro-do-dono.md) · [E07](entregas/E07-membros-e-convites.md) · [E08](entregas/E08-varias-lojas.md) · [E09](entregas/E09-terminal-do-caixa.md) · [E10](entregas/E10-operador-e-pin.md) · [E11](entregas/E11-equipe-addegas-2fa.md) | Dono cria conta e loja, cria o login do gerente, registra tablet; operador entra por PIN; equipe entra com 2FA |
| **M3 · Permissões** | [E12](entregas/E12-motor-de-permissoes.md) · [E13](entregas/E13-auditoria.md) · [E14](entregas/E14-admin-api.md) · [E15](entregas/E15-armazenamento.md) | Testes provam isolamento entre lojas, matriz de permissões e auditoria de negações |
| **M4 · Núcleo da adega** | [E16](entregas/E16-produtos-e-catalogo.md) · [E17](entregas/E17-estoque.md) · [E18](entregas/E18-combos-e-acesso-rapido.md) · [E19](entregas/E19-caixa.md) · [E20](entregas/E20-venda-atomica.md) · [E21](entregas/E21-cancelamento-de-venda.md) · [E22](entregas/E22-mesas-e-comandas.md) · [E23](entregas/E23-clientes-e-fiado.md) · [E24](entregas/E24-cupom-nao-fiscal.md) · [E25](entregas/E25-inicio-tempo-real.md) · [E26](entregas/E26-relatorios.md) | Uma adega real consegue operar um turno inteiro: abrir caixa, vender, fiado, fechar, ver relatório |
| **M5 · Gestão complementar** | [E27](entregas/E27-fornecedores-e-compras.md) · [E28](entregas/E28-contas-a-pagar.md) · [E29](entregas/E29-promocoes.md) · [E30](entregas/E30-lucro-no-copo-e-anotacoes.md) · [E31](entregas/E31-ajustes-e-alertas.md) | Todas as telas de Gestão e Ferramentas com dados reais |
| **M6 · Assinatura** | [E32](entregas/E32-planos-e-limites.md) · [E33](entregas/E33-ciclo-da-assinatura.md) · [E34](entregas/E34-gateway-de-cobranca.md) · [E35](entregas/E35-emails-transacionais.md) | Adega sai do teste, paga, entra em carência e é suspensa sozinha |
| **M7 · Painel Addegas** | [E36](entregas/E36-admin-adegas.md) · [E37](entregas/E37-admin-financeiro.md) · [E38](entregas/E38-tickets.md) · [E39](entregas/E39-repositorio-de-produtos.md) · [E40](entregas/E40-visao-geral-metricas.md) | Equipe opera clientes, cobrança e suporte sem mexer no banco |
| **M8 · Integrações** | [E41](entregas/E41-pedidos-e-entrega.md) · [E42](entregas/E42-caixa-de-webhooks.md) · [E45](entregas/E45-whatsapp-da-loja.md) · ⏸️ [E43](entregas/E43-ifood.md) · ⏸️ [E44](entregas/E44-outros-apps-delivery.md) | Pedidos da loja (incluindo os dos apps, lançados à mão) com taxa de entrega; dono recebe alertas e avisos de cobrança no WhatsApp. iFood e demais apps em espera (D21) |
| **M9 · Crescimento e observabilidade** | [E46](entregas/E46-monitoramento.md) · [E47](entregas/E47-uso-e-funis.md) · [E48](entregas/E48-crm-e-leads.md) · [E49](entregas/E49-campanhas-e-consentimento.md) · [E50](entregas/E50-brindes-e-mapa.md) | Painel completo do admin |
| **Transversal** | [E51](entregas/E51-lgpd-e-continuidade.md) · [E52](entregas/E52-prontidao-producao.md) | Termos, exclusão de conta, backup testado, runbook, teste de carga |

### Dependências principais
```
E00 ─► E01 ─► E02 ─► E03 ─┬─► E04 ─► E05
                          │
                          ├─► E06 ─► E07 ─► E08
                          │     └──► E09 ─► E10
                          ├─► E11 ─► E14
                          │
              E06 ───────►├─► E12 ─► E13 ─► (todas as entregas que gravam dados)
                          └─► E15
E12 ─► E16 ─► E17 ─► E18 ─► E20 ─► E21
             E10 ─► E19 ─┘     ├─► E22, E23, E24, E25, E26
E12 ─► E32 ─► E33 ─► E34 ─► E35      (E42 ─► E34)
E14 ─► E36 ─► E37 ─► E40;  E14+E15 ─► E38;  E16 ─► E39
E20 ─► E41 ─► E42 ─► (E43 ─► E44, em espera);  E31 + E33 ─► E45
E16 ─► E08 (produto da conta, preço por loja);  E34 ─► E08 (loja adicional paga)
```

## Ordem recomendada (difere do documento em 5 pontos)
1. **E05 (rastreio) vai para a Fundação**, não para o fim. Sem ID de correlação desde o primeiro dia, os primeiros bugs de produção ficam sem rastro. O documento coloca observabilidade na etapa 8.
2. **E32 e E33 (estado da assinatura sem gateway) antes do Núcleo terminar.** O `private.can()` (E12) depende do estado de acesso (liberado, carência, suspenso). Basta a máquina de estados com teste de 14 dias; o Stripe (E34) pode vir depois.
3. **E41 (pedido manual e WhatsApp) antes das integrações.** O modelo de pedidos precisa existir e ser usado pela loja antes de receber eventos de terceiros.
4. **E42 (caixa de webhooks) antes da E34 (gateway).** O documento põe webhooks na etapa 7, mas os eventos de cobrança do gateway (etapa 5) já precisam da caixa de entrada com idempotência.
5. **Um piloto antes do painel Addegas completo.** Depois do M4 + M6, colocar 1 a 3 adegas reais operando, com o admin mínimo (E36 e E37). CRM, marketing, brindes e mapa (M9) não impedem ninguém de vender e podem esperar o piloto.

## Porte do front, em paralelo (D24)
O `index.html` publicado continua sendo a referência visual. Cada tela do app novo é portada quando a entrega de back-end que ela usa estiver pronta, nesta ordem:

| Ordem | Tela | Usa as entregas |
| --- | --- | --- |
| 1 ✅ | Login (e-mail ou usuário), troca de senha no primeiro acesso | E06, E07 |
| 2 ✅ | Cadastro em 3 passos (onboarding) | E06, E16 |
| 3 ✅ | Caixa: PIN, abertura, venda, Pix com QR, fechamento | E09, E10, E19, E20 |
| 4 ✅ | Início em tempo real | E25, E26 |
| 5 ✅ | Estoque, produtos e preços por loja | E16, E17 |
| 6 ◐ | Mesas e comandas, fiado (tela de fiado pronta; falta vender fiado no caixa e as comandas) | E22, E23 |
| 7 ✅ | Equipe e permissões | E07, E12 |
| 8 ◐ | Pedidos com taxa de entrega (fluxo de status pronto; falta lançar pedido à mão e receber no caixa) | E41 |
| 9 ✅ | Relatórios | E26 |
| 10 ✅ | Compras, contas, promoções, Lucro no Copo, anotações, ajustes | E27 a E31 |
| 11 | Assinatura (planos, pagamento, regularização) | E32 a E34 |
| 12 | Admin (projeto separado) | E11, E14, E36 a E40 |

As telas que dependem do pedido de mudança de design (E00) só são portadas depois que o design voltar.

## Definição de pronto (vale para toda entrega)
- Migration versionada, reversível ou com nota explicando por que não é; testada localmente e aplicada no `addegas-dev` pelo CI.
- `supabase db advisors` sem alerta de segurança; `supabase db lint` limpo.
- Testes de banco (pgTAP) cobrindo: o caminho feliz, a recusa por permissão, a recusa por outra loja (isolamento) e a recusa por acesso suspenso, quando se aplicar.
- RLS ligada e `grant` explícito em toda tabela nova do `app`; nada para `anon`.
- Toda RPC que altera dado grava auditoria e aceita `x-correlation-id`.
- Valores em centavos, datas em `timestamptz`, nomes em inglês no banco, mensagens de erro com código estável (ex.: `SALE_CASH_CLOSED`) para o front traduzir.
- Tipos TypeScript regenerados (`supabase gen types`) e commitados.
- Ficha da entrega atualizada se alguma decisão mudou durante a construção.

## O que este plano não cobre
- **O detalhe do porte das telas para React.** A ordem está acima; o como (componentes, rotas, estado) é trabalho de front.
- **NFC-e da adega**: fora da v1. **NFS-e do Addegas**: emitida manualmente no começo (D30).
