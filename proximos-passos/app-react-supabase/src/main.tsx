import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { App } from '@/app/App'
import '@fontsource-variable/archivo/standard.css'
import '@/styles/tokens.css'
import { InstallProvider } from '@/components/pwa/install-provider'
import { ToastProvider } from '@/components/toast'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InstallProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </InstallProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
