import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { useMyStores } from '@/features/acesso/lojas'
import { parearAparelho } from './parear'

const card = 'p-5 rounded-[4px_13px_5px_11px] bg-surface border border-line flex flex-col gap-3.5'
const input = 'h-[52px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-base w-full outline-none focus:border-brand'

/**
 * O caixa só funciona num aparelho registrado (E09): quem vende toca no próprio nome, sem e-mail nem senha.
 * Dono e gerente registram o aparelho aqui mesmo, ou geram o código para digitar em outro.
 */
export function SemTerminal() {
  const { storeId } = useAuth()
  const { data: stores } = useMyStores()
  const loja = stores?.find((s) => s.store_id === storeId)
  const pode = loja?.role === 'owner' || loja?.role === 'manager'
  const [nome, setNome] = useState('Balcão 1')
  const [busy, setBusy] = useState(false)
  const [codigo, setCodigo] = useState<string | null>(null)
  const toast = useToast()
  const qc = useQueryClient()

  const gerar = async () => {
    const r = await rpc<{ code: string }>('create_pairing_code', { p_store_id: storeId, p_terminal_name: nome })
    return r.code
  }
  const usarEste = async () => {
    if (!loja) return
    setBusy(true)
    try {
      await parearAparelho(loja.slug, await gerar(), qc)
      toast(`Este aparelho agora é o caixa ${nome.trim()}`)
    } catch (e) {
      toast((e as Error).message)
      setBusy(false)
    }
  }
  const paraOutro = async () => {
    setBusy(true)
    try { setCodigo(await gerar()) } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[640px]">
      <div className={card}>
        <span className="w-12 h-12 rounded-[3px_10px_2px_9px] bg-[rgba(251,192,9,.12)] text-brand flex items-center justify-center"><Icon name="store" size={24} /></span>
        <div>
          <div className="text-[22px] font-black" style={{ fontStretch: '100%' }}>Este aparelho ainda não é um caixa</div>
          <div className="text-[15px] text-[#C4C4C9] mt-1.5 leading-[1.45]">
            No caixa, cada pessoa toca no próprio nome, e as vendas ficam registradas nele.
            {pode ? ' Registre este aparelho como caixa, ou gere um código para registrar outro (tablet do balcão, celular).' : ' Peça ao dono ou ao gerente para registrar este aparelho.'}
          </div>
        </div>
        {pode && (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[#C4C4C9]">Nome do aparelho</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} className={input} placeholder="Ex.: Balcão 1" />
            </label>
            <button onClick={usarEste} disabled={busy || !nome.trim()} className="h-[54px] rounded-[3px_11px_4px_10px] bg-brand text-brand-ink text-base font-extrabold cursor-pointer disabled:opacity-60">
              {busy ? 'Registrando…' : 'Usar este aparelho como caixa'}
            </button>
            <button onClick={paraOutro} disabled={busy || !nome.trim()} className="h-[50px] rounded-[3px_11px_4px_10px] border border-line-2 bg-transparent text-[15px] font-bold cursor-pointer disabled:opacity-60">
              Gerar código para outro aparelho
            </button>
            <div className="text-[13px] text-[#ADADB4] leading-[1.45]">Ao usar este aparelho como caixa, sua conta sai dele. Para voltar a ver relatórios aqui, desconecte o caixa e entre de novo com seu e-mail.</div>
          </>
        )}
      </div>
      {codigo && loja && (
        <div className={`${card} border-brand`}>
          <div className="text-[17px] font-extrabold">Código para registrar “{nome.trim()}”</div>
          <div className="text-[44px] font-black tracking-[.18em] num text-brand leading-none">{codigo}</div>
          <div className="text-[15px] text-[#C4C4C9] leading-[1.5]">
            No outro aparelho, abra o Addegas, toque em <b className="text-ink">Usar este aparelho como caixa</b> e informe a loja <b className="text-ink">{loja.slug}</b> e este código. Vale por 10 minutos e só uma vez.
          </div>
        </div>
      )}
    </div>
  )
}
