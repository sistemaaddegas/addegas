import { useEffect, useState, type CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { funcao, rpc, supabase } from '@/lib/supabase'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { useContaAtual } from '@/features/assinatura/assinatura'
import { irr } from '@/lib/visual'

type Tipo = 'problema' | 'melhoria' | 'duvida'
type Urg = 'espera' | 'atrapalha' | 'parou'
export type Chamado = {
  ticket_id: string; number: number; kind: string; subject: string; description: string; priority: string
  status: 'novo' | 'em_andamento' | 'aguardando_cliente' | 'resolvido' | 'fechado'; created_at: string; attachments: number
  messages: { side: 'cliente' | 'equipe'; body: string; created_at: string }[]
}

// Mesmas opções do protótipo (chVals).
const ASSUNTOS: Record<Tipo, string[]> = {
  problema: ['Caixa travou ou lento', 'Impressora / cupom', 'Problema com integração', 'Pagamento ou Pix', 'Estoque com valor errado', 'Não consigo entrar', 'Outro'],
  melhoria: ['Nova função', 'Melhorar uma tela', 'Novo relatório', 'Nova integração', 'Outro'],
  duvida: ['Como usar o caixa', 'Fechamento de caixa', 'Fiado', 'Integrações', 'Outro'],
}
const TIPOS: [Tipo, string, string][] = [['problema', 'Problema', '#E5241B'], ['melhoria', 'Melhoria', '#16A34A'], ['duvida', 'Dúvida', '#F97316']]
const URGS: [Urg, string, string][] = [['espera', 'Pode esperar', '#4ADE80'], ['atrapalha', 'Atrapalha o trabalho', '#FBC009'], ['parou', 'Parou as vendas', '#E5241B']]
const NOME_TIPO: Record<string, string> = { problema: 'Problema', melhoria: 'Melhoria', duvida: 'Dúvida', financeiro: 'Financeiro' }
const STATUS: Record<Chamado['status'], [string, string, string]> = {
  novo: ['Aberto', '#FBC009', '#0A0A0B'], em_andamento: ['Em análise', '#1E90FF', '#FFFFFF'],
  aguardando_cliente: ['Respondido', '#F97316', '#0A0A0B'], resolvido: ['Resolvido', '#16C60C', '#0A0A0B'], fechado: ['Fechado', '#3A3A40', '#F5F5F2'],
}
const rotulo = 'text-[13px] font-extrabold text-[#ADADB4] uppercase tracking-[.08em]'
const chip = (on: boolean, k: number): CSSProperties => ({ height: 40, padding: '0 14px', borderRadius: irr(k), border: on ? 'none' : '1px solid #2A2A2E', background: on ? '#FBC009' : '#141416', color: on ? '#0A0A0B' : '#F5F5F2', fontSize: 14, fontWeight: on ? 800 : 600 })
const quando = (iso: string) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString() ? 'Hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Chamados da conta (E38). O número no cabeçalho conta os que ainda não foram resolvidos. */
export function useChamados() {
  const { loja } = useContaAtual()
  const { terminal } = useAuth()
  return useQuery({
    queryKey: ['chamados', loja?.account_id],
    enabled: !!loja && !terminal,
    refetchInterval: 120_000,
    queryFn: () => rpc<Chamado[]>('my_tickets', { p_account_id: loja!.account_id }),
  })
}

/** Envia o print pelo /api/uploads (confere o tipo de verdade) e liga ao chamado. */
async function anexar(accountId: string, ticketId: string, file: File) {
  const s = await funcao<{ bucket: string; path: string; token: string }>('uploads/sign', { purpose: 'ticket_attachment', account_id: accountId, ticket_id: ticketId, mime: file.type, size: file.size })
  const up = await supabase.storage.from(s.bucket).uploadToSignedUrl(s.path, s.token, file)
  if (up.error) throw new Error(up.error.message)
  await funcao('uploads/finalize', { bucket: s.bucket, path: s.path, original_name: file.name })
  await rpc('attach_ticket_file', { p_ticket_id: ticketId, p_path: s.path, p_name: file.name })
}

export function Suporte() {
  const { storeId } = useAuth()
  const { loja } = useContaAtual()
  const { data: lista, isLoading } = useChamados()
  const qc = useQueryClient()
  const toast = useToast()
  const [tipo, setTipo] = useState<Tipo>('problema')
  const [ass, setAss] = useState('')
  const [urg, setUrg] = useState<Urg>('atrapalha')
  const [desc, setDesc] = useState('')
  const [img, setImg] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)
  const preview = useObjectUrl(img)

  const ok = !!ass && desc.trim().length >= 5 && !busy
  const enviar = async () => {
    if (!ok || !loja) return
    setBusy(true)
    try {
      const r = await rpc<{ ticket_id: string; number: number }>('open_ticket', {
        p_account_id: loja.account_id, p_store_id: storeId, p_kind: tipo, p_subject: ass, p_description: desc.trim(),
        p_urgency: tipo === 'problema' ? urg : tipo === 'duvida' ? 'duvida' : 'espera',
      })
      let aviso = ''
      if (img) await anexar(loja.account_id, r.ticket_id, img).catch((e) => { aviso = ` A imagem não foi: ${(e as Error).message}` })
      toast(`Chamado #${r.number} aberto. Respondemos pelo WhatsApp.${aviso}`)
      setAss(''); setDesc(''); setImg(null)
      await qc.invalidateQueries({ queryKey: ['chamados'] })
    } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="p-4 tablet:p-8 grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] max-w-[1200px] mx-auto w-full items-start">
      <div className="flex flex-col gap-[22px] p-6 rounded-[4px_14px_5px_12px] bg-surface border border-line">
        <img src="/icons/addegas-logo-dark.png" alt="Addegas" className="h-9 w-auto self-start" />
        <div className="flex items-center gap-3.5">
          <span className="w-[52px] h-[52px] flex-none rounded-[3px_11px_4px_10px] bg-brand text-brand-ink flex items-center justify-center -rotate-3"><Icon name="help" size={24} /></span>
          <div className="flex flex-col gap-[3px] min-w-0">
            <div className="text-[22px] font-black tracking-[-.01em]">Fale com o suporte</div>
            <div className="text-sm text-[#C4C4C9] text-pretty">Conte o problema ou a ideia. A resposta chega no seu WhatsApp.</div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className={rotulo}>Tipo</div>
          <div className="flex gap-2">
            {TIPOS.map(([k, l, c], i) => (
              <button key={k} onClick={() => { setTipo(k); setAss('') }} className="flex-[1_1_0] cursor-pointer" style={{ ...chip(tipo === k, i), height: 46, fontSize: 15, ...(tipo === k ? { background: c, color: '#FFFFFF' } : {}) }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className={rotulo}>Assunto</div>
          <div className="flex flex-wrap gap-2">{ASSUNTOS[tipo].map((l, i) => <button key={l} onClick={() => setAss(l)} className="cursor-pointer" style={chip(ass === l, i + 2)}>{l}</button>)}</div>
        </div>
        {tipo === 'problema' && (
          <div className="flex flex-col gap-2.5">
            <div className={rotulo}>Urgência</div>
            <div className="flex flex-wrap gap-2">
              {URGS.map(([k, l, c], i) => (
                <button key={k} onClick={() => setUrg(k)} className="flex items-center gap-2 cursor-pointer"
                  style={{ ...chip(false, i), border: urg === k ? `1.5px solid ${c}` : '1px solid #2A2A2E', background: urg === k ? '#1C1C1F' : '#141416' }}>
                  <span className="w-[9px] h-[9px] rounded-full flex-none" style={{ background: c }} />{l}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <div className={rotulo}>Descreva</div>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="O que aconteceu, em qual tela e o que você esperava…"
            className="w-full p-3.5 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-[15px] leading-normal resize-y outline-none focus:border-brand" />
        </div>
        <div className="flex flex-col gap-2.5">
          <div className={rotulo}>Imagem <span className="normal-case tracking-normal font-semibold">(opcional)</span></div>
          {img ? (
            <div className="flex items-center gap-3 p-2.5 rounded-[4px_12px_3px_10px] border border-line-2 bg-surface-2">
              <div className="w-[72px] h-[72px] flex-none rounded-[2px_8px_3px_7px] bg-bg bg-cover bg-center" style={{ backgroundImage: preview ? `url("${preview}")` : undefined }} />
              <span className="flex-1 min-w-0 text-sm truncate">{img.name}</span>
              <button onClick={() => setImg(null)} title="Remover" className="w-9 h-9 flex-none rounded-[2px_8px_3px_7px] bg-[#E5241B] text-white flex items-center justify-center cursor-pointer"><Icon name="x" size={16} /></button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2.5 min-h-[88px] p-3.5 rounded-[4px_12px_3px_10px] border-[1.5px] border-dashed border-[#3A3A40] bg-bg text-[#C4C4C9] text-sm font-bold cursor-pointer text-center hover:border-brand hover:text-ink">
              <span className="text-brand"><Icon name="img" /></span>Anexar print ou foto
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (f && f.size > 10 * 1024 * 1024) toast('Imagem acima de 10 MB.')
                else if (f) setImg(f)
              }} />
            </label>
          )}
        </div>
        <button onClick={enviar} disabled={!ok} className="h-[54px] rounded-[3px_11px_4px_10px] text-base font-extrabold flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
          style={{ background: ok ? '#FBC009' : '#232327', color: ok ? '#0A0A0B' : '#6E6E73' }}><Icon name="send" size={18} />{busy ? 'Enviando…' : 'Enviar chamado'}</button>
      </div>

      <div className="flex flex-col gap-3">
        <div className={`${rotulo} px-0.5`}>Meus tickets</div>
        {isLoading && <div className="text-sm text-[#C4C4C9]">Carregando…</div>}
        {lista?.length === 0 && <div className="p-4 rounded-[3px_11px_4px_10px] bg-surface-2 border border-line text-sm text-[#C4C4C9]">Nenhum chamado ainda.</div>}
        {lista?.map((c) => <CartaoChamado key={c.ticket_id} c={c} aberto={aberto === c.ticket_id} onToggle={() => setAberto(aberto === c.ticket_id ? null : c.ticket_id)} />)}
      </div>
    </div>
  )
}

function CartaoChamado({ c, aberto, onToggle }: { c: Chamado; aberto: boolean; onToggle: () => void }) {
  const [st, bg, fg] = STATUS[c.status]
  const qc = useQueryClient()
  const toast = useToast()
  const [resp, setResp] = useState('')
  const [busy, setBusy] = useState(false)
  const responder = async () => {
    setBusy(true)
    try { await rpc('reply_ticket', { p_ticket_id: c.ticket_id, p_body: resp.trim() }); setResp(''); await qc.invalidateQueries({ queryKey: ['chamados'] }) } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }
  const fechado = c.status === 'fechado'
  return (
    <div className="flex flex-col gap-2 p-4 rounded-[3px_11px_4px_10px] bg-surface-2 border border-line">
      <button onClick={onToggle} className="flex flex-col gap-2 text-left cursor-pointer">
        <div className="flex items-center gap-2.5 w-full">
          <span className="text-sm font-extrabold text-[#ADADB4] num">#{c.number}</span>
          <span className="flex-1 min-w-0 text-base font-extrabold truncate">{c.subject}</span>
          <span className="h-6 px-[9px] rounded-[2px_7px_3px_6px] text-xs font-extrabold flex items-center flex-none" style={{ background: bg, color: fg }}>{st}</span>
        </div>
        <div className={`text-sm text-[#C4C4C9] leading-[1.45] text-pretty ${aberto ? '' : 'line-clamp-2'}`}>{c.description}</div>
        <div className="text-[13px] font-bold text-[#ADADB4]">{NOME_TIPO[c.kind] ?? c.kind} · {quando(c.created_at)}{c.attachments ? ' · com imagem' : ''}{c.messages.length ? ` · ${c.messages.length} ${c.messages.length === 1 ? 'mensagem' : 'mensagens'}` : ''}</div>
      </button>
      {aberto && (
        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          {c.messages.map((m, i) => (
            <div key={i} className={`max-w-[88%] p-2.5 rounded-[3px_10px_2px_9px] text-sm leading-[1.45] whitespace-pre-wrap ${m.side === 'equipe' ? 'self-start bg-[#1C1C1F] border border-line-2' : 'self-end bg-[rgba(251,192,9,.12)] text-[#FBE7A1]'}`}>
              <div className="text-[11px] font-extrabold uppercase tracking-[.06em] opacity-70 mb-1">{m.side === 'equipe' ? 'Suporte Addegas' : 'Você'} · {quando(m.created_at)}</div>{m.body}
            </div>
          ))}
          {!c.messages.length && <div className="text-sm text-[#ADADB4]">O suporte ainda não respondeu.</div>}
          {!fechado && (
            <div className="flex gap-2">
              <input value={resp} onChange={(e) => setResp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && resp.trim()) responder() }} placeholder="Escrever para o suporte"
                className="flex-1 min-w-0 h-11 px-3 rounded-[2px_8px_3px_7px] bg-bg border border-line-2 text-sm outline-none focus:border-brand" />
              <button onClick={responder} disabled={busy || !resp.trim()} className="h-11 px-3.5 rounded-[2px_8px_3px_7px] bg-brand text-brand-ink text-sm font-extrabold cursor-pointer disabled:opacity-50">Enviar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function useObjectUrl(f: File | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!f) { setUrl(null); return }
    const u = URL.createObjectURL(f)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [f])
  return url
}
