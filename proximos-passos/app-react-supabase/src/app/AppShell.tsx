import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { NAV, TABS, TITULO } from './routes'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { usePref } from '@/lib/prefs'
import { hora, irr } from '@/lib/visual'
import { Icon } from '@/components/icon'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { useMyStores } from '@/features/acesso/lojas'
import { AvisoAssinatura } from '@/features/assinatura/assinatura'
import { useChamados } from '@/features/suporte/suporte'
import { Avatar, PAPEL } from '@/features/perfil/perfil'
import { Calculadora } from './calculadora'
import { useAtencao, useCaixaAberto, usePerfil, usePermissoes, type Aviso } from './shell-dados'

const tilt = (i: number) => (i % 2 ? 'rotate(-.5deg)' : 'rotate(.4deg)')
const iniciais = (nome: string) => { const p = nome.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() }
const Selo = ({ n, cls }: { n: number; cls: string }) => (n ? <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-brand-ink text-xs font-extrabold flex items-center justify-center ${cls}`}>{n}</span> : null)

/** Itens do menu que a pessoa pode usar (o aparelho de caixa só vende). */
export function useMenu() {
  const { terminal } = useAuth()
  const { data: perm } = usePermissoes()
  const { data: atencao } = useAtencao()
  const nav = terminal ? NAV.filter((n) => n.path === '/caixa') : NAV.filter((n) => !perm || perm.pode(n.perm))
  return { nav, selos: atencao?.selos ?? {} }
}

/** desktop ≥1180: menu lateral · tablet 720–1179: trilho · celular <720: abas embaixo (como no protótipo). */
export function AppShell({ children }: { children: ReactNode }) {
  const groups = ['Operação', 'Gestão', 'Análise', 'Ferramentas', 'Configurar'] as const
  const { storeId, signOut, terminal } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { nav, selos } = useMenu()
  const { data: stores } = useMyStores()
  const { data: perfil } = usePerfil()
  const { data: perm } = usePermissoes()
  const [calc] = usePref('calculadora', true)
  const [modal, setModal] = useState<null | 'loja' | 'alertas'>(null)
  const loja = stores?.find((s) => s.store_id === storeId)
  const nLojas = stores && stores.length > 1 ? ` · ${stores.length} lojas` : ''
  const cargo = PAPEL[perm?.role ?? loja?.role ?? ''] ?? ''
  const titulo = TITULO[pathname] ?? ''
  const noRail = nav.some((n) => n.rail && n.path === pathname)
  const nasAbas = TABS.some((t) => t.path === pathname)

  return (
    <div className="flex h-dvh bg-bg text-ink">
      <aside className="hidden desktop:flex w-[236px] flex-none flex-col gap-[clamp(4px,1vh,10px)] pt-[clamp(10px,2.2vh,22px)] px-4 pb-[clamp(8px,1.6vh,16px)] border-r border-line overflow-hidden"
        style={{ backgroundColor: '#060607', backgroundImage: 'linear-gradient(90deg,#1A1714 0,#0E0C0B 7px,rgba(0,0,0,.6) 9px,transparent 18px,transparent calc(100% - 18px),rgba(0,0,0,.6) calc(100% - 9px),#0E0C0B calc(100% - 7px),#1A1714 100%)' }}>
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-[clamp(4px,1.1vh,14px)] -mx-1.5 px-1.5">
          <button onClick={() => navigate('/')} title="Ir para o início" className="self-start ml-2.5 mb-1 cursor-pointer active:scale-[.96]"><img src="/icons/addegas-logo-dark.png" alt="Addegas" className="h-7 w-auto block" /></button>
          {groups.filter((g) => nav.some((n) => n.group === g)).map((g) => (
            <nav key={g} className="flex flex-col pt-[clamp(0px,.5vh,4px)]" style={{ background: 'linear-gradient(rgba(251,192,9,.035),transparent 40%)' }}>
              <span className="px-3 pb-[clamp(1px,.4vh,3px)] text-[clamp(10.5px,1.4vh,12px)] font-extrabold uppercase tracking-[.08em] text-brand">{g}</span>
              {nav.filter((n) => n.group === g).map((n, k) => (
                <NavLink key={n.path} to={n.path} end className={({ isActive }) => `flex items-center gap-3 h-[clamp(26px,3.6vh,32px)] px-3 w-full text-[clamp(13px,1.9vh,14.5px)] font-semibold hover:bg-surface-2 ${isActive ? 'bg-surface-2 text-brand' : 'text-[#C9C9CC]'}`}
                  style={({ isActive }) => ({ borderRadius: irr(k + g.length), transform: isActive ? tilt(k + g.length) : undefined })}>
                  <Icon name={n.icon} /><span className="flex-1">{n.label}</span><Selo n={selos[n.path] ?? 0} cls="" />
                </NavLink>
              ))}
              <div className="relative h-[3px] mt-1.5 -mx-2.5 rounded-[1px] shadow-[0_4px_6px_-3px_rgba(0,0,0,.6)]" style={{ background: 'linear-gradient(#2A231C,#17130F)' }}>
                <span className="absolute left-[12%] right-[12%] -top-px h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(251,192,9,.18),transparent)' }} />
              </div>
            </nav>
          ))}
        </div>
        {calc && !terminal && <Calculadora />}
        <div className="sticky bottom-0 flex-none flex items-center gap-2.5 p-2.5 rounded-[3px_10px_2px_9px] bg-surface border border-line shadow-[0_-12px_16px_-6px_#060607]">
          {terminal ? (
            <div className="flex-1 min-w-0"><span className="block text-sm font-bold truncate">{terminal.name}</span><span className="block text-[13px] text-[#C4C4C9] mt-0.5">Aparelho de caixa</span></div>
          ) : (
            <button onClick={() => navigate('/perfil')} title="Meu perfil" className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer hover:opacity-85">
              <Avatar src={perfil?.avatar} size={36} />
              <span className="flex-1 min-w-0"><span className="block text-sm font-bold truncate">{perfil?.nome || loja?.name || '…'}</span><span className="block text-[13px] text-[#C4C4C9] mt-0.5">{cargo}{nLojas}</span></span>
            </button>
          )}
          <button onClick={signOut} title={terminal ? 'Desconectar este caixa' : 'Sair'} className="w-9 h-9 flex-none flex items-center justify-center rounded-[2px_7px_3px_6px] bg-[#E5241B] hover:bg-[#FF3B30] active:bg-[#B81C15] active:scale-90 transition text-white cursor-pointer"><Icon name="logout" /></button>
        </div>
      </aside>

      <aside className="hidden tablet:flex desktop:hidden w-[84px] flex-none flex-col items-center gap-[clamp(0px,.5vh,4px)] bg-bg-nav border-r border-line py-[clamp(8px,2vh,18px)] overflow-y-auto no-scrollbar">
        <button onClick={() => navigate('/')} title="Ir para o início" className="mb-3 cursor-pointer active:scale-[.94]"><img src="/icons/dd-amarelo.png" alt="Addegas" className="w-10 block" /></button>
        {[...nav.filter((n) => n.rail).map((n) => ({ path: n.path, label: n.label.split(' ')[0], icon: n.icon })), { path: '/mais', label: 'Mais', icon: 'grid' as const }].map((n, k) => {
          const ativo = n.path === '/mais' ? !noRail : pathname === n.path
          return (
            <NavLink key={n.path} to={n.path} end className={`relative flex flex-col items-center gap-[5px] w-[66px] py-2.5 text-xs font-bold ${ativo ? 'bg-surface-2 text-brand' : 'text-ink-2'}`}
              style={{ borderRadius: irr(k), transform: ativo ? tilt(k) : undefined }}>
              <Icon name={n.icon} size={22} /><span>{n.label}</span><Selo n={selos[n.path] ?? 0} cls="absolute top-1 right-2 !min-w-[18px] !h-[18px] !text-[11px] !px-[5px]" />
            </NavLink>
          )
        })}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col relative">
        {!terminal && <Cabecalho titulo={titulo} onLoja={() => setModal('loja')} onAlertas={() => setModal('alertas')} />}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {!terminal && <AvisoAssinatura />}
          {!terminal && titulo && pathname !== '/' && pathname !== '/caixa' && <div className="tablet:hidden px-4 pt-4 -mb-2 text-[30px] font-black tracking-[-0.02em]" style={{ fontStretch: '100%' }}>{titulo}</div>}
          {children}
        </main>
        <nav className="tablet:hidden flex bg-bg border-t border-[#1F1F22] px-1.5 pt-1 safe-bottom">
          {[...(terminal ? TABS.filter((t) => t.path === '/caixa') : TABS.filter((t) => nav.some((n) => n.path === t.path))), { path: '/mais', label: 'Mais', icon: 'grid' as const }].map((t, k) => {
            const ativo = t.path === '/mais' ? !nasAbas : pathname === t.path
            return (
              <NavLink key={t.path} to={t.path} end className={`relative flex-1 flex flex-col items-center justify-center gap-1 h-[54px] mx-[3px] my-0.5 text-xs font-bold ${ativo ? 'bg-surface-2 text-brand' : 'text-[#ADADB4]'}`}
                style={{ borderRadius: irr(k), transform: ativo ? tilt(k) : undefined }}>
                <Icon name={t.icon} size={24} /><span>{t.label}</span>
                <Selo n={selos[t.path] ?? 0} cls="absolute top-[5px] left-[calc(50%+6px)] !min-w-[18px] !h-[18px] !text-[11px] !px-[5px]" />
              </NavLink>
            )
          })}
        </nav>
      </div>
      {modal === 'loja' && <TrocarLoja onClose={() => setModal(null)} />}
      {modal === 'alertas' && <Alertas onClose={() => setModal(null)} />}
    </div>
  )
}

/** Barra de cima: loja, título, caixa, ticket, alertas e perfil (header do protótipo). */
function Cabecalho({ titulo, onLoja, onAlertas }: { titulo: string; onLoja: () => void; onAlertas: () => void }) {
  const { storeId } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data: stores } = useMyStores()
  const { data: perfil } = usePerfil()
  const { data: caixa } = useCaixaAberto()
  const { data: atencao } = useAtencao()
  const { data: chamados } = useChamados()
  const loja = stores?.find((s) => s.store_id === storeId)
  const nAlertas = atencao?.itens.length ?? 0
  const nChamados = chamados?.filter((c) => c.status !== 'resolvido' && c.status !== 'fechado').length ?? 0
  const op = caixa?.por.split(' ')[0] ?? ''
  const pilula = (m: 'cel' | 'tab' | 'pc') => caixa
    ? m === 'cel' ? 'Aberto' : m === 'tab' ? `Aberto · ${op} ${hora(caixa.desde)}` : `Caixa aberto por ${op} desde ${hora(caixa.desde)}`
    : m === 'cel' ? 'Fechado' : 'Caixa fechado'
  const ponto = <span className="w-2 h-2 rounded-full flex-none" style={{ background: caixa ? '#4ADE80' : '#FF6B5E', boxShadow: `0 0 0 4px ${caixa ? 'rgba(74,222,128,.15)' : 'rgba(255,107,94,.15)'}` }} />
  const sino = (
    <button onClick={onAlertas} title="Alertas" className="relative w-11 h-11 flex-none rounded-[3px_10px_2px_9px] border border-line-2 flex items-center justify-center cursor-pointer">
      <Icon name="bell" />{nAlertas > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-[5px] rounded-full bg-[#FF1F1F] text-white text-[11px] font-extrabold flex items-center justify-center shadow-[0_0_0_2px_#000]">{nAlertas}</span>}
    </button>
  )
  const brilho = {
    backgroundColor: '#020203',
    backgroundImage: 'linear-gradient(180deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,.035) 38%,rgba(255,255,255,0) 50%,rgba(0,0,0,0) 100%),linear-gradient(105deg,rgba(255,255,255,0) 18%,rgba(255,255,255,.06) 30%,rgba(255,255,255,0) 42%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(255,255,255,.04),0 6px 16px rgba(0,0,0,.7)',
  }
  const pill = 'flex items-center gap-2 rounded-full border border-line-2 font-bold whitespace-nowrap flex-none cursor-pointer'
  return (
    <>
      <header className="hidden tablet:flex h-[68px] flex-none items-center gap-3.5 px-6 border-b border-black relative z-[2]" style={brilho}>
        <button onClick={onLoja} className="flex items-center gap-2.5 h-[46px] pl-[7px] pr-3 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line min-w-0 shrink text-left cursor-pointer">
          <span className="w-8 h-8 flex-none rounded-[2px_6px_2px_5px] bg-brand text-brand-ink font-black text-[13px] flex items-center justify-center">{loja ? iniciais(loja.name) : ''}</span>
          <span className="min-w-0"><span className="block text-sm font-bold leading-[1.1] truncate">{loja?.name ?? '…'}</span><span className="block text-[13px] text-[#C4C4C9] mt-[3px] truncate">{loja?.neighborhood ?? loja?.slug ?? ''}{stores && stores.length > 1 ? ` · ${stores.length} lojas` : ''}</span></span>
          <span className="text-[#C4C4C9] flex-none"><Icon name="chevDown" /></span>
        </button>
        <div className="flex-1 min-w-0 text-xl font-extrabold truncate" style={{ fontStretch: '100%' }}>{titulo}</div>
        <button onClick={() => navigate('/caixa')} className={`${pill} h-[42px] px-3.5 text-sm`}>{ponto}<span className="desktop:hidden">{pilula('tab')}</span><span className="hidden desktop:inline">{pilula('pc')}</span></button>
        <button onClick={() => navigate('/suporte')} title="Registrar ticket" className="flex items-center gap-2 h-[42px] px-3.5 flex-none rounded-[3px_11px_4px_10px] bg-brand text-brand-ink text-sm font-extrabold whitespace-nowrap cursor-pointer hover:brightness-110 active:scale-[.97]">
          <Icon name="help" size={20} /><span className="hidden desktop:inline">Registrar ticket</span>
          {nChamados > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-bg text-brand text-[11.5px] font-extrabold flex items-center justify-center">{nChamados}</span>}
        </button>
        {sino}
        {pathname !== '/perfil' && <button onClick={() => navigate('/perfil')} title="Meu perfil" className="flex-none cursor-pointer active:scale-[.94]"><Avatar src={perfil?.avatar} size={44} /></button>}
      </header>
      <header className="tablet:hidden flex flex-none items-center gap-2.5 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+10px)] border-b border-black relative z-[2]" style={brilho}>
        <button onClick={() => navigate('/')} title="Ir para o início" className="flex-none cursor-pointer active:scale-[.94]"><img src="/icons/addegas-icon.png" alt="Addegas" className="w-[38px] h-[38px] rounded-[3px_9px_2px_8px] block" /></button>
        <button onClick={onLoja} className="flex-1 min-w-0 flex items-center text-left cursor-pointer">
          <span className="min-w-0"><span className="flex items-center gap-1 text-base font-extrabold whitespace-nowrap"><span className="truncate">{loja?.name ?? '…'}</span><span className="text-[#C4C4C9] flex-none"><Icon name="chevDown" /></span></span><span className="block text-[13px] text-[#C4C4C9] mt-0.5 truncate">{loja?.neighborhood ?? loja?.slug ?? ''}</span></span>
        </button>
        <button onClick={() => navigate('/caixa')} className={`${pill} h-9 px-3 text-[13px]`}>{ponto}{pilula('cel')}</button>
        {sino}
        <button onClick={() => navigate('/perfil')} title="Meu perfil" className="flex-none cursor-pointer active:scale-[.94]"><Avatar src={perfil?.avatar} size={40} /></button>
      </header>
    </>
  )
}

function TrocarLoja({ onClose }: { onClose: () => void }) {
  const { storeId, setStoreId } = useAuth()
  const { data: stores } = useMyStores()
  const { data: perm } = usePermissoes()
  const navigate = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const visiveis = (stores ?? []).filter((s) => !q.trim() || `${s.name} ${s.neighborhood ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Sheet title="Trocar de loja" onClose={onClose}>
      {(stores?.length ?? 0) > 4 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar loja" aria-label="Buscar loja"
        className="h-12 px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-[15px] outline-none focus:border-brand" />}
      {!!stores?.length && <div className="text-[13px] font-bold text-[#C4C4C9] -mt-1">{visiveis.length === stores.length ? `${stores.length} ${stores.length === 1 ? 'loja' : 'lojas'}` : `Mostrando ${visiveis.length} de ${stores.length} lojas`}</div>}
      {visiveis.map((s) => {
        const atual = s.store_id === storeId
        return (
          <button key={s.store_id} onClick={() => { if (!atual) { setStoreId(s.store_id, s.slug); toast(`Agora em ${s.name}`); navigate('/') } onClose() }}
            className={`flex items-center gap-3.5 p-3.5 w-full text-left rounded-[3px_11px_4px_10px] border cursor-pointer ${atual ? 'border-brand bg-[rgba(251,192,9,.08)]' : 'border-line-2 bg-surface-2'}`}>
            <span className="w-10 h-10 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink font-black text-sm flex items-center justify-center flex-none">{iniciais(s.name)}</span>
            <span className="flex-1 min-w-0"><span className="block text-[15px] font-bold">{s.name}</span><span className="block text-sm text-[#C4C4C9] mt-[3px]">{s.neighborhood ?? s.slug} · {PAPEL[s.role]}</span></span>
            {atual && <span className="text-brand"><Icon name="check" /></span>}
          </button>
        )
      })}
      {perm?.role === 'owner' && (
        <button onClick={() => { onClose(); navigate('/cadastro?nova=1') }} className="h-[52px] rounded-[3px_11px_4px_10px] border border-dashed border-[#3A3A40] text-[#C4C4C9] text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer"><Icon name="plus" />Cadastrar nova loja</button>
      )}
    </Sheet>
  )
}

