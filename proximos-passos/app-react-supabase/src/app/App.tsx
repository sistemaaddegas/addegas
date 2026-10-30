import { useEffect, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from '@/lib/auth'
import { NAV } from './routes'
import { AppShell } from './AppShell'
import { Mais } from './Mais'
import { InstallInvite } from '@/components/pwa/install-invite'
import { IosInstallTutorial } from '@/components/pwa/ios-install-tutorial'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import { Entrar } from '@/features/acesso/entrar'
import { Cadastro } from '@/features/acesso/cadastro'
import { AssinaturaTela } from '@/features/assinatura/assinatura'
import { Lojas } from '@/features/acesso/lojas'
import { NovaSenha } from '@/features/acesso/nova-senha'
import { Inicio } from '@/features/inicio/inicio'
import { Caixa } from '@/features/caixa/caixa'
import { Pedidos } from '@/features/pedidos/pedidos'
import { Estoque } from '@/features/estoque/estoque'
import { Clientes } from '@/features/clientes/clientes'
import { Relatorios } from '@/features/relatorios/relatorios'
import { Combos } from '@/features/combos/combos'
import { Compras } from '@/features/compras/compras'
import { Perfil } from '@/features/perfil/perfil'
import { Suporte } from '@/features/suporte/suporte'
import { Anotacoes } from '@/features/anotacoes/anotacoes'
import { Equipe } from '@/features/equipe/equipe'
import { AjustesTela } from '@/features/ajustes/ajustes'
import { WhatsApp } from '@/features/whatsapp/whatsapp'
import { LucroNoCopo } from '@/features/lucro-no-copo/lucro-no-copo'

type Stage = 'guest' | 'password' | 'store' | 'app'

/**
 * Conta da equipe Addegas não usa o app da adega: vai para o painel da equipe. No local o painel está na mesma
 * origem (/admin/), então a sessão é passada adiante e só falta o código do 2FA; em produção (admin.addegas.com.br)
 * a pessoa entra de novo lá.
 */
function IrParaPainel({ session }: { session: Session }) {
  useEffect(() => {
    const destino = import.meta.env.VITE_ADMIN_URL || '/admin/'
    if (destino.startsWith('/')) localStorage.setItem('addegas-admin-auth', JSON.stringify(session))
    // scope local: não revoga o token que acabou de ser passado para o painel.
    void supabase.auth.signOut({ scope: 'local' }).finally(() => location.replace(destino))
  }, [session])
  return null
}

/** Para onde a pessoa vai, conforme a etapa do acesso em que está. */
function Gate({ stage }: { stage: Stage }) {
  const { session, loading, storeId, needsNewPassword, terminal } = useAuth()
  const { pathname } = useLocation()
  if (loading) return null
  if (session?.user.app_metadata?.kind === 'staff' && !needsNewPassword) return <IrParaPainel session={session} />
  let where: Stage
  if (!session) where = 'guest'
  else if (needsNewPassword) where = 'password'
  else if (terminal) where = 'app' // aparelho de caixa: a loja vem do terminal
  else if (stage === 'store') where = 'store' // dá para trocar de loja a qualquer momento
  else where = storeId ? 'app' : 'store'
  // No aparelho de caixa só existe o caixa (e o Mais, para desconectar no celular).
  if (where === 'app' && stage === 'app' && terminal && pathname !== '/caixa' && pathname !== '/mais') return <Navigate to="/caixa" replace />
  if (where !== stage) return <Navigate to={{ guest: '/entrar', password: '/nova-senha', store: '/lojas', app: '/' }[where]} replace />
  return stage === 'app' ? <AppShell><Outlet /></AppShell> : <Outlet />
}

// Telas do menu (NAV); um item sem tela aqui mostra o Placeholder.
const TELAS: Record<string, ReactNode> = { '/': <Inicio />, '/caixa': <Caixa />, '/pedidos': <Pedidos />, '/estoque': <Estoque />, '/clientes': <Clientes />, '/relatorios': <Relatorios />, '/combos': <Combos />, '/compras': <Compras />, '/contas': <Compras contas />, '/anotacoes': <Anotacoes />, '/equipe': <Equipe />, '/ajustes': <AjustesTela />, '/whatsapp': <WhatsApp />, '/lucro-no-copo': <LucroNoCopo /> }
const Placeholder = ({ title }: { title: string }) => <div className="p-8 display text-3xl">{title}</div>

export function App() {
  return (
    <BrowserRouter>
      <UpdatePrompt />
      <InstallInvite />
      <IosInstallTutorial />
      <Routes>
        <Route element={<Gate stage="guest" />}>
          <Route path="/entrar" element={<Entrar />} />
        </Route>
        <Route element={<Gate stage="password" />}>
          <Route path="/nova-senha" element={<NovaSenha />} />
        </Route>
        <Route element={<Gate stage="store" />}>
          <Route path="/lojas" element={<Lojas />} />
        </Route>
        <Route path="/cadastro" element={<Cadastro />} />
        <Route element={<Gate stage="app" />}>
          {NAV.map((n) => <Route key={n.path} path={n.path} element={TELAS[n.path] ?? <Placeholder title={n.label} />} />)}
          <Route path="/mais" element={<Mais />} />
          <Route path="/assinatura" element={<AssinaturaTela />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/suporte" element={<Suporte />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
