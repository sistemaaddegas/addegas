# Minutas jurídicas do Addegas (v0.1, 28/10/2026)

Primeira versão completa, escrita a partir das decisões do produto ([../duvidas.md](../duvidas.md)), para **revisão por advogado** antes de qualquer publicação. Não é parecer jurídico.

| Documento | Para quem | Quando é aceito |
| --- | --- | --- |
| [termos-de-uso.md](termos-de-uso.md) | Dono da adega (cliente do Addegas) | No cadastro, com caixa de seleção e registro da versão |
| [politica-de-privacidade.md](politica-de-privacidade.md) | Todos: donos, funcionários das adegas, visitantes da landing, interessados | Publicada na landing e no app; ciência no cadastro |
| [acordo-de-tratamento-de-dados.md](acordo-de-tratamento-de-dados.md) | Adega (controladora) e Addegas (operador) | Anexo dos Termos, aceito junto com eles |

## Campos a preencher
Tudo entre colchetes, por exemplo `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]`, `[NOME DO ENCARREGADO]`, `[CIDADE DO FORO]`. Os e-mails já usam o domínio (`contato@` e `privacidade@addegas.com.br`), mas só funcionam depois de configurar o recebimento (D61).

## Decisões do produto refletidas nos textos
- Plano único: R$ 149,90/mês, R$ 809,46/semestre, R$ 1.439,04/ano; loja adicional R$ 49,90/mês com o desconto do ciclo; troca de ciclo na hora, com crédito; teste grátis de 14 dias sem cartão (D02, D29, D54).
- Cobrança recorrente pelo Stripe; carência de 5 dias corridos após a primeira falha; depois, suspensão da operação com dados preservados (D28, §1 da arquitetura).
- Cancelamento a qualquer momento, com efeito no fim do ciclo pago.
- Retenção: 6 meses após o fim do acesso; registros de acesso 6 meses (Marco Civil); dados fiscais do Addegas 5 anos (D25).
- Cupom **não fiscal**: a emissão de documentos fiscais é responsabilidade da adega (§10, E24).
- Sem cadastro de clientes finais; o fiado guarda só nome e telefone (D19, D55), e o telefone é anonimizado 6 meses após a quitação.
- WhatsApp só do número do Addegas para o dono; nada de mensagem da adega para o cliente final (D22).
- Pix e cartão das vendas da adega **não** são processados pelo Addegas (D15).

## Pontos para o advogado olhar com atenção
1. **CDC x contrato entre empresas.** A adega é empresa, mas pode ser considerada vulnerável (microempreendedor). Os Termos foram escritos para valer nos dois cenários: sem multa de cancelamento, com teste grátis e com aviso prévio de mudanças. Confirmar se o direito de arrependimento de 7 dias (CDC, art. 49) deve constar expressamente para contratação online.
2. **Limitação de responsabilidade.** Limitada ao valor pago nos últimos 12 meses, com as exceções que a lei não permite limitar. Avaliar se é aplicável e proporcional.
3. **Transferência internacional.** Os fornecedores (Supabase, Vercel, Stripe, Resend, Cloudflare, Google) são estrangeiros, mesmo com o banco hospedado em São Paulo. Avaliar a base do art. 33 da LGPD e a adoção das cláusulas-padrão contratuais da ANPD (Resolução CD/ANPD nº 19/2024).
4. **Incidentes.** O DPA prevê aviso à adega em até 48 horas, para ela cumprir o prazo de 3 dias úteis do regulamento da ANPD (Resolução CD/ANPD nº 15/2024). Conferir os prazos vigentes.
5. **Fiado.** O nome e o telefone de quem compra fiado são dados pessoais do cliente final, tratado pela adega como controladora. Confirmar se a base legal sugerida à adega (execução de contrato / exercício regular de direito de crédito) está adequada.
6. **Venda de bebida a menores.** Cláusula reforçando que a adega é a única responsável pelo cumprimento da lei (ECA, art. 243).
7. **Retenção de 6 meses** após o fim do acesso: escolha de produto, compatível com a LGPD (que não fixa prazo) e com o Marco Civil. Confirmar.
8. **Google Fonts.** Carregar fontes do Google envia o IP do visitante ao Google. Recomendação técnica independente do advogado: hospedar a fonte Archivo no próprio site e retirar o Google da lista de suboperadores.

## Versionamento
Cada mudança gera nova versão (`v0.2`, `v1.0`...), com data. O sistema registra qual versão cada pessoa aceitou (E51, `platform.legal_acceptances`). Mudança relevante exige novo aceite ou aviso com 30 dias de antecedência, conforme os Termos.
