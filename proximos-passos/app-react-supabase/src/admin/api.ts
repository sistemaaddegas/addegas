import { createClient } from '@supabase/supabase-js'
import { mensagem } from '@/lib/erros'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sessão própria do painel: em produção ele vive em admin.addegas.com.br (D47); no local divide a origem com o
// app da adega, então guarda a sessão em outra chave para uma não derrubar a outra.
export const adminAuth = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'addegas-admin-auth' },
}).auth

const functionsUrl = `${url}/functions/v1/admin/`

export class AdminError extends Error {
  constructor(public code: string, public detail?: unknown) {
    super(mensagem(code))
  }
}

/** Chama a admin-api (2FA, inatividade e permissão do perfil são conferidos lá) e desembrulha { ok, data }. */
export async function adminApi<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await adminAuth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AdminError('AUTH_REQUIRED')
  let r: Response
  try {
    r = await fetch(functionsUrl + path, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AdminError('NETWORK')
  }
  const j = await r.json().catch(() => null)
  if (!j) throw new AdminError('INTERNAL')
  if (!j.ok) throw new AdminError(j.error?.code ?? 'INTERNAL', j.error?.detail)
  return j.data as T
}
