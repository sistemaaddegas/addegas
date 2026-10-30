import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { rpc, supabase } from './supabase'

/** Aparelho pareado como caixa (E09): entra com um usuário técnico, e quem opera escolhe o próprio nome. */
export type Terminal = { id: string; storeId: string; name: string }

type AuthCtx = {
  session: Session | null
  loading: boolean
  storeId: string | null
  /** O slug fica salvo no aparelho para completar o login por nome de usuário (E07). */
  setStoreId: (id: string, slug?: string) => void
  /** Senha provisória (E07) ou link de recuperação: a única tela liberada é a de criar senha. */
  needsNewPassword: boolean
  passwordChanged: () => void
  /** Preenchido quando este aparelho é um caixa; aí a loja vem do terminal, não da escolha da pessoa. */
  terminal: Terminal | null
  signOut: () => Promise<void>
}
const Ctx = createContext<AuthCtx>({
  session: null, loading: true, storeId: null, setStoreId: () => {},
  needsNewPassword: false, passwordChanged: () => {}, terminal: null, signOut: async () => {},
})

const STORE_KEY = 'addegas.store'
export const SLUG_KEY = 'addegas.slug'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [storeId, setStore] = useState<string | null>(() => localStorage.getItem(STORE_KEY))
  const [needsNewPassword, setNeedsNewPassword] = useState(false)
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const recovering = useRef(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Confere a senha provisória só quando muda a pessoa logada: o SIGNED_IN se repete ao voltar para a aba,
    // e esconder a tela nessa hora desmontaria uma venda em andamento.
    let checkedUser: string | null = null
    const check = async (s: Session | null) => {
      if (s && s.user.id !== checkedUser) {
        checkedUser = s.user.id
        setLoading(true)
        if (s.user.app_metadata?.kind === 'terminal') {
          // A RLS só deixa o terminal ler a própria linha; revogado = nenhuma linha.
          const { data } = await supabase.from('terminals').select('id, store_id, name').eq('active', true).limit(1)
          const t = data?.[0]
          setTerminal(t ? { id: t.id, storeId: t.store_id, name: t.name } : null)
          setNeedsNewPassword(false)
          if (!t) await supabase.auth.signOut()
        } else {
          setTerminal(null)
          setNeedsNewPassword(recovering.current || await rpc<boolean>('must_change_password').catch(() => false))
        }
      }
      if (!s) setTerminal(null)
      setSession(s)
      setLoading(false)
    }
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') { recovering.current = true; setSession(s); setNeedsNewPassword(true); return }
      if (event === 'SIGNED_OUT') checkedUser = null
      setTimeout(() => check(s)) // INITIAL_SESSION inclusive; fora do callback do Auth, que não pode chamar o Supabase
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const setStoreId = (id: string, slug?: string) => {
    localStorage.setItem(STORE_KEY, id)
    if (slug) localStorage.setItem(SLUG_KEY, slug)
    setStore(id)
  }
  const signOut = async () => {
    await supabase.auth.signOut()
    queryClient.clear() // nada da pessoa anterior fica em cache no aparelho
    localStorage.removeItem(STORE_KEY)
    setStore(null)
    recovering.current = false
    setNeedsNewPassword(false)
  }

  return (
    <Ctx.Provider value={{
      session, loading, storeId: terminal?.storeId ?? storeId, setStoreId, needsNewPassword,
      passwordChanged: () => { recovering.current = false; setNeedsNewPassword(false) }, terminal, signOut,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
