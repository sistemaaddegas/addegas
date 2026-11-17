import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { brlc, centavos, parseBRL, reais } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { BarraLista, SemResultado, norm, Paginacao, paginar, PG0, type Pg } from '@/components/filtros'
import { useEstoque } from '@/features/estoque/dados'
import { card, chip, chipCls, pill, pillCls, qtd, seg, segBar, segCls } from '@/lib/visual'

type Aba = 'fornecedores' | 'sugestao' | 'contas'
type Fornecedor = { id: string; name: string; kind: string | null; phone: string | null; lead_time: string | null }
type Sugestao = { product_id: string; name: string; stock: number; min_stock: number; daily_avg: number; suggested: number }
type PedidoCompra = { id: string; supplier_id: string | null; status: string; created_at: string; purchase_order_items: { product_id: string; quantity: number; unit_cost_estimate: number | null; received_qty: number }[] }
type Conta = { id: string; description: string; category: string | null; amount: number; due_on: string; days_late: number; amount_due_today: number; paid_at: string | null; paid_amount: number | null }

const campo = 'h-[52px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base w-full outline-none focus:border-brand'
const TIPOS_FORN = ['Cervejas', 'Destilados', 'Vinhos', 'Refrigerantes', 'Gelo', 'Carvão', 'Tabacaria']
const TIPOS_CONTA = ['Fornecedor', 'Aluguel', 'Energia', 'Água', 'Internet', 'Funcionários', 'Impostos', 'Outros']
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
const tel = (t: string) => t.replace(/\D/g, '')
const fone = (t: string) => { const d = tel(t); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t }
const diasAte = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 864e5)

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-2 min-w-0"><span className="text-sm font-bold text-[#C4C4C9]">{label}</span>{children}</label>
}
function Stat({ l, v, c }: { l: string; v: string; c: string }) {
  return (
    <div className="py-4 px-[18px] rounded-[4px_13px_5px_11px] bg-surface border border-line">
      <div className="text-sm text-[#C4C4C9] font-semibold mb-2">{l}</div>
      <div className="text-[26px] font-extrabold num" style={{ color: c, fontStretch: '100%' }}>{v}</div>
    </div>
  )
}

