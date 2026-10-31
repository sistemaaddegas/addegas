import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rpc, supabase } from '@/lib/supabase'
import { brlc, centavos } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn, chipBtn, moneyInput } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { BarraLista, SemResultado } from '@/components/filtros'
import { hora, pill, pillCls } from '@/lib/visual'
import { imprimirCupom } from './cupom'
import type { Operador } from './dados'

type VendaLinha = { id: string; number: number; total: number; status: 'paid' | 'canceled'; created_at: string; order_id: string | null; sale_payments: { method: string }[] }
const FORMA: Record<string, string> = { cash: 'Dinheiro', pix: 'Pix', credit: 'Crédito', debit: 'Débito', fiado: 'Fiado', voucher: 'Vale' }
const MOTIVOS = ['Lançado errado', 'Cliente desistiu', 'Cobrança duplicada']

/** Últimas vendas deste caixa: segunda via do cupom e cancelamento com motivo (E21). */
export function UltimasVendas({ op, onClose, onCancelada }: { op: Operador; onClose: () => void; onCancelada: () => void }) {
  const toast = useToast()
  const [cancelar, setCancelar] = useState<VendaLinha | null>(null)
  const [q, setQ] = useState('')
  const [fForma, setFForma] = useState('todos')
  const [fSit, setFSit] = useState('todos')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['caixa', 'ultimas-vendas'],
    queryFn: async () => {
      // A RLS deixa o aparelho ver só as vendas dele.
      const { data, error } = await supabase.from('sales').select('id, number, total, status, created_at, order_id, sale_payments(method)')
        .order('created_at', { ascending: false }).limit(30)
      if (error) throw new Error(error.message)
      return data as unknown as VendaLinha[]
    },
  })
  const todas = data ?? []
  const qd = q.replace(/\D/g, '')
  const lista = todas.filter((v) => (!qd || String(v.number).includes(qd)) && (fForma === 'todos' || v.sale_payments.some((p) => p.method === fForma))
    && (fSit === 'todos' || v.status === fSit))
  const limpar = () => { setQ(''); setFForma('todos'); setFSit('todos') }
  return (
    <>
      <Sheet title="Últimas vendas" onClose={onClose}>
        {isLoading && <div className="text-sm text-[#C4C4C9]">Carregando…</div>}
        <BarraLista busca={q} onBusca={setQ} placeholder="Número da venda" mostrando={lista.length} total={todas.length} unidade={['venda', 'vendas']} onLimpar={limpar}
          filtros={[
            { label: 'Forma', value: fForma, onChange: setFForma, options: [['todos', 'Todas'], ...Object.entries(FORMA)] },
            { label: 'Situação', value: fSit, onChange: setFSit, options: [['todos', 'Todas'], ['paid', 'Pagas'], ['canceled', 'Canceladas']] },
          ]} />
        <div>
          {lista.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 border-b border-line">
              <div className="flex-[1_1_150px] min-w-0">
                <div className="text-[15px] font-bold">#{v.number} · <span className="num">{brlc(v.total)}</span></div>
                <div className="text-[13px] text-[#C4C4C9] mt-0.5">{hora(v.created_at)} · {[...new Set(v.sale_payments.map((p) => FORMA[p.method] ?? p.method))].join(' + ') || '—'}{v.order_id ? ' · pedido' : ''}</div>
              </div>
              {v.status === 'canceled' && <span className={pillCls} style={pill('#FF6B5E', 'rgba(255,107,94,.12)')}>Cancelada</span>}
              <button onClick={() => imprimirCupom(v.id).catch((e) => toast((e as Error).message))} title="Imprimir cupom" className="h-9 px-3 rounded-[2px_7px_3px_6px] border border-line-2 bg-surface-2 text-[13px] font-bold flex items-center gap-1.5 cursor-pointer"><Icon name="receipt" size={16} />Cupom</button>
              {v.status === 'paid' && !v.order_id && (
                <button onClick={() => setCancelar(v)} className="h-9 px-3 rounded-[2px_7px_3px_6px] border border-[#FF2D2D] text-[#FF6B5E] text-[13px] font-bold cursor-pointer">Cancelar</button>
              )}
            </div>
          ))}
          {data && !lista.length && <SemResultado filtrado={!!qd || fForma !== 'todos' || fSit !== 'todos'} vazio="Nenhuma venda neste caixa ainda." onLimpar={limpar} />}
        </div>
      </Sheet>
      {cancelar && <CancelarVenda op={op} venda={cancelar} onClose={() => setCancelar(null)} onDone={() => { setCancelar(null); refetch(); onCancelada() }} />}
    </>
  )
}

