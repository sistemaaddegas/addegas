import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { useToast } from '@/components/toast'
import { useOperadores, type Operador } from './dados'

const PAPEL: Record<string, string> = { owner: 'Dono', manager: 'Gerente', cashier: 'Caixa', stock_keeper: 'Estoquista' }
const IRR = ['2px 14px 3px 11px / 3px 9px 2px 12px', '12px 2px 13px 3px / 9px 3px 12px 2px', '3px 11px 2px 14px / 12px 2px 9px 3px', '13px 3px 11px 2px / 2px 12px 3px 9px']
const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/** Troca de operador no caixa (E10): a pessoa toca no próprio nome e já entra; as vendas ficam no nome dela. */
export function EscolherOperador({ onEntrar }: { onEntrar: (o: Operador) => void }) {
  const { terminal, signOut } = useAuth()
  const { data: membros, isLoading } = useOperadores(terminal?.storeId ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const visiveis = (membros ?? []).filter((m) => !q.trim() || m.display_name.toLowerCase().includes(q.trim().toLowerCase()))
  const toast = useToast()

  const entrar = (id: string) => {
    if (busy) return
    setBusy(id)
    rpc<{ operator_session_id: string; member_id: string; name: string; role: string }>('operator_login', { p_member_id: id })
      .then((r) => onEntrar({ sessionId: r.operator_session_id, memberId: r.member_id, name: r.name, role: r.role }))
      .catch((e: Error) => { toast(e.message); setBusy(null) })
  }

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-5 max-w-[720px] mx-auto w-full">
      <div>
        <div className="text-[clamp(28px,3.2vw,40px)] font-black tracking-[-0.02em] leading-[1.05]" style={{ fontStretch: '100%' }}>Quem vai operar?</div>
        <div className="text-[15px] text-[#C4C4C9] mt-2">{terminal?.name} · Toque no seu nome</div>
      </div>
      {(membros?.length ?? 0) > 9 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar seu nome" aria-label="Buscar seu nome"
        className="h-12 px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line text-[15px] outline-none focus:border-brand max-w-[420px]" />}
      {!!membros?.length && <div className="text-[13px] font-bold text-[#C4C4C9] -mt-2">{visiveis.length === membros.length ? `${membros.length} ${membros.length === 1 ? 'pessoa' : 'pessoas'} na equipe` : `Mostrando ${visiveis.length} de ${membros.length}`}</div>}
      <div className="grid gap-2.5 grid-cols-2 tablet:grid-cols-3">
        {isLoading && <div className="text-[#C4C4C9]">Carregando a equipe…</div>}
        {visiveis.map((m, i) => (
          <button key={m.id} onClick={() => entrar(m.id)} disabled={!!busy} style={{ borderRadius: IRR[i % 4] }}
            className="flex items-center gap-3 p-3.5 bg-surface border border-line text-left cursor-pointer transition hover:-translate-y-0.5 hover:border-brand active:scale-[.97] disabled:opacity-60">
            <span className="w-11 h-11 flex-none rounded-full bg-line-2 flex items-center justify-center text-sm font-extrabold">{iniciais(m.display_name)}</span>
            <span className="min-w-0"><span className="block text-[15px] font-bold truncate">{m.display_name}</span><span className="block text-[13px] text-[#C4C4C9] mt-0.5">{busy === m.id ? 'Entrando…' : PAPEL[m.role] ?? m.role}</span></span>
          </button>
        ))}
      </div>
      <button onClick={signOut} className="self-start bg-transparent text-[#ADADB4] text-[13px] font-bold cursor-pointer">Desconectar este caixa</button>
    </div>
  )
}
