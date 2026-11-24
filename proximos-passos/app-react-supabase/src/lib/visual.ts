import type { CSSProperties } from 'react'

// Bordas irregulares e controles do protótipo (IRR / irr(i), chip, seg e dot do Addegas.dc.html).
export const IRR = ['2px 14px 3px 11px / 3px 9px 2px 12px', '12px 2px 13px 3px / 9px 3px 12px 2px', '3px 11px 2px 14px / 12px 2px 9px 3px', '13px 3px 11px 2px / 2px 12px 3px 9px']
export const irr = (i: number) => IRR[((i % 4) + 4) % 4]

/** Filtro em pílula (chip): amarelo quando ativo, levemente torto. Use com a classe `chipCls`. */
export const chip = (on: boolean, i = 0): CSSProperties => ({
  borderRadius: irr(i), transform: on ? (i % 2 ? 'rotate(-.5deg)' : 'rotate(.4deg)') : 'none',
  border: `1px solid ${on ? '#FBC009' : '#2A2A2E'}`, background: on ? '#FBC009' : '#141416', color: on ? '#0A0A0B' : '#F5F5F2',
})
export const chipCls = 'h-10 px-4 text-sm font-bold cursor-pointer whitespace-nowrap flex-none flex items-center gap-2'

/** Aba de controle segmentado (seg): cinza quando ativa. Use dentro de `segBar` com a classe `segCls`. */
export const seg = (on: boolean, i = 0): CSSProperties => ({ borderRadius: irr(i + 1), background: on ? '#2A2A2E' : 'transparent', color: on ? '#F5F5F2' : '#ADADB4' })
export const segCls = 'flex-[1_0_auto] h-10 px-3.5 text-sm font-bold cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap'
export const segBar = 'flex gap-1 p-1 rounded-[3px_10px_2px_9px] bg-surface border border-line overflow-x-auto no-scrollbar self-start max-w-full'

export const dot = (c: string): CSSProperties => ({ width: 8, height: 8, borderRadius: 99, background: c, flex: 'none' })

export const card = 'rounded-[4px_13px_5px_11px] bg-surface border border-line flex flex-col min-w-0'
export const pillCls = 'inline-flex items-center h-[26px] px-2.5 rounded-full text-xs font-extrabold whitespace-nowrap flex-none'
export const pill = (c: string, bg: string): CSSProperties => ({ color: c, background: bg })

export const minutos = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
export const ha = (iso: string) => { const m = minutos(iso); return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} d` }
export const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const qtd = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }))
