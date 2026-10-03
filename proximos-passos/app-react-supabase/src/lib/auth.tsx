import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthCtx = { session: Session | null; loading: boolean; storeId: string | null; setStoreId: (id: string) => void }
const Ctx = createContext<AuthCtx>({ session: null, loading: true, storeId: null, setStoreId: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [storeId, setStore] = useState<string | null>(() => localStorage.getItem('addegas.store'))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const setStoreId = (id: string) => { localStorage.setItem('addegas.store', id); setStore(id) }
  return <Ctx.Provider value={{ session, loading, storeId, setStoreId }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
