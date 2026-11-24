# Addegas · Arquitetura do back-end

Oct 26, 2026 · @wellington

## 1. O que o front pede do back-end

O front tem dois produtos com donos diferentes: o painel da adega (`index.html`) e o painel da equipe Addegas (`admin.html`). Hoje os dois rodam 100% em memória, com dados fictícios e ações marcadas como "simulado". O back-end precisa entregar tudo que está simulado, com as regras que o próprio front já descreve.

**Painel da adega** (dono, gerente, caixa, entregador)

| Área | Telas | O que exige do back-end |
| --- | --- | --- |
| Operação | Início, Caixa (PDV), Pedidos | Vendas com mesas e comandas, 5 formas de pagamento (Pix, crédito, débito, dinheiro com troco, fiado), abertura e fechamento de caixa, pedidos de iFood, Zé Delivery, 99Food, Keeta e WhatsApp em tempo real |
| Gestão | Estoque, Clientes e fiado, Compras, Contas a pagar | Produtos, combos, lotes com validade, entrada de mercadoria, contagem, saldo de fiado com data de pagamento, fornecedores, sugestão de compra por WhatsApp, contas com juros |
| Análise | Relatórios | Vendas por período, hora, canal e forma de pagamento, mais vendidos, fechamentos de caixa |
| Ferramentas | Promoções, Lucro no Copo, Anotações | Promoções com produtos do estoque, receitas de drinks com custo por ml, notas com prioridade |
| Configurar | Equipe, WhatsApp, Ajustes | Convite por WhatsApp, matriz de 10 permissões por função, alertas automáticos, catálogo público, integrações, várias lojas |
| Fora do menu | Login, PIN do caixa, cadastro em 3 passos, seletor de loja, alertas, perfil, suporte | Autenticação, troca de operador por PIN, onboarding, tickets com anexo |

**Painel Addegas** (equipe interna, 17 telas)

| Grupo | Telas | O que exige do back-end |
| --- | --- | --- |
| Painel | Visão geral | MRR, recebido, churn, conversão do teste, uso efetivo (ações, não sessões abertas) |
| Clientes | Adegas, CRM | Ficha da adega com 8 abas, funil de leads com origem e UTM, motivo de perda |
| Receita | Planos, Financeiro, Descontos | 3 planos com limites, faturas, carência de 5 dias, pagamento manual com comprovante, descontos por ciclo, reembolsos |
| Produto | Repositório de produtos, Tickets, Uso | Catálogo mestre com EAN e versões, tickets com SLA e mensagens internas, funis por evento |
| Crescimento | Marketing, Brindes, Mapa, Mensagens | Investimento por canal, kits por aniversário de assinatura, geolocalização, templates com variáveis e consentimento |
| Plataforma | Monitoramento, Equipe, Configurações | Logs de front, back e segurança com ID de correlação, regras de alerta, 5 perfis, 2FA obrigatório, auditoria |

Três regras do front mandam no desenho todo:

- **Assinatura e acesso são eixos separados.** Assinatura: teste, ativa, inadimplente, cancelada, expirada. Acesso: liberado, em carência, suspenso. Suspenso bloqueia caixa, pedidos e estoque, mas mantém regularização, suporte e os dados.
- **Permissão é validada no servidor.** O admin repete isso em várias telas: esconder o menu não basta, e toda tentativa negada vai para a auditoria.
- **Toda ação administrativa registra autor, data, motivo e antes/depois.** Isso vira uma tabela de auditoria só de inserção.

Divergência com o que combinamos antes: o front tem **3 planos** (Bairro R$ 89, Esquina R$ 149, Rede R$ 289) e **teste de 14 dias**. Antes tínhamos fechado plano único de R$ 149,90 e 7 dias. Decisão: plano único de R$ 149,90 e teste de 14 dias, então a tela de planos do admin e a ficha da adega precisam ser ajustadas no front.

## 2. Arquitetura geral

A proposta é seguir no Supabase com o front na Vercel, que é o seu padrão e já é o caminho da fase 2 (`proximos-passos/app-react-supabase`). Não há servidor próprio para manter: o banco aplica as regras de acesso e as funções fazem o que não pode ficar no navegador.

