import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { brlc } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { canal } from '@/components/canal'
import { chip, chipCls, dot, ha, minutos, qtd, seg, segBar, segCls } from '@/lib/visual'
import { usePedidos, type Entregador, type Pedido } from './dados'
import { NovoPedido } from './novo-pedido'

// Abas do protótipo (OT) e os status do banco que entram em cada uma.
const ABAS = [
  { id: 'new', label: 'Novos', status: ['new'] },
  { id: 'preparing', label: 'Em preparo', status: ['preparing'] },
  { id: 'ready', label: 'Prontos', status: ['ready'] },
  { id: 'out_for_delivery', label: 'Em rota', status: ['out_for_delivery'] },
  { id: 'done', label: 'Concluídos', status: ['delivered', 'completed'] },
] as const
type Aba = (typeof ABAS)[number]['id']

const FILTROS = ['ifood', 'ze_delivery', 'food99', 'keeta', 'whatsapp', 'phone']
const MOTIVOS = ['Sem estoque', 'Fora da área de entrega', 'Loja fechando', 'Cliente desistiu']

function modo(o: Pedido) {
  if (o.mode === 'pickup') return 'Retirada no balcão'
  const onde = o.address ? ` · ${o.address}` : ''
  return (o.mode === 'own_delivery' ? 'Entrega própria' : `Entrega ${canal(o.channel).nome}`) + onde
}

function acao(o: Pedido, entregadores: Entregador[]): { label: string; next: string } | null {
  if (o.status === 'new') return { label: 'Aceitar pedido', next: 'preparing' }
  if (o.status === 'preparing') return { label: 'Marcar como pronto', next: 'ready' }
  if (o.status === 'ready') {
    if (o.mode === 'own_delivery') return { label: entregadores.length ? 'Chamar entregador' : 'Saiu para entrega', next: 'out_for_delivery' }
    return { label: o.mode === 'pickup' ? 'Entregue ao cliente' : 'Entregue ao entregador do app', next: 'delivered' }
  }
  if (o.status === 'out_for_delivery') return { label: 'Confirmar entrega', next: 'delivered' }
  return null
}

