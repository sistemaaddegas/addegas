import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { useAuth } from '@/lib/auth'
import { NAV } from './routes'
import { AppShell } from './AppShell'

function RequireAuth() {
  const { session, loading, storeId } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/entrar" replace />
  if (!storeId) return <Navigate to="/lojas" replace />
  return <AppShell><Outlet /></AppShell>
}

// Substitua cada Placeholder pela tela em src/features/<modulo> seguindo Addegas.dc.html
const Placeholder = ({ title }: { title: string }) => <div className="p-8 display text-3xl">{title}</div>

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/entrar" element={<Placeholder title="Entrar" />} />
        <Route path="/lojas" element={<Placeholder title="Escolha a loja" />} />
        <Route path="/cadastro" element={<Placeholder title="Cadastrar adega" />} />
        <Route element={<RequireAuth />}>
          {NAV.map((n) => <Route key={n.path} path={n.path} element={<Placeholder title={n.label} />} />)}
          <Route path="/mais" element={<Placeholder title="Mais" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
