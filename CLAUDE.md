# Addegas: instruções para o Claude Code

Este repositório publica o front-end do **Addegas** (sistema de gestão para adegas) **exatamente** como foi aprovado no design. É um site estático: sem build, sem `npm install`, sem variáveis de ambiente, sem backend.

## Regra de ouro
Os arquivos abaixo são o produto aprovado. **Não edite, não formate, não renomeie, não reorganize, não converta para outro framework e não "otimize"**, a não ser que o usuário peça uma mudança específica.

- `index.html`: o sistema inteiro. Tem o template (`{{ }}`, `<sc-if>`, `<sc-for>`, estilos inline), a lógica (`<script data-dc-script>`) e os dados de exemplo.
- `support.js`: o runtime que monta o `index.html` no navegador. Carrega React 18.3.1 do unpkg com SRI. **Nunca altere.**
- `assets/`, `icons/`, `data/lucro-no-copo.js` e `manifest.webmanifest`.

Também não faça nada disto:
- rodar Prettier, ESLint ou qualquer formatador nesses arquivos;
- criar `package.json` na raiz (a Vercel passaria a tentar um build);
- trocar caminhos relativos (`assets/...`, `data/...`, `./support.js`) por absolutos;
- mudar maiúsculas ou minúsculas em nomes de arquivo (a Vercel roda em Linux, então `Logo.png` ≠ `logo.png`);
- mexer em `proximos-passos/` (fase 2, fora do deploy) sem pedido.

## 1. GitHub
```bash
git init -b main
git add .
git commit -m "Addegas: front-end aprovado"
gh auth status                      # confere o login no GitHub CLI
gh repo create addegas-frontend --private --source=. --remote=origin --push
```
Sem o `gh`, crie um repositório **vazio** em https://github.com/new (sem README nem .gitignore) e rode:
```bash
git remote add origin https://github.com/USUARIO/addegas-frontend.git
git push -u origin main
```

## 2. Vercel
**Pelo painel (recomendado: cada push na `main` publica sozinho)**
1. Em vercel.com: Add New… → Project → Import do repositório `addegas-frontend`.
2. Framework Preset: **Other**. Root Directory: **./** (não escolha `proximos-passos/...`).
3. Build Command, Output Directory e Install Command: **padrão, sem override**.
4. Clique em Deploy. Nenhuma variável de ambiente é necessária.

**Pela CLI**
```bash
npx vercel@latest login
npx vercel@latest link          # projeto novo "addegas-frontend", diretório ./ , sem alterar configurações
npx vercel@latest --prod
npx vercel@latest git connect   # liga ao repositório do GitHub para deploy automático
```

## 3. Conferir (obrigatório antes de dizer que terminou)
```bash
bash scripts/verificar-deploy.sh https://SEU-PROJETO.vercel.app
```
O script precisa terminar em **"Tudo certo."**. Depois confira no navegador, ou peça ao usuário para conferir:
- Com 1180px ou mais: menu lateral com Operação, Gestão, Análise, Ferramentas e Configurar, e o Início mostrando "Marcos".
- De 720px a 1179px: trilho de ícones à esquerda. Abaixo de 720px: abas embaixo (Início · Pedidos · Vender · Relatórios · Mais).
- Console sem erros vermelhos, e o Lucro no Copo mostrando os produtos.
- "Sair" (botão vermelho no menu) leva ao login amarelo com o logo dd.

## Rodar local
Precisa de um servidor, porque abrir com `file://` não funciona (o runtime busca a própria página e a pasta `data/`):
```bash
npx serve .            # ou: python3 -m http.server 8080
```

## Atualizar o design depois
Quando o usuário trouxer um `Addegas.dc.html` novo do projeto de design:
```bash
node scripts/atualizar-design.mjs "/caminho/para/Addegas.dc.html"
git add -A && git commit -m "Atualiza design" && git push
bash scripts/verificar-deploy.sh https://SEU-PROJETO.vercel.app
```
O script grava o arquivo como `index.html`, mantém o bloco `addegas:head` (título, ícones, manifest e `lang="pt-BR"`) e avisa se faltar algum arquivo em `assets/` ou `data/`. Se avisar, copie esses arquivos do projeto de design com o mesmo nome.

## Se o usuário pedir uma mudança aqui
- Faça só a mudança pedida, no `index.html`, seguindo o padrão do arquivo (estilos inline; lógica em `renderVals()`; nada de CSS em classes).
- Holes `{{ }}` só aceitam caminhos (`{{ item.nome }}`), nunca expressões. Calcule em `renderVals()`.
- Teste local com `npx serve .` antes do push.
- Avise o usuário que a próxima atualização vinda do design (`atualizar-design.mjs`) sobrescreve o `index.html`. Ele precisa repetir a mudança no design ou pedir para reaplicar.

## Problemas comuns
- **Tela vazia (preta ou branca):** abra o console. Se aparecer `Failed to load … unpkg.com` ou erro de *integrity*, a rede ou um adblock bloqueou o unpkg. Teste a URL do React direto no navegador. Não remova o SRI e não troque a versão.
- **Imagem quebrada:** o nome do arquivo está com maiúsculas e minúsculas diferentes, ou o arquivo não foi commitado (`git ls-files assets icons`).
- **Lucro no Copo vazio, com o aviso "mocks não carregados":** o `data/lucro-no-copo.js` não foi publicado.
- **A Vercel tentou rodar `npm install` ou `vite build`:** Root Directory ou Framework estão errados. Em Settings → Build & Deployment, use Framework **Other**, Root Directory vazio e nenhum override.
- **Fonte diferente:** o Google Fonts foi bloqueado. A fonte do sistema é Archivo.
- **Dados somem ao recarregar:** é o esperado. É só front-end, sem backend; tudo fica em memória (a fase 2 resolve isso).
- **Mudança não aparece:** espere o deploy terminar na Vercel e recarregue com Ctrl/Cmd+Shift+R.

## Fase 2 (somente quando o usuário pedir)
Veja a seção "Fase 2" do `README.md` e o `proximos-passos/app-react-supabase/README.md`. O `index.html` publicado é a referência visual pixel a pixel e continua no ar até o app novo ficar idêntico.
