# E52 · Prontidão para produção

**Marco:** Transversal (antes do piloto e de novo antes do lançamento) | **Tamanho:** M | **Depende de:** M4, M6 | **Desbloqueia:** piloto e lançamento
**Origem:** **[novo]**: o documento não tem etapa de testes de carga, revisão de segurança nem runbook

## Objetivo
Entrar em produção sabendo quanto o sistema aguenta, o que fazer quando algo cair e sem brechas conhecidas.

## Entra
- **Revisão de segurança**: `supabase db advisors` limpo; teste automatizado que tenta, com token de cada tipo (pessoa de cada função, terminal, staff de cada perfil, anônimo), ler e escrever em **todas** as tabelas do `app` e chamar todas as RPCs; resultado comparado com a matriz esperada.
- **Teste de carga**: sexta-feira à noite simulada (ex.: 200 lojas, 2 terminais cada, 1 venda a cada 30 s por terminal, Início do dono aberto com tempo real) medindo p95 do `finalize_sale`, conexões do Realtime e CPU do banco. Escolher o tamanho de compute do Supabase com base nisso.
- **Runbook**: o que fazer em queda do Supabase, do gateway, do iFood, do WhatsApp; como suspender/reativar manualmente; como restaurar backup; contatos.
- **Status para o cliente**: mensagem no app quando houver incidente.
- **Piloto**: 1 a 3 adegas reais operando um fim de semana completo com acompanhamento, antes de abrir para todos.
- **Backup**: o dump diário (E02) rodando há pelo menos uma semana e uma restauração de teste feita.
- **Minutas jurídicas validadas por advogado** e dados da empresa preenchidos (E51).
- **Plano de corte do site estático**: o `index.html` atual continua no ar até o app novo ficar idêntico (instrução do `CLAUDE.md`). Definir como o usuário passa do protótipo para o app (domínio, redirecionamento, aviso).

## Critérios de aceite
- Matriz de acesso automatizada sem nenhuma divergência.
- p95 do `finalize_sale` < 300 ms na carga simulada.
- Runbook revisado por alguém que não escreveu o código.

## Riscos e atenção
- Lançar sem piloto num sistema de caixa é arriscado: o primeiro problema real vai acontecer numa sexta à noite.
