# Acessos de teste

Só valem no ambiente local (Supabase local + `npm run dev`). Nada daqui existe no dev nem na produção.
O `npm run db:reset` recria os acessos do seed; os criados durante os testes somem.

> Atualizado em 31/10/2026 (massa de teste com 10 adegas). Todo acesso novo criado em teste entra aqui.

## Endereços

| O quê | Endereço |
|---|---|
| App novo (adega) | http://localhost:5173 |
| Painel da equipe Addegas (admin) | http://localhost:5173/admin/ |
| Protótipo aprovado (`index.html`) | http://localhost:5500 |
| Protótipo do Admin (`admin.html`) | http://localhost:5500/admin |
| Supabase Studio | http://localhost:57323 |
| Mailpit (e-mails do Auth: confirmação, troca de senha) | http://localhost:57324 |
| API do Supabase | http://127.0.0.1:57321 |
| Banco | `postgresql://postgres:postgres@127.0.0.1:57322/postgres` |

## App novo: quem entra com e-mail ou usuário

Senha de todos do seed: **`addegas123`**

| Login | Quem é | Loja |
|---|---|---|
| `marcos@adega.test` | Marcos Silva, dono | Adega Esquina e Adega Esquina 2 |
| `rafa@adega.test` | Rafa Costa, gerente | Adega Esquina e Adega Esquina 2 |
| `diego@adega-esquina` | Diego Alves, entregador | Adega Esquina |
| `kaua@adega-esquina` | Kauã Lima, entregador | Adega Esquina |
| `joana@porto.test` | Joana Prado, dona de outra conta (em carência) | Adega do Porto |
| `admin@addegas.com.br` | Equipe Addegas, perfil master | — |

- Entregador e funcionário com usuário entram como `usuario@slug-da-loja`.
- Joana serve para testar isolamento: ela não pode ver nada da Adega Esquina.
- A equipe Addegas não entra no app da adega (lá aparece só um aviso). Ela entra no painel: veja a seção abaixo.

### Massa de teste: 10 adegas com volume de cliente real (`npm run db:massa`)

Carregada por cima do seed (não apaga nada). Depois de um `npm run db:reset`, rode `npm run db:massa` de novo.
Senha de todos: **`addegas123`**. Cada adega tem um dono (`<slug>@massa.test`) e um gerente com login
(`gerente.<slug>@massa.test`) em todas as lojas. No caixa, cada loja tem a própria equipe sem login: toca no nome.

| Dono | Adega | Lojas | Tamanho | Assinatura |
|---|---|---|---|---|
| `bomgole@massa.test` | Adega Bom Gole | Moema, Itaim Bibi, Vila Olímpia | grande: toda lista passa de 25 | ativa há 12 meses |
| `vilarica@massa.test` | Empório Vila Rica | Tatuapé, Anália Franco | grande | ativa há 10 meses |
| `paulista24@massa.test` | Adega 24h Paulista | Bela Vista, Consolação | grande | ativa há 8 meses |
| `copocheio@massa.test` | Adega Copo Cheio | Mooca, Belém | grande | ativa há 9 meses |
| `chico@massa.test` | Adega do Chico | Santana | média: fica perto de 25 | ativa há 7 meses |
| `butanta@massa.test` | Distribuidora Butantã | Butantã, Rio Pequeno | média | ativa há 4 meses |
| `lapagelada@massa.test` | Lapa Gelada | Lapa | média | ativa há 6 meses |
| `pontofrio@massa.test` | Adega Ponto Frio | Cambuí (Campinas) | pequena: listas abaixo de 25 | ativa há 5 meses |
| `santomalte@massa.test` | Santo Malte | Centro (Santo André) | pequena | **em carência** (fatura vencida) |
| `noitefeliz@massa.test` | Adega Noite Feliz | Centro (Guarulhos) | pequena | **em teste grátis** |

Na loja principal da Bom Gole: 166 produtos, 109 lotes com validade, 48 clientes no fiado, 30 pedidos abertos e 40
entregues, 34 fornecedores, 45 contas a pagar, 30 pedidos de compra, 41 itens na sugestão de compra, 32 combos e
promoções, 32 pessoas na equipe, 32 anotações, 32 tickets e 32 dias de caixa fechado. As lojas extras têm metade do volume.
No painel da equipe: cerca de 190 produtos no catálogo, 140 sugestões na fila, 70 contatos no CRM, 250 tickets, 80 faturas e
330 ocorrências do sistema.

## Painel da equipe Addegas (http://localhost:5173/admin/)

Senha de todos: **`addegas123`**. No primeiro acesso o painel mostra um QR code: escaneie com um aplicativo autenticador
(Google Authenticator, Microsoft Authenticator, 1Password) ou digite a chave que aparece embaixo. Depois, cada login pede
o código de 6 dígitos do aplicativo. A sessão cai depois de 30 minutos sem uso.

