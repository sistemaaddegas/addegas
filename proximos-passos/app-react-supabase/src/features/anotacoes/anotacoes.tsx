import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { BarraLista, SemResultado, norm, Paginacao, paginar, PG0, type Pg } from '@/components/filtros'

type Nota = { id: string; title: string; body: string | null; priority: 'alta' | 'media' | 'baixa'; done: boolean; created_at: string }

const PR = { alta: ['Alta', '#E5241B'], media: ['Média', '#E0A100'], baixa: ['Baixa', '#2E9E4F'] } as const
const PO = { alta: 0, media: 1, baixa: 2 }

/** O papel guarda um texto só; no banco, a primeira linha vira o título (app.notes.title é obrigatório). */
const texto = (n: Nota) => n.body ?? n.title
const separar = (t: string) => ({ title: (t.split('\n').find((l) => l.trim()) ?? 'Anotação').trim().slice(0, 120), body: t })

/** Borda rasgada à esquerda e furos do caderno, como no protótipo (semente pelo id). */
function papel(id: string, n: Nota): { wrap: CSSProperties; st: CSSProperties } {
  let seed = 0
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973
  const rnd = () => { seed = (seed * 7919 + 17) % 9973; return seed / 9973 }
  const pts: string[] = []
  for (let y = 0; y <= 100; y += 2) pts.push(`${(1 + rnd() * 5).toFixed(1)}px ${y}%`)
  const mask = 'radial-gradient(circle at 16px 13px,transparent 4.5px,#000 5.2px)'
  return {
    wrap: { filter: 'drop-shadow(0 10px 14px rgba(0,0,0,.55)) drop-shadow(0 2px 3px rgba(0,0,0,.35))', opacity: n.done ? 0.7 : 1, borderTop: `4px solid ${PR[n.priority][1]}`, borderRadius: '0 2px 0 0' },
    st: {
      position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 220, padding: '22px 12px 10px 46px', backgroundColor: '#F4F1E8',
      backgroundImage: 'linear-gradient(90deg,transparent 38px,rgba(214,58,58,.55) 38px,rgba(214,58,58,.55) 39.5px,transparent 39.5px),repeating-linear-gradient(180deg,transparent 0,transparent 25px,rgba(52,96,176,.28) 25px,rgba(52,96,176,.28) 26px)',
      backgroundPosition: '0 0,0 21px', color: '#1A1A1A', borderRadius: '0 2px 2px 0', clipPath: `polygon(100% 0,${pts.join(',')},100% 100%)`,
      WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: '100% 26px', maskSize: '100% 26px',
    },
  }
}

export function Anotacoes() {
  const [q, setQ] = useState('')
  const [fPrio, setFPrio] = useState('todos')
  const [fSit, setFSit] = useState('todos')
  const [pgN, setPgN] = useState<Pg>(PG0)
  const { storeId } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const key = ['anotacoes', storeId]
  const { data, error, isLoading } = useQuery({
    queryKey: key,
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('notes').select('id, title, body, priority, done, created_at').eq('store_id', storeId!).order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Nota[]
    },
  })

  const mudar = async (id: string, patch: Partial<Nota>, msg?: string) => {
    qc.setQueryData<Nota[]>(key, (l) => l?.map((n) => (n.id === id ? { ...n, ...patch } : n)))
    const { error } = await supabase.from('notes').update(patch).eq('id', id)
    if (error) { toast('Não deu para salvar a anotação'); void qc.invalidateQueries({ queryKey: key }) } else if (msg) toast(msg)
  }
  const nova = async () => {
    const { error } = await supabase.from('notes').insert({ store_id: storeId!, title: 'Anotação', body: '', priority: 'media' })
    if (error) return toast(error.message.includes('row-level') ? 'Seu perfil não pode criar anotações' : 'Não deu para criar a anotação')
    await qc.invalidateQueries({ queryKey: key })
  }
  const apagar = async (id: string) => {
    qc.setQueryData<Nota[]>(key, (l) => l?.filter((n) => n.id !== id))
    const { error } = await supabase.from('notes').delete().eq('id', id)
    toast(error ? 'Não deu para apagar' : 'Anotação apagada')
  }

  if (isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !data) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar as anotações. {error?.message}</div>

  const qn = norm(q.trim())
  const notas = data.filter((n) => (!qn || norm(`${n.title} ${n.body ?? ''}`).includes(qn)) && (fPrio === 'todos' || n.priority === fPrio)
      && (fSit === 'todos' || (fSit === 'feitas') === n.done))
    .sort((a, b) => Number(a.done) - Number(b.done) || PO[a.priority] - PO[b.priority])
  const limpar = () => { setQ(''); setFPrio('todos'); setFSit('todos') }
  const pagN = paginar(notas, pgN, q + fPrio + fSit)
  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-[18px] max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-[1_1_260px] text-[15px] text-[#C4C4C9]">Recados rápidos da adega. Toque no papel para escrever.</div>
        <button onClick={nova} className="h-12 px-[18px] rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-[15px] font-extrabold flex items-center gap-2 cursor-pointer"><Icon name="plus" />Nova anotação</button>
      </div>
      <BarraLista busca={q} onBusca={setQ} placeholder="Buscar nas anotações" mostrando={notas.length} total={data.length} unidade={['anotação', 'anotações']} onLimpar={limpar}
        filtros={[
          { label: 'Prioridade', value: fPrio, onChange: setFPrio, options: [['todos', 'Todas'], ['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']] },
          { label: 'Situação', value: fSit, onChange: setFSit, options: [['todos', 'Todas'], ['abertas', 'A fazer'], ['feitas', 'Feitas']] },
        ]} />
      <div className="grid gap-x-[18px] gap-y-[22px] items-start pt-1.5 px-1 pb-5 grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))]">
        {pagN.itens.map((n) => <Papel key={n.id} n={n} onMudar={mudar} onApagar={apagar} />)}
      </div>
      <Paginacao p={pagN} onPg={setPgN} />
      {notas.length === 0 && <SemResultado filtrado={!!qn || fPrio !== 'todos' || fSit !== 'todos'} vazio="Nenhuma anotação. Crie a primeira." onLimpar={limpar} />}
    </div>
  )
}

