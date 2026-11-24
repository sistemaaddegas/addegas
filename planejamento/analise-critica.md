# Análise crítica do documento de arquitetura

Documento analisado: `docs/Addegas · Arquitetura do back-end.md` (26/10/2026).
Comparado com: `index.html`, `admin.html`, a migration `proximos-passos/app-react-supabase/supabase/migrations/20261001000000_init.sql`, o `README.md` da fase 2, o `vercel.json`, o `.vercelignore` e decisões registradas antes (memória do projeto).

## Resumo
A base é sólida: RLS por loja, schemas internos fora da API, livro-razão imutável, dinheiro em centavos, venda como RPC atômica, webhooks com caixa de entrada e idempotência. A revisão contra as boas práticas do Supabase (seção 9) já corrige os erros mais comuns. O que falta não é arquitetura: falta **fechar regras de negócio** e **reconhecer limites do Supabase** que o documento trata como resolvidos. Também há **escopo demais para uma v1**: cerca de 90 tabelas, 17 telas de admin e 4 integrações de delivery antes de a primeira adega pagar.

---

## 1. Inconsistências dentro do próprio documento

| # | Onde | O que está inconsistente | Proposta |
| --- | --- | --- | --- |
| 1.1 | §4, matriz de permissões | O texto fala nas "10 permissões que o front já tem", mas a tabela tem **11 linhas**. A 11ª ("Ver e atualizar pedidos atribuídos") não existe no `index.html`, que lista exatamente: vender, desconto, cancelar, caixa, fiado, estoque, preços, contas, relatórios, equipe. | Decidir se a 11ª entra e, se entrar, pedir a mudança no design (`D04`). |
| 1.2 | §10, "Pix no caixa" | O item está **desmarcado** (`[ ]`), mas o texto diz "Decidido". | Confirmar e marcar (`D15`). |
| 1.3 | §1 e §10, planos | A decisão é plano único, e o documento pede "ajustar a tela de planos e a ficha da adega no front". Só que o `CLAUDE.md` proíbe editar `index.html`/`admin.html` à mão: a mudança tem de nascer no projeto de design. Hoje o admin tem 3 planos com limites (Bairro: 1 loja; Esquina: 2 lojas, 8 usuários, 2.000 produtos). | Abrir pedido no design antes do M6 (`D03`). |
| 1.4 | §4, limites | "No plano único, usuários e produtos ficam ilimitados; o número de lojas ainda precisa ser definido." Isso não aparece na lista de decisões em aberto da §10. | Incluído como `D02`, bloqueante para E32. |
| 1.5 | §2 x §7 | A §2 diz que o proxy `/api` concentra firewall e limite de requisições, e a §7 fala em "firewall da Vercel limitando `/api/auth` e o login". Mas o `supabase-js` fala **direto** com `https://<projeto>.supabase.co/auth/v1`, não com `/api/auth`. O firewall da Vercel não vê o login. | Ou o Auth também passa pelo proxy (configurar o `supabase-js` com a URL própria), ou a proteção do login fica no Supabase (captcha, limites do Auth e hook). Ver E04 e `D45`. |
| 1.6 | §3 | "Sessão da equipe expira após 30 min sem uso", enquanto a adega tem "token de 1 h e lembrar este aparelho". No Supabase, tempo de sessão e inatividade são **configuração do projeto inteiro**, não por tipo de usuário. Com as três identidades no mesmo projeto, a regra dos 30 min precisa ser implementada na `admin-api` (tabela de última atividade). | E11 e `D46`. |
| 1.7 | §3 | "Bloqueio após 5 erros em 10 min" (adega) e "bloqueio de IP por força bruta" (equipe). O Supabase Auth limita por IP, mas **não trava a conta** após N erros por padrão. Isso exige o hook de verificação de senha (disponível só em alguns planos) ou um login próprio intermediado por função. | `D45`. |
| 1.8 | §5 | "Caixa por operador: um ticket do front pede fechamento com duas pessoas no caixa." O ticket (TK-2048) é uma **dúvida** de um cliente **fictício** dos dados de demonstração: "Como faço o fechamento com duas pessoas no caixa?". Não é requisito. E "uma sessão por operador" conflita com a realidade de **uma gaveta física**: se dois operadores dividem a mesma gaveta, não dá para contar o dinheiro de cada um. | Modelo recomendado em E19: uma sessão de caixa por terminal (gaveta), com troca de operador dentro dela, e vendas sempre carimbadas com o operador. `D11`. |
| 1.9 | §5 e §7 | "O front mostra o caso de 412 eventos duplicados do iFood em 2 horas" e "força bruta de 14 tentativas em 5 min". São **dados de demonstração** usados como evidência. As regras (chave única por canal e ID externo, bloqueio por rajada) estão certas, mas não devem ser justificadas por números inventados. | Só registro. |
| 1.10 | §8 x decisão anterior | O documento usa **Stripe**. A decisão registrada antes era **Abacate Pay** (recorrência em cartão, UI embarcada, sem redirect). Não há registro da troca. | Bloqueante para E34 (`D01`). |
| 1.11 | §5 x decisão anterior | A decisão antiga era "sem cadastro de clientes, venda balcão anônima". O front e o documento têm clientes e fiado. O documento é mais recente, mas a mudança não está escrita em lugar nenhum. | Confirmar (`D19`). |
| 1.12 | §7, "Logs" | "Retenção de 30 dias para front, 90 para back e **5 para segurança**." Cinco dias para log de segurança é curto demais para investigar um incidente, e parece erro de digitação. | `D26`. |
| 1.13 | README da fase 2 x §10 | O README da fase 2 lista "Emissão de NFC-e" como próximo passo; o documento diz que NFC-e fica fora da v1. | Atualizar o README da fase 2 quando a fase começar. |
| 1.14 | §2, "Domínios" x proxy | Com o admin em `admin.addegas.com.br`, o proxy `/api/admin/*` precisa existir nesse domínio, e o `/api/*` da adega não deveria aceitar rotas de admin. O documento não diz se são dois projetos na Vercel ou um. | E04, `D47`. |

