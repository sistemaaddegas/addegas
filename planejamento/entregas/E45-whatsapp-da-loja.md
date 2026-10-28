# E45 · WhatsApp do Addegas: alertas ao dono e avisos de cobrança

**Marco:** M8 · Integrações (pode vir logo depois da E31 e da E33) | **Tamanho:** M | **Depende de:** E31, E33 | **Desbloqueia:** E49
**Origem:** §8 ("W-API: alertas da loja, convites da equipe, cobrança de fiado e mensagens da central do admin"); tela "WhatsApp" em Configurar
**Decisões aplicadas:** D22 (número do Addegas; nada de mensagem da loja para o cliente final), D16 (sem cobrança de fiado), D20 (sem convite por WhatsApp), D49 (avisos de cobrança da assinatura também por WhatsApp), D32 (W-API, paga), D56 (com domínio, o e-mail vira o canal de reserva)

## Objetivo
O dono recebe no WhatsApp o que precisa saber da loja e da assinatura, sempre de um número do Addegas e só para quem conhece o remetente.

## Escopo reduzido pelas decisões
| Mensagem | Situação |
| --- | --- |
| Alertas da loja ao dono (estoque baixo, validade, pedido atrasado, resumo do fechamento, diferença de caixa) | **Entra** |
| Avisos de cobrança da assinatura ao dono (teste acabando, carência, 24 h antes da suspensão, suspensão, pagamento confirmado) | **Entra** (D49) |
| Convite ou login de funcionário | Sai (D20: o dono entrega o login) |
| Cobrança de fiado ao cliente final | Sai (D16, D22) |
| Campanhas promocionais | Só na E49, com consentimento |

## Entra
- Integração W-API: uma instância (número) para alertas e avisos. Segredo nas funções; estado da sessão monitorado (desconectada = alerta para a equipe e fallback por e-mail quando houver domínio).
- Destinatários: WhatsApp do dono (cadastro, E06) e outros números que o dono adicionar em Ajustes (E31), cada um confirmado com um código de verificação (evita mandar para número errado e serve como opt-in).
- Fila (mesma estrutura da E35), com **reconferência da condição antes de enviar** (§8), horário silencioso por loja e limite de mensagens por número por minuto.
- Templates com variáveis (`{nome_adega}`, `{valor}`, `{vencimento}`, `{link_regularizacao}`), no mesmo formato dos templates do admin (T4, T5).
- `platform.message_sends` com status (enviado, entregue, lido, falhou) quando a W-API informar.
- Resposta "SAIR" desliga os alertas daquele número (e avisa que os avisos de cobrança continuam por serem de serviço).

## Critérios de aceite
- Teste: alerta de estoque baixo gera 1 mensagem por produto por dia, nunca dentro do horário silencioso.
- Teste: aviso de carência na fila, fatura paga antes do envio → aviso descartado.
- Teste: número não confirmado não recebe nada.

## Riscos e atenção
- Mesmo com volume baixo, a W-API é não oficial. Se o número for bloqueado, todos os alertas param: ter um segundo número reserva configurado e um painel de saúde da instância.
- Os avisos de cobrança saem pelos dois canais (WhatsApp e e-mail, E35). A rotina das 9h (E33) não deve suspender quem não teve nenhum aviso entregue em nenhum dos dois (regra de proteção, a validar).
