import { supabase } from './supabase'

/**
 * Modo contingência do caixa (D14, E20): sem internet, o operador anota valor, forma de pagamento e itens
 * no próprio aparelho (IndexedDB). Quando a rede volta, cada anotação vira uma venda pelo finalize_sale,
 * marcada como "contingency" e conferida pelo gerente nos relatórios. Nada baixa estoque nem numera venda
 * enquanto estiver offline. Cada anotação já nasce com o client_request_id, então reenviar não duplica.
 */
export type ContingencySale = {
  client_request_id: string
  store_id: string
  operator_session_id: string
  items: { product_id?: string; bundle_id?: string; quantity: number }[]
  payments: { method: 'pix' | 'credit' | 'debit' | 'cash' | 'fiado'; amount: number }[]
  fiado?: { name: string; phone: string }
  note?: string
  created_at: string
}

const DB = 'addegas-contingencia'
const STORE = 'vendas'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'client_request_id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function saveContingencySale(sale: Omit<ContingencySale, 'client_request_id' | 'created_at'>): Promise<IDBValidKey> {
  return tx('readwrite', (s) => s.put({ ...sale, client_request_id: crypto.randomUUID(), created_at: new Date().toISOString() }))
}

export function pendingContingencySales(): Promise<ContingencySale[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<ContingencySale[]>)
}

/** Lança as anotações pendentes. Devolve quantas entraram e quais falharam (ficam guardadas). */
export async function flushContingencySales(): Promise<{ sent: number; failed: { id: string; code: string }[] }> {
  const pending = await pendingContingencySales()
  let sent = 0
  const failed: { id: string; code: string }[] = []
  for (const sale of pending) {
    const { data, error } = await supabase.schema('app').rpc('finalize_sale', {
      p: { ...sale, origin: 'contingency' },
    } as never)
    const result = data as { ok: boolean; error?: { code: string } } | null
    if (!error && result?.ok) {
      await tx('readwrite', (s) => s.delete(sale.client_request_id))
      sent++
    } else {
      failed.push({ id: sale.client_request_id, code: result?.error?.code ?? error?.message ?? 'NETWORK' })
    }
  }
  return { sent, failed }
}
