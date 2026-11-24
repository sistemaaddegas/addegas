import { supabase } from './supabase'

/**
 * Modo contingência do caixa (D14, E20): sem internet, o operador anota valor, forma de pagamento e itens
 * no próprio aparelho (IndexedDB). Quando a rede volta, cada anotação vira uma venda pelo finalize_sale,
 * marcada como "contingency" e conferida pelo gerente nos relatórios. Nada baixa estoque nem numera venda
 * enquanto estiver offline. Cada anotação já nasce com o client_request_id, então reenviar não duplica.
 */
export type Metodo = 'pix' | 'credit' | 'debit' | 'cash'
export type ContingencySale = {
  client_request_id: string
  store_id: string
  operator_session_id: string
  /** Quem estava no caixa, para mostrar na lista (a venda entra no nome da sessão que a lançar). */
  operator_name: string
  items: { product_id?: string; bundle_id?: string; quantity: number; name: string; price: number }[]
  payments: { method: Metodo; amount: number }[]
  /** Total com os preços que o aparelho tinha quando anotou. */
  total: number
  created_at: string
  /** Última recusa do servidor (fica guardada até alguém resolver). */
  error?: { code: string; server_total?: number }
}

const DB = 'addegas-contingencia'
const STORE = 'vendas'
const MUDOU = 'addegas:contingencia'

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

const avisar = () => window.dispatchEvent(new Event(MUDOU))
/** Avisa quando a lista de anotações muda (nesta aba). */
export function onContingencyChange(fn: () => void) {
  window.addEventListener(MUDOU, fn)
  return () => window.removeEventListener(MUDOU, fn)
}

export async function saveContingencySale(sale: Omit<ContingencySale, 'client_request_id' | 'created_at'>) {
  await tx('readwrite', (s) => s.put({ ...sale, client_request_id: crypto.randomUUID(), created_at: new Date().toISOString() }))
  avisar()
}

export async function pendingContingencySales(): Promise<ContingencySale[]> {
  const todas = await tx('readonly', (s) => s.getAll() as IDBRequest<ContingencySale[]>)
  return todas.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function updateContingencySale(sale: ContingencySale) {
  await tx('readwrite', (s) => s.put(sale))
  avisar()
}

export async function deleteContingencySale(id: string) {
  await tx('readwrite', (s) => s.delete(id))
  avisar()
}

/**
 * Lança as anotações pendentes, da mais antiga para a mais nova. A que o servidor recusa fica guardada com o
 * motivo (preço mudou, caixa fechado, sessão do operador encerrada) e só volta a ser enviada quando alguém
 * resolve na tela; sem rede, para e tenta na próxima vez.
 */
export async function flushContingencySales(): Promise<{ sent: number; failed: number; offline: boolean }> {
  let sent = 0, failed = 0
  for (const sale of (await pendingContingencySales()).filter((s) => !s.error)) {
    const { data, error } = await supabase.rpc('finalize_sale' as never, {
      p: {
        operator_session_id: sale.operator_session_id || null, client_request_id: sale.client_request_id, origin: 'contingency',
        items: sale.items.map(({ product_id, bundle_id, quantity }) => ({ product_id, bundle_id, quantity })), payments: sale.payments,
      },
    } as never)
    if (error) {
      // Sem resposta do servidor: a internet caiu de novo. O resto espera.
      if (!error.code) return { sent, failed, offline: true }
      await updateContingencySale({ ...sale, error: { code: 'INTERNAL' } })
      failed++
      continue
    }
    const r = data as { ok: boolean; error?: { code: string; detail?: string } }
    if (r.ok) {
      await deleteContingencySale(sale.client_request_id)
      sent++
    } else {
      // "total 1290, pago 1190": o preço mudou desde a anotação.
      const total = r.error?.code === 'SALE_PAYMENT_MISMATCH' ? Number(/total (\d+)/.exec(r.error.detail ?? '')?.[1]) || undefined : undefined
      await updateContingencySale({ ...sale, error: { code: r.error?.code ?? 'INTERNAL', server_total: total } })
      failed++
    }
  }
  return { sent, failed, offline: false }
}
