import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Estado de instalação do PWA (E54), no padrão do NEXUM-PRO.
 * - Chrome e Edge (computador e Android) disparam `beforeinstallprompt`; o evento é guardado para o
 *   nosso convite chamar a instalação nativa na hora certa.
 * - O iPhone e o iPad não têm instalação automática: lá mostramos o passo a passo.
 */
export type InstallPlatform = 'ios' | 'android' | 'desktop'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type InstallContextValue = {
  platform: InstallPlatform
  /** Rodando como app instalado. */
  installed: boolean
  /** O navegador liberou a instalação nativa (Chrome e Edge). */
  canPrompt: boolean
  promptInstall: () => Promise<boolean>
  iosTutorialOpen: boolean
  openIosTutorial: () => void
  closeIosTutorial: () => void
}

const InstallContext = createContext<InstallContextValue | null>(null)

export function useInstall(): InstallContextValue {
  const value = useContext(InstallContext)
  if (!value) throw new Error('useInstall precisa estar dentro de <InstallProvider>.')
  return value
}

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent
  // iPadOS se apresenta como Mac, mas tem tela de toque.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function detectStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function InstallProvider({ children }: { children: ReactNode }) {
  const [platform] = useState(detectPlatform)
  const [installed, setInstalled] = useState(detectStandalone)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosTutorialOpen, setIosTutorialOpen] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const onBeforeInstallPrompt = (event: Event) => {
      // Segura o convite do navegador: quem decide a hora é o nosso convite.
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => { setPromptEvent(null); setInstalled(true) }
    const onDisplayChange = () => setInstalled(detectStandalone())
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    media.addEventListener('change', onDisplayChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      media.removeEventListener('change', onDisplayChange)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    setPromptEvent(null) // o evento só pode ser usado uma vez
    return outcome === 'accepted'
  }, [promptEvent])

  const value = useMemo<InstallContextValue>(() => ({
    platform, installed, canPrompt: promptEvent !== null, promptInstall, iosTutorialOpen,
    openIosTutorial: () => setIosTutorialOpen(true), closeIosTutorial: () => setIosTutorialOpen(false),
  }), [platform, installed, promptEvent, promptInstall, iosTutorialOpen])

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>
}
