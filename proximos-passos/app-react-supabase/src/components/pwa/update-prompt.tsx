import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import { canUpdateNow, onCaixaStateChange } from '@/lib/caixa-state'

/**
 * Versão nova do app (E54):
 * - fora do caixa: aviso discreto com "Atualizar";
 * - no caixa: aplica sozinha quando não há carrinho aberto nem venda nos últimos 10 min (ou no fechamento);
 * - correção urgente: /api/health devolve min_version, e versão menor que ela atualiza assim que for seguro.
 */
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev'

function older(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0)
  return false
}

export function UpdatePrompt() {
  const { pathname } = useLocation()
  const onCaixa = pathname.startsWith('/caixa')
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null)
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    const updateSW = registerSW({ immediate: true, onNeedRefresh: () => setUpdate(() => updateSW) })
    fetch('/api/health').then((r) => r.json()).then((r) => {
      if (APP_VERSION !== 'dev' && r?.data?.min_version && older(APP_VERSION, r.data.min_version)) setUrgent(true)
    }).catch(() => { /* sem rede: segue na versão atual */ })
  }, [])

  // No caixa (ou com atualização urgente), aplica sozinha assim que ficar seguro.
  useEffect(() => {
    if (!update || (!onCaixa && !urgent)) return
    const tryApply = () => { if (canUpdateNow(onCaixa)) void update(true) }
    tryApply()
    const timer = window.setInterval(tryApply, 60_000)
    const stop = onCaixaStateChange(tryApply)
    return () => { window.clearInterval(timer); stop() }
  }, [update, onCaixa, urgent])

  if (!update || onCaixa) return null
  return (
    <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#2A2A2E] bg-[#1C1C1F] px-4 py-3">
      <p className="flex-1 text-[14px]">Nova versão do Addegas disponível.</p>
      <button type="button" onClick={() => void update(true)}
        className="h-10 rounded-[3px_10px_2px_9px] bg-[#FBC009] px-4 text-[14px] font-extrabold text-[#0A0A0B]">
        Atualizar
      </button>
    </div>
  )
}