function Papel({ n, onMudar, onApagar }: { n: Nota; onMudar: (id: string, p: Partial<Nota>, msg?: string) => void; onApagar: (id: string) => void }) {
  const [t, setT] = useState(texto(n))
  const salvo = useRef(texto(n))
  useEffect(() => {
    if (t === salvo.current) return
    const h = setTimeout(() => { salvo.current = t; onMudar(n.id, separar(t)) }, 800)
    return () => clearTimeout(h)
  }, [t, n.id, onMudar])
  const s = papel(n.id, n)
  const quando = new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={s.wrap}><div style={s.st}>
      <textarea value={t} onChange={(e) => setT(e.target.value)} onBlur={() => { if (t !== salvo.current) { salvo.current = t; onMudar(n.id, separar(t)) } }}
        placeholder="Escreva aqui…" rows={6} autoFocus={!t}
        style={{ flex: 1, minHeight: 156, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: n.done ? 'rgba(26,26,26,.45)' : '#1A1A1A', textDecoration: n.done ? 'line-through' : 'none', fontSize: 16, fontWeight: 600, lineHeight: '26px', padding: 0, marginTop: -3 }} />
      <div className="flex flex-wrap items-center gap-1 pt-2 px-1.5 pb-1 -mx-1.5 rounded-[2px_6px_2px_5px] relative" style={{ background: 'inherit', backgroundImage: 'none' }}>
        <span className="basis-full text-[11px] font-bold mb-0.5" style={{ color: 'rgba(0,0,0,.55)' }}>{quando}</span>
        {(Object.keys(PR) as (keyof typeof PR)[]).map((k) => {
          const [l, c] = PR[k], on = n.priority === k
          return (
            <button key={k} onClick={() => onMudar(n.id, { priority: k })} className="h-6 px-[7px] flex items-center gap-1 rounded-[2px_6px_2px_5px] text-[11px] font-extrabold cursor-pointer flex-none"
              style={{ border: on ? `1.5px solid ${c}` : '1px solid rgba(0,0,0,.18)', background: on ? `${c}22` : 'transparent', color: on ? '#1A1A1A' : 'rgba(0,0,0,.55)' }}>
              <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: c }} />{l}
            </button>
          )
        })}
        <span className="flex-1" />
        <button onClick={() => onMudar(n.id, { done: !n.done }, n.done ? 'Anotação reaberta' : 'Anotação concluída')} title={n.done ? 'Reabrir' : 'Concluir'}
          className="w-[26px] h-[26px] flex-none rounded-[2px_6px_2px_5px] flex items-center justify-center cursor-pointer p-0"
          style={{ border: n.done ? 'none' : '1.5px solid rgba(0,0,0,.35)', background: n.done ? '#2E9E4F' : 'transparent', color: n.done ? '#fff' : 'rgba(0,0,0,.6)' }}><Icon name="check" size={16} /></button>
        <button onClick={() => onApagar(n.id)} title="Apagar" className="w-[26px] h-[26px] flex-none rounded-[2px_6px_2px_5px] flex items-center justify-center cursor-pointer" style={{ background: 'rgba(0,0,0,.08)', color: 'rgba(0,0,0,.65)' }}><Icon name="x" size={16} /></button>
      </div>
    </div></div>
  )
}
