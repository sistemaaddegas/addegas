import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { NAV } from './routes'

/** desktop ≥1180: sidebar · tablet 720–1179: rail · celular <720: abas embaixo */
export function AppShell({ children }: { children: ReactNode }) {
  const groups = ['Operação', 'Gestão', 'Análise', 'Ferramentas', 'Configurar'] as const
  return (
    <div className="flex h-dvh bg-bg text-ink">
      <aside className="hidden desktop:flex w-[236px] flex-col gap-4 bg-bg-nav border-r border-line p-3 overflow-y-auto">
        <img src="/icons/addegas-logo-dark.png" alt="Addegas" className="h-[34px] w-auto self-start ml-2 mb-1 mt-2" />
        {groups.map((g) => (
          <nav key={g} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-[11px] font-extrabold uppercase tracking-widest text-ink-3">{g}</span>
            {NAV.filter((n) => n.group === g).map((n) => (
              <NavLink key={n.path} to={n.path} end className={({ isActive }) => `h-[42px] px-3 rounded-[10px] flex items-center font-semibold ${isActive ? 'bg-surface-2 text-brand' : 'text-[#C9C9CC]'}`}>{n.label}</NavLink>
            ))}
          </nav>
        ))}
      </aside>
      <aside className="hidden tablet:flex desktop:hidden w-[84px] flex-col items-center gap-1 bg-bg-nav border-r border-line py-4">
        <img src="/icons/dd-amarelo.png" alt="Addegas" className="w-10 mb-3" />
        {NAV.filter((n) => n.rail).map((n) => (
          <NavLink key={n.path} to={n.path} end className={({ isActive }) => `w-[66px] py-2.5 rounded-xl text-[11px] font-bold text-center ${isActive ? 'bg-surface-2 text-brand' : 'text-ink-2'}`}>{n.label}</NavLink>
        ))}
        <NavLink to="/mais" className="w-[66px] py-2.5 rounded-xl text-[11px] font-bold text-center text-ink-2">Mais</NavLink>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
        <nav className="tablet:hidden flex border-t border-line bg-bg px-1.5 pt-1 safe-bottom">
          {NAV.filter((n) => n.tab).map((n) => (
            <NavLink key={n.path} to={n.path} end className={({ isActive }) => `flex-1 h-[58px] flex items-center justify-center text-[11px] font-bold ${isActive ? 'text-brand' : 'text-[#8E8E93]'}`}>{n.path === '/caixa' ? 'Vender' : n.label}</NavLink>
          ))}
          <NavLink to="/mais" className="flex-1 h-[58px] flex items-center justify-center text-[11px] font-bold text-[#8E8E93]">Mais</NavLink>
        </nav>
      </div>
    </div>
  )
}
