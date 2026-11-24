import { useState, type CSSProperties } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { brlc, centavos, reais } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { usePermissoes } from '@/app/shell-dados'
import { useToast } from '@/components/toast'
import { BarraLista, SemResultado, norm, Paginacao, paginar, PG0, type Pg } from '@/components/filtros'
import { card, chip, chipCls } from '@/lib/visual'
import { useCaderneta, useFiados, type Fiado, type Lancamento } from './dados'

const campo = 'h-[52px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base outline-none focus:border-brand'
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
const telefone = (t: string | null) => !t ? 'Sem telefone' : t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/** Data de pagamento combinada (payInfo do protótipo). */
function combinado(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00'), t = new Date(); t.setHours(12, 0, 0, 0)
  const dias = Math.round((d.getTime() - t.getTime()) / 864e5)
  const f = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return { dias, label: dias < 0 ? `Pagamento atrasado ${-dias} ${-dias === 1 ? 'dia' : 'dias'} · era ${f}` : dias === 0 ? `Paga hoje · ${f}` : dias === 1 ? `Paga amanhã · ${f}` : `Paga em ${f}` }
}
const corCombinado = (p: ReturnType<typeof combinado>) => (p && p.dias < 0 ? '#FF6B5E' : p && p.dias <= 2 ? '#FBC009' : '#C4C4C9')

const TIPO: Record<string, string> = {
  fiado_sale: 'Compra no fiado', payment: 'Pagamento', adjustment: 'Ajuste', sale_cancel: 'Compra cancelada', merge_in: 'Saldo juntado', merge_out: 'Saldo movido',
}
const FORMA: Record<string, string> = { pix: 'Pix', credit: 'Crédito', debit: 'Débito', cash: 'Dinheiro' }

