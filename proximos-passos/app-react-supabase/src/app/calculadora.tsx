import { useState } from 'react'
import { Icon } from '@/components/icon'
import { irr } from '@/lib/visual'

type Estado = { v: string; acc: number | null; op: string | null; fresh: boolean }
const INICIO: Estado = { v: '0', acc: null, op: null, fresh: true }
const OP: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }
const fmt = (n: number) => (isFinite(n) ? String(Math.round(n * 1e8) / 1e8).replace('.', ',') : 'Erro')
const conta = (a: number, b: number, op: string) => (op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? (b === 0 ? NaN : a / b) : b)

function apertar(c: Estado, k: string): Estado {
  const cur = parseFloat(c.v.replace(',', '.')) || 0
  if (/^\d$/.test(k)) return { ...c, v: c.fresh || c.v === '0' || c.v === 'Erro' ? k : c.v.length < 12 ? c.v + k : c.v, fresh: false }
  if (k === ',') return c.fresh || c.v === 'Erro' ? { ...c, v: '0,', fresh: false } : c.v.includes(',') ? c : { ...c, v: c.v + ',' }
  if (k === 'C') return INICIO
  if (k === '⌫') return c.fresh || c.v === 'Erro' ? c : { ...c, v: c.v.length > 1 ? c.v.slice(0, -1) : '0' }
  if (k === '%') return { ...c, v: fmt(c.acc != null && c.op ? (c.acc * cur) / 100 : cur / 100), fresh: true }
  if (k === '=') return c.op != null ? { v: fmt(conta(c.acc!, cur, c.op)), acc: null, op: null, fresh: true } : c
  const acc = c.op != null && !c.fresh ? conta(c.acc!, cur, c.op) : c.acc != null && c.fresh ? c.acc : cur
  return { v: fmt(acc), acc, op: k, fresh: true }
}

const TECLAS: [string, 'fn' | 'op' | 'n', boolean?][] = [
  ['C', 'fn'], ['⌫', 'fn'], ['%', 'fn'], ['÷', 'op'], ['7', 'n'], ['8', 'n'], ['9', 'n'], ['×', 'op'], ['4', 'n'], ['5', 'n'], ['6', 'n'], ['−', 'op'],
  ['1', 'n'], ['2', 'n'], ['3', 'n'], ['+', 'op'], ['0', 'n', true], [',', 'n'], ['=', 'op'],
]
const tecla = (l: string) => (l === '×' ? '*' : l === '÷' ? '/' : l === '−' ? '-' : l)

/** Calculadora do menu lateral (computador), como no protótipo. */
export function Calculadora() {
  const [c, setC] = useState(INICIO)
  const [aberta, setAberta] = useState(true)
  return (
    <div className="flex-none flex flex-col gap-1.5 p-2 rounded-[3px_10px_2px_9px] border border-[rgba(251,192,9,.28)] shadow-[inset_0_1px_0_rgba(251,192,9,.12)]"
      style={{ background: 'linear-gradient(180deg,rgba(251,192,9,.07),rgba(251,192,9,.02) 60%),#0E0E10' }}>
      <button onClick={() => setAberta(!aberta)} className="flex items-center gap-2 h-[26px] px-0.5 text-[12.5px] font-extrabold uppercase tracking-[.08em] text-left cursor-pointer hover:text-brand">
        <span className="w-[22px] h-[22px] flex-none rounded-[2px_6px_2px_5px] bg-brand text-brand-ink flex items-center justify-center"><Icon name="calc" size={14} /></span>
        <span className="flex-1">Calculadora</span>
        <span className="num normal-case tracking-normal font-semibold">{c.acc != null && c.op ? `${fmt(c.acc)} ${OP[c.op]}` : ''}</span>
        <span className="flex transition-transform" style={{ transform: aberta ? 'none' : 'rotate(-90deg)' }}><Icon name="chevDown" size={16} /></span>
      </button>
      {aberta && (
        <>
          <div className="h-[clamp(28px,4.2vh,44px)] px-3 rounded-[2px_7px_3px_6px] bg-black flex items-center justify-end text-2xl font-extrabold num overflow-hidden whitespace-nowrap">{c.v}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {TECLAS.map(([l, kind, dupla]) => {
              const ativa = kind === 'op' && c.op === tecla(l) && c.fresh
              return (
                <button key={l} onClick={() => setC((s) => apertar(s, tecla(l)))}
                  className="h-[clamp(22px,3.3vh,36px)] text-[17px] font-extrabold cursor-pointer select-none transition hover:brightness-125 active:scale-90 touch-manipulation"
                  style={{ gridColumn: dupla ? 'span 2' : undefined, borderRadius: irr(l.charCodeAt(0)), background: kind === 'op' ? (ativa ? '#FFE07A' : '#FBC009') : kind === 'fn' ? '#2A2A2E' : '#1C1C1F', color: kind === 'op' ? '#0A0A0B' : '#F5F5F2' }}>{l}</button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
