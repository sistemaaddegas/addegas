import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { brlc, centavos, parseBRL, reais } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { BarraLista, SemResultado, norm, Paginacao, paginar, PG0, type Pg } from '@/components/filtros'
import { card, chip, chipCls, pill, pillCls, qtd, seg, segBar, segCls } from '@/lib/visual'
import { useEstoque, type Categoria, type ProdutoLoja } from './dados'

type Aba = 'produtos' | 'validade' | 'contagem'

const campo = 'h-[52px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base w-full outline-none focus:border-brand'
const hoje = () => new Date(new Date().toDateString())
const diasAte = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - hoje().getTime()) / 864e5)
const margem = (p: ProdutoLoja) => (p.avg_cost != null && p.price > 0 ? `${Math.round((1 - p.avg_cost / p.price) * 100)}%` : '—')

function Campo({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-2 min-w-0 ${className}`}><span className="text-sm font-bold text-[#C4C4C9]">{label}</span>{children}</label>
}

export function Estoque() {
  const { storeId } = useAuth()
  const { data, error, isLoading } = useEstoque(storeId)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('produtos')
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('todos')
  const [fSit, setFSit] = useState('todos')
  const [fOrig, setFOrig] = useState('todos')
  const [fVal, setFVal] = useState('todos')
  const [pgP, setPgP] = useState<Pg>(PG0)
  const [pgL, setPgL] = useState<Pg>(PG0)
  const [params, setParams] = useSearchParams()
  const [contagem, setContagem] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [modal, setModal] = useState<null | { tipo: 'entrada'; pid?: string } | { tipo: 'produto'; p: ProdutoLoja | null } | { tipo: 'catalogo' }>(null)
  // O cadastro com "Começar com catálogo pronto" chega aqui com ?catalogo=1.
  useEffect(() => { if (params.get('catalogo')) { setModal({ tipo: 'catalogo' }); setParams({}, { replace: true }) } }, [params, setParams])
  const { data: origem } = useQuery({
    queryKey: ['estoque', 'catalogo-status', data?.accountId], enabled: !!data?.accountId,
    queryFn: () => rpc<Record<string, 'catalogo' | 'pendente' | 'aprovada' | 'vinculada' | 'recusada' | 'local'>>('catalog_status', { p_account_id: data!.accountId }),
  })

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar o estoque. {error?.message}</div>

  const { produtos, lotes, categorias } = data
  const nomeCat = new Map(categorias.map((c) => [c.id, c.name]))
  const porId = new Map(produtos.map((p) => [p.product_id, p]))
  const verCusto = produtos.some((p) => p.avg_cost != null)
  const recarregar = () => Promise.all(['estoque', 'caixa', 'inicio'].map((k) => qc.invalidateQueries({ queryKey: [k] })))

  const baixo = produtos.filter((p) => p.below_min)
  const vencendo = lotes.filter((l) => diasAte(l.expires_on) <= 10)
  const stats: [string, string, string][] = [
    ['Abaixo do mínimo', `${baixo.length} ${baixo.length === 1 ? 'produto' : 'produtos'}`, '#FF6B5E'],
    ['Vencendo em 10 dias', `${qtd(vencendo.reduce((a, l) => a + l.remaining_qty, 0))} un`, '#FBC009'],
    ...(verCusto ? [['Valor em estoque (custo)', brlc(produtos.reduce((a, p) => a + Math.max(0, p.stock) * (p.avg_cost ?? 0), 0)), '#F5F5F2'] as [string, string, string]] : []),
  ]

  const qn = norm(q.trim())
  const orig = (p: ProdutoLoja) => { const o = origem?.[p.product_id] ?? 'local'; return o === 'aprovada' || o === 'vinculada' ? 'catalogo' : o }
  const lista = produtos.filter((p) => (!qn || norm(p.name).includes(qn) || (p.ean ?? '').startsWith(qn))
    && (fCat === 'todos' || (fCat === 'sem' ? !p.category_id : p.category_id === fCat))
    && (fSit === 'todos' || (fSit === 'baixo' ? p.below_min : fSit === 'zerado' ? p.stock <= 0 : !p.below_min && p.stock > 0))
    && (fOrig === 'todos' || orig(p) === fOrig))
  const filtrado = !!qn || fCat !== 'todos' || fSit !== 'todos' || fOrig !== 'todos'
  const limpar = () => { setQ(''); setFCat('todos'); setFSit('todos'); setFOrig('todos') }
  const pagP = paginar(lista, pgP, q + fCat + fSit + fOrig)
  const ORIGEM: Record<string, [string, string, string]> = { catalogo: ['Catálogo Addegas', '#4ADE80', 'rgba(74,222,128,.12)'], pendente: ['Em análise', '#FBC009', 'rgba(251,192,9,.12)'], recusada: ['Só nesta adega', '#ADADB4', '#232327'], local: ['Só nesta adega', '#ADADB4', '#232327'] }
  const lotesF = lotes.filter((l) => { const d = diasAte(l.expires_on); return fVal === 'todos' || (fVal === 'vencido' ? d < 0 : d >= 0 && d <= Number(fVal)) })
  const pagL = paginar(lotesF, pgL, fVal)
  const contados = Object.entries(contagem).filter(([, v]) => v !== '')

  const salvarContagem = async () => {
    if (!contados.length) return toast('Nenhuma quantidade informada')
    setSalvando(true)
    try {
      const { count_id } = await rpc<{ count_id: string }>('open_stock_count', { p_store_id: storeId })
      for (const [pid, v] of contados) await rpc('save_count_item', { p_count_id: count_id, p_product_id: pid, p_counted: parseBRL(v) })
      const { adjusted_items } = await rpc<{ adjusted_items: number }>('apply_stock_count', { p_count_id: count_id })
      setContagem({})
      toast(`Contagem salva · ${adjusted_items} ${adjusted_items === 1 ? 'ajuste' : 'ajustes'}`)
      await recarregar()
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap gap-3 items-center">
        <div className={segBar}>
          {(['produtos', 'validade', 'contagem'] as const).map((id, k) => (
            <button key={id} onClick={() => setAba(id)} className={segCls} style={seg(aba === id, k)}>{id[0].toUpperCase() + id.slice(1)}</button>
          ))}
        </div>
        <span className="flex-1" />
        <button onClick={() => setModal({ tipo: 'catalogo' })} className="h-12 px-4 rounded-[3px_10px_2px_9px] border border-line-2 bg-transparent text-[15px] font-bold flex items-center gap-2 cursor-pointer"><Icon name="search" />Do catálogo Addegas</button>
        <button onClick={() => setModal({ tipo: 'produto', p: null })} className="h-12 px-4 rounded-[3px_10px_2px_9px] border border-line-2 bg-transparent text-[15px] font-bold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Novo produto</button>
        <button onClick={() => setModal({ tipo: 'entrada' })} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2.5 cursor-pointer"><Icon name="down" />Entrada de mercadoria</button>
      </div>

      <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        {stats.map(([l, v, c]) => (
          <div key={l} className="py-4 px-[18px] rounded-[4px_13px_5px_11px] bg-surface border border-line">
            <div className="text-sm text-[#C4C4C9] font-semibold mb-2">{l}</div>
            <div className="text-[26px] font-extrabold num" style={{ color: c, fontStretch: '100%' }}>{v}</div>
          </div>
        ))}
      </div>

      {aba === 'produtos' && (
        <>
          <BarraLista busca={q} onBusca={setQ} placeholder="Buscar por nome ou código de barras" mostrando={lista.length} total={produtos.length} unidade={['produto', 'produtos']} onLimpar={limpar}
            filtros={[
              { label: 'Categoria', value: fCat, onChange: setFCat, options: [['todos', 'Todas'], ...categorias.map((c) => [c.id, c.name] as [string, string]), ['sem', 'Sem categoria']] },
              { label: 'Situação', value: fSit, onChange: setFSit, options: [['todos', 'Todas'], ['baixo', 'Abaixo do mínimo'], ['zerado', 'Sem estoque'], ['ok', 'Em dia']] },
              { label: 'Origem', value: fOrig, onChange: setFOrig, options: [['todos', 'Todas'], ['catalogo', 'Catálogo Addegas'], ['pendente', 'Em análise'], ['local', 'Só nesta adega']] },
            ]} />
          <div className={`${card} overflow-hidden`}>
            <div className="hidden tablet:grid grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)_84px_84px_96px_96px_72px] gap-3 py-3 px-[18px] text-[13px] font-bold text-[#C4C4C9] uppercase tracking-[.04em] border-b border-line">
              <span>Produto</span><span>Categoria</span><span className="text-right">Estoque</span><span className="text-right">Mínimo</span>
              <span className="text-right">Custo</span><span className="text-right">Preço</span><span className="text-right">Margem</span>
            </div>
            {pagP.itens.map((p) => (
              <button key={p.product_id} onClick={() => setModal({ tipo: 'produto', p })} className="w-full text-left bg-transparent cursor-pointer border-b border-[#1F1F22] hover:bg-surface-2">
                <div className="hidden tablet:grid grid-cols-[minmax(0,2.6fr)_minmax(0,1fr)_84px_84px_96px_96px_72px] gap-3 py-[13px] px-[18px] items-center text-sm num">
                  <div className="min-w-0"><div className="font-semibold truncate">{p.name}</div><div className="text-[13px] text-[#ADADB4] mt-[3px] flex items-center gap-2"><span>{p.ean ?? 'Sem código'}</span>{origem && <span className="text-[11px] font-bold" style={{ color: ORIGEM[orig(p)][1] }}>{ORIGEM[orig(p)][0]}</span>}</div></div>
                  <span className="text-[#C4C4C9] truncate">{nomeCat.get(p.category_id ?? '') ?? '—'}</span>
                  <span className="text-right font-extrabold" style={{ color: p.below_min ? '#FF6B5E' : '#F5F5F2' }}>{qtd(p.stock)} un</span>
                  <span className="text-right text-[#C4C4C9]">{qtd(p.min_stock)} un</span>
                  <span className="text-right text-[#C4C4C9]">{p.avg_cost != null ? brlc(p.avg_cost) : '—'}</span>
                  <span className="text-right font-bold">{brlc(p.price)}{p.store_price != null && <span className="block text-[11px] font-semibold text-brand">preço da loja</span>}</span>
                  <span className="text-right text-[#C4C4C9]">{margem(p)}</span>
                </div>
                <div className="tablet:hidden flex items-center gap-3 py-3.5 px-4">
                  <div className="flex-1 min-w-0"><div className="text-[15px] font-semibold leading-[1.3]">{p.name}</div><div className="text-[13px] text-[#ADADB4] mt-1">{nomeCat.get(p.category_id ?? '') ?? 'Sem categoria'} · {brlc(p.price)}</div></div>
                  <span className={pillCls} style={p.below_min ? pill('#FF6B5E', 'rgba(255,107,94,.12)') : pill('#F5F5F2', '#232327')}>{qtd(p.stock)} un</span>
                </div>
              </button>
            ))}
            <Paginacao p={pagP} onPg={setPgP} />
            {lista.length === 0 && <SemResultado filtrado={filtrado} vazio="Nenhum produto ainda. Traga do catálogo Addegas ou cadastre um novo." onLimpar={limpar} />}
          </div>
        </>
      )}

      {aba === 'validade' && (
        <BarraLista mostrando={lotesF.length} total={lotes.length} unidade={['lote', 'lotes']} onLimpar={() => setFVal('todos')}
          filtros={[{ label: 'Vence', value: fVal, onChange: setFVal, options: [['todos', 'Qualquer data'], ['vencido', 'Já venceu'], ['7', 'Em até 7 dias'], ['30', 'Em até 30 dias']] }]} />
      )}
      {aba === 'validade' && (
        <div className={`${card} overflow-hidden`}>
          {pagL.itens.map((l) => {
            const d = diasAte(l.expires_on)
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-3.5 px-[18px] border-b border-[#1F1F22]">
                <div className="flex-[1_1_220px] min-w-0">
                  <div className="text-[15px] font-bold">{porId.get(l.product_id)?.name ?? 'Produto'}</div>
                  <div className="text-sm text-[#C4C4C9] mt-[3px]">{l.code ? `Lote ${l.code} · ` : ''}{qtd(l.remaining_qty)} un · {new Date(l.expires_on + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                </div>
                <span className={pillCls} style={d <= 7 ? pill('#FF6B5E', 'rgba(255,107,94,.12)') : d <= 15 ? pill('#FBC009', 'rgba(251,192,9,.12)') : pill('#ADADB4', '#232327')}>
                  {d <= 0 ? 'Vencido' : `Vence em ${d} ${d === 1 ? 'dia' : 'dias'}`}
                </span>
                <button onClick={() => navigate('/combos')} className="h-[38px] px-3.5 rounded-[2px_8px_3px_7px] border border-line-2 bg-surface-2 text-[13px] font-bold cursor-pointer">Montar combo</button>
              </div>
            )
          })}
          <Paginacao p={pagL} onPg={setPgL} />
          {lotesF.length === 0 && <SemResultado filtrado={fVal !== 'todos'} vazio="Nenhum lote com validade. Informe a validade na entrada de mercadoria." onLimpar={() => setFVal('todos')} />}
        </div>
      )}

      {aba === 'contagem' && (
        <>
          <BarraLista busca={q} onBusca={setQ} placeholder="Buscar por nome ou código de barras" mostrando={lista.length} total={produtos.length} unidade={['produto', 'produtos']} onLimpar={limpar}
            filtros={[{ label: 'Categoria', value: fCat, onChange: setFCat, options: [['todos', 'Todas'], ...categorias.map((c) => [c.id, c.name] as [string, string]), ['sem', 'Sem categoria']] }]} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-[1_1_260px] text-sm text-[#C4C4C9]">{contados.length ? `${contados.length} ${contados.length === 1 ? 'produto contado' : 'produtos contados'}` : 'Digite a quantidade encontrada na prateleira'}</div>
            <button onClick={salvarContagem} disabled={salvando} className="h-[46px] px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold cursor-pointer disabled:opacity-60">{salvando ? 'Salvando…' : 'Salvar contagem'}</button>
          </div>
          <div className={`${card} overflow-hidden`}>
            {lista.length === 0 && <SemResultado filtrado={filtrado} vazio="Nenhum produto para contar." onLimpar={limpar} />}
            <Paginacao p={pagP} onPg={setPgP} />
            {pagP.itens.map((p) => {
              const v = contagem[p.product_id] ?? ''
              const d = v !== '' ? parseBRL(v) - p.stock : 0
              return (
                <div key={p.product_id} className="flex items-center gap-3 py-2.5 px-4 border-b border-[#1F1F22]">
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold leading-[1.3]">{p.name}</div><div className="text-[13px] text-[#ADADB4] mt-[3px]">Sistema: {qtd(p.stock)} un</div></div>
                  <input value={v} onChange={(e) => setContagem((c) => ({ ...c, [p.product_id]: e.target.value.replace(/[^\d,]/g, '') }))} inputMode="decimal" placeholder="Contado"
                    className="w-24 h-11 px-3 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line-2 text-base font-bold text-right outline-none focus:border-brand" />
                  <span className="w-14 text-right font-extrabold num" style={{ color: v === '' ? '#ADADB4' : d === 0 ? '#4ADE80' : '#FF6B5E' }}>{v === '' ? '—' : d > 0 ? `+${qtd(d)}` : qtd(d)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {modal?.tipo === 'catalogo' && <DoCatalogo storeId={storeId!} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal?.tipo === 'entrada' && <Entrada storeId={storeId!} produtos={produtos} pid={modal.pid} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal?.tipo === 'produto' && (
        <ProdutoSheet storeId={storeId!} accountId={data.accountId} p={modal.p} categorias={categorias} verCusto={verCusto}
          onClose={() => setModal(null)} onDone={recarregar} onEntrada={(pid) => setModal({ tipo: 'entrada', pid })} />
      )}
    </div>
  )
}

function Entrada({ storeId, produtos, pid, onClose, onDone }: { storeId: string; produtos: ProdutoLoja[]; pid?: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast()
  const inicial = produtos.find((p) => p.product_id === pid) ?? produtos[0]
  const [e, setE] = useState({ pid: inicial?.product_id ?? '', qty: '', cost: reais(inicial?.avg_cost), exp: '', lote: '' })
  const [busy, setBusy] = useState(false)
  const p = produtos.find((x) => x.product_id === e.pid)
  const n = parseBRL(e.qty)
  const total = Math.round(n * centavos(e.cost))

  const salvar = async () => {
    if (!p) return toast('Escolha o produto')
    if (n <= 0) return toast('Informe a quantidade')
    setBusy(true)
    try {
      await rpc('receive_goods', { p_store_id: storeId, p_items: [{ product_id: p.product_id, quantity: n, unit_cost: centavos(e.cost), expires_on: e.exp || null, lot_code: e.lote.trim() || null }] })
      toast(`Entrada lançada · ${p.name} +${qtd(n)} un`)
      await onDone()
      onClose()
    } catch (err) {
      toast((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Sheet title="Entrada de mercadoria" onClose={onClose} footer={<button onClick={salvar} disabled={busy} className={bigBtn}>{busy ? 'Lançando…' : 'Lançar entrada'}</button>}>
      <Campo label="Produto">
        <select value={e.pid} onChange={(ev) => { const x = produtos.find((y) => y.product_id === ev.target.value); setE({ ...e, pid: ev.target.value, cost: reais(x?.avg_cost) }) }} className={campo}>
          {produtos.map((o) => <option key={o.product_id} value={o.product_id}>{o.name}</option>)}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="Quantidade (un)"><input value={e.qty} onChange={(ev) => setE({ ...e, qty: ev.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" autoFocus className={`${campo} text-lg font-bold`} /></Campo>
        <Campo label="Custo unitário (R$)"><input value={e.cost} onChange={(ev) => setE({ ...e, cost: ev.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" className={`${campo} text-lg font-bold`} /></Campo>
        <Campo label="Validade (opcional)"><input type="date" value={e.exp} onChange={(ev) => setE({ ...e, exp: ev.target.value })} className={campo} style={{ colorScheme: 'dark' }} /></Campo>
        <Campo label="Lote (opcional)"><input value={e.lote} onChange={(ev) => setE({ ...e, lote: ev.target.value })} className={campo} /></Campo>
      </div>
      <div className="flex justify-between items-baseline py-3.5 px-4 rounded-[3px_10px_2px_9px] bg-surface-2">
        <span className="text-sm text-[#C4C4C9]">{p ? `Estoque após entrada: ${qtd(p.stock + n)} un` : ''}</span>
        <span className="text-xl font-extrabold num">{brlc(total)}</span>
      </div>
    </Sheet>
  )
}

const PERDAS = [['quebra', 'Quebra'], ['vencido', 'Vencido'], ['consumo', 'Consumo'], ['furto', 'Furto'], ['outro', 'Outro'], ['ajuste', 'Ajuste (+/−)']] as const

function ProdutoSheet({ storeId, accountId, p, categorias, verCusto, onClose, onDone, onEntrada }: {
  storeId: string; accountId: string; p: ProdutoLoja | null; categorias: Categoria[]; verCusto: boolean
  onClose: () => void; onDone: () => Promise<unknown>; onEntrada: (pid: string) => void
}) {
  const toast = useToast()
  const [f, setF] = useState({
    name: p?.name ?? '', cat: p?.category_id ?? '', ean: p?.ean ?? '', price: reais(p?.default_price),
    lojaPrice: reais(p?.store_price), min: p ? qtd(p.min_stock) : '0', estoque: '', custo: '',
  })
  const [perda, setPerda] = useState({ kind: '' as string, qty: '', motivo: '' })
  // Produto novo com código de barras: se já está no catálogo Addegas, usa os dados e fica ligado a ele.
  const [doCatalogo, setDoCatalogo] = useState<ItemCatalogo | null>(null)
  const [usarCatalogo, setUsarCatalogo] = useState(false)
  useEffect(() => {
    if (p || f.ean.length < 8) { setDoCatalogo(null); return }
    const t = setTimeout(() => {
      rpc<ItemCatalogo[]>('search_catalog_for_store', { p_store_id: storeId, p_query: f.ean, p_limit: 5 })
        .then((r) => setDoCatalogo(r.find((x) => x.ean === f.ean) ?? null)).catch(() => setDoCatalogo(null))
    }, 350)
    return () => clearTimeout(t)
  }, [f.ean, p, storeId])
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const dinheiro = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value.replace(/[^\d,]/g, '') })

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn(); await onDone(); onClose() } catch (e) { toast((e as Error).message); setBusy(false) }
  }

  const salvar = () => run(async () => {
    if (!f.name.trim()) throw new Error('Informe o nome do produto')
    if (!f.price) throw new Error('Informe o preço de venda')
    const { product_id } = await rpc<{ product_id: string }>('save_product', {
      p_account_id: accountId,
      p_product: { id: p?.product_id ?? null, name: f.name.trim(), category_id: f.cat || null, ean: f.ean.trim() || null, price: centavos(f.price),
        ...(p ? {} : { min_stock: parseBRL(f.min), ...(usarCatalogo && doCatalogo ? { catalog_product_id: doCatalogo.id, volume_ml: doCatalogo.volume_ml } : {}) }) },
    })
    await rpc('set_store_product', { p_store_id: storeId, p_product_id: product_id, p_price: f.lojaPrice ? centavos(f.lojaPrice) : null, p_min_stock: parseBRL(f.min), p_active: true })
    if (!p && parseBRL(f.estoque) > 0) {
      await rpc('receive_goods', { p_store_id: storeId, p_items: [{ product_id, quantity: parseBRL(f.estoque), unit_cost: centavos(f.custo) }], p_note: 'Estoque inicial' })
    }
    toast(p ? 'Produto salvo' : `${f.name.trim()} cadastrado`)
  })

  const lancarPerda = () => run(async () => {
    if (!perda.kind) throw new Error('Escolha o tipo')
    const n = parseFloat(perda.qty.replace(',', '.'))
    if (!n) throw new Error('Informe a quantidade')
    await rpc('register_stock_change', { p_store_id: storeId, p_product_id: p!.product_id, p_kind: perda.kind, p_quantity: n, p_reason: perda.motivo })
    toast(perda.kind === 'ajuste' ? 'Ajuste lançado' : 'Perda lançada')
  })

  const parar = () => run(async () => {
    await rpc('set_store_product', { p_store_id: storeId, p_product_id: p!.product_id, p_price: p!.store_price, p_min_stock: p!.min_stock, p_active: false })
    toast(`${p!.name} saiu desta loja`)
  })

  return (
    <Sheet title={p ? p.name : 'Novo produto'} onClose={onClose} footer={<button onClick={salvar} disabled={busy} className={bigBtn}>{busy ? 'Salvando…' : p ? 'Salvar' : 'Cadastrar produto'}</button>}>
      {p && (
        <div className="flex items-center gap-3 py-3 px-4 rounded-[3px_10px_2px_9px] bg-surface-2">
          <div className="flex-1 text-sm text-[#C4C4C9]">Estoque nesta loja<div className="text-xl font-extrabold text-ink num mt-0.5">{qtd(p.stock)} un</div></div>
          {verCusto && <div className="text-sm text-[#C4C4C9] text-right">Custo médio<div className="text-base font-bold text-ink num mt-0.5">{p.avg_cost != null ? brlc(p.avg_cost) : '—'}</div></div>}
          <button onClick={() => onEntrada(p.product_id)} className="h-10 px-3 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-[13px] font-extrabold cursor-pointer flex items-center gap-1.5"><Icon name="down" size={16} />Entrada</button>
        </div>
      )}
      {!p && doCatalogo && (doCatalogo.already
        ? <div className="py-3 px-4 rounded-[3px_10px_2px_9px] bg-[rgba(255,107,94,.1)] border border-[rgba(255,107,94,.35)] text-sm">Esse código de barras já está na sua adega: <b>{doCatalogo.name}</b>.</div>
        : (
          <div className="flex items-center gap-3 py-3 px-4 rounded-[3px_10px_2px_9px] bg-[rgba(74,222,128,.08)] border border-[rgba(74,222,128,.35)]">
            <div className="flex-1 min-w-0 text-sm"><div className="font-bold text-[#4ADE80]">No catálogo Addegas</div><div className="truncate mt-0.5">{doCatalogo.name}{doCatalogo.category ? ` · ${doCatalogo.category}` : ''}</div></div>
            {usarCatalogo ? <span className="text-[13px] font-bold text-[#4ADE80]">Usando</span> : (
              <button onClick={() => { setUsarCatalogo(true); setF({ ...f, name: doCatalogo.name, cat: categorias.find((c) => norm(c.name) === norm(doCatalogo.category))?.id ?? f.cat }) }}
                className="h-10 px-3 rounded-[2px_8px_3px_7px] bg-[#4ADE80] text-[#0A0A0B] text-[13px] font-extrabold cursor-pointer flex-none">Usar dados</button>)}
          </div>))}
      <Campo label="Nome"><input value={f.name} onChange={set('name')} placeholder="Ex.: Heineken Long Neck 330ml" className={campo} /></Campo>
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="Categoria">
          <select value={f.cat} onChange={set('cat')} className={campo}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Campo>
        <Campo label="Código de barras"><input value={f.ean} onChange={(e) => setF({ ...f, ean: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className={campo} /></Campo>
        <Campo label="Preço (todas as lojas)"><input value={f.price} onChange={dinheiro('price')} inputMode="decimal" placeholder="0,00" className={`${campo} font-bold`} /></Campo>
        <Campo label="Preço só nesta loja"><input value={f.lojaPrice} onChange={dinheiro('lojaPrice')} inputMode="decimal" placeholder="Igual ao padrão" className={`${campo} font-bold`} /></Campo>
        <Campo label="Estoque mínimo (un)"><input value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" className={campo} /></Campo>
        {!p && <Campo label="Estoque inicial (un)"><input value={f.estoque} onChange={(e) => setF({ ...f, estoque: e.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" placeholder="0" className={campo} /></Campo>}
        {!p && parseBRL(f.estoque) > 0 && <Campo label="Custo unitário (R$)" className="col-span-2"><input value={f.custo} onChange={dinheiro('custo')} inputMode="decimal" placeholder="0,00" className={campo} /></Campo>}
      </div>
      {!p && !(doCatalogo && usarCatalogo) && <div className="text-[13px] text-[#ADADB4] -mt-1">Produto fora do catálogo Addegas vai para a análise da equipe Addegas, que pode incluir no catálogo para todas as adegas.</div>}

      {p && (
        <div className="flex flex-col gap-3 pt-4 border-t border-line">
          <div className="text-[15px] font-extrabold">Perda ou ajuste</div>
          <div className="flex flex-wrap gap-2">
            {PERDAS.map(([id, l], k) => <button key={id} onClick={() => setPerda({ ...perda, kind: id })} className={chipCls} style={chip(perda.kind === id, k)}>{l}</button>)}
          </div>
          {perda.kind && (
            <div className="grid grid-cols-[110px_1fr] gap-2.5">
              <input value={perda.qty} onChange={(e) => setPerda({ ...perda, qty: e.target.value.replace(perda.kind === 'ajuste' ? /[^\d,-]/g : /[^\d,]/g, '') })} inputMode="decimal"
                placeholder={perda.kind === 'ajuste' ? '+/− un' : 'Qtd'} className={`${campo} font-bold`} />
              <input value={perda.motivo} onChange={(e) => setPerda({ ...perda, motivo: e.target.value })} placeholder="Motivo (obrigatório)" className={campo} />
              <button onClick={lancarPerda} disabled={busy} className="col-span-2 h-12 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 font-bold cursor-pointer disabled:opacity-60">
                {perda.kind === 'ajuste' ? 'Lançar ajuste' : 'Lançar perda'}
              </button>
            </div>
          )}
          <button onClick={parar} disabled={busy} className="self-start p-0 bg-transparent text-[#FF6B5E] text-sm font-bold cursor-pointer">Parar de vender nesta loja</button>
        </div>
      )}
    </Sheet>
  )
}

type ItemCatalogo = { id: string; ean: string | null; name: string; brand: string | null; volume_ml: number | null; unit: string | null; packaging: string | null; category: string | null; already: boolean }

/** Catálogo Addegas (E39): a adega escolhe as bebidas, põe o preço e elas entram no estoque já com código de barras. */
function DoCatalogo({ storeId, onClose, onDone }: { storeId: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('todos')
  const [mostrar, setMostrar] = useState('novos')
  const [pgK, setPgK] = useState<Pg>(PG0)
  const [sel, setSel] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const { data: itens, isLoading } = useQuery({
    queryKey: ['estoque', 'catalogo', storeId],
    queryFn: () => rpc<ItemCatalogo[]>('search_catalog_for_store', { p_store_id: storeId, p_query: '', p_limit: 100 }),
  })
  const todos = itens ?? []
  const qn = norm(q.trim())
  const lista = todos.filter((i) => (!qn || norm(`${i.name} ${i.brand ?? ''} ${i.ean ?? ''}`).includes(qn))
    && (cat === 'todos' || i.category === cat) && (mostrar === 'todos' || !i.already))
  const cats = [...new Set(todos.map((i) => i.category).filter(Boolean))] as string[]
  const escolhidos = Object.keys(sel)
  const limpar = () => { setQ(''); setCat('todos'); setMostrar('novos') }
  const pagK = paginar(lista, pgK, q + cat + mostrar)

  const adicionar = async () => {
    if (!escolhidos.length) return
    if (escolhidos.some((id) => !centavos(sel[id]))) return toast('Informe o preço de venda de cada produto escolhido')
    setBusy(true)
    try {
      const r = await rpc<{ created: number; already: number }>('add_products_from_catalog', { p_store_id: storeId, p_items: escolhidos.map((id) => ({ catalog_id: id, price: centavos(sel[id]) })) })
      const ja = r.already ? ` · ${r.already} já ${r.already === 1 ? 'estava' : 'estavam'} na adega` : ''
      toast(`${r.created} ${r.created === 1 ? 'produto adicionado' : 'produtos adicionados'}${ja}`)
      await onDone()
      onClose()
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }

  const rotulo = escolhidos.length ? `Adicionar ${escolhidos.length} ${escolhidos.length === 1 ? 'produto' : 'produtos'}` : 'Escolha os produtos'
  return (
    <Sheet title="Catálogo Addegas" onClose={onClose} footer={<button onClick={adicionar} disabled={busy || !escolhidos.length} className={bigBtn}>{busy ? 'Adicionando…' : rotulo}</button>}>
      <div className="text-sm text-[#C4C4C9] -mt-1">Bebidas com nome, código de barras e categoria prontos. Você só põe o preço; o estoque entra pela Entrada de mercadoria.</div>
      <BarraLista busca={q} onBusca={setQ} placeholder="Nome, marca ou código de barras" mostrando={lista.length} total={todos.length} unidade={['produto', 'produtos']} onLimpar={limpar}
        filtros={[
          { label: 'Categoria', value: cat, onChange: setCat, options: [['todos', 'Todas'], ...cats.map((c) => [c, c] as [string, string])] },
          { label: 'Mostrar', value: mostrar, onChange: setMostrar, todos: 'novos', options: [['novos', 'Só os que faltam'], ['todos', 'Todos']] },
        ]} />
      <div className="flex flex-col">
        {isLoading && <div className="py-6 text-center text-[#C4C4C9]">Carregando o catálogo…</div>}
        {pagK.itens.map((i) => {
          const on = i.id in sel
          const alternar = () => { if (i.already) return; setSel((x) => { const n = { ...x }; if (on) delete n[i.id]; else n[i.id] = ''; return n }) }
          return (
            <div key={i.id} className="flex items-center gap-3 py-3 border-b border-line">
              <button onClick={alternar} disabled={i.already} aria-label={on ? 'Tirar' : 'Escolher'}
                className="w-7 h-7 flex-none rounded-[2px_7px_3px_6px] flex items-center justify-center cursor-pointer disabled:cursor-default" style={chip(on || i.already, 0)}>
                {(on || i.already) && <Icon name="check" size={16} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold truncate">{i.name}</div>
                <div className="text-[13px] text-[#ADADB4] mt-0.5 truncate">{[i.category, i.brand, i.ean].filter(Boolean).join(' · ')}{i.already ? ' · já está na sua adega' : ''}</div>
              </div>
              {on && <input value={sel[i.id]} onChange={(e) => setSel({ ...sel, [i.id]: e.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" placeholder="Preço" aria-label={`Preço de ${i.name}`} autoFocus
                className="w-[104px] h-11 px-3 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line-2 text-[15px] font-bold outline-none focus:border-brand num" />}
            </div>
          )
        })}
        <Paginacao p={pagK} onPg={setPgK} />
        {!isLoading && !lista.length && <SemResultado filtrado={!!qn || cat !== 'todos'} vazio={mostrar === 'novos' ? 'Você já tem todos os produtos do catálogo.' : 'O catálogo ainda está vazio.'} onLimpar={limpar} />}
      </div>
    </Sheet>
  )
}
