import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { Sheet, bigBtn } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { useMyStores } from '@/features/acesso/lojas'
import { usePerfil, usePermissoes } from '@/app/shell-dados'

export const PAPEL: Record<string, string> = { owner: 'Dono', manager: 'Gerente', cashier: 'Caixa', stock_keeper: 'Estoquista', courier: 'Entregador' }
const digitos = (t: string) => t.replace(/\D/g, '')
export const fone = (t: string) => { const d = digitos(t); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t }
const campo = 'w-full h-12 px-3.5 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-[15px] outline-none focus:border-brand'

/** Foto redonda do perfil; sem foto, o "dd" amarelo (como no protótipo). */
export function Avatar({ src, size }: { src: string | null | undefined; size: number }) {
  return (
    <span className="flex-none rounded-full overflow-hidden flex items-center justify-center box-border"
      style={{ width: size, height: size, background: src ? '#1C1C1F' : '#0A0A0B', border: `${size > 100 ? 3 : 2}px solid ${src ? '#2A2A2E' : '#FBC009'}` }}>
      {src ? <span className="block w-full h-full bg-cover bg-center" style={{ backgroundImage: `url("${src}")` }} />
        : <img src="/icons/dd-amarelo.png" alt="" className="block w-[72%] h-auto" style={size > 100 ? { transform: 'rotate(-6deg)' } : undefined} />}
    </span>
  )
}