&#91;embedded content: arquitetura · clientes, Vercel, Supabase e serviços externos\]

**Como o tráfego HTTP se divide**

| Tipo de chamada | Caminho | Exemplo |
| --- | --- | --- |
| Leitura e cadastro simples da adega | Navegador → API de dados do Supabase, com RLS | listar produtos, salvar anotação, cadastrar fornecedor |
| Operação com regra de negócio | Navegador → função no banco (RPC) em uma transação | fechar venda, abrir e fechar caixa, entrada de mercadoria, pagamento de fiado |
| Tudo do painel Addegas | Navegador → `/api/admin/*` → função `admin-api` | trocar plano, suspender acesso, registrar pagamento, responder ticket |
| Webhooks de parceiros | Parceiro → `/api/hooks/<parceiro>` → função de webhook | pedido do iFood, fatura paga no Stripe |
| Arquivos | Navegador → Storage com URL assinada | foto de produto, anexo de ticket, comprovante |

**Proxy.** A Vercel reescreve `/api/*` para `https://<projeto>.supabase.co/functions/v1/*`. Isso deixa as chamadas na mesma origem do site (sem CORS para liberar), concentra firewall e limite de requisições num só lugar e dá aos parceiros uma URL de webhook nossa, que não muda se um dia trocarmos de provedor.

**Domínios.** Recomendo tirar o admin do caminho `/admin` e levar para `admin.addegas.com.br`. Com domínio próprio, a sessão da equipe fica isolada da sessão da adega no navegador, e dá para aplicar regras de firewall mais duras só nele.

**Ambientes.** Três projetos Supabase separados (desenvolvimento, homologação e produção), cada um ligado a um ambiente da Vercel. Migrations versionadas no repositório, nunca alteração manual no painel de produção.

## 3. Login e sessões

São três identidades diferentes, todas no Supabase Auth do mesmo projeto, mas com regras de entrada e de sessão próprias.

| Identidade | Como entra | Sessão | Proteções |
| --- | --- | --- | --- |
| Pessoa da adega (dono, gerente, caixa, entregador) | E-mail e senha. O dono se cadastra pelo site; os demais entram por convite enviado no WhatsApp | Token de acesso de 1 h, refresh com rotação, "lembrar este aparelho" | Captcha no cadastro e no login, e-mail confirmado, bloqueio após 5 erros em 10 min |
| Terminal do caixa (tablet ou PC do balcão) | Dono ou gerente registra o aparelho uma vez; o operador entra com nome e PIN de 4 dígitos | Turno do operador até o fechamento do caixa ou 12 h | PIN guardado com hash, 5 erros travam o operador por 15 min, terminal revogável no painel |
| Equipe Addegas | Convite pelo administrador mestre, só e-mail `@addegas.com.br`, senha mais código do aplicativo autenticador | Expira após 30 min sem uso | 2FA obrigatório (nível `aal2` exigido pela `admin-api`), recuperação por link de 30 min sem desligar o 2FA, bloqueio de IP por força bruta |

**Por que o terminal tem login próprio.** Se o tablet do balcão ficar logado com a conta do dono, qualquer operador consegue ler contas a pagar e relatórios pela API, mesmo que a tela esconda. Por isso o aparelho registrado recebe um usuário técnico do tipo `terminal`, que só enxerga caixa, pedidos e consulta de estoque daquela loja. O PIN identifica quem está operando: abre uma sessão de operador, e toda venda, sangria e fechamento gravam esse operador.

**Várias lojas.** Uma pessoa pode ser membro de mais de uma loja (o seletor de lojas do front). A loja ativa não vai dentro do token; cada linha do banco tem `store_id` e a RLS confere se a pessoa é membro ativo daquela loja. Assim, trocar de loja não exige novo login.

**Perfil vem da conta, nunca da tela.** O login de demonstração do admin deixa escolher o perfil; no sistema real o perfil sai da tabela `platform.staff` e é conferido a cada chamada.

## 4. Roles e permissões

