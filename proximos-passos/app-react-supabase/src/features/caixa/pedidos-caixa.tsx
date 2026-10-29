import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { brlc } from '@/lib/format'
import { Sheet } from '@/components/sheet'
import { canal } from '@/components/canal'
import { dot, ha, qtd } from '@/lib/visual'

export type PedidoCaixa = { id: string; number: number; channel: string; status: string; customer_name: string | null; total: number; payment_hint: string | null; created_at: string; itens: number }

const STATUS: Record<string, string> = { preparing: 'Em preparo', ready: 'Pronto', out_for_delivery: 'Em rota', delivered: 'Entregue' }

/** Pedidos aceitos que ainda não viraram venda: o caixa recebe e o pedido entra no faturamento (E41, complete_order). */
export function usePedidosAReceber(storeId: string) {
  return useQuery({
    queryKey: ['caixa', 'pedidos', storeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('id, number, channel, status, customer_name, total, payment_hint, created_at, order_items(quantity)')
        .eq('store_id', storeId).in('status', Object.keys(STATUS)).is('sale_id', null).order('created_at')
      if (error) throw new Error(error.message)
      return (data ?? []).map((o) => ({ ...o, itens: o.order_items.reduce((a, i) => a + Number(i.quantity), 0) })) as PedidoCaixa[]
    },
  })
}

export function ReceberPedidos({ pedidos, onClose, onEscolher }: { pedidos: PedidoCaixa[]; onClose: () => void; onEscolher: (p: PedidoCaixa) => void }) {
  return (
    <Sheet title="Receber pedido" onClose={onClose}>
      <div className="text-sm text-[#C4C4C9] -mt-2">Pedidos aceitos que ainda não foram pagos no caixa. Ao receber, o pedido vira venda e entra no faturamento.</div>
      {pedidos.map((o) => {
        const c = canal(o.channel)
        return (
          <button key={o.id} onClick={() => onEscolher(o)} className="flex items-center gap-3 p-3.5 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-left cursor-pointer">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold"><span style={dot(c.cor)} />{c.nome}<span className="text-[#ADADB4] font-semibold">#{o.number}</span><span className="text-[#ADADB4] font-semibold">· {STATUS[o.status]}</span></div>
              <div className="text-sm text-[#C4C4C9] mt-1 truncate">{o.customer_name ?? 'Cliente'} · {qtd(o.itens)} itens · {o.payment_hint ?? 'pagamento a combinar'} · {ha(o.created_at)}</div>
            </div>
            <span className="text-lg font-extrabold num">{brlc(o.total)}</span>
          </button>
        )
      })}
      {pedidos.length === 0 && <div className="py-6 text-center text-sm text-[#C4C4C9]">Nenhum pedido para receber agora.</div>}
    </Sheet>
  )
}