export function Pedidos() {
  const { storeId } = useAuth()
  const { data, error, isLoading } = usePedidos(storeId)
  const qc = useQueryClient()
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('new')
  const [ch, setCh] = useState('todos')
  const [busy, setBusy] = useState<string | null>(null)
  const [recusar, setRecusar] = useState<Pedido | null>(null)
  const [chamar, setChamar] = useState<Pedido | null>(null)
  const [novo, setNovo] = useState(false)

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar os pedidos. {error?.message}</div>

  const { pedidos, entregadores } = data
  const nomeEntregador = new Map(entregadores.map((e) => [e.id, e.display_name]))
  const ocupados = new Set(pedidos.filter((o) => o.status === 'out_for_delivery').map((o) => o.courier_member_id))
  const doCanal = pedidos.filter((o) => ch === 'todos' || o.channel === ch)
  const lista = doCanal.filter((o) => (ABAS.find((a) => a.id === aba)!.status as readonly string[]).includes(o.status))
  const filtros = ['todos', ...FILTROS, ...new Set(pedidos.map((o) => o.channel).filter((c) => !FILTROS.includes(c)))]

  const mudar = async (o: Pedido, status: string, motivo?: string, entregador?: string) => {
    setBusy(o.id)
    try {
      if (entregador) await rpc('assign_courier', { p_order_id: o.id, p_member_id: entregador })
      await rpc('set_order_status', { p_order_id: o.id, p_status: status, p_reason: motivo ?? null })
      const nome = entregador ? nomeEntregador.get(entregador)?.split(' ')[0] : null
      toast(status === 'preparing' ? `Pedido #${o.number} aceito` : status === 'ready' ? `Pedido #${o.number} pronto`
        : status === 'out_for_delivery' ? (nome ? `#${o.number} saiu com ${nome}` : `#${o.number} saiu para entrega`)
        : status === 'rejected' ? `Pedido #${o.number} recusado` : `Pedido #${o.number} concluído`)
      setRecusar(null)
      setChamar(null)
      await Promise.all([qc.invalidateQueries({ queryKey: ['pedidos'] }), qc.invalidateQueries({ queryKey: ['inicio'] })])
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const avancar = (o: Pedido) => {
    const a = acao(o, entregadores)
    if (!a) return
    if (a.next === 'out_for_delivery' && entregadores.length) return setChamar(o)
    void mudar(o, a.next)
  }

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-3.5 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-3">
      <div className={segBar}>
        {ABAS.map((t, k) => {
          const on = aba === t.id
          const n = doCanal.filter((o) => (t.status as readonly string[]).includes(o.status)).length
          const destaque = on && t.id === 'new' && n > 0
          return (
            <button key={t.id} onClick={() => setAba(t.id)} className={segCls} style={seg(on, k)}>
              {t.label}
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full text-[13px] font-extrabold flex items-center justify-center"
                style={{ background: destaque ? '#FBC009' : '#2A2A2E', color: destaque ? '#0A0A0B' : '#ADADB4' }}>{n}</span>
            </button>
          )
        })}
      </div>

      <span className="flex-1" />
      <button onClick={() => setNovo(true)} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer flex-none"><Icon name="plus" />Lançar pedido</button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-full">
        {filtros.map((id, k) => (
          <button key={id} onClick={() => setCh(id)} className={chipCls} style={chip(ch === id, k)}>
            {id !== 'todos' && <span style={dot(canal(id).cor)} />}{id === 'todos' ? 'Todos os canais' : canal(id).nome}
          </button>
        ))}
      </div>

      <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
        {lista.map((o) => {
          const a = acao(o, entregadores)
          const late = o.status === 'new' && minutos(o.created_at) >= 5
          const c = canal(o.channel)
          return (
            <div key={o.id} className="p-[18px] rounded-[4px_13px_5px_11px] bg-surface border border-line flex flex-col gap-3.5 min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-[7px] h-7 px-2.5 rounded-[2px_6px_2px_5px] bg-surface-2 text-[13px] font-extrabold"><span style={dot(c.cor)} />{c.nome}</span>
                <span className="text-sm text-[#C4C4C9] num">#{o.number}</span>
                <span className="flex-1" />
                <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: late ? '#FF6B5E' : '#ADADB4' }}><Icon name="clock" size={16} />{ha(o.created_at)}</span>
              </div>
              <div>
                <div className="text-lg font-extrabold">{o.customer_name || 'Cliente'}</div>
                <div className="text-sm text-[#C4C4C9] mt-1 leading-[1.4]">{modo(o)}</div>
                {o.notes && <div className="text-sm text-brand mt-1 leading-[1.4]">{o.notes}</div>}
              </div>
              <div className="flex flex-col gap-1.5 py-3 border-y border-dashed border-line-2">
                {o.itens.map((it, i) => <div key={i} className="text-sm leading-[1.35]">{qtd(it.quantity)}× {it.name}</div>)}
                {o.delivery_fee > 0 && <div className="text-sm leading-[1.35] text-[#C4C4C9]">Taxa de entrega {brlc(o.delivery_fee)}</div>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#C4C4C9]">{o.payment_hint ?? ''}</span>
                <span className="text-xl font-extrabold num">{brlc(o.total)}</span>
              </div>
              {o.status === 'out_for_delivery' && (
                <div className="flex items-center gap-2 py-2.5 px-3 rounded-[2px_8px_3px_7px] bg-[rgba(124,179,255,.10)] text-[#7CB3FF] text-sm font-bold">
                  <Icon name="truck" />{o.courier_member_id ? `Em rota com ${nomeEntregador.get(o.courier_member_id) ?? 'entregador'}` : 'Em rota'}
                </div>
              )}
              {a && (
                <div className="flex gap-2">
                  {o.status === 'new' && (
                    <button onClick={() => setRecusar(o)} disabled={busy === o.id} className="h-[50px] px-4 rounded-[3px_10px_2px_9px] border border-line-2 bg-transparent font-bold text-[15px] cursor-pointer">Recusar</button>
                  )}
                  <button onClick={() => avancar(o)} disabled={busy === o.id} className="flex-1 h-[50px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink font-extrabold text-[15px] cursor-pointer active:scale-[.98] disabled:opacity-60">
                    {busy === o.id ? 'Salvando…' : a.label}
                  </button>
                </div>
              )}
              {!a && (
                <div className="flex items-center gap-2 text-ok text-sm font-bold">
                  <Icon name="check" />Concluído
                  {!o.sale_id && <span className="ml-auto text-[13px] text-brand">Falta receber no caixa</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {lista.length === 0 && (
        <div className="flex flex-col items-center gap-3.5 py-14 px-5 text-center">
          <img src="/icons/dd-amarelo.png" alt="" className="w-16 -rotate-6" />
          <div className="text-xl font-black" style={{ fontStretch: '100%' }}>Nenhum pedido aqui.</div>
          <div className="text-sm text-[#C4C4C9]">Pedidos do iFood, Zé Delivery, 99Food, Keeta e WhatsApp entram automaticamente.</div>
        </div>
      )}

      {novo && <NovoPedido storeId={storeId!} onClose={() => setNovo(false)} onDone={() => Promise.all([qc.invalidateQueries({ queryKey: ['pedidos'] }), qc.invalidateQueries({ queryKey: ['inicio'] })])} />}
      {recusar && <Recusar o={recusar} busy={busy === recusar.id} onClose={() => setRecusar(null)} onOk={(m) => mudar(recusar, 'rejected', m)} />}
      {chamar && (
        <Sheet title={`Quem leva o #${chamar.number}?`} onClose={() => setChamar(null)}>
          <div className="text-sm text-[#C4C4C9] -mt-2">{chamar.customer_name} · {chamar.address}</div>
          {entregadores.map((e) => (
            <button key={e.id} onClick={() => mudar(chamar, 'out_for_delivery', undefined, e.id)} disabled={busy === chamar.id}
              className="flex items-center gap-3 h-[60px] px-4 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-left cursor-pointer disabled:opacity-60">
              <Icon name="truck" /><span className="flex-1 font-bold">{e.display_name}</span>
              <span className="text-[13px] font-bold" style={{ color: ocupados.has(e.id) ? '#FBC009' : '#4ADE80' }}>{ocupados.has(e.id) ? 'Em outra entrega' : 'Livre'}</span>
            </button>
          ))}
          <button onClick={() => mudar(chamar, 'out_for_delivery')} disabled={busy === chamar.id} className="self-start p-0 bg-transparent text-brand text-sm font-bold cursor-pointer">Saiu sem entregador cadastrado</button>
        </Sheet>
      )}
    </div>
  )
}

function Recusar({ o, busy, onClose, onOk }: { o: Pedido; busy: boolean; onClose: () => void; onOk: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('')
  const ok = motivo.trim().length >= 3
  return (
    <Sheet title={`Recusar o #${o.number}?`} onClose={onClose}
      footer={<button onClick={() => ok && onOk(motivo.trim())} disabled={!ok || busy} className={bigBtn} style={{ background: '#E5241B', color: '#FFFFFF' }}>{busy ? 'Recusando…' : 'Recusar pedido'}</button>}>
      <div className="text-sm text-[#C4C4C9] -mt-2">O motivo fica no histórico do pedido.</div>
      <div className="flex flex-wrap gap-2">
        {MOTIVOS.map((m, k) => <button key={m} onClick={() => setMotivo(m)} className={chipCls} style={chip(motivo === m, k)}>{m}</button>)}
      </div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ou escreva o motivo"
        className="h-[52px] px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base outline-none focus:border-brand" />
    </Sheet>
  )
}
