# E35 · E-mails transacionais e avisos de cobrança

**Marco:** M6 · Assinatura | **Tamanho:** P | **Depende de:** E33, `D31` | **Desbloqueia:** E49
**Origem:** §8 ("Resend: confirmação de conta, recuperação de senha, faturas e avisos de cobrança"; "aviso de serviço sempre pode ser enviado")
**Decisões aplicadas:** D31 e D56 (domínio `addegas.com.br`; envio por `mail.addegas.com.br`, ver [../dominio-e-email.md](../dominio-e-email.md)), D61 (recebimento de respostas: estrutura pronta, você configura depois), D49 (avisos de cobrança também por WhatsApp, E45), D20 (e-mail "Seu acesso ao Addegas" para funcionários, E07)

> **Pode começar já:** a configuração do domínio de envio (registros 3 a 6 de [../dominio-e-email.md](../dominio-e-email.md)) não depende de código.

## Objetivo
E-mails de conta e de cobrança chegam na caixa de entrada, com a marca do Addegas, e nunca duplicados.

## Entra
- Domínio de envio `mail.addegas.com.br` com SPF, DKIM e DMARC configurados no DNS do Registro.br.
- Remetente `naoresponda@mail.addegas.com.br`; `reply-to` dos avisos de cobrança em `financeiro@addegas.com.br` (recebe pelo redirecionamento, D61).
- Módulo `_shared/email.ts` lendo `EMAIL_FROM`, `EMAIL_ENABLED` e `RESEND_API_KEY`: nenhum endereço escrito no código.
- SMTP próprio no Supabase Auth apontando para o Resend (confirmação de cadastro, recuperação de senha, "Seu acesso ao Addegas" para funcionários da E07), com templates em português.
- Fila `platform.billing_queue` / mensagens (pgmq ou `for update skip locked`, §9), processada a cada minuto, que **reconfere a condição antes de enviar** (§8): não manda "sua carência começou" se a fatura foi paga 2 minutos antes.
- Templates de serviço (os do admin: T4 "início da carência", T5 "faltam 24 horas", fatura disponível, pagamento confirmado, teste acabando em 3 dias e em 1 dia, acesso suspenso, cancelamento agendado).
- `platform.message_sends` com status, id do provedor, tentativas; webhook do Resend para entregue/devolvido/marcado como spam.

## Não entra
- Campanhas promocionais (E49) e WhatsApp (E45).

## Critérios de aceite
- Teste: envio repetido do mesmo aviso para a mesma fatura → 1 envio (chave de idempotência por tipo + fatura).
- Teste: aviso de carência na fila, fatura paga antes do envio → aviso descartado.
- E-mail de teste com nota ≥ 9 no mail-tester (ou equivalente).

## Riscos e atenção
- O SMTP padrão do Supabase tem limite baixíssimo e não serve para produção.
