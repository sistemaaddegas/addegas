# E23 · Fiado com nome e telefone

**Marco:** M4 · Núcleo | **Tamanho:** P | **Depende de:** E20 | **Desbloqueia:** —
**Origem:** §1 ("saldo de fiado com data de pagamento"), §5 (`customers`, `customer_ledger`), §7 ("Dados e LGPD")
**Decisões aplicadas:** D19 (sem cadastro nem burocracia), D55 (**nome e telefone**), D16 (sem juros e sem WhatsApp), D55b (limite opcional, desligado por padrão)

## Objetivo
Vender fiado com o nome e o telefone de quem leva, saber quanto cada um deve e dar baixa nos pagamentos, com o saldo sempre derivado do livro-razão. Sem tela de cadastro de cliente.

## Entra
- `app.fiado_accounts` (store_id, nome como digitado, nome normalizado, **telefone** (só dígitos, com DDD), data prometida opcional, observação opcional, limite opcional, ativo, `unique (store_id, telefone)`). Nasce **na própria venda**: não existe tela de cadastro.
- Na venda (E20), o campo "Fiado para quem?":
  1. o operador digita o telefone **ou** o nome; o sistema busca nos fiados da loja (telefone exato ou nome por trigram, sem acento);
  2. achou → escolhe e segue;
  3. não achou → dois campos na mesma tela, **nome e telefone**, os dois obrigatórios, e a venda segue. Leva segundos, sem formulário à parte.
- O telefone é a chave contra duplicata: dois "Zé" com telefones diferentes são duas pessoas; o mesmo telefone digitado com outro nome sugere o fiado existente.
- `app.fiado_ledger` (só inserção): `fiado_sale` (+), `payment` (−), `adjustment` (±, com motivo, só dono ou gerente), `sale_cancel` (−); com sale_id, forma do pagamento e operador.
- Saldo mantido por trigger do ledger; nunca editável.
- RPC `app.receive_fiado_payment(fiado_account_id, valor, forma, operator_session_id)`: pagamento parcial ou total; se em dinheiro, entra no caixa (E19).
- Lista "quem deve": nome, telefone (com botão de **ligar**), saldo, última compra, data prometida, ordenada por atraso.
- Mesclar dois fiados que são a mesma pessoa: dono ou gerente, move os lançamentos e registra auditoria.
- Limite (D55b): opcional por pessoa, desligado por padrão; quando definido, o `finalize_sale` recusa com `SALE_FIADO_LIMIT`.

## Não entra
- Juros, multa, cobrança automática ou mensagem de WhatsApp pelo sistema (D16). O telefone serve para a loja **ligar ou chamar pelo próprio celular**, por fora do sistema.
- CPF, endereço ou qualquer outro dado (D19).

## Regras
- O fiado é da **loja**, não da conta: o mesmo telefone pode ter fiado na Loja 1 e na Loja 2, com saldos separados.
- Quem vê o telefone: dono, gerente e quem tem `fiado`. Na tela do terminal, o telefone aparece mascarado (`(11) 9••••-5103`) até alguém com permissão tocar em "mostrar".
- Nome e telefone são dados pessoais de terceiros: a adega é a controladora (Acordo de Tratamento de Dados). Mascarados em logs (E05), anonimizados na exclusão da conta ou a pedido (E51).
- Fiado quitado e sem movimento há 6 meses: o telefone é anonimizado automaticamente (minimização, D25); o nome e o histórico de valores ficam.

## Critérios de aceite
- Teste: venda fiado com telefone novo exige nome e telefone; sem um dos dois → recusada.
- Teste: segunda venda com o mesmo telefone (nome escrito diferente) usa o mesmo fiado.
- Teste: pagamento parcial reduz o saldo; saldo = soma do ledger em 1.000 lançamentos aleatórios.
- Teste: mesclar dois fiados soma os saldos e mantém todo o histórico.
- Teste: caixa sem a permissão `fiado` não vende fiado e não vê telefones.
- Teste: fiado quitado há 6 meses e 1 dia tem o telefone anonimizado pela rotina noturna.

## Riscos e atenção
- Telefone digitado errado vira duplicata. Validar o formato brasileiro (DDD + 8 ou 9 dígitos) e mostrar o nome já cadastrado quando o telefone existir.
