import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { brlc, centavos, reais } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { BarraLista, SemResultado, norm } from '@/components/filtros'
import { useEstoque, type ProdutoLoja } from '@/features/estoque/dados'
import { chip, qtd } from '@/lib/visual'

type Combo = {
  id: string; kind: string; name: string; price: number; active: boolean; show_in_catalog: boolean
  starts_at: string | null; ends_at: string | null; weekdays: number[] | null; start_time: string | null; end_time: string | null
  bundle_items: { product_id: string; quantity: number }[]
}

function rows<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

function useCombos(storeId: string | null) {
  return useQuery({
    queryKey: ['combos', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const desde = new Date(Date.now() - 7 * 864e5).toISOString()
      const [combos, loja, vendidos] = await Promise.all([
        supabase.from('bundles').select('id, kind, name, price, active, show_in_catalog, starts_at, ends_at, weekdays, start_time, end_time, bundle_items(product_id, quantity)').is('archived_at', null).order('name'),
        supabase.from('store_bundles').select('bundle_id, price, active').eq('store_id', storeId!),
        supabase.from('sale_items').select('bundle_id, quantity, sales!inner(status, created_at)').eq('store_id', storeId!)
          .not('bundle_id', 'is', null).eq('sales.status', 'paid').gte('sales.created_at', desde),
      ])
      const sold = new Map<string, number>()
      for (const v of rows(vendidos)) sold.set(v.bundle_id!, (sold.get(v.bundle_id!) ?? 0) + Number(v.quantity))
      return {
        combos: rows(combos) as unknown as Combo[],
        loja: new Map(rows(loja).map((x) => [x.bundle_id, x])),
        sold,
      }
    },
  })
}

/** Interruptor do protótipo (tog). */
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="w-[52px] h-[30px] rounded-full flex-none relative cursor-pointer transition" style={{ background: on ? '#FBC009' : '#2A2A2E' }}>
      <span className="absolute top-[3px] w-6 h-6 rounded-full transition-all" style={{ left: on ? 25 : 3, background: on ? '#0A0A0B' : '#ADADB4' }} />
    </button>
  )
}

export function Combos() {
  const { storeId } = useAuth()
  const est = useEstoque(storeId)
  const { data, error, isLoading } = useCombos(storeId)
  const qc = useQueryClient()
  const toast = useToast()
  const [edit, setEdit] = useState<Combo | 'novo' | null>(null)
  const [q, setQ] = useState('')
  const [fSit, setFSit] = useState('todos')
  const [fCat, setFCat] = useState('todos')

  if (isLoading || est.isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || est.error || !data || !est.data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar as promoções. {(error ?? est.error)?.message}</div>

  const prod = new Map(est.data.produtos.map((p) => [p.product_id, p]))
  const qn = norm(q.trim())
  const ativoNaLoja = (c: Combo) => c.active && data.loja.get(c.id)?.active !== false
  const combos = data.combos.filter((c) => (!qn || norm(`${c.name} ${c.bundle_items.map((i) => prod.get(i.product_id)?.name ?? '').join(' ')}`).includes(qn))
    && (fSit === 'todos' || (fSit === 'ativas') === ativoNaLoja(c)) && (fCat === 'todos' || (fCat === 'sim') === c.show_in_catalog))
  const limpar = () => { setQ(''); setFSit('todos'); setFCat('todos') }
  const custo = (c: Combo) => c.bundle_items.reduce((a, i) => a + (prod.get(i.product_id)?.avg_cost ?? 0) * Number(i.quantity), 0)
  const separado = (c: Combo) => c.bundle_items.reduce((a, i) => a + (prod.get(i.product_id)?.price ?? 0) * Number(i.quantity), 0)
  const verCusto = est.data.produtos.some((p) => p.avg_cost != null)
  const recarregar = () => Promise.all(['combos', 'caixa', 'inicio'].map((k) => qc.invalidateQueries({ queryKey: [k] })))

  const alternar = async (c: Combo) => {
    try {
      await rpc('save_bundle', { p_account_id: est.data!.accountId, p_bundle: { ...c, bundle_items: undefined, active: !c.active, items: c.bundle_items } })
      toast(c.active ? `“${c.name}” pausada` : `“${c.name}” ativa no caixa`)
      await recarregar()
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-[1_1_260px] text-[15px] text-[#C4C4C9] leading-[1.45]">Promoções aparecem no caixa e no catálogo do WhatsApp. O estoque de cada item é baixado na venda.</div>
        <button onClick={() => setEdit('novo')} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Criar promoção</button>
      </div>

      <BarraLista busca={q} onBusca={setQ} placeholder="Buscar promoção ou produto" mostrando={combos.length} total={data.combos.length} unidade={['promoção', 'promoções']} onLimpar={limpar}
        filtros={[
          { label: 'Situação', value: fSit, onChange: setFSit, options: [['todos', 'Todas'], ['ativas', 'Ativas'], ['pausadas', 'Pausadas']] },
          { label: 'No WhatsApp', value: fCat, onChange: setFCat, options: [['todos', 'Tanto faz'], ['sim', 'Aparece'], ['nao', 'Não aparece']] },
        ]} />
      <div className="grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {combos.map((c) => {
          const lb = data.loja.get(c.id)
          const preco = lb?.price ?? c.price
          const cu = custo(c)
          const ativo = c.active && lb?.active !== false
          return (
            <div key={c.id} className="p-5 rounded-[4px_13px_5px_11px] bg-surface border border-line flex flex-col gap-3.5" style={{ opacity: ativo ? 1 : 0.7 }}>
              <div className="flex items-start gap-3">
                <button onClick={() => setEdit(c)} className="flex-1 text-left text-[19px] font-black leading-[1.15] bg-transparent cursor-pointer" style={{ fontStretch: '100%' }}>{c.name}</button>
                <Toggle on={c.active} onClick={() => alternar(c)} />
              </div>
              <div className="flex flex-col gap-[5px]">
                {c.bundle_items.map((i) => <div key={i.product_id} className="text-sm text-[#C9C9CC]">{qtd(Number(i.quantity))}× {prod.get(i.product_id)?.name ?? 'Produto'}</div>)}
              </div>
              <div className="flex items-baseline justify-between gap-2.5 pt-3 border-t border-line">
                <span className="text-[28px] font-black num" style={{ fontStretch: '100%' }}>{brlc(preco)}</span>
                {verCusto && preco > 0 && <span className="text-[13px] font-extrabold text-brand">{Math.round((1 - cu / preco) * 100)}% margem</span>}
              </div>
              <div className="text-sm text-[#C4C4C9] leading-normal">
                {verCusto ? `Custo ${brlc(cu)} · ` : ''}separado sai {brlc(separado(c))}<br />
                {qtd(data.sold.get(c.id) ?? 0)} vendidos na semana · {ativo ? (c.show_in_catalog ? 'No caixa e no catálogo' : 'No caixa') : 'Pausado'}
              </div>
            </div>
          )
        })}
      </div>
      {combos.length === 0 && <SemResultado filtrado={!!qn || fSit !== 'todos' || fCat !== 'todos'} vazio="Nenhuma promoção ainda. Monte um combo com produtos que vencem logo ou que vendem juntos." onLimpar={limpar} />}

      {edit && <Editor combo={edit === 'novo' ? null : edit} produtos={est.data.produtos} accountId={est.data.accountId} verCusto={verCusto}
        onClose={() => setEdit(null)} onDone={recarregar} />}
    </div>
  )
}

