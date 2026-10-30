# Acessos de teste

Só valem no ambiente local (Supabase local + `npm run dev`). Nada daqui existe no dev nem na produção.
O `npm run db:reset` recria os acessos do seed; os criados durante os testes somem.

> Atualizado em 30/10/2026. Todo acesso novo criado em teste entra aqui.

## Endereços

| O quê | Endereço |
|---|---|
| App novo | http://localhost:5173 |
| Protótipo aprovado (`index.html`) | http://localhost:5500 |
| Protótipo do Admin (`admin.html`) | http://localhost:5500/admin |
| Supabase Studio | http://localhost:57323 |
| Mailpit (e-mails do Auth: confirmação, troca de senha) | http://localhost:57324 |
| API do Supabase | http://127.0.0.1:57321 |
| Banco | `postgresql://postgres:postgres@127.0.0.1:57322/postgres` |

## App novo: quem entra com e-mail ou usuário

Senha de todos do seed: **`addegas123`**

| Login | Quem é | Loja | PIN do caixa |
|---|---|---|---|
| `marcos@adega.test` | Marcos Silva, dono | Adega Esquina e Adega Esquina 2 | 1937 |
| `rafa@adega.test` | Rafa Costa, gerente | Adega Esquina e Adega Esquina 2 | 6142 |
| `diego@adega-esquina` | Diego Alves, entregador | Adega Esquina | — |
| `kaua@adega-esquina` | Kauã Lima, entregador | Adega Esquina | — |
| `joana@porto.test` | Joana Prado, dona de outra conta (em carência) | Adega do Porto | — |
| `admin@addegas.com.br` | Equipe Addegas, perfil master | — | — |

- Entregador e funcionário com usuário entram como `usuario@slug-da-loja`.
- Joana serve para testar isolamento: ela não pode ver nada da Adega Esquina.
- `admin@addegas.com.br` é da equipe Addegas, não de uma adega: no app da adega ele só vê o aviso de que o lugar dele é o painel interno. O painel (etapa 12) ainda não existe no app novo; até lá, use o protótipo do Admin (abaixo). O 2FA será pedido no primeiro acesso ao painel.

### Criados durante os testes (somem no próximo `db:reset`)

| Login | Senha | Quem é |
|---|---|---|
| `dono-teste@adega.test` | `cadastro2026` | Dono Teste, dono da "Adega do Teste" (criada pelo cadastro) |
| `teste.prov@adega-esquina` | `novasenha123` | Teste Provisório, caixa na Adega Esquina |
| `testeporte@adega-esquina` | desconhecida (provisória) | Teste Login, caixa **desativado** na Adega Esquina |

## Caixa: operadores com PIN

No aparelho de caixa, o operador escolhe o nome e digita o PIN.

| Operador | Função | Loja | PIN |
|---|---|---|---|
| Marcos Silva | dono | Adega Esquina | 1937 |
| Rafa Costa | gerente | Adega Esquina e Adega Esquina 2 | 6142 |
| Bia Santos | caixa | Adega Esquina | 4821 |
| Léo Moura | caixa | Adega Esquina e Adega Esquina 2 | 7350 |
| Tati Rocha | estoquista | Adega Esquina | 5820 |
| Teste Porte | caixa (criado em teste) | Adega Esquina | 3851 |

### Aparelhos de caixa

- Do seed: "Balcão 1" (Adega Esquina) e "Balcão Pinheiros" (Adega Esquina 2).
- Criados em teste: "Balcão Teste", "Bar Teste", "Caixa Teste Menus", "Caixa Teste Mesa" (todos na Adega Esquina).
- Para transformar o navegador em caixa: entre como dono ou gerente → Ajustes → "Usar este aparelho como caixa". Isso troca a sessão; para voltar, saia e entre de novo com o e-mail.

## Protótipo aprovado

| Tela | Acesso |
|---|---|
| Sistema (`index.html`) | Abre direto como Marcos. "Sair" leva ao login amarelo, que aceita qualquer e-mail e qualquer senha. |
| Admin (`admin.html`) | Um dos e-mails listados na tela, senha `addegas-demo`, código `482913` |

## Pagamentos (Stripe, modo teste)

Só funciona depois de colocar as chaves de teste em `supabase/functions/.env` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).

- Cartão aprovado: `4242 4242 4242 4242`, validade futura qualquer, CVC qualquer.
- Cartão recusado: `4000 0000 0000 0002`.
