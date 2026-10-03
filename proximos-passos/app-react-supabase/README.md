# Addegas — front-end (Vite + React + TypeScript + Supabase)

Sistema de gestão para adegas de bairro: caixa (PDV), comandas, abertura/fechamento de caixa, estoque (entrada, contagem, validade), combos, pedidos dos apps (iFood, Zé Delivery, 99Food, Keeta) e WhatsApp, entrega própria, clientes e fiado, compras/fornecedores, contas a pagar, relatórios, equipe/permissões, alertas no WhatsApp e várias lojas por conta.

> **Fase 2 — fora do deploy.** A referência visual e de comportamento é o `index.html` na raiz do repositório (o front-end publicado). Esta pasta é o ponto de partida do sistema real com banco de dados; ainda não tem as telas portadas. Primeiro passo: `npm install && npm run build`. O CI em `.github/` só passa a rodar quando esta pasta virar a raiz do repositório.

## Stack
- **Vite + React 19 + TypeScript** (SPA, PWA instalável no celular)
- **React Router** para rotas, **TanStack Query** para dados do Supabase
- **Tailwind CSS v4** com os tokens da marca em `src/styles/tokens.css`
- **Supabase**: Auth (e-mail/senha), Postgres com RLS multi-loja, Realtime (pedidos e vendas ao vivo), Edge Functions (webhooks dos apps e WhatsApp)
- **Vercel** para deploy (`vercel.json` já trata as rotas da SPA)

## Rodar local
```bash
npm install
cp .env.example .env.local      # preencha com as chaves do seu projeto Supabase
npm run dev
```

## Supabase
```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push            # aplica supabase/migrations
npm run db:types                # gera src/types/database.ts
```
- Toda tabela de negócio tem `store_id`. As políticas RLS liberam acesso só para membros da loja (`store_members`); contas a pagar, equipe e permissões só para dono/gerente.
- Realtime está habilitado em `orders`, `sales` e `cash_sessions` para a tela Início do dono atualizar ao vivo.
- Baixa de estoque (inclusive itens de combo) e saldo do fiado são feitos por triggers no banco — o front só insere a venda.

## Git + Vercel
```bash
git init && git add . && git commit -m "Addegas: base do front-end"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/addegas-app.git
git push -u origin main
```
Na Vercel: **Add New → Project → importar o repositório**. Framework: Vite. Build: `npm run build`. Output: `dist`. Em *Environment Variables* cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Production e Preview). Cada PR ganha um preview automático; o CI em `.github/workflows/ci.yml` roda typecheck e build.

## Estrutura
```
src/
  app/            App.tsx (rotas), AppShell (sidebar desktop / rail tablet / abas no celular)
  features/       uma pasta por módulo: caixa, pedidos, estoque, combos, clientes, compras, relatorios, equipe, whatsapp, ajustes, auth
  lib/            supabase.ts, auth.tsx, format.ts
  styles/         tokens.css (cores, tipografia, raios)
  types/          database.ts (gerado pelo Supabase CLI)
supabase/
  migrations/     schema + RLS + triggers
  seed.sql        dados de exemplo (adega, produtos, combos)
public/           manifest.webmanifest + ícones do app
```

## Responsivo (regras do protótipo)
- **≥ 1180px** (computador): sidebar com grupos Operação / Gestão / Análise / Configurar.
- **720–1179px** (tablet da adega): rail de ícones com 7 destinos + "Mais". No caixa, venda fixa à direita (340px).
- **< 720px** (celular, foco no dono): barra de abas Início · Pedidos · Vender · Relatórios · Mais; folhas de baixo para cima no lugar de modais; no caixa, barra amarela "Ver venda" acima das abas.
- Alvos de toque ≥ 44px; números com `font-variant-numeric: tabular-nums`.

## Atalhos do caixa (desktop)
`/` busca · `Enter` adiciona o primeiro resultado (ou o código de barras exato) · `F2` cobrar · `Enter` confirma pagamento · `Esc` fecha.

## Tokens
| Token | Valor |
|---|---|
| Amarelo Addegas | #FBC009 |
| Fundo | #0A0A0B · sidebar #060607 |
| Superfície | #141416 · elevada #1C1C1F |
| Borda | #232327 / #2A2A2E |
| Texto | #F5F5F2 · secundário #A1A1A6 · terciário #8A8A90 |
| Sucesso / Erro / Info | #4ADE80 / #FF6B5E / #7CB3FF |
| Fonte | Archivo (wdth 62–125, wght 100–900). Títulos 800–900 com font-stretch 112–118% |
| Raios | 8 · 10 · 12 · 14 · 16 · 24 (folha no celular) |

## Próximos passos
1. Implementar `features/caixa` a partir do protótipo (é a tela mais usada).
2. Edge Functions: `orders-webhook` (iFood, Zé Delivery, 99Food, Keeta → `orders`) e `whatsapp-alerts` (fechamento de caixa, estoque baixo, pedido atrasado).
3. Emissão de NFC-e (não incluída nesta versão).
