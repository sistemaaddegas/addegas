# Acessos de teste

Só valem no ambiente local (Supabase local + `npm run dev`). Nada daqui existe no dev nem na produção.
O `npm run db:reset` recria os acessos do seed; os criados durante os testes somem.

> Atualizado em 30/10/2026 (painel da equipe). Todo acesso novo criado em teste entra aqui.

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

| Login | Senha | Quem é |
|---|---|---|
| `dono-teste@adega.test` | `cadastro2026` | Dono Teste, dono da "Adega do Teste" (criada pelo cadastro) |
| `teste.prov@adega-esquina` | `novasenha123` | Teste Provisório, caixa na Adega Esquina |
| `testeporte@adega-esquina` | desconhecida (provisória) | Teste Login, caixa **desativado** na Adega Esquina |

Dados de teste do painel que ficaram no banco: lead "Adega Teste Painel", produto "Cerveja Teste Painel 350 ml" (arquivado),
funil "Caixa do dia", melhoria "Melhoria criada no teste", desconto de R$ 20 para a Adega do Porto, acesso temporário da
Adega do Porto por 3 dias e o alerta "Latência alta da API" ligado.

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

Só funciona depois de colocar as chaves de teste em `supabase/functions/.env` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).

- Cartão aprovado: `4242 4242 4242 4242`, validade futura qualquer, CVC qualquer.
- Cartão recusado: `4000 0000 0000 0002`.
