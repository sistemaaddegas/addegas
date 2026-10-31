import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { funcao, rpc, supabase } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { BarraLista, SemResultado, norm } from '@/components/filtros'
import { card, chip, chipCls, pill, pillCls } from '@/lib/visual'

type Papel = 'owner' | 'manager' | 'cashier' | 'stock_keeper' | 'courier'
type Membro = { id: string; display_name: string; role: Papel; active: boolean; user_id: string | null }

const PAPEL: Record<Papel, [string, string, string]> = {
  owner: ['Dono', '#0A0A0B', '#FBC009'],
  manager: ['Gerente', '#7CB3FF', 'rgba(124,179,255,.12)'],
  cashier: ['Caixa', '#4ADE80', 'rgba(74,222,128,.12)'],
  stock_keeper: ['Estoquista', '#FF8A5B', 'rgba(255,138,91,.12)'],
  courier: ['Entregador', '#C4C4C9', '#232327'],
}
const EDITAVEIS: Papel[] = ['manager', 'cashier', 'stock_keeper', 'courier']
const campo = 'h-[52px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base w-full outline-none focus:border-brand'
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

function rows<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={on} className="w-[46px] h-[26px] rounded-full flex-none relative cursor-pointer disabled:cursor-default disabled:opacity-50" style={{ background: on ? '#FBC009' : '#2A2A2E' }}>
      <span className="absolute top-[3px] w-5 h-5 rounded-full transition-all" style={{ left: on ? 23 : 3, background: on ? '#0A0A0B' : '#ADADB4' }} />
    </button>
  )
}
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-2 min-w-0"><span className="text-sm font-bold text-[#C4C4C9]">{label}</span>{children}</label>
}