## 2. Lacunas: o que o front mostra e o documento não cobre

| # | Lacuna | Evidência | Onde foi tratada |
| --- | --- | --- | --- |
| 2.1 | **Impressão do cupom não-fiscal.** | Os Ajustes do `index.html` têm "Impressora de cupom"; o ticket TK-2044 fala de cupom cortado numa Elgin i9; a decisão do Pix diz que o sistema "gera a notinha da venda". | E24, `D18` |
| 2.2 | **Idempotência da venda.** O documento faz idempotência para webhooks, mas não para `finalize_sale`. | TK-2051: "Caixa travou ao finalizar venda no Pix e o cliente teve que pagar de novo." Rede ruim no balcão mais clique duplo é igual a venda dupla. | E20 (chave `client_request_id`) |
| 2.3 | **Caixa sem internet.** Nenhuma linha sobre o que acontece quando a internet cai no meio do turno. | Adega de bairro, tablet no Wi-Fi da loja. | `D14` |
| 2.4 | **Dia comercial.** "Fuso de São Paulo para a virada de dia" não basta: numa adega que fecha às 2h, o movimento da madrugada cairia no dia seguinte. | Relatórios por dia, fechamentos de caixa. | E26 (`business_day_cutoff`), `D12` |
| 2.5 | **Cancelamento de venda.** Existe a permissão, mas não a regra: devolve estoque? devolve dinheiro de qual caixa? até quando? | Permissão "Cancelar venda". | E21, `D10` |
| 2.6 | **Transferência entre lojas** da mesma conta. | TK-2052: "Entrada de mercadoria não soma no estoque da segunda loja." | E17, `D37` |
| 2.7 | **Importação de planilha de produtos.** O documento cria o bucket `imports`, mas não o fluxo. | Onboarding do front: "Importar planilha (.xlsx ou .csv)". | E16, `D39` |
| 2.8 | **Catálogo público da loja.** Aparece na tabela da §1 sem modelo nem regra. A migration tem `catalog_settings` e `stores.slug`. | Ajustes. | E31, `D38` |
| 2.9 | **Site de cadastro e landing.** "O dono se cadastra pelo site", mas não existe site no repositório, e o CRM depende de UTM capturada nele. | §3 e CRM do admin. | E06, E48, `D23` |
| 2.10 | **Porte do front.** "Cada etapa entregando algo testável de ponta a ponta" exige telas. O `index.html` é estático e não pode ser ligado ao back-end (regra do `CLAUDE.md`), e o app da fase 2 ainda não tem telas. | `proximos-passos/app-react-supabase/README.md`. | `D24` |
| 2.11 | **Nota fiscal do próprio Addegas.** A mensalidade é serviço: o Addegas precisa emitir NFS-e para cada adega. O documento só fala da NFC-e da adega. | §8. | `D30` |
| 2.12 | **Custos de infraestrutura.** O plano Hobby da Vercel não permite uso comercial; 3 projetos Supabase Pro, PITR, domínio próprio no Supabase e hooks de Auth são pagos. | §2, §3, §7. | E02, `D32` |
| 2.13 | **Acesso temporário do suporte.** Citado na §8 e no perfil Suporte, sem dizer o que é: ver os dados da adega? agir em nome dela? com consentimento? | §4, §8. | E36, `D27` |
| 2.14 | **2FA para o dono da adega.** O dono vê contas a pagar, relatórios e dados de clientes; só a equipe Addegas tem 2FA. | §3. | E06, `D44` |
| 2.15 | **Testes e qualidade.** Só aparece `supabase db advisors` no CI. Não há testes de RLS, de concorrência na venda nem de carga. | §9. | Definição de pronto no README, E52 |
| 2.16 | **Taxas de cartão e lucro real.** Relatórios mostram faturamento; o Lucro no Copo mostra margem. Nenhum dos dois considera a taxa da maquininha. | Relatórios, Lucro no Copo. | `D40` |
| 2.17 | **O `docs/` vai para o site publicado.** O `.vercelignore` tira `README.md`, `CLAUDE.md`, `scripts` e `proximos-passos`, mas **não** tira `docs/`. O README diz que tira. Hoje, este documento de arquitetura (com o desenho de segurança) ficaria público em `/docs/...` no próximo deploy. A pasta `planejamento/` também. | `.vercelignore` | `D51` (ação recomendada antes do próximo push) |