/** Compras (fornecedores e sugestão) e, com `contas`, a tela "Contas a pagar" do menu. */
export function Compras({ contas = false }: { contas?: boolean }) {
  const { storeId } = useAuth()
  const est = useEstoque(storeId)
  const qc = useQueryClient()
  const toast = useToast()
  const [abaCompras, setAba] = useState<Aba>('fornecedores')
  const [qF, setQF] = useState('')
  const [fTipo, setFTipo] = useState('todos')
  const [qC, setQC] = useState('')
  const [fSitC, setFSitC] = useState('abertas')
  const [fCatC, setFCatC] = useState('todos')
  const [qS, setQS] = useState('')
  const [pgS, setPgS] = useState<Pg>(PG0)
  const [fFornP, setFFornP] = useState('todos')
  const [fSitP, setFSitP] = useState('todos')
  const [pgF, setPgF] = useState<Pg>(PG0)
  const [pgC, setPgC] = useState<Pg>(PG0)
  const [pgP, setPgP] = useState<Pg>(PG0)
  const aba: Aba = contas ? 'contas' : abaCompras
  const [modal, setModal] = useState<null | 'forn' | 'conta' | 'enviar' | Conta | { receber: PedidoCompra }>(null)
  const accountId = est.data?.accountId

  const { data, error, isLoading } = useQuery({
    queryKey: ['compras', storeId, contas],
    enabled: !!storeId,
    queryFn: async () => {
      const [forn, sug, bills, pedidos] = await Promise.all([
        supabase.from('suppliers').select('id, name, kind, phone, lead_time').eq('active', true).order('name'),
        contas ? Promise.resolve([] as Sugestao[]) : rpc<Sugestao[]>('purchase_suggestion', { p_store_id: storeId }),
        rpc<Conta[]>('bills_list', { p_store_id: storeId, p_only_open: false }),
        supabase.from('purchase_orders').select('id, supplier_id, status, created_at, purchase_order_items(product_id, quantity, unit_cost_estimate, received_qty)')
          .eq('store_id', storeId!).in('status', ['sent', 'partially_received']).order('created_at', { ascending: false }),
      ])
      if (forn.error) throw new Error(forn.error.message)
      return { fornecedores: (forn.data ?? []) as Fornecedor[], sugestao: sug, contas: bills, pedidos: (pedidos.data ?? []) as unknown as PedidoCompra[] }
    },
  })
  const recarregar = () => Promise.all(['compras', 'inicio', 'atencao', 'estoque'].map((k) => qc.invalidateQueries({ queryKey: [k] })))

  if (isLoading || est.isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar compras e contas. {error?.message}</div>

  const custo = new Map((est.data?.produtos ?? []).map((p) => [p.product_id, p.avg_cost]))
  const nomeProd = new Map((est.data?.produtos ?? []).map((p) => [p.product_id, p.name]))
  const nomeForn = new Map(data.fornecedores.map((f) => [f.id, f.name]))
  const total = data.sugestao.reduce((a, g) => a + (custo.get(g.product_id) ?? 0) * Number(g.suggested), 0)
  const lista = data.sugestao.map((g) => `${qtd(Number(g.suggested))} un · ${g.name}`).join('\n')

  const abertas = data.contas.filter((b) => !b.paid_at)
  const mes = new Date().toISOString().slice(0, 7)
  const stats: [string, string, string][] = [
    ['Vencidas', brlc(abertas.filter((b) => b.days_late > 0).reduce((a, b) => a + b.amount_due_today, 0)), '#FF6B5E'],
    ['Próximos 7 dias', brlc(abertas.filter((b) => { const d = diasAte(b.due_on); return d >= 0 && d <= 7 }).reduce((a, b) => a + b.amount, 0)), '#F5F5F2'],
    ['Pago este mês', brlc(data.contas.filter((b) => b.paid_at?.startsWith(mes)).reduce((a, b) => a + (b.paid_amount ?? 0), 0)), '#4ADE80'],
  ]
  // Fornecedores e contas seguem o padrão de busca, filtros e contagem do sistema.
  const tiposForn = [...new Set(data.fornecedores.flatMap((f) => (f.kind ?? '').split(',').map((x) => x.trim()).filter(Boolean)))].sort()
  const qfn = norm(qF.trim())
  const fornecedores = data.fornecedores.filter((f) => (!qfn || norm(`${f.name} ${f.kind ?? ''} ${f.phone ?? ''}`).includes(qfn))
    && (fTipo === 'todos' || (f.kind ?? '').split(',').map((x) => x.trim()).includes(fTipo)))
  const limparF = () => { setQF(''); setFTipo('todos') }
  const pagF = paginar(fornecedores, pgF, qF + fTipo)
  const catsConta = [...new Set(data.contas.map((b) => b.category).filter(Boolean))] as string[]
  const qcn = norm(qC.trim())
  const situacaoConta = (b: Conta) => b.paid_at ? 'pagas' : b.days_late > 0 ? 'vencidas' : diasAte(b.due_on) <= 7 ? 'semana' : 'abertas'
  const ordenadas = [...abertas, ...data.contas.filter((b) => b.paid_at)]
    .filter((b) => (!qcn || norm(`${b.description} ${b.category ?? ''}`).includes(qcn)) && (fCatC === 'todos' || b.category === fCatC)
      && (fSitC === 'todas' || (fSitC === 'abertas' ? !b.paid_at : situacaoConta(b) === fSitC)))
  const limparC = () => { setQC(''); setFSitC('abertas'); setFCatC('todos') }
  const pagC = paginar(ordenadas, pgC, qC + fSitC + fCatC)
  const sugestao = data.sugestao.filter((g) => !qS.trim() || norm(g.name).includes(norm(qS.trim())))
  const pagS = paginar(sugestao, pgS, qS)
  const pedidos = data.pedidos.filter((pc) => (fFornP === 'todos' || (pc.supplier_id ?? 'sem') === fFornP)
    && (fSitP === 'todos' || (fSitP === 'falta') === pc.purchase_order_items.some((i) => Number(i.received_qty) < Number(i.quantity))))
  const limparP = () => { setFFornP('todos'); setFSitP('todos') }
  const pagP = paginar(pedidos, pgP, fFornP + fSitP)

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[1400px] mx-auto w-full">
      {!contas && (
        <div className={segBar}>
          {([['fornecedores', 'Fornecedores'], ['sugestao', 'Sugestão de compra']] as const).map(([id, l], k) => (
            <button key={id} onClick={() => setAba(id)} className={segCls} style={seg(aba === id, k)}>{l}{id === 'fornecedores' && <span className="text-[13px] opacity-70">{data.fornecedores.length}</span>}</button>
          ))}
        </div>
      )}

      {aba === 'fornecedores' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-[1_1_600px] min-w-0">
              <BarraLista busca={qF} onBusca={setQF} placeholder="Buscar fornecedor, tipo ou telefone" mostrando={fornecedores.length} total={data.fornecedores.length} unidade={['fornecedor', 'fornecedores']} onLimpar={limparF}
                filtros={[{ label: 'Tipo', value: fTipo, onChange: setFTipo, options: [['todos', 'Todos'], ...tiposForn.map((t) => [t, t] as [string, string])] }]} />
            </div>
            <button onClick={() => setModal('forn')} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Novo fornecedor</button>
          </div>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {pagF.itens.map((f) => (
              <div key={f.id} className="p-[18px] rounded-[4px_13px_5px_11px] bg-surface border border-line flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-[42px] h-[42px] rounded-[3px_10px_2px_9px] bg-line-2 text-sm font-extrabold flex items-center justify-center flex-none">{iniciais(f.name)}</span>
                  <div className="min-w-0"><div className="text-[15px] font-extrabold">{f.name}</div><div className="text-sm text-[#C4C4C9] mt-[3px]">{f.kind || 'Sem tipo'}</div></div>
                </div>
                <div className="text-sm text-[#C4C4C9] leading-[1.6]">{f.phone ? fone(f.phone) : 'Sem telefone'}<br />{f.lead_time || 'Prazo não informado'}</div>
                {f.phone && (
                  <a href={`https://wa.me/55${tel(f.phone)}?text=${encodeURIComponent(`Olá! Quero fazer um pedido:\n${lista}`)}`} target="_blank" rel="noreferrer"
                    className="h-11 rounded-[2px_8px_3px_7px] border border-line-2 bg-surface-2 text-sm font-bold flex items-center justify-center gap-2"><Icon name="send" size={18} />Pedir no WhatsApp</a>
                )}
              </div>
            ))}
          </div>
          <Paginacao p={pagF} onPg={setPgF} />
          {data.fornecedores.length > 0 && fornecedores.length === 0 && <SemResultado filtrado vazio="" onLimpar={limparF} />}
          {data.fornecedores.length === 0 && <div className="py-10 text-center text-[15px] text-[#C4C4C9]">Cadastre seus fornecedores para pedir pelo WhatsApp com a sugestão de compra pronta.</div>}
        </>
      )}

      {aba === 'sugestao' && (
        <>
          <div className="text-sm text-[#C4C4C9] leading-normal max-w-[720px]">Quanto comprar para cobrir 7 dias de venda, pela média das últimas 4 semanas, sem ficar abaixo do mínimo.</div>
          <BarraLista busca={qS} onBusca={setQS} placeholder="Buscar produto" mostrando={sugestao.length} total={data.sugestao.length} unidade={['produto', 'produtos']} onLimpar={() => setQS('')} />
          <div className={`${card} overflow-hidden`}>
            {pagS.itens.map((g) => (
              <div key={g.product_id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-3.5 px-[18px] border-b border-[#1F1F22]">
                <div className="flex-[1_1_220px] min-w-0">
                  <div className="text-[15px] font-bold">{g.name}</div>
                  <div className="text-sm text-[#C4C4C9] mt-[3px]">{qtd(Number(g.stock))} em estoque · mínimo {qtd(Number(g.min_stock))} · vende {String(g.daily_avg).replace('.', ',')}/dia</div>
                </div>
                <span className="text-[15px] font-extrabold num">{qtd(Number(g.suggested))} un</span>
                <span className="w-[110px] text-right text-[15px] text-[#C4C4C9] num">{custo.get(g.product_id) != null ? brlc((custo.get(g.product_id) ?? 0) * Number(g.suggested)) : '—'}</span>
              </div>
            ))}
            <Paginacao p={pagS} onPg={setPgS} />
            {data.sugestao.length === 0 && <div className="p-8 text-center text-[#C4C4C9] text-sm">Nada para comprar agora: o estoque cobre a próxima semana.</div>}
            {data.sugestao.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 py-4 px-[18px]">
                <div className="flex-1 text-[15px] font-bold">Total estimado <span className="num text-brand">{brlc(total)}</span></div>
                <button onClick={() => navigator.clipboard.writeText(lista).then(() => toast('Lista copiada: cole no WhatsApp do fornecedor'), () => toast('Não deu para copiar'))}
                  className="h-[46px] px-[18px] rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-[15px] font-bold flex items-center gap-2 cursor-pointer"><Icon name="copy" size={18} />Copiar lista</button>
                <button onClick={() => setModal('enviar')}
                  className="h-[46px] px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="send" size={18} />Enviar aos fornecedores</button>
              </div>
            )}
          </div>
          {data.pedidos.length > 0 && (
            <>
              <div className="text-[17px] font-extrabold mt-2">Pedidos enviados</div>
              <BarraLista mostrando={pedidos.length} total={data.pedidos.length} unidade={['pedido', 'pedidos']} onLimpar={limparP}
                filtros={[
                  { label: 'Fornecedor', value: fFornP, onChange: setFFornP, options: [['todos', 'Todos'], ...data.fornecedores.map((f) => [f.id, f.name] as [string, string]), ['sem', 'Sem fornecedor']] },
                  { label: 'Situação', value: fSitP, onChange: setFSitP, options: [['todos', 'Todos'], ['falta', 'Falta chegar'], ['chegou', 'Já chegou']] },
                ]} />
              <div className={`${card} overflow-hidden`}>
                <Paginacao p={pagP} onPg={setPgP} />
                {pedidos.length === 0 && <SemResultado filtrado vazio="" onLimpar={limparP} />}
                {pagP.itens.map((pc) => {
                  const falta = pc.purchase_order_items.filter((i) => Number(i.received_qty) < Number(i.quantity))
                  return (
                    <div key={pc.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-3.5 px-[18px] border-b border-[#1F1F22]">
                      <div className="flex-[1_1_220px] min-w-0">
                        <div className="text-[15px] font-bold">{pc.supplier_id ? nomeForn.get(pc.supplier_id) ?? 'Fornecedor' : 'Sem fornecedor'}</div>
                        <div className="text-sm text-[#C4C4C9] mt-[3px] truncate">{falta.map((i) => `${qtd(Number(i.quantity) - Number(i.received_qty))}× ${nomeProd.get(i.product_id) ?? 'Produto'}`).join(' · ')}</div>
                      </div>
                      <span className={pillCls} style={pc.status === 'sent' ? pill('#7CB3FF', 'rgba(124,179,255,.12)') : pill('#FBC009', 'rgba(251,192,9,.12)')}>
                        {pc.status === 'sent' ? `Enviado ${new Date(pc.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'Chegou em parte'}
                      </span>
                      <button onClick={() => setModal({ receber: pc })} className="h-10 px-3.5 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-[13px] font-extrabold cursor-pointer flex items-center gap-1.5"><Icon name="down" size={16} />Chegou</button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {aba === 'contas' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-[1_1_260px] text-[15px] text-[#C4C4C9] leading-[1.45]">Contas da loja, de fornecedores e fixas, com vencimento e juros.</div>
            <button onClick={() => setModal('conta')} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Nova conta</button>
          </div>
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">{stats.map(([l, v, c]) => <Stat key={l} l={l} v={v} c={c} />)}</div>
          <BarraLista busca={qC} onBusca={setQC} placeholder="Buscar conta" mostrando={ordenadas.length} total={data.contas.length} unidade={['conta', 'contas']} onLimpar={limparC}
            filtros={[
              { label: 'Situação', value: fSitC, onChange: setFSitC, todos: 'abertas', options: [['abertas', 'Em aberto'], ['vencidas', 'Vencidas'], ['semana', 'Vencem em 7 dias'], ['pagas', 'Pagas'], ['todas', 'Todas']] },
              { label: 'Tipo', value: fCatC, onChange: setFCatC, options: [['todos', 'Todos'], ...catsConta.map((c) => [c, c] as [string, string])] },
            ]} />
          <div className={`${card} overflow-hidden`}>
            {pagC.itens.map((b) => {
              const d = diasAte(b.due_on)
              const venc = new Date(b.due_on + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              const [stL, stSt] = b.paid_at ? ['Pago', pill('#4ADE80', 'rgba(74,222,128,.12)')]
                : d < 0 ? [`Venceu há ${-d} ${-d === 1 ? 'dia' : 'dias'}`, pill('#FF6B5E', 'rgba(255,107,94,.12)')]
                : d === 0 ? ['Vence hoje', pill('#FBC009', 'rgba(251,192,9,.12)')] : d === 1 ? ['Vence amanhã', pill('#FBC009', 'rgba(251,192,9,.12)')]
                : [`Em ${d} dias`, pill('#ADADB4', '#232327')]
              return (
                <div key={b.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-3.5 px-[18px] border-b border-[#1F1F22]">
                  <div className="flex-[1_1_220px] min-w-0">
                    <div className="text-[15px] font-bold">{b.description}</div>
                    <div className="text-sm text-[#C4C4C9] mt-[3px]">{[b.category, `Vence ${venc}`].filter(Boolean).join(' · ')}</div>
                    {!b.paid_at && b.amount_due_today > b.amount && <div className="text-xs font-bold text-[#FF6B5E] mt-[3px]">Com juros: {brlc(b.amount_due_today)} (+{brlc(b.amount_due_today - b.amount)})</div>}
                  </div>
                  <span className={pillCls} style={stSt}>{stL}</span>
                  <span className="w-[110px] text-right text-base font-extrabold num">{brlc(b.paid_amount ?? b.amount)}</span>
                  {b.paid_at
                    ? <span className="w-[138px] flex items-center justify-center gap-1.5 text-ok text-[13px] font-bold"><Icon name="check" />Paga</span>
                    : <button onClick={() => setModal(b)} className="h-10 px-3.5 rounded-[2px_8px_3px_7px] border border-line-2 bg-surface-2 text-[13px] font-bold cursor-pointer">Marcar como paga</button>}
                </div>
              )
            })}
            <Paginacao p={pagC} onPg={setPgC} />
            {ordenadas.length === 0 && <SemResultado filtrado={!!qcn || fSitC !== 'abertas' || fCatC !== 'todos'} vazio="Nenhuma conta em aberto." onLimpar={limparC} />}
          </div>
        </>
      )}

      {modal === 'forn' && accountId && <NovoFornecedor accountId={accountId} tipos={[...new Set([...TIPOS_FORN, ...data.fornecedores.flatMap((f) => (f.kind ?? '').split(', ').filter(Boolean))])]} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal === 'conta' && <NovaConta storeId={storeId!} fornecedores={data.fornecedores} tipos={[...new Set([...TIPOS_CONTA, ...data.contas.map((b) => b.category ?? '').filter(Boolean)])]} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal === 'enviar' && <EnviarPedido storeId={storeId!} fornecedores={data.fornecedores} sugestao={data.sugestao} custo={custo} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal && typeof modal === 'object' && 'receber' in modal && <ReceberPedido pedido={modal.receber} nomeProd={nomeProd} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal && typeof modal === 'object' && 'due_on' in modal && <Pagar conta={modal} onClose={() => setModal(null)} onDone={recarregar} />}
    </div>
  )
}

function useSalvar(onDone: () => Promise<unknown>, onClose: () => void) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    try { toast(await fn()); await onDone(); onClose() } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  return [busy, run] as const
}

/** "+ Novo tipo" do protótipo: acrescenta uma opção às que já existem. */
function NovoTipo({ onAdd }: { onAdd: (t: string) => void }) {
  const [on, setOn] = useState(false)
  const [t, setT] = useState('')
  const add = () => { if (t.trim()) onAdd(t.trim().slice(0, 30)); setT(''); setOn(false) }
  if (!on) return <button onClick={() => setOn(true)} className={`${chipCls} text-[#C4C4C9]`} style={{ ...chip(false, 5), borderStyle: 'dashed' }}><Icon name="plus" size={16} />Novo tipo</button>
  return (
    <span className="flex gap-1.5">
      <input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} autoFocus placeholder="Nome do tipo" className="h-10 w-36 px-3 rounded-[2px_8px_3px_7px] bg-bg border border-brand text-sm outline-none" />
      <button onClick={add} className="h-10 px-3 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-[13px] font-extrabold cursor-pointer">Adicionar</button>
    </span>
  )
}

function NovoFornecedor({ accountId, tipos: base, onClose, onDone }: { accountId: string; tipos: string[]; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [f, setF] = useState({ name: '', phone: '', lead: '' })
  const [tipos, setTipos] = useState<string[]>([])
  const [opcoes, setOpcoes] = useState(base)
  const [busy, run] = useSalvar(onDone, onClose)
  const salvar = () => run(async () => {
    if (!f.name.trim()) throw new Error('Informe o nome do fornecedor')
    await rpc('save_supplier', { p_account_id: accountId, p_supplier: { name: f.name.trim(), kind: tipos.join(', ') || null, phone: f.phone.trim() || null, lead_time: f.lead.trim() || null } })
    return `${f.name.trim()} cadastrado`
  })
  return (
    <Sheet title="Novo fornecedor" onClose={onClose} footer={<button onClick={salvar} disabled={busy} className={bigBtn}>{busy ? 'Salvando…' : 'Salvar fornecedor'}</button>}>
      <Campo label="Nome"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Distribuidora Zona Oeste" className={campo} /></Campo>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">O que fornece · pode marcar mais de um</span>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((t, k) => <button key={t} onClick={() => setTipos((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t])} className={chipCls} style={chip(tipos.includes(t), k)}>{t}</button>)}
          <NovoTipo onAdd={(t) => { setOpcoes((o) => o.includes(t) ? o : [...o, t]); setTipos((x) => x.includes(t) ? x : [...x, t]) }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="WhatsApp / telefone"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="(11) 90000-0000" className={campo} /></Campo>
        <Campo label="Prazo de entrega (opcional)"><input value={f.lead} onChange={(e) => setF({ ...f, lead: e.target.value })} placeholder="Ex.: Entrega em 1 dia" className={campo} /></Campo>
      </div>
    </Sheet>
  )
}

function NovaConta({ storeId, fornecedores, tipos, onClose, onDone }: { storeId: string; fornecedores: Fornecedor[]; tipos: string[]; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [opcoes, setOpcoes] = useState(tipos)
  const [b, setB] = useState({ desc: '', valor: '', venc: '', forn: '', cat: '', juros: '', jurosTipo: 'pct_month' as 'pct_month' | 'fixed', recorrente: false })
  const [jurosOn, setJurosOn] = useState(false)
  const [busy, run] = useSalvar(onDone, onClose)
  const salvar = () => run(async () => {
    if (!b.desc.trim() || !centavos(b.valor) || !b.venc) throw new Error('Preencha conta, valor e vencimento')
    await rpc('save_bill', { p_store_id: storeId, p_bill: {
      description: b.desc.trim(), amount: centavos(b.valor), due_on: b.venc, supplier_id: b.forn || null, category: b.cat || null,
      interest_kind: jurosOn && parseBRL(b.juros) > 0 ? b.jurosTipo : 'none', interest_value: jurosOn ? parseBRL(b.juros) : 0, recurring_monthly: b.recorrente,
    } })
    return 'Conta salva'
  })
  return (
    <Sheet title="Nova conta a pagar" onClose={onClose} footer={<button onClick={salvar} disabled={busy} className={bigBtn}>{busy ? 'Salvando…' : 'Salvar conta'}</button>}>
      <Campo label="Conta"><input value={b.desc} onChange={(e) => setB({ ...b, desc: e.target.value })} placeholder="Ex.: NF 88213, aluguel, energia" className={campo} /></Campo>
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="Valor (R$)"><input value={b.valor} onChange={(e) => setB({ ...b, valor: e.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" placeholder="0,00" className={`${campo} font-bold`} /></Campo>
        <Campo label="Vencimento"><input type="date" value={b.venc} onChange={(e) => setB({ ...b, venc: e.target.value })} className={campo} style={{ colorScheme: 'dark' }} /></Campo>
      </div>
      <Campo label="Fornecedor">
        <select value={b.forn} onChange={(e) => setB({ ...b, forn: e.target.value })} className={campo}>
          <option value="">Sem fornecedor</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </Campo>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Tipo</span>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((t, k) => <button key={t} onClick={() => setB({ ...b, cat: b.cat === t ? '' : t })} className={chipCls} style={chip(b.cat === t, k)}>{t}</button>)}
          <NovoTipo onAdd={(t) => { setOpcoes((o) => o.includes(t) ? o : [...o, t]); setB({ ...b, cat: t }) }} />
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3.5 rounded-[3px_10px_2px_9px] bg-surface-2">
        <button onClick={() => setJurosOn(!jurosOn)} className="flex items-center justify-between gap-3 text-left cursor-pointer">
          <span><span className="block text-[15px] font-bold">Juros por atraso</span><span className="block text-[13px] text-[#ADADB4] mt-0.5">Opcional</span></span>
          <span className="w-[52px] h-[30px] rounded-full relative flex-none" style={{ background: jurosOn ? '#FBC009' : '#2A2A2E' }}><span className="absolute top-[3px] w-6 h-6 rounded-full transition-all" style={{ left: jurosOn ? 25 : 3, background: jurosOn ? '#0A0A0B' : '#ADADB4' }} /></span>
        </button>
        {jurosOn && (
          <div className="flex gap-2">
            <input value={b.juros} onChange={(e) => setB({ ...b, juros: e.target.value.replace(/[^\d,]/g, '') })} inputMode="decimal" placeholder={b.jurosTipo === 'pct_month' ? 'Ex.: 2' : 'Ex.: 10,00'} className={`${campo} flex-1 min-w-0`} />
            {([['pct_month', '% ao mês'], ['fixed', 'R$ fixo']] as const).map(([id, l], k) => <button key={id} onClick={() => setB({ ...b, jurosTipo: id })} className={`${chipCls} h-[52px]`} style={chip(b.jurosTipo === id, k)}>{l}</button>)}
          </div>
        )}
      </div>
      <button onClick={() => setB({ ...b, recorrente: !b.recorrente })} className="flex items-center gap-3 text-left cursor-pointer">
        <span className="w-6 h-6 rounded-[2px_7px_3px_6px] flex items-center justify-center flex-none" style={{ ...chip(b.recorrente), transform: 'none' }}>{b.recorrente && <Icon name="check" size={16} />}</span>
        <span className="text-sm font-semibold">Repete todo mês (ao pagar, a do mês seguinte já fica lançada)</span>
      </button>
    </Sheet>
  )
}

function Pagar({ conta, onClose, onDone }: { conta: Conta; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [forma, setForma] = useState('pix')
  const [busy, run] = useSalvar(onDone, onClose)
  const pagar = () => run(async () => {
    const r = await rpc<{ paid_amount: number }>('pay_bill', { p_bill_id: conta.id, p_method: forma })
    return `${conta.description} paga · ${brlc(r.paid_amount)}`
  })
  return (
    <Sheet title="Marcar como paga" onClose={onClose} footer={<button onClick={pagar} disabled={busy} className={bigBtn}>{busy ? 'Salvando…' : `Confirmar ${brlc(conta.amount_due_today)}`}</button>}>
      <div className="text-[15px] font-bold">{conta.description}</div>
      {conta.amount_due_today > conta.amount && <div className="text-sm text-[#FF6B5E] -mt-2">Inclui {brlc(conta.amount_due_today - conta.amount)} de juros por atraso.</div>}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Como foi paga</span>
        <div className="flex flex-wrap gap-2">
          {[['pix', 'Pix'], ['boleto', 'Boleto'], ['cash', 'Dinheiro'], ['card', 'Cartão'], ['transfer', 'Transferência']].map(([id, l], k) => (
            <button key={id} onClick={() => setForma(id)} className={chipCls} style={chip(forma === id, k)}>{l}</button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

/** Sugestão de compra → pedido de compra enviado (E27) e a lista no WhatsApp do fornecedor. */
function EnviarPedido({ storeId, fornecedores, sugestao, custo, onClose, onDone }: {
  storeId: string; fornecedores: Fornecedor[]; sugestao: Sugestao[]; custo: Map<string, number | null>; onClose: () => void; onDone: () => Promise<unknown>
}) {
  const [forn, setForn] = useState(fornecedores[0]?.id ?? '')
  const [q, setQ] = useState<Record<string, number>>(() => Object.fromEntries(sugestao.map((g) => [g.product_id, Number(g.suggested)])))
  const [busy, run] = useSalvar(onDone, onClose)
  const f = fornecedores.find((x) => x.id === forn)
  const itens = sugestao.filter((g) => (q[g.product_id] ?? 0) > 0)
  const enviar = () => run(async () => {
    if (!itens.length) throw new Error('Escolha ao menos um produto')
    // Abre a aba antes do await: depois dele o navegador bloqueia o pop-up.
    const aba = f?.phone ? window.open('', '_blank') : null
    if (aba) aba.opener = null // a página aberta não alcança o app (tabnabbing)
    try {
      await rpc('save_purchase_order', { p_store_id: storeId, p_supplier_id: forn || null, p_status: 'sent',
        p_items: itens.map((g) => ({ product_id: g.product_id, quantity: q[g.product_id], unit_cost_estimate: custo.get(g.product_id) ?? null })) })
    } catch (e) { aba?.close(); throw e }
    const texto = `Olá! Quero fazer um pedido:\n${itens.map((g) => `${qtd(q[g.product_id])} un · ${g.name}`).join('\n')}`
    if (aba && f?.phone) aba.location.href = `https://wa.me/55${tel(f.phone)}?text=${encodeURIComponent(texto)}`
    return f ? `Pedido enviado para ${f.name}` : 'Pedido registrado'
  })
  return (
    <Sheet title="Enviar aos fornecedores" onClose={onClose} footer={<button onClick={enviar} disabled={busy || !itens.length} className={bigBtn}><Icon name="send" />{busy ? 'Enviando…' : f?.phone ? 'Enviar no WhatsApp' : 'Registrar pedido'}</button>}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Fornecedor</span>
        <div className="flex flex-wrap gap-2">
          {fornecedores.map((x, k) => <button key={x.id} onClick={() => setForn(x.id)} className={chipCls} style={chip(forn === x.id, k)}>{x.name}</button>)}
          {!fornecedores.length && <span className="text-sm text-[#ADADB4]">Cadastre um fornecedor na aba Fornecedores.</span>}
        </div>
      </div>
      <div className="text-sm text-[#C4C4C9] -mb-2">Zere o que não for pedir a este fornecedor. O que sobrar continua na sugestão.</div>
      <div className="text-[13px] font-bold text-[#C4C4C9]">{sugestao.length} {sugestao.length === 1 ? 'produto sugerido' : 'produtos sugeridos'} · {itens.length} no pedido</div>
      {sugestao.map((g) => (
        <div key={g.product_id} className="flex items-center gap-3 py-2 border-b border-line">
          <span className="flex-1 min-w-0 text-sm font-semibold">{g.name}</span>
          <div className="flex items-center bg-surface-2 rounded-[2px_8px_3px_7px] border border-line-2">
            <button onClick={() => setQ((x) => ({ ...x, [g.product_id]: Math.max(0, (x[g.product_id] ?? 0) - 1) }))} className="w-10 h-10 flex items-center justify-center cursor-pointer"><Icon name="minus" /></button>
            <span className="min-w-8 text-center font-extrabold num">{qtd(q[g.product_id] ?? 0)}</span>
            <button onClick={() => setQ((x) => ({ ...x, [g.product_id]: (x[g.product_id] ?? 0) + 1 }))} className="w-10 h-10 flex items-center justify-center cursor-pointer"><Icon name="plus" /></button>
          </div>
        </div>
      ))}
      <div className="text-[13px] text-[#ADADB4]">O pedido fica em “Pedidos enviados”. Quando a mercadoria chegar, toque em Chegou para dar entrada no estoque.</div>
    </Sheet>
  )
}

/** Mercadoria do pedido chegou: confere quantidade e custo e dá entrada no estoque (receive_purchase_order). */
function ReceberPedido({ pedido, nomeProd, onClose, onDone }: { pedido: PedidoCompra; nomeProd: Map<string, string>; onClose: () => void; onDone: () => Promise<unknown> }) {
  const falta = pedido.purchase_order_items.filter((i) => Number(i.received_qty) < Number(i.quantity))
  const [v, setV] = useState<Record<string, { q: string; c: string }>>(() => Object.fromEntries(falta.map((i) => [i.product_id, { q: String(Number(i.quantity) - Number(i.received_qty)).replace('.', ','), c: reais(i.unit_cost_estimate) }])))
  const [busy, run] = useSalvar(onDone, onClose)
  const receber = () => run(async () => {
    const itens = falta.map((i) => ({ product_id: i.product_id, quantity: parseBRL(v[i.product_id].q), unit_cost: centavos(v[i.product_id].c) })).filter((i) => i.quantity > 0)
    if (!itens.length) throw new Error('Informe o que chegou')
    if (itens.some((i) => !i.unit_cost)) throw new Error('Informe o custo de cada item')
    await rpc('receive_purchase_order', { p_purchase_order_id: pedido.id, p_items: itens })
    return 'Entrada lançada no estoque'
  })
  const mini = 'h-11 px-3 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line-2 text-[15px] font-bold outline-none focus:border-brand w-full'
  return (
    <Sheet title="Chegou a mercadoria" onClose={onClose} footer={<button onClick={receber} disabled={busy} className={bigBtn}>{busy ? 'Lançando…' : 'Lançar entrada'}</button>}>
      <div className="grid grid-cols-[1fr_88px_110px] gap-2 text-[13px] font-bold text-[#ADADB4]"><span>Produto</span><span>Chegou (un)</span><span>Custo un. (R$)</span></div>
      <div className="text-[13px] font-bold text-[#C4C4C9]">{falta.length} {falta.length === 1 ? 'item para conferir' : 'itens para conferir'}</div>
      {falta.map((i) => (
        <div key={i.product_id} className="grid grid-cols-[1fr_88px_110px] gap-2 items-center">
          <span className="text-sm font-semibold min-w-0">{nomeProd.get(i.product_id) ?? 'Produto'}</span>
          <input value={v[i.product_id].q} onChange={(e) => setV({ ...v, [i.product_id]: { ...v[i.product_id], q: e.target.value.replace(/[^\d,]/g, '') } })} inputMode="decimal" className={mini} />
          <input value={v[i.product_id].c} onChange={(e) => setV({ ...v, [i.product_id]: { ...v[i.product_id], c: e.target.value.replace(/[^\d,]/g, '') } })} inputMode="decimal" placeholder="0,00" className={mini} />
        </div>
      ))}
      <div className="text-[13px] text-[#ADADB4]">Se chegou só uma parte, o pedido continua aberto com o que falta.</div>
    </Sheet>
  )
}