function Editor({ combo, produtos, accountId, verCusto, onClose, onDone }: {
  combo: Combo | null; produtos: ProdutoLoja[]; accountId: string; verCusto: boolean; onClose: () => void; onDone: () => Promise<unknown>
}) {
  const toast = useToast()
  const [nome, setNome] = useState(combo?.name ?? '')
  const [preco, setPreco] = useState(reais(combo?.price))
  const [catalogo, setCatalogo] = useState(combo?.show_in_catalog ?? true)
  const [itens, setItens] = useState<Record<string, number>>(() => Object.fromEntries((combo?.bundle_items ?? []).map((i) => [i.product_id, Number(i.quantity)])))
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const prod = new Map(produtos.map((p) => [p.product_id, p]))
  const sel = Object.entries(itens).filter(([, n]) => n > 0)
  const cu = sel.reduce((a, [id, n]) => a + (prod.get(id)?.avg_cost ?? 0) * n, 0)
  const sep = sel.reduce((a, [id, n]) => a + (prod.get(id)?.price ?? 0) * n, 0)
  const pv = centavos(preco)
  const margem = pv ? Math.round((1 - cu / pv) * 100) : null
  const busca = q.trim().toLowerCase()
  const lista = produtos.filter((p) => !busca || p.name.toLowerCase().includes(busca)).slice(0, 40)
  const muda = (id: string, d: number) => setItens((x) => ({ ...x, [id]: Math.max(0, (x[id] ?? 0) + d) }))

  const salvar = async () => {
    if (!nome.trim()) return toast('Dê um nome à promoção')
    if (!sel.length) return toast('Escolha os produtos que entram no combo')
    if (!pv) return toast('Informe o preço do combo')
    setBusy(true)
    try {
      await rpc('save_bundle', { p_account_id: accountId, p_bundle: {
        id: combo?.id ?? null, kind: combo?.kind ?? 'combo', name: nome.trim(), price: pv, active: combo?.active ?? true, show_in_catalog: catalogo,
        starts_at: combo?.starts_at, ends_at: combo?.ends_at, weekdays: combo?.weekdays, start_time: combo?.start_time, end_time: combo?.end_time,
        items: sel.map(([product_id, quantity]) => ({ product_id, quantity })),
      } })
      toast(combo ? 'Promoção salva' : `“${nome.trim()}” criada`)
      await onDone()
      onClose()
    } catch (e) {
      toast((e as Error).message)
      setBusy(false)
    }
  }

  const apagar = async () => {
    setBusy(true)
    try {
      await rpc('archive_bundle', { p_account_id: accountId, p_bundle_id: combo!.id })
      toast(`“${combo!.name}” excluída`)
      await onDone()
      onClose()
    } catch (e) {
      toast((e as Error).message)
      setBusy(false)
    }
  }

  const campo = 'h-[52px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base w-full outline-none focus:border-brand'
  return (
    <Sheet title={combo ? 'Editar promoção' : 'Nova promoção'} onClose={onClose} footer={<button onClick={salvar} disabled={busy} className={bigBtn}>{busy ? 'Salvando…' : 'Salvar promoção'}</button>}>
      <label className="flex flex-col gap-2"><span className="text-sm font-bold text-[#C4C4C9]">Nome do combo</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Combo Gin + Tônica" className={campo} /></label>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Itens</span>
        <div className="flex items-center gap-2.5 h-11 px-3 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-[#C4C4C9]">
          <Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no estoque" className="flex-1 min-w-0 h-full bg-transparent border-none text-[15px] text-ink outline-none" />
        </div>
        <div className="max-h-[230px] overflow-y-auto rounded-[3px_10px_2px_9px] border border-line-2 bg-surface">
          {lista.map((p) => (
            <div key={p.product_id} onClick={() => muda(p.product_id, 1)} className="flex items-center gap-3 py-2.5 px-3 border-b border-line cursor-pointer hover:bg-surface-2">
              <span className="flex-1 text-sm font-semibold">{p.name}</span>
              <span className="text-[13px] text-[#ADADB4] num">{brlc(p.price)}</span>
              <Icon name="plus" size={18} />
            </div>
          ))}
        </div>
      </div>
      {sel.length === 0 && <div className="text-sm text-[#ADADB4]">Escolha os produtos que entram no combo.</div>}
      {sel.map(([id, n]) => (
        <div key={id} className="flex items-center gap-3 py-2 border-b border-line">
          <span className="flex-1 text-sm font-semibold">{prod.get(id)?.name ?? 'Produto'}</span>
          <div className="flex items-center bg-surface-2 rounded-[2px_8px_3px_7px] border border-line-2">
            <button onClick={() => muda(id, -1)} className="w-10 h-10 flex items-center justify-center cursor-pointer"><Icon name="minus" /></button>
            <span className="min-w-6 text-center font-extrabold">{n}</span>
            <button onClick={() => muda(id, 1)} className="w-10 h-10 flex items-center justify-center cursor-pointer"><Icon name="plus" /></button>
          </div>
        </div>
      ))}
      <label className="flex flex-col gap-2"><span className="text-sm font-bold text-[#C4C4C9]">Preço do combo (R$)</span>
        <input value={preco} onChange={(e) => setPreco(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="0,00" className={`${campo} text-lg font-bold`} /></label>
      <div className="grid grid-cols-3 gap-2">
        {[['Custo', verCusto ? brlc(cu) : '—', '#F5F5F2'], ['Separado', brlc(sep), '#F5F5F2'],
          ['Margem', verCusto && margem != null ? `${margem}%` : '—', margem == null || !verCusto ? '#F5F5F2' : margem < 15 ? '#FF6B5E' : '#4ADE80']].map(([l, v, c]) => (
          <div key={l} className="p-3 rounded-[3px_10px_2px_9px] bg-surface-2">
            <div className="text-[13px] text-[#C4C4C9] font-semibold">{l}</div>
            <div className="text-base font-extrabold mt-1 num" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <button onClick={() => setCatalogo(!catalogo)} className="flex items-center gap-3 text-left cursor-pointer">
        <span className="w-6 h-6 rounded-[2px_7px_3px_6px] flex items-center justify-center flex-none" style={{ ...chip(catalogo), transform: 'none' }}>{catalogo && <Icon name="check" size={16} />}</span>
        <span className="text-sm font-semibold">Mostrar também no catálogo do WhatsApp</span>
      </button>
      {combo && !excluir && (
        <button onClick={() => setExcluir(true)} className="self-start h-11 px-3.5 rounded-[2px_8px_3px_7px] border border-[#FF2D2D] text-[#FF6B5E] text-sm font-bold flex items-center gap-2 cursor-pointer"><Icon name="x" size={16} />Excluir promoção</button>
      )}
      {combo && excluir && (
        <div className="flex flex-wrap items-center gap-2.5 p-3.5 rounded-[3px_10px_2px_9px] bg-[rgba(255,45,45,.08)] border border-[rgba(255,45,45,.35)]">
          <span className="flex-[1_1_160px] text-[15px] font-bold">Excluir esta promoção?</span>
          <button onClick={() => setExcluir(false)} className="h-10 px-3.5 rounded-[2px_8px_3px_7px] border border-line-2 text-sm font-bold cursor-pointer">Cancelar</button>
          <button onClick={apagar} disabled={busy} className="h-10 px-3.5 rounded-[2px_8px_3px_7px] bg-[#E5241B] text-white text-sm font-extrabold cursor-pointer disabled:opacity-60">Excluir</button>
        </div>
      )}
    </Sheet>
  )
}
