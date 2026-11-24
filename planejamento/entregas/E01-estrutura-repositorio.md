# E01 · Estrutura do repositório do back-end e ambiente local

> ✅ **Concluída em 28/10/2026.** Resultado:
> - `supabase/config.toml` com projeto `addegas`, portas 573xx (as 543xx e 553xx são do lava-facil e do nexum-pro; o Windows reserva 56245–56444), `site_url` do Vite e confirmação de e-mail ligada;
> - `supabase/seed.sql` inicial, `supabase/tests/database/000_fumaca.test.sql` (pgTAP) e `supabase/README.md` (fluxo, convenções, catálogo de erros);
> - rascunho antigo arquivado em `supabase/_referencia/`, fora das migrations;
> - CLI do Supabase fixa (2.122.0) como dependência, scripts `db:*` no `package.json`, `package-lock.json` gerado (o CI usava `npm ci` sem lockfile e falharia);
> - job `banco` no CI (sobe o Postgres, lint e testes).
>
> Verificado: `db:start`, `db:reset`, `db:test` (3/3), `db:lint` (sem erros), `db:types`, `typecheck` e `build` passam. Ficou para a E54: o `vite-plugin-pwa` está em `generateSW` e passa para `injectManifest`.

**Marco:** M1 · Fundação | **Tamanho:** P | **Depende de:** E00 (`D35`) | **Desbloqueia:** E02, E03
**Origem:** §2 ("migrations versionadas no repositório")

## Objetivo
Ter um lugar único e versionado para migrations, funções, testes e seed, que qualquer pessoa sobe na própria máquina com um comando.

## Entra
- Definir onde o back-end mora (`D35`). Recomendação: o mesmo repositório do app da fase 2, com `supabase/` na raiz do app, porque tipos gerados e migrations andam juntos.
- Estrutura proposta:
  ```
  supabase/
    config.toml            schemas expostos, auth, storage, captcha (local)
    migrations/            uma por mudança, nome com timestamp
    functions/             admin-api, hooks-*, cron-*, _shared/ (cors, correlation-id, erros, auth)
    tests/database/        pgTAP: rls_*.test.sql, rpc_*.test.sql
    seed.sql               dados de exemplo iguais aos do index.html (Adega Esquina, Marcos)
  ```
- `supabase start` sobe Postgres, Auth, Storage, Realtime e funções localmente.
- `seed.sql` reproduzindo os dados de demonstração do `index.html`, para o front novo poder ser comparado com o atual tela a tela.
- Scripts no `package.json` do app: `db:reset`, `db:test`, `db:types`, `db:lint`, `functions:serve`.
- Arquivo `supabase/README.md` curto com o fluxo: criar migration, rodar teste, gerar tipos.

## Não entra
- Projetos remotos (E02) e conteúdo das migrations (E03 em diante).
- Mexer na raiz publicada hoje (`index.html`, `support.js` etc.). A regra do `CLAUDE.md` continua valendo.

## Critérios de aceite
- Em máquina limpa: `supabase start && supabase db reset && supabase test db` passa.
- `supabase gen types typescript --local` gera o arquivo de tipos sem erro.

## Riscos e atenção
- Criar `package.json` na **raiz** do repositório publicado faz a Vercel tentar build (aviso do `CLAUDE.md`). Tudo do back-end fica dentro da pasta do app ou em repositório próprio.
- A migration atual (`20261001000000_init.sql`) **não** deve ser reaproveitada como está; ver seção 3 da [análise crítica](../analise-critica.md). Recomendo arquivá-la como referência e começar a sequência nova.
