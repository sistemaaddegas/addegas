import { useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { AppError, rpc } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { brlc, centavos, parseBRL } from '@/lib/format'
import { brCode, type PixConfig } from '@/lib/pix'
import { Icon, type IconName } from '@/components/icon'
import { Sheet, bigBtn, chipBtn, moneyInput } from '@/components/sheet'
import { useToast } from '@/components/toast'
import { useOperadores, type Operador } from './dados'

const label = 'text-sm font-bold text-[#C4C4C9]'

// Abrir caixa ------------------------------------------------------------------------------------
export function AbrirCaixa({ op, onClose, onDone }: { op: Operador; onClose: () => void; onDone: () => void }) {
  const [troco, setTroco] = useState('150,00')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const abrir = async () => {
    setBusy(true)
    try {
      await rpc('open_cash', { p_operator_session_id: op.sessionId, p_opening_float: centavos(troco) })
      toast('Caixa aberto. Boas vendas!')
      onDone()
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  return (
    <Sheet title="Abrir caixa" onClose={onClose} footer={<button onClick={abrir} disabled={busy} className={bigBtn}>{busy ? 'Abrindo…' : 'Abrir caixa'}</button>}>
      <div className="flex flex-col gap-2"><span className={label}>Quem vai operar</span>
        <div className="flex flex-wrap gap-2"><span className={chipBtn(true)}>{op.name}</span></div></div>
      <label className="flex flex-col gap-2"><span className={label}>Troco inicial na gaveta</span>
        <input value={troco} onChange={(e) => setTroco(e.target.value)} inputMode="decimal" className={moneyInput} autoFocus />
        <div className="flex flex-wrap gap-2">{['100,00', '150,00', '200,00', '300,00'].map((v) => (
          <button key={v} type="button" onClick={() => setTroco(v)} className={chipBtn(troco === v)}>R$ {v}</button>))}</div>
      </label>
    </Sheet>
  )
}

// Fechar caixa -----------------------------------------------------------------------------------
type Sessao = { opening_float: number; esperado: number; retiradas: number; reforcos: number; porForma: Record<string, number>; vendas: number }
const FORMA: Record<string, string> = { pix: 'Pix', cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', fiado: 'Fiado' }

export function FecharCaixa({ op, sessao, cega, onClose, onDone }: { op: Operador; sessao: Sessao; cega: boolean; onClose: () => void; onDone: () => void }) {
  const [contado, setContado] = useState('')
  const [busy, setBusy] = useState(false)
  const [fim, setFim] = useState<{ expected_cash: number; counted_cash: number; difference: number } | null>(null)
  const toast = useToast()
  const c = centavos(contado)
  const diff = c - sessao.esperado

  const fechar = async () => {
    if (!contado.trim()) return toast('Conte o dinheiro da gaveta e informe o valor')
    setBusy(true)
    try {
      setFim(await rpc('close_cash', { p_operator_session_id: op.sessionId, p_counted_cash: c }))
    } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }
  const corDiff = (d: number) => d === 0 ? 'text-ok' : d > 0 ? 'text-info' : 'text-bad'
  const textoDiff = (d: number) => d === 0 ? 'Bateu certinho' : d > 0 ? `Sobrou ${brlc(d)}` : `Faltou ${brlc(-d)}`

  if (fim) return (
    <Sheet onClose={onDone} footer={<button onClick={onDone} className={bigBtn}>Pronto</button>}>
      <div className="flex flex-col items-center text-center gap-3.5 pt-8">
        <span className="w-[76px] h-[76px] rounded-full bg-brand text-brand-ink flex items-center justify-center"><Icon name="check" size={38} stroke={2.5} /></span>
        <div className="text-[30px] font-black tracking-[-0.01em]" style={{ fontStretch: '100%' }}>Caixa fechado</div>
        <div className="text-[15px] text-[#C4C4C9]">Esperado {brlc(fim.expected_cash)} · Contado {brlc(fim.counted_cash)}</div>
        <div className={`text-2xl font-black ${corDiff(fim.difference)}`}>{textoDiff(fim.difference)}</div>
      </div>
    </Sheet>
  )

  const linhas: [string, number][] = [
    ...Object.entries(FORMA).filter(([k]) => sessao.porForma[k]).map(([k, l]) => [`Vendas em ${l.toLowerCase()}`, sessao.porForma[k]] as [string, number]),
    ['Troco inicial', sessao.opening_float],
    ...(sessao.reforcos ? [['Reforços e fiado recebido', sessao.reforcos] as [string, number]] : []),
    ...(sessao.retiradas ? [['Retiradas e estornos', sessao.retiradas] as [string, number]] : []),
  ]
  return (
    <Sheet title="Fechar caixa" onClose={onClose} footer={<button onClick={fechar} disabled={busy} className={bigBtn}>{busy ? 'Fechando…' : 'Fechar caixa'}</button>}>
      <div className="flex items-baseline justify-between"><span className="text-[15px] font-bold">Vendas do turno</span><span className="text-[28px] font-black num" style={{ fontStretch: '100%' }}>{brlc(sessao.vendas)}</span></div>
      {!cega && (
        <div className="rounded-[3px_10px_2px_9px] bg-surface-2 px-3.5 py-1">
          {linhas.map(([l, v]) => <div key={l} className="flex justify-between py-2.5 border-b border-line-2 text-sm"><span className="text-[#C4C4C9]">{l}</span><span className="font-bold num">{brlc(v)}</span></div>)}
          <div className="flex justify-between py-3 text-[15px] font-extrabold"><span>Dinheiro esperado na gaveta</span><span className="num">{brlc(sessao.esperado)}</span></div>
        </div>
      )}
      <label className="flex flex-col gap-2"><span className={label}>Dinheiro contado na gaveta</span>
        <input value={contado} onChange={(e) => setContado(e.target.value)} inputMode="decimal" placeholder="0,00" className={moneyInput} autoFocus />
        {contado.trim() && !cega && <span className={`text-[15px] font-extrabold ${corDiff(diff)}`}>{textoDiff(diff)}</span>}
        {cega && <span className="text-[13px] text-[#ADADB4]">Contagem cega: o valor esperado aparece depois de fechar.</span>}
      </label>
    </Sheet>
  )
}

// Desconto ---------------------------------------------------------------------------------------
export function Desconto({ subtotal, atual, onClose, onApply }: { subtotal: number; atual: number; onClose: () => void; onApply: (c: number) => void }) {
  const [modo, setModo] = useState<'R$' | '%'>('R$')
  const [v, setV] = useState(atual ? (atual / 100).toFixed(2).replace('.', ',') : '')
  const valor = modo === 'R$' ? centavos(v) : Math.round(subtotal * Math.min(100, parseBRL(v)) / 100)
  const ok = valor >= 0 && valor <= subtotal
  return (
    <Sheet title="Desconto" onClose={onClose} footer={
      <div className="flex gap-2">
        {atual > 0 && <button onClick={() => onApply(0)} className="h-[58px] px-5 rounded-[3px_11px_4px_10px] border border-line-2 text-[15px] font-bold cursor-pointer">Tirar</button>}
        <button onClick={() => ok && onApply(valor)} disabled={!ok} className={bigBtn}>Aplicar {valor > 0 ? brlc(valor) : ''}</button>
      </div>}>
      <div className="flex gap-2">{(['R$', '%'] as const).map((m) => <button key={m} onClick={() => setModo(m)} className={chipBtn(modo === m)}>{m === 'R$' ? 'Em reais' : 'Em %'}</button>)}</div>
      <input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" placeholder={modo === 'R$' ? '0,00' : '10'} className={moneyInput} autoFocus />
      <div className="text-sm text-[#C4C4C9]">Subtotal {brlc(subtotal)} · fica {brlc(Math.max(0, subtotal - valor))}. O limite de desconto depende do seu papel na loja.</div>
      {!ok && <div className="text-sm font-bold text-bad">O desconto é maior que o valor da venda.</div>}
    </Sheet>
  )
}

// Cobrar -----------------------------------------------------------------------------------------
type Metodo = 'pix' | 'cash' | 'credit' | 'debit' | 'fiado'
const METODOS: [Metodo, string, IconName][] = [['pix', 'Pix', 'qr'], ['cash', 'Dinheiro', 'cash'], ['credit', 'Crédito', 'card'], ['debit', 'Débito', 'card'], ['fiado', 'Fiado', 'book']]

function QrPix({ texto }: { texto: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(texto)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    return { size: n, path: d }
  }, [texto])
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="w-[168px] h-[168px] flex-none rounded-[3px_10px_2px_9px] bg-white" shapeRendering="crispEdges" role="img" aria-label="QR Code Pix">
      <path d={path} fill="#0A0A0B" />
    </svg>
  )
}

export type Venda = { sale_id: string; number: number; total: number; change: number }

export function Cobrar({ op, total, itens, desconto, pix, requestId, onClose, onDone }: {
  op: Operador; total: number; itens: { kind: 'product' | 'bundle'; id: string; qty: number }[]; desconto: number
  pix: PixConfig | null; requestId: string; onClose: () => void; onDone: (v: Venda & { metodo: string }) => void
}) {
  const [metodo, setMetodo] = useState<Metodo>('pix')
  const [recebido, setRecebido] = useState('')
  const [busy, setBusy] = useState(false)
  const [fiado, setFiado] = useState<FiadoEscolha | null>(null)
  const [pedirSenha, setPedirSenha] = useState(false)
  const toast = useToast()
  const rec = centavos(recebido)
  const troco = rec - total
  const codigoPix = useMemo(() => pix ? brCode(pix, total, requestId) : null, [pix, total, requestId])
  const notas = [...new Set([total, ...[1000, 2000, 5000, 10000, 20000].map((n) => Math.ceil(total / n) * n)])].filter((v) => v >= total).slice(0, 5)

  const confirmar = async (overrideToken?: string) => {
    if (metodo === 'cash' && recebido.trim() && rec < total) return toast('O valor recebido é menor que o total')
    if (metodo === 'fiado' && !fiado) return toast('Diga para quem é o fiado')
    setBusy(true)
    try {
      const v = await rpc<Venda>('finalize_sale', { p: {
        operator_session_id: op.sessionId, client_request_id: requestId, discount: desconto,
        ...(overrideToken ? { override_token: overrideToken } : {}),
        ...(metodo === 'fiado' && fiado ? { fiado: 'id' in fiado ? { fiado_account_id: fiado.id } : { name: fiado.name, phone: fiado.phone } } : {}),
        items: itens.map((i) => i.kind === 'product' ? { product_id: i.id, quantity: i.qty } : { bundle_id: i.id, quantity: i.qty }),
        payments: [{ method: metodo, amount: metodo === 'cash' && recebido.trim() ? rec : total }],
      } })
      onDone({ ...v, metodo: metodo === 'fiado' && fiado ? `Fiado de ${fiado.name.split(' ')[0]}` : METODOS.find((m) => m[0] === metodo)![1] })
    } catch (e) {
      setBusy(false)
      // Desconto acima do limite do papel: pede o PIN de quem pode liberar e tenta de novo.
      if (e instanceof AppError && e.code === 'SALE_DISCOUNT_FORBIDDEN') return setPedirSenha(true)
      toast((e as Error).message)
    }
  }

  return (
    <Sheet title="Cobrar · Balcão" onClose={onClose} footer={
      <button onClick={() => confirmar()} disabled={busy} className={`${bigBtn} h-[62px] text-lg`}>
        {busy ? 'Registrando…' : 'Confirmar pagamento'}<span className="hidden desktop:inline text-xs font-bold border-[1.5px] border-black/35 rounded-md px-1.5 py-[3px]">Enter</span>
      </button>}>
      <form onSubmit={(e) => { e.preventDefault(); void confirmar() }} className="contents">
        <div>
          <div className="text-sm text-[#C4C4C9] font-bold">Total</div>
          <div className="text-[52px] font-black tracking-[-0.02em] leading-[1.05] text-brand num" style={{ fontStretch: '100%' }}>{brlc(total)}</div>
          <div className="text-sm text-[#C4C4C9] mt-1.5">{itens.reduce((a, i) => a + i.qty, 0)} itens{desconto ? ` · desconto ${brlc(desconto)}` : ''}</div>
        </div>
        <div className="grid gap-2 grid-cols-2 tablet:grid-cols-5">
          {METODOS.map(([id, l, ic]) => {
            return (
              <button key={id} type="button" onClick={() => setMetodo(id)}
                className={`h-[76px] rounded-[3px_11px_4px_10px] border-2 text-[15px] font-extrabold flex flex-col items-center justify-center gap-1.5 ${metodo === id ? 'border-brand bg-[rgba(251,192,9,.10)] text-brand cursor-pointer' : 'border-line-2 bg-surface-2 cursor-pointer'}`}>
                <Icon name={ic} size={22} />{l}
              </button>
            )
          })}
        </div>
        {metodo === 'cash' && (
          <>
            <label className="flex flex-col gap-2"><span className={label}>Valor recebido</span>
              <input value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus className={moneyInput} /></label>
            <div className="flex flex-wrap gap-2">{notas.map((n) => <button key={n} type="button" onClick={() => setRecebido((n / 100).toFixed(2).replace('.', ','))} className={chipBtn(rec === n)}>{n === total ? 'Exato' : brlc(n)}</button>)}</div>
            <div className="flex items-baseline justify-between px-4 py-3.5 rounded-[3px_10px_2px_9px] bg-surface-2">
              <span className="text-[15px] font-bold">Troco</span>
              <span className={`text-[28px] font-black num ${recebido.trim() && troco < 0 ? 'text-bad' : 'text-brand'}`}>{recebido.trim() ? (troco < 0 ? `Falta ${brlc(-troco)}` : brlc(troco)) : brlc(0)}</span>
            </div>
          </>
        )}
        {metodo === 'pix' && (
          <div className="flex flex-col tablet:flex-row items-center gap-4 p-4 rounded-[3px_11px_4px_10px] bg-surface-2">
            {codigoPix ? <QrPix texto={codigoPix} /> : <div className="w-[168px] h-[168px] flex-none rounded-[3px_10px_2px_9px] border-2 border-dashed border-[#3A3A40] flex items-center justify-center text-center text-[13px] text-[#ADADB4] p-3">Cadastre a chave Pix da loja em Ajustes</div>}
            <div className="flex flex-col gap-2.5 text-sm text-[#C4C4C9] leading-normal">
              <span>Mostre o QR ao cliente: o valor já vem preenchido no app do banco. <b className="text-ink">Confira o recebimento</b> no app do banco antes de confirmar.</span>
              {codigoPix && <button type="button" onClick={() => navigator.clipboard?.writeText(codigoPix).then(() => toast('Pix copia e cola copiado'))} className="self-start h-9 px-3 rounded-[2px_7px_3px_6px] border border-line-2 bg-surface text-[13px] font-bold text-ink cursor-pointer">Copiar Pix copia e cola</button>}
            </div>
          </div>
        )}
        {metodo === 'fiado' && <FiadoPara escolha={fiado} onEscolha={setFiado} />}
        {(metodo === 'credit' || metodo === 'debit') && <div className="p-4 rounded-[3px_11px_4px_10px] bg-surface-2 text-sm text-[#C4C4C9] leading-normal">Passe o cartão na maquininha e confirme aqui quando aprovar.</div>}
        <button type="submit" hidden />
      </form>
      {pedirSenha && <Liberar subtotal={total + desconto} desconto={desconto} onClose={() => setPedirSenha(false)} onToken={(t) => { setPedirSenha(false); void confirmar(t) }} />}
    </Sheet>
  )
}

// Fiado para quem? (E23): busca por telefone ou nome; se não achar, nome e telefone na mesma tela.
type FiadoEscolha = { id: string; name: string; balance: number; credit_limit: number | null } | { name: string; phone: string }
type FiadoAchado = { fiado_account_id: string; name: string; phone: string | null; balance: number; credit_limit: number | null }

function FiadoPara({ escolha, onEscolha }: { escolha: FiadoEscolha | null; onEscolha: (f: FiadoEscolha | null) => void }) {
  const { storeId } = useAuth()
  const [q, setQ] = useState('')
  const [achados, setAchados] = useState<FiadoAchado[] | null>(null)
  const [nova, setNova] = useState({ name: '', phone: '' })
  const buscar = async () => {
    if (q.trim().length < 2) return
    try { setAchados(await rpc<FiadoAchado[]>('find_fiado', { p_store_id: storeId, p_query: q.trim() })) } catch { setAchados([]) }
  }
  const campo = 'h-12 px-3.5 rounded-[3px_10px_2px_9px] bg-surface border border-line-2 text-base outline-none focus:border-brand'
  if (escolha) return (
    <div className="flex items-center gap-3 p-4 rounded-[3px_11px_4px_10px] bg-surface-2 border border-brand">
      <Icon name="book" />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-extrabold">{escolha.name}</div>
        <div className="text-sm text-[#C4C4C9] mt-0.5">{'id' in escolha ? `Deve ${brlc(escolha.balance)}${escolha.credit_limit ? ` · limite ${brlc(escolha.credit_limit)}` : ''}` : 'Fiado novo'}</div>
      </div>
      <button type="button" onClick={() => onEscolha(null)} className="h-9 px-3 rounded-[2px_7px_3px_6px] border border-line-2 text-[13px] font-bold cursor-pointer">Trocar</button>
    </div>
  )
  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-[3px_11px_4px_10px] bg-surface-2">
      <span className={label}>Fiado para quem?</span>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => { setQ(e.target.value); setAchados(null) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void buscar() } }}
          placeholder="Telefone ou nome" autoFocus className={`${campo} flex-1 min-w-0`} />
        <button type="button" onClick={buscar} className="h-12 px-4 rounded-[3px_10px_2px_9px] bg-brand text-brand-ink font-extrabold cursor-pointer">Buscar</button>
      </div>
      {achados?.map((a) => (
        <button key={a.fiado_account_id} type="button" onClick={() => onEscolha({ id: a.fiado_account_id, name: a.name, balance: a.balance, credit_limit: a.credit_limit })}
          className="flex items-center gap-3 p-3 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface text-left cursor-pointer">
          <span className="flex-1 min-w-0"><span className="block font-bold">{a.name}</span><span className="block text-[13px] text-[#ADADB4]">{a.phone ?? ''}</span></span>
          <span className="text-sm font-extrabold num">{a.balance > 0 ? brlc(a.balance) : 'Em dia'}</span>
        </button>
      ))}
      {achados && (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[13px] text-[#ADADB4]">{achados.length ? 'Não é ninguém daqui? Cadastre na hora:' : 'Ninguém com esse nome ou telefone. Cadastre na hora:'}</span>
          <div className="grid grid-cols-2 gap-2">
            <input value={nova.name} onChange={(e) => setNova({ ...nova, name: e.target.value })} placeholder="Nome" className={campo} />
            <input value={nova.phone} onChange={(e) => setNova({ ...nova, phone: e.target.value })} inputMode="tel" placeholder="Telefone com DDD" className={campo} />
          </div>
          <button type="button" disabled={!nova.name.trim() || nova.phone.replace(/\D/g, '').length < 10} onClick={() => onEscolha({ name: nova.name.trim(), phone: nova.phone.replace(/\D/g, '') })}
            className="h-11 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface font-bold cursor-pointer disabled:opacity-50">Usar este fiado novo</button>
        </div>
      )}
    </div>
  )
}

