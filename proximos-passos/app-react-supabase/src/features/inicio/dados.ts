import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { rpc, supabase } from '@/lib/supabase'

type Dashboard = {
  business_date: string; sales_total: number; sales_count: number; avg_ticket: number
  open_cash_sessions: number; open_tabs: number; below_min_stock: number; unread_alerts: number
}

export type Pedido = {
  id: string; number: number; channel: string; customer_name: string | null; total: number
  status: string; created_at: string; courier: string | null
}

export type Item = { key: string; name: string; price: number; color: string | null; image: string | null }

/** Lê a resposta do PostgREST; a RLS já limita ao que a pessoa pode ver. */
function rows<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

const menosDias = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

async function carregar(storeId: string, userId: string) {
  const dash = await rpc<Dashboard>('dashboard_today', { p_store_id: storeId })
  const dia = dash.business_date
  const semanaPassada = menosDias(dia, 7)
  const agoraSemanaPassada = new Date(Date.now() - 7 * 864e5).toISOString()
  const hoje = new Date().toISOString().slice(0, 10)
  const em15 = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10)

  const [perfil, membros, caixa, pedidos, fiado, vendidos, semana, produtos, lojaProd, estoque, rapido, combos, lojaCombos, categorias, contas, lotes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId),
    supabase.from('store_members').select('id, display_name, user_id').eq('store_id', storeId),
    supabase.from('cash_sessions').select('opened_by, opened_at').eq('store_id', storeId).eq('status', 'open').order('opened_at'),
    supabase.from('orders').select('id, number, channel, customer_name, total, status, created_at, courier_member_id')
      .eq('store_id', storeId).not('status', 'in', '(completed,delivered,rejected,canceled)').order('created_at', { ascending: false }),
    supabase.from('fiado_accounts').select('balance').eq('store_id', storeId).gt('balance', 0),
    supabase.from('sale_items').select('product_id, bundle_id, name, quantity, sales!inner(business_date, status)')
      .eq('store_id', storeId).eq('sales.business_date', dia).eq('sales.status', 'paid'),
    supabase.from('sales').select('total').eq('store_id', storeId).eq('business_date', semanaPassada).eq('status', 'paid').lte('created_at', agoraSemanaPassada),
    supabase.from('products').select('id, name, price, min_stock, category_id, image_path').eq('active', true),
    supabase.from('store_products').select('product_id, price, min_stock, active').eq('store_id', storeId),
    supabase.from('product_stock').select('product_id, quantity').eq('store_id', storeId),
    supabase.from('quick_access').select('position, product_id, bundle_id, color').eq('store_id', storeId).order('position'),
    supabase.from('bundles').select('id, name, price, image_path').eq('active', true),
    supabase.from('store_bundles').select('bundle_id, price, active').eq('store_id', storeId),
    supabase.from('categories').select('id, color'),
    supabase.from('bills').select('id, description, amount, due_on').eq('store_id', storeId).is('paid_at', null).lt('due_on', hoje).order('due_on'),
    supabase.from('stock_lots').select('product_id, code, remaining_qty, expires_on').eq('store_id', storeId).gt('remaining_qty', 0).lte('expires_on', em15).order('expires_on'),
  ])

  const nomeMembro = new Map(rows(membros).map((m) => [m.id, m.display_name]))
  const corCat = new Map(rows(categorias).map((c) => [c.id, c.color]))
  const sp = new Map(rows(lojaProd).map((x) => [x.product_id, x]))
  const qtd = new Map(rows(estoque).map((x) => [x.product_id, Number(x.quantity)]))
  const sb = new Map(rows(lojaCombos).map((x) => [x.bundle_id, x]))

  const prods = new Map(rows(produtos).filter((p) => sp.get(p.id)?.active !== false).map((p) => [p.id, {
    key: p.id, name: p.name, price: sp.get(p.id)?.price ?? p.price, color: p.category_id ? corCat.get(p.category_id) ?? null : null,
    image: p.image_path, min: Number(sp.get(p.id)?.min_stock ?? p.min_stock), stock: qtd.get(p.id) ?? 0,
  }]))
  const bunds = new Map(rows(combos).filter((b) => sb.get(b.id)?.active !== false).map((b) => [b.id, {
    key: b.id, name: b.name, price: sb.get(b.id)?.price ?? b.price, color: null, image: b.image_path,
  }]))

  // Mais vendidos hoje: soma por produto ou combo.
  const soma = new Map<string, { name: string; qty: number; color: string | null }>()
  for (const i of rows(vendidos)) {
    const k = i.product_id ?? i.bundle_id ?? i.name
    const cur = soma.get(k) ?? { name: i.name, qty: 0, color: i.product_id ? prods.get(i.product_id)?.color ?? null : null }
    cur.qty += Number(i.quantity)
    soma.set(k, cur)
  }

  const meu = rows(membros).find((m) => m.user_id === userId)
  const caixas = rows(caixa)
  return {
    dash,
    nome: rows(perfil)[0]?.full_name || meu?.display_name || '',
    caixa: caixas[0] ? { por: nomeMembro.get(caixas[0].opened_by) ?? '', desde: caixas[0].opened_at } : null,
    pedidos: rows(pedidos).map<Pedido>((o) => ({ ...o, courier: o.courier_member_id ? nomeMembro.get(o.courier_member_id) ?? null : null })),
    fiado: { total: rows(fiado).reduce((a, f) => a + f.balance, 0), clientes: rows(fiado).length },
    semanaPassada: { dia: semanaPassada, total: rows(semana).reduce((a, s) => a + s.total, 0) },
    top: [...soma.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    rapido: rows(rapido).map((q) => {
      const it = q.product_id ? prods.get(q.product_id) : q.bundle_id ? bunds.get(q.bundle_id) : undefined
      return it ? { ...it, color: q.color ?? it.color } : null
    }).filter((x): x is Item => !!x),
    baixo: [...prods.values()].filter((p) => p.min > 0 && p.stock < p.min).sort((a, b) => a.stock / a.min - b.stock / b.min),
    lotes: rows(lotes).map((l) => ({ ...l, name: prods.get(l.product_id)?.name ?? 'Produto' })),
    contas: rows(contas),
  }
}

export type Inicio = Awaited<ReturnType<typeof carregar>>

/**
 * Início em tempo real (E25): vendas, caixa e comandas avisam pelo canal privado store:{id};
 * pedidos e o resto atualizam a cada 30 s.
 */
export function useInicio(storeId: string | null, userId: string | undefined) {
  const qc = useQueryClient()
  const key = ['inicio', storeId]

  useEffect(() => {
    if (!storeId) return
    let ch: ReturnType<typeof supabase.channel> | null = null
    let cancelado = false
    supabase.realtime.setAuth().then(() => {
      if (cancelado) return
      ch = supabase.channel(`store:${storeId}`, { config: { private: true } })
        .on('broadcast', { event: '*' }, () => qc.invalidateQueries({ queryKey: ['inicio', storeId] }))
        .subscribe()
    })
    return () => { cancelado = true; if (ch) supabase.removeChannel(ch) }
  }, [storeId, qc])

  return useQuery({
    queryKey: key,
    queryFn: () => carregar(storeId!, userId!),
    enabled: !!storeId && !!userId,
    refetchInterval: 30_000,
  })
}
