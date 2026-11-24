# E50 · Brindes de fidelidade e mapa

> **Adiada até ter clientes pagantes** (D36, decidido). O endereço completo, quando for preciso, é pedido pela equipe na ficha da adega, não no cadastro.

**Marco:** M9 · Crescimento | **Tamanho:** M | **Depende de:** E36, `D36` | **Desbloqueia:** —
**Origem:** §1 ("kits por aniversário de assinatura, geolocalização"), §5 (`gifts`, `gift_kits`, `gift_stock`), §8 (marcos de 1, 2 e 3 anos na rotina das 2h)

## Objetivo
Reconhecer adegas fiéis com kits nos aniversários de assinatura e visualizar clientes no mapa.

## Entra
- `platform.gift_kits` (marco em anos, itens), `platform.gift_stock` (item, quantidade), `platform.gifts` (adega, kit, status `elegivel`/`separado`/`enviado`/`entregue`, código de rastreio).
- Rotina das 2h marca elegíveis ao completar 1, 2 e 3 anos de assinatura **paga** (teste e períodos suspensos não contam).
- Mapa: latitude/longitude da loja, geocodificadas do endereço (`D36`: provedor e custo), com filtros por status.

## Critérios de aceite
- Teste: adega que completa 1 ano hoje vira elegível uma vez só.

## Riscos e atenção
- Endereço completo para envio e geocodificação são dados que o onboarding atual não pede (pede só nome, bairro e WhatsApp).
- Baixa prioridade: candidata a sair da v1 (análise crítica, seção 5).
