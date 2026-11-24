import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc } from '@/lib/supabase'
import { brlc } from '@/lib/format'
import { canal } from '@/components/canal'
import { BarraLista, SemResultado, norm, Paginacao, paginar, PG0, type Pg } from '@/components/filtros'
import { card, qtd, seg, segBar, segCls } from '@/lib/visual'

type Relatorio = {
  totals: { revenue: number; count: number; avg_ticket: number; discounts: number; canceled_count: number; contingency_count: number }
  by_channel: Record<string, number>
  by_method: Record<string, number>
  top_products: { name: string; quantity: number; revenue: number; margin: number | null }[]
  gross_margin: number | null
  cash_closings: { closed_at: string; expected: number; counted: number; difference: number; terminal: string; operator: string | null }[]
}

const PERIODOS = [['hoje', 'Hoje', 0], ['7d', '7 dias', 6], ['30d', '30 dias', 29]] as const
const FORMAS = [['pix', 'Pix'], ['credit', 'Crédito'], ['debit', 'Débito'], ['cash', 'Dinheiro'], ['fiado', 'Fiado']] as const
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Barras({ titulo, linhas }: { titulo: string; linhas: { label: string; valor: number; cor?: string }[] }) {
  const total = linhas.reduce((a, l) => a + l.valor, 0) || 1
  const max = Math.max(...linhas.map((l) => l.valor), 1)
  return (
    <div className={`${card} p-5 gap-3.5`}>
      <div className="text-[17px] font-extrabold">{titulo}</div>
      {linhas.map((b) => (
        <div key={b.label} className="flex flex-col gap-[7px]">
          <div className="flex gap-2.5 text-sm">
            <span className="flex-1 font-semibold">{b.label}</span>
            <span className="text-[#C4C4C9] num">{Math.round((b.valor / total) * 100)}%</span>
            <span className="w-[110px] text-right font-extrabold num">{brlc(b.valor)}</span>
          </div>
          <div className="h-2 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${b.valor ? Math.max(2, (b.valor / max) * 100) : 0}%`, background: b.cor ?? '#FBC009' }} /></div>
        </div>
      ))}
      {linhas.length === 0 && <div className="text-sm text-[#C4C4C9]">Sem vendas no período.</div>}
    </div>
  )
}

