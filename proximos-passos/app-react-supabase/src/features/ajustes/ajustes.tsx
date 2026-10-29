import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { brlc, centavos, reais } from '@/lib/format'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { card } from '@/lib/visual'

type Ajustes = {
  block_negative_stock: boolean; cash_difference_alert: number; blind_cash_count: boolean
  delivery_fee_default: number; free_delivery_above: number | null
  pix_key: string | null; pix_receiver_name: string | null; pix_city: string | null
}
type Loja = { store_id: string; name: string; neighborhood: string | null; city: string | null; role: string }
type Assinatura = { status: string; access: string; price: number; trial_ends_at: string | null; current_period_end: string | null; stores_allowed: number }

const campo = 'h-12 px-3.5 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-[15px] w-full outline-none focus:border-brand'
const STATUS: Record<string, string> = { trialing: 'Teste grátis', active: 'Ativa', past_due: 'Pagamento pendente', canceled: 'Cancelada', suspended: 'Suspensa' }
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '')

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="w-[52px] h-[30px] rounded-full flex-none relative cursor-pointer" style={{ background: on ? '#FBC009' : '#2A2A2E' }}>
      <span className="absolute top-[3px] w-6 h-6 rounded-full transition-all" style={{ left: on ? 25 : 3, background: on ? '#0A0A0B' : '#ADADB4' }} />
    </button>
  )
}
function Linha({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3 border-t border-line">
      <div className="flex-1 min-w-0"><div className="text-[15px] font-bold">{titulo}</div>{sub && <div className="text-sm text-[#C4C4C9] mt-[3px]">{sub}</div>}</div>
      {children}
    </div>
  )
}
function Dado({ l, v }: { l: string; v: ReactNode }) {
  return <div className="flex justify-between gap-3 py-3 border-t border-line text-sm"><span className="text-[#C4C4C9]">{l}</span><span className="font-bold text-right">{v}</span></div>
}

export function AjustesTela() {
  const { storeId, signOut } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const { data: d, error, isLoading } = useQuery({
    queryKey: ['ajustes', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [aj, loja, lojas] = await Promise.all([
        supabase.from('store_settings').select('block_negative_stock, cash_difference_alert, blind_cash_count, delivery_fee_default, free_delivery_above, pix_key, pix_receiver_name, pix_city').eq('store_id', storeId!).single(),
        supabase.from('stores').select('name, slug, address, neighborhood, city, whatsapp, account_id').eq('id', storeId!).single(),
        rpc<Loja[]>('my_stores'),
      ])
      if (aj.error || loja.error) throw new Error((aj.error ?? loja.error)!.message)
      const assinatura = await rpc<Assinatura>('my_subscription', { p_account_id: loja.data.account_id }).catch(() => null)
      return { ajustes: aj.data as Ajustes, loja: loja.data, lojas, assinatura }
    },
  })

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !d) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar os ajustes. {error?.message}</div>

  const salvar = async (p: Partial<Record<keyof Ajustes, unknown>>, msg = 'Ajuste salvo') => {
    try {
      await rpc('update_store_settings', { p_store_id: storeId, p })
      toast(msg)
      await Promise.all(['ajustes', 'caixa'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    } catch (e) { toast((e as Error).message) }
  }
  const a = d.ajustes
  const endereco = [d.loja.address, d.loja.neighborhood, d.loja.city].filter(Boolean).join(' · ')

  return (
    <div className="p-4 tablet:p-8 grid gap-3 items-start max-w-[1400px] mx-auto w-full grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))]">
      <div className={`${card} p-5 border-brand`}>
        <div className="text-[17px] font-extrabold mb-2">Caixa e estoque</div>
        <Linha titulo="Contagem cega no fechamento" sub="Quem fecha não vê quanto deveria ter na gaveta">
          <Toggle on={a.blind_cash_count} onClick={() => salvar({ blind_cash_count: !a.blind_cash_count })} />
        </Linha>
        <Linha titulo="Bloquear venda sem estoque" sub="Desligado, o caixa vende e avisa">
          <Toggle on={a.block_negative_stock} onClick={() => salvar({ block_negative_stock: !a.block_negative_stock })} />
        </Linha>
        <CampoValor titulo="Avisar diferença no caixa acima de" valor={a.cash_difference_alert} onSalvar={(v) => salvar({ cash_difference_alert: v ?? 0 })} />
        <CampoValor titulo="Taxa de entrega padrão" valor={a.delivery_fee_default} onSalvar={(v) => salvar({ delivery_fee_default: v ?? 0 })} />
        <CampoValor titulo="Entrega grátis acima de" valor={a.free_delivery_above} vazio="Desligado" onSalvar={(v) => salvar({ free_delivery_above: v ?? '' })} />
      </div>

      <Pix a={a} onSalvar={(p) => salvar(p, 'Dados do Pix salvos')} />

      <div className={`${card} p-5`}>
        <div className="text-[17px] font-extrabold mb-2">Dados da loja</div>
        <Dado l="Nome" v={d.loja.name} />
        <Dado l="Endereço" v={endereco || '—'} />
        <Dado l="WhatsApp" v={d.loja.whatsapp || '—'} />
        <Dado l="Endereço do catálogo" v={d.loja.slug} />
      </div>

      <div className={`${card} p-5 gap-2.5`}>
        <div className="flex items-center justify-between">
          <div className="text-[17px] font-extrabold">Lojas</div>
          <button onClick={() => navigate('/lojas')} className="h-[38px] px-3 rounded-[2px_8px_3px_7px] border border-line-2 bg-surface-2 text-[13px] font-bold flex items-center gap-1.5 cursor-pointer">Trocar de loja</button>
        </div>
        {d.lojas.map((x) => (
          <div key={x.store_id} className="flex items-center gap-3 p-3 rounded-[3px_10px_2px_9px] border" style={{ borderColor: x.store_id === storeId ? '#FBC009' : '#2A2A2E', background: x.store_id === storeId ? 'rgba(251,192,9,.06)' : 'transparent' }}>
            <span className="w-10 h-10 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink font-black text-sm flex items-center justify-center flex-none">{x.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
            <span className="flex-1 min-w-0"><span className="block text-[15px] font-bold">{x.name}</span><span className="block text-sm text-[#C4C4C9] mt-[3px]">{[x.neighborhood, x.city].filter(Boolean).join(' · ') || '—'}</span></span>
            {x.store_id === storeId && <span className="text-brand"><Icon name="check" /></span>}
          </div>
        ))}
      </div>

      <div className={`${card} p-5`}>
        <div className="text-[17px] font-extrabold mb-2">Apps de delivery</div>
        {[['iFood', '#FF4B4B'], ['Zé Delivery', '#F5B800'], ['99Food', '#FF8A3D'], ['Keeta', '#3DD6C4']].map(([n, c]) => (
          <Linha key={n} titulo={n} sub="Integração em breve. Até lá, lance o pedido do app em Pedidos.">
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: c }} />
          </Linha>
        ))}
      </div>

      <div className={`${card} p-5`}>
        <div className="text-[17px] font-extrabold mb-2">Conta</div>
        {d.assinatura ? (
          <>
            <Dado l="Assinatura" v={STATUS[d.assinatura.status] ?? d.assinatura.status} />
            {d.assinatura.trial_ends_at && d.assinatura.status === 'trialing' && <Dado l="Teste grátis até" v={data(d.assinatura.trial_ends_at)} />}
            {d.assinatura.current_period_end && <Dado l="Renova em" v={data(d.assinatura.current_period_end)} />}
            <Dado l="Valor" v={brlc(d.assinatura.price)} />
            <Dado l="Lojas no plano" v={d.assinatura.stores_allowed} />
          </>
        ) : <Dado l="Assinatura" v="Só o dono vê" />}
        <button onClick={signOut} className="mt-2 h-[46px] rounded-[3px_10px_2px_9px] bg-[#E5241B] hover:bg-[#FF3B30] active:scale-[.97] text-white text-[15px] font-extrabold flex items-center justify-center gap-2 cursor-pointer"><Icon name="logout" />Sair da conta</button>
      </div>
    </div>
  )
}