// Desconto acima do limite: quem tem limite maior digita o PIN e libera só esta venda (token de 2 min, D05).
function Liberar({ subtotal, desconto, onClose, onToken }: { subtotal: number; desconto: number; onClose: () => void; onToken: (t: string) => void }) {
  const { storeId } = useAuth()
  const { data: membros } = useOperadores(storeId)
  const [quem, setQuem] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const pct = Math.round((desconto * 10000) / subtotal) / 100
  const podem = (membros ?? []).filter((m) => m.role === 'owner' || m.role === 'manager')
  const liberar = async () => {
    if (!quem || pin.length !== 4) return
    setBusy(true)
    try {
      const r = await rpc<{ override_token: string }>('authorize_override', { p_member_id: quem, p_pin: pin, p_action: 'discount', p_value: pct })
      onToken(r.override_token)
    } catch (e) { toast((e as Error).message); setPin(''); setBusy(false) }
  }
  return (
    <Sheet title="Liberar desconto" onClose={onClose} footer={<button onClick={liberar} disabled={busy || !quem || pin.length !== 4} className={bigBtn}>{busy ? 'Conferindo…' : 'Liberar e cobrar'}</button>}>
      <div className="text-sm text-[#C4C4C9]">{brlc(desconto)} de desconto ({String(pct).replace('.', ',')}%) passa do seu limite. Peça para o gerente ou o dono digitar o PIN.</div>
      <div className="flex flex-wrap gap-2">{podem.map((m) => <button key={m.id} type="button" onClick={() => setQuem(m.id)} className={chipBtn(quem === m.id)}>{m.display_name}</button>)}</div>
      {quem && <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} type="password" inputMode="numeric" autoFocus placeholder="PIN"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void liberar() } }} className={`${moneyInput} tracking-[.5em] text-center`} />}
    </Sheet>
  )
}

export function VendaFeita({ venda, onNext }: { venda: Venda & { metodo: string }; onNext: () => void }) {
  return (
    <Sheet onClose={onNext} footer={<button onClick={onNext} autoFocus className={`${bigBtn} h-[62px] text-lg`}>Próxima venda</button>}>
      <div className="flex flex-col items-center text-center gap-3.5 pt-8">
        <span className="w-[76px] h-[76px] rounded-full bg-brand text-brand-ink flex items-center justify-center"><Icon name="check" size={38} stroke={2.5} /></span>
        <div className="text-[30px] font-black tracking-[-0.01em]" style={{ fontStretch: '100%' }}>Venda registrada</div>
        <div className="text-[15px] text-[#C4C4C9]">#{venda.number} · {venda.metodo} · {brlc(venda.total)}</div>
        {venda.change > 0 && (
          <div className="px-6 py-4 rounded-[3px_11px_4px_10px] bg-surface-2">
            <div className="text-sm text-[#C4C4C9] font-bold">Troco</div>
            <div className="text-[40px] font-black text-brand num" style={{ fontStretch: '100%' }}>{brlc(venda.change)}</div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
