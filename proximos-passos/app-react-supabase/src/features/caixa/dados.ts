import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PixConfig } from '@/lib/pix'
import { mudarOperadorDoRetrato } from './retrato'

function rows<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

export type Produto = {
  key: string; kind: 'product' | 'bundle'; id: string; name: string; price: number
  catId: string | null; catName: string; color: string; image: string | null
  stock: number | null; min: number; ean: string | null
}
export type Categoria = { id: string; name: string; color: string }

/** Produtos e combos que este caixa vende, com o preço da loja (o servidor recalcula na venda). */
export function useCatalogo(storeId: string | null) {
  return useQuery({
    queryKey: ['caixa', 'catalogo', storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      const [produtos, lojaProd, estoque, categorias, combos, lojaCombos, ajustes, rapido] = await Promise.all([
        supabase.from('products').select('id, name, price, min_stock, category_id, image_path, ean').eq('active', true).order('name'),
        supabase.from('store_products').select('product_id, price, min_stock, active').eq('store_id', storeId!),
        supabase.from('product_stock').select('product_id, quantity').eq('store_id', storeId!),
        supabase.from('categories').select('id, name, color, sort').order('sort'),
        supabase.from('bundles').select('id, name, price, image_path').eq('active', true).order('name'),
        supabase.from('store_bundles').select('bundle_id, price, active').eq('store_id', storeId!),
        supabase.from('store_settings').select('pix_key, pix_receiver_name, pix_city, blind_cash_count').eq('store_id', storeId!),
        supabase.from('quick_access').select('product_id, bundle_id').eq('store_id', storeId!).order('position'),
      ])
      const cats = rows(categorias).map<Categoria>((c) => ({ id: c.id, name: c.name, color: c.color ?? '#FBC009' }))
      const cat = new Map(cats.map((c) => [c.id, c]))
      const sp = new Map(rows(lojaProd).map((x) => [x.product_id, x]))
      const qtd = new Map(rows(estoque).map((x) => [x.product_id, Number(x.quantity)]))
      const sb = new Map(rows(lojaCombos).map((x) => [x.bundle_id, x]))
      const itens: Produto[] = [
        ...rows(combos).filter((b) => sb.get(b.id)?.active !== false).map<Produto>((b) => ({
          key: 'b:' + b.id, kind: 'bundle', id: b.id, name: b.name, price: sb.get(b.id)?.price ?? b.price,
          catId: null, catName: 'Promo', color: '#FBC009', image: b.image_path, stock: null, min: 0, ean: null,
        })),
        ...rows(produtos).filter((p) => sp.get(p.id)?.active !== false).map<Produto>((p) => {
          const c = p.category_id ? cat.get(p.category_id) : undefined
          return {
            key: 'p:' + p.id, kind: 'product', id: p.id, name: p.name, price: sp.get(p.id)?.price ?? p.price,
            catId: p.category_id, catName: c?.name ?? '', color: c?.color ?? '#FBC009', image: p.image_path,
            stock: qtd.get(p.id) ?? 0, min: Number(sp.get(p.id)?.min_stock ?? p.min_stock), ean: p.ean,
          }
        }),
      ]
      const a = rows(ajustes)[0]
      const pix: PixConfig | null = a?.pix_key ? { key: a.pix_key, name: a.pix_receiver_name ?? '', city: a.pix_city ?? '' } : null
      // "Minha adega": o acesso rápido montado no Início, na ordem escolhida.
      const meus = rows(rapido).map((r) => (r.product_id ? 'p:' + r.product_id : 'b:' + r.bundle_id))
      return { itens, cats, pix, contagemCega: !!a?.blind_cash_count, meus }
    },
  })
}

/** Caixa aberto neste terminal e o dinheiro que deveria estar na gaveta (soma dos movimentos). */
export function useCaixaAberto(terminalId: string | undefined) {
  return useQuery({
    queryKey: ['caixa', 'sessao', terminalId],
    enabled: !!terminalId,
    queryFn: async () => {
      const cs = rows(await supabase.from('cash_sessions').select('id, opened_at, opening_float')
        .eq('terminal_id', terminalId!).eq('status', 'open').limit(1))[0]
      if (!cs) return null
      const [mov, vendas] = await Promise.all([
        supabase.from('cash_movements').select('type, amount').eq('cash_session_id', cs.id),
        supabase.from('sale_payments').select('method, amount, change_given, sales!inner(cash_session_id, status)')
          .eq('sales.cash_session_id', cs.id).eq('sales.status', 'paid'),
      ])
      const porForma: Record<string, number> = {}
      for (const p of rows(vendas)) porForma[p.method] = (porForma[p.method] ?? 0) + p.amount - p.change_given
      const movs = rows(mov)
      return {
        ...cs,
        esperado: movs.reduce((a, m) => a + m.amount, 0),
        retiradas: movs.filter((m) => ['withdrawal', 'courier_payment', 'sale_cancel_refund'].includes(m.type)).reduce((a, m) => a + m.amount, 0),
        reforcos: movs.filter((m) => ['reinforcement', 'fiado_payment_in'].includes(m.type)).reduce((a, m) => a + m.amount, 0),
        porForma,
        vendas: Object.values(porForma).reduce((a, v) => a + v, 0),
      }
    },
  })
}

export type Membro = { id: string; display_name: string; role: string }

export function useOperadores(storeId: string | null) {
  return useQuery({
    queryKey: ['caixa', 'operadores', storeId],
    enabled: !!storeId,
    queryFn: async () => rows(await supabase.from('store_members').select('id, display_name, role')
      .eq('store_id', storeId!).eq('active', true).neq('role', 'courier').order('display_name')) as Membro[],
  })
}

export type Operador = { sessionId: string; memberId: string; name: string; role: string }
const OP_KEY = 'addegas.operador'

/**
 * Quem está operando este caixa (E10). Fica no aparelho para sobreviver a um recarregamento;
 * o banco é quem diz se a sessão ainda vale (fechar o caixa e o tempo limite encerram).
 */
export function useOperador(terminalId: string | undefined) {
  const [op, setOp] = useState<Operador | null>(() => {
    try { return JSON.parse(localStorage.getItem(OP_KEY) ?? 'null') } catch { return null }
  })
  const salvar = useCallback((o: Operador | null) => {
    try { if (o) localStorage.setItem(OP_KEY, JSON.stringify(o)); else localStorage.removeItem(OP_KEY) } catch { /* sem armazenamento */ }
    mudarOperadorDoRetrato(o)
    setOp(o)
  }, [])

  useEffect(() => {
    if (!op || !terminalId) return
    supabase.from('operator_sessions').select('id').eq('id', op.sessionId).eq('terminal_id', terminalId)
      .is('ended_at', null).gt('expires_at', new Date().toISOString())
      .then(({ data, error }) => { if (!error && !data?.length) salvar(null) })
  }, [op, terminalId, salvar])

  return [op, salvar] as const
}
