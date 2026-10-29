import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { brlc, centavos, parseBRL } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { useEstoque } from '@/features/estoque/dados'
import { card, chip, chipCls, pill, pillCls, qtd, seg, segBar, segCls } from '@/lib/visual'

type Aba = 'fornecedores' | 'sugestao' | 'contas'
type Fornecedor = { id: string; name: string; kind: string | null; phone: string | null; lead_time: string | null }
type Sugestao = { product_id: string; name: string; stock: number; min_stock: number; daily_avg: number; suggested: number }
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

export function Compras() {
  const { storeId } = useAuth()
  const est = useEstoque(storeId)
  const qc = useQueryClient()
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('fornecedores')
  const [modal, setModal] = useState<null | 'forn' | 'conta' | Conta>(null)
  const accountId = est.data?.accountId

  const { data, error, isLoading } = useQuery({
    queryKey: ['compras', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [forn, sug, contas] = await Promise.all([
        supabase.from('suppliers').select('id, name, kind, phone, lead_time').eq('active', true).order('name'),
        rpc<Sugestao[]>('purchase_suggestion', { p_store_id: storeId }),
        rpc<Conta[]>('bills_list', { p_store_id: storeId, p_only_open: false }),
      ])
      if (forn.error) throw new Error(forn.error.message)
      return { fornecedores: (forn.data ?? []) as Fornecedor[], sugestao: sug, contas }
    },
  })
  const recarregar = () => Promise.all(['compras', 'inicio'].map((k) => qc.invalidateQueries({ queryKey: [k] })))

  if (isLoading || est.isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar compras e contas. {error?.message}</div>

  const custo = new Map((est.data?.produtos ?? []).map((p) => [p.product_id, p.avg_cost]))
  const total = data.sugestao.reduce((a, g) => a + (custo.get(g.product_id) ?? 0) * Number(g.suggested), 0)
  const lista = data.sugestao.map((g) => `${qtd(Number(g.suggested))} un · ${g.name}`).join('\n')

  const abertas = data.contas.filter((b) => !b.paid_at)
  const mes = new Date().toISOString().slice(0, 7)
  const stats: [string, string, string][] = [
    ['Vencidas', brlc(abertas.filter((b) => b.days_late > 0).reduce((a, b) => a + b.amount_due_today, 0)), '#FF6B5E'],
    ['Próximos 7 dias', brlc(abertas.filter((b) => { const d = diasAte(b.due_on); return d >= 0 && d <= 7 }).reduce((a, b) => a + b.amount, 0)), '#F5F5F2'],
    ['Pago este mês', brlc(data.contas.filter((b) => b.paid_at?.startsWith(mes)).reduce((a, b) => a + (b.paid_amount ?? 0), 0)), '#4ADE80'],
  ]
  const ordenadas = [...abertas, ...data.contas.filter((b) => b.paid_at && b.paid_at.startsWith(mes))]

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[1400px] mx-auto w-full">
      <div className={segBar}>
        {([['fornecedores', 'Fornecedores'], ['sugestao', 'Sugestão de compra'], ['contas', 'Contas a pagar']] as const).map(([id, l], k) => (
          <button key={id} onClick={() => setAba(id)} className={segCls} style={seg(aba === id, k)}>{l}</button>
        ))}
      </div>

      {aba === 'fornecedores' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-[1_1_260px] text-[15px] text-[#C4C4C9]">{data.fornecedores.length} {data.fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}</div>
            <button onClick={() => setModal('forn')} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Novo fornecedor</button>
          </div>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {data.fornecedores.map((f) => (
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
          {data.fornecedores.length === 0 && <div className="py-10 text-center text-[15px] text-[#C4C4C9]">Cadastre seus fornecedores para pedir pelo WhatsApp com a sugestão de compra pronta.</div>}
        </>
      )}

      {aba === 'sugestao' && (
        <>
          <div className="text-sm text-[#C4C4C9] leading-normal max-w-[720px]">Quanto comprar para cobrir 7 dias de venda, pela média das últimas 4 semanas, sem ficar abaixo do mínimo.</div>
          <div className={`${card} overflow-hidden`}>
            {data.sugestao.map((g) => (
              <div key={g.product_id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-3.5 px-[18px] border-b border-[#1F1F22]">
                <div className="flex-[1_1_220px] min-w-0">
                  <div className="text-[15px] font-bold">{g.name}</div>
                  <div className="text-sm text-[#C4C4C9] mt-[3px]">{qtd(Number(g.stock))} em estoque · mínimo {qtd(Number(g.min_stock))} · vende {String(g.daily_avg).replace('.', ',')}/dia</div>
                </div>
                <span className="text-[15px] font-extrabold num">{qtd(Number(g.suggested))} un</span>
                <span className="w-[110px] text-right text-[15px] text-[#C4C4C9] num">{custo.get(g.product_id) != null ? brlc((custo.get(g.product_id) ?? 0) * Number(g.suggested)) : '—'}</span>
              </div>
            ))}
            {data.sugestao.length === 0 && <div className="p-8 text-center text-[#C4C4C9] text-sm">Nada para comprar agora: o estoque cobre a próxima semana.</div>}
            {data.sugestao.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 py-4 px-[18px]">
                <div className="flex-1 text-[15px] font-bold">Total estimado <span className="num text-brand">{brlc(total)}</span></div>
                <button onClick={() => navigator.clipboard.writeText(lista).then(() => toast('Lista copiada: cole no WhatsApp do fornecedor'), () => toast('Não deu para copiar'))}
                  className="h-[46px] px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="copy" size={18} />Copiar lista</button>
              </div>
            )}
          </div>
        </>
      )}

      {aba === 'contas' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-[1_1_260px] text-[15px] text-[#C4C4C9] leading-[1.45]">Contas da loja, de fornecedores e fixas, com vencimento e juros.</div>
            <button onClick={() => setModal('conta')} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Nova conta</button>
          </div>
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">{stats.map(([l, v, c]) => <Stat key={l} l={l} v={v} c={c} />)}</div>
          <div className={`${card} overflow-hidden`}>
            {ordenadas.map((b) => {
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
            {ordenadas.length === 0 && <div className="py-10 text-center text-[15px] text-[#C4C4C9]">Nenhuma conta em aberto.</div>}
          </div>
        </>
      )}

      {modal === 'forn' && accountId && <NovoFornecedor accountId={accountId} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal === 'conta' && <NovaConta storeId={storeId!} fornecedores={data.fornecedores} onClose={() => setModal(null)} onDone={recarregar} />}
      {modal && typeof modal === 'object' && <Pagar conta={modal} onClose={() => setModal(null)} onDone={recarregar} />}
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

function NovoFornecedor({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [f, setF] = useState({ name: '', phone: '', lead: '' })
  const [tipos, setTipos] = useState<string[]>([])
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
          {TIPOS_FORN.map((t, k) => <button key={t} onClick={() => setTipos((x) => x.includes(t) ? x.filter((y) => y !== t) : [...x, t])} className={chipCls} style={chip(tipos.includes(t), k)}>{t}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Campo label="WhatsApp / telefone"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="(11) 90000-0000" className={campo} /></Campo>
        <Campo label="Prazo de entrega (opcional)"><input value={f.lead} onChange={(e) => setF({ ...f, lead: e.target.value })} placeholder="Ex.: Entrega em 1 dia" className={campo} /></Campo>
      </div>
    </Sheet>
  )
}

function NovaConta({ storeId, fornecedores, onClose, onDone }: { storeId: string; fornecedores: Fornecedor[]; onClose: () => void; onDone: () => Promise<unknown> }) {
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
        <div className="flex flex-wrap gap-2">{TIPOS_CONTA.map((t, k) => <button key={t} onClick={() => setB({ ...b, cat: b.cat === t ? '' : t })} className={chipCls} style={chip(b.cat === t, k)}>{t}</button>)}</div>
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
