import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icon'

const Ctx = createContext<(msg: string) => void>(() => {})

/** Aviso curto no rodapé, como o toast do protótipo (some em 2,8 s). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>(undefined)
  const toast = useCallback((m: string) => {
    clearTimeout(timer.current)
    setMsg(m)
    timer.current = window.setTimeout(() => setMsg(null), 2800)
  }, [])
  return (
    <Ctx.Provider value={toast}>
      {children}
      {msg && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 tablet:bottom-7 z-[90] w-max max-w-[calc(100%-32px)] flex items-center gap-2.5 px-[18px] py-3.5 rounded-[3px_11px_4px_10px] bg-ink text-brand-ink text-[15px] font-bold shadow-[0_12px_40px_rgba(0,0,0,.5)]">
          <Icon name="check" />{msg}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
