import { useEffect } from 'react'

/**
 * Mantém a tela do tablet do balcão ligada enquanto `active` (caixa aberto, E54).
 * O navegador solta o bloqueio quando a aba some; ao voltar, pedimos de novo.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* bateria fraca ou permissão negada: segue sem bloquear */
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible' && !cancelled) void request() }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
