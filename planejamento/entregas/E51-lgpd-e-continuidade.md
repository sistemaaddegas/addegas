# E51 · LGPD, termos, exportação e exclusão de conta, backups

**Marco:** Transversal (antes do primeiro cliente pagante) | **Tamanho:** M | **Depende de:** E13, E15, E33, `D25`, `D50` | **Desbloqueia:** lançamento
**Origem:** §7 ("Dados e LGPD": controladora x operador, consentimento, exportação e exclusão, backup com recuperação por ponto no tempo)

## Objetivo
Cumprir a LGPD como operador dos dados das adegas e como controlador dos dados dos próprios clientes, e conseguir recuperar o banco se algo der errado.

**Decisões aplicadas:** D25 (6 meses após o fim do acesso), D26 (logs de segurança 180 dias), D50 (minutas feitas, validar com advogado)

## Entra
- Documentos (D50): **primeira versão pronta** em [../juridico/](../juridico/): termos de uso, política de privacidade e acordo de tratamento de dados (DPA). Falta validar com advogado e preencher os dados da empresa. Aceite registrado com versão e data no cadastro (E06): `platform.legal_acceptances (user_id, account_id, documento, versão, aceito_em, ip)`.
- Exportação dos dados da conta (pedido do dono): função que gera arquivo com vendas, produtos, clientes, fiado, contas; entregue por URL assinada (E15).
- Exclusão de conta (`D25`):
  - pedido do dono com confirmação por e-mail e prazo de arrependimento;
  - apagar dados operacionais e arquivos (`app.files`), anonimizar o que precisa ficar por obrigação legal (faturas do Addegas) e na auditoria (E13);
  - prazo de retenção para contas `expired`/`canceled` sem pedido de exclusão: **6 meses** após o fim do acesso (D25), com aviso por WhatsApp/e-mail 30 dias antes; depois, exclusão dos dados operacionais e anonimização do que precisa ficar;
  - ficam por obrigação legal: faturas e pagamentos do Addegas (5 anos, fiscal) e registros de acesso (6 meses, Marco Civil art. 15).
- Pedido de titular (cliente final da adega pede exclusão): a adega é controladora; o Addegas oferece a ferramenta (apagar ou anonimizar cliente na loja).
- Encarregado (DPO) indicado e canal de contato.
- Backups: o `supabase db dump` diário da E02, guardado fora do Supabase. **Teste de restauração** trimestral, com tempo medido (RTO) e perda máxima (RPO) anotados.
- Pedido de titular sobre fiado: o fiado guarda só nome e telefone (D19, D55); a ferramenta é "anonimizar esta pessoa" na lista de fiado, para dono ou gerente.

## Critérios de aceite
- Teste: exclusão de conta não deixa linha com nome ou telefone de cliente final em nenhum schema.
- Restauração de teste concluída e documentada.

## Riscos e atenção
- "Mantém os dados" na suspensão (§1) é bom para o cliente, mas precisa de prazo final; dados guardados para sempre são risco e custo.
