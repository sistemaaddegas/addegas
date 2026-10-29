import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/lib/auth'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { useMyStores } from '@/features/acesso/lojas'
import { NAV } from './routes'

const card = 'p-5 rounded-[4px_13px_5px_11px] bg-surface border border-line flex flex-col'

/** Abas que não cabem embaixo, troca de loja e sair (celular; no computador fica no menu lateral). */
export function Mais() {
  const { storeId, setStoreId, signOut } = useAuth()
  const { data: stores } = useMyStores()
  const navigate = useNavigate()
  const toast = useToast()

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[640px]">
      <div className="text-[28px] font-black tracking-[-0.01em]">Mais</div>
      <nav className={card}>
        {NAV.filter((n) => !n.tab).map((n) => (
          <NavLink key={n.path} to={n.path} className="flex items-center justify-between py-3 border-t first:border-t-0 border-line text-[15px] font-bold">
            {n.label}<span className="text-[#C4C4C9]"><Icon name="chev" /></span>
          </NavLink>
        ))}
      </nav>
      {stores && stores.length > 1 && (
        <div className={`${card} gap-2.5`}>
          <div className="text-[17px] font-extrabold">Lojas</div>
          {stores.map((s) => {
            const atual = s.store_id === storeId
            return (
              <button key={s.store_id} onClick={() => { setStoreId(s.store_id, s.slug); if (!atual) toast(`Agora em ${s.name}`); navigate('/') }}
                className={`flex items-center gap-3.5 p-3.5 w-full text-left rounded-[3px_11px_4px_10px] border cursor-pointer ${atual ? 'border-brand bg-[rgba(251,192,9,.08)]' : 'border-line-2 bg-surface-2'}`}>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold">{s.name}</span>
                  <span className="block text-sm text-[#C4C4C9] mt-[3px]">{s.neighborhood ?? s.slug}</span>
                </span>
                {atual && <span className="text-brand"><Icon name="check" /></span>}
              </button>
            )
          })}
        </div>
      )}
      <button onClick={signOut} className="h-[46px] rounded-[3px_10px_2px_9px] bg-[#E5241B] hover:bg-[#FF3B30] active:bg-[#B81C15] active:scale-[.97] transition text-white text-[15px] font-extrabold flex items-center justify-center gap-2 cursor-pointer">
        <Icon name="logout" />Sair da conta
      </button>
    </div>
  )
}
