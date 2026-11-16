import { useMemo, useSyncExternalStore } from 'react'
import type { PixConfig } from '@/lib/pix'
import type { Categoria, Membro, Operador, Produto } from './dados'

/**
 * O que o caixa precisa para abrir sem internet (D14): produtos com o preço da loja, quem está operando, a
 * equipe e a chave Pix. É atualizado toda vez que o caixa carrega com internet. Não tem dado de cliente,
 * saldo nem custo, e sai do aparelho quando ele é desconectado.
 */
export type Retrato = {
  storeId: string
  terminalId: string
  terminalName: string
  op: Operador | null
  operadores: Membro[]
  itens: Pick<Produto, 'key' | 'kind' | 'id' | 'name' | 'price' | 'catId' | 'catName' | 'color' | 'ean'>[]
  cats: Categoria[]
  pix: PixConfig | null
  salvoEm: string
}

const KEY = 'addegas.caixa-sem-internet'
const MUDOU = 'addegas:retrato'
const ler = () => { try { return localStorage.getItem(KEY) } catch { return null } }
const avisar = () => window.dispatchEvent(new Event(MUDOU))

export function lerRetrato(): Retrato | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
}

export function salvarRetrato(r: Omit<Retrato, 'salvoEm'>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...r, salvoEm: new Date().toISOString() })) } catch { /* sem armazenamento */ }
  avisar()
}

export function mudarOperadorDoRetrato(op: Operador | null) {
  const r = lerRetrato()
  if (r) salvarRetrato({ ...r, op })
}

export function apagarRetrato() {
  try { localStorage.removeItem(KEY) } catch { /* sem armazenamento */ }
  avisar()
}

/** O retrato atual, que se atualiza quando o caixa salva um novo (o App troca para a contingência com ele). */
export function useRetrato(): Retrato | null {
  const txt = useSyncExternalStore((f) => { window.addEventListener(MUDOU, f); return () => window.removeEventListener(MUDOU, f) }, ler, () => null)
  return useMemo(() => { try { return txt ? JSON.parse(txt) : null } catch { return null } }, [txt])
}
