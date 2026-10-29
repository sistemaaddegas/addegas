import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { mensagem } from './erros'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local')
}

// Só o schema `app` é exposto pela API; os outros são internos.
export const supabase = createClient<Database, 'app'>(url, key, {
  db: { schema: 'app' },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Erro com código estável do back-end; `message` já vem em português (src/lib/erros.ts). */
export class AppError extends Error {
  constructor(public code: string, public detail?: unknown) {
    super(mensagem(code))
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; detail?: unknown } }

/** Chama uma RPC de `app` e desembrulha { ok, data } / { ok: false, error }. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never)
  if (error) throw new AppError(error.code === 'PGRST301' ? 'AUTH_REQUIRED' : 'INTERNAL', error.message)
  const r = data as Envelope<T> | T
  if (r && typeof r === 'object' && 'ok' in r) {
    if (!r.ok) throw new AppError(r.error.code, r.error.detail)
    return r.data
  }
  return r as T
}
