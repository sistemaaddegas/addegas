# E01 · Estrutura do repositório do back-end e ambiente local

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
