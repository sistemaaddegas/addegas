import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { funcao, rpc } from '@/lib/supabase'
import { brlc } from '@/lib/format'
import { Icon } from '@/components/icon'
import { useToast } from '@/components/toast'
import { useMyStores } from '@/features/acesso/lojas'
import { card, chip, chipCls } from '@/lib/visual'

type Assinatura = {
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'; access: 'allowed' | 'grace' | 'suspended'
  cycle: string; price: number; trial_ends_at: string | null; current_period_end: string | null; grace_ends_at: string | null
  cancel_at_period_end: boolean; temp_access_until: string | null; stores_allowed: number
}
type Preco = { cycle: 'monthly' | 'semiannual' | 'annual'; price: number; months: number }

const CICLO: Record<string, string> = { monthly: 'Mensal', semiannual: 'Semestral', annual: 'Anual' }
const dias = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5) : 0)
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

/** Loja atual, conta dela e se quem está logado é o dono (só o dono mexe na assinatura). */
export function useContaAtual() {
  const { storeId } = useAuth()
  const { data: lojas } = useMyStores()
  const loja = lojas?.find((l) => l.store_id === storeId)
  return { loja, dono: loja?.role === 'owner' }
}

export function useAssinatura(accountId: string | undefined, dono: boolean) {
  return useQuery({
    queryKey: ['assinatura', accountId],
    enabled: !!accountId && dono,
    staleTime: 5 * 60_000,
    queryFn: () => rpc<Assinatura>('my_subscription', { p_account_id: accountId }),
  })
}

/** Aviso no topo do app (E33): teste acabando, pagamento pendente ou acesso suspenso. */
export function AvisoAssinatura() {
  const { loja, dono } = useContaAtual()
  const { data: a } = useAssinatura(loja?.account_id, dono)
  const acesso = loja?.access
  let texto: string | null = null
  let grave = false
  if (acesso === 'suspended') { texto = dono ? 'Acesso suspenso: o caixa está bloqueado até regularizar a assinatura.' : 'Acesso suspenso: o caixa está bloqueado. Fale com o dono da adega.'; grave = true }
  else if (acesso === 'grace') { texto = dono ? `Pagamento não identificado. Regularize até ${data(a?.grace_ends_at ?? null)} para não bloquear o caixa.` : 'A assinatura está com pagamento pendente. Avise o dono da adega.'; grave = true }
  else if (dono && a?.status === 'trial' && dias(a.trial_ends_at) <= 5) texto = `Seu teste grátis acaba em ${Math.max(0, dias(a.trial_ends_at))} ${dias(a.trial_ends_at) === 1 ? 'dia' : 'dias'}.`
  if (!texto) return null
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 tablet:px-8 py-2.5 text-sm font-bold" style={{ background: grave ? 'rgba(229,36,27,.14)' : 'rgba(251,192,9,.12)', color: grave ? '#FF6B5E' : '#FBC009' }}>
      <Icon name="alert" size={18} /><span className="flex-1 min-w-0">{texto}</span>
      {dono && <Link to="/assinatura" className="h-8 px-3 rounded-[2px_7px_3px_6px] bg-brand text-brand-ink text-[13px] font-extrabold flex items-center">{grave ? 'Regularizar' : 'Assinar'}</Link>}
    </div>
  )
}