## 3. Problemas na migration atual que o documento diz que "aproveita"

O documento afirma que a migration da fase 2 "aproveita boa parte das tabelas operacionais e dos triggers". Ela é um bom rascunho, mas tem defeitos que precisam ser corrigidos, não migrados:

1. **Qualquer usuário cria lojas sem limite.** A política `"usuário cria loja" ... with check (auth.uid() is not null)` deixa qualquer conta logada criar lojas à vontade, o que derruba os limites do plano. Criação de loja tem de ser RPC com checagem de plano (E06, E08, E32).
2. **Vazamento entre lojas nas tabelas filhas.** `sale_items` e `sale_payments` recebem `store_id` do cliente, e a política só confere `is_member(store_id)` da própria linha. Um membro da loja A pode inserir um item com `store_id = A` apontando para uma `sale_id` da loja B. Resolve com chave estrangeira composta `(sale_id, store_id) → sales(id, store_id)` e escrita só pela RPC (E03, E20).
3. **Helpers `security definer` no schema `public`** (`is_member`, `has_role`) viram RPC pública. A seção 9 do documento já aponta isso.
4. **Cancelamento não devolve estoque.** O trigger de `sale_items` baixa estoque no insert, e `sales.status = 'canceled'` não estorna nada.
5. **Dois caminhos para atualizar `products.stock`.** O trigger de `sale_items` atualiza direto; o de `stock_movements` ignora o tipo `sale`. Funciona, mas é frágil: qualquer novo tipo de movimento precisa lembrar das duas regras. Melhor uma regra só: o saldo muda **somente** pelo insert em `stock_movements`.
6. **Tipo `count` ambíguo.** Na contagem, `quantity` é a diferença ou o valor contado? O trigger soma, então é diferença; quem gravar o valor contado corrompe o estoque. A E17 separa `stock_counts` (valor contado) do movimento (diferença calculada no servidor).
7. **O custo é sobrescrito pela última entrada.** Afeta margem e Lucro no Copo (`D08`).
8. **`numeric(10,2)` para dinheiro e número de venda global** (`generated always as identity`): já apontados pelo documento.
9. **Permissão em texto livre** (`role_permissions.permission text`). Sem tabela de referência, um erro de digitação vira uma permissão nova, em silêncio. A E12 cria `app.permissions` como catálogo.
10. **Combo sem estoque próprio é correto, mas o combo não é bloqueado** quando um produto do combo é desativado. A E18 trata isso.

## 4. Premissas técnicas que precisam ser verificadas

| Premissa do documento | Situação | Ação |
| --- | --- | --- |
| "Desde 30/05/2026 o Supabase não expõe tabela nova na API sozinho." | Não consegui confirmar a data nem o comportamento. A recomendação (grant explícito) é boa de qualquer forma. | Conferir no changelog do Supabase antes da E03 e manter o grant explícito em toda migration. |
| Stripe Billing no Brasil com Pix e boleto recorrentes. | Cartão recorrente funciona. O Pix Automático é recente no Brasil, e o suporte dele em assinaturas do Stripe precisa ser confirmado; boleto recorrente tem atrito. | Validar com a conta Stripe BR antes da E34 (`D01`). |
| iFood, Zé Delivery, 99Food e Keeta mandam pedidos por webhook. | O iFood exige cadastro como software parceiro e homologação, e tem prazo para confirmar pedido. Zé Delivery, 99Food e Keeta não têm API pública aberta para qualquer PDV; o acesso costuma ser por parceria. | Antes da E43/E44, confirmar acesso, contrato e modelo (webhook ou polling) de cada um (`D21`). |
| W-API para WhatsApp. | A W-API é uma API **não oficial** (sessão do WhatsApp Web). Funciona, mas há risco de bloqueio do número e de violação dos termos do WhatsApp, principalmente em cobrança de fiado a clientes finais e em mensagens em massa. A API oficial (Cloud API da Meta) exige templates aprovados e cobra por conversa. | `D22`. |
| Tempo real por Broadcast disparado por trigger em canal privado. | Correto, mas canal privado exige políticas em `realtime.messages` e autenticação do canal no front. | Incluído na E25. |
| pg_cron chamando funções. | Precisa de `pg_net` e do segredo da função guardado no Vault. A rotina das 9h tem de ser **idempotente**: rodar duas vezes no mesmo dia não pode suspender duas vezes nem mandar dois avisos. | Incluído na E33. |
| Particionamento mensal de `events` e `system_logs`. | Possível, mas precisa de rotina que crie a partição do mês seguinte (pg_partman ou cron próprio). Sem isso, o insert falha no dia 1º. | Incluído na E46. |
| O hash protege o PIN. | Um PIN de 4 dígitos tem 10 mil combinações; com o hash em mãos, ele cai em segundos. O que protege de verdade é o hash nunca sair do servidor e o bloqueio por tentativas, por operador **e** por terminal. | E10, `D13`. |
| Firewall com limite de requisições na Vercel. | Regras de limite de taxa dependem do plano da Vercel. | E04, `D32`. |

