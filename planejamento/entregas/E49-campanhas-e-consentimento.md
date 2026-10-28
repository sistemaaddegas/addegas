# E49 · Marketing, central de mensagens e consentimento

**Marco:** M9 · Crescimento | **Tamanho:** M | **Depende de:** E35, E45, E48 | **Desbloqueia:** —
**Origem:** §1 ("Investimento por canal", "templates com variáveis e consentimento"), §8 ("aviso de serviço sempre pode ser enviado; campanha só para quem aceitou")

## Objetivo
Enviar mensagens para adegas respeitando o tipo (serviço x promoção) e o consentimento, e medir o retorno do investimento por canal.

## Entra
- `platform.message_templates` (tipo `servico`/`promocional`, canal, texto com variáveis), `message_sends`, `message_recipients` (com status por destinatário).
- `platform.consents` (account/pessoa, finalidade `promocional`, canal, aceito em, origem, revogado em). Envio promocional **bloqueado no servidor** sem consentimento ativo; aviso de serviço sempre liberado.
- Descadastro em um clique (link no e-mail, palavra "SAIR" no WhatsApp quando possível).
- `platform.campaigns` e `platform.marketing_spend` (canal, período, valor, manual ou importado); custo de aquisição e receita atribuída nos 3 primeiros meses (regra do admin).

## Critérios de aceite
- Teste: campanha promocional para 100 adegas, 30 sem consentimento → 70 envios.
- Teste: descadastro bloqueia o próximo envio promocional imediatamente.

## Riscos e atenção
- Mensagem promocional em massa pelo WhatsApp não oficial é o caminho mais rápido para bloqueio do número (`D22`).
