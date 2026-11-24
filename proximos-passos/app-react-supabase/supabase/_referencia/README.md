# Material de referência (não é aplicado)

O Supabase só aplica o que está em `supabase/migrations/` e `supabase/seed.sql`. Esta pasta guarda o rascunho anterior da fase 2, para consulta:

| Arquivo | O que é |
| --- | --- |
| `20261001000000_init.sql` | Primeiro rascunho do schema (lojas, produtos, vendas, fiado, RLS por loja) |
| `seed-antigo.sql` | Dados de exemplo desse rascunho |

**Não reaproveite como está.** A seção 3 de `planejamento/analise-critica.md` lista os defeitos:
- qualquer usuário cria lojas sem limite;
- dá para ligar um item de uma loja a uma venda de outra;
- os helpers `security definer` ficam no schema `public`;
- o cancelamento não devolve estoque;
- dinheiro em `numeric` e número de venda global.

O schema novo nasce entrega por entrega, a partir da E03 (`planejamento/entregas/`).