São dois sistemas que não se misturam: as funções dentro de cada loja e os perfis da equipe Addegas. Nos dois, a regra é a mesma: o servidor decide, a tela só esconde o que já seria recusado.

### Dentro da adega

Uma ação só passa quando as quatro condições são verdadeiras ao mesmo tempo:

1. a pessoa é membro ativo da loja;
2. o acesso da conta permite a ação (suspenso bloqueia caixa, pedidos e estoque, mas libera leitura, regularização e suporte);
3. o plano inclui o recurso (no plano único tudo vem liberado, mas a checagem já nasce pronta para planos futuros);
4. a função da pessoa tem a permissão.

Tudo isso vira uma única função no banco, `app.can(store_id, permissao)`, usada pelas políticas de RLS e pelas RPCs. Padrão das 10 permissões que o front já tem, editável pelo dono:

| Permissão | Dono | Gerente | Caixa | Entregador |
| --- | --- | --- | --- | --- |
| Vender no caixa | sim | sim | sim | não |
| Dar desconto | sim | sim | não | não |
| Cancelar venda | sim | sim | não | não |
| Abrir e fechar caixa | sim | sim | sim | não |
| Vender no fiado | sim | sim | sim | não |
| Mexer no estoque | sim | sim | não | não |
| Editar preços e combos | sim | sim | não | não |
| Ver contas a pagar | sim | sim | não | não |
| Ver relatórios | sim | sim | não | não |
| Gerenciar equipe | sim | não | não | não |
| Ver e atualizar pedidos atribuídos | sim | sim | sim | sim |

O dono nunca perde permissões e não pode ser rebaixado por um gerente. A linha do entregador está decidida: o entregador vê e atualiza só os pedidos atribuídos a ele, e a RLS filtra pelo entregador do pedido.

**Limites do plano** também são regra de banco, conferidos por trigger na hora de inserir: lojas, usuários e produtos. No plano único, usuários e produtos ficam ilimitados; o número de lojas por conta ainda precisa ser definido.

### Equipe Addegas

| Perfil | Telas | Ações que pode executar |
| --- | --- | --- |
| Administrador mestre | Todas | Todas, inclusive equipe e configurações da plataforma |
| Financeiro | Visão geral, adegas, planos, financeiro, descontos, mensagens | Trocar plano, suspender ou reativar acesso, registrar pagamento, conceder descontos, exportar, enviar mensagens |
| Suporte | Visão geral, adegas, tickets, repositório, mensagens, monitoramento | Acesso temporário, anotações, responder tickets, editar o repositório de produtos, enviar mensagens, investigar ocorrências |
| Comercial e marketing | Visão geral, adegas, CRM, marketing, brindes, mapa, mensagens, descontos | Estender teste, anotações, CRM, brindes, mensagens e campanhas promocionais, investimento de marketing |
| Analista | Visão geral, adegas, financeiro, planos, uso, marketing, mapa | Somente leitura e exportação |

Os perfis e a lista de ações ficam em tabela (`platform.staff_roles` e `platform.role_actions`), não no código. Toda chamada da `admin-api` passa pelo mesmo filtro: token válido com 2FA, pessoa ativa na equipe, ação permitida para o perfil. Recusou, grava em auditoria como "ação negada por permissão", que é o comportamento que o front já simula.

## 5. Banco de dados

O banco fica dividido em cinco schemas, e só o `app` é exposto pela API de dados. Os outros quatro só são acessados pelas funções, o que tira do navegador qualquer caminho até faturas, leads ou auditoria.

**Hierarquia do cliente.** A migration da fase 2 trata a loja como o cliente e guarda o plano na loja. O front pede um nível acima: a **conta** (a adega que assina, com plano, assinatura e acesso) tem uma ou mais **lojas** (limitadas pelo plano), e cada loja tem seus **membros**. Toda tabela operacional carrega `account_id` e `store_id`.

