import type { QueryClient } from '@tanstack/react-query'
import { AppError, funcao, supabase } from '@/lib/supabase'

type PairResult = { terminal_id: string; store_id: string; name: string; session: { access_token: string; refresh_token: string } }

/**
 * Troca o código de 6 dígitos por uma sessão de terminal (E09, Edge Function terminals/pair).
 * A sessão de quem estava logado é substituída: daqui em diante o aparelho é um caixa.
 */
export async function parearAparelho(slug: string, code: string, queryClient: QueryClient) {
  const r = await funcao<PairResult>('terminals/pair', { store_slug: slug.trim().toLowerCase(), code: code.trim() })
  queryClient.clear()
  const { error: e2 } = await supabase.auth.setSession(r.session)
  if (e2) throw new AppError('AUTH_ERROR')
  return r
}
