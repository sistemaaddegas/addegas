# Acordo de Tratamento de Dados Pessoais (DPA)

**Versão 0.1 (minuta para revisão jurídica) · Anexo aos Termos de Uso do Addegas · [DATA DE VIGÊNCIA]**

Este Acordo complementa os [Termos de Uso](termos-de-uso.md) e regula o tratamento de dados pessoais feito pelo Addegas em nome do Cliente.

**Partes**
- **Controlador:** o Cliente identificado no cadastro do Addegas ("Cliente" ou "Controlador").
- **Operador:** **[RAZÃO SOCIAL]**, CNPJ **[CNPJ]** ("Addegas" ou "Operador").

Termos como "dado pessoal", "tratamento", "titular", "controlador", "operador", "incidente de segurança" e "ANPD" têm o significado da LGPD (Lei nº 13.709/2018).

## 1. Objeto
1.1. O Operador trata dados pessoais em nome do Controlador **exclusivamente** para prestar o serviço do Sistema Addegas contratado nos Termos.

1.2. **Dados e titulares envolvidos:**
| Titulares | Dados | Finalidade |
| --- | --- | --- |
| Funcionários e colaboradores do Cliente | nome, e-mail ou nome de usuário, função, PIN (guardado só como hash), registros de ações no sistema (vendas, sangrias, fechamentos) | Controle de acesso, permissões e rastreio das operações da loja |
| Pessoas que compram fiado | nome, telefone, valores comprados e pagos, data prometida de pagamento | Controle do crédito concedido pelo Cliente e contato para cobrança feito pelo próprio Cliente, fora do Sistema |
| Destinatários de pedidos de entrega | nome, telefone, endereço de entrega | Entrega do pedido |
| Fornecedores do Cliente (pessoas físicas, quando houver) | nome, telefone ou WhatsApp | Compras e contas a pagar |

1.3. O Sistema **não** foi feito para guardar dados sensíveis, documentos de identidade, CPF ou dados de cartão de terceiros. O Cliente se compromete a não inseri-los em campos livres (observações, anotações).

## 2. Obrigações do Controlador (Cliente)
O Cliente:
- a) define as finalidades do tratamento e garante que tem **base legal** para tratar os dados que insere no Sistema (por exemplo, execução de contrato com o funcionário; exercício regular do direito de crédito no fiado; execução do pedido de entrega);
- b) informa os titulares sobre o tratamento, quando a lei exigir;
- c) atende os pedidos dos titulares, com o apoio do Operador (item 6);
- d) cadastra, dá permissões e desativa seus Usuários, sendo responsável pelos acessos que conceder;
- e) não usa o Sistema para enviar comunicações não solicitadas aos titulares.

## 3. Obrigações do Operador (Addegas)
O Addegas:
- a) trata os dados **apenas conforme as instruções documentadas** do Cliente, que consistem nestes Termos, neste Acordo e nas configurações e ações feitas pelo Cliente no Sistema; avisará o Cliente se considerar uma instrução contrária à lei;
- b) não usa os dados do Cliente para finalidade própria, salvo estatísticas **agregadas e anonimizadas** que não identifiquem o Cliente nem os titulares;
- c) não vende, aluga nem cede os dados a terceiros;
- d) garante que sua equipe com acesso aos dados está sujeita a **confidencialidade** e só acessa o necessário para suporte e manutenção, com registro de cada acesso;
- e) mantém registro das operações de tratamento (LGPD, art. 37).

## 4. Segurança
4.1. O Operador adota medidas técnicas e administrativas aptas a proteger os dados (LGPD, art. 46), incluindo:
- isolamento dos dados de cada Cliente no banco de dados, com regras de acesso conferidas no servidor a cada operação;
- criptografia em trânsito (HTTPS) e, nos provedores, em repouso;
- senhas e PINs guardados apenas como hash; bloqueio após tentativas erradas;
- verificação em duas etapas obrigatória para a equipe do Operador;
- trilhas de auditoria que não podem ser alteradas, incluindo tentativas negadas;
- mascaramento de dados pessoais nos registros técnicos;
- cópias de segurança e testes periódicos de restauração;
- revisão de segurança antes de cada mudança relevante no banco de dados.

