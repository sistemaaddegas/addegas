import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { rpc } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Icon } from '@/components/icon'
import { AuthLayout, btnText } from './layout'

export type MyStore = {
  store_id: string; account_id: string; name: string; slug: string; neighborhood: string | null
  role: 'owner' | 'manager' | 'cashier' | 'stock_keeper' | 'courier'; access: string
}

export const useMyStores = () => useQuery({ queryKey: ['my_stores'], queryFn: () => rpc<MyStore[]>('my_stores') })

/** "Adega Esquina" → AE; "Adega Esquina 2" → A2 (primeira letra da primeira e da última palavra). */
const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

export function Lojas() {
  const { storeId, setStoreId, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: stores, isLoading, error } = useMyStores()

  const go = (s: MyStore) => { setStoreId(s.store_id, s.slug); navigate('/', { replace: true }) }

  // Com uma loja só não há o que escolher.
  useEffect(() => { if (stores?.length === 1) go(stores[0]) }, [stores])

  return (
    <AuthLayout>
      <div className="text-[30px] font-black tracking-[-0.01em]" style={{ fontStretch: '100%' }}>Escolha a loja</div>
      <div className="text-[15px] text-[#C4C4C9] -mt-1.5">
        {isLoading ? 'Carregando suas lojas…'
          : error ? error.message
          : stores?.length ? `Você tem acesso a ${stores.length} ${stores.length === 1 ? 'loja' : 'lojas'}.`
          : 'Você ainda não tem acesso a nenhuma loja. Peça ao dono da adega para liberar.'}
      </div>
      {stores?.map((s) => {
        const atual = s.store_id === storeId
        return (
          <button key={s.store_id} onClick={() => go(s)}
            className={`flex items-center gap-3.5 p-3.5 w-full text-left rounded-[3px_11px_4px_10px] border cursor-pointer ${atual ? 'border-brand bg-[rgba(251,192,9,.08)]' : 'border-line-2 bg-surface-2'}`}>
            <span className="w-11 h-11 flex-none flex items-center justify-center rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-black">{iniciais(s.name)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-base font-bold">{s.name}</span>
              <span className="block text-sm text-[#C4C4C9] mt-[3px]">{s.neighborhood ?? s.slug}</span>
            </span>
            <span className="text-[#C4C4C9]"><Icon name="chev" /></span>
          </button>
        )
      })}
      {stores?.some((s) => s.role === 'owner') && (
        <button onClick={() => navigate('/cadastro')} className="h-[52px] rounded-[3px_11px_4px_10px] border border-dashed border-[#3A3A40] bg-transparent text-[#C4C4C9] text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer">
          <Icon name="plus" />Cadastrar nova loja
        </button>
      )}
      <button onClick={signOut} className={btnText}>Voltar</button>
    </AuthLayout>
  )
}
