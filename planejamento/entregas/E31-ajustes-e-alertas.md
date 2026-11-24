# E31 · Ajustes da loja, alertas automáticos e catálogo público

**Marco:** M5 · Gestão complementar | **Tamanho:** M | **Depende de:** E17, E19, E28, E29, `D38` | **Desbloqueia:** E45
**Origem:** §1 ("alertas automáticos, catálogo público, integrações"), §5 (`alert_settings`, `store_settings`, `integrations`)

## Objetivo
Concentrar as configurações da loja e gerar os alertas que depois vão para o WhatsApp do dono.

## Entra
- `app.store_settings` (horário de funcionamento, dia comercial (E26), limite de diferença de caixa, conferência cega, impressão (E24), bloquear venda sem estoque (D06, desligado por padrão), taxa de entrega padrão e "frete grátis acima de R$ X" (D42)).
- **Pix da loja (D15)**: chave Pix (CPF, CNPJ, e-mail, telefone ou aleatória), nome do recebedor (até 25 caracteres, sem acento, como o padrão exige) e cidade (até 15). Validação do formato da chave e botão "Gerar QR de teste de R$ 0,01" para o dono conferir no app do banco antes de usar no caixa.
- Limite de desconto por função (D05), editado na tela de Equipe (E12).
- `app.alert_settings` (por tipo: ligado, destinatários, horário silencioso): estoque baixo, validade próxima (padrão 7 dias), pedido atrasado, resumo do fechamento de caixa, conta vencendo, diferença de caixa, cancelamentos acima de N e, **[novo, prometidos na landing]**, produto parado (sem venda há N dias, padrão 3), caixa aberto (quem abriu e o troco inicial) e desconto fora da regra (tentativa acima do limite, com ou sem autorização).
- `app.alerts` (gerados): tipo, severidade, entidade, mensagem, lido_por, enviado_em, canal. Gerados por trigger (estoque baixo na hora do movimento) ou pela rotina horária (validade, contas).
- Deduplicação: o mesmo alerta (tipo + entidade) não repete em 24 h.
- Catálogo público (D38, decidido: vitrine só leitura que abre o WhatsApp da loja com o pedido em texto): `app.catalog_settings` (slug, ativo, mostrar preço, mostrar estoque, mensagem padrão do WhatsApp). Página pública lê só uma **view pública** `app.public_catalog` com produtos marcados, sem custo nem estoque exato; único ponto do `app` com `grant select` para `anon`, por view e com limite de taxa.
- `app.integrations` (canal, status, configuração não sensível); os tokens ficam no Vault (E43).

## Não entra
- Envio pelo WhatsApp (E45). Aqui os alertas aparecem no sino do app.
- Integrações de delivery (D21, em espera): a tela mostra "em breve" (D59).

## Critérios de aceite
- Teste: produto cai abaixo do mínimo → 1 alerta; segunda venda no mesmo dia → nenhum alerta novo.
- Teste: `anon` lê o catálogo público da loja com catálogo ativo e não lê o de loja com catálogo desligado; não vê custo.

## Riscos e atenção
- O catálogo público é a única superfície anônima do `app`. Revisar a view com cuidado e testar que nenhuma coluna sensível vaza.
