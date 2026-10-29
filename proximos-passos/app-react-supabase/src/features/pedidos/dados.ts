import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function rows<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

export type Pedido = {
  id: string; number: number; channel: string; status: string; mode: string
  customer_name: string | null; customer_phone: string | null; address: string | null; notes: string | null
  payment_hint: string | null; total: number; delivery_fee: number; created_at: string; sale_id: string | null
  courier_member_id: string | null
  itens: { name: string; quantity: number }[]
}
export type Entregador = { id: string; display_name: string }

const ABERTOS = ['new', 'preparing', 'ready', 'out_for_delivery']

/**
 * Pedidos em andamento e os últimos concluídos da loja, com itens, e os entregadores.
 * Pedido não passa pelo canal em tempo real (só vendas, caixa e comandas), então a tela consulta a cada 15 s.
 */
export function usePedidos(storeId: string | null) {
  return useQuery({
    queryKey: ['pedidos', storeId],
    enabled: !!storeId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const sel = 'id, number, channel, status, mode, customer_name, customer_phone, address, notes, payment_hint, total, delivery_fee, created_at, sale_id, courier_member_id, order_items(name, quantity)'
      const [abertos, feitos, entregadores] = await Promise.all([
        supabase.from('orders').select(sel).eq('store_id', storeId!).in('status', ABERTOS).order('created_at'),
        supabase.from('orders').select(sel).eq('store_id', storeId!).in('status', ['delivered', 'completed']).order('created_at', { ascending: false }).limit(40),
        supabase.from('store_members').select('id, display_name').eq('store_id', storeId!).eq('role', 'courier').eq('active', true).order('display_name'),
      ])
      const map = (o: Record<string, unknown> & { order_items: { name: string; quantity: number }[] }) =>
        ({ ...o, itens: o.order_items.map((i) => ({ name: i.name, quantity: Number(i.quantity) })) }) as unknown as Pedido
      return {
        pedidos: [...rows(abertos), ...rows(feitos)].map((o) => map(o as never)),
        entregadores: rows(entregadores) as Entregador[],
      }
    },
  })
}
