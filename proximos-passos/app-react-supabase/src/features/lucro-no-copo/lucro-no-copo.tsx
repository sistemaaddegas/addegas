import { useMemo, useState, type CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { rpc, supabase } from '@/lib/supabase'
import { brlc } from '@/lib/format'
import { Icon } from '@/components/icon'
import { Sheet } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { useEstoque } from '@/features/estoque/dados'
import { card, chip, chipCls, irr, qtd } from '@/lib/visual'

// Lugares do combo (categorias do protótipo, data/lucro-no-copo.js), ligados às categorias reais pelo nome.
const SLOTS = [
  { k: 'destilado', label: 'Destilado', unidade: 'ml', passo: 5, min: 10, max: 150, padrao: 50, cat: /destil/i, cor: '#C98A2E' },
  { k: 'energetico', label: 'Energético', unidade: 'ml', passo: 50, min: 0, max: 400, padrao: 200, cat: /energ/i, cor: '#E9C94A' },
  { k: 'gelo', label: 'Gelo de coco', unidade: 'un', passo: 1, min: 0, max: 3, padrao: 1, cat: /gelo/i, nome: /gelo/i, cor: '#F2F0EA' },
  { k: 'refrigerante', label: 'Refrigerante', unidade: 'ml', passo: 50, min: 0, max: 300, padrao: 100, cat: /sem [áa]lcool|refri/i, cor: '#7A3B1C' },
  { k: 'cerveja', label: 'Cerveja', unidade: 'un', passo: 1, min: 0, max: 6, padrao: 1, cat: /cerve/i, cor: '#E8B33A' },
] as const
type Faixa = { min: number; max: number; passo: number; padrao: number }
type SlotK = (typeof SLOTS)[number]['k']
type Item = { id: string; name: string; volume: number | null; custo: number | null; estoque: number; slot: SlotK }
type Escolha = Partial<Record<SlotK, { pid: string; q: number }>>
type Receita = { id: string; name: string; sale_price: number; color: string | null; drink_recipe_items: { product_id: string; amount: number; unit: string }[] }

const CAPACIDADE = 500 // ml do copo desenhado
// Cores de fundo dos drinks salvos (DC do protótipo): [fundo, nome, texto].
const CORES: [string, string, string][] = [['#FBC009', 'Amarelo', '#0A0A0B'], ['#FF2D55', 'Pink', '#FFFFFF'], ['#00B8FF', 'Azul', '#0A0A0B'], ['#1ED760', 'Verde', '#0A0A0B'], ['#9B5CFF', 'Roxo', '#FFFFFF'], ['#FF6A00', 'Laranja', '#0A0A0B']]
const tinta = (c: string) => CORES.find((x) => x[0] === c)?.[2] ?? '#0A0A0B'

export function LucroNoCopo() {
  const { storeId } = useAuth()
  const est = useEstoque(storeId)
  const qc = useQueryClient()
  const toast = useToast()
  const [esc, setEsc] = useState<Escolha>({})
  const [preco, setPreco] = useState(2500)
  const [receita, setReceita] = useState<string | null>(null)
  const [escolher, setEscolher] = useState<SlotK | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [corNova, setCorNova] = useState(CORES[0][0])
  // Preparo do copo: simulação visual (D09: Lucro no Copo é calculadora na v1; não baixa o estoque).
  const [servido, setServido] = useState<Partial<Record<SlotK, true>>>({})
  const [preparado, setPreparado] = useState(false)
  const [fb, setFb] = useState<{ nm: string; dl: string; fr: string; to: string }[] | null>(null)
  const novoCopo = () => { setServido({}); setPreparado(false); setFb(null) }

  const extra = useQuery({
    queryKey: ['lucro-no-copo', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const [prods, receitas] = await Promise.all([
        supabase.from('products').select('id, volume_ml').eq('active', true),
        supabase.from('drink_recipes').select('id, name, sale_price, color, drink_recipe_items(product_id, amount, unit)').eq('active', true).order('name'),
      ])
      if (prods.error) throw new Error(prods.error.message)
      return { volume: new Map((prods.data ?? []).map((p) => [p.id, p.volume_ml as number | null])), receitas: (receitas.data ?? []) as unknown as Receita[] }
    },
  })

  const itens = useMemo(() => {
    if (!est.data || !extra.data) return [] as Item[]
    const cat = new Map(est.data.categorias.map((c) => [c.id, c.name]))
    return est.data.produtos.flatMap((p) => {
      const c = cat.get(p.category_id ?? '') ?? ''
      const s = SLOTS.find((x) => x.cat.test(c) && (!('nome' in x) || x.nome.test(p.name)))
      return s ? [{ id: p.product_id, name: p.name, volume: extra.data.volume.get(p.product_id) ?? null, custo: p.avg_cost, estoque: p.stock, slot: s.k }] : []
    })
  }, [est.data, extra.data])

  if (est.isLoading || extra.isLoading) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (est.error || extra.error) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar. {(est.error ?? extra.error)?.message}</div>

  const porId = new Map(itens.map((i) => [i.id, i]))
  const verCusto = itens.some((i) => i.custo != null)
  const linhas = SLOTS.flatMap((s) => {
    const e = esc[s.k], it = e && porId.get(e.pid)
    if (!e || !it || e.q <= 0) return []
    const custo = s.unidade === 'ml' ? (it.volume ? ((it.custo ?? 0) / it.volume) * e.q : 0) : (it.custo ?? 0) * e.q
    const disponivel = s.unidade === 'ml' ? Math.max(0, it.estoque) * (it.volume ?? 0) : Math.max(0, it.estoque)
    return [{ s, it, q: e.q, custo, disponivel, copos: Math.floor(disponivel / e.q) }]
  })
  const custo = Math.round(linhas.reduce((a, l) => a + l.custo, 0))
  const lucro = preco - custo
  const margem = preco > 0 ? Math.round((lucro / preco) * 100) : 0
  const limitante = linhas.length ? linhas.reduce((a, l) => (l.copos < a.copos ? l : a)) : null
  const possiveis = limitante?.copos ?? 0
  const liquido = linhas.filter((l) => l.s.unidade === 'ml').reduce((a, l) => a + l.q, 0)
  const dest = linhas.find((l) => l.s.k === 'destilado')

  const escolherProduto = (k: SlotK, pid: string | null) => {
    const s: Faixa = SLOTS.find((x) => x.k === k)!
    setEsc((x) => { const n = { ...x }; if (pid) n[k] = { pid, q: x[k]?.q || s.padrao || s.passo }; else delete n[k]; return n })
    setReceita(null)
    setEscolher(null)
    novoCopo()
  }
  const mudarQ = (k: SlotK, d: number) => {
    const s: Faixa = SLOTS.find((x) => x.k === k)!
    setEsc((x) => (x[k] ? { ...x, [k]: { ...x[k]!, q: Math.min(s.max, Math.max(s.min || s.passo, x[k]!.q + d * s.passo)) } } : x))
    setReceita(null)
    novoCopo()
  }
  const abrir = (r: Receita) => {
    const n: Escolha = {}
    for (const i of r.drink_recipe_items) { const it = porId.get(i.product_id); if (it) n[it.slot] = { pid: it.id, q: Number(i.amount) } }
    setEsc(n); setPreco(r.sale_price); setReceita(r.id); novoCopo()
  }
  const salvar = async () => {
    if (!salvando?.trim()) return toast('Dê um título ao drink')
    if (!linhas.length) return toast('Escolha pelo menos um ingrediente')
    try {
      const r = await rpc<{ recipe_id: string }>('save_drink_recipe', { p_account_id: est.data!.accountId, p_recipe: {
        id: receita, name: salvando.trim(), sale_price: preco, ...(receita ? {} : { color: corNova }), items: linhas.map((l) => ({ product_id: l.it.id, amount: l.q, unit: l.s.unidade })),
      } })
      setReceita(r.recipe_id); setSalvando(null)
      toast(`“${salvando.trim()}” salvo`)
      await qc.invalidateQueries({ queryKey: ['lucro-no-copo'] })
    } catch (e) { toast((e as Error).message) }
  }
  const pintar = async (cor: string) => {
    try {
      await rpc('save_drink_recipe', { p_account_id: est.data!.accountId, p_recipe: { id: receita, color: cor } })
      await qc.invalidateQueries({ queryKey: ['lucro-no-copo'] })
    } catch (e) { toast((e as Error).message) }
  }
  const liquidos = linhas.filter((l) => l.s.unidade === 'ml')
  const gelo = linhas.find((l) => l.s.k === 'gelo')
  const servidoMl = liquidos.reduce((a, l) => a + (servido[l.s.k] ? l.q : 0), 0)
  const pronto = liquidos.length > 0 && liquidos.every((l) => servido[l.s.k]) && (!gelo || !!servido.gelo)
  const fmtEst = (l: (typeof linhas)[number], v: number) => (l.s.unidade === 'ml' ? `${qtd(v / 1000)} L` : `${qtd(v)} un`)
  const preparar = () => {
    if (preparado || !linhas.length) return
    const falta = linhas.find((l) => l.copos < 1)
    if (falta) return toast(`Estoque insuficiente: ${falta.s.label}`)
    setServido(Object.fromEntries(linhas.map((l) => [l.s.k, true])))
    setPreparado(true)
    setFb(linhas.map((l) => ({ nm: l.it.name, dl: `−${l.q} ${l.s.unidade}`, fr: fmtEst(l, l.disponivel), to: fmtEst(l, l.disponivel - l.q) })))
    toast(verCusto ? `Copo preparado · lucro de ${brlc(lucro)}` : 'Copo preparado')
  }
  const atual = extra.data?.receitas.find((r) => r.id === receita)

  const ctrl = 'w-[38px] h-[38px] rounded-[2px_8px_3px_7px] border border-line-2 bg-surface-2 flex items-center justify-center cursor-pointer flex-none active:scale-[.92]'
  let base = 0
  const camadas = linhas.filter((l) => l.s.unidade === 'ml').map((l) => {
    const h = servido[l.s.k] ? (l.q / CAPACIDADE) * 100 : 0, st: CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: `${base}%`, height: `${h}%`, background: `linear-gradient(180deg, ${l.s.cor}EE, ${l.s.cor}AA)`, transition: 'all .35s ease' }
    base += h
    return <div key={l.s.k} style={st} />
  })
  const cubos = servido.gelo ? esc.gelo?.q ?? 0 : 0

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-3 max-w-[1400px] mx-auto w-full">
      <div className={`${card} py-[18px] px-5 gap-3.5`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="flex-[1_1_220px]"><div className="text-[17px] font-extrabold">Monte o combo com o seu estoque</div><div className="text-sm text-[#C4C4C9] mt-1">Toque no card para trocar o produto.</div></div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">Preço de venda</span>
            <button onClick={() => setPreco((p) => Math.max(0, p - 100))} className={ctrl}><Icon name="minus" /></button>
            <span className="min-w-[92px] text-center text-lg font-extrabold num">{brlc(preco)}</span>
            <button onClick={() => setPreco((p) => p + 100)} className={ctrl}><Icon name="plus" /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em] mr-1">Drinks</span>
          {(extra.data?.receitas ?? []).map((r, k) => (
            <button key={r.id} onClick={() => abrir(r)} className={chipCls}
              style={r.color ? { ...chip(false, k), background: r.color, color: tinta(r.color), border: `2px solid ${receita === r.id ? '#F5F5F2' : r.color}`, transform: receita === r.id ? 'rotate(-1deg)' : 'none' } : chip(receita === r.id, k)}>{r.name}</button>
          ))}
          <button onClick={() => setSalvando(salvando === null ? (atual?.name ?? '') : null)} className="h-10 px-4 ml-auto rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-sm font-extrabold cursor-pointer flex items-center gap-1.5">{receita ? 'Salvar alterações' : <><Icon name="plus" size={16} />Salvar como drink</>}</button>
        </div>
        {salvando !== null && (
          <div className="flex flex-wrap gap-2 items-center p-3 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2">
            <input value={salvando} onChange={(e) => setSalvando(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && salvar()} placeholder="Título do drink · ex.: Combo da Casa" autoFocus
              className="flex-[1_1_220px] min-w-0 h-[46px] px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line-2 text-[15px] outline-none focus:border-brand" />
            {!receita && (
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-[#C4C4C9] mr-0.5">Cor</span>
                {CORES.map(([c, nome]) => <button key={c} onClick={() => setCorNova(c)} title={nome} className="w-7 h-7 rounded-[3px_8px_3px_7px] cursor-pointer flex-none" style={{ background: c, border: `2px solid ${corNova === c ? '#F5F5F2' : 'transparent'}`, boxShadow: corNova === c ? '0 0 0 2px #0A0A0B inset' : 'none' }} />)}
              </span>
            )}
            <button onClick={salvar} className="h-[46px] px-4 rounded-[3px_10px_2px_9px] bg-brand text-brand-ink text-sm font-extrabold cursor-pointer">Salvar drink</button>
          </div>
        )}
        {atual && salvando === null && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-bold text-[#C4C4C9] mr-0.5">Cor de fundo de “{atual.name}”</span>
            {CORES.map(([c, nome]) => <button key={c} onClick={() => pintar(c)} title={nome} className="w-[26px] h-[26px] rounded-[3px_8px_3px_7px] cursor-pointer flex-none" style={{ background: c, border: `2px solid ${atual.color === c ? '#F5F5F2' : 'transparent'}`, boxShadow: atual.color === c ? '0 0 0 2px #0A0A0B inset' : 'none' }} />)}
          </div>
        )}
        <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
          {SLOTS.map((s, i) => {
            const e = esc[s.k], it = e && porId.get(e.pid)
            return (
              <div key={s.k} className="flex flex-col gap-2 p-3 bg-surface-2 border border-line-2 min-h-[220px]" style={{ borderRadius: irr(i) }}>
                <div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">{s.label}</div>
                {it && e ? (
                  <>
                    <button onClick={() => setEscolher(s.k)} className="flex flex-col gap-2 text-left cursor-pointer active:scale-[.98]">
                      <div className="h-[86px] rounded-[3px_10px_4px_9px] flex items-center justify-center" style={{ background: `radial-gradient(120% 85% at 50% 100%,${s.cor}40,transparent 62%),#101012`, border: `1px solid ${s.cor}33` }}>
                        <img src="/icons/dd-amarelo.png" alt="" className="h-12 opacity-30" />
                      </div>
                      <span className="text-[15px] font-extrabold leading-[1.2]">{it.name}</span>
                      <span className="text-[13px] text-[#C4C4C9] -mt-1">{qtd(it.estoque)} un em estoque</span>
                    </button>
                    <div className="flex items-center gap-1.5 mt-auto">
                      <button onClick={() => mudarQ(s.k, -1)} className={ctrl}><Icon name="minus" /></button>
                      <span className="flex-1 text-center text-[15px] font-extrabold num">{e.q} {s.unidade}</span>
                      <button onClick={() => mudarQ(s.k, 1)} className={ctrl}><Icon name="plus" /></button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => setEscolher(s.k)} className="flex-1 flex flex-col items-center justify-center gap-2 rounded-[3px_10px_4px_9px] bg-[#101012] text-[#C4C4C9] hover:text-brand text-sm font-bold cursor-pointer"><Icon name="plus" size={26} />Adicionar</button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 items-start grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))]">
        <div className={`${card} p-5 gap-3.5`}>
          <div className="flex items-center justify-between gap-2.5">
            <div className="text-[17px] font-extrabold">Copo</div>
            {pronto && <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[2px_8px_3px_7px] bg-[rgba(74,222,128,.12)] text-ok text-[13px] font-extrabold"><Icon name="check" size={16} />Copo pronto</span>}
          </div>
          <div className="relative w-[176px] h-[236px] mx-auto mt-1.5 mb-1">
            <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0,100% 0,86% 100%,14% 100%)', background: 'linear-gradient(90deg,rgba(255,255,255,.30),rgba(255,255,255,.12) 28%,rgba(255,255,255,.08) 72%,rgba(255,255,255,.26))' }} />
            <div className="absolute left-1 right-1 top-0 bottom-1.5 overflow-hidden bg-[#0C0C0F]" style={{ clipPath: 'polygon(0 0,100% 0,86.4% 100%,13.6% 100%)' }}>
              {camadas}
              {Array.from({ length: cubos * 3 }).map((_, i) => (
                <div key={i} className="absolute w-[26px] h-[26px] rounded-[5px] border border-white/40" style={{ left: `${22 + ((i * 23) % 52)}%`, bottom: `${Math.min(base, 92) - 8 - Math.floor(i / 3) * 9}%`, background: 'rgba(255,255,255,.22)', transform: `rotate(${(i * 37) % 30 - 15}deg)`, transition: 'all .35s ease' }} />
              ))}
              <div className="absolute top-0 bottom-0 left-[16%] w-[7%] z-[7]" style={{ background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.14),rgba(255,255,255,0))' }} />
            </div>
            <div className="absolute left-[10%] right-[10%] -bottom-2.5 h-3.5 rounded-full" style={{ background: 'radial-gradient(closest-side,rgba(0,0,0,.8),rgba(0,0,0,0))' }} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-bold num"><span>{servidoMl} / {liquido} ml</span><span className="text-[#C4C4C9]">{liquido ? Math.round((servidoMl / liquido) * 100) : 0}%</span></div>
            <div className="h-2 rounded-full bg-line overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${liquido ? (servidoMl / liquido) * 100 : 0}%`, background: pronto ? '#4ADE80' : '#FBC009' }} /></div>
          </div>
          {linhas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...liquidos.map((l) => ({ k: l.s.k, label: `${l.q} ml ${l.it.name}` })), ...(gelo ? [{ k: gelo.s.k, label: `${gelo.q} gelo` }] : [])].map((x) => {
                const feito = !!servido[x.k]
                return (
                  <button key={x.k} onClick={() => !feito && !preparado && setServido((v) => ({ ...v, [x.k]: true }))}
                    className="flex-[1_1_120px] min-w-0 h-11 px-2.5 rounded-[2px_9px_3px_8px] border text-[13px] font-extrabold truncate"
                    style={feito ? { borderColor: 'rgba(74,222,128,.4)', background: 'rgba(74,222,128,.10)', color: '#4ADE80' } : { borderColor: '#2A2A2E', background: '#1C1C1F', color: preparado ? '#5A5A60' : '#F5F5F2', cursor: 'pointer' }}>
                    {feito ? '✓ ' : '+'}{x.label}
                  </button>
                )
              })}
            </div>
          )}
          <button onClick={preparado ? novoCopo : preparar} disabled={!linhas.length}
            className="w-full h-[60px] rounded-[3px_12px_4px_10px] text-[17px] font-extrabold flex items-center justify-center gap-2.5 cursor-pointer active:scale-[.98] disabled:opacity-50"
            style={preparado ? { border: '1px solid #2A2A2E', background: '#1C1C1F', color: '#F5F5F2' } : { background: '#FBC009', color: '#0A0A0B' }}>
            <Icon name={preparado ? 'plus' : 'glass'} />{preparado ? 'Novo copo' : 'Preparar copo'}
          </button>
          {fb && (
            <div className="flex flex-col gap-1.5">
              {fb.map((f) => (
                <div key={f.nm} className="py-2 px-3 rounded-[2px_8px_3px_7px] bg-surface-2">
                  <div className="flex justify-between gap-2 text-[13px] font-bold"><span className="truncate">{f.nm}</span><span className="text-[#FF6B5E] flex-none">{f.dl}</span></div>
                  <div className="text-xs text-[#ADADB4] mt-0.5 num">{f.fr} → {f.to}</div>
                </div>
              ))}
              <div className="text-xs text-[#ADADB4]">Simulação: o estoque só baixa quando o copo é vendido no caixa.</div>
            </div>
          )}
        </div>

        <div className={`${card} p-5 gap-3.5`}>
          <div className="text-[17px] font-extrabold">Resultado</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3.5 rounded-[2px_9px_3px_8px] bg-surface-2"><div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">Custo</div><div className="text-[22px] font-extrabold mt-1.5 num">{verCusto ? brlc(custo) : '—'}</div></div>
            <div className="p-3.5 rounded-[2px_9px_3px_8px] bg-surface-2"><div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">Venda</div><div className="text-[22px] font-extrabold mt-1.5 num">{brlc(preco)}</div></div>
          </div>
          <div className="p-4 rounded-[3px_11px_4px_10px] bg-[rgba(251,192,9,.06)] border border-[rgba(251,192,9,.35)]">
            <div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">Lucro bruto por copo</div>
            <div className="flex flex-wrap items-center justify-between gap-2.5 mt-2">
              <span className="text-[32px] font-black num" style={{ color: !verCusto ? '#F5F5F2' : lucro >= 0 ? '#FBC009' : '#FF6B5E', fontStretch: '100%' }}>{verCusto ? brlc(lucro) : '—'}</span>
              {verCusto && <span className="h-8 px-3 rounded-[2px_8px_3px_7px] flex items-center text-[15px] font-extrabold" style={{ background: margem >= 50 ? 'rgba(74,222,128,.14)' : margem >= 30 ? 'rgba(251,192,9,.14)' : 'rgba(255,107,94,.14)', color: margem >= 50 ? '#4ADE80' : margem >= 30 ? '#FBC009' : '#FF6B5E' }}>{margem}% de margem</span>}
            </div>
            <div className="text-xs text-[#ADADB4] mt-2">Margem = lucro bruto ÷ preço de venda</div>
          </div>
          <div className="flex flex-col">
            {linhas.map((l) => (
              <div key={l.s.k} className="flex justify-between gap-2.5 py-[9px] border-t border-line text-[13px]">
                <span className="text-[#C4C4C9] truncate">{l.it.name} · {l.q} {l.s.unidade}</span><span className="font-bold num flex-none">{verCusto ? brlc(Math.round(l.custo)) : '—'}</span>
              </div>
            ))}
            {!linhas.length && <div className="py-2 text-sm text-[#ADADB4]">Escolha os ingredientes ou abra um drink salvo.</div>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 items-start grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))]">
        <div className={`${card} p-5 gap-3.5`}>
          <div className="flex items-baseline justify-between gap-2.5"><div className="text-[17px] font-extrabold">Rendimento</div><span className="text-sm text-[#C4C4C9]">{dest?.it.name ?? 'Escolha o destilado'}</span></div>
          <div className="flex flex-col gap-2.5 p-4 rounded-[3px_11px_4px_10px] bg-[rgba(251,192,9,.07)] border-[1.5px] border-[rgba(251,192,9,.5)]">
            <div className="text-xs font-extrabold text-brand uppercase tracking-[.08em]">Com o estoque de hoje</div>
            <div className="flex items-baseline gap-2.5 flex-wrap"><span className="text-[clamp(30px,3vw,40px)] font-black leading-none text-brand num">{possiveis}</span><span className="text-[15px] font-bold">{possiveis === 1 ? 'copo' : 'copos'}</span></div>
            <div className="text-[13px] text-[#C4C4C9]">{!limitante ? 'Monte o copo para ver quanto rende.' : !dest || limitante === dest ? 'A garrafa é o limite: os outros itens têm estoque de sobra.' : `Limitado por ${limitante.s.label.toLowerCase()}. Reponha para liberar mais ${Math.max(0, dest.copos - possiveis)} ${dest.copos - possiveis === 1 ? 'combo' : 'combos'}.`}</div>
            <div className="flex justify-between gap-2.5 pt-2.5 border-t border-[rgba(251,192,9,.25)] text-[15px]"><span>Faturamento possível</span><span className="font-extrabold num">{brlc(possiveis * preco)}</span></div>
            {verCusto && <div className="flex justify-between gap-2.5 text-[15px]"><span>Lucro bruto possível</span><span className="font-black text-brand num">{brlc(possiveis * lucro)}</span></div>}
          </div>
          {dest && (
            <div className="flex flex-col gap-2.5">
              <div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">Rendimento total da garrafa</div>
              <div className="grid grid-cols-3 gap-2">
                {[['Restante', `${qtd(dest.disponivel / 1000)} L`], ['Dose', `${dest.q} ml`], ['Combos', String(dest.copos)]].map(([l, v]) => (
                  <div key={l} className="p-3 rounded-[2px_9px_3px_8px] bg-surface-2"><div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">{l}</div><div className="text-[17px] font-extrabold mt-1.5 num">{v}</div></div>
                ))}
              </div>
              <div className="flex justify-between gap-2.5 text-sm"><span className="text-[#C4C4C9]">Faturamento da garrafa inteira</span><span className="font-bold text-[#C4C4C9] num">{brlc(dest.copos * preco)}</span></div>
              {verCusto && <div className="flex justify-between gap-2.5 text-sm"><span className="text-[#C4C4C9]">Lucro bruto da garrafa inteira</span><span className="font-bold text-[#C4C4C9] num">{brlc(dest.copos * lucro)}</span></div>}
              <div className="text-xs text-[#ADADB4]">{limitante === dest ? 'Igual ao possível com o estoque de hoje.' : 'Capacidade teórica: só vale se todos os itens tiverem estoque.'}</div>
            </div>
          )}
        </div>

        <div className={`${card} p-5 gap-3`}>
          <div>
            <div className="text-xs font-extrabold text-[#ADADB4] uppercase tracking-[.08em]">Você consegue preparar</div>
            <div className="text-[clamp(28px,3vw,36px)] font-black mt-1.5 tracking-[-0.02em]">{possiveis} {possiveis === 1 ? 'copo' : 'copos'}</div>
            {limitante && <div className="text-sm text-[#C4C4C9] mt-1">Ingrediente limitante: <span className="text-brand font-extrabold">{limitante.it.name}</span></div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {linhas.map((l) => (
              <div key={l.s.k} className="flex flex-col gap-1.5 p-2.5 rounded-[2px_8px_3px_7px] bg-surface-2 border" style={{ borderColor: l === limitante ? '#FBC009' : '#2A2A2E' }}>
                <div className="flex justify-between gap-1.5 items-baseline"><span className="text-[13px] font-extrabold truncate">{l.s.label}</span><span className="text-[13px] font-extrabold" style={{ color: l === limitante ? '#FBC009' : '#C4C4C9' }}>{l.copos}</span></div>
                <div className="text-[13px] text-[#C4C4C9]">{l.s.unidade === 'ml' ? `${qtd(l.disponivel / 1000)} L` : `${qtd(l.disponivel)} un`} em estoque</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {escolher && (
        <Sheet title={SLOTS.find((s) => s.k === escolher)!.label} onClose={() => setEscolher(null)}>
          {itens.filter((i) => i.slot === escolher).map((i) => (
            <button key={i.id} onClick={() => escolherProduto(escolher, i.id)} className="flex items-center gap-3 h-[60px] px-4 rounded-[3px_10px_2px_9px] border bg-surface-2 text-left cursor-pointer"
              style={{ borderColor: esc[escolher]?.pid === i.id ? '#FBC009' : '#2A2A2E' }}>
              <span className="flex-1 font-bold">{i.name}</span><span className="text-[13px] text-[#ADADB4]">{qtd(i.estoque)} un</span>
            </button>
          ))}
          {!itens.some((i) => i.slot === escolher) && <div className="text-sm text-[#C4C4C9]">Nenhum produto dessa categoria no estoque.</div>}
          {esc[escolher] && <button onClick={() => escolherProduto(escolher, null)} className="self-start p-0 bg-transparent text-[#FF6B5E] text-sm font-bold cursor-pointer">Tirar do copo</button>}
        </Sheet>
      )}
    </div>
  )
}
