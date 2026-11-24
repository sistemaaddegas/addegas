import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/icon'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { brlc, centavos, reais } from '@/lib/format'
import { brCode } from '@/lib/pix'
import { mensagem } from '@/lib/erros'
import { supabase } from '@/lib/supabase'
import { chip } from '@/lib/visual'
import { deleteContingencySale, flushContingencySales, onContingencyChange, pendingContingencySales, saveContingencySale,
  updateContingencySale, type ContingencySale, type Metodo } from '@/lib/contingencia'
import { QrPix } from './modais'
import type { Operador } from './dados'
import type { Retrato } from './retrato'

const METODOS: [Metodo, string][] = [['pix', 'Pix'], ['debit', 'Débito'], ['credit', 'Crédito'], ['cash', 'Dinheiro']]
const NOME_METODO: Record<string, string> = Object.fromEntries(METODOS)
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * Anotações guardadas neste aparelho. Com internet, lança sozinho as que ainda não foram recusadas;
 * sem login válido no aparelho, espera (o banco é quem confere a sessão de quem vendeu).
 */
export function usePendentes(online: boolean) {
  const [lista, setLista] = useState<ContingencySale[]>([])
  const [enviando, setEnviando] = useState(false)
  const [semLogin, setSemLogin] = useState(false)
  const ocupado = useRef(false)
  const qc = useQueryClient()

  const ler = useCallback(() => { pendingContingencySales().then(setLista, () => setLista([])) }, [])
  useEffect(() => { ler(); return onContingencyChange(ler) }, [ler])

  const enviar = useCallback(async () => {
    if (ocupado.current) return
    ocupado.current = true
    setEnviando(true)
    try {
      const { data } = await supabase.auth.getSession()
      setSemLogin(!data.session)
      if (!data.session) return
      const r = await flushContingencySales()
      if (r.sent) qc.invalidateQueries({ queryKey: ['caixa'] })
    } catch { /* fica para a próxima */ } finally {
      ocupado.current = false
      setEnviando(false)
    }
  }, [qc])

  const aEnviar = lista.filter((s) => !s.error).length
  useEffect(() => { if (online && aEnviar) void enviar() }, [online, aEnviar, enviar])

  return { lista, enviando, semLogin, enviar }
}

