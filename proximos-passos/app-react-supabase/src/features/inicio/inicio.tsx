import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/lib/auth'
import { brlc } from '@/lib/format'
import { Icon, type IconName } from '@/components/icon'
import { useInicio, type Pedido } from './dados'

// Bordas irregulares do protótipo (IRR / irr(i)).
const IRR = ['2px 14px 3px 11px / 3px 9px 2px 12px', '12px 2px 13px 3px / 9px 3px 12px 2px', '3px 11px 2px 14px / 12px 2px 9px 3px', '13px 3px 11px 2px / 2px 12px 3px 9px']
const irr = (i: number) => IRR[((i % 4) + 4) % 4]
const KC = ['#4ADE80', '#FBC009', '#7CB3FF', '#FF8A5B']
const card = 'rounded-[4px_13px_5px_11px] bg-surface border border-line flex flex-col min-w-0'

const CANAL: Record<string, { nome: string; img?: string; letra?: string; bg?: string; cor?: string }> = {
  ifood: { nome: 'iFood', img: '/assets/apps/ifood-red.png' },
  ze_delivery: { nome: 'Zé Delivery', img: '/assets/apps/ze-delivery.png' },
  food99: { nome: '99Food', img: '/assets/apps/99food.png' },
  keeta: { nome: 'Keeta', img: '/assets/apps/keeta.png' },
  whatsapp: { nome: 'WhatsApp', bg: '#25D366', cor: '#FFFFFF' },
  phone: { nome: 'Telefone', letra: 'T', bg: '#2A2A2E', cor: '#F5F5F2' },
  counter: { nome: 'Balcão', letra: 'B', bg: '#2A2A2E', cor: '#F5F5F2' },
  catalog: { nome: 'Catálogo', letra: 'C', bg: '#FBC009', cor: '#0A0A0B' },
}

const pill = (c: string, bg: string): CSSProperties => ({ color: c, background: bg })
const pillCls = 'inline-flex items-center h-[26px] px-2.5 rounded-full text-xs font-extrabold whitespace-nowrap flex-none'
const STATUS: Record<string, [string, CSSProperties]> = {
  new: ['Novo', pill('#0A0A0B', '#FBC009')],
  preparing: ['Em preparo', pill('#4ADE80', 'rgba(74,222,128,.12)')],
  ready: ['Pronto', pill('#4ADE80', 'rgba(74,222,128,.12)')],
  out_for_delivery: ['Em rota', pill('#7CB3FF', 'rgba(124,179,255,.12)')],
}

