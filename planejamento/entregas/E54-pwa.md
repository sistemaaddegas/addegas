# E54 · PWA: instalação, atualização segura e caixa que abre sem internet

**Marco:** paralelo ao M2–M4 (é infraestrutura do app novo; precisa estar pronta antes do piloto) | **Tamanho:** M | **Depende de:** E01 (app da fase 2), E20 (contingência) | **Desbloqueia:** E52 (piloto), E53 (texto "instale pela tela inicial")
**Origem:** **[novo]**. Decidido em D62: **PWA**, reaproveitando a experiência do NEXUM-PRO.

## Objetivo
O Addegas se instala como app no celular do dono, no tablet do balcão e no computador, abre em tela cheia com a marca, avisa de nova versão sem atrapalhar o caixa e, sem internet, abre direto no modo contingência em vez de uma tela de erro.

## O que vem do NEXUM-PRO (`C:\Users\welli\Documents\projetos\nexum-pro`)
| Peça no NEXUM-PRO | O que faz | Como fica no Addegas (Vite, não Next) |
| --- | --- | --- |
| `app/manifest.ts` + `lib/pwa.ts` (`BRAND`) | Manifest com `id`, `start_url`, `scope`, `display: standalone`, ícones `any` e `maskable`, `lang: pt-BR`, `categories` | `public/manifest.webmanifest` estático, gerado a partir de `src/lib/pwa.ts` (`BRAND`) por script, para não haver dois lugares com as cores |
| `public/sw.js` | Service worker mínimo: guarda só a página offline; **nunca** guarda página logada nem dado | Mesma regra de **não guardar dados**, mas o Addegas também guarda a **casca do app** (ver abaixo), porque o caixa precisa abrir sem rede |
| `public/offline.html` | Página offline com a marca | Mantida como último recurso (se nem a casca estiver em cache) |
| `components/pwa/install-provider.tsx` | Contexto com plataforma (iOS, Android, desktop), `standalone`, `beforeinstallprompt` guardado, registro do service worker só em produção | Mesmo provider, sem a parte de SSR (`useSyncExternalStore` com snapshot de servidor não é necessário no Vite) |
| `components/pwa/install-invite.tsx` | Convite próprio: não aparece no 1º acesso (`MIN_SESSIONS = 2`), some se instalado, adiado por 7 dias ao fechar | Mesmas regras para o dono; no terminal, o convite aparece **no pareamento** (E09), porque tablet de balcão sempre deve ser instalado |
| `components/pwa/ios-install-tutorial.tsx` | Passo a passo ilustrado para iPhone e iPad (Compartilhar → Adicionar à Tela de Início) | Igual, com as ilustrações na identidade do Addegas |
| `public/splash/*` + `IOS_SPLASH_SCREENS` | 13 telas de abertura do iOS por tamanho de tela | Igual: fundo `#0A0A0B` com o "dd" amarelo |
| `scripts/generate-icons.mjs` (sharp) | Gera ícones e telas de abertura a partir do símbolo | Igual, a partir de `assets/dd-amarelo.png` e `assets/addegas-icon.png`; ícone `maskable` com margem de segurança de 20% |

## O que é próprio do Addegas
### 1. Dois perfis de instalação
| | Dono / gerente (celular) | Terminal do caixa (tablet ou PC) |
| --- | --- | --- |
| `start_url` | `/inicio?origem=app` | `/caixa?origem=terminal` (o app detecta o terminal pareado e vai para a tela de PIN) |
| Orientação | qualquer | qualquer; o layout de 720–1179 px (trilho de ícones) é o do tablet |
| Convite de instalação | a partir da 2ª sessão, adiável por 7 dias | obrigatório no pareamento (E09), com tutorial do iOS se for iPad |
| Tela ligada | normal | **Screen Wake Lock** enquanto o caixa estiver aberto, para o tablet não apagar no meio do atendimento |

Um manifest só serve aos dois (o `start_url` é o mesmo app); o roteamento inicial decide pelo tipo de sessão.

