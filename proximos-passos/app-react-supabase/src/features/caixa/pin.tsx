import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { useOperadores, type Operador } from './dados'

const PAPEL: Record<string, string> = { owner: 'Dono', manager: 'Gerente', cashier: 'Caixa', stock_keeper: 'Estoquista' }
const IRR = ['2px 14px 3px 11px / 3px 9px 2px 12px', '12px 2px 13px 3px / 9px 3px 12px 2px', '3px 11px 2px 14px / 12px 2px 9px 3px', '13px 3px 11px 2px / 2px 12px 3px 9px']
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** Troca de operador no caixa (E10): escolhe o nome e digita o PIN de 4 dígitos. */
export function Pin({ onEntrar }: { onEntrar: (o: Operador) => void }) {
  const { terminal, signOut } = useAuth()
  const { data: membros, isLoading } = useOperadores(terminal?.storeId ?? null)
  const [quem, setQuem] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const escolhido = membros?.find((m) => m.id === quem)

  const tecla = (d: string) => setPin((p) => (d === '<' ? p.slice(0, -1) : p.length < 4 ? p + d : p))

  useEffect(() => {
    if (pin.length !== 4 || !quem || busy) return
    setBusy(true)
    rpc<{ operator_session_id: string; member_id: string; name: string; role: string }>('operator_login', { p_member_id: quem, p_pin: pin })
      .then((r) => onEntrar({ sessionId: r.operator_session_id, memberId: r.member_id, name: r.name, role: r.role }))
      .catch((e: Error) => { toast(e.message); setPin(''); setBusy(false) })
  }, [pin, quem, busy, onEntrar, toast])

  useEffect(() => {
    if (!quem) return
    const k = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) tecla(e.key); else if (e.key === 'Backspace') tecla('<'); else if (e.key === 'Escape') { setQuem(null); setPin('') } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [quem])

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-5 max-w-[720px] mx-auto w-full">
      <div>
        <div className="text-[clamp(28px,3.2vw,40px)] font-black tracking-[-0.02em] leading-[1.05]" style={{ fontStretch: '100%' }}>
          {escolhido ? <>Oi, <span className="inline-block bg-brand text-brand-ink pt-0.5 pb-1.5 px-3.5 rounded-[3px_12px_4px_10px] -rotate-[1.5deg]">{escolhido.display_name.split(' ')[0]}</span></> : 'Quem vai operar?'}
        </div>
        <div className="text-[15px] text-[#C4C4C9] mt-2">{terminal?.name} · {escolhido ? 'Digite seu PIN de 4 dígitos' : 'Toque no seu nome'}</div>
      </div>

      {!escolhido && (
        <div className="grid gap-2.5 grid-cols-2 tablet:grid-cols-3">
          {isLoading && <div className="text-[#C4C4C9]">Carregando a equipe…</div>}
          {membros?.map((m, i) => (
            <button key={m.id} onClick={() => setQuem(m.id)} style={{ borderRadius: IRR[i % 4] }}
              className="flex items-center gap-3 p-3.5 bg-surface border border-line text-left cursor-pointer transition hover:-translate-y-0.5 hover:border-brand active:scale-[.97]">
              <span className="w-11 h-11 flex-none rounded-full bg-line-2 flex items-center justify-center text-sm font-extrabold">{iniciais(m.display_name)}</span>
              <span className="min-w-0"><span className="block text-[15px] font-bold truncate">{m.display_name}</span><span className="block text-[13px] text-[#C4C4C9] mt-0.5">{PAPEL[m.role] ?? m.role}</span></span>
            </button>
          ))}
        </div>
      )}

      {escolhido && (
        <div className="flex flex-col items-center gap-5 p-6 rounded-[4px_13px_5px_11px] bg-surface border border-line">
          <div className="flex gap-3.5">
            {[0, 1, 2, 3].map((i) => <span key={i} className={`w-4 h-4 rounded-full ${i < pin.length ? 'bg-brand' : 'bg-line-2'}`} />)}
          </div>
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[320px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<'].map((d, i) => d === '' ? <span key={i} /> : (
              <button key={i} onClick={() => tecla(d)} disabled={busy} aria-label={d === '<' ? 'Apagar' : d}
                className="h-16 rounded-[3px_11px_4px_10px] bg-surface-2 border border-line-2 text-[26px] font-extrabold num cursor-pointer active:scale-95 active:bg-line-2 disabled:opacity-60 flex items-center justify-center">
                {d === '<' ? <Icon name="x" size={22} /> : d}
              </button>
            ))}
          </div>
          <button onClick={() => { setQuem(null); setPin('') }} className="bg-transparent text-brand text-sm font-bold cursor-pointer">Não sou {escolhido.display_name.split(' ')[0]}</button>
        </div>
      )}

      <button onClick={signOut} className="self-start bg-transparent text-[#ADADB4] text-[13px] font-bold cursor-pointer">Desconectar este caixa</button>
    </div>
  )
}
