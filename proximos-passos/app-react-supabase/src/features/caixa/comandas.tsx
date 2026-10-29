import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rpc, supabase } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn, chipBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { chip } from '@/lib/visual'
import type { Operador } from './dados'

export type ItemComanda = { id: string; product_id: string | null; bundle_id: string | null; name: string; quantity: number; unit_price: number; added_at: string }
export type Comanda = { id: string; kind: 'table' | 'tab'; label: string; nickname: string | null; opened_at: string; itens: ItemComanda[] }

/** Mesas e comandas abertas da loja (E22), com os itens que ainda valem. */
export function useComandas(storeId: string) {
  return useQuery({
    queryKey: ['caixa', 'comandas', storeId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('tabs').select('id, kind, label, nickname, opened_at, tab_items(id, product_id, bundle_id, name, quantity, unit_price, added_at, removed_at)')
        .eq('store_id', storeId).eq('status', 'open').order('opened_at')
      if (error) throw new Error(error.message)
      return (data ?? []).map((t) => ({
        ...t, itens: t.tab_items.filter((i) => !i.removed_at).map((i) => ({ ...i, quantity: Number(i.quantity) })),
      })) as unknown as Comanda[]
    },
  })
}

/** Linhas do carrinho a partir dos itens da comanda, juntando o mesmo produto. */
export function linhasDaComanda(c: Comanda) {
  const m = new Map<string, { key: string; name: string; price: number; qty: number; lancamentos: { id: string; quantity: number }[] }>()
  for (const i of c.itens) {
    const key = i.product_id ? `p:${i.product_id}` : `b:${i.bundle_id}`
    const l = m.get(key) ?? { key, name: i.name, price: i.unit_price, qty: 0, lancamentos: [] }
    l.qty += i.quantity
    l.lancamentos.push({ id: i.id, quantity: i.quantity })
    m.set(key, l)
  }
  return [...m.values()]
}

export function BarraComandas({ comandas, atual, onEscolher, onNova, nBalcao }: {
  comandas: Comanda[]; atual: string | null; onEscolher: (id: string | null) => void; onNova: () => void; nBalcao: number
}) {
  const btn = 'h-9 px-3 text-[13px] font-bold cursor-pointer whitespace-nowrap flex-none flex items-center gap-1.5'
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-5 pb-3 flex-none">
      <button onClick={() => onEscolher(null)} className={btn} style={chip(atual === null, 0)}>Balcão{nBalcao > 0 && <span className="text-[11px] opacity-75">{nBalcao}</span>}</button>
      {comandas.map((c, k) => (
        <button key={c.id} onClick={() => onEscolher(c.id)} className={btn} style={chip(atual === c.id, k + 1)}>
          {c.label}<span className="text-[11px] opacity-75">{c.itens.reduce((a, i) => a + i.quantity, 0)}</span>
        </button>
      ))}
      <button onClick={onNova} className={`${btn} rounded-[2px_8px_3px_7px] border border-dashed border-[#3A3A40] text-[#C4C4C9]`}><Icon name="plus" size={16} />Mesa ou comanda</button>
    </div>
  )
}

export function NovaComanda({ op, existentes, onClose, onCriada }: { op: Operador; existentes: Comanda[]; onClose: () => void; onCriada: (id: string) => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<'table' | 'tab'>('table')
  const sugestao = (k: 'table' | 'tab') => {
    let n = 1
    while (existentes.some((c) => c.label.toLowerCase() === `${k === 'table' ? 'mesa' : 'comanda'} ${n}`)) n++
    return `${k === 'table' ? 'Mesa' : 'Comanda'} ${n}`
  }
  const [label, setLabel] = useState(sugestao('table'))
  const [apelido, setApelido] = useState('')
  const [busy, setBusy] = useState(false)
  const abrir = async () => {
    setBusy(true)
    try {
      const r = await rpc<{ tab_id: string }>('open_tab', { p_operator_session_id: op.sessionId, p_kind: kind, p_label: label.trim(), p_nickname: apelido.trim() || null })
      toast(`${label.trim()} aberta`)
      onCriada(r.tab_id)
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  return (
    <Sheet title="Abrir mesa ou comanda" onClose={onClose} footer={<button onClick={abrir} disabled={busy || !label.trim()} className={bigBtn}>{busy ? 'Abrindo…' : `Abrir ${label.trim()}`}</button>}>
      <div className="flex gap-2">
        {([['table', 'Mesa'], ['tab', 'Comanda']] as const).map(([k, l]) => <button key={k} onClick={() => { setKind(k); setLabel(sugestao(k)) }} className={chipBtn(kind === k)}>{l}</button>)}
      </div>
      <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 30))} placeholder="Ex.: Mesa 4" autoFocus className="h-[52px] px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-lg font-bold outline-none focus:border-brand" />
      <input value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Apelido (opcional), ex.: turma do João" className="h-12 px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 outline-none focus:border-brand" />
      <div className="text-[13px] text-[#ADADB4]">Cada item lançado na comanda já sai do estoque. Tirar um item depois pede o motivo.</div>
    </Sheet>
  )
}

const MOTIVOS = ['Lançado errado', 'Cliente desistiu', 'Trocou de produto']

export function TirarItem({ nome, onClose, onOk }: { nome: string; onClose: () => void; onOk: (motivo: string) => Promise<void> }) {
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={`Tirar ${nome}?`} onClose={onClose} footer={
      <button onClick={async () => { setBusy(true); await onOk(motivo.trim()); setBusy(false) }} disabled={busy || motivo.trim().length < 3} className={bigBtn} style={{ background: '#E5241B', color: '#FFFFFF' }}>{busy ? 'Tirando…' : 'Tirar da comanda'}</button>}>
      <div className="text-sm text-[#C4C4C9] -mt-2">O item volta para o estoque e o motivo fica registrado.</div>
      <div className="flex flex-wrap gap-2">{MOTIVOS.map((m) => <button key={m} onClick={() => setMotivo(m)} className={chipBtn(motivo === m)}>{m}</button>)}</div>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ou escreva o motivo" className="h-12 px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 outline-none focus:border-brand" />
    </Sheet>
  )
}
