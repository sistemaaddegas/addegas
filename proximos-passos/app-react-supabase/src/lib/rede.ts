import { useSyncExternalStore } from 'react'

/**
 * Estado da conexão com o servidor (D14). O navegador diz "online" mesmo quando o Wi-Fi da loja está sem
 * internet, então o que vale é o servidor responder. Só conta como queda depois de duas falhas seguidas
 * (alguns segundos): uma oscilação rápida não tira o caixa do lugar.
 */
const SAUDE = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let online = typeof navigator === 'undefined' ? true : navigator.onLine
let falhas = 0
let timer: ReturnType<typeof setTimeout> | undefined
const ouvintes = new Set<() => void>()

async function responde() {
  if (!navigator.onLine) return false
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 4000)
  try {
    const r = await fetch(SAUDE, { headers: { apikey: KEY }, cache: 'no-store', signal: c.signal })
    return r.status < 500
  } catch { return false } finally { clearTimeout(t) }
}

function mudar(v: boolean) {
  if (v === online) return
  online = v
  ouvintes.forEach((f) => f())
}

async function conferir() {
  clearTimeout(timer)
  if (await responde()) { falhas = 0; mudar(true) }
  else if (++falhas >= 2 || !navigator.onLine) mudar(false)
  // Sem internet confere a cada 5 s (para voltar logo); com internet, a cada 30 s.
  timer = setTimeout(conferir, online && falhas === 0 ? 30_000 : 5_000)
}

/** Chame quando uma requisição falhar por rede: confere na hora em vez de esperar o próximo ciclo. */
export function suspeitarDeQueda() { void conferir() }

function assinar(f: () => void) {
  if (!ouvintes.size) {
    window.addEventListener('online', suspeitarDeQueda)
    window.addEventListener('offline', suspeitarDeQueda)
    void conferir()
  }
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
    if (!ouvintes.size) {
      window.removeEventListener('online', suspeitarDeQueda)
      window.removeEventListener('offline', suspeitarDeQueda)
      clearTimeout(timer)
    }
  }
}

export function useOnline() {
  return useSyncExternalStore(assinar, () => online, () => true)
}