function CancelarVenda({ op, venda, onClose, onDone }: { op: Operador; venda: VendaLinha; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const dinheiro = venda.sale_payments.some((p) => p.method === 'cash')
  const ok = async () => {
    setBusy(true)
    try {
      await rpc('cancel_sale', { p_operator_session_id: op.sessionId, p_sale_id: venda.id, p_reason: motivo.trim() })
      toast(`Venda #${venda.number} cancelada${dinheiro ? '. Devolva o dinheiro da gaveta' : ''}`)
      onDone()
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  return (
    <Sheet title={`Cancelar a venda #${venda.number}?`} onClose={onClose} footer={
      <button onClick={ok} disabled={busy || motivo.trim().length < 3} className={bigBtn} style={{ background: '#E5241B', color: '#FFFFFF' }}>{busy ? 'Cancelando…' : `Cancelar venda de ${brlc(venda.total)}`}</button>}>
      <div className="text-sm text-[#C4C4C9] -mt-2">Os itens voltam para o estoque{dinheiro ? ', o dinheiro sai da gaveta' : ''} e o motivo fica registrado. Depois do fechamento do caixa, só dono ou gerente cancela.</div>
      <div className="flex flex-wrap gap-2">{MOTIVOS.map((m) => <button key={m} onClick={() => setMotivo(m)} className={chipBtn(motivo === m)}>{m}</button>)}</div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ou escreva o motivo" className="h-12 px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 outline-none focus:border-brand" />
    </Sheet>
  )
}

/** Sangria, reforço e pagamento de entregador pela gaveta (permissão "sangria"). */
export function Gaveta({ op, onClose, onDone }: { op: Operador; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [tipo, setTipo] = useState<'withdrawal' | 'reinforcement' | 'courier_payment'>('withdrawal')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const pedeMotivo = tipo !== 'reinforcement'
  const ok = centavos(valor) > 0 && (!pedeMotivo || motivo.trim().length >= 3) && !busy
  const salvar = async () => {
    setBusy(true)
    try {
      await rpc('cash_movement', { p_operator_session_id: op.sessionId, p_type: tipo, p_amount: centavos(valor), p_reason: motivo.trim() || null })
      toast(tipo === 'reinforcement' ? `Reforço de ${brlc(centavos(valor))} na gaveta` : `${brlc(centavos(valor))} saiu da gaveta`)
      onDone()
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  return (
    <Sheet title="Movimentar gaveta" onClose={onClose} footer={<button onClick={salvar} disabled={!ok} className={bigBtn}>{busy ? 'Salvando…' : 'Confirmar'}</button>}>
      <div className="flex flex-wrap gap-2">
        {([['withdrawal', 'Sangria'], ['reinforcement', 'Reforço'], ['courier_payment', 'Pagar entregador']] as const).map(([k, l]) => <button key={k} onClick={() => setTipo(k)} className={chipBtn(tipo === k)}>{l}</button>)}
      </div>
      <input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="0,00" autoFocus className={moneyInput} />
      {pedeMotivo && <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'withdrawal' ? 'Motivo, ex.: depósito no banco' : 'Entregador e pedido'} className="h-12 px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 outline-none focus:border-brand" />}
      <div className="text-[13px] text-[#ADADB4]">Entra no fechamento do caixa: o dinheiro esperado na gaveta já desconta a sangria e soma o reforço.</div>
    </Sheet>
  )
}