export function Relatorios() {
  const { storeId } = useAuth()
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number][0]>('hoje')
  const [qP, setQP] = useState('')
  const [fOp, setFOp] = useState('todos')
  const [fDif, setFDif] = useState('todos')
  const [pgF, setPgF] = useState<Pg>(PG0)
  const dias = PERIODOS.find((p) => p[0] === periodo)![2]
  const ate = new Date(), de = new Date(); de.setDate(de.getDate() - dias)

  const { data: r, error, isLoading } = useQuery({
    queryKey: ['relatorios', storeId, periodo, iso(ate)],
    enabled: !!storeId,
    queryFn: () => rpc<Relatorio>('report_sales', { p_store_id: storeId, p_from: iso(de), p_to: iso(ate) }),
  })

  const kpis = r ? [
    ['Faturamento', brlc(r.totals.revenue)],
    ['Vendas', String(r.totals.count)],
    ['Ticket médio', brlc(r.totals.avg_ticket)],
    ...(r.gross_margin != null ? [['Lucro bruto', brlc(r.gross_margin)]] : []),
  ] : []
  const canais = r ? Object.entries(r.by_channel).sort((a, b) => b[1] - a[1])
    .map(([ch, v]) => ({ label: ch === 'counter' ? 'Balcão' : canal(ch).nome, valor: v, cor: ch === 'counter' ? '#F5F5F2' : canal(ch).cor })) : []
  const formas = r ? FORMAS.map(([k, l]) => ({ label: l, valor: r.by_method[k] ?? 0 })) : []
  // Mais vendidos e fechamentos: busca, filtros e contagem, como toda lista do sistema.
  const top = r ? r.top_products.filter((t) => !qP.trim() || norm(t.name).includes(norm(qP.trim()))) : []
  const operadores = r ? [...new Set(r.cash_closings.map((c) => c.operator).filter(Boolean))] as string[] : []
  const fechamentos = r ? [...r.cash_closings].reverse().filter((c) => (fOp === 'todos' || c.operator === fOp)
    && (fDif === 'todos' || (fDif === 'ok' ? c.difference === 0 : fDif === 'faltou' ? c.difference < 0 : c.difference > 0))) : []
  const limparF = () => { setFOp('todos'); setFDif('todos') }
  const pagF = paginar(fechamentos, pgF, fOp + fDif + periodo)

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[1400px] mx-auto w-full">
      <div className={segBar}>
        {PERIODOS.map(([id, l], k) => <button key={id} onClick={() => setPeriodo(id)} className={segCls} style={seg(periodo === id, k)}>{l}</button>)}
      </div>

      {isLoading && <div className="text-[#C4C4C9]">Carregando…</div>}
      {error && <div className="text-bad">Não deu para carregar o relatório. {error.message}</div>}

      {r && (
        <>
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))]">
            {kpis.map(([l, v]) => (
              <div key={l} className="p-[18px] rounded-[4px_13px_5px_11px] bg-surface border border-line min-w-0">
                <div className="text-sm text-[#C4C4C9] font-semibold mb-2.5">{l}</div>
                <div className="text-[clamp(22px,2.3vw,30px)] font-extrabold num whitespace-nowrap" style={{ fontStretch: '100%' }}>{v}</div>
              </div>
            ))}
          </div>
          {(r.totals.discounts > 0 || r.totals.canceled_count > 0 || r.totals.contingency_count > 0) && (
            <div className="text-sm text-[#C4C4C9] -mt-1">
              {[r.totals.discounts > 0 && `Descontos dados: ${brlc(r.totals.discounts)}`,
                r.totals.canceled_count > 0 && `${r.totals.canceled_count} ${r.totals.canceled_count === 1 ? 'venda cancelada' : 'vendas canceladas'}`,
                // D14: anotadas no aparelho sem internet e lançadas depois; o gerente confere com a gaveta e o extrato.
                r.totals.contingency_count > 0 && `${r.totals.contingency_count} ${r.totals.contingency_count === 1 ? 'venda feita' : 'vendas feitas'} sem internet (conferir)`,
              ].filter(Boolean).join(' · ')}
            </div>
          )}

          <div className="grid gap-3 items-start grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))]">
            <Barras titulo="Por forma de pagamento" linhas={formas} />
            <Barras titulo="Por canal" linhas={canais} />

            <div className={`${card} p-5`}>
              <div className="text-[17px] font-extrabold mb-2.5">Mais vendidos</div>
              <div className="mb-2"><BarraLista busca={qP} onBusca={setQP} placeholder="Buscar produto" mostrando={Math.min(top.length, 10)} total={r.top_products.length} unidade={['produto', 'produtos']} onLimpar={() => setQP('')} /></div>
              {top.slice(0, 10).map((t, i) => (
                <div key={t.name} className="flex items-center gap-3 py-3 border-t border-line text-sm">
                  <span className="w-4 text-[#ADADB4] font-extrabold">{i + 1}</span>
                  <span className="flex-1 min-w-0 font-semibold truncate">{t.name}</span>
                  <span className="text-[#C4C4C9] num">{qtd(Number(t.quantity))} un</span>
                  <span className="w-[110px] text-right font-extrabold num">{brlc(t.revenue)}</span>
                </div>
              ))}
              {top.length === 0 && <SemResultado filtrado={!!qP.trim()} vazio="Sem vendas no período." onLimpar={() => setQP('')} />}
            </div>

            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[17px] font-extrabold">Fechamentos de caixa</div>
                <button onClick={() => navigate('/caixa')} className="h-9 px-3 rounded-[2px_7px_3px_6px] border border-line-2 bg-surface-2 text-[13px] font-bold cursor-pointer">Ir para o caixa</button>
              </div>
              <div className="mb-2"><BarraLista mostrando={fechamentos.length} total={r.cash_closings.length} unidade={['fechamento', 'fechamentos']} onLimpar={limparF}
                filtros={[
                  { label: 'Operador', value: fOp, onChange: setFOp, options: [['todos', 'Todos'], ...operadores.map((o) => [o, o] as [string, string])] },
                  { label: 'Conferência', value: fDif, onChange: setFDif, options: [['todos', 'Todas'], ['ok', 'Sem diferença'], ['faltou', 'Faltou dinheiro'], ['sobrou', 'Sobrou dinheiro']] },
                ]} /></div>
              {pagF.itens.map((c) => (
                <div key={c.closed_at} className="flex items-center gap-3 py-3 border-t border-line text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{new Date(c.closed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-[#C4C4C9] mt-[3px]">{c.operator ? `Operador: ${c.operator} · ` : ''}{c.terminal}</div>
                  </div>
                  <div className="flex flex-col items-end gap-[3px]">
                    <span className="font-extrabold num">{brlc(c.counted)}</span>
                    <span className="text-[13px] font-extrabold text-right" style={{ color: c.difference === 0 ? '#4ADE80' : '#FF6B5E' }}>
                      {c.difference === 0 ? 'Sem diferença' : `${c.difference > 0 ? 'Sobrou' : 'Faltou'} ${brlc(Math.abs(c.difference))}`}
                    </span>
                  </div>
                </div>
              ))}
              <Paginacao p={pagF} onPg={setPgF} />
              {fechamentos.length === 0 && <SemResultado filtrado={fOp !== 'todos' || fDif !== 'todos'} vazio="Nenhum caixa fechado no período." onLimpar={limparF} />}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