const minutos = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
const ha = (iso: string) => { const m = minutos(iso); return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} d` }
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaSemana = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  const w = d.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0]
  return `${w}${/^(s[áa]bado|domingo)$/.test(w) ? ' passado' : ' passada'} (${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`
}

/** Miniatura do produto: foto, ou o "dd" apagado sobre a cor da categoria. */
function Arte({ image, size }: { image: string | null; size: number }) {
  if (image) return null
  return <img src="/icons/dd-amarelo.png" alt="" draggable={false} className="block w-auto max-w-[80%] object-contain opacity-30 pointer-events-none" style={{ height: Math.round(size * 0.78) }} />
}

function Logo({ p }: { p: Pedido }) {
  const c = CANAL[p.channel] ?? { nome: p.channel, letra: p.channel[0]?.toUpperCase(), bg: '#2A2A2E', cor: '#F5F5F2' }
  return (
    <span title={c.nome} className="w-10 h-10 flex-none overflow-hidden rounded-[3px_10px_2px_9px] flex items-center justify-center text-[17px] font-black"
      style={{ background: c.img ? '#FFFFFF' : c.bg, color: c.cor }}>
      {c.img ? <span className="block w-full h-full bg-cover bg-center" style={{ backgroundImage: `url("${c.img}")` }} />
        : c.letra ?? <Icon name="chat" size={22} />}
    </span>
  )
}

function Cabecalho({ titulo, children }: { titulo: ReactNode; children?: ReactNode }) {
  return <div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-2 text-[17px] font-extrabold">{titulo}</div>{children}</div>
}

const linkBtn = 'flex items-center gap-1 bg-transparent text-brand text-sm font-bold cursor-pointer'

export function Inicio() {
  const { session, storeId } = useAuth()
  const navigate = useNavigate()
  const { data: d, error, isLoading } = useInicio(storeId, session?.user.id)

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !d) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar o Início. {error?.message}</div>

  const hr = new Date().getHours()
  const greet = (hr < 5 || hr >= 18 ? 'Boa noite' : hr < 12 ? 'Bom dia' : 'Boa tarde') + ','
  const primeiroNome = d.nome.trim().split(/\s+/)[0]
  const dateL = (() => { const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); return s[0].toUpperCase() + s.slice(1) })()
  const homeSub = `${dateL} · ${d.caixa ? `Caixa aberto por ${d.caixa.por.split(' ')[0]} desde ${hora(d.caixa.desde)}` : 'Caixa fechado'}`

  const novos = d.pedidos.filter((o) => o.status === 'new')
  const passada = d.semanaPassada.total
  const varPct = passada ? Math.round((d.dash.sales_total / passada - 1) * 100) : null
  const kpis = [
    { label: 'Vendas hoje', value: brlc(d.dash.sales_total),
      note: varPct === null ? `Sem vendas na ${diaSemana(d.semanaPassada.dia)} até esta hora` : `${varPct >= 0 ? '+' : ''}${varPct}% vs. ${diaSemana(d.semanaPassada.dia)}`,
      noteCls: `text-[13px] font-bold ${varPct === null ? 'text-[#C4C4C9]' : varPct >= 0 ? 'text-ok' : 'text-bad'}` },
    { label: 'Vendas no caixa', value: String(d.dash.sales_count), note: `Ticket médio ${brlc(d.dash.avg_ticket)}`, noteCls: 'text-sm text-[#C4C4C9]' },
    { label: 'Pedidos em andamento', value: String(d.pedidos.length), note: novos.length ? `${novos.length} aguardando aceite` : 'Nenhum aguardando',
      noteCls: `text-sm font-bold ${novos.length ? 'text-brand' : 'text-[#C4C4C9]'}` },
    { label: 'Fiado a receber', value: brlc(d.fiado.total), note: `${d.fiado.clientes} ${d.fiado.clientes === 1 ? 'cliente' : 'clientes'}`, noteCls: 'text-sm text-[#C4C4C9]' },
  ]

  const qBase = 'flex items-center gap-3 h-[60px] px-[18px] rounded-[3px_11px_4px_10px] text-[15px] font-bold text-left cursor-pointer transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-px active:scale-[.97]'
  const quick: [IconName, string, string, string, string][] = [
    ['cart', 'Nova venda', '/caixa', '#FBC009', '#0A0A0B'],
    ['wallet', d.caixa ? 'Fechar caixa' : 'Abrir caixa', '/caixa', d.caixa ? '#E5241B' : '#4ADE80', d.caixa ? '#FFFFFF' : '#0A0A0B'],
    ['down', 'Entrada de mercadoria', '/estoque', '#16C60C', '#0A0A0B'],
    ['tag', 'Promoções', '/combos', '#1E90FF', '#0A0A0B'],
  ]

  const icBox = (c: string, bg: string): CSSProperties => ({ width: 40, height: 40, borderRadius: '3px 10px 2px 9px', background: bg, color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' })
  const hoje = new Date(new Date().toDateString())
  const alerts = [
    ...d.baixo.map((p) => ({ icon: 'alert' as const, st: icBox('#FF6B5E', 'rgba(255,107,94,.12)'), title: p.name, sub: `${p.stock} un · mínimo ${p.min}`, cta: 'Lançar entrada', to: '/estoque' })),
    ...d.lotes.map((l) => {
      const dias = Math.round((new Date(l.expires_on + 'T00:00:00').getTime() - hoje.getTime()) / 864e5)
      return { icon: 'cal' as const, st: icBox('#FBC009', 'rgba(251,192,9,.12)'), title: l.name,
        sub: `${Number(l.remaining_qty)} un ${dias < 0 ? `venceram há ${-dias} dias` : dias === 0 ? 'vencem hoje' : `vencem em ${dias} dias`}${l.code ? ` · lote ${l.code}` : ''}`, cta: 'Montar combo', to: '/combos' }
    }),
    ...d.contas.map((b) => {
      const dias = Math.round((hoje.getTime() - new Date(b.due_on + 'T00:00:00').getTime()) / 864e5)
      return { icon: 'wallet' as const, st: icBox('#FF6B5E', 'rgba(255,107,94,.12)'), title: b.description, sub: `Venceu há ${dias} ${dias === 1 ? 'dia' : 'dias'} · ${brlc(b.amount)}`, cta: 'Ver contas', to: '/compras' }
    }),
    ...novos.filter((o) => minutos(o.created_at) >= 5).map((o) => ({ icon: 'clock' as const, st: icBox('#FBC009', 'rgba(251,192,9,.12)'),
      title: `Pedido #${o.number} aguardando`, sub: `${CANAL[o.channel]?.nome ?? o.channel} · ${ha(o.created_at)}`, cta: 'Ver pedido', to: '/pedidos' })),
  ]

  const topMax = d.top[0]?.qty || 1
  const shelf: CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(180deg,transparent 0,transparent 164px,#2A2A2E 164px,#2A2A2E 166px,transparent 166px)',
    backgroundSize: '100% 176px',
  }

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-5 max-w-[1400px] mx-auto w-full">
      <div className="min-w-0">
        <div className="text-[clamp(28px,3.2vw,40px)] font-black tracking-[-0.02em] leading-[1.05] flex flex-wrap items-center gap-x-3.5 gap-y-1.5" style={{ fontStretch: '100%' }}>
          <span>{greet}</span>
          {primeiroNome && <span className="inline-block max-w-full [overflow-wrap:anywhere] bg-brand text-brand-ink pt-0.5 pb-1.5 px-3.5 rounded-[3px_12px_4px_10px] -rotate-[1.5deg]">{primeiroNome}</span>}
        </div>
        <div className="text-[15px] text-[#C4C4C9] mt-2 leading-[1.4]">{homeSub}</div>
      </div>

      <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {quick.map(([ic, label, to, bg, ink]) => (
          <button key={label} onClick={() => navigate(to)} className={qBase} style={{ background: bg, color: ink }}><Icon name={ic} size={22} />{label}</button>
        ))}
      </div>

      <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
        {kpis.map((k, i) => (
          <div key={k.label} className="p-[18px] bg-surface border border-line flex flex-col gap-2.5 min-w-0" style={{ borderRadius: irr(i) }}>
            <div className="flex items-center gap-2 text-sm text-[#C4C4C9] font-semibold"><span className="w-2 h-2 rounded-full flex-none" style={{ background: KC[i] }} />{k.label}</div>
            <div className="text-[clamp(24px,2.4vw,32px)] font-extrabold num tracking-[-0.01em] whitespace-nowrap" style={{ fontStretch: '100%' }}>{k.value}</div>
            <div className={k.noteCls}>{k.note}</div>
          </div>
        ))}
      </div>

      <div className={`${card} gap-3.5 pt-[18px] px-5 pb-5`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex-[1_1_220px] min-w-0">
            <div className="text-[17px] font-extrabold">Acesso rápido</div>
            <div className="text-sm text-[#C4C4C9] mt-1">{d.rapido.length} de 10 produtos · toque para lançar na venda do Balcão</div>
          </div>
          <button onClick={() => navigate('/caixa')} className="h-10 px-3.5 rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-sm font-extrabold cursor-pointer flex items-center gap-1.5">
            <Icon name="cart" size={18} />{d.caixa ? 'Ir para o caixa' : 'Abrir caixa'}
          </button>
        </div>
        <div className="grid grid-cols-3 tablet:grid-cols-[repeat(auto-fill,minmax(118px,1fr))] auto-rows-[152px] gap-x-2.5 gap-y-6 pt-2.5 px-1" style={shelf}>
          {d.rapido.map((p, i) => {
            const c = p.color ?? '#FBC009'
            return (
              <div key={p.key} onClick={() => navigate('/caixa')} className="relative self-end flex flex-col gap-1.5 p-2.5 bg-surface-2 border border-line-2 cursor-pointer select-none transition hover:-translate-y-[3px] hover:brightness-110 active:translate-y-0.5 active:scale-[.97]" style={{ borderRadius: irr(i) }}>
                <div className="h-[52px] rounded-[2px_9px_3px_8px] flex items-center justify-center"
                  style={p.image ? { background: `#F5F5F2 url("${p.image}") center/contain no-repeat`, border: `1px solid ${c}2E` } : { background: `radial-gradient(120% 85% at 50% 100%,${c}30,transparent 62%),#101012`, border: `1px solid ${c}2E` }}>
                  <Arte image={p.image} size={46} />
                </div>
                <div className="text-[13px] font-bold leading-[1.2] line-clamp-2 min-h-[31px]">{p.name}</div>
                <div className="text-[15px] font-extrabold num">{brlc(p.price)}</div>
              </div>
            )
          })}
          {d.rapido.length === 0 && <div className="col-span-full self-center text-sm text-[#C4C4C9]">Nenhum produto no acesso rápido ainda.</div>}
        </div>
      </div>

      <div className="grid gap-3 items-start grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))]">
        <div className={`${card} p-5 gap-3.5`}>
          <Cabecalho titulo="Mais vendidos hoje"><button onClick={() => navigate('/relatorios')} className={linkBtn}>Relatórios<Icon name="chev" size={18} /></button></Cabecalho>
          {d.top.map((t, i) => {
            const c = t.color ?? '#FBC009'
            return (
              <div key={t.name} className="flex items-center gap-3">
                <span className="w-4 text-[#ADADB4] font-extrabold text-sm flex-none">{i + 1}</span>
                <div className="w-12 h-12 flex-none overflow-hidden flex items-center justify-center" style={{ borderRadius: irr(i), color: c, border: `1px solid ${c}55`, background: `linear-gradient(160deg,${c}33,${c}0D)` }}>
                  <Arte image={null} size={38} />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2.5 text-sm"><span className="flex-1 min-w-0 font-semibold truncate">{t.name}</span><span className="font-extrabold num">{t.qty} un</span></div>
                  <div className="h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, Math.min(100, (t.qty / topMax) * 100))}%` }} /></div>
                </div>
              </div>
            )
          })}
          {d.top.length === 0 && <div className="text-sm text-[#C4C4C9]">Nenhuma venda hoje ainda.</div>}
        </div>

        <div className={`${card} p-5`}>
          <Cabecalho titulo="Precisa de atenção"><span className="text-sm text-[#C4C4C9]">{alerts.length} {alerts.length === 1 ? 'item' : 'itens'}</span></Cabecalho>
          {alerts.slice(0, 8).map((a, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-t border-line">
              <span style={a.st}><Icon name={a.icon} /></span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{a.title}</div><div className="text-sm text-[#C4C4C9] mt-[3px]">{a.sub}</div></div>
              <button onClick={() => navigate(a.to)} className="h-9 px-3 rounded-[2px_7px_3px_6px] border border-line-2 bg-surface-2 text-[13px] font-bold cursor-pointer flex-none whitespace-nowrap">{a.cta}</button>
            </div>
          ))}
          {alerts.length === 0 && <div className="py-3 border-t border-line text-sm text-[#C4C4C9]">Tudo em ordem por aqui.</div>}
        </div>

        <div className={`${card} p-5`}>
          <Cabecalho titulo={<><span className="w-2.5 h-2.5 rounded-full bg-[#FF1F1F] flex-none animate-pulse" />Pedidos ao vivo</>}>
            <button onClick={() => navigate('/pedidos')} className={linkBtn}>Ver todos<Icon name="chev" size={18} /></button>
          </Cabecalho>
          {d.pedidos.slice(0, 5).map((o) => {
            const [stL, stSt] = STATUS[o.status] ?? [o.status, pill('#ADADB4', '#232327')]
            return (
              <div key={o.id} onClick={() => navigate('/pedidos')} className="flex items-center gap-3 py-3 border-t border-line cursor-pointer">
                <Logo p={o} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold">{CANAL[o.channel]?.nome ?? o.channel}<span className="text-[#ADADB4] font-semibold">#{o.number}</span></div>
                  <div className="text-sm text-[#C4C4C9] mt-[3px] truncate">{o.customer_name ?? 'Cliente'}</div>
                </div>
                <span className="font-extrabold num">{brlc(o.total)}</span>
                <span className={pillCls} style={stSt}>{o.status === 'out_for_delivery' && o.courier ? `${stL} · ${o.courier.split(' ')[0]}` : stL}</span>
              </div>
            )
          })}
          {d.pedidos.length === 0 && <div className="py-3 border-t border-line text-sm text-[#C4C4C9]">Nenhum pedido em andamento.</div>}
        </div>
      </div>
    </div>
  )
}
