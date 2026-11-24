import { useQuery } from '@tanstack/react-query'
import { rpc, supabase } from '@/lib/supabase'

function rows<T>(r: { data: T[] | null; error: { message: string } | null }): T[] {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

/** Linha de app.store_products_list: preço efetivo da loja e saldo; custo só vem para quem tem ver_lucro (D63). */
export type ProdutoLoja = {
  product_id: string; name: string; ean: string | null; unit: string; category_id: string | null
  price: number; store_price: number | null; default_price: number
  stock: number; min_stock: number; below_min: boolean; avg_cost: number | null; image_path: string | null
}
export type Lote = { id: string; product_id: string; code: string | null; expires_on: string; remaining_qty: number }
export type Categoria = { id: string; name: string; color: string | null }

export function useEstoque(storeId: string | null) {
  return useQuery({
    queryKey: ['estoque', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [produtos, lotes, categorias, loja] = await Promise.all([
        rpc<ProdutoLoja[]>('store_products_list', { p_store_id: storeId, p_only_active: true }),
        supabase.from('stock_lots').select('id, product_id, code, expires_on, remaining_qty').eq('store_id', storeId!)
          .gt('remaining_qty', 0).not('expires_on', 'is', null).order('expires_on'),
        supabase.from('categories').select('id, name, color').order('sort'),
        supabase.from('stores').select('account_id').eq('id', storeId!).single(),
      ])
      if (loja.error) throw new Error(loja.error.message)
      return {
        produtos: produtos.map((p) => ({ ...p, stock: Number(p.stock), min_stock: Number(p.min_stock) })),
        lotes: rows(lotes).map((l) => ({ ...l, remaining_qty: Number(l.remaining_qty) })) as Lote[],
        categorias: rows(categorias) as Categoria[],
        accountId: loja.data.account_id as string,
      }
    },
  })
}
