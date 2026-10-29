import type { InputHTMLAttributes, ReactNode } from 'react'

// Estilos repetidos das telas de acesso (Addegas.dc.html, bloco isAuth).
export const btnPrimary = 'h-[58px] rounded-[3px_11px_4px_10px] bg-brand text-brand-ink text-[17px] font-extrabold cursor-pointer disabled:opacity-60 disabled:cursor-wait'
export const btnOutline = 'h-[52px] rounded-[3px_11px_4px_10px] border border-line-2 bg-transparent text-[15px] font-bold cursor-pointer'
export const btnText = 'self-center p-2 bg-transparent text-[#C4C4C9] text-sm font-bold cursor-pointer'

const pills: [string, string, string][] = [
  ['Caixa', '#FBC009', '2px 9px 3px 8px'], ['Estoque', '#F5F5F2', '8px 3px 9px 2px'], ['Combos', '#FBC009', '3px 8px 2px 9px'],
  ['iFood', '#F5F5F2', '9px 2px 8px 3px'], ['Zé Delivery', '#FBC009', '2px 9px 3px 8px'], ['99Food', '#F5F5F2', '8px 3px 9px 2px'],
  ['Keeta', '#FBC009', '3px 8px 2px 9px'],
]
const tilt = [-2, 1.5, -1, 2, -1.5, 1, -2]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh bg-bg text-ink">
      <div className="hidden tablet:flex flex-[1_1_50%] min-w-0 flex-col justify-start relative overflow-hidden bg-brand text-brand-ink"
        style={{ gap: 'clamp(14px,3vh,32px)', padding: 'clamp(24px,5vh,64px) clamp(28px,4vw,64px)' }}>
        <div aria-hidden="true" className="absolute -inset-10 pointer-events-none opacity-[.07] -rotate-12"
          style={{ backgroundImage: 'url(/assets/dd-pattern-canudo.png)', backgroundSize: '78px auto', backgroundRepeat: 'space' }} />
        <img src="/assets/dd-login-vidro.png" alt="" aria-hidden="true" className="absolute right-[-70px] bottom-[-80px] h-auto rotate-[-10deg] pointer-events-none"
          style={{ width: 'min(62%,54vh,560px)' }} />
        <img src="/assets/addegas-logo-preto-dd-branco.png" alt="Addegas" className="relative self-start block h-auto"
          style={{ width: 'clamp(180px,min(26vw,34vh),340px)' }} />
        <div className="relative max-w-[520px] flex flex-col gap-4" style={{ marginTop: 'clamp(4px,2vh,40px)' }}>
          <div className="font-black uppercase leading-[1.08] tracking-[-0.02em] [text-wrap:balance]" style={{ fontSize: 'clamp(28px,min(4.4vw,6.4vh),60px)', fontStretch: '100%' }}>
            Gestão feita pra <span className="inline-block bg-brand-ink text-white px-[.14em] rounded-[2px_8px_3px_7px] rotate-[-1.5deg]">adega</span>.
          </div>
          <div className="font-semibold leading-[1.45] max-w-[440px]" style={{ fontSize: 'clamp(15px,2vh,17px)' }}>
            Caixa, estoque, combos e pedidos dos apps em um só lugar.
          </div>
          <div className="flex flex-wrap gap-2">
            {pills.map(([t, c, r], i) => (
              <span key={t} className="px-3.5 py-2 bg-brand-ink text-sm font-extrabold" style={{ color: c, borderRadius: r, transform: `rotate(${tilt[i]}deg)` }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-[1_1_50%] min-w-0 overflow-y-auto flex px-6 py-8">
        <div className="w-full max-w-[420px] m-auto flex flex-col gap-4">
          <img src="/icons/addegas-logo-dark.png" alt="Addegas" className="tablet:hidden h-10 w-auto self-start mb-4" />
          {children}
        </div>
      </div>
    </div>
  )
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 mb-1">
      <div className="text-[30px] font-black uppercase leading-none tracking-[-0.01em]" style={{ fontStretch: '100%' }}>{children}</div>
      {sub && <div className="text-[15px] text-[#C4C4C9] leading-[1.45]">{sub}</div>}
    </div>
  )
}

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-[#C4C4C9]">{label}</span>
      <input {...input} className="h-[54px] px-4 rounded-[3px_10px_2px_9px] bg-surface border border-line-2 text-base w-full placeholder:text-[#ADADB4] focus:outline-none" />
    </label>
  )
}
