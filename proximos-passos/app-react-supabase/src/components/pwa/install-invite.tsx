import { useEffect, useState } from 'react'
import { useInstall } from './install-provider'

/**
 * Convite de instalação próprio (E54). Regras, iguais às do NEXUM-PRO:
 * - não aparece no primeiro acesso, só a partir da 2ª sessão de uso;
 * - não aparece se o app já estiver instalado;
 * - pode ser fechado e volta depois de 7 dias, até a instalação.
 * No terminal do caixa o convite é obrigatório e aparece no pareamento (`force`).
 */
const STORAGE_KEY = 'addegas-install'
const SESSION_FLAG = 'addegas-install-session'
const MIN_SESSIONS = 2
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

type Memory = { sessions: number; dismissedAt: number | null }

function readMemory(): Memory {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Memory>
    return { sessions: Number(parsed.sessions) || 0, dismissedAt: typeof parsed.dismissedAt === 'number' ? parsed.dismissedAt : null }
  } catch {
    return { sessions: 0, dismissedAt: null }
  }
}

function writeMemory(memory: Memory) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)) } catch { /* navegação anônima */ }
}

export function InstallInvite({ force = false }: { force?: boolean }) {
  const { installed, platform, canPrompt, promptInstall, openIosTutorial } = useInstall()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (installed) return
    const memory = readMemory()
    // Conta uma sessão por aba aberta.
    if (!sessionStorage.getItem(SESSION_FLAG)) {
      sessionStorage.setItem(SESSION_FLAG, '1')
      memory.sessions += 1
      writeMemory(memory)
    }
    const snoozed = memory.dismissedAt !== null && Date.now() - memory.dismissedAt < SNOOZE_MS
    setVisible(force || (memory.sessions >= MIN_SESSIONS && !snoozed))
  }, [installed, force])

  if (!visible || installed || (platform !== 'ios' && !canPrompt)) return null

  const dismiss = () => {
    writeMemory({ ...readMemory(), dismissedAt: Date.now() })
    setVisible(false)
  }
  const install = async () => {
    if (platform === 'ios') return openIosTutorial()
    if (await promptInstall()) setVisible(false)
  }

  return (
    <div role="dialog" aria-label="Instalar o Addegas"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#2A2A2E] bg-[#1C1C1F] p-4 shadow-2xl">
      <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">Instale o Addegas</p>
        <p className="text-[13px] text-[#A1A1A6]">Abre em tela cheia, mais rápido, direto da tela inicial.</p>
      </div>
      <button type="button" onClick={install} className="h-11 rounded-[3px_10px_2px_9px] bg-[#FBC009] px-4 text-[14px] font-extrabold text-[#0A0A0B]">
        Instalar
      </button>
      {!force && (
        <button type="button" onClick={dismiss} aria-label="Agora não" className="h-11 w-9 text-[#A1A1A6]">✕</button>
      )}
    </div>
  )
}
