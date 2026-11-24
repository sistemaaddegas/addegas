import { useNavigate } from 'react-router'
import { useAuth } from '@/lib/auth'
import { Icon } from '@/components/icon'
import { TABS } from './routes'
import { useMenu } from './AppShell'

/** O que não cabe nas abas (celular) ou no trilho (tablet), o ticket e sair. No computador fica tudo no menu lateral. */
export function Mais() {
  const { signOut, terminal } = useAuth()
  const { nav, selos } = useMenu()
  const navigate = useNavigate()
  // Celular: tudo que não está nas abas. Tablet: tudo que não está no trilho.
  const itens = terminal ? [] : nav.filter((n) => !TABS.some((t) => t.path === n.path))

  return (
    <div className="p-4 tablet:p-8 flex flex-col gap-3 max-w-[900px] mx-auto w-full">
      <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))]">
        {itens.map((n) => (
          <button key={n.path} onClick={() => navigate(n.path)}
            className={`relative flex flex-col items-start justify-between gap-5 h-28 p-4 rounded-[4px_10px_5px_9px] border border-line bg-surface-2 text-[15px] font-bold text-left cursor-pointer active:scale-[.97] ${n.rail ? 'tablet:hidden' : ''}`}>
            <span className="text-brand"><Icon name={n.icon} size={24} /></span>{n.label}
            {!!selos[n.path] && <span className="absolute top-3.5 right-3.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-brand-ink text-xs font-extrabold flex items-center justify-center">{selos[n.path]}</span>}
          </button>
        ))}
      </div>
      {!terminal && (
        <button onClick={() => navigate('/suporte')} className="h-[60px] rounded-[4px_13px_5px_11px] bg-brand text-brand-ink text-base font-extrabold flex items-center gap-3 px-[18px] cursor-pointer active:scale-[.97]">
          <Icon name="help" size={24} /><span className="flex-1 text-left">Registrar ticket</span><span className="text-[13px] font-bold">Problemas e melhorias</span>
        </button>
      )}
      <button onClick={signOut} className="h-[52px] rounded-[3px_11px_4px_10px] bg-[#E5241B] hover:bg-[#FF3B30] active:bg-[#B81C15] active:scale-[.97] transition text-white text-[15px] font-extrabold flex items-center justify-center gap-2 cursor-pointer">
        <Icon name="logout" />{terminal ? 'Desconectar este caixa' : 'Sair da conta'}
      </button>
    </div>
  )
}