export function Equipe() {
  const { storeId } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [sheet, setSheet] = useState<Membro | 'novo' | null>(null)
  const [q, setQ] = useState('')
  const [fSit, setFSit] = useState('ativos')
  const [fPapel, setFPapel] = useState('todos')
  const [fAcesso, setFAcesso] = useState('todos')

  const { data, error, isLoading } = useQuery({
    queryKey: ['equipe', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [membros, perms, matriz, limites, eu, loja] = await Promise.all([
        supabase.from('store_members').select('id, display_name, role, active, user_id').eq('store_id', storeId!).order('display_name'),
        supabase.from('permissions').select('code, name, sort').order('sort'),
        supabase.from('role_permissions').select('role, permission_code, allowed').eq('store_id', storeId!),
        supabase.from('role_settings').select('role, max_discount_pct').eq('store_id', storeId!),
        rpc<{ role: Papel; permissions: string[] }>('my_permissions', { p_store_id: storeId }),
        supabase.from('stores').select('slug').eq('id', storeId!).single(),
      ])
      return {
        membros: rows(membros) as Membro[],
        perms: rows(perms),
        matriz: new Set(rows(matriz).filter((x) => x.allowed).map((x) => `${x.role}:${x.permission_code}`)),
        limites: new Map(rows(limites).map((x) => [x.role as string, x.max_discount_pct])),
        eu,
        slug: (loja.data?.slug as string | undefined) ?? 'sua-loja',
      }
    },
  })
  const recarregar = () => Promise.all(['equipe', 'caixa'].map((k) => qc.invalidateQueries({ queryKey: [k] })))

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar a equipe. {error?.message}</div>

  const dono = data.eu.role === 'owner'
  const gere = dono || data.eu.permissions.includes('equipe')
  const qn = norm(q.trim())
  const lista = data.membros.filter((m) => (!qn || norm(m.display_name).includes(qn)) && (fSit === 'todos' || (fSit === 'ativos') === m.active)
      && (fPapel === 'todos' || m.role === fPapel) && (fAcesso === 'todos' || (fAcesso === 'login') === !!m.user_id))
    .sort((a, b) => Number(b.active) - Number(a.active) || EDITAVEIS.indexOf(a.role) - EDITAVEIS.indexOf(b.role))
  const limpar = () => { setQ(''); setFSit('ativos'); setFPapel('todos'); setFAcesso('todos') }

  const permitir = async (role: Papel, code: string, on: boolean) => {
    try {
      await rpc('set_role_permission', { p_store_id: storeId, p_role: role, p_permission: code, p_allowed: on })
      await recarregar()
    } catch (e) { toast((e as Error).message) }
  }
  const limite = async (role: Papel, v: string) => {
    const n = Number(v.replace(',', '.'))
    if (Number.isNaN(n) || n < 0 || n > 100) return toast('Use um número de 0 a 100')
    try {
      await rpc('set_role_discount_limit', { p_store_id: storeId, p_role: role, p_max_pct: n })
      toast(`Desconto máximo de ${PAPEL[role][0].toLowerCase()}: ${n}%`)
      await recarregar()
    } catch (e) { toast((e as Error).message) }
  }

  return (
    <div className="p-4 tablet:p-8 grid gap-3 items-start max-w-[1400px] mx-auto w-full grid-cols-[repeat(auto-fit,minmax(min(100%,400px),1fr))]">
      <div className={`${card} p-5`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[17px] font-extrabold">Pessoas</div>
          {gere && <button onClick={() => setSheet('novo')} className="h-10 px-3.5 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-sm font-extrabold flex items-center gap-1.5 cursor-pointer"><Icon name="plus" size={18} />Convidar</button>}
        </div>
        <div className="mb-2">
          <BarraLista busca={q} onBusca={setQ} placeholder="Buscar pessoa" mostrando={lista.length} total={data.membros.length} unidade={['pessoa', 'pessoas']} onLimpar={limpar}
            filtros={[
              { label: 'Situação', value: fSit, onChange: setFSit, todos: 'ativos', options: [['ativos', 'Ativas'], ['inativos', 'Desativadas'], ['todos', 'Todas']] },
              { label: 'Função', value: fPapel, onChange: setFPapel, options: [['todos', 'Todas'], ...(Object.keys(PAPEL) as Papel[]).map((k) => [k, PAPEL[k][0]] as [string, string])] },
              { label: 'Acesso', value: fAcesso, onChange: setFAcesso, options: [['todos', 'Todos'], ['login', 'Com login'], ['caixa', 'Só no caixa']] },
            ]} />
        </div>
        {lista.map((p) => {
          const [l, c, bg] = PAPEL[p.role]
          return (
            <div key={p.id} onClick={() => gere && p.role !== 'owner' && setSheet(p)} className={`flex items-center gap-3 py-3 border-t border-line ${gere && p.role !== 'owner' ? 'cursor-pointer' : ''}`} style={{ opacity: p.active ? 1 : 0.5 }}>
              <span className="w-[42px] h-[42px] rounded-full bg-line-2 text-sm font-extrabold flex items-center justify-center flex-none">{iniciais(p.display_name)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold">{p.display_name}</div>
                <div className="text-sm text-[#C4C4C9] mt-[3px]">{!p.active ? 'Desativado' : p.user_id ? 'Entra com login' : 'Só no caixa'}</div>
              </div>
              <span className={pillCls} style={pill(c, bg)}>{l}</span>
            </div>
          )
        })}
        {lista.length === 0 && <SemResultado filtrado vazio="" onLimpar={limpar} />}
      </div>

      <div className={`${card} p-5`}>
        <div className="text-[17px] font-extrabold">Permissões por função</div>
        <div className="text-sm text-[#C4C4C9] mt-1.5 mb-2.5">O dono tem acesso a tudo. No caixa, cada pessoa toca no próprio nome e as vendas ficam registradas nele.{!dono && ' Só o dono muda esta tabela.'}</div>
        <div className="flex items-center gap-3 py-2 text-[13px] font-extrabold text-[#C4C4C9] uppercase tracking-[.05em]">
          <span className="flex-1">Permissão</span><span className="w-16 text-center">Gerente</span><span className="w-16 text-center">Caixa</span>
        </div>
        {data.perms.map((r) => (
          <div key={r.code} className="flex items-center gap-3 py-2.5 border-t border-line">
            <span className="flex-1 text-sm font-semibold">{r.name}</span>
            {(['manager', 'cashier'] as const).map((role) => {
              const on = data.matriz.has(`${role}:${r.code}`)
              return <span key={role} className="w-16 flex justify-center"><Toggle on={on} disabled={!dono} onClick={() => permitir(role, r.code, !on)} /></span>
            })}
          </div>
        ))}
        <div className="flex items-center gap-3 pt-3 mt-1 border-t border-line">
          <span className="flex-1 text-sm font-semibold">Desconto máximo sem senha do gerente (%)</span>
          {(['manager', 'cashier'] as const).map((role) => (
            <span key={role} className="w-16 flex justify-center">
              <input key={String(data.limites.get(role))} defaultValue={data.limites.get(role) ?? ''} disabled={!dono} inputMode="decimal"
                onBlur={(e) => { if (e.target.value !== String(data.limites.get(role) ?? '')) void limite(role, e.target.value) }}
                className="w-14 h-9 px-2 rounded-[2px_7px_3px_6px] bg-surface-2 border border-line-2 text-sm font-bold text-center outline-none focus:border-brand disabled:opacity-50" />
            </span>
          ))}
        </div>
      </div>

      {sheet === 'novo' && <Novo storeId={storeId!} slug={data.slug} dono={dono} onClose={() => setSheet(null)} onDone={recarregar} />}
      {sheet && sheet !== 'novo' && <Pessoa m={sheet} dono={dono} onClose={() => setSheet(null)} onDone={recarregar} />}
    </div>
  )
}

function PapelChips({ value, onChange, dono }: { value: Papel; onChange: (p: Papel) => void; dono: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {EDITAVEIS.filter((p) => dono || p !== 'manager').map((p, k) => <button key={p} onClick={() => onChange(p)} className={chipCls} style={chip(value === p, k)}>{PAPEL[p][0]}</button>)}
    </div>
  )
}

function Novo({ storeId, slug, dono, onClose, onDone }: { storeId: string; slug: string; dono: boolean; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast()
  const [f, setF] = useState({ nome: '', papel: 'cashier' as Papel, acesso: 'caixa' as 'caixa' | 'email' | 'usuario', email: '', usuario: '' })
  const [busy, setBusy] = useState(false)
  const [criado, setCriado] = useState<{ login: string; password: string | null } | null>(null)

  const salvar = async () => {
    if (!f.nome.trim()) return toast('Informe o nome da pessoa')
    setBusy(true)
    try {
      if (f.acesso === 'caixa') {
        await rpc('create_counter_member', { p_store_id: storeId, p_display_name: f.nome.trim(), p_role: f.papel })
        toast(`${f.nome.trim()} já aparece no caixa`)
        await onDone()
        onClose()
      } else {
        const r = await funcao<{ login: string; password: string | null }>('members/create', {
          store_id: storeId, name: f.nome.trim(), role: f.papel, ...(f.acesso === 'email' ? { email: f.email.trim() } : { username: f.usuario.trim() }),
        })
        await onDone()
        if (r.password) setCriado(r)
        else { toast(`Acesso enviado para ${r.login}`); onClose() }
      }
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (criado) {
    return (
      <Sheet title="Acesso criado" onClose={onClose} footer={<button onClick={onClose} className={bigBtn}>Pronto, anotei</button>}>
        <div className="text-sm text-[#C4C4C9]">Passe estes dados para {f.nome.trim()}. A senha aparece só agora e a pessoa troca no primeiro acesso.</div>
        <div className="p-4 rounded-[3px_11px_4px_10px] bg-surface-2 flex flex-col gap-2 text-[15px]">
          <div>Usuário: <b className="select-all">{criado.login}</b></div>
          <div>Senha provisória: <b className="select-all num">{criado.password}</b></div>
        </div>
        <div className="text-[13px] text-[#ADADB4]">Em outro aparelho, o usuário é “{criado.login}@{slug}”. Num aparelho que já entrou nesta loja, basta “{criado.login}”.</div>
      </Sheet>
    )
  }

  return (
    <Sheet title="Adicionar pessoa" onClose={onClose} footer={<button onClick={salvar} disabled={busy} className={bigBtn}>{busy ? 'Salvando…' : 'Adicionar'}</button>}>
      <Campo label="Nome"><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Bia Santos" className={campo} autoFocus /></Campo>
      <div className="flex flex-col gap-2"><span className="text-sm font-bold text-[#C4C4C9]">Função</span><PapelChips value={f.papel} onChange={(papel) => setF({ ...f, papel })} dono={dono} /></div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Como entra</span>
        <div className="flex flex-wrap gap-2">
          {([['caixa', 'Só no caixa'], ['usuario', 'Usuário e senha'], ['email', 'E-mail']] as const).map(([id, l], k) => (
            <button key={id} onClick={() => setF({ ...f, acesso: id })} className={chipCls} style={chip(f.acesso === id, k)}>{l}</button>
          ))}
        </div>
        <div className="text-[13px] text-[#ADADB4]">
          {f.acesso === 'caixa' ? 'Para quem só vende no balcão: aparece na lista do caixa e não acessa o sistema fora dele.'
            : f.acesso === 'usuario' ? 'Para quem não tem e-mail: você recebe a senha provisória agora.' : 'A pessoa recebe o acesso no e-mail.'}
        </div>
      </div>
      {f.acesso === 'usuario' && <Campo label="Usuário"><input value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} autoCapitalize="none" placeholder="Ex.: bia" className={campo} /></Campo>}
      {f.acesso === 'email' && <Campo label="E-mail"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" autoCapitalize="none" className={campo} /></Campo>}
    </Sheet>
  )
}

function Pessoa({ m, dono, onClose, onDone }: { m: Membro; dono: boolean; onClose: () => void; onDone: () => Promise<unknown> }) {
  const toast = useToast()
  const [papel, setPapel] = useState<Papel>(m.role)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<string>, fechar = true) => {
    setBusy(true)
    try { toast(await fn()); await onDone(); if (fechar) onClose() } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }
  const salvarPapel = () => run(async () => { await rpc('update_member', { p_member_id: m.id, p_role: papel }); return `${m.display_name} agora é ${PAPEL[papel][0].toLowerCase()}` })
  const ativar = () => run(async () => {
    if (!m.active) { await rpc('update_member', { p_member_id: m.id, p_active: true }); return `${m.display_name} reativado` }
    // Quem tem login sai de todos os aparelhos na hora (Edge Function); quem é só do caixa, só no banco.
    if (m.user_id) await funcao('members/deactivate', { member_id: m.id })
    else await rpc('update_member', { p_member_id: m.id, p_active: false })
    return `${m.display_name} desativado`
  })
  const novaSenha = () => run(async () => {
    const r = await funcao<{ password: string }>('members/reset-password', { member_id: m.id })
    return `Nova senha provisória: ${r.password}`
  }, false)

  return (
    <Sheet title={m.display_name} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold text-[#C4C4C9]">Função</span>
        <PapelChips value={papel} onChange={setPapel} dono={dono} />
        {papel !== m.role && <button onClick={salvarPapel} disabled={busy} className={bigBtn}>Salvar função</button>}
      </div>
      {m.user_id && (
        <button onClick={novaSenha} disabled={busy} className="h-12 rounded-[3px_10px_2px_9px] border border-line-2 bg-transparent text-[15px] font-bold cursor-pointer">Gerar nova senha provisória</button>
      )}
      <button onClick={ativar} disabled={busy} className="h-12 rounded-[3px_10px_2px_9px] text-[15px] font-extrabold cursor-pointer"
        style={m.active ? { background: '#E5241B', color: '#FFFFFF' } : { background: '#4ADE80', color: '#0A0A0B' }}>
        {m.active ? 'Desativar acesso' : 'Reativar'}
      </button>
      {m.active && <div className="text-[13px] text-[#ADADB4] -mt-2">Desativar tira o acesso na hora, em todos os aparelhos. O histórico de vendas continua.</div>}
    </Sheet>
  )
}
