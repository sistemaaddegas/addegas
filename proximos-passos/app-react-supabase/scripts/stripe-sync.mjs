// E34 · Cria (ou reaproveita) no Stripe o produto, os 3 preços do plano e os 3 da loja adicional (D29, D54)
// e grava os ids em platform.plan_prices / platform.addon_prices.
// Uso (uma vez por ambiente, com a chave secreta do ambiente e a conexão direta do banco):
//   STRIPE_SECRET_KEY=sk_test_... DATABASE_URL=postgresql://... node scripts/stripe-sync.mjs
// Idempotente: procura por lookup_key antes de criar.
import { execFileSync } from 'node:child_process'

const KEY = process.env.STRIPE_SECRET_KEY
const DB = process.env.DATABASE_URL
if (!KEY || !DB) {
  console.error('Defina STRIPE_SECRET_KEY e DATABASE_URL.')
  process.exit(1)
}

const INTERVALS = { monthly: { interval: 'month', count: 1 }, semiannual: { interval: 'month', count: 6 }, annual: { interval: 'year', count: 1 } }

async function stripe(method, path, params) {
  const body = params ? new URLSearchParams(params).toString() : undefined
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
  return execFileSync('psql', [DB, '-qtA', '-c', query], { encoding: 'utf8' }).trim()
}

async function ensureProduct(name, lookup) {
  const found = await stripe('GET', '/products/search', { query: `metadata['lookup']:'${lookup}'` })
  if (found.data[0]) return found.data[0].id
  return (await stripe('POST', '/products', { name, 'metadata[lookup]': lookup })).id
}

async function ensurePrice(product, lookupKey, amount, cycle) {
  const found = await stripe('GET', '/prices', { 'lookup_keys[]': lookupKey })
  if (found.data[0]) return found.data[0].id
  const { interval, count } = INTERVALS[cycle]
  return (await stripe('POST', '/prices', {
    product, currency: 'brl', unit_amount: String(amount), lookup_key: lookupKey,
    'recurring[interval]': interval, 'recurring[interval_count]': String(count),
  })).id
}

const plan = await ensureProduct('Addegas', 'addegas_plan')
const addon = await ensureProduct('Addegas · Loja adicional', 'addegas_extra_store')
const extraIds = []
for (const row of sql(`select cycle || ':' || price from platform.plan_prices pp join platform.plans p on p.id = pp.plan_id where p.code = 'addegas'`).split('\n')) {
  const [cycle, amount] = row.split(':')
  const id = await ensurePrice(plan, `addegas_${cycle}`, amount, cycle)
  sql(`update platform.plan_prices set stripe_price_id = '${id}' where cycle = '${cycle}' and plan_id = (select id from platform.plans where code = 'addegas')`)
  console.log(`plano ${cycle}: ${id}`)
}
for (const row of sql(`select cycle || ':' || price from platform.addon_prices ap join platform.addons a on a.id = ap.addon_id where a.code = 'extra_store'`).split('\n')) {
  const [cycle, amount] = row.split(':')
  const id = await ensurePrice(addon, `addegas_extra_store_${cycle}`, amount, cycle)
  sql(`update platform.addon_prices set stripe_price_id = '${id}' where cycle = '${cycle}' and addon_id = (select id from platform.addons where code = 'extra_store')`)
  extraIds.push(id)
  console.log(`loja adicional ${cycle}: ${id}`)
}
console.log(`\nDefina nas funções: STRIPE_EXTRA_STORE_PRICE_IDS=${extraIds.join(',')}`)
