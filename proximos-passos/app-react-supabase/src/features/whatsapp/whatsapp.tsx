import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { brlc } from '@/lib/format'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { card } from '@/lib/visual'

// Tipos de private.alert_types (E31) que fazem sentido no WhatsApp do dono.
const ALERTAS = [
  ['cash_closed', 'Resumo do fechamento', 'Vendas por forma de pagamento quando o caixa fecha'],
  ['cash_difference', 'Diferença no caixa', 'Quando a gaveta fecha com falta ou sobra acima do limite'],
  ['stock_low', 'Estoque baixo', 'Produto abaixo do mínimo'],
  ['expiry_soon', 'Validade chegando', 'Lote perto de vencer'],
  ['order_late', 'Pedido atrasado', 'Pedido parado há muito tempo'],
  ['bill_due', 'Conta vencendo', 'Conta a pagar perto do vencimento'],
  ['cancellations', 'Cancelamentos acima do normal', 'Muitas vendas canceladas no dia'],
  ['discount_out_of_rule', 'Desconto fora da regra', 'Desconto acima do limite liberado por senha'],
] as const

const fone = (p: string) => { const d = p.replace(/^55/, ''); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : p }

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={on} className="w-[52px] h-[30px] rounded-full flex-none relative cursor-pointer" style={{ background: on ? '#FBC009' : '#2A2A2E' }}>
      <span className="absolute top-[3px] w-6 h-6 rounded-full transition-all" style={{ left: on ? 25 : 3, background: on ? '#0A0A0B' : '#ADADB4' }} />
    </button>
  )
}

