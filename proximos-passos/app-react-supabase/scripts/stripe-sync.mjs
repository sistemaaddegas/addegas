// E34 · Configura o Stripe do ambiente: produto, os 3 preços do plano e os 3 da loja adicional (D29, D54),
// o portal do cliente e, na nuvem, o endpoint do webhook. Grava os ids em platform.plan_prices /
// platform.addon_prices e, no local, também no supabase/functions/.env.
//
// Local (lê a chave do supabase/functions/.env e usa o banco do Docker):
//   npm run stripe:sync
// Nuvem (uma vez por ambiente, com a chave do ambiente e a conexão direta do banco):
//   STRIPE_SECRET_KEY=sk_... DATABASE_URL=postgresql://... WEBHOOK_URL=https://<projeto>.supabase.co/functions/v1/hooks-stripe \
//   APP_URL=https://app.addegas.com.br node scripts/stripe-sync.mjs
// Idempotente: procura por lookup_key/metadata antes de criar; rodar de novo não duplica nada.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const ENV_FILE = new URL('../supabase/functions/.env', import.meta.url)
const local = !process.env.DATABASE_URL
const envLocal = local && existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : ''
const doEnv = (k) => envLocal.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()

const KEY = process.env.STRIPE_SECRET_KEY || doEnv('STRIPE_SECRET_KEY')
const APP_URL = process.env.APP_URL || doEnv('APP_URL') || 'http://localhost:5173'
if (!KEY) {
  console.error('Coloque a chave secreta de teste do Stripe (sk_test_...) em STRIPE_SECRET_KEY no supabase/functions/.env.')
  process.exit(1)
}
if (local && !/^(sk|rk)_test_/.test(KEY)) {
  console.error('No ambiente local só vale chave de TESTE (sk_test_...). A chave de produção vai só nos segredos da nuvem.')
  process.exit(1)
}

const INTERVALS = { monthly: { interval: 'month', count: 1 }, semiannual: { interval: 'month', count: 6 }, annual: { interval: 'year', count: 1 } }
const NOMES = { monthly: 'mensal', semiannual: 'semestral', annual: 'anual' }

// Parâmetros no formato do Stripe: { a: { b: [x] } } vira a[b][0]=x.
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v !== null && typeof v === 'object') form(v, key, out)
    else if (v !== undefined) out.append(key, String(v))
  }
  return out
}

async function stripe(method, path, params) {
  const body = params ? form(params).toString() : undefined
  const res = await fetch(`https://api.stripe.com/v1${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? body : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${path}: ${json.error?.message}`)
  return json
}

function sql(query) {
  const args = local
    ? ['exec', 'supabase_db_addegas', 'psql', '-U', 'postgres', '-qtA', '-c', query]
    : [process.env.DATABASE_URL, '-qtA', '-c', query]
  return execFileSync(local ? 'docker' : 'psql', args, { encoding: 'utf8' }).trim()
}

function gravarEnv(k, v) {
  if (!local || !existsSync(ENV_FILE)) return
  const txt = readFileSync(ENV_FILE, 'utf8')
  writeFileSync(ENV_FILE, new RegExp(`^${k}=.*$`, 'm').test(txt) ? txt.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : `${txt.trimEnd()}\n${k}=${v}\n`)
}

async function ensureProduct(name, lookup, description) {
  const found = await stripe('GET', '/products/search', { query: `metadata['lookup']:'${lookup}'` })
  if (found.data[0]) return found.data[0].id
  return (await stripe('POST', '/products', { name, description, metadata: { lookup } })).id
}

async function ensurePrice(product, lookupKey, amount, cycle, nickname) {
  const found = await stripe('GET', '/prices', { lookup_keys: [lookupKey] })
  if (found.data[0]) {
    if (found.data[0].unit_amount !== Number(amount)) {
      throw new Error(`O preço ${lookupKey} no Stripe (${found.data[0].unit_amount}) é diferente do banco (${amount}). Preço no Stripe não muda: crie outro lookup_key.`)
    }
    return found.data[0].id
  }
  const { interval, count } = INTERVALS[cycle]
  return (await stripe('POST', '/prices', {
    product, currency: 'brl', unit_amount: amount, lookup_key: lookupKey, nickname,
    recurring: { interval, interval_count: count },
  })).id
}