### 2. Service worker: casca em cache, dados nunca
- **Pré-cache da casca do app**: `index.html`, JS e CSS do build (nomes com hash), fontes Archivo (servidas pelo próprio app, não pelo Google; ver o ponto 8 do `juridico/README.md`), ícones e a tela de contingência.
- **Navegação**: busca na rede primeiro; sem rede, devolve o `index.html` do cache, e o app abre. Com o caixa sem conexão, a tela vai direto para o **modo contingência** (E20, D14).
- **Nunca em cache**: chamadas ao Supabase (`*.supabase.co`), `/api/*`, Realtime, Storage privado. Dados de venda, estoque e fiado sempre vêm da rede. Isso repete a regra do NEXUM-PRO e evita mostrar saldo velho.
- As anotações do modo contingência ficam no **IndexedDB** do aparelho, não no cache do service worker, e são apagadas depois de lançadas.
- Ferramenta: `vite-plugin-pwa` no modo `injectManifest` (o service worker é escrito à mão, como no NEXUM-PRO, e o plugin só injeta a lista de arquivos do build). Sem Workbox gerando regras automáticas.

### 3. Atualização sem derrubar o caixa
- O NEXUM-PRO faz `skipWaiting()` direto na instalação. **No Addegas, não**: trocar a versão no meio de uma venda pode perder o carrinho.
- Nova versão encontrada → aviso discreto "Nova versão disponível". Nas telas comuns, o botão "Atualizar" faz `skipWaiting` e recarrega.
- **No caixa**, a atualização só é aplicada sem carrinho aberto. Ela é aplicada sozinha no **fechamento do caixa** ou depois de 10 minutos sem venda. Correção urgente de segurança pode forçar a troca (campo `min_version` lido de `/api/health`, E04).
- A versão aparece em "Minha conta" e vai junto nos logs (E05) para o suporte saber o que a loja está usando.

### 4. Cabeçalhos e detalhes
- `manifest.webmanifest` com `Content-Type: application/manifest+json`; `sw.js` com `Cache-Control: no-cache` (senão o navegador demora a ver versão nova) e escopo `/`.
- `theme-color` `#0A0A0B`; `apple-mobile-web-app-status-bar-style: black-translucent`; `viewport-fit=cover` com `env(safe-area-inset-*)` nas barras (o protótipo já usa).
- Atalhos do manifest (`shortcuts`): "Abrir caixa", "Pedidos", "Relatórios".
- `screenshots` no manifest (uma estreita e uma larga), que o Android mostra numa folha de instalação mais rica.

### 5. Notificações push (depois do piloto)
O iPhone só recebe push de PWA **instalado** (iOS 16.4 ou mais novo). Na v1 os alertas vão pelo WhatsApp (E45); o push fica como canal extra depois, e o pedido de permissão só aparece **depois** da instalação, nunca no primeiro acesso.

## Não entra
- Publicação nas lojas da Apple e do Google (D62). Se um dia for preciso, o mesmo app pode ser empacotado com Capacitor.
- Venda completa offline com estoque e numeração (D14: só contingência).

## Critérios de aceite
- Lighthouse, seção PWA: instalável no Chrome (Android e computador); manifest e service worker válidos.
- iPhone: "Adicionar à Tela de Início" abre em tela cheia, com tela de abertura e ícone corretos.
- Modo avião com o app já instalado → o app abre e cai no modo contingência; nenhuma resposta do Supabase aparece no Cache Storage (conferido no DevTools).
- Deploy de versão nova com um carrinho aberto no caixa → nada muda até o carrinho fechar; fora do caixa, o aviso aparece e "Atualizar" recarrega na versão nova.
- Tablet com caixa aberto não apaga a tela em 30 minutos parado (Wake Lock).
- Convite de instalação: não aparece na 1ª sessão do dono; fechado, volta em 7 dias; nunca aparece no app já instalado.

## Riscos e atenção
- Cache de service worker mal feito é a causa número 1 de "a correção não chegou na loja". Por isso: versão no nome do cache, `sw.js` sem cache HTTP e a versão visível na tela.
- O Safari apaga dados de site não usado por 7 dias **se o app não estiver instalado**. Mais um motivo para instalar no tablet do caixa: as anotações de contingência no IndexedDB ficam protegidas.
