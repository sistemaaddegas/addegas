import { useState, type ReactNode } from 'react'
import { rpc } from '@/lib/supabase'
import { brlc, centavos } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { canal } from '@/components/canal'
import { useCatalogo } from '@/features/caixa/dados'
import { chip, chipCls } from '@/lib/visual'

const CANAIS = ['whatsapp', 'phone', 'ifood', 'ze_delivery', 'food99', 'keeta'] as const
const MODOS = [['own_delivery', 'Entrega própria'], ['pickup', 'Retirada'], ['platform_delivery', 'Entregador do app']] as const
const PAGTO = ['Pix na entrega', 'Dinheiro', 'Cartão na entrega', 'Pago no app', 'Fiado']
const campo = 'h-12 px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-[15px] w-full outline-none focus:border-brand'

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 min-w-0"><span className="text-sm font-bold text-[#C4C4C9]">{label}</span>{children}</label>
}

/**
 * Pedido lançado à mão (E41): WhatsApp e telefone, e os dos apps enquanto a integração não chega.
 * O preço e a taxa são calculados no banco; aqui é só uma prévia.
 */
export function NovoPedido({ storeId, onClose, onDone }: { storeId: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast()
  const { data: cat } = useCatalogo(storeId)
  const [ch, setCh] = useState<(typeof CANAIS)[number]>('whatsapp')
  const [modo, setModo] = useState<(typeof MODOS)[number][0]>('own_delivery')
  const [f, setF] = useState({ nome: '', fone: '', endereco: '', pagto: 'Pix na entrega', obs: '', taxa: '', externo: '' })
  const [itens, setItens] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const app = !['whatsapp', 'phone'].includes(ch)
  const porKey = new Map((cat?.itens ?? []).map((p) => [p.key, p]))
  const sel = Object.entries(itens).filter(([, n]) => n > 0)
  const subtotal = sel.reduce((a, [k, n]) => a + (porKey.get(k)?.price ?? 0) * n, 0)
  const busca = q.trim().toLowerCase()
  const lista = (cat?.itens ?? []).filter((p) => busca && p.name.toLowerCase().includes(busca)).slice(0, 8)
  const muda = (k: string, d: number) => setItens((x) => ({ ...x, [k]: Math.max(0, (x[k] ?? 0) + d) }))

  const salvar = async () => {
    if (!sel.length) return toast('Adicione os itens do pedido')
    if (modo === 'own_delivery' && !f.endereco.trim()) return toast('Informe o endereço de entrega')
    setBusy(true)
    try {
      const r = await rpc<{ number: number; total: number }>('create_order', { p_store_id: storeId, p: {
        channel: ch, mode: modo, customer_name: f.nome.trim() || null, customer_phone: f.fone, address: f.endereco.trim() || null,
        notes: f.obs.trim() || null, payment_hint: f.pagto, external_id: f.externo.trim() || null,
        ...(modo === 'own_delivery' && f.taxa ? { delivery_fee: centavos(f.taxa) } : {}),
        items: sel.map(([k, n]) => { const p = porKey.get(k)!; return p.kind === 'product' ? { product_id: p.id, quantity: n } : { bundle_id: p.id, quantity: n } }),
      } })
      toast(`Pedido #${r.number} lançado · ${brlc(r.total)}`)
      await onDone()
      onClose()
    } catch (e) {
      toast((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title="Lançar pedido" onClose={onClose} footer={<button onClick={salvar} disabled={busy} className={bigBtn}>{busy ? 'Lançando…' : `Lançar pedido${subtotal ? ` · ${brlc(subtotal)}` : ''}`}</button>}>
      <div className="flex flex-wrap gap-2">
        {CANAIS.map((c, k) => <button key={c} onClick={() => { setCh(c); if (!['whatsapp', 'phone'].includes(c)) { setModo('platform_delivery'); setF((x) => ({ ...x, pagto: 'Pago no app' })) } }} className={chipCls} style={chip(ch === c, k)}>{canal(c).nome}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {MODOS.map(([id, l], k) => <button key={id} onClick={() => setModo(id)} className={chipCls} style={chip(modo === id, k + 1)}>{l}</button>)}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Itens</span>
        <div className="flex items-center gap-2.5 h-11 px-3 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-[#C4C4C9]">
          <Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto ou combo" className="flex-1 min-w-0 h-full bg-transparent text-[15px] text-ink outline-none" />
        </div>
        {lista.map((p) => (
          <button key={p.key} onClick={() => { muda(p.key, 1); setQ('') }} className="flex items-center gap-3 py-2.5 px-3 rounded-[2px_8px_3px_7px] border border-line bg-surface text-left cursor-pointer">
            <span className="flex-1 text-sm font-semibold">{p.name}</span><span className="text-[13px] text-[#ADADB4] num">{brlc(p.price)}</span><Icon name="plus" size={18} />
          </button>
        ))}
        {sel.map(([k, n]) => (
          <div key={k} className="flex items-center gap-3 py-1.5 border-b border-line">
            <span className="flex-1 text-sm font-semibold">{porKey.get(k)?.name}</span>
            <span className="text-[13px] text-[#ADADB4] num">{brlc((porKey.get(k)?.price ?? 0) * n)}</span>
            <div className="flex items-center bg-surface-2 rounded-[2px_8px_3px_7px] border border-line-2">
              <button onClick={() => muda(k, -1)} className="w-9 h-9 flex items-center justify-center cursor-pointer"><Icon name="minus" size={18} /></button>
              <span className="min-w-6 text-center font-extrabold">{n}</span>
              <button onClick={() => muda(k, 1)} className="w-9 h-9 flex items-center justify-center cursor-pointer"><Icon name="plus" size={18} /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="Cliente"><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className={campo} /></Campo>
        <Campo label="Telefone"><input value={f.fone} onChange={(e) => setF({ ...f, fone: e.target.value })} inputMode="tel" className={campo} /></Campo>
      </div>
      {modo !== 'pickup' && <Campo label="Endereço"><input value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} placeholder="Rua, número, complemento" className={campo} /></Campo>}
      <div className="grid grid-cols-2 gap-2.5">
        {modo === 'own_delivery' && <Campo label="Taxa de entrega (R$)"><input value={f.taxa} onChange={(e) => setF({ ...f, taxa: e.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" placeholder="Padrão da loja" className={campo} /></Campo>}
        {app && <Campo label={`Número no ${canal(ch).nome}`}><input value={f.externo} onChange={(e) => setF({ ...f, externo: e.target.value })} placeholder="Evita lançar duas vezes" className={campo} /></Campo>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Pagamento</span>
        <div className="flex flex-wrap gap-2">{PAGTO.map((p, k) => <button key={p} onClick={() => setF({ ...f, pagto: p })} className={chipCls} style={chip(f.pagto === p, k)}>{p}</button>)}</div>
      </div>
      <Campo label="Observação"><input value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} placeholder="Ex.: troco para R$ 100, gelo extra" className={campo} /></Campo>
    </Sheet>
  )
}
