# E24 · Cupom não-fiscal (impressão da notinha)

**Marco:** M4 · Núcleo **[novo: não está no documento]** | **Tamanho:** M | **Depende de:** E20, `D18` | **Desbloqueia:** —
**Origem:** §10 ("o sistema gera a notinha da venda"), Ajustes do `index.html` ("Impressora de cupom"), ticket TK-2044 dos dados de exemplo (Elgin i9)

## Objetivo
Imprimir a notinha da venda, da comanda e do fechamento de caixa numa impressora térmica de 58 ou 80 mm.

## Entra
- `app.printer_settings` (store_id, terminal_id, largura 58/80 mm, método, nome da impressora, cabeçalho, rodapé, imprimir automaticamente após venda sim/não, vias).
- RPC `app.sale_receipt(sale_id)` que devolve os dados da notinha já formatados (cabeçalho, itens, pagamentos, troco, número, operador, data no fuso da loja), para o front não recalcular nada.
- Texto obrigatório "**Documento sem valor fiscal**" (é cupom não-fiscal; NFC-e fora da v1).
- **Decidido (D18):** entra na v1, com **WebUSB / Web Serial (ESC/POS)** como método principal e a impressão do navegador como alternativa. Agente local (QZ Tray) só se aparecer impressora que não funcione assim.
- QR do Pix (D15) impresso na notinha de mesa e comanda, para o cliente pagar na mesa.
- Comparação dos métodos (para referência):
  | Método | Prós | Contras |
  | --- | --- | --- |
  | Impressão do navegador (`window.print` com CSS de 80 mm) | Zero instalação | Diálogo de impressão, margens, corte errado (o problema do TK-2044) |
  | WebUSB / Web Serial com ESC/POS | Sem instalar nada, imprime direto, aciona guilhotina e gaveta | Só Chrome/Edge em desktop e Android; não funciona no iPad; driver da impressora pode bloquear |
  | Agente local (QZ Tray ou app ponte) | Funciona com qualquer impressora instalada | Instalar e manter um programa na máquina do cliente; certificado do QZ Tray |
  | Impressora de rede (IP) via agente | Vários terminais numa impressora | Mesmo problema do agente |
- Abertura da gaveta de dinheiro (comando ESC/POS) junto com a impressão de venda em dinheiro, se houver gaveta conectada à impressora.

## Não entra
- NFC-e/SAT. Documento fiscal fica fora (§10, `D30`).

## Critérios de aceite
- Notinha de 80 mm impressa sem corte em pelo menos 2 modelos comuns (ex.: Elgin i9 e Epson TM-T20).
- Reimpressão da notinha de qualquer venda do dia pelo número.

## Riscos e atenção
- Muitas adegas acham que "notinha" substitui nota fiscal. O texto "sem valor fiscal" é obrigatório e a responsabilidade fiscal é da adega; deixar claro nos termos (E51).
