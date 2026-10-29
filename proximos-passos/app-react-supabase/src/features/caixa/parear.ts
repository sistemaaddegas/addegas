import type { QueryClient } from '@tanstack/react-query'
import { AppError, supabase } from '@/lib/supabase'

type PairResult = { terminal_id: string; store_id: string; name: string; session: { access_token: string; refresh_token: string } }

/**
 * Troca o código de 6 dígitos por uma sessão de terminal (E09, Edge Function terminals/pair).
 * A sessão de quem estava logado é substituída: daqui em diante o aparelho é um caixa.
 */
export async function parearAparelho(slug: string, code: string, queryClient: QueryClient) {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; data?: PairResult; error?: { code: string } }>('terminals/pair', {
    body: { store_slug: slug.trim().toLowerCase(), code: code.trim() },
  })
  // Erro HTTP: o corpo ainda traz o código estável.
  let r = data
  if (error && 'context' in error && error.context instanceof Response) r = await error.context.json().catch(() => null)
  if (!r?.ok || !r.data) throw new AppError(r?.error?.code ?? 'INTERNAL')
  queryClient.clear()
  const { error: e2 } = await supabase.auth.setSession(r.data.session)
  if (e2) throw new AppError('AUTH_ERROR')
  return r.data
}
