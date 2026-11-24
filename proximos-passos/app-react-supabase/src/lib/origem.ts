/**
 * E53 · De onde veio a adega. A landing manda para /cadastro?ciclo=annual&utm_source=...;
 * isso fica guardado no aparelho porque o link de confirmação do e-mail volta para /cadastro sem os parâmetros.
 * No fim do cadastro, a origem vai para o banco (p_origin) e o ciclo chega marcado na tela de Assinatura.
 */
export type Ciclo = 'monthly' | 'semiannual' | 'annual'
export type Origem = { ciclo?: Ciclo; utm?: Record<string, string> }

const CHAVE = 'addegas:origem'
const CICLOS: Ciclo[] = ['monthly', 'semiannual', 'annual']
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

export function guardarOrigem(search: string) {
  const q = new URLSearchParams(search)
  const ciclo = q.get('ciclo') as Ciclo | null
  const utm = Object.fromEntries(UTM.filter((k) => q.get(k)).map((k) => [k, q.get(k)!.slice(0, 80)]))
  const o: Origem = {}
  if (ciclo && CICLOS.includes(ciclo)) o.ciclo = ciclo
  if (Object.keys(utm).length) o.utm = utm
  if (!o.ciclo && !o.utm) return
  try { localStorage.setItem(CHAVE, JSON.stringify(o)) } catch { /* sem armazenamento: segue sem a origem */ }
}

export function lerOrigem(): Origem {
  try {
    const o = JSON.parse(localStorage.getItem(CHAVE) ?? '{}') as Origem
    return { ciclo: o.ciclo && CICLOS.includes(o.ciclo) ? o.ciclo : undefined, utm: o.utm && typeof o.utm === 'object' ? o.utm : undefined }
  } catch { return {} }
}