/** Recorta o centro da imagem em 320×320 e devolve JPEG em data URL (cabe na linha do perfil). */
function recortar(f: File) {
  return new Promise<string>((ok, erro) => {
    const img = new Image()
    img.onload = () => {
      const S = 320, c = document.createElement('canvas'), k = Math.min(img.width, img.height)
      c.width = c.height = S
      c.getContext('2d')!.drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, S, S)
      URL.revokeObjectURL(img.src)
      ok(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => erro(new Error('Não deu para ler essa imagem.'))
    img.src = URL.createObjectURL(f)
  })
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5"><span className="text-[13px] font-bold text-[#C4C4C9]">{label}</span>{children}</label>
}

export function Perfil() {
  const { session, storeId, signOut } = useAuth()
  const { data: p } = usePerfil()
  const { data: perm } = usePermissoes()
  const { data: lojas } = useMyStores()
  const qc = useQueryClient()
  const toast = useToast()
  const [ed, setEd] = useState<{ nome: string; tel: string; email: string } | null>(null)
  const [pin, setPin] = useState(false)
  const { data: nomesPerm } = useQuery({
    queryKey: ['permissoes-nomes'], staleTime: Infinity,
    queryFn: async () => { const { data } = await supabase.from('permissions').select('code, name').order('sort'); return new Map((data ?? []).map((x) => [x.code, x.name])) },
  })

  if (!p) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  const loja = lojas?.find((l) => l.store_id === storeId)
  const base = { nome: p.nome, tel: fone(p.telefone), email: p.email }
  const v = ed ?? base
  const sujo = !!ed && (v.nome.trim() !== base.nome || digitos(v.tel) !== digitos(base.tel) || v.email.trim() !== base.email)
  const valido = sujo && v.nome.trim().length > 1 && (!v.tel || [10, 11].includes(digitos(v.tel).length))
  const cargo = PAPEL[perm?.role ?? loja?.role ?? ''] ?? ''
  const perms = perm?.role === 'owner' ? ['Tudo da adega, inclusive assinatura e equipe'] : (perm?.permissions ?? []).map((c) => nomesPerm?.get(c) ?? c)

  const gravar = async (dados: { full_name?: string; phone?: string | null; avatar?: string | null }, msg: string) => {
    const { error } = await supabase.from('profiles').update(dados).eq('id', session!.user.id)
    if (error) { toast(error.message); return false }
    await qc.invalidateQueries({ queryKey: ['perfil'] })
    toast(msg)
    return true
  }
  const salvar = async () => {
    if (!valido) return
    const ok = await gravar({ full_name: v.nome.trim(), phone: digitos(v.tel) || null }, 'Perfil salvo.')
    if (ok && v.email.trim() !== base.email) {
      const { error } = await supabase.auth.updateUser({ email: v.email.trim() }, { emailRedirectTo: `${location.origin}/perfil` })
      toast(error ? error.message : `Enviamos um link para ${v.email.trim()}. O e-mail muda quando você confirmar.`)
    }
    if (ok) setEd(null)
  }
  const onFoto = async (f: File | undefined) => {
    if (!f) return
    if (!/^image\//.test(f.type)) { toast('Escolha uma imagem.'); return }
    try { await gravar({ avatar: await recortar(f) }, 'Foto de perfil atualizada.') } catch (e) { toast((e as Error).message) }
  }
  const fotoL = p.avatar ? 'Trocar foto' : 'Adicionar foto'

  return (
    <div className="p-4 tablet:p-8 grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] max-w-[1100px] mx-auto w-full items-start">
      <div className="flex flex-col items-center gap-4 py-7 px-6 rounded-[4px_14px_5px_12px] bg-surface border border-line text-center">
        <div className="relative">
          <Avatar src={p.avatar} size={132} />
          <label title={fotoL} className="absolute right-0 bottom-1 w-10 h-10 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink flex items-center justify-center cursor-pointer shadow-[0_0_0_3px_#0E0E10]">
            <Icon name="img" size={18} /><input type="file" accept="image/*" className="hidden" onChange={(e) => { onFoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
        <div className="flex flex-col gap-1 min-w-0 max-w-full">
          <div className="text-2xl font-black tracking-[-.01em] [overflow-wrap:anywhere]">{p.nome || 'Sem nome'}</div>
          <div className="text-[15px] text-[#C4C4C9]">{cargo}{loja ? ` · ${loja.name}` : ''}</div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <label className="h-11 px-4 rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-sm font-extrabold flex items-center gap-2 cursor-pointer">
            <Icon name="img" size={18} />{fotoL}<input type="file" accept="image/*" className="hidden" onChange={(e) => { onFoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {p.avatar && <button onClick={() => gravar({ avatar: null }, 'Foto removida.')} className="h-11 px-4 rounded-[2px_8px_3px_7px] border border-[#3A3A40] text-sm font-bold cursor-pointer">Remover</button>}
        </div>
        <div className="self-stretch flex flex-col gap-2 pt-4 border-t border-line text-left">
          <div className="text-xs font-extrabold text-[#A1A1A6] uppercase tracking-[.08em]">Lojas</div>
          {lojas?.map((l) => (
            <div key={l.store_id} className="flex items-center gap-2.5 py-2.5 px-3 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line">
              <span className="text-brand flex"><Icon name="store" size={18} /></span>
              <span className="flex-1 min-w-0 text-sm font-bold">{l.name}</span>
              <span className="text-[13px] text-[#C4C4C9]">{l.neighborhood ?? PAPEL[l.role]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 min-w-0">
        <div className="flex flex-col gap-3.5 p-[22px] rounded-[4px_14px_5px_12px] bg-surface border border-line">
          <div className="text-lg font-black">Dados pessoais</div>
          <Campo label="Nome"><input value={v.nome} onChange={(e) => setEd({ ...v, nome: e.target.value })} className={campo} /></Campo>
          <Campo label="WhatsApp"><input value={v.tel} onChange={(e) => setEd({ ...v, tel: e.target.value })} inputMode="tel" placeholder="(11) 98765-4321" className={campo} /></Campo>
          <Campo label="E-mail"><input value={v.email} onChange={(e) => setEd({ ...v, email: e.target.value })} type="email" className={campo} /></Campo>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {sujo && <button onClick={() => setEd(null)} className="h-[50px] px-[18px] rounded-[2px_8px_3px_7px] border border-[#3A3A40] text-[15px] font-bold cursor-pointer">Cancelar</button>}
            <button onClick={salvar} disabled={!valido} className="h-[50px] px-[22px] rounded-[3px_11px_4px_10px] text-[15px] font-extrabold cursor-pointer disabled:cursor-not-allowed"
              style={{ background: valido ? '#FBC009' : '#232327', color: valido ? '#0A0A0B' : '#8A8A90' }}>Salvar</button>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-[22px] rounded-[4px_14px_5px_12px] bg-surface border border-line">
          <div className="flex items-center gap-2.5"><span className="flex-1 text-lg font-black">Acesso</span>
            {cargo && <span className="h-[26px] px-2.5 rounded-[2px_7px_3px_6px] bg-brand text-brand-ink text-xs font-extrabold flex items-center">{cargo}</span>}</div>
          <div className="flex flex-wrap gap-2">
            {perms.map((x) => <span key={x} className="h-[34px] px-3 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line text-[13px] font-bold flex items-center gap-1.5"><span className="text-ok flex"><Icon name="check" size={16} /></span>{x}</span>)}
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-line">
            <div className="flex-1 min-w-0"><div className="text-[15px] font-bold">PIN do caixa</div><div className="text-[13px] text-[#C4C4C9] mt-0.5">Usado para entrar no caixa, abrir e fechar e liberar desconto.</div></div>
            <button onClick={() => setPin(true)} className="h-[42px] px-3.5 rounded-[2px_8px_3px_7px] border border-[#3A3A40] text-sm font-bold cursor-pointer flex-none">Trocar PIN</button>
          </div>
        </div>
        <button onClick={signOut} className="h-[52px] rounded-[3px_11px_4px_10px] bg-[#E5241B] hover:bg-[#FF3B30] active:scale-[.98] text-white text-base font-extrabold flex items-center justify-center gap-2.5 cursor-pointer"><Icon name="logout" size={18} />Sair da conta</button>
      </div>
      {pin && <TrocarPin onClose={() => setPin(false)} />}
    </div>
  )
}

function TrocarPin({ onClose }: { onClose: () => void }) {
  const { session, storeId } = useAuth()
  const toast = useToast()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = /^\d{4}$/.test(a) && a === b && !busy
  const salvar = async () => {
    setBusy(true)
    try {
      const { data: m, error } = await supabase.from('store_members').select('id').eq('store_id', storeId!).eq('user_id', session!.user.id).eq('active', true).maybeSingle()
      if (error || !m) throw new Error('Você não está na equipe desta loja.')
      await rpc('set_member_pin', { p_member_id: m.id, p_pin: a })
      toast('PIN trocado.')
      onClose()
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  const pinCampo = 'h-[60px] px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-[28px] font-extrabold tracking-[.4em] text-center outline-none focus:border-brand'
  return (
    <Sheet title="Trocar PIN do caixa" onClose={onClose} footer={<button onClick={salvar} disabled={!ok} className={bigBtn}>{busy ? 'Salvando…' : 'Salvar PIN'}</button>}>
      <div className="text-sm text-[#C4C4C9] -mt-2">4 dígitos, sem sequência nem repetição (nada de 1234 ou 0000).</div>
      <Campo label="Novo PIN"><input value={a} onChange={(e) => setA(digitos(e.target.value).slice(0, 4))} inputMode="numeric" type="password" autoFocus className={pinCampo} /></Campo>
      <Campo label="Repita o PIN"><input value={b} onChange={(e) => setB(digitos(e.target.value).slice(0, 4))} onKeyDown={(e) => { if (e.key === 'Enter' && ok) salvar() }} inputMode="numeric" type="password" className={pinCampo} /></Campo>
      {b.length === 4 && a !== b && <div className="text-sm font-bold text-bad">Os dois PINs não são iguais.</div>}
    </Sheet>
  )
}