/** Sino do cabeçalho: a mesma lista do "Precisa de atenção"; alertas do servidor somem com "Ok". */
function Alertas({ onClose }: { onClose: () => void }) {
  const { storeId } = useAuth()
  const { data } = useAtencao()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const agir = async (a: Aviso) => {
    if (a.alertId) {
      try { await rpc('mark_alerts_read', { p_store_id: storeId, p_alert_ids: [a.alertId] }); await qc.invalidateQueries({ queryKey: ['atencao'] }) } catch (e) { toast((e as Error).message) }
      return
    }
    onClose()
    if (a.to) navigate(a.to)
  }
  const lidos = async () => {
    try { await rpc('mark_alerts_read', { p_store_id: storeId }); await qc.invalidateQueries({ queryKey: ['atencao'] }); toast('Alertas marcados como lidos') } catch (e) { toast((e as Error).message) }
  }
  const temServidor = data?.itens.some((a) => a.alertId)
  return (
    <Sheet title="Alertas" onClose={onClose} footer={temServidor ? <button onClick={lidos} className="w-full h-12 rounded-[3px_11px_4px_10px] border border-line-2 bg-surface-2 text-[15px] font-bold cursor-pointer">Marcar alertas como lidos</button> : undefined}>
      {!!data?.itens.length && <div className="text-[13px] font-bold text-[#C4C4C9] -mt-2">{data.itens.length} {data.itens.length === 1 ? 'alerta' : 'alertas'}</div>}
      <div className="-mt-3">
        {data?.itens.map((a) => <LinhaAviso key={a.key} a={a} onAgir={() => agir(a)} />)}
        {data && !data.itens.length && <div className="py-3 text-sm text-[#C4C4C9]">Tudo em ordem por aqui.</div>}
      </div>
    </Sheet>
  )
}

export function LinhaAviso({ a, onAgir, borda = 'b' }: { a: Aviso; onAgir: () => void; borda?: 't' | 'b' }) {
  const [c, bg] = a.cor === 'bad' ? ['#FF6B5E', 'rgba(255,107,94,.12)'] : ['#FBC009', 'rgba(251,192,9,.12)']
  return (
    <div className={`flex items-center gap-3 py-3 border-line ${borda === 't' ? 'border-t' : 'border-b'}`}>
      <span className="w-10 h-10 flex-none rounded-[3px_10px_2px_9px] flex items-center justify-center" style={{ color: c, background: bg }}><Icon name={a.icon} /></span>
      <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{a.title}</div><div className="text-sm text-[#C4C4C9] mt-[3px]">{a.sub}</div></div>
      <button onClick={onAgir} className="h-9 px-3 rounded-[2px_7px_3px_6px] border border-line-2 bg-surface-2 text-[13px] font-bold cursor-pointer flex-none whitespace-nowrap">{a.cta}</button>
    </div>
  )
}
