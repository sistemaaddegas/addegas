import { useQuery } from '@tanstack/react-query'
import { rpc, supabase } from '@/lib/supabase'

export type Fiado = {
  fiado_account_id: string; name: string; phone: string | null; balance: number
  credit_limit: number | null; promised_date: string | null; note: string | null; last_purchase: string | null
}
export type Lancamento = { id: string; type: string; amount: number; method: string | null; note: string | null; created_at: string; sale_id: string | null }

export function useFiados(storeId: string | null) {
  return useQuery({
    queryKey: ['clientes', storeId],
    enabled: !!storeId,
    queryFn: () => rpc<Fiado[]>('fiado_accounts_list', { p_store_id: storeId }),
  })
}

/** Caderneta: lançamentos do livro-razão do fiado, do mais novo para o mais antigo. */
export function useCaderneta(storeId: string | null, fiadoId: string | null) {
  return useQuery({
    queryKey: ['clientes', storeId, 'caderneta', fiadoId],
    enabled: !!storeId && !!fiadoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('fiado_ledger').select('id, type, amount, method, note, created_at, sale_id')
        .eq('store_id', storeId!).eq('fiado_account_id', fiadoId!).order('created_at', { ascending: false }).limit(60)
      if (error) throw new Error(error.message)
      return (data ?? []) as Lancamento[]
    },
  })
}
