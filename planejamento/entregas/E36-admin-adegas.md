# E36 · Admin: adegas, ficha e ações administrativas

**Marco:** M7 · Painel Addegas | **Tamanho:** G | **Depende de:** E14, E33, `D27` | **Desbloqueia:** E37, E40
**Origem:** §1 ("Ficha da adega com 8 abas"), §4 (ações por perfil), §8 ("acesso temporário")

## Objetivo
A equipe encontra qualquer adega, entende a situação dela numa tela e age (com motivo e auditoria) sem tocar no banco.

## Entra
- Lista de adegas com filtros (status de assinatura, acesso, plano, cidade, origem, responsável, uso baixo) e busca; paginação por cursor.
- Ficha da adega: dados da conta e lojas, assinatura e acesso, faturas, uso, tickets, anotações internas, mensagens enviadas, histórico de auditoria. (Conferir as 8 abas exatas no `admin.html` ao portar a tela.)
- `platform.account_notes` (anotações internas da equipe, nunca visíveis à adega).
- Ações via `admin-api`, cada uma com motivo obrigatório e prévia "antes → depois" (o front já mostra essa prévia):
  | Ação | Perfis | Efeito |
  | --- | --- | --- |
  | Estender teste (3, 7 ou 14 dias) | Mestre, Comercial | `trial_ends_at` + N |
  | Suspender / reativar acesso | Mestre, Financeiro | acesso `suspended`/`allowed` |
  | Trocar ciclo (mensal, semestral, anual) | Mestre, Financeiro | muda o preço no Stripe (E34) |
  | Ajustar lojas adicionais | Mestre, Financeiro | quantidade no Stripe; arquivar loja ao reduzir |
  | Acesso temporário | Mestre, Suporte | `temp_access_until` (não quita, não reinicia carência) |
  | Anotação interna | Mestre, Suporte, Comercial | linha em `account_notes` |
- **Acesso temporário x "entrar na conta da adega" (D27, decidido)**: são coisas diferentes. "Acesso temporário" libera uma conta suspensa por alguns dias. No "diagnóstico", o suporte **não** se autentica como a adega; ele vê dados de diagnóstico pela `admin-api` (somente leitura, campos selecionados), e cada visualização de dado da adega é auditada. Impersonação só com consentimento registrado do dono e por tempo limitado.

## Não entra
- Financeiro detalhado (E37), tickets (E38), métricas da visão geral (E40).

## Critérios de aceite
- Teste: Analista tenta suspender → 403 e auditoria.
- Teste: suspender sem motivo → 422.
- Teste: estender teste de conta já `active` → recusado.
- Toda ação aparece no histórico da ficha com autor, data, motivo, antes e depois.

## Riscos e atenção
- A ficha junta dados de 5 schemas; montar por funções de leitura específicas, não por consulta livre com `service_role`.
