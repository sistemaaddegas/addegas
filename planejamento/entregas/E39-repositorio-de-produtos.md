# E39 · Repositório de produtos (catálogo mestre: escrita)

**Marco:** M7 · Painel Addegas | **Tamanho:** M | **Depende de:** E14, E15, E16 | **Desbloqueia:** —
**Origem:** §1 ("Catálogo mestre com EAN e versões"), §5 (`catalog_products`, `catalog_versions`, `catalog_suggestions`); abas do admin: Catálogo, Duplicidades, Importar planilha, Atualizações

## Objetivo
A equipe mantém um catálogo de bebidas com EAN, foto e dados corretos, que as adegas usam para não digitar produto.

## Entra (v1 enxuta)
- Criar, editar e publicar produto do catálogo (nome, marca, EAN, volume, teor, categoria, foto em `catalog-images`).
- Importar planilha como **rascunho** (o admin já mostra "Importar N como rascunho").
- Detecção de duplicidade: mesmo EAN, ou nome normalizado + volume parecidos (trigram).
- Permissão `catalog.write` (perfil Suporte e Mestre).

## Entra (depois do piloto)
- `catalog_versions`: cada publicação gera versão; o produto da adega aponta para a versão e recebe aviso de "atualização disponível" (aba "Atualizações").
- `catalog_suggestions`: adega sugere correção ou produto novo a partir do próprio cadastro (produtos criados à mão com EAN que não existe no catálogo viram sugestão).

## Critérios de aceite
- Teste: dois produtos publicados com o mesmo EAN → recusado.
- Teste: produto em rascunho não aparece na busca da adega (E16).

## Riscos e atenção
- Fotos de produto têm direito de imagem da marca. Definir a origem das fotos (fotografia própria, fornecedor, banco licenciado).
- Um mesmo EAN pode ter embalagens diferentes ao longo do tempo; a versão resolve isso.