function CampoValor({ titulo, valor, vazio = 'R$ 0,00', onSalvar }: { titulo: string; valor: number | null; vazio?: string; onSalvar: (v: number | null) => void }) {
  const [v, setV] = useState(reais(valor))
  const mudou = v !== reais(valor)
  return (
    <Linha titulo={titulo} sub={valor == null ? vazio : brlc(valor)}>
      <input value={v} onChange={(e) => setV(e.target.value.replace(/[^\d,]/g, ''))} inputMode="decimal" placeholder="0,00"
        className="w-24 h-10 px-2.5 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line-2 text-[15px] font-bold text-right outline-none focus:border-brand" />
      {mudou && <button onClick={() => onSalvar(v ? centavos(v) : null)} className="h-10 px-3 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-[13px] font-extrabold cursor-pointer">Salvar</button>}
    </Linha>
  )
}

function Pix({ a, onSalvar }: { a: Ajustes; onSalvar: (p: Partial<Record<keyof Ajustes, unknown>>) => void }) {
  const [f, setF] = useState({ key: a.pix_key ?? '', name: a.pix_receiver_name ?? '', city: a.pix_city ?? '' })
  return (
    <div className={`${card} p-5 gap-3`}>
      <div>
        <div className="text-[17px] font-extrabold">Pix no caixa</div>
        <div className="text-sm text-[#C4C4C9] mt-1.5 leading-[1.45]">O caixa mostra um QR com o valor da venda. Confira o pagamento no app do banco antes de concluir.</div>
      </div>
      <label className="flex flex-col gap-1.5"><span className="text-sm font-bold text-[#C4C4C9]">Chave Pix</span>
        <input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.trim() })} placeholder="CPF, CNPJ, e-mail, +55 telefone ou chave aleatória" className={campo} autoCapitalize="none" /></label>
      <div className="grid grid-cols-[1fr_140px] gap-2.5">
        <label className="flex flex-col gap-1.5 min-w-0"><span className="text-sm font-bold text-[#C4C4C9]">Nome de quem recebe</span>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.slice(0, 25) })} placeholder="Até 25 letras" className={`${campo} uppercase`} /></label>
        <label className="flex flex-col gap-1.5 min-w-0"><span className="text-sm font-bold text-[#C4C4C9]">Cidade</span>
          <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value.slice(0, 15) })} className={`${campo} uppercase`} /></label>
      </div>
      <button onClick={() => onSalvar({ pix_key: f.key, pix_receiver_name: f.name, pix_city: f.city })} className="h-12 rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold cursor-pointer">Salvar Pix</button>
    </div>
  )
}
