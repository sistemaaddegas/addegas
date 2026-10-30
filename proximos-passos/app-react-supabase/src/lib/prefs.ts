import { useSyncExternalStore } from 'react'

/** Preferências deste aparelho (ex.: calculadora no menu lateral). Ficam no navegador e valem entre telas. */
const ouvintes = new Set<() => void>()

function ler(chave: string, padrao: boolean) {
  try {
    const v = localStorage.getItem(`addegas.pref.${chave}`)
    return v === null ? padrao : v === '1'
  } catch { return padrao }
}

export function usePref(chave: string, padrao: boolean): [boolean, (v: boolean) => void] {
  const valor = useSyncExternalStore((cb) => { ouvintes.add(cb); return () => ouvintes.delete(cb) }, () => ler(chave, padrao))
  const set = (v: boolean) => {
    try { localStorage.setItem(`addegas.pref.${chave}`, v ? '1' : '0') } catch { /* navegador sem armazenamento: vale só nesta tela */ }
    ouvintes.forEach((cb) => cb())
  }
  return [valor, set]
}
