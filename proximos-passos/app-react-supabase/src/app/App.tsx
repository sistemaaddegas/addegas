import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { useAuth } from '@/lib/auth'
import { NAV } from './routes'
import { AppShell } from './AppShell'
import { Mais } from './Mais'
import { InstallInvite } from '@/components/pwa/install-invite'
import { IosInstallTutorial } from '@/components/pwa/ios-install-tutorial'
import { UpdatePrompt } from '@/components/pwa/update-prompt'
import { Entrar } from '@/features/acesso/entrar'
import { Lojas } from '@/features/acesso/lojas'
import { NovaSenha } from '@/features/acesso/nova-senha'

type Stage = 'guest' | 'password' | 'store' | 'app'

/** Para onde a pessoa vai, conforme a etapa do acesso em que está. */
function Gate({ stage }: { stage: Stage }) {
  const { session, loading, storeId, needsNewPassword } = useAuth()
  if (loading) return null
  let where: Stage
  if (!session) where = 'guest'
  else if (needsNewPassword) where = 'password'
  else if (stage === 'store') where = 'store' // dá para trocar de loja a qualquer momento
  else where = storeId ? 'app' : 'store'
  if (where !== stage) return <Navigate to={{ guest: '/entrar', password: '/nova-senha', store: '/lojas', app: '/' }[where]} replace />
  return stage === 'app' ? <AppShell><Outlet /></AppShell> : <Outlet />
}

// Substitua cada Placeholder pela tela em src/features/<modulo> seguindo Addegas.dc.html
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
        <Route path="/cadastro" element={<Placeholder title="Cadastrar adega" />} />
        <Route element={<Gate stage="app" />}>
          {NAV.map((n) => <Route key={n.path} path={n.path} element={<Placeholder title={n.label} />} />)}
          <Route path="/mais" element={<Mais />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