| Schema | Domínio | Tabelas |
| --- | --- | --- |
| `app` | Conta e equipe | `accounts`, `stores`, `profiles`, `store_members`, `member_invites`, `role_permissions`, `terminals`, `operator_sessions` |
| `app` | Catálogo e estoque | `categories` (cor e ordem), `products` (ligado ao catálogo mestre pelo EAN), `combos`, `combo_items`, `stock_lots`, `stock_movements`, `stock_counts`, `quick_access` |
| `app` | Caixa e vendas | `cash_sessions`, `cash_movements` (sangria e reforço), `tabs` (mesas e comandas), `sales`, `sale_items`, `sale_payments` |
| `app` | Pedidos | `orders`, `order_items`, `order_events` (histórico de status) |
| `app` | Clientes e compras | `customers`, `customer_ledger` (fiado), `suppliers`, `supplier_types`, `purchase_orders`, `purchase_order_items`, `bills`, `bill_categories` |
| `app` | Ferramentas e ajustes | `promotions`, `promotion_items`, `drink_recipes`, `drink_recipe_items`, `notes`, `integrations`, `alert_settings`, `store_settings` |
| `platform` | Receita | `plans`, `plan_features`, `subscriptions`, `subscription_events`, `invoices`, `payments`, `refunds`, `discounts`, `discount_targets`, `billing_queue` |
| `platform` | Crescimento | `leads`, `lead_events`, `lead_stages`, `campaigns`, `marketing_spend`, `message_templates`, `message_sends`, `message_recipients`, `consents`, `gifts`, `gift_kits`, `gift_stock` |
| `platform` | Produto e equipe | `catalog_products`, `catalog_versions`, `catalog_suggestions`, `staff`, `staff_roles`, `role_actions`, `platform_config` |
| `support` | Tickets | `tickets`, `ticket_messages` (com marcação de nota interna), `ticket_attachments`, `improvement_groups` |
| `analytics` | Uso e funis | `events`, `daily_usage`, `funnels`, `funnel_steps` |
| `audit` | Rastreio | `admin_actions`, `store_actions`, `system_logs`, `alert_rules`, `webhook_inbox` |

**Regras que valem para o banco inteiro**