const conta = await stripe('GET', '/account')
console.log(`Conta Stripe: ${conta.settings?.dashboard?.display_name || conta.id} (${KEY.startsWith('sk_live') ? 'PRODUÇÃO' : 'teste'}, país ${conta.country}, moeda ${conta.default_currency})`)

// 1. Produtos e preços
const plan = await ensureProduct('Addegas', 'addegas_plan', 'Sistema de gestão para adegas: caixa, estoque, pedidos e relatórios.')
const addon = await ensureProduct('Addegas · Loja adicional', 'addegas_extra_store', 'Cada loja além da primeira na mesma conta.')
for (const row of sql(`select cycle || ':' || price from platform.plan_prices pp join platform.plans p on p.id = pp.plan_id where p.code = 'addegas'`).split('\n')) {
  const [cycle, amount] = row.split(':')
  const id = await ensurePrice(plan, `addegas_${cycle}`, amount, cycle, `Addegas ${NOMES[cycle]}`)
  sql(`update platform.plan_prices set stripe_price_id = '${id}' where cycle = '${cycle}' and plan_id = (select id from platform.plans where code = 'addegas')`)
  console.log(`plano ${NOMES[cycle]}: ${id}`)
}
const extraIds = []
for (const row of sql(`select cycle || ':' || price from platform.addon_prices ap join platform.addons a on a.id = ap.addon_id where a.code = 'extra_store'`).split('\n')) {
  const [cycle, amount] = row.split(':')
  const id = await ensurePrice(addon, `addegas_extra_store_${cycle}`, amount, cycle, `Loja adicional ${NOMES[cycle]}`)
  sql(`update platform.addon_prices set stripe_price_id = '${id}' where cycle = '${cycle}' and addon_id = (select id from platform.addons where code = 'extra_store')`)
  extraIds.push(id)
  console.log(`loja adicional ${NOMES[cycle]}: ${id}`)
}
gravarEnv('STRIPE_EXTRA_STORE_PRICE_IDS', extraIds.join(','))

// 2. Portal do cliente: trocar cartão, ver faturas e cancelar no fim do ciclo. Troca de ciclo e de lojas é pelo app.
const portais = await stripe('GET', '/billing_portal/configurations', { active: true, limit: 100 })
let portal = portais.data.find((c) => c.metadata?.lookup === 'addegas_portal')?.id
if (!portal) {
  portal = (await stripe('POST', '/billing_portal/configurations', {
    business_profile: { headline: 'Addegas: sua assinatura' },
    default_return_url: `${APP_URL}/assinatura`,
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'name', 'tax_id'] },
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'] } },
    },
    metadata: { lookup: 'addegas_portal' },
  })).id
}
gravarEnv('STRIPE_PORTAL_CONFIGURATION_ID', portal)
console.log(`portal do cliente: ${portal}`)

// 3. Webhook: na nuvem, cria o endpoint; no local, o Stripe CLI repassa os eventos (stripe listen).
const EVENTOS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed']
if (process.env.WEBHOOK_URL) {
  const hooks = await stripe('GET', '/webhook_endpoints', { limit: 100 })
  const existe = hooks.data.find((h) => h.url === process.env.WEBHOOK_URL)
  if (existe) console.log(`webhook: ${existe.id} (já existia; o segredo whsec_ fica no painel do Stripe)`)
  else {
    const h = await stripe('POST', '/webhook_endpoints', { url: process.env.WEBHOOK_URL, enabled_events: EVENTOS, description: 'Addegas · hooks-stripe' })
    console.log(`webhook: ${h.id}\nSegredo (guarde em STRIPE_WEBHOOK_SECRET nos segredos das funções; só aparece agora): ${h.secret}`)
  }
} else {
  console.log(`\nWebhook local: com o Stripe CLI, rode
  stripe listen --forward-to http://127.0.0.1:57321/functions/v1/hooks-stripe --events ${EVENTOS.join(',')}
e copie o whsec_ que ele mostra para STRIPE_WEBHOOK_SECRET no supabase/functions/.env.`)
}

if (local) console.log('\nIds gravados no banco local e no supabase/functions/.env. Reinicie o "supabase functions serve" para as funções lerem.')
else console.log(`\nDefina nos segredos das funções: STRIPE_EXTRA_STORE_PRICE_IDS=${extraIds.join(',')} STRIPE_PORTAL_CONFIGURATION_ID=${portal}`)
