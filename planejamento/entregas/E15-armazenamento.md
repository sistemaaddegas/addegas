# E15 · Armazenamento de arquivos: buckets, upload assinado e políticas

**Marco:** M3 · Permissões | **Tamanho:** M | **Depende de:** E12, E14 | **Desbloqueia:** E16, E30, E37, E38, E39
**Origem:** §6 inteira

## Objetivo
Arquivos com caminho decidido pelo servidor, tipo conferido, imagens otimizadas e acesso privado por URL assinada.

## Entra
- Os seis buckets da §6 (`catalog-images`, `store-public`, `ticket-attachments`, `payment-proofs`, `imports`, `exports`) com limite de tamanho e tipos MIME configurados no próprio bucket.
- Função `/api/uploads/sign`: recebe `{ finalidade, entidade_id, tipo, tamanho }`, confere permissão, monta o caminho final (§6: "o navegador nunca escolhe o caminho") e devolve URL assinada de upload.
- Tabela `app.files` / `platform.files` (dono, bucket, caminho, tamanho, mime real, enviado_por, nome original, sha256, created_at) para auditoria e exclusão junto com a conta.
- Pós-upload: função que lê os primeiros bytes (assinatura do arquivo) e confere o tipo real; recusado → apaga o objeto e marca a linha.
- Imagens: conversão para WebP e redimensionamento (ex.: 800 px e miniatura de 200 px) **no navegador, antes do upload** (canvas → `toBlob('image/webp')`), porque a transformação de imagem do Storage é paga e o plano é gratuito (D32). A função de pós-upload só confere tipo e tamanho. Bônus: foto de 12 MP do celular sobe com ~100 KB, o que poupa o Storage gratuito e o 4G da loja.
- Políticas do Storage por prefixo (§6), com INSERT, SELECT **e UPDATE** onde há substituição de arquivo (logo, foto de produto) (§9).
- `exports`: limpeza em 24 h pela rotina das 2h (E46).

## Não entra
- Importação de planilha de produtos (E16 usa o bucket `imports`).

## Critérios de aceite
- Teste: membro da loja A tenta ler `ticket-attachments/<conta B>/...` → negado.
- Teste: arquivo `.png` que na verdade é `.exe` → recusado e apagado.
- Teste: substituir o logo da loja funciona (UPDATE liberado).
- URL assinada de leitura expira em 5 min.

## Riscos e atenção
- Buckets públicos com CDN guardam cache: trocar a foto do produto precisa de nome novo (versão no caminho) ou o cliente verá a antiga.
- Conversão no navegador depende do aparelho: Safari antigo não gera WebP; nesse caso, enviar JPEG redimensionado (já aceito pelo bucket).