/** Lista das vendas anotadas sem internet, com o que fazer quando o servidor recusou uma delas. */
function Pendentes({ lista, online, enviando, semLogin, opAtual, enviar }: ReturnType<typeof usePendentes> & { online: boolean; opAtual: Operador | null }) {
  const [descartar, setDescartar] = useState<string | null>(null)
  const total = lista.reduce((a, s) => a + s.total, 0)
  const resolver = async (s: ContingencySale, mudanca: Partial<ContingencySale>) => {
    await updateContingencySale({ ...s, ...mudanca, error: undefined })
    if (online) void enviar()
  }
  if (!lista.length) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-[15px] font-extrabold">Anotadas neste aparelho</div>
        <span className="text-[13px] font-bold text-[#C4C4C9] num">{lista.length} {lista.length === 1 ? 'venda' : 'vendas'} · {brlc(total)}</span>
        <span className="ml-auto text-[13px] font-bold text-[#ADADB4]">
          {enviando ? 'Lançando…' : semLogin ? 'Aguardando o aparelho entrar de novo' : online ? '' : 'Entram quando a internet voltar'}
        </span>
      </div>
      {lista.map((s) => {
        const e = s.error
        return (
          <div key={s.client_request_id} className={`flex flex-col gap-2 p-3 rounded-[3px_10px_2px_9px] border ${e ? 'border-[rgba(255,107,94,.45)] bg-[rgba(255,107,94,.08)]' : 'border-line bg-surface-2'}`}>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold num">{hora(s.created_at)}</span>
              <span className="text-[13px] text-[#C4C4C9] truncate">{s.operator_name} · {NOME_METODO[s.payments[0]?.method] ?? ''}</span>
              <span className="ml-auto text-base font-extrabold num">{brlc(s.total)}</span>
            </div>
            <div className="text-[13px] text-[#C4C4C9] leading-[1.35]">{s.items.map((i) => `${i.quantity}× ${i.name}`).join(' · ')}</div>
            {e && (
              <>
                <div className="text-[13.5px] font-bold text-bad">
                  {e.code === 'SALE_PAYMENT_MISMATCH' && e.server_total ? `O preço mudou: hoje essa venda dá ${brlc(e.server_total)}.` : mensagem(e.code)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.code === 'SALE_PAYMENT_MISMATCH' && e.server_total && (
                    <button onClick={() => resolver(s, { total: e.server_total!, payments: [{ method: s.payments[0].method, amount: e.server_total! }] })}
                      className="h-9 px-3 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-[13px] font-extrabold cursor-pointer">Lançar com {brlc(e.server_total)}</button>
                  )}
                  {(e.code === 'SALE_OPERATOR_INVALID' || e.code === 'FORBIDDEN') && opAtual && opAtual.sessionId !== s.operator_session_id && (
                    <button onClick={() => resolver(s, { operator_session_id: opAtual.sessionId, operator_name: opAtual.name })}
                      className="h-9 px-3 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-[13px] font-extrabold cursor-pointer">Lançar no nome de {opAtual.name.split(' ')[0]}</button>
                  )}
                  <button onClick={() => resolver(s, {})} className="h-9 px-3 rounded-[2px_8px_3px_7px] border border-line-2 text-[13px] font-bold cursor-pointer">Tentar de novo</button>
                  {descartar === s.client_request_id
                    ? <button onClick={() => { void deleteContingencySale(s.client_request_id); setDescartar(null) }} className="h-9 px-3 rounded-[2px_8px_3px_7px] bg-[#FF2D2D] text-white text-[13px] font-extrabold cursor-pointer">Confirmar: descartar esta venda</button>
                    : <button onClick={() => setDescartar(s.client_request_id)} className="h-9 px-3 rounded-[2px_8px_3px_7px] border border-line-2 text-[13px] font-bold text-bad cursor-pointer">Descartar</button>}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** No caixa normal: o que sobrou de uma queda de internet, para lançar ou resolver. */
export function AvisoPendentes({ op, online }: { op: Operador; online: boolean }) {
  const p = usePendentes(online)
  const [aberto, setAberto] = useState(false)
  const comErro = p.lista.filter((s) => s.error).length
  if (!p.lista.length) return null
  return (
    <>
      <button onClick={() => setAberto(true)} className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-[3px_11px_4px_10px] border text-left cursor-pointer ${comErro ? 'bg-[rgba(255,107,94,.10)] border-[rgba(255,107,94,.3)]' : 'bg-[rgba(251,192,9,.08)] border-[rgba(251,192,9,.3)]'}`}>
        <span className={comErro ? 'text-bad' : 'text-brand'}><Icon name={comErro ? 'alert' : 'clock'} /></span>
        <span className="flex-[1_1_200px] text-[15px] font-bold">
          {p.lista.length} {p.lista.length === 1 ? 'venda anotada' : 'vendas anotadas'} sem internet
          {comErro ? ` · ${comErro} ${comErro === 1 ? 'precisa' : 'precisam'} de você` : p.enviando ? ' · lançando…' : ''}
        </span>
        <span className="text-sm font-extrabold text-brand">Ver</span>
      </button>
      {aberto && <Sheet title="Vendas sem internet" onClose={() => setAberto(false)}><Pendentes {...p} online={online} opAtual={op} /></Sheet>}
    </>
  )
}

/**
 * Modo contingência (D14, E20, E54): o caixa sem internet anota a venda no aparelho, com os preços que tinha
 * da última vez que carregou. Nada baixa estoque nem ganha número agora; quando a internet volta, cada
 * anotação entra como venda "sem internet", conferida pelo gerente nos relatórios.
 */
export function Contingencia({ retrato, online, onVoltar }: { retrato: Retrato; online: boolean; onVoltar: () => void }) {
  const toast = useToast()
  const p = usePendentes(online)
  // Quem vende: quem estava no caixa (com a sessão aberta) ou outra pessoa da equipe; a sessão desta é aberta
  // quando a internet voltar, no nome de quem estiver no caixa (a tela de pendentes mostra isso).
  const opcoes = [...(retrato.op ? [{ key: 's:' + retrato.op.sessionId, sessionId: retrato.op.sessionId, name: retrato.op.name }] : []),
    ...retrato.operadores.filter((m) => m.id !== retrato.op?.memberId).map((m) => ({ key: 'm:' + m.id, sessionId: '', name: m.display_name }))]
  const [opKey, setOpKey] = useState(opcoes[0]?.key ?? '')
  const op = opcoes.find((o) => o.key === opKey) ?? null
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [carrinho, setCarrinho] = useState<[string, number][]>([])
  const [metodo, setMetodo] = useState<Metodo>('pix')
  const [recebido, setRecebido] = useState('')
  const [verVenda, setVerVenda] = useState(false)

  const porKey = useMemo(() => new Map(retrato.itens.map((i) => [i.key, i])), [retrato])
  const linhas = carrinho.map(([k, qty]) => ({ i: porKey.get(k)!, qty })).filter((l) => l.i)
  const total = linhas.reduce((a, l) => a + l.i.price * l.qty, 0)
  const nItens = linhas.reduce((a, l) => a + l.qty, 0)
  const troco = metodo === 'cash' && recebido ? centavos(recebido) - total : 0
  const codigoPix = useMemo(() => retrato.pix && total > 0 ? brCode(retrato.pix, total, 'SEMINTERNET') : null, [retrato.pix, total])

  const mexer = (k: string, d: number) => setCarrinho((l) => {
    const n = l.map((x) => [...x] as [string, number])
    const i = n.findIndex(([x]) => x === k)
    if (i >= 0) n[i][1] += d; else if (d > 0) n.push([k, d])
    return n.filter(([, v]) => v > 0)
  })
  const visiveis = useMemo(() => {
    const t = q.trim().toLowerCase()
    return retrato.itens.filter((i) => (filtro === 'todos' || (filtro === 'promo' ? i.kind === 'bundle' : i.catId === filtro))
      && (!t || i.name.toLowerCase().includes(t) || i.ean === t))
  }, [retrato, q, filtro])
  const usadas = new Set(retrato.itens.map((i) => i.catId))
  const chips = [{ id: 'todos', label: 'Todos' }, ...(retrato.itens.some((i) => i.kind === 'bundle') ? [{ id: 'promo', label: 'Promoções' }] : []),
    ...retrato.cats.filter((c) => usadas.has(c.id)).map((c) => ({ id: c.id, label: c.name }))]

  const anotar = async () => {
    if (!op) return toast('Toque no seu nome antes de anotar')
    if (!nItens) return toast('Adicione pelo menos um item')
    if (metodo === 'cash' && recebido && troco < 0) return toast('O valor recebido é menor que o total')
    try {
      await saveContingencySale({
        store_id: retrato.storeId, operator_session_id: op.sessionId, operator_name: op.name, total,
        items: linhas.map(({ i, qty }) => ({ [i.kind === 'bundle' ? 'bundle_id' : 'product_id']: i.id, quantity: qty, name: i.name, price: i.price })),
        payments: [{ method: metodo, amount: total }],
      })
      toast(online ? 'Venda anotada. Lançando agora.' : 'Venda anotada. Ela entra no sistema quando a internet voltar.')
      setCarrinho([]); setRecebido(''); setVerVenda(false)
    } catch { toast('Não deu para guardar neste aparelho. Anote no papel.') }
  }

  const Venda = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[19px] font-extrabold">Venda</div>
        {linhas.length > 0 && <button onClick={() => setCarrinho([])} className="h-9 px-3 rounded-[2px_7px_3px_6px] bg-[#FF2D2D] text-white text-[13px] font-bold cursor-pointer">Limpar</button>}
      </div>
      {!linhas.length && <div className="py-6 text-center text-sm text-[#C4C4C9]">Toque nos produtos para anotar a venda.</div>}
      {linhas.map(({ i, qty }) => (
        <div key={i.key} className="flex items-center gap-3 py-2 border-b border-[#1F1F22]">
          <div className="flex-1 min-w-0"><div className="text-[15px] font-semibold leading-[1.3]">{i.name}</div><div className="text-sm text-[#C4C4C9] num">{brlc(i.price)}</div></div>
          <div className="flex items-center bg-surface-2 rounded-[3px_10px_2px_9px] border border-line-2 flex-none">
            <button onClick={() => mexer(i.key, -1)} aria-label="Menos um" className="w-11 h-11 flex items-center justify-center cursor-pointer"><Icon name="minus" /></button>
            <span className="min-w-[26px] text-center font-extrabold num">{qty}</span>
            <button onClick={() => mexer(i.key, 1)} aria-label="Mais um" className="w-11 h-11 flex items-center justify-center cursor-pointer"><Icon name="plus" /></button>
          </div>
        </div>
      ))}
      <div className="flex justify-between items-baseline"><span className="text-base font-bold">Total</span><span className="text-[32px] font-black num">{brlc(total)}</span></div>
      <div className="grid grid-cols-4 gap-1.5">
        {METODOS.map(([m, l], k) => <button key={m} onClick={() => setMetodo(m)} style={chip(metodo === m, k)} className="h-11 text-sm font-bold cursor-pointer">{l}</button>)}
      </div>
      {metodo === 'pix' && total > 0 && (codigoPix
        ? <div className="flex items-center gap-3"><QrPix texto={codigoPix} /><div className="text-[13px] text-[#C4C4C9] leading-[1.4]">Pix da loja com o valor. Confira o recebimento no aplicativo do banco antes de liberar.</div></div>
        : <div className="text-[13px] text-[#ADADB4]">Sem chave Pix cadastrada neste aparelho. Use a chave da loja.</div>)}
      {metodo === 'cash' && (
        <div className="flex items-center gap-3">
          <label className="flex-1 flex items-center gap-2 h-12 px-3 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2">
            <span className="text-sm text-[#C4C4C9]">Recebido R$</span>
            <input value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder={reais(total)} className="flex-1 min-w-0 bg-transparent outline-none text-lg font-bold num" />
          </label>
          {recebido && <div className={`text-base font-extrabold num ${troco < 0 ? 'text-bad' : ''}`}>Troco {brlc(Math.max(0, troco))}</div>}
        </div>
      )}
      <button onClick={anotar} className={`h-[58px] rounded-[3px_11px_4px_10px] text-lg font-extrabold cursor-pointer ${nItens && op ? 'bg-brand text-brand-ink' : 'bg-line-2 text-[#ADADB4]'}`}>Anotar venda</button>
    </div>
  )

  return (
    <div className="min-h-dvh bg-bg text-ink flex flex-col">
      <div className={`flex flex-wrap items-center gap-3 px-4 py-3 border-b ${online ? 'bg-[rgba(59,209,111,.10)] border-[rgba(59,209,111,.35)]' : 'bg-[rgba(255,107,94,.10)] border-[rgba(255,107,94,.35)]'}`}>
        <span className={online ? 'text-ok' : 'text-bad'}><Icon name={online ? 'check' : 'alert'} /></span>
        <div className="flex-[1_1_260px] min-w-0">
          <div className="text-[15px] font-extrabold">{online ? 'A internet voltou' : 'Sem internet · modo contingência'}</div>
          <div className="text-[13px] text-[#C4C4C9] leading-[1.4]">
            {online
              ? p.lista.some((s) => !s.error) ? 'Lançando as vendas anotadas…'
                : p.lista.length ? 'Alguma venda anotada precisa de você antes de entrar (veja abaixo). Também dá para resolver depois, no caixa.'
                : 'As vendas anotadas já entraram no sistema. Pode voltar ao caixa.'
              : `As vendas ficam guardadas neste aparelho e entram no sistema quando a internet voltar. Preços de ${hora(retrato.salvoEm)}.`}
          </div>
        </div>
        {online && <button onClick={onVoltar} disabled={p.semLogin} className="h-11 px-4 rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold cursor-pointer disabled:opacity-40">Voltar ao caixa</button>}
      </div>

      <div className="flex-1 min-h-0 flex flex-col tablet:flex-row">
        <div className="flex-1 min-w-0 p-4 tablet:px-5 flex flex-col gap-3 pb-28 tablet:pb-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex-[1_1_240px] min-w-0 flex items-center gap-2.5 h-[46px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line text-[#C4C4C9]">
              <Icon name="search" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                const i = retrato.itens.find((x) => x.ean && x.ean === q.trim()) ?? (visiveis.length === 1 ? visiveis[0] : undefined)
                if (i) { mexer(i.key, 1); setQ('') }
              }} placeholder="Buscar produto ou passar o leitor" className="flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] text-ink" />
            </div>
            <div className="h-[46px] px-3 rounded-[3px_10px_2px_9px] bg-surface border border-line flex items-center gap-2 text-sm font-bold flex-none">
              <Icon name="user" size={18} />
              <select value={opKey} onChange={(e) => setOpKey(e.target.value)} aria-label="Quem está vendendo" className="bg-transparent outline-none font-bold cursor-pointer max-w-[180px]">
                {!op && <option value="">Quem está vendendo?</option>}
                {opcoes.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 flex-nowrap tablet:flex-wrap overflow-x-auto -mx-4 px-4 tablet:mx-0 tablet:px-0 [scrollbar-width:none]">
            {chips.map((c, k) => <button key={c.id} onClick={() => setFiltro(c.id)} style={chip(filtro === c.id, k)} className="h-10 px-4 text-sm font-bold cursor-pointer whitespace-nowrap flex-none">{c.label}</button>)}
            <span className="self-center ml-auto pl-2 text-[13px] text-[#C4C4C9] whitespace-nowrap flex-none">
              {visiveis.length === retrato.itens.length ? `${retrato.itens.length} produtos` : `Mostrando ${visiveis.length} de ${retrato.itens.length}`}
            </span>
          </div>
          <div className="grid gap-2.5 content-start grid-cols-2 tablet:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {visiveis.map((i) => {
              const qty = carrinho.find(([k]) => k === i.key)?.[1] ?? 0
              return (
                <button key={i.key} onClick={() => mexer(i.key, 1)} onContextMenu={(e) => { e.preventDefault(); mexer(i.key, -1) }}
                  className="relative flex flex-col gap-1.5 min-h-[92px] p-3 rounded-[3px_11px_4px_10px] text-left cursor-pointer select-none active:scale-[.97]"
                  style={{ border: `1px solid ${qty ? '#FBC009' : '#232327'}`, background: qty ? 'rgba(251,192,9,.08)' : '#141416' }}>
                  {qty > 0 && <span className="absolute top-2 right-2 min-w-[24px] h-[24px] px-1.5 rounded-full bg-brand text-brand-ink text-xs font-extrabold flex items-center justify-center">{qty}</span>}
                  <span className="text-xs font-extrabold uppercase tracking-[.05em] text-[#A1A1A6]">{i.catName}</span>
                  <span className="text-[15px] font-semibold leading-[1.25] pr-6">{i.name}</span>
                  <span className="mt-auto text-[17px] font-extrabold num">{brlc(i.price)}</span>
                </button>
              )
            })}
          </div>
          {!visiveis.length && <div className="py-10 text-center text-[#C4C4C9]">Nenhum produto encontrado.</div>}
          <Pendentes {...p} online={online} opAtual={retrato.op} />
        </div>
        <aside className="hidden tablet:block w-[360px] flex-none p-5 bg-surface border-l border-line overflow-y-auto">{Venda}</aside>
      </div>

      {nItens > 0 && !verVenda && (
        <button onClick={() => setVerVenda(true)} className="tablet:hidden fixed left-3 right-3 bottom-4 z-40 h-[58px] px-4 rounded-[3px_11px_4px_10px] bg-brand text-brand-ink flex items-center gap-3 font-extrabold shadow-[0_12px_30px_rgba(0,0,0,.5)] cursor-pointer">
          <Icon name="cart" /><span className="flex-1 text-left">Ver venda · {nItens} {nItens === 1 ? 'item' : 'itens'}</span><span className="num text-lg">{brlc(total)}</span>
        </button>
      )}
      {verVenda && <Sheet onClose={() => setVerVenda(false)}>{Venda}</Sheet>}
    </div>
  )
}
