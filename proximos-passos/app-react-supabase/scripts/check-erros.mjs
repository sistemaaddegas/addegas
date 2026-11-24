// Falha se algum código de erro do back-end (migrations e Edge Functions) não tiver mensagem em src/lib/erros.ts.
// Uso: npm run check:erros  (roda no CI junto com o typecheck)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})

const codes = new Set()
for (const f of walk(path.join(root, 'supabase/migrations'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:err|fail)\('([A-Z][A-Z0-9_]+)'/g)) codes.add(m[1])
}
for (const f of walk(path.join(root, 'supabase/functions')).filter((f) => f.endsWith('.ts'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:fail\(req, cid, |code: )"([A-Z][A-Z0-9_]+)"/g)) codes.add(m[1])
}

// Códigos de funções que já saíram do banco: continuam no texto das migrations antigas, mas nenhuma tela os recebe.
// (O PIN do caixa e a liberação de desconto por PIN saíram em 20261030130000_sem_pin.sql.)
const APOSENTADOS = new Set(['PIN_WEAK', 'PIN_INVALID', 'OPERATOR_PIN_LOCKED', 'TERMINAL_PIN_LOCKED', 'SALE_OVERRIDE_INVALID', 'OVERRIDE_LIMIT', 'OVERRIDE_ACTION_UNKNOWN'])
for (const c of APOSENTADOS) codes.delete(c)

const known = new Set([...readFileSync(path.join(root, 'src/lib/erros.ts'), 'utf8').matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]))
const missing = [...codes].filter((c) => !known.has(c)).sort()
if (missing.length) {
  console.error(`Códigos sem mensagem em src/lib/erros.ts:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log(`${codes.size} códigos de erro do back-end, todos com mensagem em português.`)
