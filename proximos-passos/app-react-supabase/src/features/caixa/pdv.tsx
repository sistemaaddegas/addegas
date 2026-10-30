import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { brlc } from '@/lib/format'
import { setCartOpen } from '@/lib/caixa-state'
import { Icon } from '@/components/icon'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { chip, irr } from '@/lib/visual'
import { useCaixaAberto, useCatalogo, type Operador, type Produto } from './dados'
import { AbrirCaixa, Cobrar, Desconto, FecharCaixa, VendaFeita, type Venda } from './modais'
import { ReceberPedidos, usePedidosAReceber, type PedidoCaixa } from './pedidos-caixa'
import { BarraComandas, NovaComanda, TirarItem, linhasDaComanda, useComandas } from './comandas'
import { rpc } from '@/lib/supabase'
import { Gaveta, UltimasVendas } from './vendas-caixa'

type Modal = null | 'abrir' | 'fechar' | 'pagar' | 'desconto' | 'carrinho' | 'pedidos' | 'comanda' | 'vendas' | 'gaveta'

export function Pdv({ op, onTrocar }: { op: Operador; onTrocar: () => void }) {
  const { terminal } = useAuth()
  const { data: cat } = useCatalogo(terminal!.storeId)
  const { data: sessao, isLoading: carregandoCaixa } = useCaixaAberto(terminal!.id)
  const qc = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [carrinho, setCarrinho] = useState<[string, number][]>([])
  const [desconto, setDesconto] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [feita, setFeita] = useState<(Venda & { metodo: string }) | null>(null)
  const [pedido, setPedido] = useState<PedidoCaixa | null>(null)
  const { data: aReceber } = usePedidosAReceber(terminal!.storeId)
  const { data: comandas } = useComandas(terminal!.storeId)
  const [ticket, setTicket] = useState<string | null>(null)
  const [tirar, setTirar] = useState<{ name: string; id: string } | null>(null)
  const comanda = comandas?.find((c) => c.id === ticket) ?? null
  const linhasTab = comanda ? linhasDaComanda(comanda) : null
  const busca = useRef<HTMLInputElement>(null)

  const porKey = useMemo(() => new Map(cat?.itens.map((p) => [p.key, p])), [cat])
  const linhas = carrinho.map(([k, qty]) => ({ p: porKey.get(k)!, qty })).filter((l) => l.p)
  const subtotal = linhasTab ? linhasTab.reduce((a, l) => a + l.price * l.qty, 0) : linhas.reduce((a, l) => a + l.p.price * l.qty, 0)
  const total = Math.max(0, subtotal - desconto)
  const nItens = (linhasTab ?? linhas).reduce((a, l) => a + l.qty, 0)
  const temItens = nItens > 0
  const aberto = !!sessao

  // A atualização do app (E54) espera a venda terminar.
  useEffect(() => { setCartOpen(carrinho.length > 0) }, [carrinho.length])
  useEffect(() => () => setCartOpen(false), [])
  // Qualquer mudança no carrinho é outra venda: novo identificador (o mesmo só se repete ao tentar de novo).
  useEffect(() => { setRequestId(crypto.randomUUID()) }, [carrinho, desconto])

  const mexer = (k: string, d: number) => setCarrinho((l) => {
    const i = l.findIndex(([x]) => x === k)
    const n = l.map((x) => [...x] as [string, number])
    if (i >= 0) n[i][1] += d; else if (d > 0) n.push([k, d])
    return n.filter(([, v]) => v > 0)
  })
  const add = (p: Produto) => {
    if (!aberto) { toast('Abra o caixa para começar a vender'); setModal('abrir'); return }
    if (comanda) {
      // Na comanda o item é lançado na hora e já sai do estoque (D41).
      rpc('add_tab_item', { p_operator_session_id: op.sessionId, p_tab_id: comanda.id, p_product_id: p.kind === 'product' ? p.id : null, p_bundle_id: p.kind === 'bundle' ? p.id : null, p_quantity: 1 })
        .then(() => atualizar(), (e: Error) => toast(e.message))
      return
    }
    mexer(p.key, 1)
  }
  const limpar = () => { setCarrinho([]); setDesconto(0) }
  const cobrar = () => {
    if (!aberto) return setModal('abrir')
    if (!temItens) return toast('Adicione pelo menos um item')
    setModal('pagar')
  }

  const visiveis = useMemo(() => {
    const t = q.trim().toLowerCase()
    const base = filtro === 'meus' ? (cat?.meus ?? []).map((k) => porKey.get(k)).filter((p): p is Produto => !!p) : cat?.itens ?? []
    return base.filter((p) =>
      (filtro === 'todos' || filtro === 'meus' || (filtro === 'promo' ? p.kind === 'bundle' : p.catId === filtro)) &&
      (!t || p.name.toLowerCase().includes(t) || p.ean === t))
  }, [cat, q, filtro, porKey])

  // Atalhos do balcão: / busca, F2 cobra.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (modal) return
      if (e.key === 'F2') { e.preventDefault(); cobrar() }
      else if (e.key === '/' && document.activeElement !== busca.current) { e.preventDefault(); busca.current?.focus() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  // Leitor de código de barras: digita o EAN e manda Enter.
  const enterBusca = () => {
    const t = q.trim()
    const p = cat?.itens.find((x) => x.ean && x.ean === t) ?? (visiveis.length === 1 ? visiveis[0] : undefined)
    if (p) { add(p); setQ('') }
  }

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['caixa'] })
    qc.invalidateQueries({ queryKey: ['inicio'] })
    qc.invalidateQueries({ queryKey: ['pedidos'] })
  }

  const usadas = new Set(cat?.itens.map((p) => p.catId))
  const chips = [
    { id: 'todos', label: 'Todos' },
    ...(cat?.itens.some((p) => p.kind === 'bundle') ? [{ id: 'promo', label: 'Promoções' }] : []),
    ...(cat?.cats.filter((c) => usadas.has(c.id)).map((c) => ({ id: c.id, label: c.name })) ?? []),
    ...(cat?.meus.length ? [{ id: 'meus', label: 'Minha adega' }] : []),
  ]

  const Carrinho = (
    <>
      <div className="flex items-center gap-2.5 pt-4 px-5 pb-3 flex-none">
        <div className="flex-1 min-w-0">
          <div className="text-[19px] font-extrabold truncate">{comanda ? comanda.label : 'Balcão'}{comanda?.nickname ? <span className="text-[#ADADB4] font-semibold"> · {comanda.nickname}</span> : null}</div>
          <div className="text-sm text-[#C4C4C9] mt-1">{nItens ? `${nItens} ${nItens === 1 ? 'item' : 'itens'}` : 'Venda vazia'} · {op.name.split(' ')[0]}</div>
        </div>
        {!comanda && linhas.length > 0 && <button onClick={limpar} className="h-9 px-3 rounded-[2px_7px_3px_6px] bg-[#FF2D2D] hover:bg-[#E01E1E] text-white text-[13px] font-bold cursor-pointer">Limpar</button>}
      </div>
      <BarraComandas comandas={comandas ?? []} atual={comanda?.id ?? null} nBalcao={linhas.reduce((a, l) => a + l.qty, 0)}
        onEscolher={(id) => { setTicket(id); setDesconto(0) }} onNova={() => aberto ? setModal('comanda') : setModal('abrir')} />
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-1 border-t border-line">
        {linhasTab?.map((l) => (
          <div key={l.key} className="flex items-center gap-3 py-3 border-b border-[#1F1F22]">
            <div className="flex-1 min-w-0"><div className="text-[15px] font-semibold leading-[1.3]">{l.name}</div><div className="text-sm text-[#C4C4C9] mt-[3px] num">{l.qty} × {brlc(l.price)}</div></div>
            <div className="flex items-center bg-surface-2 rounded-[3px_10px_2px_9px] border border-line-2 flex-none">
              <button onClick={() => { const u = l.lancamentos[l.lancamentos.length - 1]; setTirar({ name: u.quantity === 1 ? l.name : `${u.quantity}× ${l.name}`, id: u.id }) }} aria-label="Tirar um" className="w-11 h-11 flex items-center justify-center cursor-pointer"><Icon name="minus" /></button>
              <span className="min-w-[26px] text-center font-extrabold num">{l.qty}</span>
              <button onClick={() => { const p = porKey.get(l.key); if (p) add(p) }} aria-label="Mais um" className="w-11 h-11 flex items-center justify-center cursor-pointer"><Icon name="plus" /></button>
            </div>
            <div className="w-[82px] text-right font-bold num flex-none">{brlc(l.price * l.qty)}</div>
          </div>
        ))}
        {!temItens && (
          <div className="flex flex-col items-center gap-3 py-14 px-2.5 text-center text-[#C4C4C9] text-sm">
            <img src="/icons/dd-amarelo.png" alt="" className="w-12 opacity-50" />Toque num produto ou passe o leitor.
          </div>
        )}
        {!comanda && linhas.map(({ p, qty }) => (
          <div key={p.key} className="flex items-center gap-3 py-3 border-b border-[#1F1F22]">
            <div className="flex-1 min-w-0"><div className="text-[15px] font-semibold leading-[1.3]">{p.name}</div><div className="text-sm text-[#C4C4C9] mt-[3px] num">{brlc(p.price)}</div></div>
            <div className="flex items-center bg-surface-2 rounded-[3px_10px_2px_9px] border border-line-2 flex-none">
              <button onClick={() => mexer(p.key, -1)} aria-label="Menos um" className="w-11 h-11 flex items-center justify-center cursor-pointer"><Icon name="minus" /></button>
              <span className="min-w-[26px] text-center font-extrabold num">{qty}</span>
              <button onClick={() => mexer(p.key, 1)} aria-label="Mais um" className="w-11 h-11 flex items-center justify-center cursor-pointer"><Icon name="plus" /></button>
            </div>
            <div className="w-[82px] text-right font-bold num flex-none">{brlc(p.price * qty)}</div>
          </div>
        ))}
      </div>
      <div className="px-5 pt-3.5 pb-5 border-t border-line flex flex-col gap-3 flex-none">
        <button onClick={() => temItens ? setModal('desconto') : toast('Adicione itens antes do desconto')} className="h-[46px] rounded-[2px_8px_3px_7px] border border-line-2 bg-surface-2 text-sm font-bold cursor-pointer flex items-center justify-center gap-2"><Icon name="tag" />Desconto</button>
        {desconto > 0 && (
          <div className="flex flex-col gap-1 text-sm text-[#C4C4C9]">
            <div className="flex justify-between"><span>Subtotal</span><span className="num">{brlc(subtotal)}</span></div>
            <div className="flex justify-between text-ok font-bold"><span>Desconto</span><span className="num">− {brlc(desconto)}</span></div>
          </div>
        )}
        <div className="flex justify-between items-baseline"><span className="text-base font-bold">Total</span><span className="text-[36px] font-black num" style={{ fontStretch: '100%' }}>{brlc(total)}</span></div>
        <button onClick={cobrar} className={`h-[62px] rounded-[3px_11px_4px_10px] text-lg font-extrabold flex items-center justify-center gap-2.5 cursor-pointer ${temItens && aberto ? 'bg-brand text-brand-ink' : 'bg-line-2 text-[#ADADB4]'}`}>
          {aberto ? 'Cobrar' : 'Abrir caixa'}<span className="hidden desktop:inline text-xs font-bold border-[1.5px] border-current/35 rounded-md px-1.5 py-[3px] opacity-70">F2</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex flex-col tablet:flex-row gap-3 tablet:gap-0 tablet:h-full">
      <div className="flex-1 min-w-0 tablet:overflow-y-auto p-4 tablet:px-5 tablet:pt-[18px] tablet:pb-7 desktop:px-6 desktop:pt-5 desktop:pb-8 flex flex-col gap-3 tablet:gap-4 pb-28">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex-[1_1_260px] min-w-0 flex items-center gap-2.5 h-[46px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line text-[#C4C4C9]">
            <Icon name="search" />
            <input ref={busca} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') enterBusca() }}
              placeholder="Buscar produto ou passar o leitor" className="flex-1 min-w-0 h-full bg-transparent outline-none text-[15px] text-ink" />
            <span className="hidden desktop:inline text-xs font-bold border border-[#3A3A40] rounded-md px-[7px] py-[3px]">/</span>
          </div>
          <button onClick={onTrocar} title="Trocar operador" className="h-[46px] px-3 rounded-[3px_10px_2px_9px] bg-surface border border-line flex items-center gap-2 text-sm font-bold cursor-pointer flex-none">
            <Icon name="user" size={18} />{op.name.split(' ')[0]}<span className="text-[#ADADB4] font-semibold">· trocar</span>
          </button>
          {aberto && !!aReceber?.length && (
            <button onClick={() => setModal('pedidos')} title="Receber pedido" className="h-[46px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line text-sm font-bold cursor-pointer flex items-center gap-2 flex-none">
              <Icon name="bag" size={18} />Pedidos<span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-brand-ink text-xs font-extrabold flex items-center justify-center">{aReceber.length}</span>
            </button>
          )}
          <button onClick={() => setModal('vendas')} title="Últimas vendas: cupom e cancelamento" className="h-[46px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line text-sm font-bold cursor-pointer flex items-center gap-2 flex-none"><Icon name="receipt" size={18} />Vendas</button>
          {aberto && <button onClick={() => setModal('gaveta')} title="Sangria, reforço e pagar entregador" className="h-[46px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line text-sm font-bold cursor-pointer flex items-center gap-2 flex-none"><Icon name="cash" size={18} />Gaveta</button>}
          {aberto && (
            <button onClick={() => setModal('fechar')} className="h-[46px] px-3.5 rounded-[3px_10px_2px_9px] bg-[#E5241B] text-white text-sm font-extrabold cursor-pointer flex items-center gap-2 flex-none"><Icon name="wallet" size={18} />Fechar caixa</button>
          )}
        </div>

        {!aberto && !carregandoCaixa && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 rounded-[3px_11px_4px_10px] bg-[rgba(255,107,94,.10)] border border-[rgba(255,107,94,.3)]">
            <span className="text-bad"><Icon name="alert" /></span>
            <div className="flex-[1_1_200px] text-[15px] font-bold">Caixa fechado. Abra o caixa para começar a vender.</div>
            <button onClick={() => setModal('abrir')} className="h-11 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold cursor-pointer">Abrir caixa</button>
          </div>
        )}

        <div className="flex gap-2 flex-nowrap tablet:flex-wrap overflow-x-auto tablet:overflow-visible -mx-4 px-4 tablet:mx-0 tablet:px-0 [scrollbar-width:none]">
          {chips.map((c, i) => (
            <button key={c.id} onClick={() => setFiltro(c.id)} style={chip(filtro === c.id, i)} className="h-10 px-4 text-sm font-bold cursor-pointer whitespace-nowrap flex-none">{c.label}</button>
          ))}
        </div>

        <div className="grid gap-2.5 content-start grid-cols-2 tablet:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          {visiveis.map((p, i) => {
            const qty = carrinho.find(([k]) => k === p.key)?.[1] ?? 0
            const baixo = p.stock !== null && p.stock < p.min
            const promo = p.kind === 'bundle'
            return (
              <div key={p.key} onClick={() => add(p)} onContextMenu={(e) => { e.preventDefault(); mexer(p.key, -1) }} title="Clique: +1 · Botão direito: −1"
                className="relative flex flex-col gap-2 min-h-[120px] tablet:min-h-32 p-3.5 rounded-[3px_11px_4px_10px] cursor-pointer select-none text-left transition-transform duration-75 active:scale-[.97]"
                style={{ border: `1px solid ${qty ? '#FBC009' : '#232327'}`, background: qty ? 'rgba(251,192,9,.08)' : '#141416' }}>
                {qty > 0 && <span className="absolute top-2.5 right-2.5 z-[1] min-w-[26px] h-[26px] px-[7px] rounded-full bg-brand text-brand-ink text-[13px] font-extrabold flex items-center justify-center">{qty}</span>}
                <div className="h-[76px] tablet:h-[92px] -mx-1 -mt-1 mb-0.5 overflow-hidden flex items-center justify-center flex-none"
                  style={{ borderRadius: irr(i), ...(p.image ? { background: `#F5F5F2 url("${p.image}") center/contain no-repeat` } : { background: `radial-gradient(120% 85% at 50% 100%,${p.color}30,transparent 62%),#101012`, border: `1px solid ${p.color}2E` }) }}>
                  {!p.image && <img src="/icons/dd-amarelo.png" alt="" draggable={false} className="h-[45px] tablet:h-[55px] w-auto max-w-[80%] object-contain opacity-30 pointer-events-none" />}
                </div>
                <span className={`self-start text-xs font-extrabold uppercase tracking-[.05em] ${promo ? 'bg-brand text-brand-ink rounded-[5px] px-1.5 py-0.5' : 'text-[#A1A1A6]'}`}>{p.catName}</span>
                <span className="text-[15px] font-semibold leading-[1.25] pr-1 min-h-[38px]">{p.name}</span>
                <span className="flex flex-col items-start gap-1 mt-auto min-w-0">
                  <span className="text-[19px] font-extrabold num whitespace-nowrap leading-[1.1]">{brlc(p.price)}</span>
                  {p.stock !== null && <span className={`text-[13px] font-bold leading-[1.25] truncate max-w-full ${baixo ? 'text-bad' : 'text-[#ADADB4]'}`}>{p.stock} un{baixo ? ' · baixo' : ''}</span>}
                </span>
              </div>
            )
          })}
        </div>
        {cat && !visiveis.length && <div className="py-12 px-4 text-center text-[#C4C4C9] text-[15px]">Nenhum produto encontrado.</div>}
      </div>

      <aside className="hidden tablet:flex w-[340px] desktop:w-[380px] flex-none flex-col bg-surface border-l border-line">{Carrinho}</aside>

      {/* Celular: a venda fica numa barra acima das abas e abre como folha. */}
      {temItens && modal !== 'carrinho' && (
        <button onClick={() => setModal('carrinho')} className="tablet:hidden fixed left-3 right-3 bottom-[76px] z-40 h-[58px] px-4 rounded-[3px_11px_4px_10px] bg-brand text-brand-ink flex items-center gap-3 font-extrabold shadow-[0_12px_30px_rgba(0,0,0,.5)] cursor-pointer">
          <Icon name="cart" /><span className="flex-1 text-left">Ver venda · {nItens} {nItens === 1 ? 'item' : 'itens'}</span><span className="num text-lg">{brlc(total)}</span>
        </button>
      )}
      {modal === 'carrinho' && <MobileCarrinho onClose={() => setModal(null)}>{Carrinho}</MobileCarrinho>}

      {modal === 'abrir' && <AbrirCaixa op={op} onClose={() => setModal(null)} onDone={() => { setModal(null); atualizar() }} />}
      {modal === 'fechar' && sessao && <FecharCaixa op={op} sessao={sessao} cega={!!cat?.contagemCega} onClose={() => setModal(null)} onDone={() => { setModal(null); atualizar(); onTrocar() }} />}
      {modal === 'desconto' && <Desconto subtotal={subtotal} atual={desconto} onClose={() => setModal(null)} onApply={(c) => { setDesconto(c); setModal(null) }} />}
      {modal === 'pagar' && (
        <Cobrar op={op} total={total} desconto={desconto} pix={cat?.pix ?? null} requestId={requestId}
          itens={linhas.map(({ p, qty }) => ({ kind: p.kind, id: p.id, qty }))}
          comanda={comanda ? { id: comanda.id, label: comanda.label, itens: nItens } : undefined}
          onClose={() => setModal(null)} onDone={(v) => {
            setModal(null); setFeita(comanda ? { ...v, metodo: `${comanda.label} · ${v.metodo}` } : v)
            if (comanda) { setTicket(null); setDesconto(0) } else limpar()
            atualizar()
          }} />
      )}
      {modal === 'comanda' && <NovaComanda op={op} existentes={comandas ?? []} onClose={() => setModal(null)} onCriada={(id) => { setModal(null); setTicket(id); atualizar() }} />}
      {tirar && <TirarItem nome={tirar.name} onClose={() => setTirar(null)} onOk={async (motivo) => {
        try { await rpc('remove_tab_item', { p_operator_session_id: op.sessionId, p_tab_item_id: tirar.id, p_reason: motivo }); setTirar(null); atualizar() }
        catch (e) { toast((e as Error).message) }
      }} />}
      {modal === 'pedidos' && <ReceberPedidos pedidos={aReceber ?? []} onClose={() => setModal(null)} onEscolher={(o) => { setPedido(o); setModal(null) }} />}
      {pedido && (
        <Cobrar op={op} total={pedido.total} desconto={0} pix={cat?.pix ?? null} requestId={pedido.id} itens={[]} pedido={{ id: pedido.id, number: pedido.number, itens: pedido.itens }}
          onClose={() => setPedido(null)} onDone={(v) => { setPedido(null); setFeita({ ...v, metodo: `Pedido #${pedido.number} · ${v.metodo}` }); atualizar() }} />
      )}
      {modal === 'vendas' && <UltimasVendas op={op} onClose={() => setModal(null)} onCancelada={atualizar} />}
      {modal === 'gaveta' && <Gaveta op={op} onClose={() => setModal(null)} onDone={() => { setModal(null); atualizar() }} />}
      {feita && <VendaFeita venda={feita} onNext={() => { setFeita(null); busca.current?.focus() }} />}
    </div>
  )
}

function MobileCarrinho({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Sheet onClose={onClose}>
      <div className="-mx-5 -mt-1 -mb-5 flex flex-col h-[80dvh]">{children}</div>
    </Sheet>
  )
}
