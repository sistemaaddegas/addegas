import { useEffect, type ReactNode } from 'react'
import { Icon } from './icon'

/** Janela do protótipo (S.sheet): folha que sobe no celular, caixa no centro do tablet e do computador. */
export function Sheet({ title, onClose, children, footer }: { title?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 z-50" />
      <div role="dialog" aria-modal="true"
        className="fixed z-[60] flex flex-col overflow-hidden bg-surface left-0 right-0 bottom-0 max-h-[92%] rounded-[6px_18px_0_0] border-t border-line-2 safe-bottom tablet:left-1/2 tablet:right-auto tablet:bottom-auto tablet:top-1/2 tablet:-translate-x-1/2 tablet:-translate-y-1/2 tablet:w-[min(540px,92%)] tablet:max-h-[88%] tablet:rounded-[5px_16px_6px_14px] tablet:border tablet:shadow-[0_30px_80px_rgba(0,0,0,.6)]">
        <div className="tablet:hidden w-10 h-[5px] rounded-[2px_7px_3px_6px] bg-[#3A3A40] mt-2.5 mx-auto flex-none" />
        {title !== undefined && (
          <div className="flex items-center gap-3 pt-[18px] px-5 pb-2 flex-none">
            <div className="flex-1 text-xl font-extrabold" style={{ fontStretch: '100%' }}>{title}</div>
            <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 rounded-[2px_8px_3px_7px] border border-line-2 bg-surface-2 flex items-center justify-center cursor-pointer"><Icon name="x" /></button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-5 flex flex-col gap-4">{children}</div>
        {footer && <div className="flex-none px-5 pt-3.5 pb-5 border-t border-line">{footer}</div>}
      </div>
    </>
  )
}

/** Campo grande de valor em reais, como nos modais do protótipo. */
export const moneyInput = 'h-[60px] px-4 rounded-[3px_10px_2px_9px] bg-surface-2 border border-line-2 text-[26px] font-extrabold num w-full outline-none focus:border-brand'
export const chipBtn = (on: boolean) => `h-10 px-4 rounded-[3px_10px_2px_9px] border text-sm font-bold cursor-pointer whitespace-nowrap ${on ? 'border-brand bg-brand text-brand-ink' : 'border-line-2 bg-surface-2'}`
export const bigBtn = 'w-full h-[58px] rounded-[3px_11px_4px_10px] bg-brand text-brand-ink text-[17px] font-extrabold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2.5'