- **Dinheiro em centavos** (`bigint`), nunca `numeric` com vírgula na API. A formatação em R$ fica só no front.
- **Datas em `timestamptz`**, com o fuso `America/Sao_Paulo` definido na conta para relatórios e virada de dia.
- **Saldos derivados de livro-razão imutável.** Estoque sai de `stock_movements`, fiado de `customer_ledger`, caixa de `cash_movements`. Essas tabelas e as de auditoria aceitam só inserção; correção é um novo lançamento.
- **Venda é uma RPC atômica.** `app.finalize_sale` confere caixa aberto, permissão de desconto, limite de fiado e estoque, grava itens, pagamentos e baixas numa transação só, e devolve o número da venda.
- **Numeração por loja.** O número que o cliente vê (#1043) vem de um contador por loja, não de uma sequência global.
- **Caixa por operador.** Um ticket do front pede fechamento com duas pessoas no caixa, então a regra é uma sessão aberta por operador e terminal, não uma por loja como na migration atual.
- **Pedidos sem duplicidade.** `orders` tem chave única por loja, canal e ID externo; o front mostra o caso de 412 eventos duplicados do iFood em 2 horas.
- **Tempo real** ligado em `orders`, `sales` e `cash_sessions`, para o Início do dono atualizar sozinho.

A migration de `proximos-passos` aproveita boa parte das tabelas operacionais e dos triggers de estoque e fiado. Os ajustes são: incluir `accounts`, trocar valores para centavos, mudar a regra de caixa aberto e mover plano e assinatura para o schema `platform`.

## 6. Armazenamento de arquivos

Seis buckets no Supabase Storage, dois públicos e quatro privados. O que é público é só imagem que já aparece para o cliente final; todo o resto é lido por URL assinada que vale 5 minutos.

| Bucket | Acesso | Caminho | Quem grava | Limite |
| --- | --- | --- | --- | --- |
| `catalog-images` | Público, com CDN | `catalog/{produto_mestre}/{versao}.webp` | Equipe com permissão no repositório | 2 MB, JPG, PNG ou WebP |
| `store-public` | Público, com CDN | `{store_id}/logo.webp`, `{store_id}/products/{id}.webp`, `{store_id}/drinks/{id}.webp` | Dono e gerente (editar preços) | 2 MB, JPG, PNG ou WebP |
| `ticket-attachments` | Privado | `{account_id}/{ticket_id}/{uuid}` | A adega dona do ticket e o suporte | 10 MB, imagem ou PDF |
| `payment-proofs` | Privado | `{account_id}/{invoice_id}/{uuid}` | Financeiro | 10 MB, imagem ou PDF |
| `imports` | Privado | `{store_id}/{uuid}` | Dono e gerente | 5 MB, CSV ou XLSX |
| `exports` | Privado | `{staff_id}/{data}/{uuid}.csv` | Só as funções | apagado em 24 h |

**Regras de upload**

- O navegador nunca escolhe o caminho. Uma função gera a URL assinada de upload já com o caminho final, e o nome original do arquivo fica só nos metadados.
- O servidor confere o tipo real do arquivo (não só a extensão) e recusa o que não estiver na lista.
- Fotos são convertidas para WebP e redimensionadas no envio. O front já tem o lugar para a foto real no Lucro no Copo e nos produtos.
- As políticas do Storage seguem o prefixo do caminho: só lê `ticket-attachments/{account_id}/...` quem é membro daquela conta ou do suporte.
- Cada arquivo privado tem uma linha de metadados (dono, tamanho, tipo, quem enviou), para auditoria e para apagar junto quando a conta for excluída.

## 7. Segurança

A defesa é em camadas: a Vercel filtra o tráfego, o Auth identifica, o banco decide o que cada um vê e a auditoria registra o que foi feito.

| Camada | Medida |
| --- | --- |
| Banco | RLS em toda tabela do `app`; schemas internos fora da API; funções `security definer` sempre com `search_path` fixo; permissões padrão revogadas do papel anônimo |
| Segredos | Chaves de Stripe, Resend e W-API como secrets das funções; tokens do iFood e dos outros apps no Vault, por loja; chave `service_role` nunca sai das funções |
| Webhooks | Assinatura conferida e tolerância de 5 min no horário; payload bruto salvo em `audit.webhook_inbox` antes de processar; chave de idempotência única; resposta 200 rápida e processamento depois |
| Abuso | Firewall da Vercel limitando `/api/auth` e o login; captcha (Cloudflare Turnstile) no cadastro e no login; bloqueio de IP após rajada de tentativas, como o caso de 14 em 5 min que o monitoramento do front mostra |
| HTTP | HSTS, CSP restrita aos domínios usados, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy` estrita; CORS das funções só para os domínios Addegas |
| Rastreio | O front gera um ID de correlação por ação (`x-correlation-id`), as funções repassam e os logs gravam; é o mesmo ID que o admin mostra ligando ticket, erro de front e erro de back |
| Auditoria | `audit.admin_actions` e `audit.store_actions` aceitam só inserção: autor, data, motivo e antes/depois; tentativas negadas também entram |
| Logs | E-mail e IP mascarados, sem senha, token ou dado de cartão; retenção configurável (o front sugere 30 dias para front, 90 para back e 5 para segurança) |
| Dados e LGPD | A adega é controladora dos dados dos clientes dela (nome, telefone, fiado) e o Addegas é operador; consentimento separado para mensagens promocionais; exportação e exclusão de conta; backup com recuperação por ponto no tempo |

**Atenção na fase atual.** O `support.js` carrega o React do unpkg.com. Funciona com SRI, mas obriga a CSP a liberar um script de terceiro. Na fase 2, com build próprio, essa dependência sai e a CSP fica só com os domínios Addegas, Supabase e Google Fonts.

## 8. Ciclo da assinatura, rotinas e integrações

A cobrança roda sozinha: o Stripe cobra e avisa por webhook, e uma rotina diária às 9h (fuso de São Paulo) move cada conta de estado. Antes de qualquer aviso ou suspensão, o pagamento é verificado de novo, como o admin já descreve.

&#91;embedded content: ciclo da assinatura · 6 estados e o acesso em cada um\]

Cancelamento não corta o acesso na hora: a renovação é desligada e a conta segue ativa até o fim do ciclo pago. O financeiro pode registrar pagamento manual com comprovante, e o suporte pode dar acesso temporário, que não quita a cobrança nem reinicia a carência.

**Rotinas agendadas** (pg\_cron chamando funções)

| Quando | Rotina | O que faz |
| --- | --- | --- |
| Todo dia, 9h | Ciclo de cobrança | Confere pagamentos, abre carência, suspende quem passou de 5 dias, expira testes, aplica cancelamentos agendados |
| A cada minuto | Fila de mensagens | Envia WhatsApp e e-mail agendados, rechecando a condição antes de cada envio |
| A cada 5 min | Reprocessamento de webhooks | Tenta de novo o que falhou na caixa de entrada |
| A cada 15 min | Prazo dos tickets | Marca atraso de primeira resposta (1, 4, 8 e 24 h) e de resolução (8, 24, 72 e 120 h) por prioridade |
| De hora em hora | Regras de alerta | Erros de front acima de 3 vezes a média, mais de 50 webhooks duplicados por hora, força bruta no login |
| Todo dia, 2h | Consolidação | Uso diário por adega, foto do MRR, marcos de 1, 2 e 3 anos para brindes, limpeza por retenção e de exportações |

**Integrações**

- **Stripe:** assinatura recorrente da conta pelo Stripe Billing, com cartão como forma principal (boleto e Pix dependem do que a conta brasileira liberar para recorrência). O cadastro cria o cliente no Stripe sem pedir cartão; o teste corre no nosso banco e a assinatura nasce no checkout. Os eventos `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` e `customer.subscription.deleted` entram pela caixa de webhooks com a assinatura `Stripe-Signature` conferida. As novas tentativas de cobrança do Stripe continuam ligadas, mas quem decide carência e suspensão é a nossa rotina das 9h. O portal do cliente do Stripe resolve troca de cartão e segunda via sem tela nossa.
- **iFood, Zé Delivery, 99Food e Keeta:** pedidos entram por webhook, viram `orders` com baixa de estoque na confirmação, e a mudança de status volta para o app de origem.
- **W-API:** alertas da loja (estoque baixo, validade, pedido atrasado, resumo do fechamento), convites da equipe, cobrança de fiado e mensagens da central do admin.
- **Resend:** confirmação de conta, recuperação de senha, faturas e avisos de cobrança.

Toda mensagem respeita o tipo: aviso de serviço (cobrança, carência, suspensão) sempre pode ser enviado; campanha promocional só para quem aceitou, que é a distinção que a ficha da adega já mostra.

## 9. Revisão com as boas práticas do Supabase

Passei o desenho pelas duas skills do Supabase (boas práticas de Postgres e checklist de segurança). A base está certa: RLS por loja, schemas internos fora da API, livro-razão imutável e dinheiro em centavos. Abaixo, o que muda antes da primeira migration.

| Prioridade | Ponto | Ajuste no desenho |
| --- | --- | --- |
| Crítico | `app.can()` e os helpers da RLS são `security definer`. No schema `app` eles virariam RPC pública, porque o Postgres dá `EXECUTE` a todos por padrão | Ficam num schema `private` não exposto, com `set search_path = ''`, conferência de `auth.uid()` dentro da função e `revoke execute` de `public`, `anon` e `authenticated` |
| Crítico | Desde 30/05/2026 o Supabase não expõe tabela nova na API sozinho | Cada migration do `app` traz o `grant` explícito para `authenticated` junto com `enable row level security`; tabela operacional nunca recebe `grant` para `anon` |
| Crítico | O tipo do usuário (`terminal`, equipe) entra em decisões de acesso | Guardar em `app_metadata`, nunca em `user_metadata`, que o próprio usuário consegue editar |
| Alto | Política de UPDATE só com `USING` deixa mover uma linha para outra loja trocando o `store_id` | Toda política de UPDATE com `USING` e `WITH CHECK`, mais a política de SELECT correspondente (sem ela o UPDATE devolve 0 linhas sem erro) |
| Alto | Função na RLS avaliada linha a linha | Escrever `(select auth.uid())` e `(select private.can(store_id, '...'))` para o planner calcular uma vez; índice em `store_id` e `account_id` em toda tabela |
| Alto | O Postgres não cria índice para chave estrangeira | Índice em toda FK e compostos nos filtros reais, como `(store_id, created_at desc)` em vendas, pedidos e movimentos |
| Alto | Dois caixas vendendo o mesmo produto ao mesmo tempo | `finalize_sale` trava os produtos sempre na mesma ordem (por id) para evitar deadlock, e o número da venda sai de `update store_counters ... returning`, tudo numa transação curta |
| Médio | Livro-razão imutável só por trigger | Também `revoke update, delete` dessas tabelas para `authenticated`; o trigger vira a segunda barreira |
| Médio | Relatórios e painéis montados em views | View sempre `with (security_invoker = true)`, senão ela ignora a RLS |
| Médio | Filas de mensagens, faturas e webhooks processadas a cada minuto | `pgmq` ou `for update skip locked`, para dois processos nunca pegarem o mesmo item |
| Médio | `analytics.events` e `audit.system_logs` crescem rápido | Partição por mês; a retenção vira apagar a partição antiga, sem `delete` em massa |
| Médio | Tempo real por Postgres Changes confere a RLS a cada evento para cada assinante | Broadcast disparado por trigger em canal privado por loja (`store:{id}`) |
| Médio | Upload que substitui arquivo (logo, foto de produto) | A política do Storage precisa de INSERT, SELECT e UPDATE, senão a substituição falha |
| Médio | Tirar alguém da equipe ou revogar um terminal não invalida o token já emitido | Revogar as sessões no Auth na hora; a RLS já recusa porque confere `is_active` |
| Baixo | Listas longas de vendas, pedidos e logs | Paginação por cursor (`created_at`, `id`) em vez de `offset` |
| Baixo | Função conectando direto no Postgres | Pooler em modo transação, sem prepared statements; usando `supabase-js` isso não se aplica |

**No CI:** `supabase db advisors` roda a cada migration e barra o merge com alerta de segurança, as versões do `supabase-js` ficam fixas com lockfile e o token do CI tem escopo só do projeto.

## 10. Decisões em aberto e ordem de construção

Antes da primeira migration, faltam estas decisões:

- [x] **Planos:** decidido, plano único de R$ 149,90/mês; os 3 do front (Bairro, Esquina, Rede) ficam fora da v1, e a tabela de planos continua pronta para novos planos e campanhas.
- [x] **Duração do teste:** decidido, 14 dias, como o front já calcula.
- [ ] **Pix no caixa:** só registrar que a venda foi paga em Pix. Decidido: o sistema não processa pagamento das vendas da adega. Ele gera a notinha da venda e o operador dá baixa informando a forma (Pix, cartão, dinheiro ou fiado). Sem gateway e sem espera de confirmação no caixa.
- [x] **Admin em subdomínio:** sair de `/admin` para `admin.addegas.com.br`.
- [x] **NFC-e:** confirmar que fica fora da primeira versão, como diz o README.

Ordem sugerida, cada etapa entregando algo testável de ponta a ponta:

1. **Fundação:** três projetos Supabase, os cinco schemas, proxy `/api` e headers na Vercel, migrations rodando no CI.
2. **Identidade:** cadastro com captcha, contas, lojas e membros, convites, terminal com PIN, equipe Addegas com 2FA.
3. **Permissões:** `app.can`, matriz por loja, recursos e limites por plano, perfis da equipe e auditoria.
4. **Núcleo da adega:** catálogo, estoque, caixa e vendas com `finalize_sale`, fiado. É a tela mais usada, então vem primeiro no porte do front.
5. **Assinatura:** planos, Stripe, faturas, rotina das 9h, carência e suspensão, mensagens de cobrança.
6. **Painel Addegas:** adegas, financeiro, descontos, tickets e repositório de produtos.
7. **Integrações:** pedidos dos apps de delivery e alertas por WhatsApp da loja.
8. **Crescimento e observabilidade:** CRM, marketing, funis, brindes e monitoramento.