export function Clientes() {
  const { storeId } = useAuth()
  const { data, error, isLoading } = useFiados(storeId)
  const [q, setQ] = useState('')
  const [fSit, setFSit] = useState('todos')
  const [pgC, setPgC] = useState<Pg>(PG0)
  const [sel, setSel] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const { data: perm } = usePermissoes()

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar o fiado. {error?.message}</div>

  const devendo = data.filter((c) => c.balance > 0)
  const perto = data.filter((c) => c.credit_limit && c.balance / c.credit_limit >= 0.8)
  const stats: [string, string, string][] = [
    ['Fiado a receber', brlc(devendo.reduce((a, c) => a + c.balance, 0)), '#F5F5F2'],
    ['Clientes devendo', `${devendo.length} de ${data.length}`, '#F5F5F2'],
    ['Perto do limite', `${perto.length} ${perto.length === 1 ? 'cliente' : 'clientes'}`, '#FF6B5E'],
  ]
  const qn = norm(q.trim()), qd = q.replace(/\D/g, '')
  const hojeISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const situacao = (c: Fiado) => c.balance <= 0 ? 'quitado' : c.promised_date && c.promised_date < hojeISO ? 'atrasado' : c.credit_limit && c.balance / c.credit_limit >= 0.8 ? 'perto' : 'devendo'
  const lista = data.filter((c) => (!qn || norm(c.name).includes(qn) || (qd && (c.phone ?? '').includes(qd)))
    && (fSit === 'todos' || (fSit === 'devendo' ? c.balance > 0 : situacao(c) === fSit)))
  const limpar = () => { setQ(''); setFSit('todos') }
  const pagC = paginar(lista, pgC, q + fSit)
  const atual = data.find((c) => c.fiado_account_id === sel) ?? null

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[1400px] mx-auto w-full">
      <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
        {stats.map(([l, v, c]) => (
          <div key={l} className="py-4 px-[18px] rounded-[4px_13px_5px_11px] bg-surface border border-line">
            <div className="text-sm text-[#C4C4C9] font-semibold mb-2">{l}</div>
            <div className="text-[26px] font-extrabold num" style={{ color: c, fontStretch: '100%' }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex-[1_1_600px] min-w-0">
          <BarraLista busca={q} onBusca={setQ} placeholder="Buscar por nome ou telefone" mostrando={lista.length} total={data.length} unidade={['cliente', 'clientes']} onLimpar={limpar}
            filtros={[{ label: 'Situação', value: fSit, onChange: setFSit, options: [['todos', 'Todos'], ['devendo', 'Devendo'], ['atrasado', 'Pagamento atrasado'], ['perto', 'Perto do limite'], ['quitado', 'Sem dívida']] }]} />
        </div>
        {perm?.pode('fiado_ajustar') && <button onClick={() => setNovo(true)} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Novo cliente</button>}
      </div>

      <div className={`${card} overflow-hidden`}>
        {pagC.itens.map((c) => {
          const pct = c.credit_limit ? (c.balance / c.credit_limit) * 100 : 0
          const pi = c.balance > 0 ? combinado(c.promised_date) : null
          return (
            <div key={c.fiado_account_id} onClick={() => setSel(c.fiado_account_id)} className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-3.5 px-[18px] border-b border-[#1F1F22] cursor-pointer hover:bg-[#18181B]">
              <span className="w-[42px] h-[42px] rounded-full bg-line-2 text-sm font-extrabold flex items-center justify-center flex-none">{iniciais(c.name)}</span>
              <div className="flex-[1_1_180px] min-w-0">
                <div className="text-[15px] font-bold">{c.name}</div>
                <div className="text-sm text-[#C4C4C9] mt-[3px]">{telefone(c.phone)} · {c.last_purchase ? `Última compra: ${dataCurta(c.last_purchase)}` : 'Sem compras no fiado'}</div>
                {pi && <div className="text-xs font-extrabold mt-1" style={{ color: corCombinado(pi) }}>{pi.label}</div>}
              </div>
              <div className="w-[180px] flex flex-col gap-1.5 items-end ml-auto">
                <span className="text-[17px] font-extrabold num" style={{ color: c.balance > 0 ? (pct >= 80 ? '#FF6B5E' : '#F5F5F2') : '#4ADE80' }}>{c.balance > 0 ? brlc(c.balance) : 'Em dia'}</span>
                {!!c.credit_limit && (
                  <div className="w-full h-[5px] rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${pct > 0 ? Math.min(100, Math.max(2, pct)) : 0}%`, background: pct >= 80 ? '#FF6B5E' : '#FBC009' }} /></div>
                )}
                <span className="text-[13px] text-[#ADADB4]">{c.credit_limit ? `Limite ${brlc(c.credit_limit)}` : 'Sem limite definido'}</span>
              </div>
            </div>
          )
        })}
        <Paginacao p={pagC} onPg={setPgC} />
        {lista.length === 0 && <SemResultado filtrado={!!q.trim() || fSit !== 'todos'} vazio="Ninguém comprou fiado ainda." onLimpar={limpar} />}
      </div>

      {atual && <Detalhe c={atual} storeId={storeId!} onClose={() => setSel(null)} />}
      {novo && <NovoCliente storeId={storeId!} onClose={() => setNovo(false)} onCriado={(id) => { setNovo(false); setSel(id) }} />}
    </div>
  )
}

/** "Novo cliente" do protótipo: só nome e WhatsApp (D55), limite opcional (D55b) e data combinada. */
function NovoCliente({ storeId, onClose, onCriado }: { storeId: string; onClose: () => void; onCriado: (id: string) => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [nome, setNome] = useState('')
  const [fone, setFone] = useState('')
  const [limite, setLimite] = useState('')
  const [data, setData] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = nome.trim().length > 1 && [10, 11].includes(fone.replace(/\D/g, '').length) && !busy
  const salvar = async () => {
    setBusy(true)
    try {
      const r = await rpc<{ fiado_account_id: string }>('create_fiado_account', { p_store_id: storeId, p_name: nome.trim(), p_phone: fone, p_credit_limit: centavos(limite) || null, p_promised_date: data || null })
      toast(`${nome.trim()} cadastrado`)
      await qc.invalidateQueries({ queryKey: ['clientes', storeId] })
      onCriado(r.fiado_account_id)
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  const campo = 'h-[52px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base w-full outline-none focus:border-brand'
  const rot = (l: string) => <span className="text-sm font-bold text-[#C4C4C9]">{l}</span>
  return (
    <Sheet title="Novo cliente" onClose={onClose} footer={<button onClick={salvar} disabled={!ok} className={bigBtn}>{busy ? 'Cadastrando…' : 'Cadastrar cliente'}</button>}>
      <label className="flex flex-col gap-2">{rot('Nome')}<input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Como o cliente é chamado" className={campo} /></label>
      <label className="flex flex-col gap-2">{rot('WhatsApp')}<input value={fone} onChange={(e) => setFone(e.target.value)} inputMode="tel" placeholder="(11) 98765-4321" className={campo} /></label>
      <label className="flex flex-col gap-2">{rot('Limite de fiado (R$) · 0 para não liberar')}<input value={limite} onChange={(e) => setLimite(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="0,00" className={campo} /></label>
      <label className="flex flex-col gap-2">{rot('Data de pagamento do fiado (opcional)')}<input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} style={{ colorScheme: 'dark' }} /></label>
      <div className="text-[13px] text-[#ADADB4]">Só nome e WhatsApp, sem outros dados. O fiado também pode nascer direto na venda, no caixa.</div>
    </Sheet>
  )
}

function Detalhe({ c, storeId, onClose }: { c: Fiado; storeId: string; onClose: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const { data: caderneta } = useCaderneta(storeId, c.fiado_account_id)
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState<'pix' | 'debit' | 'credit'>('pix')
  const [data, setData] = useState(c.promised_date ?? '')
  const [limite, setLimite] = useState(reais(c.credit_limit))
  const [busy, setBusy] = useState(false)
  const pi = combinado(c.promised_date)

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    try {
      toast(await fn())
      await Promise.all([qc.invalidateQueries({ queryKey: ['clientes'] }), qc.invalidateQueries({ queryKey: ['inicio'] })])
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const receber = () => run(async () => {
    const v = centavos(valor)
    if (!v) throw new Error('Informe o valor recebido')
    await rpc('receive_fiado_by_member', { p_store_id: storeId, p_fiado_account_id: c.fiado_account_id, p_amount: v, p_method: forma })
    setValor('')
    return `Pagamento de ${brlc(v)} registrado`
  })
  const salvarData = () => run(async () => {
    if (!data) throw new Error('Escolha a data')
    await rpc('update_fiado', { p_store_id: storeId, p_fiado_account_id: c.fiado_account_id, p_promised_date: data })
    return 'Data combinada salva'
  })
  const salvarLimite = () => run(async () => {
    const v = centavos(limite)
    await rpc('update_fiado', { p_store_id: storeId, p_fiado_account_id: c.fiado_account_id, p_credit_limit: v || null, p_clear_limit: !v })
    return v ? `Limite de ${brlc(v)} salvo` : 'Limite removido'
  })

  const btn: CSSProperties = { flex: 'none' }
  return (
    <Sheet title={<>{c.name}<div className="text-sm text-[#C4C4C9] font-normal mt-[3px]">{telefone(c.phone)}</div></>} onClose={onClose}>
      <div className="p-4 rounded-[3px_11px_4px_10px] bg-surface-2">
        <div className="text-sm text-[#C4C4C9] font-bold">Saldo no fiado</div>
        <div className="text-[36px] font-black num mt-1" style={{ fontStretch: '100%' }}>{brlc(c.balance)}</div>
        <div className="text-sm text-[#C4C4C9] mt-1">{c.credit_limit ? `de ${brlc(c.credit_limit)} de limite` : 'Sem limite definido'}</div>
      </div>

      {c.balance > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-[#C4C4C9]">Receber pagamento</div>
          <div className="flex flex-wrap gap-2">
            {([['pix', 'Pix'], ['debit', 'Débito'], ['credit', 'Crédito']] as const).map(([id, l], k) => (
              <button key={id} onClick={() => setForma(id)} className={chipCls} style={chip(forma === id, k)}>{l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="Valor recebido" className={`${campo} flex-1 min-w-0 text-[17px] font-bold`} />
            <button onClick={receber} disabled={busy} style={btn} className="h-[52px] px-4 rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold cursor-pointer disabled:opacity-60">Receber</button>
          </div>
          <button onClick={() => setValor(reais(c.balance))} className="self-start p-0 bg-transparent text-brand text-sm font-bold cursor-pointer">Quitar tudo ({brlc(c.balance)})</button>
          <div className="text-[13px] text-[#ADADB4]">Pagamento em dinheiro é recebido no caixa, para entrar na gaveta.</div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-sm font-bold text-[#C4C4C9]">Data de pagamento combinada</span>
          <span className="text-[13px] font-extrabold" style={{ color: corCombinado(pi) }}>{pi?.label ?? 'Sem data combinada'}</span>
        </div>
        <div className="flex gap-2">
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={`${campo} flex-1 min-w-0`} style={{ colorScheme: 'dark' }} />
          <button onClick={salvarData} disabled={busy} style={btn} className="h-[52px] px-4 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-[15px] font-extrabold cursor-pointer">Salvar data</button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Limite de fiado (R$) · vazio para não limitar</span>
        <div className="flex gap-2">
          <input value={limite} onChange={(e) => setLimite(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="Sem limite" className={`${campo} flex-1 min-w-0`} />
          <button onClick={salvarLimite} disabled={busy} style={btn} className="h-[52px] px-4 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-[15px] font-extrabold cursor-pointer">Salvar limite</button>
        </div>
      </div>

      {c.phone && (
        <a href={`tel:+55${c.phone}`} className="h-12 rounded-[3px_10px_2px_9px] border border-line-2 bg-transparent text-[15px] font-bold flex items-center justify-center gap-2">
          <Icon name="chat" />Ligar para {c.name.split(' ')[0]}
        </a>
      )}

      <div>
        <div className="flex items-baseline justify-between mb-1"><span className="text-sm font-extrabold text-[#C4C4C9] uppercase tracking-[.05em]">Caderneta</span>
          {!!caderneta?.length && <span className="text-[13px] text-[#C4C4C9]">{caderneta.length} {caderneta.length === 1 ? 'lançamento' : 'lançamentos'}</span>}</div>
        {(caderneta ?? []).map((e: Lancamento) => (
          <div key={e.id} className="flex items-center gap-3 py-[11px] border-b border-line text-sm">
            <span className="w-11 text-[#ADADB4]">{dataCurta(e.created_at)}</span>
            <span className="flex-1 min-w-0">{TIPO[e.type] ?? e.type}{e.method ? ` · ${FORMA[e.method] ?? e.method}` : ''}{e.note && e.type !== 'payment' ? ` · ${e.note}` : ''}</span>
            <span className="font-extrabold num" style={{ color: e.amount < 0 ? '#4ADE80' : '#F5F5F2' }}>{e.amount < 0 ? '−' : ''}{brlc(Math.abs(e.amount))}</span>
          </div>
        ))}
        {caderneta && caderneta.length === 0 && <div className="py-4 text-[#ADADB4] text-sm">Sem lançamentos.</div>}
      </div>
    </Sheet>
  )
}