| Login | Perfil | O que vê |
|---|---|---|
| `admin@addegas.com.br` | Administrador mestre | Tudo, inclusive segurança, equipe e configurações |
| `caio@addegas.com.br` | Financeiro | Visão geral, adegas, planos, financeiro, descontos, mensagens |
| `lia@addegas.com.br` | Suporte | Visão geral, adegas, tickets, produtos, mensagens, monitoramento |
| `rafael@addegas.com.br` | Comercial e marketing | Visão geral, adegas, CRM, marketing, brindes, mapa, mensagens, descontos |
| `nina@addegas.com.br` | Analista | Visão geral, adegas, planos, financeiro, uso e funis, marketing, mapa (só leitura) |

Perdeu o celular do autenticador? No banco local, apague o fator e o painel pede um QR novo no próximo login:
`delete from auth.mfa_factors f using auth.users u where u.id = f.user_id and u.email = 'EMAIL';`
(no Studio, http://localhost:57323, em SQL Editor).

### Criados durante os testes (somem no próximo `db:reset`)

Nenhum no momento. O banco local foi recriado em 31/10/2026 (seed + massa), e os acessos e dados criados nos testes
anteriores (dono-teste, teste.prov, testeporte e os dados de teste do painel) saíram junto. O 2FA do
`admin@addegas.com.br` foi mantido: o mesmo código do aplicativo autenticador continua valendo.

## Caixa: quem opera

No aparelho de caixa, a pessoa toca no próprio nome e já entra; as vendas ficam no nome dela.

| Operador | Função | Loja |
|---|---|---|
| Marcos Silva | dono | Adega Esquina |
| Rafa Costa | gerente | Adega Esquina e Adega Esquina 2 |
| Bia Santos | caixa (só no caixa, sem login) | Adega Esquina |
| Léo Moura | caixa (só no caixa, sem login) | Adega Esquina e Adega Esquina 2 |
| Tati Rocha | estoquista (só no caixa, sem login) | Adega Esquina |
| Teste Porte | caixa (criado em teste) | Adega Esquina |

Desconto: cada função tem um limite (o dono ajusta em Equipe). Acima dele, quem tem limite maior faz a venda.

### Aparelhos de caixa

- Do seed: "Balcão 1" (Adega Esquina) e "Balcão Pinheiros" (Adega Esquina 2).
- Criados em teste: "Balcão Teste", "Bar Teste", "Caixa Teste Menus", "Caixa Teste Mesa" (todos na Adega Esquina).
- Para transformar o navegador em caixa: entre como dono ou gerente → Ajustes → "Usar este aparelho como caixa". Isso troca a sessão; para voltar, saia e entre de novo com o e-mail.

## Protótipo aprovado

| Tela | Acesso |
|---|---|
| Sistema (`index.html`) | Abre direto como Marcos. "Sair" leva ao login amarelo, que aceita qualquer e-mail e qualquer senha. |
| Admin (`admin.html`) | Um dos e-mails listados na tela, senha `addegas-demo`, código `482913` (dados fictícios; o painel de verdade é o de cima) |

## Pagamentos (Stripe, modo teste)

Conta de teste do Stripe ligada em 16/11/2026 (acct_1UaXaTLbBMxnpVY1). As chaves ficam fora do git: a secreta em
`supabase/functions/.env` (`STRIPE_SECRET_KEY`) e a publicável em `.env.local` (`VITE_STRIPE_PUBLISHABLE_KEY`).
`npm run stripe:sync` cria (ou confere) o produto, os 6 preços e o portal do cliente.

O pagamento é pelo checkout embutido, dentro da tela Assinatura do app (dono da adega → Assinatura).

- Cartão aprovado: `4242 4242 4242 4242`, validade futura qualquer, CVC qualquer.
- Cartão recusado: `4000 0000 0000 0002`.
- Pede confirmação do banco (3DS): `4000 0025 0000 3155`.
- Aprovado e depois contestado (chargeback): `4000 0000 0000 0259`.

Webhook na nuvem (16/11/2026): `we_1UcW7QLbBMxnpVY1uf9qjfQg`, apontando para
`https://sltaztpifjfiypeqhcdz.supabase.co/functions/v1/hooks-stripe` (projeto `addegas`), com os 20 eventos. O segredo
`whsec_` está só nos segredos das funções da nuvem. Esse projeto ainda não tem acessos de teste: o seed e a massa são só do local.

Webhook no local: sem o Stripe CLI, os eventos não chegam sozinhos. A tela já libera a assinatura na volta do
pagamento; para os demais (renovação, estorno, contestação), rode `stripe listen` (ver `npm run stripe:sync`).

Estado das adegas da massa depois dos testes de 16/11/2026 (somem no próximo `db:reset` + `db:massa`):

| Adega | Situação no Stripe de teste |
|---|---|
| Adega Noite Feliz | assinou pelo checkout embutido; estorno parcial de R$ 50; marcada para cancelar no fim do ciclo (16/12) |
| Adega Ponto Frio | assinatura num relógio de teste do Stripe, já renovada uma vez (período até 16/01/2027) |
| Adega Copo Cheio | cartão recusado: em carência até 21/11 |
| Distribuidora Butantã | banco pediu confirmação e ninguém confirmou: em carência até 21/11 |
| Adega do Chico | contestação aberta (prazo 24/11) e assinatura cancelada na hora: acesso suspenso |