## 5. Escopo: o que dá para cortar ou comprar na v1

O documento trata tudo com o mesmo peso. Sugestão de corte, para chegar ao primeiro cliente pagante mais cedo:

| Área | Sugestão para a v1 | Por quê |
| --- | --- | --- |
| CRM, marketing, brindes, mapa (M9) | Adiar, ou usar ferramenta pronta (planilha, CRM gratuito), até ter 30 a 50 clientes | Não impedem a adega de vender nem o Addegas de cobrar. São cerca de 25 tabelas. |
| Monitoramento próprio com regras de alerta | Começar com um serviço de erros de front, os logs do Supabase e um alerta simples; construir o painel depois | Construir observabilidade antes de ter tráfego é caro. O ID de correlação fica desde o início (E05). |
| Tickets com SLA e grupos de melhoria | Fluxo básico (abrir, responder, anexar, fechar) com SLA calculado; grupos de melhoria depois | O SLA é simples; a curadoria de melhorias não. |
| 4 apps de delivery | 1 piloto (o que tiver API e contrato mais rápidos), os outros um a um | Cada app tem homologação, regras e suporte próprios. |
| Repositório de produtos com versões e sugestões | v1: catálogo mestre só leitura para a adega e edição simples pela equipe; versões e sugestões depois | O valor está em a adega não precisar digitar produto, não no versionamento. |
| Várias lojas | Manter o modelo pronto (`account → stores`), mas liberar a segunda loja só depois do piloto | O modelo é barato; a UI e as regras de transferência não. |

## 6. Pontos fortes que devem ser preservados
- Separar **assinatura** de **acesso**, e "suspenso" bloquear só a operação, mantendo dados, suporte e regularização.
- Permissão validada no servidor, com a negação indo para a auditoria.
- Livro-razão para estoque, fiado e caixa, com correção por novo lançamento.
- Proxy `/api` com URL própria de webhook (dá para trocar de provedor sem avisar parceiros).
- Usuário técnico para o terminal do balcão, separado da conta do dono.
- Caixa de entrada de webhooks com o payload bruto salvo antes de processar.
- A revisão da §9: helpers em schema privado, `WITH CHECK` no UPDATE, `(select auth.uid())`, índices em FK, `security_invoker` nas views, broadcast em vez de Postgres Changes.

## 7. Riscos ordenados

| Risco | Probabilidade | Impacto | Mitigação |
| --- | --- | --- | --- |
| Integrações de delivery sem acesso ou homologação | Alta | Alto (é promessa de venda do produto) | Validar contratos já; não prometer os 4 apps na v1 |
| Venda duplicada ou perdida com rede ruim | Alta | Alto (dinheiro do cliente da adega) | Idempotência (E20) e decisão sobre offline (`D14`) |
| Escopo grande atrasando o primeiro cliente pagante | Alta | Alto | Cortes da seção 5 e piloto depois do M4 + M6 |
| Front React não acompanhar o back-end | Alta | Alto | `D24`: plano de porte em paralelo, tela do caixa primeiro |
| Bloqueio do número no WhatsApp (W-API) | Média | Alto | API oficial para mensagens a clientes finais; W-API só para alertas internos, se mantida |
| Regra de sessão e bloqueio da equipe mal implementada | Média | Alto (acesso a todas as adegas) | E11 com testes; hook de Auth ou login por função |
| Documento de segurança publicado no site | Alta, se nada mudar | Médio | Incluir `docs` e `planejamento` no `.vercelignore` (`D51`) |
| Custo de 3 projetos Supabase e add-ons antes de receita | Média | Médio | Homologação com Branching ou projeto pequeno (`D34`) |
