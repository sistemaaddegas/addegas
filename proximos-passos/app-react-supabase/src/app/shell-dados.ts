import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { brlc } from '@/lib/format'
import { canal } from '@/components/canal'
import { ha, minutos } from '@/lib/visual'
import type { IconName } from '@/components/icon'

type Permissoes = { role: string; permissions: string[]; max_discount_pct: number | null }

/** O que a pessoa pode fazer na loja atual (E12). O dono pode tudo. */
export function usePermissoes() {
  const { storeId, terminal } = useAuth()
  return useQuery({
    queryKey: ['permissoes', storeId],
    enabled: !!storeId && !terminal,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await rpc<Permissoes>('my_permissions', { p_store_id: storeId })
      return { ...r, pode: (p?: string) => !p || r.role === 'owner' || r.permissions.includes(p) }
    },
  })
}

/** Nome, telefone e foto de quem está logado (Meu perfil). */
export function usePerfil() {
  const { session } = useAuth()
  const id = session?.user.id
  return useQuery({
    queryKey: ['perfil', id],
    enabled: !!id && session?.user.app_metadata?.kind !== 'terminal',
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('full_name, phone, avatar').eq('id', id!).maybeSingle()
      if (error) throw new Error(error.message)
      return { nome: data?.full_name ?? '', telefone: data?.phone ?? '', avatar: data?.avatar ?? null, email: session?.user.email ?? '' }
    },
  })
}

/** Caixa aberto na loja (pílula do cabeçalho). */
export function useCaixaAberto() {
  const { storeId } = useAuth()
  return useQuery({
    queryKey: ['caixa-aberto', storeId],
    enabled: !!storeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('cash_sessions').select('opened_at, opened_by')
        .eq('store_id', storeId!).eq('status', 'open').order('opened_at').limit(1)
      if (error) throw new Error(error.message)
      const c = data?.[0]
      if (!c) return null
      const { data: m } = await supabase.from('store_members').select('display_name').eq('id', c.opened_by).maybeSingle()
      return { por: m?.display_name ?? '', desde: c.opened_at }
    },
  })
}

export type Aviso = { key: string; icon: IconName; cor: 'bad' | 'warn'; title: string; sub: string; cta: string; to?: string; alertId?: string }

/**
 * "Precisa de atenção" do Início e o sino do cabeçalho (mesma lista do protótipo):
 * estoque baixo, lote vencendo, conta vencida, pedido esperando e os alertas do servidor ainda não lidos.
 * Também devolve os números dos selos do menu (pedidos novos, estoque baixo, contas vencidas).
 */
export function useAtencao() {
  const { storeId, terminal } = useAuth()
  return useQuery({
    queryKey: ['atencao', storeId],
    enabled: !!storeId && !terminal,
    refetchInterval: 60_000,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10)
      const em15 = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10)
      const [prods, lojaProd, estoque, lotes, contas, pedidos, alertas] = await Promise.all([
        supabase.from('products').select('id, name, min_stock').eq('active', true),
        supabase.from('store_products').select('product_id, min_stock, active').eq('store_id', storeId!),
        supabase.from('product_stock').select('product_id, quantity').eq('store_id', storeId!),
        supabase.from('stock_lots').select('product_id, code, remaining_qty, expires_on').eq('store_id', storeId!).gt('remaining_qty', 0).lte('expires_on', em15).order('expires_on'),
        supabase.from('bills').select('id, description, amount, due_on').eq('store_id', storeId!).is('paid_at', null).lt('due_on', hoje).order('due_on'),
        supabase.from('orders').select('id, number, channel, created_at').eq('store_id', storeId!).eq('status', 'new').order('created_at'),
        supabase.from('alerts').select('id, type, severity, message, created_at').eq('store_id', storeId!).is('read_at', null).order('created_at', { ascending: false }).limit(20),
      ])
      for (const r of [prods, lojaProd, estoque, lotes, contas, pedidos, alertas]) if (r.error) throw new Error(r.error.message)

      const sp = new Map((lojaProd.data ?? []).map((x) => [x.product_id, x]))
      const qtd = new Map((estoque.data ?? []).map((x) => [x.product_id, Number(x.quantity)]))
      const nome = new Map((prods.data ?? []).map((p) => [p.id, p.name]))
      const baixo = (prods.data ?? []).filter((p) => sp.get(p.id)?.active !== false)
        .map((p) => ({ ...p, min: Number(sp.get(p.id)?.min_stock ?? p.min_stock), stock: qtd.get(p.id) ?? 0 }))
        .filter((p) => p.min > 0 && p.stock < p.min).sort((a, b) => a.stock / a.min - b.stock / b.min)
      const meiaNoite = new Date(new Date().toDateString()).getTime()
      const dias = (d: string) => Math.round((new Date(d + 'T00:00:00').getTime() - meiaNoite) / 864e5)

      const itens: Aviso[] = [
        ...(alertas.data ?? []).map((a): Aviso => ({ key: `a${a.id}`, icon: a.severity === 'critical' ? 'alert' : 'bell', cor: a.severity === 'info' ? 'warn' : 'bad',
          title: a.message, sub: ha(a.created_at), cta: 'Ok', alertId: a.id })),
        ...baixo.map((p): Aviso => ({ key: `b${p.id}`, icon: 'alert', cor: 'bad', title: p.name, sub: `${p.stock} un · mínimo ${p.min}`, cta: 'Lançar entrada', to: '/estoque' })),
        ...(lotes.data ?? []).map((l, i): Aviso => {
          const d = dias(l.expires_on!)
          return { key: `l${i}${l.product_id}`, icon: 'cal', cor: 'warn', title: nome.get(l.product_id) ?? 'Produto',
            sub: `${Number(l.remaining_qty)} un ${d < 0 ? `venceram há ${-d} dias` : d === 0 ? 'vencem hoje' : `vencem em ${d} dias`}${l.code ? ` · lote ${l.code}` : ''}`, cta: 'Montar combo', to: '/combos' }
        }),
        ...(contas.data ?? []).map((b): Aviso => {
          const d = -dias(b.due_on)
          return { key: `c${b.id}`, icon: 'wallet', cor: 'bad', title: b.description, sub: `Venceu há ${d} ${d === 1 ? 'dia' : 'dias'} · ${brlc(b.amount)}`, cta: 'Ver contas', to: '/contas' }
        }),
        ...(pedidos.data ?? []).filter((o) => minutos(o.created_at) >= 5).map((o): Aviso => ({ key: `o${o.id}`, icon: 'clock', cor: 'warn',
          title: `Pedido #${o.number} aguardando`, sub: `${canal(o.channel).nome} · ${ha(o.created_at)}`, cta: 'Ver pedido', to: '/pedidos' })),
      ]
      return {
        itens,
        selos: { '/pedidos': pedidos.data?.length ?? 0, '/estoque': baixo.length, '/contas': contas.data?.length ?? 0 } as Record<string, number>,
      }
    },
  })
}
