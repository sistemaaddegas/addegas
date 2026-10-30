import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/archivo/standard.css'
import './admin.css'
import { Painel } from './painel'

// Painel interno da equipe Addegas (admin.addegas.com.br, projeto separado na Vercel: D47).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Painel />
  </StrictMode>,
)