export function AssinaturaTela() {
  const { loja, dono } = useContaAtual()
  const { data: a, isLoading, error } = useAssinatura(loja?.account_id, dono)
  const { data: precos } = useQuery({ queryKey: ['precos'], queryFn: () => rpc<Preco[]>('plan_prices'), staleTime: 3600_000 })
  const [ciclo, setCiclo] = useState<Preco['cycle']>('monthly')
  const [busy, setBusy] = useState(false)
  const [params] = useSearchParams()
  const toast = useToast()

  if (loja && !dono) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Só o dono da adega vê e altera a assinatura.</div>
  if (isLoading || !loja) return <div className="p-4 tablet:p-8 text-[#C4C4C9]">Carregando…</div>
  if (error || !a) return <div className="p-4 tablet:p-8 text-bad">Não deu para carregar a assinatura. {error?.message}</div>

  const ir = async (rota: 'checkout' | 'portal') => {
    setBusy(true)
    try {
      const r = await funcao<{ url: string }>(`billing/${rota}`, { account_id: loja.account_id, cycle: ciclo })
      window.location.assign(r.url)
    } catch (e) { toast((e as Error).message); setBusy(false) }
  }
  const mensal = precos?.find((p) => p.cycle === 'monthly')?.price ?? 0
  const assinante = a.status === 'active' || a.status === 'past_due'
  const [titulo, sub, cor] =
    a.access === 'suspended' ? ['Acesso suspenso', 'O caixa, os pedidos e o estoque estão bloqueados. Relatórios e dados continuam disponíveis.', '#FF6B5E']
    : a.access === 'grace' ? ['Pagamento pendente', `Regularize até ${data(a.grace_ends_at)} para não bloquear o caixa.`, '#FF6B5E']
    : a.status === 'trial' ? ['Teste grátis', `Até ${data(a.trial_ends_at)} · faltam ${Math.max(0, dias(a.trial_ends_at))} dias.`, '#FBC009']
    : a.status === 'active' ? ['Assinatura ativa', `${CICLO[a.cycle] ?? a.cycle} · ${a.cancel_at_period_end ? 'termina' : 'renova'} em ${data(a.current_period_end)}`, '#4ADE80']
    : ['Assinatura encerrada', 'Assine para voltar a vender.', '#FF6B5E']

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-4 max-w-[900px] mx-auto w-full">
      {params.get('status') === 'ok' && <div className="p-4 rounded-[3px_11px_4px_10px] bg-[#0D1A0F] border border-[#16C60C] text-[15px] font-bold">Pagamento enviado. A confirmação chega em instantes e libera tudo sozinha.</div>}
      {params.get('status') === 'cancelado' && <div className="p-4 rounded-[3px_11px_4px_10px] bg-surface-2 text-[15px]">Pagamento não concluído. Você pode tentar de novo quando quiser.</div>}

      <div className={`${card} p-5 gap-2`}>
        <div className="text-xs font-extrabold uppercase tracking-[.08em] text-[#ADADB4]">Addegas · {loja.name}</div>
        <div className="text-[28px] font-black" style={{ color: cor, fontStretch: '100%' }}>{titulo}</div>
        <div className="text-[15px] text-[#C4C4C9]">{sub}</div>
        <div className="text-sm text-[#ADADB4]">{a.stores_allowed} {a.stores_allowed === 1 ? 'loja' : 'lojas'} no plano{assinante ? ` · ${brlc(a.price)} por ${a.cycle === 'monthly' ? 'mês' : a.cycle === 'semiannual' ? 'semestre' : 'ano'}` : ''}</div>
        {assinante && <button onClick={() => ir('portal')} disabled={busy} className="self-start mt-2 h-11 px-4 rounded-[3px_10px_2px_9px] border border-line-2 bg-surface-2 text-[15px] font-bold cursor-pointer">Cartão, faturas e cancelamento</button>}
      </div>

      {(!assinante || a.access !== 'allowed') && (
        <div className={`${card} p-5 gap-4`}>
          <div className="text-[17px] font-extrabold">{a.status === 'past_due' ? 'Regularizar' : 'Escolha como pagar'}</div>
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))]">
            {(precos ?? []).map((p, k) => {
              const porMes = Math.round(p.price / p.months)
              const economia = mensal ? Math.round((1 - porMes / mensal) * 100) : 0
              return (
                <button key={p.cycle} onClick={() => setCiclo(p.cycle)} className="flex flex-col gap-1.5 p-4 rounded-[3px_11px_4px_10px] border-2 text-left cursor-pointer"
                  style={{ borderColor: ciclo === p.cycle ? '#FBC009' : '#2A2A2E', background: ciclo === p.cycle ? 'rgba(251,192,9,.08)' : 'transparent' }}>
                  <span className="flex items-center gap-2 text-sm font-extrabold">{CICLO[p.cycle]}{economia > 0 && <span className={chipCls} style={{ ...chip(true, k), height: 22, padding: '0 8px', fontSize: 11 }}>−{economia}%</span>}</span>
                  <span className="text-2xl font-black num" style={{ fontStretch: '100%' }}>{brlc(porMes)}<span className="text-sm font-bold text-[#ADADB4]">/mês</span></span>
                  <span className="text-[13px] text-[#ADADB4]">{p.months === 1 ? 'Cobrado todo mês' : `${brlc(p.price)} a cada ${p.months} meses`}</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => ir('checkout')} disabled={busy} className="h-14 rounded-[3px_11px_4px_10px] bg-brand text-brand-ink text-[17px] font-extrabold cursor-pointer disabled:opacity-60">{busy ? 'Abrindo o pagamento…' : 'Continuar para o pagamento'}</button>
          <div className="text-[13px] text-[#ADADB4]">O pagamento é feito na página segura do Stripe, com cartão. Você volta para cá no fim.</div>
        </div>
      )}
    </div>
  )
}