export function WhatsApp() {
  const { storeId } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [fone1, setFone1] = useState('')
  const [codigo, setCodigo] = useState<{ phone: string; code: string } | null>(null)

  const { data: d, error, isLoading } = useQuery({
    queryKey: ['whatsapp', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const desde = new Date(Date.now() - 7 * 864e5).toISOString()
      const [cat, loja, pedidos, alertas, numeros] = await Promise.all([
        supabase.from('catalog_settings').select('enabled, show_price, show_stock, whatsapp_message').eq('store_id', storeId!).maybeSingle(),
        supabase.from('stores').select('name, slug').eq('id', storeId!).single(),
        supabase.from('orders').select('total, status').eq('store_id', storeId!).eq('channel', 'whatsapp').gte('created_at', desde),
        supabase.from('alert_settings').select('type, enabled').eq('store_id', storeId!),
        supabase.from('alert_recipients').select('phone, verified_at, opted_out_at').eq('store_id', storeId!),
      ])
      const validos = (pedidos.data ?? []).filter((o) => !['rejected', 'canceled'].includes(o.status))
      return {
        catalogo: cat.data ?? { enabled: false, show_price: true, show_stock: false, whatsapp_message: 'Olá! Quero fazer um pedido:' },
        loja: loja.data,
        semana: { n: validos.length, total: validos.reduce((a, o) => a + o.total, 0) },
        alertas: new Map((alertas.data ?? []).map((a) => [a.type, a.enabled])),
        numeros: numeros.data ?? [],
      }
    },
  })
  const recarregar = () => qc.invalidateQueries({ queryKey: ['whatsapp'] })
  const run = async (fn: () => Promise<string>) => { try { toast(await fn()); await recarregar() } catch (e) { toast((e as Error).message) } }

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !d) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar. {error?.message}</div>

  const link = `addegas.app/${d.loja?.slug ?? ''}`
  const ativos = d.numeros.filter((n) => n.verified_at && !n.opted_out_at)

  return (
    <div className="p-4 tablet:p-8 grid gap-3 items-start max-w-[1400px] mx-auto w-full grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))]">
      <div className={`${card} p-5 gap-4`}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-[17px] font-extrabold">Catálogo no WhatsApp</div>
            <div className="text-sm text-[#C4C4C9] mt-1.5 leading-[1.45]">O cliente abre o link, escolhe os produtos e o pedido entra em Pedidos com o canal WhatsApp.</div>
          </div>
          <Toggle on={d.catalogo.enabled} onClick={() => run(async () => {
            await rpc('update_catalog_settings', { p_store_id: storeId, p_enabled: !d.catalogo.enabled, p_show_price: d.catalogo.show_price, p_show_stock: d.catalogo.show_stock, p_message: d.catalogo.whatsapp_message })
            return d.catalogo.enabled ? 'Catálogo desligado' : 'Catálogo ligado'
          })} />
        </div>
        <div className="flex items-center gap-2.5 h-[52px] pl-4 pr-2 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2">
          <span className="flex-1 min-w-0 text-[15px] font-bold truncate">{link}</span>
          <button onClick={() => navigator.clipboard.writeText(`https://${link}`).then(() => toast('Link do catálogo copiado'), () => toast('Não deu para copiar'))}
            className="h-[38px] px-3 rounded-[2px_7px_3px_6px] bg-line-2 text-[13px] font-bold flex items-center gap-1.5 cursor-pointer"><Icon name="copy" size={16} />Copiar</button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-[3px_10px_2px_9px] bg-surface-2"><div className="text-[13px] text-[#C4C4C9] font-semibold">Pedidos na semana</div><div className="text-2xl font-extrabold mt-1.5 num">{d.semana.n}</div></div>
          <div className="p-3.5 rounded-[3px_10px_2px_9px] bg-surface-2"><div className="text-[13px] text-[#C4C4C9] font-semibold">Faturamento na semana</div><div className="text-2xl font-extrabold mt-1.5 num">{brlc(d.semana.total)}</div></div>
        </div>
      </div>

      <div className={`${card} p-5`}>
        <div className="text-[17px] font-extrabold">Alertas no WhatsApp do dono</div>
        <div className="text-sm text-[#C4C4C9] mt-1.5 mb-2">
          {ativos.length ? `Enviados para ${ativos.map((n) => fone(n.phone)).join(', ')}` : 'Cadastre um número para receber os alertas.'}
        </div>
        {!codigo ? (
          <div className="flex gap-2 mb-2">
            <input value={fone1} onChange={(e) => setFone1(e.target.value)} inputMode="tel" placeholder="(11) 90000-0000"
              className="flex-1 min-w-0 h-11 px-3 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line-2 text-[15px] outline-none focus:border-brand" />
            <button onClick={() => run(async () => {
              const r = await rpc<{ phone: string }>('add_alert_recipient', { p_store_id: storeId, p_phone: fone1 })
              setCodigo({ phone: r.phone, code: '' })
              return 'Mandamos um código de 6 dígitos nesse WhatsApp'
            })} className="h-11 px-3.5 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-sm font-extrabold cursor-pointer flex-none">Cadastrar</button>
          </div>
        ) : (
          <div className="flex gap-2 mb-2">
            <input value={codigo.code} onChange={(e) => setCodigo({ ...codigo, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" placeholder="Código de 6 dígitos" autoFocus
              className="flex-1 min-w-0 h-11 px-3 rounded-[2px_8px_3px_7px] bg-surface-2 border border-line-2 text-[15px] num tracking-[.2em] outline-none focus:border-brand" />
            <button onClick={() => run(async () => {
              await rpc('verify_alert_recipient', { p_store_id: storeId, p_phone: codigo.phone, p_code: codigo.code })
              setCodigo(null); setFone1('')
              return 'Número confirmado'
            })} className="h-11 px-3.5 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-sm font-extrabold cursor-pointer flex-none">Confirmar</button>
          </div>
        )}
        {ALERTAS.map(([tipo, l, desc]) => {
          const on = d.alertas.get(tipo) ?? true
          return (
            <div key={tipo} className="flex items-center gap-3 py-3 border-t border-line">
              <div className="flex-1 min-w-0"><div className="text-[15px] font-bold">{l}</div><div className="text-sm text-[#C4C4C9] mt-[3px]">{desc}</div></div>
              <Toggle on={on} onClick={() => run(async () => { await rpc('save_alert_setting', { p_store_id: storeId, p_type: tipo, p_enabled: !on }); return on ? `${l}: desligado` : `${l}: ligado` })} />
            </div>
          )
        })}
      </div>

      <div className={`${card} p-5 gap-3`}>
        <div className="text-[17px] font-extrabold">Exemplo de alerta</div>
        <div className="self-start max-w-[340px] py-3.5 px-4 rounded-[4px_16px_16px_16px] bg-[#1F2A22] text-sm leading-[1.55] text-[#E8F5EA]">
          <b>Addegas · {d.loja?.name}</b><br />Caixa fechado por Bia às 02:14.<br />Vendas: R$ 2.847,50 em 64 vendas.<br />Pix R$ 1.310,40 · Cartão R$ 1.109,60 · Dinheiro R$ 427,50.<br />Diferença na gaveta: R$ 0,00.
          <div className="text-[11px] text-[#9FB8A4] text-right mt-1.5">02:14</div>
        </div>
      </div>
    </div>
  )
}
