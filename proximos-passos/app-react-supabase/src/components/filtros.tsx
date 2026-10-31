import type { ReactNode } from 'react'
import { Icon } from '@/components/icon'

/** Busca sem acento e sem caixa: "água" acha "Agua". */
export const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export type Filtro = { label: string; value: string; todos?: string; options: [string, string][]; onChange: (v: string) => void }

/**
 * Padrão de toda lista do sistema: busca, filtros, "Mostrando X de Y" e "Limpar filtros".
 * O filtro vale quando o valor é diferente de `todos` (padrão: 'todos').
 */
export function BarraLista({ busca, onBusca, placeholder = 'Buscar', filtros = [], mostrando, total, unidade = ['item', 'itens'], onLimpar, extra }: {
  busca?: string; onBusca?: (v: string) => void; placeholder?: string; filtros?: Filtro[]
  mostrando: number; total: number; unidade?: [string, string]; onLimpar?: () => void; extra?: ReactNode
}) {
  const ativo = !!busca?.trim() || filtros.some((f) => f.value !== (f.todos ?? 'todos'))
  const nome = (n: number) => (n === 1 ? unidade[0] : unidade[1])
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onBusca && (
        <div className="flex-[1_1_240px] min-w-0 max-w-[520px] flex items-center gap-2.5 h-12 px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line text-[#C4C4C9]">
          <Icon name="search" />
          <input value={busca ?? ''} onChange={(e) => onBusca(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            className="flex-1 min-w-0 h-full bg-transparent border-none text-[15px] text-ink outline-none" />
          {busca && <button onClick={() => onBusca('')} aria-label="Limpar busca" className="flex text-[#ADADB4] cursor-pointer"><Icon name="x" size={18} /></button>}
        </div>
      )}
      {filtros.map((f) => (
        <label key={f.label} className="flex items-center gap-1.5 h-12 pl-3.5 pr-1.5 rounded-[2px_8px_3px_7px] bg-surface border border-line text-[13px] text-[#C4C4C9]">
          <span className="whitespace-nowrap">{f.label}</span>
          <select value={f.value} onChange={(e) => f.onChange(e.target.value)}
            className="h-10 bg-transparent border-none outline-none text-[14px] font-bold text-ink cursor-pointer max-w-[200px]" style={{ colorScheme: 'dark' }}>
            {f.options.map(([v, l]) => <option key={v} value={v} className="bg-surface-2">{l}</option>)}
          </select>
        </label>
      ))}
      {extra}
      <span className="ml-auto flex items-center gap-3 text-[13.5px] text-[#C4C4C9] whitespace-nowrap">
        <span aria-live="polite" className="h-9 px-3 rounded-[2px_7px_3px_6px] bg-surface-2 border border-line-2 text-[14px] font-extrabold text-ink flex items-center">
          {mostrando === total ? `${total} ${nome(total)}` : `Mostrando ${mostrando} de ${total} ${nome(total)}`}</span>
        {ativo && onLimpar && <button onClick={onLimpar} className="text-brand font-bold cursor-pointer">Limpar filtros</button>}
      </span>
    </div>
  )
}

/** Lista vazia por causa dos filtros (diferente de "ainda não tem nada"). */
export function SemResultado({ filtrado, vazio, onLimpar }: { filtrado: boolean; vazio: string; onLimpar?: () => void }) {
  return (
    <div className="py-10 px-4 text-center text-[15px] text-[#C4C4C9] flex flex-col items-center gap-2">
      <span>{filtrado ? 'Nenhum resultado para essa busca e esses filtros.' : vazio}</span>
      {filtrado && onLimpar && <button onClick={onLimpar} className="h-10 px-4 rounded-[2px_8px_3px_7px] border border-line-2 text-sm font-bold cursor-pointer">Limpar filtros</button>}
    </div>
  )
}