4.2. Detalhes técnicos adicionais podem ser fornecidos ao Cliente mediante pedido, sem expor informações que comprometam a segurança.

## 5. Suboperadores
5.1. O Cliente autoriza o Operador a contratar os suboperadores listados na [Política de Privacidade](politica-de-privacidade.md) (infraestrutura, banco de dados, hospedagem, envio de e-mails e mensagens, verificação anti-robô).

5.2. O Operador exige dos suboperadores obrigações de proteção de dados equivalentes às deste Acordo e responde perante o Cliente pelos atos deles, nos termos da lei.

5.3. A inclusão ou troca de suboperador será informada com pelo menos **15 dias** de antecedência. O Cliente pode se opor por motivo razoável ligado à proteção de dados; se não houver solução, pode cancelar a Assinatura sem multa.

## 6. Direitos dos titulares
6.1. Se o Operador receber diretamente um pedido de titular relativo a dados do Cliente, encaminhará ao Cliente em até **5 dias úteis** e não responderá no lugar dele, salvo instrução.

6.2. O Sistema oferece ferramentas para o Cliente atender pedidos: exportação dos dados da Conta, correção, anonimização de uma pessoa no fiado e exclusão de Usuários. O telefone de fiado quitado e sem movimento há 6 meses é anonimizado automaticamente.

## 7. Incidentes de segurança
7.1. O Operador comunicará ao Cliente, em até **48 horas** depois de tomar conhecimento, qualquer incidente de segurança que envolva dados do Cliente e possa trazer risco ou dano relevante aos titulares, informando, na medida do possível: a natureza dos dados afetados, os titulares envolvidos, as medidas técnicas e de segurança usadas, os riscos e as medidas adotadas ou propostas.

7.2. O prazo de 48 horas existe para que o Cliente, como controlador, consiga comunicar a ANPD e os titulares no prazo regulamentar (Resolução CD/ANPD nº 15/2024). [Revisão jurídica: confirmar os prazos vigentes.]

7.3. O Operador cooperará com o Cliente na investigação, na mitigação e nas comunicações exigidas.

## 8. Transferência internacional
Alguns suboperadores estão fora do Brasil. As transferências seguem o art. 33 da LGPD, com os mecanismos descritos na Política de Privacidade. [Revisão jurídica: confirmar a adoção das cláusulas-padrão contratuais da ANPD (Resolução CD/ANPD nº 19/2024).]

## 9. Término e devolução dos dados
9.1. Durante a Assinatura e por **6 meses** após o fim do acesso, o Cliente pode exportar seus dados pelo Sistema.

9.2. Ao fim desse prazo, ou antes, se o Cliente pedir a exclusão da Conta, o Operador **elimina ou anonimiza** os dados do Cliente, inclusive nas cópias de segurança, que expiram no ciclo normal de retenção [até X dias].

9.3. O Operador pode manter dados apenas quando a lei exigir (LGPD, art. 16), como registros de acesso pelo prazo do Marco Civil da Internet, e trilhas de auditoria sem identificação dos titulares.

## 10. Auditoria
O Cliente pode pedir, uma vez por ano ou após um incidente, informações razoáveis para comprovar o cumprimento deste Acordo, como questionários de segurança e relatórios disponíveis. Auditorias presenciais dependem de acordo prévio sobre escopo, data, confidencialidade e custos.

## 11. Responsabilidade
Cada parte responde pelos danos que causar por descumprimento da LGPD ou deste Acordo, nos termos dos arts. 42 a 45 da LGPD. O Operador responde solidariamente quando descumprir a lei ou as instruções lícitas do Controlador. As limitações dos Termos de Uso se aplicam até onde a lei permitir.

## 12. Vigência
Este Acordo vigora enquanto o Operador tratar dados do Cliente, inclusive após o fim da Assinatura, até a eliminação prevista no item 9.

## 13. Contato
- **Encarregado do Operador:** [NOME DO ENCARREGADO], privacidade@addegas.com.br
- **Contato do Controlador:** e-mail do dono informado no cadastro.
