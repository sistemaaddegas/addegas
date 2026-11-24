/// <reference lib="webworker" />
export {}
/**
 * Service worker do Addegas (E54). Mesma regra do NEXUM-PRO: nenhum dado do sistema vai para o cache.
 * Diferença: guarda a CASCA do app (JS, CSS, fontes, ícones), para o caixa abrir sem internet direto no
 * modo contingência (D14). Chamadas ao Supabase e a /api/* nunca passam pelo cache.
 *
 * Atualização: nada de skipWaiting automático. A página manda SKIP_WAITING quando é seguro trocar de versão
 * (no caixa, sem carrinho aberto), para nunca perder uma venda no meio (E54).
 */
declare global {
  interface WorkerGlobalScope {
    // Lista do build injetada pelo vite-plugin-pwa (o texto "self.__WB_MANIFEST" precisa aparecer literal).
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>
  }
}
const sw = self as unknown as ServiceWorkerGlobalScope

const VERSION = 'addegas-v1'
const SHELL = `${VERSION}-shell`
const PRECACHE = self.__WB_MANIFEST.map((e) => (e.revision ? `${e.url}?__v=${e.revision}` : e.url))
const INDEX = '/index.html'

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([...new Set([...PRECACHE, INDEX, '/offline.html'])])),
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  )
})

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting()
})

function isData(url: URL): boolean {
  return url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co') || url.port === '57321'
}

sw.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (isData(url)) return // dados sempre da rede (sem cache, sem saldo velho)

  // Navegação: rede primeiro; sem rede, a casca do app (o app decide entre contingência e tela offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(INDEX, { ignoreSearch: true })) ??
        (await caches.match('/offline.html')) ?? Response.error()),
    )
    return
  }

  // Arquivos do build (com hash) e da marca: cache primeiro.
  if (url.origin === sw.location.origin) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? fetch(request)),
    )
  }
})
